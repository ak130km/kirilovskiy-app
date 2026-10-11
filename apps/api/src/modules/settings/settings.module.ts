import { Global, Module } from '@nestjs/common';
import { AdminSettingsController, StoreController } from './settings.controller';
import { SettingsService } from './settings.service';

@Global()
@Module({
  controllers: [StoreController, AdminSettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
