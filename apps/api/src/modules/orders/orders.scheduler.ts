import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { OrdersService } from './orders.service';

@Injectable()
export class OrdersScheduler {
  private readonly logger = new Logger(OrdersScheduler.name);
  private running = false;

  constructor(
    private readonly orders: OrdersService,
    private readonly prisma: PrismaService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      await this.orders.cancelExpiredUnpaid();
      // Товары, у которых истёк срок стоп-листа, возвращаются в продажу
      const restored = await this.prisma.product.updateMany({
        where: { inStopList: true, stopListUntil: { lte: new Date() } },
        data: { inStopList: false, stopListReason: null, stopListUntil: null },
      });
      if (restored.count) this.logger.log(`Из стоп-листа автоматически возвращено товаров: ${restored.count}`);
    } catch (e) {
      this.logger.error(`Ошибка фоновой задачи: ${e}`);
    } finally {
      this.running = false;
    }
  }
}
