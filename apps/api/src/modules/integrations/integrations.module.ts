import { Global, Module } from '@nestjs/common';
import { IntegrationLogService } from './integration-log.service';
import { IntegrationsController } from './integrations.controller';

@Global()
@Module({
  controllers: [IntegrationsController],
  providers: [IntegrationLogService],
  exports: [IntegrationLogService],
})
export class IntegrationsModule {}
