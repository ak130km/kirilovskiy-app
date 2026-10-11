'use client';

import type { BlackoutDateDto, FulfillmentType, TimeSlotDto } from '@kirilovskiy/shared';
import { formatDateRu, formatSlot, WEEKDAY_SHORT_LABELS } from '@kirilovskiy/shared';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Field, Modal, PageHeader, Spinner, useToast } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { inputToMinutes, timeToInput } from '@/lib/format';
import { useResource } from '@/lib/use-resource';

type Draft = {
  id?: string;
  fulfillmentType: FulfillmentType | '';
  start: string;
  end: string;
  weekdays: number[];
  capacity: string;
  isActive: boolean;
};

const TYPE_LABEL: Record<string, string> = { '': 'Доставка и самовывоз', DELIVERY: 'Доставка', PICKUP: 'Самовывоз' };

export default function SlotsPage() {
  const slots = useResource<TimeSlotDto[]>('/admin/time-slots');
  const blackout = useResource<BlackoutDateDto[]>('/admin/blackout-dates');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [bDate, setBDate] = useState('');
  const [bReason, setBReason] = useState('');
  const toast = useToast();

  async function save() {
    if (!draft) return;
    const body = {
      fulfillmentType: draft.fulfillmentType || null,
      startMinutes: inputToMinutes(draft.start),
      endMinutes: inputToMinutes(draft.end),
      weekdays: draft.weekdays,
      capacity: Number(draft.capacity) || 1,
      isActive: draft.isActive,
    };
    try {
      if (draft.id) await api.patch(`/admin/time-slots/${draft.id}`, body);
      else await api.post('/admin/time-slots', body);
      setDraft(null);
      void slots.reload();
      toast('Интервал сохранён', 'success');
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  }

  async function removeSlot(s: TimeSlotDto) {
    if (!confirm(`Удалить интервал ${formatSlot(s.startMinutes, s.endMinutes)}? Можно вместо этого выключить его.`)) return;
    try {
      await api.delete(`/admin/time-slots/${s.id}`);
      void slots.reload();
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  }

  async function addBlackout() {
    try {
      await api.post('/admin/blackout-dates', { date: bDate, reason: bReason || null });
      setBDate('');
      setBReason('');
      void blackout.reload();
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  }

  async function removeBlackout(id: string) {
    try {
      await api.delete(`/admin/blackout-dates/${id}`);
      void blackout.reload();
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  }

  const groups: FulfillmentType[] = ['DELIVERY', 'PICKUP'];

  return (
    <>
      <PageHeader title="Временные интервалы" sub="Время по Москве. Вместимость — сколько заказов можно принять в интервал на одну дату">
        <button className="btn btn-primary" onClick={() => setDraft({ fulfillmentType: 'DELIVERY', start: '10:00', end: '12:00', weekdays: [1, 2, 3, 4, 5, 6, 7], capacity: '6', isActive: true })}>
          <Plus size={16} /> Добавить интервал
        </button>
      </PageHeader>
      {slots.loading && !slots.data ? <Spinner /> : null}
      <div className="grid grid-2">
        {groups.map((g) => (
          <div className="card" key={g}>
            <div className="card-body">
              <h2 className="card-title">{TYPE_LABEL[g]}</h2>
              <table className="table">
                <thead><tr><th>Интервал</th><th>Дни</th><th>Мест</th><th /></tr></thead>
                <tbody>
                  {slots.data?.filter((s) => s.fulfillmentType === g || s.fulfillmentType === null).map((s) => (
                    <tr key={s.id} style={s.isActive ? undefined : { opacity: 0.5 }}>
                      <td className="strong nowrap">{formatSlot(s.startMinutes, s.endMinutes)}{s.fulfillmentType === null ? <div className="small muted">для обоих</div> : null}</td>
                      <td className="small">{s.weekdays.length === 7 ? 'ежедневно' : s.weekdays.map((d) => WEEKDAY_SHORT_LABELS[d - 1]).join(', ')}</td>
                      <td>{s.capacity}</td>
                      <td className="right nowrap">
                        <button className="btn btn-sm" onClick={() => setDraft({ id: s.id, fulfillmentType: s.fulfillmentType ?? '', start: timeToInput(s.startMinutes), end: timeToInput(s.endMinutes), weekdays: s.weekdays, capacity: String(s.capacity), isActive: s.isActive })}>Изменить</button>{' '}
                        <button className="btn btn-sm btn-ghost icon-btn" onClick={() => removeSlot(s)} aria-label="Удалить"><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      <div className="card mt">
        <div className="card-body">
          <h2 className="card-title">Нерабочие дни</h2>
          <div className="row" style={{ marginBottom: 12 }}>
            <input className="input" type="date" style={{ width: 180 }} value={bDate} onChange={(e) => setBDate(e.target.value)} />
            <input className="input" style={{ width: 280 }} placeholder="Причина, например «31 декабря — предзаказы»" value={bReason} onChange={(e) => setBReason(e.target.value)} />
            <button className="btn" disabled={!bDate} onClick={addBlackout}>Добавить</button>
          </div>
          {blackout.data?.length ? (
            <div className="chips">
              {blackout.data.map((b) => (
                <span key={b.id} className="chip" style={{ cursor: 'default' }}>
                  {formatDateRu(b.date)}{b.reason ? ` — ${b.reason}` : ''}{' '}
                  <button className="btn btn-ghost btn-sm icon-btn" style={{ height: 20 }} onClick={() => removeBlackout(b.id)} aria-label="Удалить"><Trash2 size={12} /></button>
                </span>
              ))}
            </div>
          ) : (
            <div className="muted">Нерабочих дней нет</div>
          )}
        </div>
      </div>

      {draft ? (
        <Modal title={draft.id ? 'Интервал' : 'Новый интервал'} onClose={() => setDraft(null)}
          footer={<><button className="btn" onClick={() => setDraft(null)}>Отмена</button><button className="btn btn-primary" onClick={save} disabled={!draft.weekdays.length}>Сохранить</button></>}>
          <div className="stack">
            <Field label="Для чего">
              <select className="select" value={draft.fulfillmentType} onChange={(e) => setDraft({ ...draft, fulfillmentType: e.target.value as Draft['fulfillmentType'] })}>
                <option value="DELIVERY">Доставка</option>
                <option value="PICKUP">Самовывоз</option>
                <option value="">Доставка и самовывоз</option>
              </select>
            </Field>
            <div className="grid grid-3">
              <Field label="Начало"><input className="input" type="time" value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} /></Field>
              <Field label="Конец"><input className="input" type="time" value={draft.end} onChange={(e) => setDraft({ ...draft, end: e.target.value })} /></Field>
              <Field label="Мест"><input className="input" inputMode="numeric" value={draft.capacity} onChange={(e) => setDraft({ ...draft, capacity: e.target.value })} /></Field>
            </div>
            <div className="field">
              <span className="label">Дни недели</span>
              <div className="chips">
                {WEEKDAY_SHORT_LABELS.map((label, i) => {
                  const day = i + 1;
                  const on = draft.weekdays.includes(day);
                  return (
                    <button key={day} type="button" className={`chip ${on ? 'on' : ''}`}
                      onClick={() => setDraft({ ...draft, weekdays: on ? draft.weekdays.filter((d) => d !== day) : [...draft.weekdays, day].sort() })}>
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
            <label className="check"><input type="checkbox" checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} /> Интервал активен</label>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
