'use client';

import type { AdminDeliveryZoneDto } from '@kirilovskiy/shared';
import { formatRub } from '@kirilovskiy/shared';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Field, Modal, PageHeader, Spinner, useToast } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { kopecksToInput, parseRubles } from '@/lib/format';
import { useResource } from '@/lib/use-resource';

type Draft = {
  id?: string;
  name: string;
  description: string;
  price: string;
  freeFrom: string;
  minOrder: string;
  minutes: string;
  sortOrder: string;
  isActive: boolean;
};

export default function ZonesPage() {
  const { data, loading, reload } = useResource<AdminDeliveryZoneDto[]>('/admin/delivery-zones');
  const [draft, setDraft] = useState<Draft | null>(null);
  const toast = useToast();

  async function save() {
    if (!draft) return;
    const price = parseRubles(draft.price);
    if (price === null) return toast('Укажите стоимость доставки', 'error');
    const body = {
      name: draft.name,
      description: draft.description || null,
      price,
      freeFromAmount: parseRubles(draft.freeFrom),
      minOrderAmount: parseRubles(draft.minOrder) ?? 0,
      estimatedMinutes: draft.minutes ? Number(draft.minutes) : null,
      sortOrder: Number(draft.sortOrder) || 0,
      isActive: draft.isActive,
    };
    try {
      if (draft.id) await api.patch(`/admin/delivery-zones/${draft.id}`, body);
      else await api.post('/admin/delivery-zones', body);
      setDraft(null);
      void reload();
      toast('Зона сохранена', 'success');
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  }

  async function remove(z: AdminDeliveryZoneDto) {
    if (!confirm(`Удалить зону «${z.name}»? В старых заказах она останется пустой. Лучше выключить зону.`)) return;
    try {
      await api.delete(`/admin/delivery-zones/${z.id}`);
      void reload();
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  }

  return (
    <>
      <PageHeader title="Зоны доставки" sub="Клиент выбирает зону при оформлении; стоимость считается автоматически">
        <button className="btn btn-primary" onClick={() => setDraft({ name: '', description: '', price: '', freeFrom: '', minOrder: '', minutes: '', sortOrder: String((data?.length ?? 0) + 1), isActive: true })}>
          <Plus size={16} /> Добавить зону
        </button>
      </PageHeader>
      {loading && !data ? <Spinner /> : null}
      <div className="card">
        <table className="table">
          <thead><tr><th>Зона</th><th className="right">Доставка</th><th className="right">Бесплатно от</th><th className="right">Мин. заказ</th><th>Время</th><th>Статус</th><th /></tr></thead>
          <tbody>
            {data?.map((z) => (
              <tr key={z.id}>
                <td><div className="strong">{z.name}</div><div className="small muted">{z.description}</div></td>
                <td className="right nowrap">{formatRub(z.price)}</td>
                <td className="right nowrap">{z.freeFromAmount ? formatRub(z.freeFromAmount) : '—'}</td>
                <td className="right nowrap">{z.minOrderAmount ? formatRub(z.minOrderAmount) : '—'}</td>
                <td className="nowrap">{z.estimatedMinutes ? `до ${z.estimatedMinutes} мин` : '—'}</td>
                <td>{z.isActive ? <span className="badge badge-green">Активна</span> : <span className="badge badge-gray">Выключена</span>}</td>
                <td className="right nowrap">
                  <button className="btn btn-sm" onClick={() => setDraft({ id: z.id, name: z.name, description: z.description ?? '', price: kopecksToInput(z.price), freeFrom: kopecksToInput(z.freeFromAmount), minOrder: kopecksToInput(z.minOrderAmount || null), minutes: z.estimatedMinutes?.toString() ?? '', sortOrder: String(z.sortOrder), isActive: z.isActive })}>Изменить</button>{' '}
                  <button className="btn btn-sm btn-danger" onClick={() => remove(z)}>Удалить</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="alert alert-info mt">
        Автоопределение зоны по адресу (геокодер и полигоны на карте) запланировано на этап 7. Поле <code>polygon</code> в БД уже есть.
      </div>

      {draft ? (
        <Modal title={draft.id ? 'Зона доставки' : 'Новая зона'} onClose={() => setDraft(null)}
          footer={<><button className="btn" onClick={() => setDraft(null)}>Отмена</button><button className="btn btn-primary" onClick={save} disabled={draft.name.trim().length < 2}>Сохранить</button></>}>
          <div className="stack">
            <Field label="Название"><input className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} autoFocus /></Field>
            <Field label="Описание для клиента"><input className="input" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></Field>
            <div className="grid grid-3">
              <Field label="Доставка, ₽"><input className="input" inputMode="decimal" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} /></Field>
              <Field label="Бесплатно от, ₽"><input className="input" inputMode="decimal" value={draft.freeFrom} onChange={(e) => setDraft({ ...draft, freeFrom: e.target.value })} /></Field>
              <Field label="Мин. заказ, ₽"><input className="input" inputMode="decimal" value={draft.minOrder} onChange={(e) => setDraft({ ...draft, minOrder: e.target.value })} /></Field>
            </div>
            <div className="grid grid-2">
              <Field label="Время доставки, мин"><input className="input" inputMode="numeric" value={draft.minutes} onChange={(e) => setDraft({ ...draft, minutes: e.target.value })} /></Field>
              <Field label="Порядок"><input className="input" inputMode="numeric" value={draft.sortOrder} onChange={(e) => setDraft({ ...draft, sortOrder: e.target.value })} /></Field>
            </div>
            <label className="check"><input type="checkbox" checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} /> Зона активна</label>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
