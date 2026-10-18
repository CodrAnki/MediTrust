import { Router } from 'express';
import mongoose from 'mongoose';

const router = Router();

const READY_STATES = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

router.get('/', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'mediTrust-server',
    time: new Date().toISOString(),
    database: READY_STATES[mongoose.connection.readyState] ?? 'unknown',
  });
});

export default router;
