import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { OfferStatus, StoreStatus } from '@blue-card/shared';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService, StoredObject } from '../storage/storage.service';
import { AuditService } from '../audit/audit.service';
import { BroadcastQueue } from '../notifications/broadcast-queue';
import { CreateStoreDto, ListStoresQueryDto, UpdateStoreDto } from './dto';

const LOGO_TYPES = new Map<string, string>([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['image/svg+xml', 'svg'],
]);

@Injectable()
export class StoresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly broadcast: BroadcastQueue,
  ) {}

  async create(adminId: string, dto: CreateStoreDto) {
    const store = await this.prisma.store.create({
      data: { ...dto, createdById: adminId },
    });
    await this.audit.record(adminId, 'store.create', { storeId: store.id });
    // Broadcast only for visible stores (spec §6.8) — promotional, consent-filtered.
    if (store.status === StoreStatus.Active) {
      await this.broadcast.enqueue('store', store.id);
    }
    return store;
  }

  async adminList(query: ListStoresQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const where: Prisma.StoreWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.search) {
      where.OR = [
        { nameEn: { contains: query.search, mode: 'insensitive' } },
        { nameEl: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    const [data, total] = await this.prisma.$transaction([
      this.prisma.store.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.store.count({ where }),
    ]);
    return { data, total, page, pageSize };
  }

  async adminGet(id: string) {
    const store = await this.prisma.store.findUnique({
      where: { id },
      include: { offers: { orderBy: { createdAt: 'desc' } } },
    });
    if (!store) throw new NotFoundException('Store not found');
    return store;
  }

  async update(adminId: string, id: string, dto: UpdateStoreDto) {
    await this.requireStore(id);
    const store = await this.prisma.store.update({ where: { id }, data: dto });
    await this.audit.record(adminId, 'store.update', { storeId: id });
    return store;
  }

  async remove(adminId: string, id: string) {
    await this.requireStore(id);
    await this.prisma.store.delete({ where: { id } }); // cascades offers
    await this.audit.record(adminId, 'store.delete', { storeId: id });
    return { deleted: true };
  }

  async uploadLogo(adminId: string, id: string, file?: Express.Multer.File) {
    await this.requireStore(id);
    if (!file) throw new BadRequestException('Missing logo file');
    const ext = LOGO_TYPES.get(file.mimetype);
    if (!ext) throw new BadRequestException('Logo must be JPEG, PNG, WEBP or SVG');

    const existing = await this.prisma.store.findUnique({
      where: { id },
      select: { logoKey: true },
    });
    const key = this.storage.newKey(`store-logos/${id}`, ext);
    await this.storage.put(key, file.buffer, file.mimetype);
    await this.prisma.store.update({ where: { id }, data: { logoKey: key } });
    if (existing?.logoKey) {
      await this.storage.delete(existing.logoKey).catch(() => undefined);
    }
    await this.audit.record(adminId, 'store.logo_upload', { storeId: id });
    return { logoKey: key };
  }

  // Public store catalog: visible stores with their active offers.
  async publicList() {
    return this.prisma.store.findMany({
      where: { status: StoreStatus.Active },
      orderBy: { nameEn: 'asc' },
      include: {
        offers: {
          where: { status: OfferStatus.Active },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async publicGet(id: string) {
    const store = await this.prisma.store.findFirst({
      where: { id, status: StoreStatus.Active },
      include: {
        offers: { where: { status: OfferStatus.Active }, orderBy: { createdAt: 'desc' } },
      },
    });
    if (!store) throw new NotFoundException('Store not found');
    return store;
  }

  async readLogo(id: string): Promise<StoredObject> {
    const store = await this.prisma.store.findUnique({
      where: { id },
      select: { logoKey: true },
    });
    if (!store?.logoKey) throw new NotFoundException('No logo');
    return this.storage.read(store.logoKey);
  }

  private async requireStore(id: string) {
    const store = await this.prisma.store.findUnique({ where: { id } });
    if (!store) throw new NotFoundException('Store not found');
    return store;
  }
}
