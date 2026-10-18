import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { getDashboardStats } from '../controllers/dashboardController.js';

const router = Router();

router.get('/stats', requireAuth, getDashboardStats);

export default router;
