import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class UpdateStoreSettingsDto {
  @IsOptional() @IsString() @MaxLength(200) name?: string;
  @IsOptional() @IsString() @MaxLength(50) phone?: string;
  @IsOptional() @IsString() @MaxLength(300) pickupAddress?: string;
  @IsOptional() @IsString() @MaxLength(200) pickupHours?: string;
  /** Минимальная сумма заказа, коп. */
  @IsOptional() @IsInt() @Min(0) minOrderAmount?: number;
  /** Минимальное время на подготовку заказа, минут */
  @IsOptional() @IsInt() @Min(0) @Max(60 * 24 * 7) minLeadTimeMinutes?: number;
  /** На сколько дней вперёд можно выбрать дату */
  @IsOptional() @IsInt() @Min(1) @Max(60) orderHorizonDays?: number;
  /** Через сколько минут отменять неоплаченный заказ */
  @IsOptional() @IsInt() @Min(5) @Max(24 * 60) paymentTimeoutMinutes?: number;
  @IsOptional() @IsBoolean() acceptingOrders?: boolean;
  @IsOptional() @IsString() @MaxLength(300) acceptingOrdersMessage?: string;
  @IsOptional() @IsString() @MaxLength(300) privacyPolicyUrl?: string;
}
