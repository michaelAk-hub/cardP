import { BadRequestException } from '@nestjs/common';
import { AccountStatus } from '@blue-card/shared';
import { PhoneVerificationService } from './phone-verification.service';
import { PrismaService } from '../prisma/prisma.service';
import { SmsVerifier } from '../sms/sms-verifier';
import { ActivationService } from '../activation/activation.service';

function build(student: any, checkResult = true) {
  const prisma = {
    student: {
      findUnique: jest.fn(async () => student),
      update: jest.fn(async () => student),
    },
  } as unknown as PrismaService;
  const sms = {
    startVerification: jest.fn(async () => undefined),
    checkVerification: jest.fn(async () => checkResult),
  } as unknown as SmsVerifier;
  const activation = {
    reevaluate: jest.fn(async () => AccountStatus.Pending),
  } as unknown as ActivationService;
  return {
    svc: new PhoneVerificationService(prisma, sms, activation),
    prisma,
    sms,
    activation,
  };
}

describe('PhoneVerificationService', () => {
  it('sends an OTP for an unverified phone', async () => {
    const { svc, sms } = build({ id: 's1', phone: '+30699', phoneVerified: false });
    await expect(svc.sendOtp('s1')).resolves.toEqual({ status: 'sent' });
    expect(sms.startVerification).toHaveBeenCalledWith('+30699');
  });

  it('refuses to resend when already verified', async () => {
    const { svc } = build({ id: 's1', phone: '+30699', phoneVerified: true });
    await expect(svc.sendOtp('s1')).rejects.toThrow(BadRequestException);
  });

  it('rejects an invalid code', async () => {
    const { svc } = build({ id: 's1', phone: '+30699', phoneVerified: false }, false);
    await expect(svc.verifyOtp('s1', '999999')).rejects.toThrow(BadRequestException);
  });

  it('verifies, sets the flag, and re-runs the activation rule', async () => {
    const { svc, prisma, activation } = build(
      { id: 's1', phone: '+30699', phoneVerified: false },
      true,
    );
    const res = await svc.verifyOtp('s1', '123456');
    expect(prisma.student.update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: { phoneVerified: true },
    });
    expect(activation.reevaluate).toHaveBeenCalledWith('s1');
    expect(res.phoneVerified).toBe(true);
  });
});
