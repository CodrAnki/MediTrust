import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import upload from '../middleware/upload.js';
import { verificationLimiter, verificationPreviewLimiter, progressLimiter } from '../middleware/rateLimiter.js';
import { previewVerification, submitVerification, getVerificationById, getVerificationProgress } from '../controllers/verificationController.js';

const router = Router();
const verificationUpload = upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'images', maxCount: 5 },
  { name: 'qrImage', maxCount: 1 },
]);

// Keep the legacy single-image field compatible while accepting multi-photo
// medicine submissions and a separately tagged QR photo.
router.post(
  '/preview',
  requireAuth,
  verificationPreviewLimiter,
  verificationUpload,
  previewVerification
);
router.post(
  '/',
  requireAuth,
  verificationLimiter,
  verificationUpload,
  submitVerification
);
router.get('/progress/:jobId', requireAuth, progressLimiter, getVerificationProgress);
router.get('/:id', requireAuth, getVerificationById);

export default router;
