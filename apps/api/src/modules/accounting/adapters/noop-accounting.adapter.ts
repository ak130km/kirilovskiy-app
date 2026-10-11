import { Logger } from '@nestjs/common';
import type { AccountingAdapter, AccountingOrder } from './accounting-adapter';

export class NoopAccountingAdapter implements AccountingAdapter {
  readonly provider = 'noop';
  private readonly logger = new Logger('Accounting');

  async exportOrder(order: AccountingOrder) {
    this.logger.log(`[1С отключена] Заказ №${order.number} был бы выгружен в 1С`);
    return {};
  }

  async cancelOrder(order: AccountingOrder) {
    this.logger.log(`[1С отключена] Отмена заказа №${order.number}`);
  }

  async fetchCatalog() {
    return [];
  }
}
