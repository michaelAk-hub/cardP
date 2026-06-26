import { AnalyticsService } from './analytics.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AnalyticsService', () => {
  it('summary maps the eight counts into the dashboard shape', async () => {
    // Service builds the array from count() calls, then awaits $transaction.
    const prisma = {
      student: {
        count: jest
          .fn()
          .mockResolvedValueOnce(100) // total
          .mockResolvedValueOnce(60) // active
          .mockResolvedValueOnce(30) // pending
          .mockResolvedValueOnce(10), // deactive
      },
      offer: {
        count: jest.fn().mockResolvedValueOnce(25).mockResolvedValueOnce(20),
      },
      store: {
        count: jest.fn().mockResolvedValueOnce(8).mockResolvedValueOnce(7),
      },
      $transaction: jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
    } as unknown as PrismaService;
    const svc = new AnalyticsService(prisma);

    expect(await svc.summary()).toEqual({
      students: { total: 100, active: 60, pending: 30, deactive: 10 },
      offers: { total: 25, active: 20 },
      stores: { total: 8, active: 7 },
    });
  });

  it('signups returns a day/count series with numeric counts', async () => {
    const prisma = {
      $queryRaw: jest.fn(async () => [
        { day: new Date('2026-06-01T00:00:00Z'), count: 3n },
        { day: new Date('2026-06-02T00:00:00Z'), count: 5n },
      ]),
    } as unknown as PrismaService;
    const svc = new AnalyticsService(prisma);

    expect(await svc.signups(7)).toEqual([
      { day: '2026-06-01', count: 3 },
      { day: '2026-06-02', count: 5 },
    ]);
  });
});
