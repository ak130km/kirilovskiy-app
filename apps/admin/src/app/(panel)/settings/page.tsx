'use client';

import type { StoreSettings } from '@kirilovskiy/shared';
import { FormEvent, useEffect, useState } from 'react';
import { Field, PageHeader, Spinner, useToast } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { kopecksToInput, parseRubles } from '@/lib/format';
import { useResource } from '@/lib/use-resource';

type Integrations = Record<'payment' | 'courier' | 'accounting' | 'push' | 'sms' | 'telegram', string>;

const PROVIDER_LABELS: Record<string, string> = {
  test: 'Тестовый режим',
  alfabank: 'Альфа-Банк (карта, СБП)',
  yandex: 'Яндекс Доставка',
  noop: 'Отключено (журнал)',
  onec: '1С:УНФ',
  log: 'Журнал (без отправки)',
  expo: 'Expo Push',
  telegram: 'Telegram',
};

export default function SettingsPage() {
  const { data, setData } = useResource<StoreSettings>('/admin/settings');
  const { data: integrations } = useResource<Integrations>('/admin/integrations');
  const { can } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState<Record<string, string | boolean>>({});
  const [syncing, setSyncing] = useState(false);
  const readOnly = !can('ADMIN');

  useEffect(() => {
    if (!data) return;
    setForm({
      name: data.name,
      phone: data.phone,
      pickupAddress: data.pickupAddress,
      pickupHours: data.pickupHours,
      minOrderAmount: kopecksToInput(data.minOrderAmount),
      minLeadTimeMinutes: String(data.minLeadTimeMinutes),
      orderHorizonDays: String(data.orderHorizonDays),
      paymentTimeoutMinutes: String(data.paymentTimeoutMinutes),
      acceptingOrders: data.acceptingOrders,
      acceptingOrdersMessage: data.acceptingOrdersMessage,
      privacyPolicyUrl: data.privacyPolicyUrl,
    });
  }, [data]);

  const s = (k: string) => String(form[k] ?? '');
  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  async function save(e: FormEvent) {
    e.preventDefault();
    try {
      const updated = await api.patch<StoreSettings>('/admin/settings', {
        name: s('name'),
        phone: s('phone'),
        pickupAddress: s('pickupAddress'),
        pickupHours: s('pickupHours'),
        minOrderAmount: parseRubles(s('minOrderAmount')) ?? 0,
        minLeadTimeMinutes: Number(s('minLeadTimeMinutes')),
        orderHorizonDays: Number(s('orderHorizonDays')),
        paymentTimeoutMinutes: Number(s('paymentTimeoutMinutes')),
        acceptingOrders: !!form.acceptingOrders,
        acceptingOrdersMessage: s('acceptingOrdersMessage'),
        privacyPolicyUrl: s('privacyPolicyUrl'),
      });
      setData(updated);
      toast('Настройки сохранены', 'success');
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  }

  async function sync1c() {
    setSyncing(true);
    try {
      const res = await api.post<{ received: number; updated: number }>('/admin/integrations/1c/sync-catalog');
      toast(`1С: получено ${res.received}, обновлено ${res.updated}`, 'success');
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setSyncing(false);
    }
  }

  if (!data) return <Spinner />;

  return (
    <form onSubmit={save}>
      <PageHeader title="Настройки магазина" sub={readOnly ? 'Изменять настройки может только администратор' : undefined}>
        {!readOnly ? <button className="btn btn-primary" type="submit">Сохранить</button> : null}
      </PageHeader>
      <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0 }}>
        <div className="grid grid-2">
          <div className="card"><div className="card-body stack">
            <h2>Приём заказов</h2>
            <label className="check strong">
              <input type="checkbox" checked={!!form.acceptingOrders} onChange={(e) => set('acceptingOrders', e.target.checked)} /> Принимаем заказы
            </label>
            <Field label="Сообщение, когда приём закрыт"><input className="input" value={s('acceptingOrdersMessage')} onChange={(e) => set('acceptingOrdersMessage', e.target.value)} /></Field>
            <div className="grid grid-2">
              <Field label="Минимальная сумма заказа, ₽"><input className="input" inputMode="decimal" value={s('minOrderAmount')} onChange={(e) => set('minOrderAmount', e.target.value)} /></Field>
              <Field label="Время на подготовку, мин" hint="От «сейчас» до начала интервала"><input className="input" inputMode="numeric" value={s('minLeadTimeMinutes')} onChange={(e) => set('minLeadTimeMinutes', e.target.value)} /></Field>
              <Field label="Дат для выбора, дней"><input className="input" inputMode="numeric" value={s('orderHorizonDays')} onChange={(e) => set('orderHorizonDays', e.target.value)} /></Field>
              <Field label="Ожидание оплаты, мин" hint="Затем заказ отменяется"><input className="input" inputMode="numeric" value={s('paymentTimeoutMinutes')} onChange={(e) => set('paymentTimeoutMinutes', e.target.value)} /></Field>
            </div>
          </div></div>

          <div className="card"><div className="card-body stack">
            <h2>Кондитерская</h2>
            <Field label="Название"><input className="input" value={s('name')} onChange={(e) => set('name', e.target.value)} /></Field>
            <Field label="Телефон для клиентов"><input className="input" value={s('phone')} onChange={(e) => set('phone', e.target.value)} /></Field>
            <Field label="Адрес самовывоза"><input className="input" value={s('pickupAddress')} onChange={(e) => set('pickupAddress', e.target.value)} /></Field>
            <Field label="Часы работы"><input className="input" value={s('pickupHours')} onChange={(e) => set('pickupHours', e.target.value)} /></Field>
            <Field label="Ссылка на политику конфиденциальности"><input className="input" value={s('privacyPolicyUrl')} onChange={(e) => set('privacyPolicyUrl', e.target.value)} placeholder="https://…" /></Field>
          </div></div>
        </div>
      </fieldset>

      <div className="card mt"><div className="card-body">
        <div className="card-title">
          <h2>Интеграции</h2>
          <div style={{ flex: 1 }} />
          {can('ADMIN') ? <button type="button" className="btn btn-sm" onClick={sync1c} disabled={syncing}>Загрузить цены и остатки из 1С</button> : null}
        </div>
        <dl className="kv">
          <dt>Оплата</dt><dd>{PROVIDER_LABELS[integrations?.payment ?? ''] ?? integrations?.payment}</dd>
          <dt>Курьерская служба</dt><dd>{PROVIDER_LABELS[integrations?.courier ?? ''] ?? integrations?.courier}</dd>
          <dt>Учётная система</dt><dd>{PROVIDER_LABELS[integrations?.accounting ?? ''] ?? integrations?.accounting}</dd>
          <dt>Push-уведомления</dt><dd>{PROVIDER_LABELS[integrations?.push ?? ''] ?? integrations?.push}</dd>
          <dt>Уведомления персоналу</dt><dd>{PROVIDER_LABELS[integrations?.telegram ?? ''] ?? integrations?.telegram}</dd>
          <dt>SMS-коды</dt><dd>{PROVIDER_LABELS[integrations?.sms ?? ''] ?? integrations?.sms}</dd>
        </dl>
        <div className="hint mt">Провайдеры переключаются переменными окружения API (PAYMENT_PROVIDER, COURIER_PROVIDER и др.) — см. README.</div>
      </div></div>
    </form>
  );
}
