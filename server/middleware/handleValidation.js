import { validationResult } from 'express-validator';

export function handleValidation(req, res, next) {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    const firstError = result.array()[0];
    return res.status(400).json({
      message: firstError.msg,
      errors: result.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  return next();
}
