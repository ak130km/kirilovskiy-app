import {
  All,
  Body,
  Controller,
  Get,
  Header,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiExcludeEndpoint, ApiHeader, ApiTags } from '@nestjs/swagger';
import { PAYMENT_METHODS, type PaymentMethod } from '@kirilovskiy/shared';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import type { Response } from 'express';
import type { AuthCustomer } from '../../common/auth/auth.types';
import { CurrentCustomer } from '../../common/auth/decorators';
import { OptionalCustomerAuthGuard } from '../../common/auth/guards';
import { assertOrderAccess } from '../../common/order-access';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentsService } from './payments.service';
import { renderTestPaymentPage } from './test-payment-page';

class StartPaymentDto {
  @IsOptional() @IsIn(PAYMENT_METHODS) method?: PaymentMethod;
  /** Куда вернуть клиента после оплаты (deep link приложения) */
  @IsOptional() @IsString() @MaxLength(500) returnUrl?: string;
}

class TestPaymentResultDto {
  @IsIn(['success', 'fail']) result: 'success' | 'fail';
}

@ApiTags('Оплата')
@Controller()
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly prisma: PrismaService,
  ) {}

  /** Начать оплату заказа: возвращает ссылку на платёжную страницу или СБП */
  @Post('orders/:id/pay')
  @HttpCode(200)
  @UseGuards(OptionalCustomerAuthGuard)
  @ApiHeader({ name: 'X-Order-Token', required: false, description: 'Токен гостевого заказа' })
  async pay(
    @Param('id') id: string,
    @Body() dto: StartPaymentDto,
    @CurrentCustomer() customer?: AuthCustomer,
    @Headers('x-order-token') token?: string,
  ) {
    await assertOrderAccess(this.prisma, id, customer, token);
    return this.payments.start(id, dto);
  }

  /** Перепроверить статус оплаты у банка */
  @Post('orders/:id/payment/sync')
  @HttpCode(204)
  @UseGuards(OptionalCustomerAuthGuard)
  async sync(
    @Param('id') id: string,
    @CurrentCustomer() customer?: AuthCustomer,
    @Headers('x-order-token') token?: string,
  ) {
    await assertOrderAccess(this.prisma, id, customer, token);
    await this.payments.sync(id);
  }

  /** Уведомления платёжного провайдера (Альфа-Банк присылает GET-callback) */
  @All('payments/webhook/:provider')
  @HttpCode(200)
  async webhook(
    @Param('provider') provider: string,
    @Query() query: Record<string, string>,
    @Body() body: unknown,
  ) {
    await this.payments.handleWebhook(provider, { query, body });
    return { ok: true };
  }

  @Get('payments/test/:paymentId')
  @ApiExcludeEndpoint()
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  async testPage(@Param('paymentId', ParseUUIDPipe) paymentId: string) {
    const payment = await this.payments.getTestPaymentPage(paymentId);
    return renderTestPaymentPage(payment);
  }

  @Post('payments/test/:paymentId/complete')
  @ApiExcludeEndpoint()
  async testComplete(
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
    @Body() dto: TestPaymentResultDto,
    @Res() res: Response,
  ) {
    const redirectUrl = await this.payments.completeTestPayment(paymentId, dto.result === 'success');
    res.redirect(302, redirectUrl);
  }
}
