import { Type } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { AccountStatus, CampaignChannel } from '@blue-card/shared';

export class AudienceFilterDto {
  @IsOptional()
  @IsIn([AccountStatus.Pending, AccountStatus.Active, AccountStatus.Deactive])
  status?: AccountStatus;

  @IsOptional()
  @IsUUID()
  universityId?: string;
}

export class CreateCampaignDto {
  @IsIn([CampaignChannel.Sms, CampaignChannel.Email])
  channel!: CampaignChannel;

  // Required for email; ignored for SMS.
  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AudienceFilterDto)
  audience?: AudienceFilterDto;
}

export class PreviewAudienceDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => AudienceFilterDto)
  audience?: AudienceFilterDto;
}
