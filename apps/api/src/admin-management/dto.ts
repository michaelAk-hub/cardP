import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AdminRole } from '@blue-card/shared';

export class CreateAdminDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(12) // admins are privileged — require a longer password
  @MaxLength(128)
  password!: string;

  // Defaults to protoporia. Root may also create another root.
  @IsOptional()
  @IsIn([AdminRole.Root, AdminRole.Protoporia])
  role?: AdminRole;
}
