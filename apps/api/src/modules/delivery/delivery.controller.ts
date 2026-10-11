import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { formatDateRu, formatRub, formatSlot } from '@kirilovskiy/shared';
import { Prisma } from '@prisma/client';
import type { AuthStaff } from '../../common/auth/auth.types';
import { ClientIp, CurrentStaff, Roles } from '../../common/auth/decorators';
import { StaffAuthGuard } from '../../common/auth/guards';
import { isValidIsoDate, toDbDate } from '../../common/utils/moscow-time';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  AvailabilityQueryDto,
  CreateBlackoutDateDto,
  CreateTimeSlotDto,
  CreateZoneDto,
  UpdateTimeSlotDto,
  UpdateZoneDto,
} from './delivery.dto';
import { DeliveryService, toAdminZoneDto, toTimeSlotDto } from './delivery.service';

@ApiTags('Доставка')
@Controller('delivery')
export class DeliveryController {
  constructor(private readonly delivery: DeliveryService) {}

  @Get('zones')
  zones() {
    return this.delivery.zones();
  }

  /** Даты и интервалы, доступные для заказа (по московскому времени) */
  @Get('availability')
  async availability(@Query() q: AvailabilityQueryDto) {
    const lead = await this.delivery.leadTimeHours(q.productIds);
    return this.delivery.availability(q.type, lead);
  }
}

const jsonOrNull = (v: unknown) =>
  v === undefined ? undefined : v === null ? Prisma.DbNull : (v as Prisma.InputJsonValue);

