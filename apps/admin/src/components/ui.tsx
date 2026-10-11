'use client';

import type { OrderStatus, PaymentStatus } from '@kirilovskiy/shared';
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from '@kirilovskiy/shared';
import { X } from 'lucide-react';
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';

const STATUS_COLORS: Record<OrderStatus, string> = {
  NEW: 'blue',
  CONFIRMED: 'indigo',
  PREPARING: 'amber',
  READY: 'green',
  HANDED_TO_COURIER: 'teal',
  COMPLETED: 'gray',
  CANCELLED: 'red',
};

const PAYMENT_COLORS: Record<PaymentStatus, string> = {
  PENDING: 'amber',
  SUCCEEDED: 'green',
  FAILED: 'red',
  CANCELLED: 'gray',
  REFUNDED: 'gray',
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`badge badge-${STATUS_COLORS[status]}`}>{ORDER_STATUS_LABELS[status]}</span>;
}

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  const label = status === 'PENDING' ? 'Не оплачен' : PAYMENT_STATUS_LABELS[status];
  return <span className={`badge badge-${PAYMENT_COLORS[status]}`}>{label}</span>;
}

export function Spinner() {
  return <div className="spinner" aria-label="Загрузка" />;
}

export function PageHeader({ title, sub, children }: { title: string; sub?: ReactNode; children?: ReactNode }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {sub ? <div className="sub">{sub}</div> : null}
      </div>
      <div className="spacer" />
      {children}
    </div>
  );
}

export function Modal({
  title,
  onClose,
  children,
  footer,
  width,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="card modal" style={width ? { maxWidth: width } : undefined} role="dialog" aria-modal="true">
        <div className="modal-header">
          <h2>{title}</h2>
          <div style={{ flex: 1 }} />
          <button className="btn btn-ghost icon-btn" onClick={onClose} aria-label="Закрыть">
            <X size={18} />
          </button>
        </div>
        <div className="card-body">{children}</div>
        {footer ? <div className="modal-footer">{footer}</div> : null}
      </div>
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {hint ? <div className="hint">{hint}</div> : null}
    </div>
  );
}

// ─── Уведомления ───

type Toast = { id: number; text: string; kind: 'info' | 'error' | 'success' };
const ToastContext = createContext<(text: string, kind?: Toast['kind']) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, kind: Toast['kind'] = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toasts" role="status">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
