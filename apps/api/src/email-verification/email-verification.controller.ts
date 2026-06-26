import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { EmailVerificationService } from './email-verification.service';
import { CurrentUser, Public } from '../auth/decorators';
import { AuthPrincipal } from '../auth/auth.types';
import { VerifyEmailDto } from './dto';

@Controller('student/email')
export class EmailVerificationController {
  constructor(private readonly email: EmailVerificationService) {}

  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @HttpCode(HttpStatus.OK)
  @Post('send-verification')
  send(@CurrentUser() user: AuthPrincipal) {
    if (user.type !== 'student') {
      throw new UnauthorizedException('Student token required');
    }
    return this.email.sendVerification(user.id);
  }

  // Public — the link is clicked from the email; the token is the credential.
  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @HttpCode(HttpStatus.OK)
  @Post('verify')
  verify(@Body() dto: VerifyEmailDto) {
    return this.email.verify(dto.token);
  }
}
