import { IsEmail, IsOptional, IsString, Matches, MinLength } from 'class-validator';

const TOTP_CODE = /^\d{6}$/;

export class AdminLoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;

  // Required once TOTP is enrolled; omitted on the very first (enrolment) login.
  @IsOptional()
  @Matches(TOTP_CODE, { message: 'totpCode must be 6 digits' })
  totpCode?: string;
}

export class TotpVerifyDto {
  @IsString()
  @MinLength(1)
  enrollmentToken!: string;

  @Matches(TOTP_CODE, { message: 'code must be 6 digits' })
  code!: string;
}

export class AdminRefreshDto {
  @IsString()
  @MinLength(1)
  refreshToken!: string;
}
