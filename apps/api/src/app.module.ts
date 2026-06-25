import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { envValidationSchema } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { MailModule } from './mail/mail.module';
import { AuditModule } from './audit/audit.module';
import { StudentAuthModule } from './student-auth/student-auth.module';
import { AdminAuthModule } from './admin-auth/admin-auth.module';
import { AdminManagementModule } from './admin-management/admin-management.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
    }),
    // Global rate limiting (spec §8) — default ceiling; auth endpoints tighten
    // it further with @Throttle.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    AuthModule,
    MailModule,
    AuditModule,
    HealthModule,
    StudentAuthModule,
    AdminAuthModule,
    AdminManagementModule,
    // Later milestones: registration/verification, admin core, stores/offers,
    // wallet, advertising — see CLAUDE.md build order.
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
