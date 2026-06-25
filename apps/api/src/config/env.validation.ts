import * as Joi from 'joi';

// Validates the subset of environment variables the foundation needs to boot.
// Integration credentials (Twilio, email, S3, wallet) are intentionally
// optional at this stage — they are required only by their respective
// milestones and are documented in .env.example.
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  API_PORT: Joi.number().default(3000),
  API_PUBLIC_URL: Joi.string().uri().default('http://localhost:3000'),

  DATABASE_URL: Joi.string().required(),

  REDIS_URL: Joi.string().default('redis://localhost:6379'),

  JWT_ACCESS_SECRET: Joi.string().min(16).default('dev-access-secret-change-me'),
  JWT_REFRESH_SECRET: Joi.string()
    .min(16)
    .default('dev-refresh-secret-change-me'),
  JWT_ACCESS_TTL: Joi.string().default('15m'),
  JWT_REFRESH_TTL: Joi.string().default('30d'),
  TOTP_ISSUER: Joi.string().default('Blue Card'),

  DEFAULT_LOCALE: Joi.string().valid('el', 'en').default('el'),
  SUPPORTED_LOCALES: Joi.string().default('el,en'),
}).unknown(true);
