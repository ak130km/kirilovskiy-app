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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, PartialType } from '@nestjs/swagger';
import { PROMO_CODE_TYPES, type PromoCodeDto, type PromoCodeType } from '@kirilovskiy/shared';
import { Transform } from 'class-transformer';
import { IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';
import type { PromoCode } from '@prisma/client';
import type { AuthStaff } from '../../common/auth/auth.types';
import { ClientIp, CurrentStaff, Roles } from '../../common/auth/decorators';
import { StaffAuthGuard } from '../../common/auth/guards';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

class CreatePromoCodeDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @Matches(/^[A-Z0-9А-ЯЁ_-]{3,32}$/, { message: 'Код: 3–32 символа, буквы, цифры, дефис' })
  code: string;
  @IsOptional() @IsString() @MaxLength(300) description?: string | null;
  @IsIn(PROMO_CODE_TYPES) type: PromoCodeType;
  /** Процент (1–100) или сумма в копейках */
  @IsInt() @Min(1) value: number;
  @IsOptional() @IsInt() @Min(0) minOrderAmount?: number;
  @IsOptional() @IsInt() @Min(0) maxDiscountAmount?: number | null;
  @IsOptional() @IsDateString() startsAt?: string | null;
  @IsOptional() @IsDateString() endsAt?: string | null;
  @IsOptional() @IsInt() @Min(1) usageLimit?: number | null;
  @IsOptional() @IsInt() @Min(1) usageLimitPerCustomer?: number | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
class UpdatePromoCodeDto extends PartialType(CreatePromoCodeDto) {}

function toDto(p: PromoCode): PromoCodeDto {
  return {
    id: p.id,
    code: p.code,
    description: p.description,
    type: p.type,
    value: p.value,
    minOrderAmount: p.minOrderAmount,
    maxDiscountAmount: p.maxDiscountAmount,
    startsAt: p.startsAt?.toISOString() ?? null,
    endsAt: p.endsAt?.toISOString() ?? null,
    usageLimit: p.usageLimit,
    usageLimitPerCustomer: p.usageLimitPerCustomer,
    usedCount: p.usedCount,
    isActive: p.isActive,
    createdAt: p.createdAt.toISOString(),
  };
}

function validate(dto: Partial<CreatePromoCodeDto>) {
  if (dto.type === 'PERCENT' && dto.value !== undefined && dto.value > 100) {
    throw new BadRequestException('Процент скидки — от 1 до 100');
  }
  if (dto.startsAt && dto.endsAt && new Date(dto.startsAt) > new Date(dto.endsAt)) {
    throw new BadRequestException('Дата окончания раньше даты начала');
  }
}

const dates = (dto: Partial<CreatePromoCodeDto>) => ({
  startsAt: dto.startsAt === undefined ? undefined : dto.startsAt ? new Date(dto.startsAt) : null,
  endsAt: dto.endsAt === undefined ? undefined : dto.endsAt ? new Date(dto.endsAt) : null,
});

@ApiTags('Админка: промокоды')
@ApiBearerAuth()
@UseGuards(StaffAuthGuard)
@Roles('ADMIN', 'MANAGER')
@Controller('admin/promo-codes')
export class AdminPromoController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  async list(): Promise<PromoCodeDto[]> {
    const rows = await this.prisma.promoCode.findMany({ orderBy: { createdAt: 'desc' } });
    return rows.map(toDto);
  }

  @Post()
  async create(@Body() dto: CreatePromoCodeDto, @CurrentStaff() staff: AuthStaff, @ClientIp() ip: string) {
    validate(dto);
    const promo = await this.prisma.promoCode.create({ data: { ...dto, ...dates(dto) } });
    await this.audit.log({
      staff,
      ip,
      action: 'promo.create',
      entityType: 'promo_code',
      entityId: promo.id,
      summary: `Создан промокод ${promo.code}`,
    });
    return toDto(promo);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePromoCodeDto,
    @CurrentStaff() staff: AuthStaff,
    @ClientIp() ip: string,
  ) {
    const before = await this.prisma.promoCode.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Промокод не найден');
    validate({ type: before.type, ...dto });
    const promo = await this.prisma.promoCode.update({ where: { id }, data: { ...dto, ...dates(dto) } });
    await this.audit.log({
      staff,
      ip,
      action: 'promo.update',
      entityType: 'promo_code',
      entityId: id,
      summary: `Изменён промокод ${promo.code}`,
      changes: AuditService.diff(before, promo, [
        'code', 'description', 'type', 'value', 'minOrderAmount', 'maxDiscountAmount', 'startsAt', 'endsAt',
        'usageLimit', 'usageLimitPerCustomer', 'isActive',
      ]),
    });
    return toDto(promo);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentStaff() staff: AuthStaff, @ClientIp() ip: string) {
    const promo = await this.prisma.promoCode.findUnique({
      where: { id },
      include: { _count: { select: { orders: true } } },
    });
    if (!promo) throw new NotFoundException('Промокод не найден');
    if (promo._count.orders > 0) {
      // Промокод уже есть в заказах — отключаем, чтобы сохранить историю
      await this.prisma.promoCode.update({ where: { id }, data: { isActive: false } });
    } else {
      await this.prisma.promoCode.delete({ where: { id } });
    }
    await this.audit.log({
      staff,
      ip,
      action: 'promo.delete',
      entityType: 'promo_code',
      entityId: id,
      summary: promo._count.orders > 0 ? `Промокод ${promo.code} отключён` : `Удалён промокод ${promo.code}`,
    });
  }
}
