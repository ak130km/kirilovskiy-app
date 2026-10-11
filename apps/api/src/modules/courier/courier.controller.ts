import { Controller, HttpCode, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthStaff } from '../../common/auth/auth.types';
import { ClientIp, CurrentStaff } from '../../common/auth/decorators';
import { StaffAuthGuard } from '../../common/auth/guards';
import { CourierService } from './courier.service';

@ApiTags('Админка: курьер')
@ApiBearerAuth()
@UseGuards(StaffAuthGuard)
@Controller('admin/orders/:id/courier')
export class CourierController {
  constructor(private readonly courier: CourierService) {}

  /** Вызвать курьера (Яндекс Доставка или тестовый эмулятор) */
  @Post()
  @HttpCode(200)
  request(@Param('id', ParseUUIDPipe) id: string, @CurrentStaff() staff: AuthStaff, @ClientIp() ip: string) {
    return this.courier.request(id, staff, ip);
  }

  @Post('refresh')
  @HttpCode(200)
  refresh(@Param('id', ParseUUIDPipe) id: string) {
    return this.courier.refresh(id);
  }
}
