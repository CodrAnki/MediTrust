import { Router } from 'express';
import { requireAdmin } from '../middleware/authMiddleware.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { referenceUpload } from '../middleware/upload.js';
import { adminLogin, adminLogout, adminMe } from '../controllers/admin/authController.js';
import { listMedicines, getMedicine, createMedicine, updateMedicine, deleteMedicine, medicineOptions } from '../controllers/admin/medicineController.js';
import { listReferenceImages, uploadReferenceImages, updateReferenceImage, deleteReferenceImage } from '../controllers/admin/referenceImageController.js';
import { listBatches, getBatch, createBatch, updateBatch, deleteBatch, checkCode, listManufacturerQr, createManufacturerQr, deleteManufacturerQr } from '../controllers/admin/batchController.js';
import { dashboardStats, listVerifications, getVerification, listUsers, getUserHistory, setUserActive, listAuditLogs, getRiskEngine, putRiskEngine, getSystemSettings, putSystemSettings } from '../controllers/admin/systemController.js';

const router = Router();

// --- Public to the admin app (still rate limited) ---
router.post('/auth/login', authLimiter, adminLogin);

// --- Everything below requires a valid ADMIN token, enforced server-side ---
router.use(requireAdmin);

router.post('/auth/logout', adminLogout);
router.get('/me', adminMe);
router.get('/dashboard/stats', dashboardStats);

router.get('/medicines/options', medicineOptions);
router.route('/medicines').get(listMedicines).post(createMedicine);
router.route('/medicines/:id').get(getMedicine).put(updateMedicine).delete(deleteMedicine);

router.route('/reference-images').get(listReferenceImages).post(referenceUpload.array('images', 10), uploadReferenceImages);
router.route('/reference-images/:id').put(referenceUpload.single('image'), updateReferenceImage).delete(deleteReferenceImage);

router.route('/batches').get(listBatches).post(createBatch);
router.route('/batches/:id').get(getBatch).put(updateBatch).delete(deleteBatch);

router.get('/codes/check', checkCode);
router.route('/manufacturer-qr').get(listManufacturerQr).post(createManufacturerQr);
router.delete('/manufacturer-qr/:id', deleteManufacturerQr);

// Verification history is read-only by design.
router.get('/verifications', listVerifications);
router.get('/verifications/:id', getVerification);

router.get('/users', listUsers);
router.get('/users/:id/history', getUserHistory);
router.patch('/users/:id/active', setUserActive);

router.get('/audit-logs', listAuditLogs);
router.route('/risk-engine').get(getRiskEngine).put(putRiskEngine);
router.route('/settings').get(getSystemSettings).put(putSystemSettings);

export default router;
