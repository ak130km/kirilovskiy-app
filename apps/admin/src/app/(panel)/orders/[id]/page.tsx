'use client';

import type { AdminOrderDto } from '@kirilovskiy/shared';
import {
  formatDateRu,
  formatDateTimeMsk,
  formatPhone,
  formatRub,
  formatSlot,
  formatWeight,
  FULFILLMENT_TYPE_LABELS,
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
} from '@kirilovskiy/shared';
import { ArrowLeft, RefreshCw, Truck } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { StatusButtons } from '@/components/order-actions';
import { PageHeader, PaymentBadge, Spinner, StatusBadge, useToast } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { mediaUrl } from '@/lib/config';
import { useOrderEvents } from '@/lib/order-events';
import { useResource } from '@/lib/use-resource';

const ACTOR_LABELS = { CUSTOMER: 'Клиент', STAFF: 'Сотрудник', SYSTEM: 'Система', INTEGRATION: 'Интеграция' } as const;

const COURIER_LABELS: Record<string, string> = {
  performer_lookup: 'Ищем курьера',
  performer_found: 'Курьер назначен',
  pickup_arrived: 'Курьер в кондитерской',
  pickuped: 'Курьер забрал заказ',
  delivery_arrived: 'Курьер у клиента',
  delivered: 'Доставлено',
  delivered_finish: 'Доставлено',
  cancelled: 'Отменена',
};

