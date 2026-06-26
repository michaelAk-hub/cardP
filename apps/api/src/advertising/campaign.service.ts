import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CampaignChannel } from '@blue-card/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CampaignQueue } from './campaign-queue';
import { AudienceFilterDto, CreateCampaignDto } from './dto';

@Injectable()
export class CampaignService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly queue: CampaignQueue,
  ) {}

  // Audience selection (spec §6.9). The marketing-consent filter is NOT applied
  // here — non-consenters are recorded as skipped_optout at send time so the
  // per-recipient trail is complete.
  private audienceWhere(filter?: AudienceFilterDto): Prisma.StudentWhereInput {
    const where: Prisma.StudentWhereInput = {};
    if (filter?.status) where.accountStatus = filter.status;
    if (filter?.universityId) where.universityId = filter.universityId;
    return where;
  }

  async preview(filter?: AudienceFilterDto) {
    const where = this.audienceWhere(filter);
    const [matching, consenting] = await this.prisma.$transaction([
      this.prisma.student.count({ where }),
      this.prisma.student.count({ where: { ...where, marketingConsent: true } }),
    ]);
    return { matching, consenting, skippedOptout: matching - consenting };
  }

  async create(adminId: string, dto: CreateCampaignDto) {
    if (dto.channel === CampaignChannel.Email && !dto.subject?.trim()) {
      throw new BadRequestException('subject is required for email campaigns');
    }

    const where = this.audienceWhere(dto.audience);
    const audience = await this.prisma.student.findMany({
      where,
      select: { id: true },
    });
    if (audience.length === 0) {
      throw new BadRequestException('Audience is empty');
    }

    const campaign = await this.prisma.campaign.create({
      data: {
        adminId,
        channel: dto.channel,
        subject: dto.subject,
        body: dto.body,
        audienceFilter: (dto.audience ?? {}) as Prisma.InputJsonValue,
        recipients: {
          createMany: {
            data: audience.map((s) => ({ studentId: s.id })), // delivery_status defaults queued
          },
        },
      },
    });

    await this.audit.record(adminId, 'campaign.create', {
      campaignId: campaign.id,
      channel: dto.channel,
      audienceSize: audience.length,
    });
    await this.queue.enqueue(campaign.id);

    return { campaign, recipientCount: audience.length };
  }

  async list() {
    return this.prisma.campaign.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { recipients: true } } },
    });
  }

  async get(id: string) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id } });
    if (!campaign) throw new NotFoundException('Campaign not found');

    const grouped = await this.prisma.campaignRecipient.groupBy({
      by: ['deliveryStatus'],
      where: { campaignId: id },
      _count: { _all: true },
    });
    const stats: Record<string, number> = {};
    for (const g of grouped) {
      stats[g.deliveryStatus] = g._count._all;
    }
    return { ...campaign, stats };
  }
}