@ApiTags('Админка: доставка')
@ApiBearerAuth()
@UseGuards(StaffAuthGuard)
@Roles('ADMIN', 'MANAGER')
@Controller('admin')
export class AdminDeliveryController {
  constructor(
    private readonly delivery: DeliveryService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ─────────── Зоны ───────────

  @Get('delivery-zones')
  zones() {
    return this.delivery.adminZones();
  }

  @Post('delivery-zones')
  async createZone(@Body() dto: CreateZoneDto, @CurrentStaff() staff: AuthStaff, @ClientIp() ip: string) {
    const zone = await this.prisma.deliveryZone.create({ data: { ...dto, polygon: jsonOrNull(dto.polygon) } });
    await this.audit.log({
      staff,
      ip,
      action: 'zone.create',
      entityType: 'delivery_zone',
      entityId: zone.id,
      summary: `Создана зона доставки «${zone.name}» — ${formatRub(zone.price)}`,
    });
    return toAdminZoneDto(zone);
  }

  @Patch('delivery-zones/:id')
  async updateZone(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateZoneDto,
    @CurrentStaff() staff: AuthStaff,
    @ClientIp() ip: string,
  ) {
    const before = await this.prisma.deliveryZone.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Зона не найдена');
    const zone = await this.prisma.deliveryZone.update({
      where: { id },
      data: { ...dto, polygon: jsonOrNull(dto.polygon) },
    });
    await this.audit.log({
      staff,
      ip,
      action: 'zone.update',
      entityType: 'delivery_zone',
      entityId: id,
      summary: `Изменена зона доставки «${zone.name}»`,
      changes: AuditService.diff(before, zone, [
        'name', 'description', 'price', 'freeFromAmount', 'minOrderAmount', 'estimatedMinutes', 'isActive', 'sortOrder',
      ]),
    });
    return toAdminZoneDto(zone);
  }

  @Delete('delivery-zones/:id')
  @HttpCode(204)
  async deleteZone(@Param('id', ParseUUIDPipe) id: string, @CurrentStaff() staff: AuthStaff, @ClientIp() ip: string) {
    const zone = await this.prisma.deliveryZone.delete({ where: { id } });
    await this.audit.log({
      staff,
      ip,
      action: 'zone.delete',
      entityType: 'delivery_zone',
      entityId: id,
      summary: `Удалена зона доставки «${zone.name}»`,
    });
  }

  // ─────────── Интервалы ───────────

  @Get('time-slots')
  slots() {
    return this.delivery.adminSlots();
  }

  @Post('time-slots')
  async createSlot(@Body() dto: CreateTimeSlotDto, @CurrentStaff() staff: AuthStaff, @ClientIp() ip: string) {
    if (dto.endMinutes <= dto.startMinutes) throw new BadRequestException('Конец интервала должен быть позже начала');
    const slot = await this.prisma.timeSlot.create({ data: dto });
    await this.audit.log({
      staff,
      ip,
      action: 'slot.create',
      entityType: 'time_slot',
      entityId: slot.id,
      summary: `Создан интервал ${formatSlot(slot.startMinutes, slot.endMinutes)}`,
    });
    return toTimeSlotDto(slot);
  }

  @Patch('time-slots/:id')
  async updateSlot(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTimeSlotDto,
    @CurrentStaff() staff: AuthStaff,
    @ClientIp() ip: string,
  ) {
    const before = await this.prisma.timeSlot.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Интервал не найден');
    const start = dto.startMinutes ?? before.startMinutes;
    const end = dto.endMinutes ?? before.endMinutes;
    if (end <= start) throw new BadRequestException('Конец интервала должен быть позже начала');
    const slot = await this.prisma.timeSlot.update({ where: { id }, data: dto });
    await this.audit.log({
      staff,
      ip,
      action: 'slot.update',
      entityType: 'time_slot',
      entityId: id,
      summary: `Изменён интервал ${formatSlot(slot.startMinutes, slot.endMinutes)}`,
      changes: AuditService.diff(before, slot, [
        'fulfillmentType', 'startMinutes', 'endMinutes', 'weekdays', 'capacity', 'isActive', 'sortOrder',
      ]),
    });
    return toTimeSlotDto(slot);
  }

  @Delete('time-slots/:id')
  @HttpCode(204)
  async deleteSlot(@Param('id', ParseUUIDPipe) id: string, @CurrentStaff() staff: AuthStaff, @ClientIp() ip: string) {
    const slot = await this.prisma.timeSlot.delete({ where: { id } });
    await this.audit.log({
      staff,
      ip,
      action: 'slot.delete',
      entityType: 'time_slot',
      entityId: id,
      summary: `Удалён интервал ${formatSlot(slot.startMinutes, slot.endMinutes)}`,
    });
  }

  // ─────────── Нерабочие дни ───────────

  @Get('blackout-dates')
  blackoutDates() {
    return this.delivery.adminBlackoutDates();
  }

  @Post('blackout-dates')
  async createBlackout(@Body() dto: CreateBlackoutDateDto, @CurrentStaff() staff: AuthStaff, @ClientIp() ip: string) {
    if (!isValidIsoDate(dto.date)) throw new BadRequestException('Дата в формате ГГГГ-ММ-ДД');
    const row = await this.prisma.blackoutDate.create({
      data: { date: toDbDate(dto.date), reason: dto.reason ?? null },
    });
    await this.audit.log({
      staff,
      ip,
      action: 'blackout.create',
      entityType: 'blackout_date',
      entityId: row.id,
      summary: `Нерабочий день: ${formatDateRu(dto.date)}${dto.reason ? ` (${dto.reason})` : ''}`,
    });
    return { id: row.id, date: dto.date, reason: row.reason };
  }

  @Delete('blackout-dates/:id')
  @HttpCode(204)
  async deleteBlackout(@Param('id', ParseUUIDPipe) id: string, @CurrentStaff() staff: AuthStaff, @ClientIp() ip: string) {
    const row = await this.prisma.blackoutDate.delete({ where: { id } });
    await this.audit.log({
      staff,
      ip,
      action: 'blackout.delete',
      entityType: 'blackout_date',
      entityId: id,
      summary: `Снят нерабочий день ${formatDateRu(row.date.toISOString())}`,
    });
  }
}
