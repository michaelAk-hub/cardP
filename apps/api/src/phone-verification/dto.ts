import { IsString, Matches } from 'class-validator';

export class VerifyOtpDto {
  @Matches(/^\d{4,10}$/, { message: 'code must be 4–10 digits' })
  @IsString()
  code!: string;
}
