import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AccountStatus } from '@blue-card/shared';
import { PrismaService } from '../prisma/prisma.service';
import { SmsVerifier } from '../sms/sms-verifier';
import { ActivationService } from '../activation/activation.service';

@Injectable()
export class PhoneVerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sms: SmsVerifier,
    private readonly activation: ActivationService,
  ) {}

  async sendOtp(studentId: string): Promise<{ status: 'sent' }> {
    const student = await this.requireStudent(studentId);
    if (student.phoneVerified) {
      throw new BadRequestException('Phone already verified');
    }
    await this.sms.startVerification(student.phone);
    return { status: 'sent' };
  }

  async verifyOtp(
    studentId: string,
    code: string,
  ): Promise<{ phoneVerified: true; accountStatus: AccountStatus }> {
    const student = await this.requireStudent(studentId);

    if (!student.phoneVerified) {
      const ok = await this.sms.checkVerification(student.phone, code);
      if (!ok) {
        throw new BadRequestException('Invalid or expired code');
      }
      await this.prisma.student.update({
        where: { id: student.id },
        data: { phoneVerified: true },
      });
    }

    // phone_verified changed -> re-run the activation rule.
    const accountStatus = await this.activation.reevaluate(student.id);
    return { phoneVerified: true, accountStatus };
  }

  private async requireStudent(id: string) {
    const student = await this.prisma.student.findUnique({
      where: { id },
      select: { id: true, phone: true, phoneVerified: true },
    });
    if (!student) {
      throw new NotFoundException('Student not found');
    }
    return student;
  }
}
