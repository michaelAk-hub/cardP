import { isActivationEligible } from '@blue-card/shared';

// Activation rule (spec §6.5 / acceptance criteria §13):
// active ONLY when phone_verified AND id_verified — never on email verify alone.
describe('activation rule', () => {
  it('is eligible only when phone AND id are verified', () => {
    expect(
      isActivationEligible({ phoneVerified: true, idVerified: true }),
    ).toBe(true);
  });

  it('is NOT eligible with only phone verified', () => {
    expect(
      isActivationEligible({ phoneVerified: true, idVerified: false }),
    ).toBe(false);
  });

  it('is NOT eligible with only id verified', () => {
    expect(
      isActivationEligible({ phoneVerified: false, idVerified: true }),
    ).toBe(false);
  });

  it('is NOT eligible when neither is verified', () => {
    expect(
      isActivationEligible({ phoneVerified: false, idVerified: false }),
    ).toBe(false);
  });
});
