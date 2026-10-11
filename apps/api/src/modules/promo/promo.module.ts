import { Module } from '@nestjs/common';
import { AdminPromoController } from './admin-promo.controller';
import { PromoService } from './promo.service';

@Module({
  controllers: [AdminPromoController],
  providers: [PromoService],
  exports: [PromoService],
})
export class PromoModule {}
