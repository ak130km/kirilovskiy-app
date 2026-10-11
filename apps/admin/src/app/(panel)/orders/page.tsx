'use client';

import type { AdminOrderListItemDto, Paginated } from '@kirilovskiy/shared';
import {
  formatDateRu,
  formatDateTimeMsk,
  formatPhone,
  formatRub,
  formatSlot,
  FULFILLMENT_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
} from '@kirilovskiy/shared';
import { MapPin, MessageSquare, Phone, RefreshCw, Store } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { StatusButtons } from '@/components/order-actions';
import { PageHeader, PaymentBadge, Spinner, StatusBadge } from '@/components/ui';
import { useOrderEvents } from '@/lib/order-events';
import { useResource } from '@/lib/use-resource';

const TABS = [
  { id: 'new', label: 'Новые', count: 'new' },
  { id: 'active', label: 'В работе', count: 'inProgress' },
  { id: 'ready', label: 'Готовы и в пути', count: 'ready' },
  { id: 'completed', label: 'Выполненные' },
  { id: 'cancelled', label: 'Отменённые' },
  { id: 'all', label: 'Все' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function OrdersPage() {
  const [tab, setTab] = useState<TabId>('new');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [date, setDate] = useState('');
  const { version, counts, fresh, refreshCounts } = useOrderEvents();

  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const path = useMemo(() => {
    const p = new URLSearchParams({ tab, pageSize: '100' });
    if (query) p.set('search', query);
    if (date) p.set('date', date);
    return `/admin/orders?${p}`;
  }, [tab, query, date]);

  const { data, loading, error, reload } = useResource<Paginated<AdminOrderListItemDto>>(path);

  useEffect(() => {
    if (version > 0) void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  const onChanged = () => {
    void reload();
    refreshCounts();
  };

  return (
    <>
      <PageHeader title="Заказы" sub="Новые оплаченные заказы приходят автоматически со звуковым сигналом">
        <input className="input" style={{ width: 240 }} placeholder="№, имя, телефон, адрес" value={search}
          onChange={(e) => setSearch(e.target.value)} />
        <input className="input" style={{ width: 160 }} type="date" value={date} onChange={(e) => setDate(e.target.value)}
          title="Дата доставки / самовывоза" />
        <button className="btn" onClick={onChanged} title="Обновить">
          <RefreshCw size={16} />
        </button>
      </PageHeader>

      <div className="tabs" style={{ marginBottom: 16 }}>
        {TABS.map((t) => {
          const count = 'count' in t && counts ? counts[t.count] : 0;
          return (
            <button key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
              {t.label}
              {count ? <span className="count">{count}</span> : null}
            </button>
          );
        })}
      </div>

      {error ? <div className="alert alert-danger">{error}</div> : null}
      {loading && !data ? <Spinner /> : null}
      {data && data.items.length === 0 ? <div className="card empty">Заказов нет</div> : null}

      <div className="orders-grid">
        {data?.items.map((o) => (
          <div key={o.id} className={`card order-card ${fresh.has(o.id) ? 'fresh' : ''}`}
            style={o.status === 'NEW' && o.paymentStatus !== 'SUCCEEDED' ? { opacity: 0.7 } : undefined}>
            <div className="row">
              <Link href={`/orders/${o.id}`} className="num">№ {o.number}</Link>
              <StatusBadge status={o.status} />
              <PaymentBadge status={o.paymentStatus} />
              <span className="sum">{formatRub(o.totalAmount)}</span>
            </div>
            <div className="row strong">
              {formatDateRu(o.deliveryDate)}, {formatSlot(o.slotStartMinutes, o.slotEndMinutes)}
              <span className="badge badge-gray">{FULFILLMENT_TYPE_LABELS[o.fulfillmentType]}</span>
            </div>
            {o.fulfillmentType === 'DELIVERY' ? (
              <div className="row muted">
                <MapPin size={15} /> {o.address}
                {o.deliveryZoneName ? ` · ${o.deliveryZoneName}` : ''}
              </div>
            ) : (
              <div className="row muted"><Store size={15} /> Самовывоз</div>
            )}
            <div className="row muted">
              <Phone size={15} /> {o.customerName}, <a href={`tel:${o.customerPhone}`}>{formatPhone(o.customerPhone)}</a>
            </div>
            <div className="items">{o.itemsSummary}</div>
            {o.comment ? (
              <div className="row small" style={{ alignItems: 'flex-start' }}>
                <MessageSquare size={14} style={{ marginTop: 2 }} /> {o.comment}
              </div>
            ) : null}
            <div className="small muted">
              Создан {formatDateTimeMsk(o.createdAt)} · {PAYMENT_METHOD_LABELS[o.paymentMethod]}
            </div>
            <div className="actions">
              <StatusButtons orderId={o.id} number={o.number} nextStatuses={o.nextStatuses}
                paymentStatus={o.paymentStatus} onChanged={onChanged} size="sm" />
              <Link href={`/orders/${o.id}`} className="btn btn-sm btn-ghost">Подробнее</Link>
            </div>
          </div>
        ))}
      </div>
      {data && data.total > data.items.length ? (
        <div className="muted mt">Показаны первые {data.items.length} из {data.total}. Уточните поиск или дату.</div>
      ) : null}
    </>
  );
}
