'use client';

import type { AuditLogDto, Paginated, StaffDto } from '@kirilovskiy/shared';
import { formatDateTimeMsk } from '@kirilovskiy/shared';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { PageHeader, Spinner } from '@/components/ui';
import { useResource } from '@/lib/use-resource';

const ENTITY_LABELS: Record<string, string> = {
  order: 'Заказы',
  product: 'Товары',
  category: 'Категории',
  promo_code: 'Промокоды',
  delivery_zone: 'Зоны доставки',
  time_slot: 'Интервалы',
  blackout_date: 'Нерабочие дни',
  staff: 'Сотрудники',
  settings: 'Настройки',
};

function Changes({ changes }: { changes: unknown }) {
  if (!changes || typeof changes !== 'object') return null;
  const entries = Object.entries(changes as Record<string, { from: unknown; to: unknown }>);
  if (!entries.length) return null;
  const fmt = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v));
  return (
    <div className="small muted">
      {entries.map(([k, v]) => (
        <div key={k}>{k}: {fmt(v?.from)} → {fmt(v?.to)}</div>
      ))}
    </div>
  );
}

export default function AuditPage() {
  const [page, setPage] = useState(1);
  const [staffId, setStaffId] = useState('');
  const [entityType, setEntityType] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const { data: staff } = useResource<StaffDto[]>('/admin/staff');

  useEffect(() => {
    const t = setTimeout(() => { setQuery(search.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const path = useMemo(() => {
    const p = new URLSearchParams({ page: String(page), pageSize: '50' });
    if (staffId) p.set('staffId', staffId);
    if (entityType) p.set('entityType', entityType);
    if (query) p.set('search', query);
    return `/admin/audit-logs?${p}`;
  }, [page, staffId, entityType, query]);
  const { data, loading } = useResource<Paginated<AuditLogDto>>(path);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <>
      <PageHeader title="Журнал действий" sub="Кто, что и когда изменил: статусы заказов, цены, стоп-лист, настройки" />
      <div className="row" style={{ marginBottom: 16 }}>
        <input className="input" style={{ width: 260 }} placeholder="Поиск по описанию" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="select" style={{ width: 220 }} value={staffId} onChange={(e) => { setStaffId(e.target.value); setPage(1); }}>
          <option value="">Все сотрудники</option>
          {staff?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select className="select" style={{ width: 200 }} value={entityType} onChange={(e) => { setEntityType(e.target.value); setPage(1); }}>
          <option value="">Все разделы</option>
          {Object.entries(ENTITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      {loading && !data ? <Spinner /> : null}
      <div className="card">
        <table className="table">
          <thead><tr><th>Когда</th><th>Сотрудник</th><th>Действие</th><th>IP</th></tr></thead>
          <tbody>
            {data?.items.map((l) => (
              <tr key={l.id}>
                <td className="nowrap small">{formatDateTimeMsk(l.createdAt)}</td>
                <td className="nowrap">{l.staff?.name ?? <span className="muted">Система</span>}</td>
                <td>
                  {l.entityType === 'order' && l.entityId ? <Link href={`/orders/${l.entityId}`} className="strong">{l.summary}</Link> : <span className="strong">{l.summary}</span>}
                  <Changes changes={l.changes} />
                </td>
                <td className="small muted nowrap">{l.ip}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {data?.items.length === 0 ? <div className="empty">Записей нет</div> : null}
      </div>
      {pages > 1 ? (
        <div className="row mt">
          <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Назад</button>
          <span className="muted">Страница {page} из {pages}</span>
          <button className="btn btn-sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Вперёд →</button>
        </div>
      ) : null}
    </>
  );
}
