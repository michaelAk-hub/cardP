export * from './enums';

// Activation rule (spec section 6.5): an account becomes `active` ONLY when
// phone_verified AND id_verified are both true. Email verification is never
// part of this rule. Centralised here so the API and tests share one source.
export function isActivationEligible(input: {
  phoneVerified: boolean;
  idVerified: boolean;
}): boolean {
  return input.phoneVerified === true && input.idVerified === true;
}
