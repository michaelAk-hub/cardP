import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
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
import { StorageModule } from './storage/storage.module';
import { SmsModule } from './sms/sms.module';
import { ActivationModule } from './activation/activation.module';
import { IdDocumentModule } from './id-document/id-document.module';
import { PhoneVerificationModule } from './phone-verification/phone-verification.module';
import { EmailVerificationModule } from './email-verification/email-verification.module';
import { AdminStudentsModule } from './admin-students/admin-students.module';
import { TamperModule } from './tamper/tamper.module';
import { NotificationsModule } from './notifications/notifications.module';
import { CatalogModule } from './catalog/catalog.module';
import { AdvertisingModule } from './advertising/advertising.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
    }),
    // Global rate limiting (spec §8) — default ceiling; auth endpoints tighten
    // it further with @Throttle.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    MailModule,
    AuditModule,
    StorageModule,
    SmsModule,
    ActivationModule,
    TamperModule,
    NotificationsModule,
    HealthModule,
    StudentAuthModule,
    AdminAuthModule,
    AdminManagementModule,
    IdDocumentModule,
    PhoneVerificationModule,
    EmailVerificationModule,
    AdminStudentsModule,
    CatalogModule,
    AdvertisingModule,
    // Later milestones: wallet, mobile UI, analytics/hardening —
    // see CLAUDE.md build order.
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
