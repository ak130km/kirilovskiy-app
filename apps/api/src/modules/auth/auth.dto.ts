import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class OtpRequestDto {
  @IsString() @IsNotEmpty({ message: 'Укажите телефон' }) phone: string;
}

export class OtpVerifyDto {
  @IsString() @IsNotEmpty({ message: 'Укажите телефон' }) phone: string;
  @Matches(/^\d{4}$/, { message: 'Код — 4 цифры' }) code: string;
}

export class StaffLoginDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'Укажите email' })
  email: string;

  @IsString() @MinLength(1, { message: 'Укажите пароль' }) @MaxLength(200) password: string;
}
