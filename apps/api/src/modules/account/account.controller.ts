import { Body, Controller, Delete, Get, HttpCode, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthCustomer } from '../../common/auth/auth.types';
import { CurrentCustomer } from '../../common/auth/decorators';
import { CustomerAuthGuard, OptionalCustomerAuthGuard } from '../../common/auth/guards';
import { GuestOrdersDto } from '../orders/orders.dto';
import { RegisterDeviceDto, UpdateProfileDto } from './account.dto';
import { AccountService } from './account.service';

@ApiTags('Аккаунт клиента')
@ApiBearerAuth()
@UseGuards(CustomerAuthGuard)
@Controller('me')
export class AccountController {
  constructor(private readonly account: AccountService) {}

  @Get()
  me(@CurrentCustomer() customer: AuthCustomer) {
    return this.account.me(customer.id);
  }

  @Patch()
  update(@CurrentCustomer() customer: AuthCustomer, @Body() dto: UpdateProfileDto) {
    return this.account.update(customer.id, dto);
  }

  @Get('orders')
  orders(@CurrentCustomer() customer: AuthCustomer) {
    return this.account.orderHistory(customer.id);
  }

  /** Привязать гостевые заказы устройства к аккаунту */
  @Post('orders/claim')
  @HttpCode(200)
  claim(@CurrentCustomer() customer: AuthCustomer, @Body() dto: GuestOrdersDto) {
    return this.account.claimOrders(customer.id, dto.orders);
  }

  /** Удалить аккаунт и персональные данные */
  @Delete()
  @HttpCode(204)
  remove(@CurrentCustomer() customer: AuthCustomer) {
    return this.account.deleteAccount(customer.id);
  }
}

@ApiTags('Устройства')
@Controller('devices')
export class DevicesController {
  constructor(private readonly account: AccountService) {}

  /** Регистрация Expo push-токена (гость или клиент) */
  @Post()
  @HttpCode(200)
  @UseGuards(OptionalCustomerAuthGuard)
  register(@Body() dto: RegisterDeviceDto, @CurrentCustomer() customer?: AuthCustomer) {
    return this.account.registerDevice(dto, customer?.id ?? null);
  }
}
