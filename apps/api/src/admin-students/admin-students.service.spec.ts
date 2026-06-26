import { AccountStatus, ReviewDecision, WalletPassState } from '@blue-card/shared';
import { AdminStudentsService } from './admin-students.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { AuditService } from '../audit/audit.service';
import { ActivationService } from '../activation/activation.service';
import { MailService } from '../mail/mail.service';
import { HashingService } from '../auth/hashing.service';
import { TokenService } from '../auth/token.service';
import { StudentDeletionService } from '../gdpr/student-deletion.service';
import { ConfigService } from '@nestjs/config';

function build(student: any = { id: 'stu1', email: 's@test.dev', accountStatus: AccountStatus.Pending }) {
  const prisma = {
    student: {
      findUnique: jest.fn(async () => student),
      update: jest.fn(async () => student),
    },
    idReview: { create: jest.fn(async () => ({})) },
    walletPass: { updateMany: jest.fn(async () => ({ count: 0 })) },
    $transaction: jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
  } as unknown as PrismaService;
  const storage = {} as StorageService;
  const audit = { record: jest.fn(async () => undefined) } as unknown as AuditService;
  const activation = {
    reevaluate: jest.fn(async () => AccountStatus.Active),
  } as unknown as ActivationService;
  const mail = {
    sendIdRejection: jest.fn(async () => undefined),
    sendPasswordReset: jest.fn(async () => undefined),
  } as unknown as MailService;
  const hashing = { hashToken: jest.fn(() => 'h') } as unknown as HashingService;
  const tokens = { revokeAll: jest.fn(async () => undefined) } as unknown as TokenService;
  const deletion = { delete: jest.fn(async () => undefined) } as unknown as StudentDeletionService;
  const config = { get: jest.fn((_k: string, d?: unknown) => d) } as unknown as ConfigService;

  return {
    svc: new AdminStudentsService(prisma, storage, audit, activation, mail, hashing, tokens, deletion, config),
    prisma,
    audit,
    activation,
    mail,
    tokens,
  };
}

describe('AdminStudentsService', () => {
  it('approve sets id_verified, logs a review, and re-runs activation', async () => {
    const { svc, prisma, activation, audit } = build();
    const res = await svc.reviewId('adm1', 'stu1', { decision: ReviewDecision.Approved });

    expect(prisma.student.update).toHaveBeenCalledWith({
      where: { id: 'stu1' },
      data: { idVerified: true },
    });
    expect(prisma.idReview.create).toHaveBeenCalledWith({
      data: { studentId: 'stu1', adminId: 'adm1', decision: ReviewDecision.Approved },
    });
    expect(activation.reevaluate).toHaveBeenCalledWith('stu1');
    expect(audit.record).toHaveBeenCalledWith('adm1', 'id_review.approve', { studentId: 'stu1' });
    expect(res.accountStatus).toBe(AccountStatus.Active); // becomes active when phone already verified
  });

  it('reject keeps id_verified false and emails the student the reason', async () => {
    const { svc, prisma, mail, audit } = build();
    await svc.reviewId('adm1', 'stu1', {
      decision: ReviewDecision.Rejected,
      reason: 'blurry',
      description: 'photo unreadable',
    });

    expect(prisma.student.update).toHaveBeenCalledWith({
      where: { id: 'stu1' },
      data: { idVerified: false },
    });
    expect(mail.sendIdRejection).toHaveBeenCalledWith(
      's@test.dev',
      'blurry',
      'photo unreadable',
      expect.anything(),
    );
    expect(audit.record).toHaveBeenCalledWith(
      'adm1',
      'id_review.reject',
      expect.objectContaining({ studentId: 'stu1', reason: 'blurry' }),
    );
  });

  it('deactivate sets reason, revokes passes + sessions, and audits', async () => {
    const { svc, prisma, tokens, audit } = build();
    const res = await svc.deactivate('adm1', 'stu1', { reason: 'fraud' });

    expect(prisma.student.update).toHaveBeenCalledWith({
      where: { id: 'stu1' },
      data: { accountStatus: AccountStatus.Deactive, deactivationReason: 'fraud' },
    });
    expect(prisma.walletPass.updateMany).toHaveBeenCalledWith({
      where: { studentId: 'stu1', state: WalletPassState.Issued },
      data: { state: WalletPassState.Revoked },
    });
    expect(tokens.revokeAll).toHaveBeenCalledWith('student', 'stu1');
    expect(audit.record).toHaveBeenCalledWith(
      'adm1',
      'student.deactivate',
      expect.objectContaining({ studentId: 'stu1', reason: 'fraud' }),
    );
    expect(res.accountStatus).toBe(AccountStatus.Deactive);
  });
});
