import { Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthStaff } from '../../common/auth/auth.types';
import { ClientIp, CurrentStaff, Roles } from '../../common/auth/decorators';
import { StaffAuthGuard } from '../../common/auth/guards';
import { AccountingService } from './accounting.service';

@ApiTags('Админка: интеграции')
@ApiBearerAuth()
@UseGuards(StaffAuthGuard)
@Roles('ADMIN')
@Controller('admin/integrations/1c')
export class AccountingController {
  constructor(private readonly accounting: AccountingService) {}

  /** Загрузить цены и наличие из 1С:УНФ */
  @Post('sync-catalog')
  @HttpCode(200)
  sync(@CurrentStaff() staff: AuthStaff, @ClientIp() ip: string) {
    return this.accounting.syncCatalog(staff, ip);
  }
}
