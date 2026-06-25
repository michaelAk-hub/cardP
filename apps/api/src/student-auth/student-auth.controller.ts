import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { StudentAuthService } from './student-auth.service';
import { CurrentUser, Public } from '../auth/decorators';
import { AuthPrincipal } from '../auth/auth.types';
import {
  ForgotPasswordDto,
  LoginDto,
  RefreshDto,
  RegisterStudentDto,
  ResetPasswordDto,
} from './dto';

@Controller('auth/student')
export class StudentAuthController {
  constructor(private readonly auth: StudentAuthService) {}

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('register')
  register(@Body() dto: RegisterStudentDto) {
    return this.auth.register(dto);
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  async logout(@Body() dto: RefreshDto): Promise<void> {
    await this.auth.logout(dto.refreshToken);
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @HttpCode(HttpStatus.ACCEPTED)
  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<{ status: string }> {
    await this.auth.forgotPassword(dto);
    // Always 202 — never reveal whether the email is registered.
    return { status: 'accepted' };
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @HttpCode(HttpStatus.OK)
  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<{ status: string }> {
    await this.auth.resetPassword(dto);
    return { status: 'ok' };
  }

  @Get('me')
  me(@CurrentUser() user: AuthPrincipal) {
    if (user.type !== 'student') {
      throw new UnauthorizedException('Student token required');
    }
    return this.auth.me(user.id);
  }
}
