import { Module } from '@nestjs/common';
import { PromoModule } from '../promo/promo.module';
import { CartController } from './cart.controller';
import { PricingService } from './pricing.service';

@Module({
  imports: [PromoModule],
  controllers: [CartController],
  providers: [PricingService],
  exports: [PricingService],
})
export class PricingModule {}
