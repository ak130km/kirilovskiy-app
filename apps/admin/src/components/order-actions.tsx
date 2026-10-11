'use client';

import type { OrderStatus, PaymentStatus } from '@kirilovskiy/shared';
import { STATUS_ACTION_LABELS } from '@kirilovskiy/shared';
import { useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { Modal, useToast } from './ui';

const QUICK_REASONS = [
  'Клиент попросил отменить',
  'Нет нужных ингредиентов',
  'Не успеваем к выбранному времени',
  'Не удалось связаться с клиентом',
  'Адрес вне зоны доставки',
];

export function CancelOrderModal({
  orderId,
  number,
  paid,
  onClose,
  onDone,
}: {
  orderId: string;
  number: number;
  paid: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      const res = await api.post<{ refunded: boolean; refundError?: string }>(`/admin/orders/${orderId}/cancel`, { reason });
      if (res.refundError) toast(`Заказ отменён, но возврат не прошёл: ${res.refundError}. Сделайте возврат вручную.`, 'error');
      else toast(res.refunded ? `Заказ №${number} отменён, деньги возвращены клиенту` : `Заказ №${number} отменён`, 'success');
      onDone();
      onClose();
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`Отменить заказ №${number}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Не отменять</button>
          <button className="btn btn-primary" disabled={busy || reason.trim().length < 3} onClick={submit}>
            {busy ? 'Отменяем…' : 'Отменить заказ'}
          </button>
        </>
      }
    >
      <div className="stack">
        {paid ? <div className="alert alert-info">Заказ оплачен — деньги автоматически вернутся клиенту.</div> : null}
        <div className="chips">
          {QUICK_REASONS.map((r) => (
            <button key={r} className={`chip ${reason === r ? 'on' : ''}`} onClick={() => setReason(r)} type="button">
              {r}
            </button>
          ))}
        </div>
        <div className="field">
          <label>Причина (клиент увидит её в приложении)</label>
          <textarea className="textarea" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
        </div>
      </div>
    </Modal>
  );
}

/** Кнопки перехода по статусам для карточки и страницы заказа */
export function StatusButtons({
  orderId,
  number,
  nextStatuses,
  paymentStatus,
  onChanged,
  size,
}: {
  orderId: string;
  number: number;
  nextStatuses: OrderStatus[];
  paymentStatus: PaymentStatus;
  onChanged: () => void;
  size?: 'sm';
}) {
  const toast = useToast();
  const [busy, setBusy] = useState<OrderStatus | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const cls = size === 'sm' ? 'btn-sm' : '';

  async function change(status: OrderStatus) {
    setBusy(status);
    try {
      await api.post(`/admin/orders/${orderId}/status`, { status });
      toast(`Заказ №${number}: ${STATUS_ACTION_LABELS[status].toLowerCase()}`, 'success');
      onChanged();
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(null);
    }
  }

  const forward = nextStatuses.filter((s) => s !== 'CANCELLED');
  const unpaidNew = forward.includes('CONFIRMED') && paymentStatus !== 'SUCCEEDED';

  return (
    <>
      {forward.map((s) => (
        <button
          key={s}
          className={`btn ${s === 'CONFIRMED' ? 'btn-success' : 'btn-primary'} ${cls}`}
          disabled={!!busy || (s === 'CONFIRMED' && unpaidNew)}
          title={s === 'CONFIRMED' && unpaidNew ? 'Подтвердить можно после оплаты' : undefined}
          onClick={() => change(s)}
        >
          {busy === s ? '…' : STATUS_ACTION_LABELS[s]}
        </button>
      ))}
      {nextStatuses.includes('CANCELLED') ? (
        <button className={`btn btn-danger ${cls}`} disabled={!!busy} onClick={() => setCancelOpen(true)}>
          Отменить
        </button>
      ) : null}
      {cancelOpen ? (
        <CancelOrderModal
          orderId={orderId}
          number={number}
          paid={paymentStatus === 'SUCCEEDED'}
          onClose={() => setCancelOpen(false)}
          onDone={onChanged}
        />
      ) : null}
    </>
  );
}
