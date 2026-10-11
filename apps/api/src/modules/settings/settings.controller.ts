import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { StoreSettings } from '@kirilovskiy/shared';
import type { AuthStaff } from '../../common/auth/auth.types';
import { ClientIp, CurrentStaff, Roles } from '../../common/auth/decorators';
import { StaffAuthGuard } from '../../common/auth/guards';
import { AuditService } from '../audit/audit.service';
import { UpdateStoreSettingsDto } from './settings.dto';
import { SettingsService } from './settings.service';

@ApiTags('Магазин')
@Controller('store')
export class StoreController {
  constructor(private readonly settings: SettingsService) {}

  /** Публичная информация о магазине: адрес самовывоза, телефон, минимальная сумма */
  @Get()
  get(): Promise<StoreSettings> {
    return this.settings.getStore();
  }
}

@ApiTags('Админка: настройки')
@ApiBearerAuth()
@UseGuards(StaffAuthGuard)
@Controller('admin/settings')
export class AdminSettingsController {
  constructor(
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  get(): Promise<StoreSettings> {
    return this.settings.getStore();
  }

  @Patch()
  @Roles('ADMIN')
  async update(
    @Body() dto: UpdateStoreSettingsDto,
    @CurrentStaff() staff: AuthStaff,
    @ClientIp() ip: string,
  ): Promise<StoreSettings> {
    const { before, after } = await this.settings.updateStore(dto);
    await this.audit.log({
      staff,
      ip,
      action: 'settings.update',
      entityType: 'settings',
      entityId: 'store',
      summary: 'Изменены настройки магазина',
      changes: AuditService.diff(before, after, Object.keys(dto) as (keyof StoreSettings)[]),
    });
    return after;
  }
}
