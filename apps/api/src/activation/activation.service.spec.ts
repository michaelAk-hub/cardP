import { AccountStatus } from '@blue-card/shared';
import { ActivationService } from './activation.service';
import { PrismaService } from '../prisma/prisma.service';

function build(student: any) {
  const update = jest.fn(async () => student);
  const prisma = {
    student: {
      findUnique: jest.fn(async () => student),
      update,
    },
  } as unknown as PrismaService;
  return { svc: new ActivationService(prisma), update };
}

describe('ActivationService — the activation rule', () => {
  it('activates pending when phone AND id are verified', async () => {
    const { svc, update } = build({
      id: 's1',
      accountStatus: AccountStatus.Pending,
      phoneVerified: true,
      idVerified: true,
    });
    const status = await svc.reevaluate('s1');
    expect(status).toBe(AccountStatus.Active);
    expect(update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: { accountStatus: AccountStatus.Active },
    });
  });

  it('keeps pending when only phone is verified', async () => {
    const { svc, update } = build({
      id: 's2',
      accountStatus: AccountStatus.Pending,
      phoneVerified: true,
      idVerified: false,
    });
    expect(await svc.reevaluate('s2')).toBe(AccountStatus.Pending);
    expect(update).not.toHaveBeenCalled();
  });

  it('keeps pending when only id is verified (email never gates)', async () => {
    const { svc, update } = build({
      id: 's3',
      accountStatus: AccountStatus.Pending,
      phoneVerified: false,
      idVerified: true,
    });
    expect(await svc.reevaluate('s3')).toBe(AccountStatus.Pending);
    expect(update).not.toHaveBeenCalled();
  });

  it('demotes active to pending if eligibility is lost', async () => {
    const { svc, update } = build({
      id: 's4',
      accountStatus: AccountStatus.Active,
      phoneVerified: true,
      idVerified: false,
    });
    expect(await svc.reevaluate('s4')).toBe(AccountStatus.Pending);
    expect(update).toHaveBeenCalledWith({
      where: { id: 's4' },
      data: { accountStatus: AccountStatus.Pending },
    });
  });

  it('never auto-flips a manually deactivated account', async () => {
    const { svc, update } = build({
      id: 's5',
      accountStatus: AccountStatus.Deactive,
      phoneVerified: true,
      idVerified: true,
    });
    expect(await svc.reevaluate('s5')).toBe(AccountStatus.Deactive);
    expect(update).not.toHaveBeenCalled();
  });
});
