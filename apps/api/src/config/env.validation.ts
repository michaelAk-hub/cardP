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

  // ----- Wallet (optional — dev stub signers used until configured) -----
  WALLET_DEV_SIGNING_SECRET: Joi.string().default('dev-wallet-signing-secret'),
  // Google Wallet
  GOOGLE_WALLET_ISSUER_ID: Joi.string().allow('').optional(),
  GOOGLE_WALLET_SERVICE_ACCOUNT_PATH: Joi.string().allow('').optional(),
  GOOGLE_WALLET_CLASS_SUFFIX: Joi.string().default('bluecard_student'),
  GOOGLE_WALLET_LOGO_URL: Joi.string().allow('').optional(),
  GOOGLE_WALLET_BG_COLOR: Joi.string().default('#0A4DA2'),
  // Apple Wallet (PassKit). Provide PEM-converted certs; see README.
  APPLE_PASS_TYPE_ID: Joi.string().allow('').optional(),
  APPLE_TEAM_ID: Joi.string().allow('').optional(),
  APPLE_PASS_CERT_PEM_PATH: Joi.string().allow('').optional(),
  APPLE_PASS_KEY_PEM_PATH: Joi.string().allow('').optional(),
  APPLE_PASS_KEY_PASSWORD: Joi.string().allow('').optional(),
  APPLE_WWDR_PEM_PATH: Joi.string().allow('').optional(),
  APPLE_PASS_ORG_NAME: Joi.string().default('Blue Card'),

  // ----- Jobs / queue -----
  // 'inline' runs jobs in-process (dev, no Redis); 'bullmq' uses Redis.
  QUEUE_DRIVER: Joi.string().valid('inline', 'bullmq').default('inline'),
  // With the bullmq driver, whether THIS process consumes the queues. The API
  // sets false (enqueue only); the dedicated worker sets true. Ignored for the
  // inline driver (jobs always run in-process).
  RUN_WORKERS: Joi.boolean().truthy('true').falsy('false').default(true),
  // Tamper score thresholds (advisory): >= suspect -> suspect, >= flagged -> flagged.
  TAMPER_SUSPECT_THRESHOLD: Joi.number().min(0).max(1).default(0.34),
  TAMPER_FLAGGED_THRESHOLD: Joi.number().min(0).max(1).default(0.67),
}).unknown(true);
