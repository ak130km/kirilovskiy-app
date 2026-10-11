import { Logger } from '@nestjs/common';
import { httpJson } from '../../integrations/http';

export const STAFF_NOTIFIER = Symbol('STAFF_NOTIFIER');

/** Уведомления сотрудникам (новый заказ, отмена). Реализации: log и telegram. */
export interface StaffNotifier {
  readonly provider: string;
  /** Текст в формате HTML Telegram (<b>, <i>, <a>) */
  notify(html: string): Promise<void>;
}

export class LogStaffNotifier implements StaffNotifier {
  readonly provider = 'log';
  private readonly logger = new Logger('StaffNotifier');

  async notify(html: string) {
    this.logger.log(html.replace(/<[^>]+>/g, ''));
  }
}

export class TelegramStaffNotifier implements StaffNotifier {
  readonly provider = 'telegram';

  constructor(
    private readonly botToken: string,
    private readonly chatId: string,
  ) {}

  async notify(html: string) {
    await httpJson(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: this.chatId, text: html, parse_mode: 'HTML', disable_web_page_preview: true }),
    });
  }
}
