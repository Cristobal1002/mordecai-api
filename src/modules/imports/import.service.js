
import fs from 'fs';
import xlsx from 'xlsx';
import { sequelize } from '../../config/database.js';
import { importRepository } from './import.repository.js';
import { Debtor, DebtCase, FlowPolicy } from '../../models/index.js';
import { logger } from '../../utils/logger.js';
import { Op } from 'sequelize';

export const importService = {
    createBatch: async (tenantId, file) => {
        // File is the object from multer
        // file.path contains the local path

        //TODO: persist xslx in s3

        return await importRepository.create({
            tenantId,
            source: 'XLSX',
            fileKey: file.path,
            status: 'PENDING',
            totalRows: 0 // Will be updated on process
        });
    },

    getBatchStatus: async (tenantId, batchId) => {
        const batch = await importRepository.findById(batchId);
        if (!batch) throw new Error('Batch not found');
        if (batch.tenantId !== tenantId) throw new Error('Unauthorized access to batch');
        return batch;
    },

    processBatch: async (tenantId, batchId) => {
        const batch = await importRepository.findById(batchId);
        if (!batch) throw new Error('Batch not found');
        if (batch.tenantId !== tenantId) throw new Error('Unauthorized');
        if (batch.status !== 'PENDING') throw new Error(`Batch is in ${batch.status} status`);

        // Start processing
        await importRepository.update(batchId, { status: 'PROCESSING', processedAt: new Date() });

        try {
            if (!fs.existsSync(batch.fileKey)) {
                throw new Error(`File not found at ${batch.fileKey}`);
            }

            const workbook = xlsx.readFile(batch.fileKey);
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const rows = xlsx.utils.sheet_to_json(sheet);

            await importRepository.update(batchId, { totalRows: rows.length });

            let successCount = 0;
            let errorCount = 0;
            const errors = [];

            // Pre-fetch flow policies for this tenant to avoid querying in loop
            const policies = await FlowPolicy.findAll({
                where: { tenantId, isActive: true }
            });

            // Iterate rows
            // Note: For MVP we do sequential processing. for Scale we'd use streams or queues.
            for (const [index, row] of rows.entries()) {
                const rowIndex = index + 2; // +2 considering header and 1-based index
                const t = await sequelize.transaction();

                try {
                    // Validate required fields
                    // Expected: external_id, name, email, phone, debt_amount, due_date
                    if (!row.external_id || !row.name || !row.debt_amount || !row.due_date) {
                        throw new Error('Missing required fields (external_id, name, debt_amount, due_date)');
                    }

                    // 1. Upsert Debtor
                    const [debtor] = await Debtor.upsert({
                        tenantId,
                        externalRef: String(row.external_id),
                        fullName: row.name,
                        email: row.email,
                        phone: row.phone ? String(row.phone) : null,
                        metadata: { imported_from_batch: batchId }
                    }, { transaction: t });

                    // 2. Calculate Days Past Due
                    // Handle different date formats if necessary, but assuming standard JS parsable
                    const dueDate = new Date(row.due_date);
                    if (isNaN(dueDate.getTime())) throw new Error(`Invalid date format for due_date: ${row.due_date}`);

                    const now = new Date();
                    const diffTime = Math.abs(now - dueDate);
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    // Technically if due date is in future, dpd might be negative? 
                    // Let's assume past due if date is before now.
                    const isPastDue = now > dueDate;
                    const daysPastDue = isPastDue ? diffDays : 0;

                    // 3. Find matching policy
                    // Policy rules: min <= dpd <= max (or max is null)
                    let selectedPolicyId = null;
                    const policy = policies.find(p => {
                        const minOk = daysPastDue >= p.minDaysPastDue;
                        const maxOk = p.maxDaysPastDue === null || daysPastDue <= p.maxDaysPastDue;
                        return minOk && maxOk;
                    });

                    if (policy) {
                        selectedPolicyId = policy.id;
                    }

                    // 4. Upsert Debt Case
                    // We assume 1 active case per debtor for MVP simplicity? 
                    // Or maybe we treat external_id + logic as unique case?
                    // Let's create a new case or update existing "OPEN" case for this debtor.
                    // For MVP, let's just create/update a unique case per debtor (1:1 simplification)
                    // or if we have a "case_id" column in XLSX use that.
                    // Let's assume 1 active debt per debtor for now.

                    // Find existing open case
                    let debtCase = await DebtCase.findOne({
                        where: {
                            tenantId,
                            debtorId: debtor.id,
                            status: { [Op.notIn]: ['PAID', 'CLOSED'] }
                        },
                        transaction: t
                    });

                    if (debtCase) {
                        await debtCase.update({
                            amount: row.debt_amount,
                            dueDate: dueDate,
                            daysPastDue: daysPastDue,
                            flowPolicyId: selectedPolicyId, // Update policy as DPD changes
                            // status: remains same unless logic changes it
                        }, { transaction: t });
                    } else {
                        await DebtCase.create({
                            tenantId,
                            debtorId: debtor.id,
                            amount: row.debt_amount,
                            dueDate: dueDate,
                            status: 'PENDING', // Start as pending/active
                            daysPastDue: daysPastDue,
                            flowPolicyId: selectedPolicyId,
                            nextActionAt: new Date() // ready for worker
                        }, { transaction: t });
                    }

                    await t.commit();
                    successCount++;

                } catch (err) {
                    await t.rollback();
                    errorCount++;
                    errors.push({ row: rowIndex, error: err.message, date: row });
                }
            }

            // Final Update
            await importRepository.update(batchId, {
                status: errorCount === rows.length ? 'FAILED' : 'COMPLETED',
                successRows: successCount,
                errorRows: errorCount,
                errors: errors // store errors JSON
            });

            return {
                status: 'COMPLETED',
                total: rows.length,
                success: successCount,
                failed: errorCount
            };

        } catch (error) {
            logger.error({ error }, 'Fatal error processing batch');
            await importRepository.update(batchId, {
                status: 'FAILED',
                errors: [{ error: 'Fatal error: ' + error.message }]
            });
            throw error;
        }
    }
};
