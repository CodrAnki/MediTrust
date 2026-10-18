import { Router } from 'express';
import { register, login, me, verifyEmail, resendOtp } from '../controllers/authController.js';
import { registerValidation, loginValidation, verifyEmailValidation, resendOtpValidation } from '../middleware/validators/authValidators.js';
import { handleValidation } from '../middleware/handleValidation.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { authLimiter, otpLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.post('/register', authLimiter, registerValidation, handleValidation, register);
router.post('/verify-email', otpLimiter, verifyEmailValidation, handleValidation, verifyEmail);
router.post('/resend-otp', otpLimiter, resendOtpValidation, handleValidation, resendOtp);
router.post('/login', authLimiter, loginValidation, handleValidation, login);
router.get('/me', requireAuth, me);

export default router;
