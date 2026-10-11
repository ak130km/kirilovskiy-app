import { ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { PaymentStartResponse } from '@kirilovskiy/shared';
import type { PaymentMethod, PaymentStatus } from '@prisma/client';
import type { AppConfig } from '../../config/configuration';
import { OrderEvents, type OrderEventPayload } from '../../common/events';
import { PrismaService } from '../../prisma/prisma.service';
import { IntegrationLogService } from '../integrations/integration-log.service';
import { PAYMENT_ADAPTER, type PaymentAdapter } from './adapters/payment-adapter';

/** Повторно используем ссылку на оплату, если она создана недавно */
const REUSE_PAYMENT_MS = 15 * 60 * 1000;

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYMENT_ADAPTER) private readonly adapter: PaymentAdapter,
    private readonly integrations: IntegrationLogService,
    private readonly events: EventEmitter2,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  get provider(): string {
    return this.adapter.provider;
  }

  /** Создаёт платёж и возвращает ссылку на оплату */
  async start(orderId: string, params: { method?: PaymentMethod; returnUrl?: string }): Promise<PaymentStartResponse> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Заказ не найден');
    if (order.status === 'CANCELLED') throw new ConflictException('Заказ отменён');
    if (order.paymentStatus === 'SUCCEEDED') throw new ConflictException('Заказ уже оплачен');
    if (order.paymentStatus === 'REFUNDED') throw new ConflictException('По заказу оформлен возврат');

    const method = params.method ?? order.paymentMethod;
    const returnUrl = this.resolveReturnUrl(order.id, params.returnUrl);

    const recent = await this.prisma.payment.findFirst({
      where: {
        orderId,
        method,
        status: 'PENDING',
        provider: this.adapter.provider,
        createdAt: { gte: new Date(Date.now() - REUSE_PAYMENT_MS) },
        confirmationUrl: { not: null },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (recent && (recent.raw as { returnUrl?: string } | null)?.returnUrl === returnUrl) {
      return { paymentId: recent.id, status: recent.status, confirmationUrl: recent.confirmationUrl };
    }

    if (method !== order.paymentMethod) {
      await this.prisma.order.update({ where: { id: orderId }, data: { paymentMethod: method } });
    }
    const payment = await this.prisma.payment.create({
      data: {
        orderId,
        provider: this.adapter.provider,
        method,
        amount: order.totalAmount,
        raw: { returnUrl },
      },
    });

    try {
      const result = await this.integrations.track(
        { provider: this.adapter.provider, operation: 'payment.create', orderId, request: { amount: order.totalAmount, method } },
        () =>
          this.adapter.createPayment({
            paymentId: payment.id,
            orderId,
            orderNumber: order.number,
            amount: order.totalAmount,
            method,
            description: `Заказ №${order.number} — Кондитерская Артёма Кирилловского`,
            returnUrl,
            customerPhone: order.customerPhone,
          }),
      );
      const updated = await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          externalId: result.externalId,
          confirmationUrl: result.confirmationUrl,
          status: result.status,
          raw: { returnUrl, provider: JSON.parse(JSON.stringify(result.raw ?? null)) },
        },
      });
      if (order.paymentStatus !== 'PENDING') {
        await this.prisma.order.update({ where: { id: orderId }, data: { paymentStatus: 'PENDING' } });
      }
      return { paymentId: updated.id, status: updated.status, confirmationUrl: updated.confirmationUrl };
    } catch (e) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'FAILED', failureReason: e instanceof Error ? e.message : String(e) },
      });
      throw new ConflictException('Платёжный сервис временно недоступен. Попробуйте ещё раз через минуту.');
    }
  }

  /** Перепроверка статуса у провайдера (после возврата клиента со страницы оплаты) */
  async sync(orderId: string): Promise<void> {
    const pending = await this.prisma.payment.findMany({
      where: { orderId, status: 'PENDING', externalId: { not: null } },
    });
    for (const payment of pending) {
      try {
        const res = await this.adapter.getStatus(payment.externalId!);
        if (res.status !== 'PENDING') await this.applyStatus(payment.id, res.status, res.failureReason);
      } catch (e) {
        this.logger.warn(`Не удалось проверить платёж ${payment.id}: ${e}`);
      }
    }
  }

  async handleWebhook(provider: string, input: { query: Record<string, string>; body: unknown }): Promise<void> {
    if (provider !== this.adapter.provider) throw new NotFoundException();
    const parsed = await this.adapter.parseWebhook(input);
    if (!parsed) throw new NotFoundException();
    const payment = await this.prisma.payment.findUnique({
      where: { provider_externalId: { provider, externalId: parsed.externalId } },
    });
    if (!payment) throw new NotFoundException();
    const res = await this.integrations.track(
      { provider, operation: 'payment.webhook', orderId: payment.orderId, request: input.query },
      () => this.adapter.getStatus(parsed.externalId),
    );
    await this.applyStatus(payment.id, res.status, res.failureReason);
  }

  /** Только для тестового провайдера: результат со страницы оплаты */
  async completeTestPayment(paymentId: string, success: boolean): Promise<string> {
    if (this.adapter.provider !== 'test') throw new NotFoundException();
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException('Платёж не найден');
    if (payment.status === 'PENDING') {
      await this.applyStatus(paymentId, success ? 'SUCCEEDED' : 'FAILED', success ? undefined : 'Отклонено на тестовой странице');
    }
    const returnUrl = (payment.raw as { returnUrl?: string } | null)?.returnUrl ?? this.resolveReturnUrl(payment.orderId);
    const sep = returnUrl.includes('?') ? '&' : '?';
    return `${returnUrl}${sep}status=${success ? 'success' : 'fail'}`;
  }

  async getTestPaymentPage(paymentId: string) {
    if (this.adapter.provider !== 'test') throw new NotFoundException();
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId }, include: { order: true } });
    if (!payment) throw new NotFoundException('Платёж не найден');
    return payment;
  }

  /** Возврат оплаты при отмене заказа */
  async refundOrder(orderId: string): Promise<{ refunded: boolean; error?: string }> {
    const payment = await this.prisma.payment.findFirst({
      where: { orderId, status: 'SUCCEEDED' },
      orderBy: { paidAt: 'desc' },
    });
    if (!payment) return { refunded: false };
    const amount = payment.amount - payment.refundedAmount;
    try {
      await this.integrations.track(
        { provider: payment.provider, operation: 'payment.refund', orderId, request: { amount } },
        () => this.adapter.refund(payment.externalId!, amount),
      );
      await this.prisma.$transaction([
        this.prisma.payment.update({
          where: { id: payment.id },
          data: { status: 'REFUNDED', refundedAmount: payment.amount },
        }),
        this.prisma.order.update({ where: { id: orderId }, data: { paymentStatus: 'REFUNDED' } }),
      ]);
      return { refunded: true };
    } catch (e) {
      return { refunded: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  private async applyStatus(paymentId: string, status: PaymentStatus, failureReason?: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId }, include: { order: true } });
    if (!payment || payment.status === status) return;

    if (status === 'SUCCEEDED') {
      const now = new Date();
      await this.prisma.$transaction([
        this.prisma.payment.update({ where: { id: paymentId }, data: { status, paidAt: now } }),
        this.prisma.order.update({
          where: { id: payment.orderId },
          data: { paymentStatus: 'SUCCEEDED', paidAt: now, paymentMethod: payment.method },
        }),
      ]);
      this.logger.log(`Заказ №${payment.order.number} оплачен`);
      if (payment.order.status === 'CANCELLED') {
        // Оплата пришла после автоотмены заказа — сразу возвращаем деньги
        const refund = await this.refundOrder(payment.orderId);
        this.logger.warn(`Оплата отменённого заказа №${payment.order.number}, возврат: ${refund.refunded ? 'выполнен' : refund.error}`);
        return;
      }
      this.events.emit(OrderEvents.PAID, { orderId: payment.orderId } satisfies OrderEventPayload);
      return;
    }

    await this.prisma.payment.update({ where: { id: paymentId }, data: { status, failureReason } });
    if ((status === 'FAILED' || status === 'CANCELLED') && payment.order.paymentStatus === 'PENDING') {
      await this.prisma.order.update({ where: { id: payment.orderId }, data: { paymentStatus: 'FAILED' } });
    }
  }

  /** Возврат в приложение после оплаты. Принимаем только схемы приложения, иначе — open redirect. */
  private resolveReturnUrl(orderId: string, returnUrl?: string): string {
    const scheme = this.config.get('appScheme', { infer: true });
    const fallback = `${scheme}://payment-result?orderId=${orderId}`;
    if (!returnUrl) return fallback;
    try {
      const url = new URL(returnUrl);
      if ([`${scheme}:`, 'exp:', 'exps:'].includes(url.protocol)) return returnUrl;
      const isDev = this.config.get('nodeEnv', { infer: true }) !== 'production';
      if (isDev && (url.protocol === 'http:' || url.protocol === 'https:')) return returnUrl;
    } catch {
      /* некорректный URL */
    }
    return fallback;
  }
}
