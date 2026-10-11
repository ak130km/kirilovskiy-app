import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { OrderStreamEvent } from '@kirilovskiy/shared';
import { Observable, Subject } from 'rxjs';
import { OrderEvents, type OrderEventPayload } from '../../common/events';
import { PrismaService } from '../../prisma/prisma.service';

/** Поток событий заказов для админ-панели (Server-Sent Events) */
@Injectable()
export class OrderStreamService {
  private readonly subject = new Subject<OrderStreamEvent>();

  constructor(private readonly prisma: PrismaService) {}

  get stream(): Observable<OrderStreamEvent> {
    return this.subject.asObservable();
  }

  @OnEvent(OrderEvents.CREATED)
  onCreated(p: OrderEventPayload) {
    return this.publish('order.created', p.orderId);
  }

  @OnEvent(OrderEvents.PAID)
  onPaid(p: OrderEventPayload) {
    return this.publish('order.paid', p.orderId);
  }

  @OnEvent(OrderEvents.STATUS_CHANGED)
  onStatusChanged(p: OrderEventPayload) {
    return this.publish('order.updated', p.orderId);
  }

  private async publish(type: OrderStreamEvent['type'], orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return;
    this.subject.next({
      type,
      orderId,
      number: order.number,
      status: order.status,
      paymentStatus: order.paymentStatus,
      totalAmount: order.totalAmount,
      at: new Date().toISOString(),
    });
  }
}
