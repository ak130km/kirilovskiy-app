import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { CartQuoteDto } from '@kirilovskiy/shared';
import type { AuthCustomer } from '../../common/auth/auth.types';
import { CurrentCustomer } from '../../common/auth/decorators';
import { OptionalCustomerAuthGuard } from '../../common/auth/guards';
import { CartQuoteDtoIn } from './pricing.dto';
import { PricingService } from './pricing.service';

@ApiTags('Корзина')
@Controller('cart')
export class CartController {
  constructor(private readonly pricing: PricingService) {}

  /** Серверный расчёт корзины: актуальные цены, доступность, доставка, промокод, итог */
  @Post('quote')
  @HttpCode(200)
  @UseGuards(OptionalCustomerAuthGuard)
  async quote(@Body() dto: CartQuoteDtoIn, @CurrentCustomer() customer?: AuthCustomer): Promise<CartQuoteDto> {
    const { quote } = await this.pricing.quote({ ...dto, customerId: customer?.id });
    return quote;
  }
}
