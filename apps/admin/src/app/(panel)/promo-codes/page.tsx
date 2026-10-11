'use client';

import type { PromoCodeDto, PromoCodeType } from '@kirilovskiy/shared';
import { formatDateTimeMsk, formatRub } from '@kirilovskiy/shared';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Field, Modal, PageHeader, Spinner, useToast } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { isoToMskInput, kopecksToInput, mskInputToIso, parseRubles } from '@/lib/format';
import { useResource } from '@/lib/use-resource';

type Draft = {
  id?: string;
  code: string;
  description: string;
  type: PromoCodeType;
  value: string;
  minOrder: string;
  maxDiscount: string;
  startsAt: string;
  endsAt: string;
  usageLimit: string;
  perCustomer: string;
  isActive: boolean;
};

const EMPTY: Draft = {
  code: '', description: '', type: 'PERCENT', value: '10', minOrder: '', maxDiscount: '', startsAt: '', endsAt: '',
  usageLimit: '', perCustomer: '1', isActive: true,
};

function describe(p: PromoCodeDto) {
  const v = p.type === 'PERCENT' ? `${p.value}%` : formatRub(p.value);
  return `${v}${p.maxDiscountAmount ? `, не больше ${formatRub(p.maxDiscountAmount)}` : ''}${p.minOrderAmount ? ` от ${formatRub(p.minOrderAmount)}` : ''}`;
}

