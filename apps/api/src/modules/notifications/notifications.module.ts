import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../config/configuration';
import { ExpoPushAdapter, LogPushAdapter, PUSH_ADAPTER, type PushAdapter } from './adapters/push-adapter';
import {
  LogStaffNotifier,
  STAFF_NOTIFIER,
  TelegramStaffNotifier,
  type StaffNotifier,
} from './adapters/staff-notifier';
import { NotificationsService } from './notifications.service';

@Module({
  providers: [
    {
      provide: PUSH_ADAPTER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>): PushAdapter =>
        config.get('providers', { infer: true }).push === 'expo'
          ? new ExpoPushAdapter(config.get('expo.accessToken', { infer: true }))
          : new LogPushAdapter(),
    },
    {
      provide: STAFF_NOTIFIER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>): StaffNotifier => {
        const tg = config.get('telegram', { infer: true });
        return tg.botToken && tg.chatId ? new TelegramStaffNotifier(tg.botToken, tg.chatId) : new LogStaffNotifier();
      },
    },
    NotificationsService,
  ],
})
export class NotificationsModule {}
