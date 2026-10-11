import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2, { message: 'Имя — минимум 2 символа' })
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() || null : value))
  @ValidateIf((_, v) => v !== null)
  @IsEmail({}, { message: 'Некорректный email' })
  email?: string | null;
}

export class RegisterDeviceDto {
  @Matches(/^(ExponentPushToken|ExpoPushToken)\[.+\]$/, { message: 'Некорректный Expo push-токен' })
  expoPushToken: string;

  @IsIn(['IOS', 'ANDROID', 'WEB']) platform: 'IOS' | 'ANDROID' | 'WEB';
}

export class DeleteAccountDto {
  /** Подтверждение: пользователь вводит слово «УДАЛИТЬ» */
  @IsOptional() @IsString() confirm?: string;
}
