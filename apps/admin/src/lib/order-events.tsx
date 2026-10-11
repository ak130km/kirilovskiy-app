'use client';

import type { AdminOrderCounts, OrderStreamEvent } from '@kirilovskiy/shared';
import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api } from './api';
import { useOrderStream } from './order-stream';
import { isAudioReady, playNewOrderChime, unlockAudio } from './sound';

interface OrderEventsState {
  counts: AdminOrderCounts | null;
  /** Увеличивается при каждом событии — страницы перезагружают данные */
  version: number;
  connection: 'connecting' | 'online' | 'offline';
  soundOn: boolean;
  enableSound: () => Promise<void>;
  disableSound: () => void;
  /** id заказов, пришедших за последние минуты, — для подсветки */
  fresh: Set<string>;
  refreshCounts: () => void;
}

const Ctx = createContext<OrderEventsState | null>(null);
const SOUND_KEY = 'kirilovskiy.sound';

export function OrderEventsProvider({ children }: { children: ReactNode }) {
  const [counts, setCounts] = useState<AdminOrderCounts | null>(null);
  const [version, setVersion] = useState(0);
  const [soundOn, setSoundOn] = useState(false);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const prevNew = useRef<number | null>(null);
  const soundRef = useRef(false);
  soundRef.current = soundOn;

  const refreshCounts = useCallback(() => {
    api
      .get<AdminOrderCounts>('/admin/orders/counts')
      .then((c) => {
        setCounts(c);
        const paidNew = c.new - c.unpaid;
        // Резервный канал: если SSE недоступен, сигнал по росту числа оплаченных новых заказов
        if (prevNew.current !== null && paidNew > prevNew.current && connectionRef.current !== 'online') {
          if (soundRef.current) playNewOrderChime();
          setVersion((v) => v + 1);
        }
        prevNew.current = paidNew;
      })
      .catch(() => {});
  }, []);

  const onEvent = useCallback(
    (e: OrderStreamEvent) => {
      setVersion((v) => v + 1);
      refreshCounts();
      if (e.type === 'order.paid') {
        if (soundRef.current) playNewOrderChime();
        setFresh((s) => new Set(s).add(e.orderId));
        setTimeout(() => setFresh((s) => {
          const next = new Set(s);
          next.delete(e.orderId);
          return next;
        }), 5 * 60_000);
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.hidden) {
          new Notification(`Новый заказ №${e.number}`, { body: 'Оплачен — откройте админ-панель' });
        }
      }
    },
    [refreshCounts],
  );

  const connection = useOrderStream(onEvent);
  const connectionRef = useRef(connection);
  connectionRef.current = connection;

  useEffect(() => {
    refreshCounts();
    const timer = setInterval(refreshCounts, 30_000);
    return () => clearInterval(timer);
  }, [refreshCounts]);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(SOUND_KEY) === 'on') {
        // Звук разблокируется первым кликом по странице
        const unlock = () => unlockAudio().then((ok) => ok && setSoundOn(true));
        window.addEventListener('pointerdown', unlock, { once: true });
        return () => window.removeEventListener('pointerdown', unlock);
      }
    } catch {
      /* localStorage недоступен */
    }
  }, []);

  useEffect(() => {
    const n = counts ? counts.new - counts.unpaid : 0;
    document.title = n > 0 ? `(${n}) Новые заказы · Админ-панель` : 'Админ-панель · Кондитерская';
  }, [counts]);

  const enableSound = useCallback(async () => {
    const ok = await unlockAudio();
    setSoundOn(ok && isAudioReady());
    if (ok) playNewOrderChime();
    try {
      window.localStorage.setItem(SOUND_KEY, 'on');
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') void Notification.requestPermission();
    } catch {
      /* ignore */
    }
  }, []);

  const disableSound = useCallback(() => {
    setSoundOn(false);
    try {
      window.localStorage.setItem(SOUND_KEY, 'off');
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <Ctx.Provider value={{ counts, version, connection, soundOn, enableSound, disableSound, fresh, refreshCounts }}>
      {children}
    </Ctx.Provider>
  );
}

export function useOrderEvents(): OrderEventsState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useOrderEvents вне OrderEventsProvider');
  return ctx;
}