export default function OrderPage() {
  const { id } = useParams<{ id: string }>();
  const { data: order, setData, error, reload } = useResource<AdminOrderDto>(`/admin/orders/${id}`);
  const { version, refreshCounts } = useOrderEvents();
  const toast = useToast();
  const [courierBusy, setCourierBusy] = useState(false);

  useEffect(() => {
    if (version > 0) void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  if (error) return <div className="alert alert-danger">{error}</div>;
  if (!order) return <Spinner />;

  const canCallCourier =
    order.fulfillmentType === 'DELIVERY' &&
    ['CONFIRMED', 'PREPARING', 'READY'].includes(order.status) &&
    (!order.courier || ['cancelled', 'failed'].includes(order.courier.status));

  async function courier(action: 'request' | 'refresh') {
    setCourierBusy(true);
    try {
      const updated = await api.post<AdminOrderDto>(`/admin/orders/${id}/courier${action === 'refresh' ? '/refresh' : ''}`);
      setData(updated);
      if (action === 'request') toast('Курьер вызван', 'success');
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setCourierBusy(false);
    }
  }

  const address = [
    order.address,
    order.apartment && `кв. ${order.apartment}`,
    order.entrance && `подъезд ${order.entrance}`,
    order.floor && `этаж ${order.floor}`,
    order.intercom && `домофон ${order.intercom}`,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <>
      <Link href="/orders" className="row muted" style={{ marginBottom: 12 }}>
        <ArrowLeft size={16} /> Все заказы
      </Link>
      <PageHeader
        title={`Заказ № ${order.number}`}
        sub={<span className="row"><StatusBadge status={order.status} /><PaymentBadge status={order.paymentStatus} /> создан {formatDateTimeMsk(order.createdAt)}</span>}
      >
        <StatusButtons orderId={order.id} number={order.number} nextStatuses={order.nextStatuses}
          paymentStatus={order.paymentStatus} onChanged={() => { void reload(); refreshCounts(); }} />
        {canCallCourier ? (
          <button className="btn" disabled={courierBusy} onClick={() => courier('request')}>
            <Truck size={16} /> Вызвать курьера
          </button>
        ) : null}
      </PageHeader>

      {order.status === 'CANCELLED' && order.cancelReason ? (
        <div className="alert alert-danger" style={{ marginBottom: 16 }}>Отменён: {order.cancelReason}</div>
      ) : null}

      <div className="grid grid-2">
        <div className="stack">
          <div className="card">
            <div className="card-body">
              <h2 className="card-title">Состав заказа</h2>
              <table className="table">
                <tbody>
                  {order.items.map((i) => (
                    <tr key={i.id}>
                      <td style={{ width: 56 }}>{i.imageUrl ? <img className="thumb" src={mediaUrl(i.imageUrl)!} alt="" /> : null}</td>
                      <td>
                        <div className="strong">{i.productName}</div>
                        <div className="small muted">{formatWeight(i.weightGrams)} · {formatRub(i.unitPrice)}</div>
                      </td>
                      <td className="nowrap">× {i.quantity}</td>
                      <td className="right nowrap strong">{formatRub(i.totalAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="divider" />
              <dl className="kv">
                <dt>Товары</dt><dd className="right">{formatRub(order.subtotalAmount)}</dd>
                {order.discountAmount ? (<><dt>Скидка {order.promoCode ? `(${order.promoCode})` : ''}</dt><dd className="right">−{formatRub(order.discountAmount)}</dd></>) : null}
                <dt>Доставка</dt><dd className="right">{order.fulfillmentType === 'PICKUP' ? '—' : order.deliveryAmount ? formatRub(order.deliveryAmount) : 'бесплатно'}</dd>
                <dt className="strong" style={{ color: 'var(--text)' }}>Итого</dt><dd className="right strong" style={{ fontSize: 18 }}>{formatRub(order.totalAmount)}</dd>
              </dl>
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <h2 className="card-title">История</h2>
              <ul className="timeline">
                {order.history.map((h) => (
                  <li key={h.id}>
                    <div className="strong">{ORDER_STATUS_LABELS[h.toStatus]}</div>
                    <div className="small muted">
                      {formatDateTimeMsk(h.createdAt)} · {h.staffName ?? ACTOR_LABELS[h.actor]}
                      {h.comment ? ` · ${h.comment}` : ''}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-body">
              <h2 className="card-title">Клиент и получение</h2>
              <dl className="kv">
                <dt>Клиент</dt><dd>{order.customerName}{order.customerId ? <span className="badge badge-gray" style={{ marginLeft: 6 }}>аккаунт</span> : <span className="badge badge-gray" style={{ marginLeft: 6 }}>гость</span>}</dd>
                <dt>Телефон</dt><dd>{order.customerPhone ? <a href={`tel:${order.customerPhone}`} className="strong">{formatPhone(order.customerPhone)}</a> : '—'}</dd>
                <dt>Способ</dt><dd>{FULFILLMENT_TYPE_LABELS[order.fulfillmentType]}</dd>
                <dt>Когда</dt><dd className="strong">{formatDateRu(order.deliveryDate)}, {formatSlot(order.slotStartMinutes, order.slotEndMinutes)}</dd>
                {order.fulfillmentType === 'DELIVERY' ? (
                  <><dt>Адрес</dt><dd>{address}</dd><dt>Зона</dt><dd>{order.deliveryZone?.name ?? '—'}</dd></>
                ) : (
                  <><dt>Точка</dt><dd>{order.pickupAddress}</dd></>
                )}
                <dt>Комментарий</dt><dd>{order.comment || '—'}</dd>
              </dl>
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <h2 className="card-title">Оплата</h2>
              <dl className="kv">
                <dt>Способ</dt><dd>{PAYMENT_METHOD_LABELS[order.paymentMethod]}</dd>
                <dt>Статус</dt><dd><PaymentBadge status={order.paymentStatus} /></dd>
                {order.paidAt ? (<><dt>Оплачен</dt><dd>{formatDateTimeMsk(order.paidAt)}</dd></>) : null}
              </dl>
              {order.payments.length ? (
                <table className="table mt">
                  <thead><tr><th>Платёж</th><th>Статус</th><th className="right">Сумма</th></tr></thead>
                  <tbody>
                    {order.payments.map((p) => (
                      <tr key={p.id}>
                        <td className="small">{p.provider} · {PAYMENT_METHOD_LABELS[p.method]}<div className="muted">{formatDateTimeMsk(p.createdAt)}</div></td>
                        <td>{PAYMENT_STATUS_LABELS[p.status]}{p.failureReason ? <div className="small muted">{p.failureReason}</div> : null}</td>
                        <td className="right">{formatRub(p.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
            </div>
          </div>

          {order.fulfillmentType === 'DELIVERY' ? (
            <div className="card">
              <div className="card-body">
                <div className="card-title">
                  <h2>Курьер</h2>
                  <div style={{ flex: 1 }} />
                  {order.courier ? (
                    <button className="btn btn-sm" disabled={courierBusy} onClick={() => courier('refresh')}>
                      <RefreshCw size={14} /> Обновить
                    </button>
                  ) : null}
                </div>
                {order.courier ? (
                  <dl className="kv">
                    <dt>Служба</dt><dd>{order.courier.provider === 'yandex' ? 'Яндекс Доставка' : 'Тестовый курьер'}</dd>
                    <dt>Статус</dt><dd className="strong">{COURIER_LABELS[order.courier.status] ?? order.courier.status}</dd>
                    {order.courier.courierName ? (<><dt>Курьер</dt><dd>{order.courier.courierName} {order.courier.courierPhone ?? ''}</dd></>) : null}
                    {order.courier.price ? (<><dt>Стоимость</dt><dd>{formatRub(order.courier.price)}</dd></>) : null}
                    {order.courier.trackingUrl ? (<><dt>Отслеживание</dt><dd><a href={order.courier.trackingUrl} target="_blank" rel="noreferrer">Открыть</a></dd></>) : null}
                    <dt>Заявка</dt><dd className="small muted">{order.courier.externalId}</dd>
                  </dl>
                ) : (
                  <div className="muted">Курьер ещё не вызван. Вызовите его, когда заказ будет почти готов.</div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
