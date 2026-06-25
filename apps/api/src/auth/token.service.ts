import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'node:crypto';
import { AdminRole } from '@blue-card/shared';
import { PrismaService } from '../prisma/prisma.service';
import { HashingService } from './hashing.service';
import { durationToMs } from './duration';
import { AuthPrincipal, JwtPayload, PrincipalKind, TokenPair } from './auth.types';

@Injectable()
export class TokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly hashing: HashingService,
  ) {}

  // Issue a fresh access JWT + a rotating opaque refresh token for a principal.
  async issueTokens(principal: AuthPrincipal): Promise<TokenPair> {
    const payload: JwtPayload = {
      sub: principal.id,
      typ: principal.type,
      role: principal.role,
    };
    const expiresIn = this.config.get<string>('JWT_ACCESS_TTL', '15m');
    const accessToken = await this.jwt.signAsync(payload, { expiresIn });

    const rawRefresh = randomBytes(48).toString('hex');
    const refreshTtl = this.config.get<string>('JWT_REFRESH_TTL', '30d');
    await this.prisma.refreshToken.create({
      data: {
        principalType: principal.type,
        principalId: principal.id,
        tokenHash: this.hashing.hashToken(rawRefresh),
        expiresAt: new Date(Date.now() + durationToMs(refreshTtl)),
      },
    });

    return {
      accessToken,
      refreshToken: rawRefresh,
      tokenType: 'Bearer',
      expiresIn,
    };
  }

  // Rotate: validate the presented refresh token, revoke it, issue a new pair.
  // Re-reads the principal so a disabled admin / changed role can't refresh.
  async rotate(rawRefresh: string): Promise<TokenPair> {
    const tokenHash = this.hashing.hashToken(rawRefresh);
    const row = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!row || row.revokedAt || row.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.prisma.refreshToken.update({
      where: { id: row.id },
      data: { revokedAt: new Date() },
    });

    const principal = await this.loadPrincipal(
      row.principalType as PrincipalKind,
      row.principalId,
    );
    return this.issueTokens(principal);
  }

  async revoke(rawRefresh: string): Promise<void> {
    const tokenHash = this.hashing.hashToken(rawRefresh);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  // Revoke every active refresh token for a principal (logout-all / disable /
  // password change).
  async revokeAll(type: PrincipalKind, principalId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { principalType: type, principalId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async loadPrincipal(
    type: PrincipalKind,
    id: string,
  ): Promise<AuthPrincipal> {
    if (type === 'student') {
      const student = await this.prisma.student.findUnique({ where: { id } });
      if (!student) {
        throw new UnauthorizedException('Account no longer exists');
      }
      return { id: student.id, type: 'student' };
    }

    const admin = await this.prisma.adminUser.findUnique({ where: { id } });
    if (!admin || admin.disabledAt) {
      throw new UnauthorizedException('Account no longer active');
    }
    return { id: admin.id, type: 'admin', role: admin.role as AdminRole };
  }
}
