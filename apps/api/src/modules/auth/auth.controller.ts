import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthStaff } from '../../common/auth/auth.types';
import { ClientIp, CurrentStaff } from '../../common/auth/decorators';
import { StaffAuthGuard } from '../../common/auth/guards';
import { OtpRequestDto, OtpVerifyDto, StaffLoginDto } from './auth.dto';
import { AuthService } from './auth.service';

@ApiTags('Вход клиента')
@Controller('auth')
export class CustomerAuthController {
  constructor(private readonly auth: AuthService) {}

  /** Отправить SMS-код на номер */
  @Post('otp/request')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  request(@Body() dto: OtpRequestDto) {
    return this.auth.requestOtp(dto.phone);
  }

  /** Проверить код и получить токен. Аккаунт создаётся автоматически при первом входе. */
  @Post('otp/verify')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  verify(@Body() dto: OtpVerifyDto) {
    return this.auth.verifyOtp(dto.phone, dto.code);
  }
}

@ApiTags('Админка: вход')
@Controller('admin/auth')
export class StaffAuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  login(@Body() dto: StaffLoginDto, @ClientIp() ip: string) {
    return this.auth.staffLogin(dto.email, dto.password, ip);
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(StaffAuthGuard)
  me(@CurrentStaff() staff: AuthStaff) {
    return this.auth.staffMe(staff.id);
  }
}
