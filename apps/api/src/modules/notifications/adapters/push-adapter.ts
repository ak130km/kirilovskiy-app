import { Logger } from '@nestjs/common';
import { httpJson } from '../../integrations/http';

export const PUSH_ADAPTER = Symbol('PUSH_ADAPTER');

export interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface PushResult {
  token: string;
  ok: boolean;
  error?: string;
  /** Токен больше не действителен — удалить из БД */
  invalidToken?: boolean;
}

export interface PushAdapter {
  readonly provider: string;
  send(messages: PushMessage[]): Promise<PushResult[]>;
}

/** Для разработки: уведомления только пишутся в лог */
export class LogPushAdapter implements PushAdapter {
  readonly provider = 'log';
  private readonly logger = new Logger('Push');

  async send(messages: PushMessage[]): Promise<PushResult[]> {
    for (const m of messages) this.logger.log(`→ ${m.to.slice(0, 30)}…: ${m.title} — ${m.body}`);
    return messages.map((m) => ({ token: m.to, ok: true }));
  }
}

interface ExpoTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

/** Expo Push Notifications: https://exp.host/--/api/v2/push/send (пачками до 100 сообщений) */
export class ExpoPushAdapter implements PushAdapter {
  readonly provider = 'expo';

  constructor(private readonly accessToken: string) {}

  async send(messages: PushMessage[]): Promise<PushResult[]> {
    const results: PushResult[] = [];
    for (let i = 0; i < messages.length; i += 100) {
      const chunk = messages.slice(i, i + 100);
      const res = await httpJson<{ data: ExpoTicket[] }>('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {}),
        },
        body: JSON.stringify(
          chunk.map((m) => ({ ...m, sound: 'default', priority: 'high', channelId: 'orders' })),
        ),
      });
      chunk.forEach((m, idx) => {
        const ticket = res.data?.[idx];
        results.push({
          token: m.to,
          ok: ticket?.status === 'ok',
          error: ticket?.status === 'error' ? ticket.message : undefined,
          invalidToken: ticket?.details?.error === 'DeviceNotRegistered',
        });
      });
    }
    return results;
  }
}
