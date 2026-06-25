import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AdminRole } from '@blue-card/shared';
import { PrismaService } from '../prisma/prisma.service';
import { HashingService } from '../auth/hashing.service';
import { TokenService } from '../auth/token.service';
import { AuditService } from '../audit/audit.service';
import { AdminView, toAdminView } from '../admin-auth/admin.view';
import { CreateAdminDto } from './dto';

// Root-only management of admin accounts (spec §6.10, §7 "Admins" page).
@Injectable()
export class AdminManagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hashing: HashingService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
  ) {}

  async create(actingRootId: string, dto: CreateAdminDto): Promise<AdminView> {
    const email = dto.email.toLowerCase().trim();
    const passwordHash = await this.hashing.hashPassword(dto.password);
    const role = dto.role ?? AdminRole.Protoporia;

    try {
      const admin = await this.prisma.adminUser.create({
        data: {
          email,
          passwordHash,
          role,
          createdById: actingRootId,
          // totpEnabled defaults false — the new admin enrols on first login.
        },
      });
      await this.audit.record(actingRootId, 'admin.create', {
        adminId: admin.id,
        email,
        role,
      });
      return toAdminView(admin);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('An admin with this email already exists');
      }
      throw err;
    }
  }

  async list(): Promise<AdminView[]> {
    const admins = await this.prisma.adminUser.findMany({
      orderBy: { createdAt: 'asc' },
    });
    return admins.map(toAdminView);
  }

  async disable(actingRootId: string, targetId: string): Promise<AdminView> {
    if (actingRootId === targetId) {
      throw new BadRequestException('You cannot disable your own account');
    }
    const target = await this.requireAdmin(targetId);

    const updated = await this.prisma.adminUser.update({
      where: { id: target.id },
      data: { disabledAt: new Date() },
    });
    // Disabled admins must lose any live sessions immediately.
    await this.tokens.revokeAll('admin', target.id);
    await this.audit.record(actingRootId, 'admin.disable', { adminId: target.id });
    return toAdminView(updated);
  }

  async enable(actingRootId: string, targetId: string): Promise<AdminView> {
    await this.requireAdmin(targetId);
    const updated = await this.prisma.adminUser.update({
      where: { id: targetId },
      data: { disabledAt: null },
    });
    await this.audit.record(actingRootId, 'admin.enable', { adminId: targetId });
    return toAdminView(updated);
  }

  private async requireAdmin(id: string) {
    const admin = await this.prisma.adminUser.findUnique({ where: { id } });
    if (!admin) {
      throw new NotFoundException('Admin not found');
    }
    return admin;
  }
}
