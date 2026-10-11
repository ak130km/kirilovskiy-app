import { Controller, Get, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AppConfig } from '../../config/configuration';
import { Roles } from '../../common/auth/decorators';
import { StaffAuthGuard } from '../../common/auth/guards';
import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('Админка: интеграции')
@ApiBearerAuth()
@UseGuards(StaffAuthGuard)
@Roles('ADMIN', 'MANAGER')
@Controller('admin/integrations')
export class IntegrationsController {
  constructor(
    private readonly config: ConfigService<AppConfig, true>,
    private readonly prisma: PrismaService,
  ) {}

  /** Какие адаптеры включены (без секретов) */
  @Get()
  status() {
    const providers = this.config.get('providers', { infer: true });
    const tg = this.config.get('telegram', { infer: true });
    return {
      payment: providers.payment,
      courier: providers.courier,
      accounting: providers.accounting,
      push: providers.push,
      sms: providers.sms,
      telegram: tg.botToken && tg.chatId ? 'telegram' : 'log',
    };
  }

  /** Последние обращения к внешним системам */
  @Get('logs')
  logs() {
    return this.prisma.integrationLog.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  }
}
