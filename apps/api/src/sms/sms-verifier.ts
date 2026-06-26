// Phone-number verification via a one-time code. The code lifecycle (issue,
// expiry, attempt limits) lives in the provider (Twilio Verify) — we only
// start a verification and check a submitted code.
export abstract class SmsVerifier {
  abstract startVerification(phone: string): Promise<void>;
  abstract checkVerification(phone: string, code: string): Promise<boolean>;
}
