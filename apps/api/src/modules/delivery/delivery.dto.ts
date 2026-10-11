import { PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { FULFILLMENT_TYPES, type FulfillmentType } from '@kirilovskiy/shared';

export class AvailabilityQueryDto {
  @IsIn(FULFILLMENT_TYPES) type: FulfillmentType;
  /** id товаров корзины через запятую — для учёта времени изготовления */
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',').filter(Boolean) : value))
  @IsArray()
  productIds?: string[];
}

export class CreateZoneDto {
  @IsString() @MinLength(2) @MaxLength(100) name: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string | null;
  @IsInt() @Min(0) price: number;
  @IsOptional() @IsInt() @Min(0) freeFromAmount?: number | null;
  @IsOptional() @IsInt() @Min(0) minOrderAmount?: number;
  @IsOptional() @IsInt() @Min(0) estimatedMinutes?: number | null;
  @IsOptional() @IsObject() polygon?: Record<string, unknown> | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsInt() sortOrder?: number;
}
export class UpdateZoneDto extends PartialType(CreateZoneDto) {}

export class CreateTimeSlotDto {
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsIn(FULFILLMENT_TYPES) fulfillmentType?: FulfillmentType | null;
  /** Начало, минут от полуночи (600 = 10:00) */
  @IsInt() @Min(0) @Max(24 * 60 - 1) startMinutes: number;
  @IsInt() @Min(1) @Max(24 * 60) endMinutes: number;
  @IsOptional() @IsArray() @ArrayMinSize(1, { message: 'Выберите хотя бы один день недели' }) @IsInt({ each: true }) @Min(1, { each: true }) @Max(7, { each: true })
  weekdays?: number[];
  @IsOptional() @IsInt() @Min(1) @Max(1000) capacity?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsInt() sortOrder?: number;
}
export class UpdateTimeSlotDto extends PartialType(CreateTimeSlotDto) {}

export class CreateBlackoutDateDto {
  @IsString() @Transform(({ value }) => String(value).slice(0, 10)) date: string;
  @IsOptional() @IsString() @MaxLength(200) reason?: string | null;
}
