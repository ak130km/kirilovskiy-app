import { Module } from '@nestjs/common';
import { CustomerAuthController, StaffAuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LogSmsAdapter, SMS_ADAPTER } from './sms-adapter';

@Module({
  controllers: [CustomerAuthController, StaffAuthController],
  providers: [AuthService, { provide: SMS_ADAPTER, useClass: LogSmsAdapter }],
  exports: [AuthService],
})
export class AuthModule {}
