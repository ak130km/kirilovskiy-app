import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  FULFILLMENT_TYPE_LABELS,
  formatDateRu,
  formatPhone,
  formatRub,
  formatSlot,
  getStatusPushText,
  PAYMENT_METHOD_LABELS,
} from '@kirilovskiy/shared';
import { OrderEvents, type OrderEventPayload, type OrderStatusChangedPayload } from '../../common/events';
import { fromDbDate } from '../../common/utils/moscow-time';
import { PrismaService } from '../../prisma/prisma.service';
import { PUSH_ADAPTER, type PushAdapter, type PushMessage } from './adapters/push-adapter';
import { STAFF_NOTIFIER, type StaffNotifier } from './adapters/staff-notifier';

const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PUSH_ADAPTER) private readonly push: PushAdapter,
    @Inject(STAFF_NOTIFIER) private readonly staffNotifier: StaffNotifier,
  ) {}

  /** Push клиенту при каждой смене статуса */
  @OnEvent(OrderEvents.STATUS_CHANGED, { async: true })
  async onStatusChanged({ orderId, to }: OrderStatusChangedPayload) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return;
    const text = getStatusPushText(to, order.number, order.fulfillmentType, order.cancelReason);
    if (text) await this.pushToOrder(orderId, text.title, text.body);
  }

  /** Оплаченный заказ: сообщение сотрудникам в Telegram и подтверждение клиенту */
  @OnEvent(OrderEvents.PAID, { async: true })
  async onPaid({ orderId }: OrderEventPayload) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, deliveryZone: true },
    });
    if (!order) return;

    await this.pushToOrder(orderId, `Заказ № ${order.number} оплачен`, 'Мы получили оплату и скоро подтвердим заказ.');

    const when = `${formatDateRu(fromDbDate(order.deliveryDate))}, ${formatSlot(order.slotStartMinutes, order.slotEndMinutes)}`;
    const lines = [
      `🧁 <b>Новый заказ №${order.number}</b> — ${formatRub(order.totalAmount)}`,
      `${FULFILLMENT_TYPE_LABELS[order.fulfillmentType]}: ${when}`,
      order.fulfillmentType === 'DELIVERY'
        ? `📍 ${esc(order.address ?? '')}${order.apartment ? `, кв. ${esc(order.apartment)}` : ''}${order.deliveryZone ? ` (${esc(order.deliveryZone.name)})` : ''}`
        : null,
      `👤 ${esc(order.customerName)}, ${formatPhone(order.customerPhone)}`,
      '',
      ...order.items.map((i) => `• ${esc(i.productName)} × ${i.quantity}`),
      order.comment ? `\n💬 ${esc(order.comment)}` : null,
      `\nОплата: ${PAYMENT_METHOD_LABELS[order.paymentMethod]}`,
    ].filter((l) => l !== null);
    await this.notifyStaff(lines.join('\n'), orderId);
  }

  @OnEvent(OrderEvents.CANCELLED, { async: true })
  async onCancelled({ orderId }: OrderEventPayload) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order || !order.paidAt) return; // о неоплаченных заказах сотрудники не знали
    await this.notifyStaff(
      `❌ <b>Заказ №${order.number} отменён</b>${order.cancelReason ? `\nПричина: ${esc(order.cancelReason)}` : ''}`,
      orderId,
    );
  }

  private async pushToOrder(orderId: string, title: string, body: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { device: true, customer: { include: { devices: true } } },
    });
    if (!order) return;
    const tokens = new Set<string>();
    if (order.device) tokens.add(order.device.expoPushToken);
    order.customer?.devices.forEach((d) => tokens.add(d.expoPushToken));
    if (!tokens.size) return;

    const messages: PushMessage[] = [...tokens].map((to) => ({
      to,
      title,
      body,
      data: { orderId, url: `/order/${orderId}` },
    }));
    try {
      const results = await this.push.send(messages);
      for (const r of results) {
        await this.prisma.notificationLog.create({
          data: { channel: 'PUSH', recipient: r.token, orderId, title, body, status: r.ok ? 'sent' : 'failed', error: r.error },
        });
        if (r.invalidToken) await this.prisma.device.deleteMany({ where: { expoPushToken: r.token } });
      }
    } catch (e) {
      this.logger.warn(`Push не отправлен: ${e}`);
      await this.prisma.notificationLog.create({
        data: { channel: 'PUSH', recipient: [...tokens].join(','), orderId, title, body, status: 'failed', error: String(e) },
      });
    }
  }

  private async notifyStaff(html: string, orderId: string) {
    try {
      await this.staffNotifier.notify(html);
      await this.prisma.notificationLog.create({
        data: { channel: 'TELEGRAM', recipient: this.staffNotifier.provider, orderId, body: html, status: 'sent' },
      });
    } catch (e) {
      this.logger.warn(`Сообщение сотрудникам не отправлено: ${e}`);
      await this.prisma.notificationLog.create({
        data: { channel: 'TELEGRAM', recipient: this.staffNotifier.provider, orderId, body: html, status: 'failed', error: String(e) },
      });
    }
  }
}
