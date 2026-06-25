import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { TokenService } from './token.service';
import { HashingService } from './hashing.service';
import { PrismaService } from '../prisma/prisma.service';

function build() {
  const rows = new Map<string, any>();
  const prisma = {
    refreshToken: {
      create: jest.fn(async ({ data }: any) => {
        const row = { id: `rt_${rows.size}`, revokedAt: null, ...data };
        rows.set(data.tokenHash, row);
        return row;
      }),
      findUnique: jest.fn(async ({ where }: any) => rows.get(where.tokenHash) ?? null),
      update: jest.fn(async ({ where, data }: any) => {
        for (const row of rows.values()) {
          if (row.id === where.id) Object.assign(row, data);
        }
      }),
      updateMany: jest.fn(),
    },
    student: { findUnique: jest.fn(async () => ({ id: 'stu_1' })) },
    adminUser: { findUnique: jest.fn() },
  } as unknown as PrismaService;

  const jwt = { signAsync: jest.fn(async () => 'access.jwt') } as unknown as JwtService;
  const config = {
    get: jest.fn((key: string, def?: string) =>
      key === 'JWT_ACCESS_TTL' ? '15m' : key === 'JWT_REFRESH_TTL' ? '30d' : def,
    ),
  } as unknown as ConfigService;
  const hashing = new HashingService();

  return { svc: new TokenService(prisma, jwt, config, hashing), prisma };
}

describe('TokenService rotation', () => {
  it('issues an access JWT and a stored refresh token', async () => {
    const { svc, prisma } = build();
    const pair = await svc.issueTokens({ id: 'stu_1', type: 'student' });
    expect(pair.accessToken).toBe('access.jwt');
    expect(pair.refreshToken).toHaveLength(96); // 48 random bytes -> hex
    expect(prisma.refreshToken.create).toHaveBeenCalledTimes(1);
  });

  it('rotates: revokes the presented token and issues a new pair', async () => {
    const { svc, prisma } = build();
    const first = await svc.issueTokens({ id: 'stu_1', type: 'student' });
    const second = await svc.rotate(first.refreshToken);

    expect(second.refreshToken).not.toBe(first.refreshToken);
    expect(prisma.refreshToken.update).toHaveBeenCalled(); // old one revoked
  });

  it('rejects a reused (already revoked) refresh token', async () => {
    const { svc } = build();
    const first = await svc.issueTokens({ id: 'stu_1', type: 'student' });
    await svc.rotate(first.refreshToken);
    await expect(svc.rotate(first.refreshToken)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects an unknown refresh token', async () => {
    const { svc } = build();
    await expect(svc.rotate('does-not-exist')).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
