import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { AccountStatus, ReviewDecision } from '@blue-card/shared';

export class ListStudentsQueryDto {
  @IsOptional()
  @IsIn([AccountStatus.Pending, AccountStatus.Active, AccountStatus.Deactive])
  status?: AccountStatus;

  @IsOptional()
  @IsUUID()
  universityId?: string;

  // Matches email or phone (contains, case-insensitive).
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 25;
}

export class IdReviewDto {
  @IsIn([ReviewDecision.Approved, ReviewDecision.Rejected])
  decision!: ReviewDecision;

  // reason + description are REQUIRED on reject (spec §6.4).
  @ValidateIf((o: IdReviewDto) => o.decision === ReviewDecision.Rejected)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  reason?: string;

  @ValidateIf((o: IdReviewDto) => o.decision === ReviewDecision.Rejected)
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  description?: string;
}

export class DeactivateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;
}
