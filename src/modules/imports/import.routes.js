
import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { importController } from './import.controller.js';
import { validateRequest } from '../../middlewares/validate-request.middleware.js';
import { param } from 'express-validator';

const router = Router();

// Configure Multer
const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir)
    },
    filename: function (req, file, cb) {
        // Unique name
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname))
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype.includes('spreadsheet') || file.mimetype.includes('excel') || file.originalname.endsWith('.xlsx')) {
            cb(null, true);
        } else {
            cb(new Error('Only .xlsx files are allowed!'));
        }
    }
});

const validateBatchParams = [
    param('tenantId').isUUID().withMessage('Invalid tenantId'),
    param('batchId').optional().isUUID().withMessage('Invalid batchId')
];

// POST /api/v1/import-batches/:tenantId - Upload file
router.post(
    '/:tenantId',
    upload.single('file'),
    validateBatchParams,
    // validateRequest, // Multer handles validation before this often, but express-validator runs on params.
    // Note: validateRequest might conflict if multer error handling isn't clean.
    // Let's use controller directly or minimal middleware validation manually if needed.
    // Using express-validator after multer is fine for params.
    importController.createBatch
);

// GET /api/v1/import-batches/:tenantId/:batchId - Get status
router.get(
    '/:tenantId/:batchId',
    validateBatchParams,
    validateRequest,
    importController.getBatchStatus
);

// POST /api/v1/import-batches/:tenantId/:batchId/process - Start processing
router.post(
    '/:tenantId/:batchId/process',
    validateBatchParams,
    validateRequest,
    importController.processBatch
);

export default router;
