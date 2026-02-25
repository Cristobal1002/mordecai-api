import { Router } from 'express';
import { payController } from './pay.controller.js';

const router = Router();

// More specific routes first
// GET /pay/:token/details — Requires Authorization: Bearer <paySessionToken>. Returns full case/agreement data.
router.get('/:token/details', payController.getDetails);

// GET /pay/:token — Public, no auth. Registers click, returns status + branding.
router.get('/:token', payController.getByToken);

// POST /pay/:token/verify — Verify by last name + unit number. Returns paySessionToken for /details.
router.post('/:token/verify', payController.verify);

// POST /pay/:token/otp/send — Send OTP to debtor's phone (fallback when lease verify fails).
router.post('/:token/otp/send', payController.sendOtp);

// POST /pay/:token/otp/verify — Verify OTP code. Returns paySessionToken on success.
router.post('/:token/otp/verify', payController.verifyOtp);

export default router;
