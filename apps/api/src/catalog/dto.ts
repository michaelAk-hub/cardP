import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
  Max,
  MinLength,
} from 'class-validator';
import {
  DiscountType,
  OfferStatus,
  StoreStatus,
} from '@blue-card/shared';

export class CreateStoreDto {
  @IsString() @MinLength(1) @MaxLength(120) nameEn!: string;
  @IsString() @MinLength(1) @MaxLength(120) nameEl!: string;
  @IsString() @MinLength(1) @MaxLength(2000) descriptionEn!: string;
  @IsString() @MinLength(1) @MaxLength(2000) descriptionEl!: string;

  @IsOptional()
  @IsIn([StoreStatus.Active, StoreStatus.Hidden])
  status?: StoreStatus;
}

export class UpdateStoreDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120) nameEn?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120) nameEl?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(2000) descriptionEn?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(2000) descriptionEl?: string;
  @IsOptional() @IsIn([StoreStatus.Active, StoreStatus.Hidden]) status?: StoreStatus;
}

export class ListStoresQueryDto {
  @IsOptional() @IsIn([StoreStatus.Active, StoreStatus.Hidden]) status?: StoreStatus;
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number = 25;
}

export class CreateOfferDto {
  @IsString() @MinLength(1) @MaxLength(160) titleEn!: string;
  @IsString() @MinLength(1) @MaxLength(160) titleEl!: string;
  @IsString() @MinLength(1) @MaxLength(2000) descriptionEn!: string;
  @IsString() @MinLength(1) @MaxLength(2000) descriptionEl!: string;

  @IsIn([DiscountType.Percent, DiscountType.Fixed])
  discountType!: DiscountType;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  discountValue!: number;

  @IsOptional() @IsString() @MaxLength(2000) terms?: string;

  // ISO date (YYYY-MM-DD).
  @IsDateString()
  expiryDate!: string;
}

export class UpdateOfferDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(160) titleEn?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(160) titleEl?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(2000) descriptionEn?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(2000) descriptionEl?: string;
  @IsOptional() @IsIn([DiscountType.Percent, DiscountType.Fixed]) discountType?: DiscountType;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @IsPositive() discountValue?: number;
  @IsOptional() @IsString() @MaxLength(2000) terms?: string;
  @IsOptional() @IsDateString() expiryDate?: string;
  @IsOptional() @IsIn([OfferStatus.Active, OfferStatus.Expired]) status?: OfferStatus;
}
