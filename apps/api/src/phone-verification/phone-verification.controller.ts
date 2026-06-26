import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PhoneVerificationService } from './phone-verification.service';
import { CurrentUser } from '../auth/decorators';
import { AuthPrincipal } from '../auth/auth.types';
import { VerifyOtpDto } from './dto';

@Controller('student/phone')
export class PhoneVerificationController {
  constructor(private readonly phone: PhoneVerificationService) {}

  // Tight rate limit — OTP sends cost money and can be abused.
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @HttpCode(HttpStatus.OK)
  @Post('send-otp')
  sendOtp(@CurrentUser() user: AuthPrincipal) {
    this.assertStudent(user);
    return this.phone.sendOtp(user.id);
  }

  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @HttpCode(HttpStatus.OK)
  @Post('verify-otp')
  verifyOtp(@CurrentUser() user: AuthPrincipal, @Body() dto: VerifyOtpDto) {
    this.assertStudent(user);
    return this.phone.verifyOtp(user.id, dto.code);
  }

  private assertStudent(user: AuthPrincipal): void {
    if (user.type !== 'student') {
      throw new UnauthorizedException('Student token required');
    }
  }
}
