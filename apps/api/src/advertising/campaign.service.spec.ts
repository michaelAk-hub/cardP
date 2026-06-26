import { BadRequestException } from '@nestjs/common';
import { CampaignChannel } from '@blue-card/shared';
import { CampaignService } from './campaign.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CampaignQueue } from './campaign-queue';

function build(audience: Array<{ id: string }> = [{ id: 'a' }, { id: 'b' }]) {
  const prisma = {
    student: {
      findMany: jest.fn(async () => audience),
      count: jest.fn(async ({ where }: any) => (where?.marketingConsent ? 3 : 5)),
    },
    campaign: { create: jest.fn(async () => ({ id: 'c1' })) },
    $transaction: jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
  } as unknown as PrismaService;
  const audit = { record: jest.fn(async () => undefined) } as unknown as AuditService;
  const queue = { enqueue: jest.fn(async () => undefined) } as unknown as CampaignQueue;
  return { svc: new CampaignService(prisma, audit, queue), prisma, queue };
}

describe('CampaignService', () => {
  it('preview reports matching / consenting / skipped', async () => {
    const { svc } = build();
    expect(await svc.preview({})).toEqual({
      matching: 5,
      consenting: 3,
      skippedOptout: 2,
    });
  });

  it('rejects an email campaign without a subject', async () => {
    const { svc } = build();
    await expect(
      svc.create('adm1', { channel: CampaignChannel.Email, body: 'hi' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects an empty audience', async () => {
    const { svc } = build([]);
    await expect(
      svc.create('adm1', { channel: CampaignChannel.Sms, body: 'hi' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('creates a campaign with recipients and enqueues the send', async () => {
    const { svc, queue } = build();
    const res = await svc.create('adm1', {
      channel: CampaignChannel.Sms,
      body: 'Big sale',
      audience: { status: undefined },
    });
    expect(res.recipientCount).toBe(2);
    expect(queue.enqueue).toHaveBeenCalledWith('c1');
  });
});
