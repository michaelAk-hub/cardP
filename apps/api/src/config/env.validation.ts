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

  // ----- ID-photo storage (optional until configured) -----
  // 'local' (dev, encrypted-on-disk) or 's3' (S3-compatible bucket).
  STORAGE_DRIVER: Joi.string().valid('local', 's3').default('local'),
  LOCAL_STORAGE_DIR: Joi.string().default('./var/id-photos'),
  // 32-byte hex key (64 chars) for at-rest encryption with the local driver.
  STORAGE_ENCRYPTION_KEY: Joi.string().hex().length(64).optional(),
  S3_ENDPOINT: Joi.string().allow('').optional(),
  S3_REGION: Joi.string().default('auto'),
  S3_BUCKET: Joi.string().allow('').optional(),
  S3_ACCESS_KEY_ID: Joi.string().allow('').optional(),
  S3_SECRET_ACCESS_KEY: Joi.string().allow('').optional(),
  S3_FORCE_PATH_STYLE: Joi.boolean().truthy('true').falsy('false').default(true),
  S3_SSE: Joi.string().allow('').default('AES256'),
  SIGNED_URL_TTL_SECONDS: Joi.number().default(120),

  // ----- Twilio Verify (phone OTP) — optional; dev verifier used if absent -----
  TWILIO_ACCOUNT_SID: Joi.string().allow('').optional(),
  TWILIO_AUTH_TOKEN: Joi.string().allow('').optional(),
  TWILIO_VERIFY_SERVICE_SID: Joi.string().allow('').optional(),
  OTP_DEV_CODE: Joi.string().default('000000'),
}).unknown(true);
