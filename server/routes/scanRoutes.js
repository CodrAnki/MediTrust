import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { listScans, getScanById } from '../controllers/scanController.js';

const router = Router();

router.get('/', requireAuth, listScans);
router.get('/:id', requireAuth, getScanById);

export default router;
