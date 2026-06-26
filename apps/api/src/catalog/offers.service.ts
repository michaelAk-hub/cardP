import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DiscountType, OfferStatus } from '@blue-card/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BroadcastQueue } from '../notifications/broadcast-queue';
import { CreateOfferDto, UpdateOfferDto } from './dto';

@Injectable()
export class OffersService {
  private readonly logger = new Logger(OffersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly broadcast: BroadcastQueue,
  ) {}

  async create(adminId: string, storeId: string, dto: CreateOfferDto) {
    const store = await this.prisma.store.findUnique({ where: { id: storeId } });
    if (!store) throw new NotFoundException('Store not found');
    this.assertDiscount(dto.discountType, dto.discountValue);

    const offer = await this.prisma.offer.create({
      data: {
        storeId,
        titleEn: dto.titleEn,
        titleEl: dto.titleEl,
        descriptionEn: dto.descriptionEn,
        descriptionEl: dto.descriptionEl,
        discountType: dto.discountType,
        discountValue: new Prisma.Decimal(dto.discountValue),
        terms: dto.terms,
        expiryDate: new Date(dto.expiryDate),
        createdById: adminId,
      },
    });
    await this.audit.record(adminId, 'offer.create', { offerId: offer.id, storeId });
    await this.broadcast.enqueue('offer', offer.id);
    return offer;
  }

  async listForStore(storeId: string) {
    return this.prisma.offer.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(adminId: string, id: string, dto: UpdateOfferDto) {
    const offer = await this.prisma.offer.findUnique({ where: { id } });
    if (!offer) throw new NotFoundException('Offer not found');

    const discountType = dto.discountType ?? (offer.discountType as DiscountType);
    if (dto.discountValue !== undefined) {
      this.assertDiscount(discountType, dto.discountValue);
    }

    const data: Prisma.OfferUpdateInput = {
      titleEn: dto.titleEn,
      titleEl: dto.titleEl,
      descriptionEn: dto.descriptionEn,
      descriptionEl: dto.descriptionEl,
      discountType: dto.discountType,
      terms: dto.terms,
      status: dto.status,
    };
    if (dto.discountValue !== undefined) {
      data.discountValue = new Prisma.Decimal(dto.discountValue);
    }
    if (dto.expiryDate !== undefined) {
      data.expiryDate = new Date(dto.expiryDate);
    }

    const updated = await this.prisma.offer.update({ where: { id }, data });
    await this.audit.record(adminId, 'offer.update', { offerId: id });
    return updated;
  }

  async remove(adminId: string, id: string) {
    const offer = await this.prisma.offer.findUnique({ where: { id } });
    if (!offer) throw new NotFoundException('Offer not found');
    await this.prisma.offer.delete({ where: { id } });
    await this.audit.record(adminId, 'offer.delete', { offerId: id });
    return { deleted: true };
  }

  // Scheduled auto-expiry (spec §6.8): flip active offers past their expiry date.
  async expireOverdue(): Promise<{ expired: number }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const result = await this.prisma.offer.updateMany({
      where: { status: OfferStatus.Active, expiryDate: { lt: today } },
      data: { status: OfferStatus.Expired },
    });
    if (result.count > 0) {
      this.logger.log(`Auto-expired ${result.count} offer(s)`);
    }
    return { expired: result.count };
  }

  private assertDiscount(type: DiscountType, value: number): void {
    if (value <= 0) {
      throw new BadRequestException('discountValue must be positive');
    }
    if (type === DiscountType.Percent && value > 100) {
      throw new BadRequestException('percent discount cannot exceed 100');
    }
  }
}
