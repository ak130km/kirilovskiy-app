import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { STAFF_ROLE_LABELS, STAFF_ROLES, type StaffRole } from '@kirilovskiy/shared';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import * as bcrypt from 'bcryptjs';
import type { AuthStaff } from '../../common/auth/auth.types';
import { ClientIp, CurrentStaff, Roles } from '../../common/auth/decorators';
import { StaffAuthGuard } from '../../common/auth/guards';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { toStaffDto } from '../auth/auth.service';

class CreateStaffDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'Некорректный email' })
  email: string;
  @IsString() @MinLength(2) @MaxLength(100) name: string;
  @IsIn(STAFF_ROLES) role: StaffRole;
  @IsString() @MinLength(8, { message: 'Пароль — минимум 8 символов' }) @MaxLength(200) password: string;
}

class UpdateStaffDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(100) name?: string;
  @IsOptional() @IsIn(STAFF_ROLES) role?: StaffRole;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() @MinLength(8, { message: 'Пароль — минимум 8 символов' }) @MaxLength(200) password?: string;
}

@ApiTags('Админка: сотрудники')
@ApiBearerAuth()
@UseGuards(StaffAuthGuard)
@Roles('ADMIN')
@Controller('admin/staff')
export class StaffController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @Roles('ADMIN', 'MANAGER')
  async list() {
    const rows = await this.prisma.staffUser.findMany({ orderBy: [{ isActive: 'desc' }, { name: 'asc' }] });
    return rows.map(toStaffDto);
  }

  @Post()
  async create(@Body() dto: CreateStaffDto, @CurrentStaff() staff: AuthStaff, @ClientIp() ip: string) {
    const created = await this.prisma.staffUser.create({
      data: { email: dto.email, name: dto.name, role: dto.role, passwordHash: await bcrypt.hash(dto.password, 10) },
    });
    await this.audit.log({
      staff,
      ip,
      action: 'staff.create',
      entityType: 'staff',
      entityId: created.id,
      summary: `Добавлен сотрудник ${created.name} (${STAFF_ROLE_LABELS[created.role]})`,
    });
    return toStaffDto(created);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStaffDto,
    @CurrentStaff() staff: AuthStaff,
    @ClientIp() ip: string,
  ) {
    const before = await this.prisma.staffUser.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Сотрудник не найден');
    if (id === staff.id && (dto.isActive === false || (dto.role && dto.role !== 'ADMIN'))) {
      throw new BadRequestException('Нельзя заблокировать себя или снять с себя роль администратора');
    }
    const { password, ...rest } = dto;
    const updated = await this.prisma.staffUser.update({
      where: { id },
      data: { ...rest, passwordHash: password ? await bcrypt.hash(password, 10) : undefined },
    });
    const changes = AuditService.diff(before, updated, ['name', 'role', 'isActive']) ?? {};
    await this.audit.log({
      staff,
      ip,
      action: 'staff.update',
      entityType: 'staff',
      entityId: id,
      summary: `Изменён сотрудник ${updated.name}${password ? ' (сменён пароль)' : ''}`,
      changes: Object.keys(changes).length ? changes : undefined,
    });
    return toStaffDto(updated);
  }
}
