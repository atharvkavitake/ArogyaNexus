import rateLimit from 'express-rate-limit';

const rateLimitResponse = { code: 'RATE_LIMITED', message: 'Too many attempts. Please try again later.' };

export function createLoginRateLimit(max = 10) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: max,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    handler: (_req, res) => res.status(429).json(rateLimitResponse),
  });
}

export function createRegisterRateLimit(max = 5) {
  return rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: max,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) => res.status(429).json(rateLimitResponse),
  });
}
