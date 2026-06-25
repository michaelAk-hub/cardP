import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { authenticator } from 'otplib';
import { AdminAuthService } from './admin-auth.service';
import { HashingService } from '../auth/hashing.service';
import { TokenService } from '../auth/token.service';
import { PrismaService } from '../prisma/prisma.service';

// Mock the TOTP + QR libraries so tests drive verify() deterministically.
jest.mock('otplib', () => ({
  authenticator: {
    verify: jest.fn(),
    generateSecret: jest.fn(() => 'GENERATED_SECRET'),
    keyuri: jest.fn(() => 'otpauth://totp/x'),
  },
}));
jest.mock('qrcode', () => ({
  toDataURL: jest.fn(async () => 'data:image/png;base64,AAA'),
}));

const mockVerify = authenticator.verify as jest.Mock;

const ADMIN = {
  id: 'adm_1',
  email: 'root@example.com',
  role: 'root',
  passwordHash: 'hash',
  totpSecret: 'SECRET' as string | null,
  totpEnabled: true,
  disabledAt: null as Date | null,
  createdById: null as string | null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function build(adminOverrides: Partial<typeof ADMIN> = {}) {
  const admin = { ...ADMIN, ...adminOverrides };
  const prisma = {
    adminUser: {
      findUnique: jest.fn(async () => admin),
      update: jest.fn(async ({ data }: any) => ({ ...admin, ...data })),
    },
  } as unknown as PrismaService;
  const hashing = {
    verifyPassword: jest.fn(async () => true),
  } as unknown as HashingService;
  const tokens = {
    issueTokens: jest.fn(async () => ({
      accessToken: 'a',
      refreshToken: 'r',
      tokenType: 'Bearer',
      expiresIn: '15m',
    })),
  } as unknown as TokenService;
  const jwt = {
    signAsync: jest.fn(async () => 'enroll.jwt'),
    verifyAsync: jest.fn(async () => ({ sub: admin.id, scope: 'totp_enroll' })),
  } as unknown as JwtService;
  const config = {
    get: jest.fn((_k: string, d?: string) => d ?? 'Blue Card'),
  } as unknown as ConfigService;

  return {
    svc: new AdminAuthService(prisma, hashing, tokens, jwt, config),
    hashing,
    tokens,
    prisma,
  };
}

describe('AdminAuthService — TOTP gate', () => {
  beforeEach(() => mockVerify.mockReset());

  it('rejects a wrong password before any TOTP step', async () => {
    const { svc, hashing } = build();
    (hashing.verifyPassword as jest.Mock).mockResolvedValueOnce(false);
    await expect(
      svc.login({ email: 'root@example.com', password: 'bad' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a disabled admin', async () => {
    const { svc } = build({ disabledAt: new Date() });
    await expect(
      svc.login({ email: 'root@example.com', password: 'ok' }),
    ).rejects.toThrow('Account disabled');
  });

  it('returns enrolment material (and NO tokens) when TOTP not yet enabled', async () => {
    const { svc, tokens } = build({ totpEnabled: false });
    const res = await svc.login({ email: 'root@example.com', password: 'ok' });
    expect(res.status).toBe('totp_enrollment_required');
    expect(tokens.issueTokens).not.toHaveBeenCalled();
  });

  it('requires a code once TOTP is enrolled', async () => {
    const { svc } = build();
    await expect(
      svc.login({ email: 'root@example.com', password: 'ok' }),
    ).rejects.toThrow('TOTP code required');
  });

  it('rejects an invalid TOTP code', async () => {
    const { svc, tokens } = build();
    mockVerify.mockReturnValue(false);
    await expect(
      svc.login({ email: 'root@example.com', password: 'ok', totpCode: '000000' }),
    ).rejects.toThrow(UnauthorizedException);
    expect(tokens.issueTokens).not.toHaveBeenCalled();
  });

  it('issues tokens with a valid password + TOTP code', async () => {
    const { svc, tokens } = build();
    mockVerify.mockReturnValue(true);
    const res = await svc.login({
      email: 'root@example.com',
      password: 'ok',
      totpCode: '123456',
    });
    expect(res.status).toBe('ok');
    expect(tokens.issueTokens).toHaveBeenCalledTimes(1);
  });

  it('verifyEnrollment flips totp_enabled and issues tokens', async () => {
    const { svc, prisma, tokens } = build({ totpEnabled: false });
    mockVerify.mockReturnValue(true);
    const res = await svc.verifyEnrollment({
      enrollmentToken: 'x',
      code: '123456',
    });
    expect(prisma.adminUser.update).toHaveBeenCalledWith({
      where: { id: 'adm_1' },
      data: { totpEnabled: true },
    });
    expect(tokens.issueTokens).toHaveBeenCalledTimes(1);
    expect(res.admin).toBeDefined();
  });
});
