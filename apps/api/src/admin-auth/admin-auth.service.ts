import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import { AdminUser } from '@prisma/client';
import { AdminRole } from '@blue-card/shared';
import { PrismaService } from '../prisma/prisma.service';
import { HashingService } from '../auth/hashing.service';
import { TokenService } from '../auth/token.service';
import { TokenPair } from '../auth/auth.types';
import { AdminLoginDto, TotpVerifyDto } from './dto';
import { AdminView, toAdminView } from './admin.view';

const ENROLLMENT_SCOPE = 'totp_enroll';
const ENROLLMENT_TTL = '10m';

interface EnrollmentPayload {
  sub: string;
  scope: typeof ENROLLMENT_SCOPE;
}

// Discriminated result of an admin login attempt.
export type AdminLoginResult =
  | { status: 'ok'; admin: AdminView; tokens: TokenPair }
  | {
      status: 'totp_enrollment_required';
      enrollmentToken: string;
      otpauthUrl: string;
      qrDataUrl: string;
    };

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hashing: HashingService,
    private readonly tokens: TokenService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: AdminLoginDto): Promise<AdminLoginResult> {
    const email = dto.email.toLowerCase().trim();
    const admin = await this.prisma.adminUser.findUnique({ where: { email } });

    const passwordOk =
      admin &&
      (await this.hashing.verifyPassword(admin.passwordHash, dto.password));
    if (!admin || !passwordOk) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (admin.disabledAt) {
      throw new UnauthorizedException('Account disabled');
    }

    // First login: TOTP not yet enrolled -> hand back enrolment material.
    // The account CANNOT obtain access tokens until TOTP is verified.
    if (!admin.totpEnabled) {
      return this.beginEnrollment(admin);
    }

    // TOTP enrolled: a valid code is mandatory.
    if (!dto.totpCode) {
      throw new UnauthorizedException('TOTP code required');
    }
    const codeOk =
      admin.totpSecret &&
      authenticator.verify({ token: dto.totpCode, secret: admin.totpSecret });
    if (!codeOk) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.issueAdminTokens(admin);
    return { status: 'ok', admin: toAdminView(admin), tokens };
  }

  // Complete first-time enrolment: verify the first code, flip totp_enabled.
  async verifyEnrollment(
    dto: TotpVerifyDto,
  ): Promise<{ admin: AdminView; tokens: TokenPair }> {
    let payload: EnrollmentPayload;
    try {
      payload = await this.jwt.verifyAsync<EnrollmentPayload>(dto.enrollmentToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired enrolment token');
    }
    if (payload.scope !== ENROLLMENT_SCOPE) {
      throw new UnauthorizedException('Invalid enrolment token');
    }

    const admin = await this.prisma.adminUser.findUnique({
      where: { id: payload.sub },
    });
    if (!admin || admin.disabledAt || !admin.totpSecret) {
      throw new UnauthorizedException('Enrolment not available');
    }
    if (!authenticator.verify({ token: dto.code, secret: admin.totpSecret })) {
      throw new UnauthorizedException('Invalid TOTP code');
    }

    const updated = await this.prisma.adminUser.update({
      where: { id: admin.id },
      data: { totpEnabled: true },
    });
    const tokens = await this.issueAdminTokens(updated);
    return { admin: toAdminView(updated), tokens };
  }

  refresh(refreshToken: string): Promise<TokenPair> {
    return this.tokens.rotate(refreshToken);
  }

  async logout(refreshToken: string): Promise<void> {
    await this.tokens.revoke(refreshToken);
  }

  async me(adminId: string): Promise<AdminView> {
    const admin = await this.prisma.adminUser.findUnique({
      where: { id: adminId },
    });
    if (!admin) {
      throw new NotFoundException('Admin not found');
    }
    return toAdminView(admin);
  }

  private async beginEnrollment(admin: AdminUser): Promise<AdminLoginResult> {
    // (Re)generate a secret on each enrolment attempt until it's confirmed.
    const secret = authenticator.generateSecret();
    await this.prisma.adminUser.update({
      where: { id: admin.id },
      data: { totpSecret: secret },
    });

    const issuer = this.config.get<string>('TOTP_ISSUER', 'Blue Card');
    const otpauthUrl = authenticator.keyuri(admin.email, issuer, secret);
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl);
    const enrollmentToken = await this.jwt.signAsync(
      { sub: admin.id, scope: ENROLLMENT_SCOPE },
      { expiresIn: ENROLLMENT_TTL },
    );

    return {
      status: 'totp_enrollment_required',
      enrollmentToken,
      otpauthUrl,
      qrDataUrl,
    };
  }

  private issueAdminTokens(admin: AdminUser): Promise<TokenPair> {
    return this.tokens.issueTokens({
      id: admin.id,
      type: 'admin',
      role: admin.role as AdminRole,
    });
  }
}
