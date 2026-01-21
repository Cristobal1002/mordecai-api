
import { importService } from './import.service.js';

export const importController = {
    createBatch: async (req, res, next) => {
        try {
            if (!req.file) {
                return res.status(400).json({ success: false, message: 'No file uploaded' });
            }

            const { tenantId } = req.params;
            const result = await importService.createBatch(tenantId, req.file);

            res.created(result, 'Batch created successfully');
        } catch (error) {
            next(error);
        }
    },

    getBatchStatus: async (req, res, next) => {
        try {
            const { tenantId, batchId } = req.params;
            const result = await importService.getBatchStatus(tenantId, batchId);
            res.ok(result, 'Batch status retrieved successfully');
        } catch (error) {
            next(error);
        }
    },

    processBatch: async (req, res, next) => {
        try {
            const { tenantId, batchId } = req.params;
            const result = await importService.processBatch(tenantId, batchId);
            res.ok(result, 'Batch processed successfully');
        } catch (error) {
            next(error);
        }
    }
};
