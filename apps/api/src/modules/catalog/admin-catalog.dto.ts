import { PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const emptyToNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;

export class CreateCategoryDto {
  @Transform(trim) @IsString() @MinLength(2, { message: 'Название — минимум 2 символа' }) @MaxLength(100)
  name: string;

  @IsOptional() @Transform(trim) @Matches(/^[a-z0-9-]+$/, { message: 'Slug: латиница, цифры и дефис' })
  slug?: string;

  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(500) description?: string | null;
  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(500) imageUrl?: string | null;
  @IsOptional() @IsInt() sortOrder?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}

export class CreateProductDto {
  @IsUUID('all', { message: 'Выберите категорию' }) categoryId: string;

  @Transform(trim) @IsString() @MinLength(2, { message: 'Название — минимум 2 символа' }) @MaxLength(150)
  name: string;

  @IsOptional() @Transform(trim) @Matches(/^[a-z0-9-]+$/, { message: 'Slug: латиница, цифры и дефис' })
  slug?: string;

  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(3000) description?: string | null;
  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(3000) composition?: string | null;

  /** Цена, коп. */
  @IsInt({ message: 'Цена должна быть целым числом копеек' }) @Min(0) price: number;
  @IsOptional() @IsInt() @Min(0) oldPrice?: number | null;
  @IsInt({ message: 'Укажите вес в граммах' }) @Min(1) weightGrams: number;

  @IsOptional() @IsInt() @Min(0) caloriesKcal?: number | null;
  @IsOptional() @IsNumber() @Min(0) proteins?: number | null;
  @IsOptional() @IsNumber() @Min(0) fats?: number | null;
  @IsOptional() @IsNumber() @Min(0) carbohydrates?: number | null;
  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(300) storageConditions?: string | null;
  @IsOptional() @IsInt() @Min(0) leadTimeHours?: number;

  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsBoolean() isFeatured?: boolean;
  @IsOptional() @IsInt() sortOrder?: number;
  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(100) externalId?: string | null;

  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsUUID('all', { each: true }) allergenIds?: string[];
}

export class UpdateProductDto extends PartialType(CreateProductDto) {}

export class StopListDto {
  @IsBoolean() inStopList: boolean;
  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(200) reason?: string | null;
  /** Вернуть в продажу автоматически (ISO-дата) */
  @IsOptional() @IsDateString() until?: string | null;
}

export class ReorderImagesDto {
  @IsArray() @IsUUID('all', { each: true }) imageIds: string[];
}

export class AdminProductsQueryDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @Transform(({ value }) => value === 'true' || value === true) @IsBoolean() stopList?: boolean;
  @IsOptional() @Transform(({ value }) => value === 'true' || value === true) @IsBoolean() includeArchived?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() limit?: number;
}
