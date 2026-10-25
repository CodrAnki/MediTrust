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

// Readiness is separate from liveness: a running process with no database
// connection must not be advertised as ready for verification requests.
router.get('/ready', (req, res) => {
  const ready = mongoose.connection.readyState === 1;
  res.status(ready ? 200 : 503).json({
    status: ready ? 'ready' : 'not_ready',
    service: 'mediTrust-server',
    database: READY_STATES[mongoose.connection.readyState] ?? 'unknown',
    time: new Date().toISOString(),
  });
});

export default router;
