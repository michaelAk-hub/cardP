// Raw SMS sending (marketing campaigns). Distinct from SmsVerifier (OTP):
// here we compose and send arbitrary message bodies via a sender number.
export abstract class SmsSender {
  abstract send(to: string, body: string): Promise<void>;
}
