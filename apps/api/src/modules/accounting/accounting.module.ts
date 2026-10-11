import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../config/configuration';
import { AccountingController } from './accounting.controller';
import { AccountingService } from './accounting.service';
import { ACCOUNTING_ADAPTER, type AccountingAdapter } from './adapters/accounting-adapter';
import { NoopAccountingAdapter } from './adapters/noop-accounting.adapter';
import { OneCAccountingAdapter } from './adapters/onec-accounting.adapter';

@Module({
  controllers: [AccountingController],
  providers: [
    {
      provide: ACCOUNTING_ADAPTER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>): AccountingAdapter =>
        config.get('providers', { infer: true }).accounting === 'onec'
          ? new OneCAccountingAdapter(config.get('onec', { infer: true }))
          : new NoopAccountingAdapter(),
    },
    AccountingService,
  ],
})
export class AccountingModule {}
