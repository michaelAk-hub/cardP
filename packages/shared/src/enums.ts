// Shared enums — mirror the Prisma schema (apps/api/prisma/schema.prisma).
// Keep these in sync with the database enums; they are the contract between
// the API, the admin dashboard, and the mobile app.

export enum AccountStatus {
  Pending = 'pending',
  Active = 'active',
  Deactive = 'deactive',
}

export enum AdminRole {
  Root = 'root',
  Protoporia = 'protoporia',
}

export enum TamperStatus {
  Clean = 'clean',
  Suspect = 'suspect',
  Flagged = 'flagged',
}

export enum ReviewDecision {
  Approved = 'approved',
  Rejected = 'rejected',
}

export enum StoreStatus {
  Active = 'active',
  Hidden = 'hidden',
}

export enum DiscountType {
  Percent = 'percent',
  Fixed = 'fixed',
}

export enum OfferStatus {
  Active = 'active',
  Expired = 'expired',
}

export enum WalletPlatform {
  Apple = 'apple',
  Google = 'google',
}

export enum WalletPassState {
  Issued = 'issued',
  Revoked = 'revoked',
}

export enum VerificationTokenType {
  PhoneOtp = 'phone_otp',
  EmailVerify = 'email_verify',
  PasswordReset = 'password_reset',
}

export enum CampaignChannel {
  Sms = 'sms',
  Email = 'email',
}

export enum DeliveryStatus {
  Queued = 'queued',
  Sent = 'sent',
  Failed = 'failed',
  SkippedOptout = 'skipped_optout',
}

export const SUPPORTED_LOCALES = ['el', 'en'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