export default function PromoCodesPage() {
  const { data, loading, reload } = useResource<PromoCodeDto[]>('/admin/promo-codes');
  const [draft, setDraft] = useState<Draft | null>(null);
  const toast = useToast();

  function edit(p: PromoCodeDto) {
    setDraft({
      id: p.id,
      code: p.code,
      description: p.description ?? '',
      type: p.type,
      value: p.type === 'PERCENT' ? String(p.value) : kopecksToInput(p.value),
      minOrder: kopecksToInput(p.minOrderAmount || null),
      maxDiscount: kopecksToInput(p.maxDiscountAmount),
      startsAt: isoToMskInput(p.startsAt),
      endsAt: isoToMskInput(p.endsAt),
      usageLimit: p.usageLimit?.toString() ?? '',
      perCustomer: p.usageLimitPerCustomer?.toString() ?? '',
      isActive: p.isActive,
    });
  }

  async function save() {
    if (!draft) return;
    const value = draft.type === 'PERCENT' ? Number(draft.value) : parseRubles(draft.value);
    if (!value) return toast('Укажите размер скидки', 'error');
    const body = {
      code: draft.code,
      description: draft.description || null,
      type: draft.type,
      value,
      minOrderAmount: parseRubles(draft.minOrder) ?? 0,
      maxDiscountAmount: parseRubles(draft.maxDiscount),
      startsAt: mskInputToIso(draft.startsAt),
      endsAt: mskInputToIso(draft.endsAt),
      usageLimit: draft.usageLimit ? Number(draft.usageLimit) : null,
      usageLimitPerCustomer: draft.perCustomer ? Number(draft.perCustomer) : null,
      isActive: draft.isActive,
    };
    try {
      if (draft.id) await api.patch(`/admin/promo-codes/${draft.id}`, body);
      else await api.post('/admin/promo-codes', body);
      setDraft(null);
      void reload();
      toast('Промокод сохранён', 'success');
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  }

  async function remove(p: PromoCodeDto) {
    if (!confirm(`Удалить промокод ${p.code}? Если он уже использовался, он будет отключён.`)) return;
    try {
      await api.delete(`/admin/promo-codes/${p.id}`);
      void reload();
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  }

  const now = Date.now();
  return (
    <>
      <PageHeader title="Промокоды" sub="Скидка применяется к сумме товаров, без доставки">
        <button className="btn btn-primary" onClick={() => setDraft(EMPTY)}><Plus size={16} /> Создать промокод</button>
      </PageHeader>
      {loading && !data ? <Spinner /> : null}
      <div className="card">
        <table className="table">
          <thead><tr><th>Код</th><th>Скидка</th><th>Срок</th><th>Использован</th><th>Статус</th><th /></tr></thead>
          <tbody>
            {data?.map((p) => {
              const expired = p.endsAt && new Date(p.endsAt).getTime() < now;
              const exhausted = p.usageLimit !== null && p.usedCount >= p.usageLimit;
              return (
                <tr key={p.id}>
                  <td><div className="strong">{p.code}</div><div className="small muted">{p.description}</div></td>
                  <td>{describe(p)}</td>
                  <td className="small">
                    {p.startsAt ? `с ${formatDateTimeMsk(p.startsAt)}` : 'без начала'}<br />
                    {p.endsAt ? `до ${formatDateTimeMsk(p.endsAt)}` : 'бессрочно'}
                  </td>
                  <td>{p.usedCount}{p.usageLimit ? ` из ${p.usageLimit}` : ''}{p.usageLimitPerCustomer ? <div className="small muted">{p.usageLimitPerCustomer} на клиента</div> : null}</td>
                  <td>
                    {!p.isActive ? <span className="badge badge-gray">Выключен</span> : expired ? <span className="badge badge-gray">Истёк</span> : exhausted ? <span className="badge badge-amber">Исчерпан</span> : <span className="badge badge-green">Действует</span>}
                  </td>
                  <td className="right nowrap">
                    <button className="btn btn-sm" onClick={() => edit(p)}>Изменить</button>{' '}
                    <button className="btn btn-sm btn-danger" onClick={() => remove(p)}>Удалить</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {data?.length === 0 ? <div className="empty">Промокодов пока нет</div> : null}
      </div>

      {draft ? (
        <Modal title={draft.id ? `Промокод ${draft.code}` : 'Новый промокод'} onClose={() => setDraft(null)} width={600}
          footer={<><button className="btn" onClick={() => setDraft(null)}>Отмена</button><button className="btn btn-primary" onClick={save} disabled={draft.code.trim().length < 3}>Сохранить</button></>}>
          <div className="stack">
            <div className="grid grid-2">
              <Field label="Код"><input className="input" value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })} placeholder="SPRING15" autoFocus /></Field>
              <Field label="Тип">
                <select className="select" value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as PromoCodeType })}>
                  <option value="PERCENT">Процент</option>
                  <option value="FIXED">Сумма в рублях</option>
                </select>
              </Field>
            </div>
            <Field label="Описание (видит только персонал)"><input className="input" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></Field>
            <div className="grid grid-3">
              <Field label={draft.type === 'PERCENT' ? 'Скидка, %' : 'Скидка, ₽'}><input className="input" inputMode="decimal" value={draft.value} onChange={(e) => setDraft({ ...draft, value: e.target.value })} /></Field>
              <Field label="Заказ от, ₽"><input className="input" inputMode="decimal" value={draft.minOrder} onChange={(e) => setDraft({ ...draft, minOrder: e.target.value })} /></Field>
              <Field label="Макс. скидка, ₽"><input className="input" inputMode="decimal" value={draft.maxDiscount} onChange={(e) => setDraft({ ...draft, maxDiscount: e.target.value })} disabled={draft.type === 'FIXED'} /></Field>
            </div>
            <div className="grid grid-2">
              <Field label="Действует с (МСК)"><input className="input" type="datetime-local" value={draft.startsAt} onChange={(e) => setDraft({ ...draft, startsAt: e.target.value })} /></Field>
              <Field label="Действует до (МСК)"><input className="input" type="datetime-local" value={draft.endsAt} onChange={(e) => setDraft({ ...draft, endsAt: e.target.value })} /></Field>
            </div>
            <div className="grid grid-2">
              <Field label="Всего использований" hint="Пусто — без ограничения"><input className="input" inputMode="numeric" value={draft.usageLimit} onChange={(e) => setDraft({ ...draft, usageLimit: e.target.value })} /></Field>
              <Field label="На одного клиента" hint="Учитывается для вошедших клиентов"><input className="input" inputMode="numeric" value={draft.perCustomer} onChange={(e) => setDraft({ ...draft, perCustomer: e.target.value })} /></Field>
            </div>
            <label className="check"><input type="checkbox" checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} /> Промокод активен</label>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
