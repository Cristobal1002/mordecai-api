import fs from 'fs';
import path from 'path';
import { Router } from 'express';
import multer from 'multer';
import { payController } from './pay.controller.js';

const router = Router();

const payUploadDir = 'uploads/pay';
if (!fs.existsSync(payUploadDir)) {
  fs.mkdirSync(payUploadDir, { recursive: true });
}

const payFileStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, payUploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '') || '.bin';
    cb(null, `pay-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const allowedEvidenceMimes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'application/pdf'];
const payFileUpload = multer({
  storage: payFileStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (allowedEvidenceMimes.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only PNG, JPEG, GIF, WebP or PDF allowed'));
  },
});

// More specific routes first
// GET /pay/:token/details — Requires Authorization: Bearer <paySessionToken>. Returns full case/agreement data.
router.get('/:token/details', payController.getDetails);

// POST /pay/:token/dispute — Requires Bearer JWT. Create dispute from portal.
router.post('/:token/dispute', payController.createDisputeFromPortal);

// Dispute evidence: presign for upload, then add s3Keys to dispute
router.post('/:token/dispute/evidence/presign', payController.presignDisputeEvidence);
router.post('/:token/dispute/evidence', payController.addDisputeEvidence);
// Single-file upload (multipart): server uploads to S3 and adds key to dispute
router.post('/:token/dispute/evidence/upload', payFileUpload.single('file'), payController.uploadDisputeEvidence);

// Agreement payment proof: presign for upload, then add s3Keys to agreement
router.post('/:token/agreement/proof/presign', payController.presignAgreementProof);
router.post('/:token/agreement/proof', payController.addAgreementProof);
// Single-file upload (multipart): server uploads to S3 and adds key to agreement
router.post('/:token/agreement/proof/upload', payFileUpload.single('file'), payController.uploadAgreementProof);

// GET /pay/:token — Public, no auth. Registers click, returns status + branding.
router.get('/:token', payController.getByToken);

// POST /pay/:token/verify — Verify by last name + unit number. Returns paySessionToken for /details.
router.post('/:token/verify', payController.verify);

// POST /pay/:token/otp/send — Send OTP to debtor's phone (fallback when lease verify fails).
router.post('/:token/otp/send', payController.sendOtp);

// POST /pay/:token/otp/verify — Verify OTP code. Returns paySessionToken on success.
router.post('/:token/otp/verify', payController.verifyOtp);

export default router;
