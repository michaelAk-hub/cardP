import { BadRequestException } from '@nestjs/common';
import { DiscountType, OfferStatus } from '@blue-card/shared';
import { OffersService } from './offers.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BroadcastQueue } from '../notifications/broadcast-queue';

function build() {
  const updateMany = jest.fn(async () => ({ count: 3 }));
  const prisma = {
    store: { findUnique: jest.fn(async () => ({ id: 's1' })) },
    offer: { create: jest.fn(async ({ data }: any) => ({ id: 'o1', ...data })), updateMany },
  } as unknown as PrismaService;
  const audit = { record: jest.fn(async () => undefined) } as unknown as AuditService;
  const broadcast = { enqueue: jest.fn(async () => undefined) } as unknown as BroadcastQueue;
  return { svc: new OffersService(prisma, audit, broadcast), prisma, broadcast, updateMany };
}

describe('OffersService', () => {
  const baseOffer = {
    titleEn: 't', titleEl: 'τ', descriptionEn: 'd', descriptionEl: 'π',
    discountType: DiscountType.Percent, discountValue: 20,
    expiryDate: '2030-01-01',
  };

  it('creates an offer and broadcasts it', async () => {
    const { svc, broadcast } = build();
    const offer = await svc.create('adm1', 's1', baseOffer);
    expect(offer.id).toBe('o1');
    expect(broadcast.enqueue).toHaveBeenCalledWith('offer', 'o1');
  });

  it('rejects a percent discount above 100', async () => {
    const { svc } = build();
    await expect(
      svc.create('adm1', 's1', { ...baseOffer, discountValue: 150 }),
    ).rejects.toThrow(BadRequestException);
  });

  it('auto-expires active offers past their expiry date', async () => {
    const { svc, updateMany } = build();
    const res = await svc.expireOverdue();
    expect(res.expired).toBe(3);
    const arg = (updateMany as jest.Mock).mock.calls[0][0];
    expect(arg.where.status).toBe(OfferStatus.Active);
    expect(arg.where.expiryDate.lt).toBeInstanceOf(Date);
    expect(arg.data.status).toBe(OfferStatus.Expired);
  });
});
