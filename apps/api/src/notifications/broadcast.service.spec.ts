import { ConfigService } from '@nestjs/config';
import { AccountStatus } from '@blue-card/shared';
import { BroadcastService } from './broadcast.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { UnsubscribeService } from './unsubscribe.service';

function build(recipients: Array<{ id: string; email: string }>, activeTotal: number) {
  const prisma = {
    student: {
      findMany: jest.fn(async () => recipients),
      count: jest.fn(async () => activeTotal),
    },
    store: {
      findUnique: jest.fn(async () => ({
        id: 's1',
        nameEn: 'Cafe',
        descriptionEn: 'Great coffee',
      })),
    },
  } as unknown as PrismaService;
  const mail = { sendBroadcast: jest.fn(async () => undefined) } as unknown as MailService;
  const unsubscribe = {
    optOutUrl: jest.fn((id: string) => `https://x/unsub/${id}`),
  } as unknown as UnsubscribeService;
  const config = { get: jest.fn((_k: string, d?: unknown) => d) } as unknown as ConfigService;
  return { svc: new BroadcastService(prisma, mail, unsubscribe, config), prisma, mail };
}

describe('BroadcastService (consent filter + opt-out)', () => {
  it('targets ONLY active + consenting students and attaches an opt-out link', async () => {
    const { svc, prisma, mail } = build(
      [
        { id: 'a', email: 'a@x' },
        { id: 'b', email: 'b@x' },
      ],
      5, // 5 active total -> 3 skipped for non-consent
    );

    await svc.run('store', 's1');

    // audience query enforces the marketing-consent + active filter
    expect(prisma.student.findMany).toHaveBeenCalledWith({
      where: { accountStatus: AccountStatus.Active, marketingConsent: true },
      select: { id: true, email: true },
    });
    // one email per consenting recipient, each with that recipient's opt-out URL
    expect(mail.sendBroadcast).toHaveBeenCalledTimes(2);
    expect(mail.sendBroadcast).toHaveBeenCalledWith(
      'a@x',
      expect.stringContaining('Cafe'),
      expect.any(String),
      'https://x/unsub/a',
      expect.anything(),
    );
  });

  it('sends nothing when no one consents', async () => {
    const { svc, mail } = build([], 4);
    await svc.run('store', 's1');
    expect(mail.sendBroadcast).not.toHaveBeenCalled();
  });
});
