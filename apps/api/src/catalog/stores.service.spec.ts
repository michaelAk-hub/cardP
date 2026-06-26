import { StoreStatus } from '@blue-card/shared';
import { StoresService } from './stores.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { AuditService } from '../audit/audit.service';
import { BroadcastQueue } from '../notifications/broadcast-queue';

function build(createdStatus: StoreStatus) {
  const prisma = {
    store: {
      create: jest.fn(async ({ data }: any) => ({ id: 'st1', ...data })),
    },
  } as unknown as PrismaService;
  const storage = {} as StorageService;
  const audit = { record: jest.fn(async () => undefined) } as unknown as AuditService;
  const broadcast = { enqueue: jest.fn(async () => undefined) } as unknown as BroadcastQueue;
  return { svc: new StoresService(prisma, storage, audit, broadcast), broadcast };
}

describe('StoresService — broadcast on create', () => {
  it('broadcasts when a visible (active) store is created', async () => {
    const { svc, broadcast } = build(StoreStatus.Active);
    await svc.create('adm1', {
      nameEn: 'Cafe', nameEl: 'Καφέ',
      descriptionEn: 'd', descriptionEl: 'π',
      status: StoreStatus.Active,
    });
    expect(broadcast.enqueue).toHaveBeenCalledWith('store', 'st1');
  });

  it('does NOT broadcast for a hidden store', async () => {
    const { svc, broadcast } = build(StoreStatus.Hidden);
    await svc.create('adm1', {
      nameEn: 'Cafe', nameEl: 'Καφέ',
      descriptionEn: 'd', descriptionEl: 'π',
      status: StoreStatus.Hidden,
    });
    expect(broadcast.enqueue).not.toHaveBeenCalled();
  });
});
