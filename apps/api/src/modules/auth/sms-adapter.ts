import { Logger } from '@nestjs/common';

export const SMS_ADAPTER = Symbol('SMS_ADAPTER');

/** Отправка SMS с кодом входа. В MVP — только журнал; провайдер (SMS.ru, SMSC, МТС Exolve) подключается на этапе 5. */
export interface SmsAdapter {
  readonly provider: string;
  /** true — код не уходит наружу и можно вернуть его в ответе для разработки */
  readonly isDevelopment: boolean;
  send(phone: string, text: string): Promise<void>;
}

export class LogSmsAdapter implements SmsAdapter {
  readonly provider = 'log';
  readonly isDevelopment = true;
  private readonly logger = new Logger('SMS');

  async send(phone: string, text: string) {
    this.logger.log(`SMS на ${phone}: ${text}`);
  }
}
