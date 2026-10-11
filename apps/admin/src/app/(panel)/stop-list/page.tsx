'use client';

import type { AdminProductDto } from '@kirilovskiy/shared';
import { formatDateTimeMsk, formatRub } from '@kirilovskiy/shared';
import { useMemo, useState } from 'react';
import { Field, Modal, PageHeader, Spinner, useToast } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { mediaUrl } from '@/lib/config';
import { useResource } from '@/lib/use-resource';

/** Конец текущего дня по Москве (23:59) в ISO */
function endOfDayMsk(): string {
  const now = new Date(Date.now() + 3 * 3600_000);
  const y = now.getUTCFullYear(), m = now.getUTCMonth(), d = now.getUTCDate();
  return new Date(Date.UTC(y, m, d, 23 - 3, 59)).toISOString();
}

export default function StopListPage() {
  const { data, loading, error, setData } = useResource<AdminProductDto[]>('/admin/products');
  const [search, setSearch] = useState('');
  const [target, setTarget] = useState<AdminProductDto | null>(null);
  const [reason, setReason] = useState('');
  const [untilEndOfDay, setUntilEndOfDay] = useState(true);
  const toast = useToast();

  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? [])
      .filter((p) => p.isActive && (!q || p.name.toLowerCase().includes(q)))
      .sort((a, b) => Number(b.inStopList) - Number(a.inStopList));
  }, [data, search]);
  const stopped = items.filter((p) => p.inStopList).length;

  async function apply(p: AdminProductDto, inStopList: boolean, extra: { reason?: string; until?: string | null } = {}) {
    try {
      const updated = await api.patch<AdminProductDto>(`/admin/products/${p.id}/stop-list`, { inStopList, ...extra });
      setData((list) => list?.map((x) => (x.id === p.id ? updated : x)) ?? null);
      toast(inStopList ? `«${p.name}» в стоп-листе` : `«${p.name}» снова в продаже`, 'success');
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  }

  return (
    <>
      <PageHeader title="Стоп-лист" sub={`Товары, которые временно нельзя заказать. Сейчас в стоп-листе: ${stopped}`}>
        <input className="input" style={{ width: 260 }} placeholder="Поиск товара" value={search} onChange={(e) => setSearch(e.target.value)} />
      </PageHeader>
      {error ? <div className="alert alert-danger">{error}</div> : null}
      {loading && !data ? <Spinner /> : null}
      <div className="card">
        <table className="table">
          <tbody>
            {items.map((p) => (
              <tr key={p.id} style={p.inStopList ? { background: '#fff8f8' } : undefined}>
                <td style={{ width: 60 }}>{p.imageUrl ? <img className="thumb" src={mediaUrl(p.imageUrl)!} alt="" /> : <div className="thumb" />}</td>
                <td>
                  <div className="strong">{p.name}</div>
                  <div className="small muted">{p.category.name} · {formatRub(p.price)}</div>
                </td>
                <td>
                  {p.inStopList ? (
                    <>
                      <span className="badge badge-red">Нет в наличии</span>
                      <div className="small muted">
                        {p.stopListReason ?? ''}
                        {p.stopListUntil ? ` · вернётся ${formatDateTimeMsk(p.stopListUntil)}` : ''}
                      </div>
                    </>
                  ) : (
                    <span className="badge badge-green">В продаже</span>
                  )}
                </td>
                <td className="right">
                  {p.inStopList ? (
                    <button className="btn btn-sm btn-success" onClick={() => apply(p, false)}>Вернуть в продажу</button>
                  ) : (
                    <button className="btn btn-sm btn-danger" onClick={() => { setTarget(p); setReason(''); setUntilEndOfDay(true); }}>В стоп-лист</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {target ? (
        <Modal title={`«${target.name}» — в стоп-лист`} onClose={() => setTarget(null)}
          footer={<><button className="btn" onClick={() => setTarget(null)}>Отмена</button>
            <button className="btn btn-primary" onClick={() => { void apply(target, true, { reason, until: untilEndOfDay ? endOfDayMsk() : null }); setTarget(null); }}>Добавить</button></>}>
          <div className="stack">
            <Field label="Причина (необязательно)"><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Закончились ягоды" autoFocus /></Field>
            <label className="check"><input type="checkbox" checked={untilEndOfDay} onChange={(e) => setUntilEndOfDay(e.target.checked)} /> Автоматически вернуть в продажу завтра (после 23:59)</label>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
