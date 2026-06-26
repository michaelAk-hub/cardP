import { ConfigService } from '@nestjs/config';
import { CampaignChannel, DeliveryStatus } from '@blue-card/shared';
import { CampaignSendService } from './campaign-send.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { SmsSender } from '../sms/sms-sender';
import { UnsubscribeService } from '../notifications/unsubscribe.service';

function build(channel: CampaignChannel, recipients: any[]) {
  const updates: Array<{ id: string; status: DeliveryStatus }> = [];
  const campaignUpdate = jest.fn(async () => ({}));
  const prisma = {
    campaign: {
      findUnique: jest.fn(async () => ({
        id: 'c1', channel, subject: 'Hi', body: 'Deal!',
      })),
      update: campaignUpdate,
    },
    campaignRecipient: {
      findMany: jest.fn(async () => recipients),
      update: jest.fn(async ({ where, data }: any) => {
        updates.push({ id: where.id, status: data.deliveryStatus });
      }),
    },
  } as unknown as PrismaService;
  const mail = { sendCampaignEmail: jest.fn(async () => undefined) } as unknown as MailService;
  const sms = { send: jest.fn(async () => undefined) } as unknown as SmsSender;
  const unsubscribe = { optOutUrl: jest.fn(() => 'https://x/unsub') } as unknown as UnsubscribeService;
  const config = { get: jest.fn((_k: string, d?: unknown) => d) } as unknown as ConfigService;
  return {
    svc: new CampaignSendService(prisma, mail, sms, unsubscribe, config),
    mail, sms, updates, campaignUpdate,
  };
}

const rec = (id: string, consent: boolean) => ({
  id,
  student: { id: `s_${id}`, email: `${id}@x`, phone: `+30${id}`, marketingConsent: consent },
});

describe('CampaignSendService (consent filter + tracking)', () => {
  it('emails consenters with opt-out and marks non-consenters skipped_optout', async () => {
    const { svc, mail, updates } = build(CampaignChannel.Email, [
      rec('a', true),
      rec('b', false),
      rec('c', true),
    ]);

    await svc.run('c1');

    expect(mail.sendCampaignEmail).toHaveBeenCalledTimes(2); // a + c only
    expect(mail.sendCampaignEmail).toHaveBeenCalledWith(
      'a@x', 'Hi', 'Deal!', 'https://x/unsub', expect.anything(),
    );
    expect(updates).toContainEqual({ id: 'a', status: DeliveryStatus.Sent });
    expect(updates).toContainEqual({ id: 'c', status: DeliveryStatus.Sent });
    expect(updates).toContainEqual({ id: 'b', status: DeliveryStatus.SkippedOptout });
  });

  it('sends SMS with a STOP notice and records sent', async () => {
    const { svc, sms, updates } = build(CampaignChannel.Sms, [rec('a', true)]);
    await svc.run('c1');
    expect(sms.send).toHaveBeenCalledWith('+30a', expect.stringContaining('STOP'));
    expect(updates).toContainEqual({ id: 'a', status: DeliveryStatus.Sent });
  });

  it('records a failed delivery when the channel throws', async () => {
    const { svc, mail, updates } = build(CampaignChannel.Email, [rec('a', true)]);
    (mail.sendCampaignEmail as jest.Mock).mockRejectedValueOnce(new Error('smtp down'));
    await svc.run('c1');
    expect(updates).toContainEqual({ id: 'a', status: DeliveryStatus.Failed });
  });

  it('stamps sent_at when the run completes', async () => {
    const { svc, campaignUpdate } = build(CampaignChannel.Email, [rec('a', true)]);
    await svc.run('c1');
    expect(campaignUpdate).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { sentAt: expect.any(Date) },
    });
  });
});
