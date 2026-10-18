import { body } from 'express-validator';

export const registerValidation = [
  body('name').trim().notEmpty().withMessage('Name is required.'),
  body('email').trim().isEmail().withMessage('Enter a valid email address.').normalizeEmail(),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters.'),
];

export const loginValidation = [
  body('email').trim().isEmail().withMessage('Enter a valid email address.').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required.'),
];

export const verifyEmailValidation = [
  body('email').trim().isEmail().withMessage('Enter a valid email address.').normalizeEmail(),
  body('otp').trim().matches(/^\d{6}$/).withMessage('Enter the 6-digit code.'),
];

export const resendOtpValidation = [
  body('email').trim().isEmail().withMessage('Enter a valid email address.').normalizeEmail(),
];
