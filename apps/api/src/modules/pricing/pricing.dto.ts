import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { FULFILLMENT_TYPES, type FulfillmentType } from '@kirilovskiy/shared';

export class CartItemDto {
  @IsUUID('all', { message: 'Некорректный товар' }) productId: string;
  @IsInt() @Min(1, { message: 'Количество — от 1' }) @Max(50, { message: 'Не больше 50 штук одного товара' })
  quantity: number;
}

export class CartQuoteDtoIn {
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CartItemDto)
  items: CartItemDto[];

  @IsOptional() @IsIn(FULFILLMENT_TYPES) fulfillmentType?: FulfillmentType;
  @IsOptional() @IsUUID() deliveryZoneId?: string;
  @IsOptional() @IsString() @MaxLength(32) promoCode?: string;
}

export class CartItemsDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Корзина пуста' })
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CartItemDto)
  items: CartItemDto[];
}
