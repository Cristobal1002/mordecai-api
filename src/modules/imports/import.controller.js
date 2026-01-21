
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
            res.success(result);
        } catch (error) {
            next(error);
        }
    },

    processBatch: async (req, res, next) => {
        try {
            const { tenantId, batchId } = req.params;
            // Start processing asynchronously (fire and forget for response, but await for MVP simplicity to see result?)
            // User requested "POST ... process -> procesar XLSX...". 
            // Often better to return "Processing started" and let client poll.
            // But for verifying debug loop, avoiding async complexity might be better. 
            // Let's TRIGGER it and return.

            importService.processBatch(tenantId, batchId).catch(err => {
                console.error('Async processing error', err);
            });

            res.success({ message: 'Batch processing started. Check status endpoint.' });
        } catch (error) {
            next(error);
        }
    }
};
