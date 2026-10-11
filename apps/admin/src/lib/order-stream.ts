'use client';

import type { OrderStreamEvent } from '@kirilovskiy/shared';
import { useEffect, useRef, useState } from 'react';
import { getToken } from './api';
import { API_URL } from './config';

/**
 * Подписка на события заказов (SSE). EventSource сам переподключается при обрыве.
 * Возвращает состояние соединения для индикатора в шапке.
 */
export function useOrderStream(onEvent: (e: OrderStreamEvent) => void): 'connecting' | 'online' | 'offline' {
  const [state, setState] = useState<'connecting' | 'online' | 'offline'>('connecting');
  const handler = useRef(onEvent);
  handler.current = onEvent;

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    const es = new EventSource(`${API_URL}/api/v1/admin/orders/stream?access_token=${encodeURIComponent(token)}`);
    es.onopen = () => setState('online');
    es.onerror = () => setState(es.readyState === EventSource.CLOSED ? 'offline' : 'connecting');
    es.addEventListener('order', (msg) => {
      try {
        handler.current(JSON.parse((msg as MessageEvent).data) as OrderStreamEvent);
      } catch {
        /* битое событие */
      }
    });
    return () => es.close();
  }, []);

  return state;
}
