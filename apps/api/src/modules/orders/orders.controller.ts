import { Body, Controller, Get, Headers, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import type { AuthCustomer } from '../../common/auth/auth.types';
import { CurrentCustomer } from '../../common/auth/decorators';
import { OptionalCustomerAuthGuard } from '../../common/auth/guards';
import { assertOrderAccess } from '../../common/order-access';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOrderDto, GuestOrdersDto } from './orders.dto';
import { OrdersService } from './orders.service';

@ApiTags('Заказы')
@UseGuards(OptionalCustomerAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly prisma: PrismaService,
  ) {}

  /** Оформление заказа. Регистрация не нужна: гость получает accessToken для просмотра статуса. */
  @Post()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  create(@Body() dto: CreateOrderDto, @CurrentCustomer() customer?: AuthCustomer) {
    return this.orders.create(dto, customer);
  }

  /** Гостевые заказы этого устройства (по сохранённым токенам) */
  @Post('lookup')
  @HttpCode(200)
  lookup(@Body() dto: GuestOrdersDto) {
    return this.orders.findByTokens(dto.orders);
  }

  @Get(':id')
  @ApiHeader({ name: 'X-Order-Token', required: false, description: 'Токен гостевого заказа' })
  async get(
    @Param('id') id: string,
    @CurrentCustomer() customer?: AuthCustomer,
    @Headers('x-order-token') token?: string,
  ) {
    await assertOrderAccess(this.prisma, id, customer, token);
    return this.orders.getForClient(id);
  }

  /** Позиции для «Повторить заказ» с актуальными ценами */
  @Get(':id/reorder')
  async reorder(
    @Param('id') id: string,
    @CurrentCustomer() customer?: AuthCustomer,
    @Headers('x-order-token') token?: string,
  ) {
    await assertOrderAccess(this.prisma, id, customer, token);
    return this.orders.reorder(id);
  }
}
