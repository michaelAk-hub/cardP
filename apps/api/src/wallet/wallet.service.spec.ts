import { ForbiddenException } from '@nestjs/common';
import { AccountStatus, WalletPassState } from '@blue-card/shared';
import { WalletService } from './wallet.service';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleWalletService } from './google-wallet.service';
import { AppleWalletService } from './apple-wallet.service';

function build(student: any) {
  const upsert = jest.fn(async () => ({}));
  const updateMany = jest.fn(async () => ({ count: 2 }));
  const prisma = {
    student: {
      findUnique: jest.fn(async () => student),
      update: jest.fn(async ({ data }: any) => ({ ...student, ...data })),
    },
    walletPass: { upsert, updateMany, findMany: jest.fn(async () => []) },
  } as unknown as PrismaService;
  const google = { buildSaveUrl: jest.fn(() => 'https://pay.google.com/gp/v/save/tok'), configured: false } as unknown as GoogleWalletService;
  const apple = { generate: jest.fn(async () => ({ buffer: Buffer.from('z'), signed: false })), configured: false } as unknown as AppleWalletService;
  return { svc: new WalletService(prisma, google, apple), prisma, google, apple, upsert, updateMany };
}

const active = {
  id: 's1', name: 'Maria', surname: 'P', accountStatus: AccountStatus.Active,
  cardSerial: 'BC-1', university: { nameEn: 'UoA', nameEl: 'ΕΚΠΑ' },
};

describe('WalletService', () => {
  it('issues passes for an active student (both platforms)', async () => {
    const { svc, upsert } = build(active);
    await svc.issueForStudent('s1');
    expect(upsert).toHaveBeenCalledTimes(2); // apple + google
  });

  it('does not issue for a non-active student', async () => {
    const { svc, upsert } = build({ ...active, accountStatus: AccountStatus.Pending });
    await svc.issueForStudent('s1');
    expect(upsert).not.toHaveBeenCalled();
  });

  it('builds a Google save URL for an active student', async () => {
    const { svc, google } = build(active);
    const res = await svc.googleSaveUrl('s1');
    expect(res.saveUrl).toContain('pay.google.com');
    expect(google.buildSaveUrl).toHaveBeenCalled();
  });

  it('refuses wallet artifacts for a non-active account', async () => {
    const { svc } = build({ ...active, accountStatus: AccountStatus.Pending });
    await expect(svc.googleSaveUrl('s1')).rejects.toThrow(ForbiddenException);
    await expect(svc.applePkpass('s1')).rejects.toThrow(ForbiddenException);
  });

  it('revokes issued passes', async () => {
    const { svc, updateMany } = build(active);
    await svc.revokeForStudent('s1');
    expect(updateMany).toHaveBeenCalledWith({
      where: { studentId: 's1', state: WalletPassState.Issued },
      data: { state: WalletPassState.Revoked },
    });
  });
});
