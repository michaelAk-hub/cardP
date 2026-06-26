import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AccountStatus, OfferStatus, StoreStatus } from '@blue-card/shared';
import { PrismaService } from '../prisma/prisma.service';

export interface AnalyticsSummary {
  students: { total: number; active: number; pending: number; deactive: number };
  offers: { total: number; active: number };
  stores: { total: number; active: number };
}

// Dashboard metrics (spec §11). Computed from students/offers/stores; no
// redemption metrics in v1.
@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(): Promise<AnalyticsSummary> {
    const [
      studentsTotal,
      active,
      pending,
      deactive,
      offersTotal,
      offersActive,
      storesTotal,
      storesActive,
    ] = await this.prisma.$transaction([
      this.prisma.student.count(),
      this.prisma.student.count({ where: { accountStatus: AccountStatus.Active } }),
      this.prisma.student.count({ where: { accountStatus: AccountStatus.Pending } }),
      this.prisma.student.count({ where: { accountStatus: AccountStatus.Deactive } }),
      this.prisma.offer.count(),
      this.prisma.offer.count({ where: { status: OfferStatus.Active } }),
      this.prisma.store.count(),
      this.prisma.store.count({ where: { status: StoreStatus.Active } }),
    ]);

    return {
      students: { total: studentsTotal, active, pending, deactive },
      offers: { total: offersTotal, active: offersActive },
      stores: { total: storesTotal, active: storesActive },
    };
  }

  // Signups per day over the last `days` days.
  async signups(days = 30): Promise<Array<{ day: string; count: number }>> {
    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);

    const rows = await this.prisma.$queryRaw<Array<{ day: Date; count: bigint }>>(
      Prisma.sql`
        SELECT date_trunc('day', "created_at")::date AS day, count(*) AS count
        FROM "students"
        WHERE "created_at" >= ${since}
        GROUP BY day
        ORDER BY day
      `,
    );
    return rows.map((r) => ({
      day: r.day.toISOString().slice(0, 10),
      count: Number(r.count),
    }));
  }
}
