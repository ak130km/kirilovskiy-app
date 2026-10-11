import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  FULFILLMENT_TYPES,
  ORDER_STATUSES,
  PAYMENT_METHODS,
  type FulfillmentType,
  type OrderStatus,
  type PaymentMethod,
} from '@kirilovskiy/shared';
import { CartItemDto } from '../pricing/pricing.dto';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const trimOrUndef = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || undefined : value;

export class CreateOrderDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Корзина пуста' })
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CartItemDto)
  items: CartItemDto[];

  @IsIn(FULFILLMENT_TYPES, { message: 'Выберите доставку или самовывоз' })
  fulfillmentType: FulfillmentType;

  @IsOptional() @IsUUID('all', { message: 'Выберите зону доставки' }) deliveryZoneId?: string;
  @IsOptional() @Transform(trimOrUndef) @IsString() @MaxLength(300) address?: string;
  @IsOptional() @Transform(trimOrUndef) @IsString() @MaxLength(20) apartment?: string;
  @IsOptional() @Transform(trimOrUndef) @IsString() @MaxLength(20) entrance?: string;
  @IsOptional() @Transform(trimOrUndef) @IsString() @MaxLength(20) floor?: string;
  @IsOptional() @Transform(trimOrUndef) @IsString() @MaxLength(50) intercom?: string;
  @IsOptional() @IsLatitude() latitude?: number;
  @IsOptional() @IsLongitude() longitude?: number;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Выберите дату' }) deliveryDate: string;
  @IsUUID('all', { message: 'Выберите время' }) timeSlotId: string;

  @Transform(trim)
  @IsString()
  @MinLength(2, { message: 'Укажите имя' })
  @MaxLength(100)
  customerName: string;

  @IsString() @IsNotEmpty({ message: 'Укажите телефон' }) customerPhone: string;

  @IsOptional() @Transform(trimOrUndef) @IsString() @MaxLength(1000, { message: 'Комментарий — до 1000 символов' })
  comment?: string;

  @IsIn(PAYMENT_METHODS, { message: 'Выберите способ оплаты' }) paymentMethod: PaymentMethod;
  @IsOptional() @Transform(trimOrUndef) @IsString() @MaxLength(32) promoCode?: string;
  @IsOptional() @IsUUID() deviceId?: string;
}

export class GuestOrderRefDto {
  @IsUUID() id: string;
  @IsString() @MaxLength(100) accessToken: string;
}

export class GuestOrdersDto {
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => GuestOrderRefDto)
  orders: GuestOrderRefDto[];
}

export class ChangeStatusDto {
  @IsIn(ORDER_STATUSES) status: OrderStatus;
  @IsOptional() @Transform(trimOrUndef) @IsString() @MaxLength(500) comment?: string;
}

export class CancelOrderDto {
  @Transform(trim) @IsString() @MinLength(3, { message: 'Укажите причину отмены' }) @MaxLength(500)
  reason: string;
}

export const ADMIN_ORDER_TABS = ['new', 'active', 'ready', 'completed', 'cancelled', 'all'] as const;
export type AdminOrderTab = (typeof ADMIN_ORDER_TABS)[number];

export class AdminOrdersQueryDto {
  @IsOptional() @IsIn(ADMIN_ORDER_TABS) tab?: AdminOrderTab;
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) date?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) pageSize?: number;
}
