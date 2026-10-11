import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  CustomerAuthResponse,
  CustomerDto,
  OtpRequestResponse,
  StaffAuthResponse,
  StaffDto,
} from '@kirilovskiy/shared';
import { normalizePhone } from '@kirilovskiy/shared';
import type { Customer, StaffUser } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import type { AppConfig } from '../../config/configuration';
import { TokenService } from '../../common/auth/token.service';
import { randomDigits, safeEqual, sha256 } from '../../common/utils/crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SMS_ADAPTER, type SmsAdapter } from './sms-adapter';

const CODE_TTL_MS = 5 * 60 * 1000;
const RESEND_AFTER_S = 60;
const MAX_ATTEMPTS = 5;
const MAX_CODES_PER_HOUR = 5;

export function toCustomerDto(c: Customer): CustomerDto {
  return { id: c.id, phone: c.phone, name: c.name, email: c.email, createdAt: c.createdAt.toISOString() };
}

export function toStaffDto(s: StaffUser): StaffDto {
  return {
    id: s.id,
    email: s.email,
    name: s.name,
    role: s.role,
    isActive: s.isActive,
    lastLoginAt: s.lastLoginAt?.toISOString() ?? null,
    createdAt: s.createdAt.toISOString(),
  };
}

@Injectable()
export class AuthService {
  private readonly codeSecret: string;
  private readonly isProd: boolean;
  private readonly dummyHash = bcrypt.hashSync('timing-safe-dummy', 10);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
    @Inject(SMS_ADAPTER) private readonly sms: SmsAdapter,
    config: ConfigService<AppConfig, true>,
  ) {
    this.codeSecret = config.get('jwt.customerSecret', { infer: true });
    this.isProd = config.get('nodeEnv', { infer: true }) === 'production';
  }

  private hashCode(phone: string, code: string) {
    return sha256(`${phone}:${code}:${this.codeSecret}`);
  }

  private phoneOrThrow(raw: string): string {
    const phone = normalizePhone(raw);
    if (!phone) throw new BadRequestException('Укажите российский мобильный номер');
    return phone;
  }

  async requestOtp(rawPhone: string): Promise<OtpRequestResponse> {
    const phone = this.phoneOrThrow(rawPhone);
    const last = await this.prisma.authCode.findFirst({ where: { phone }, orderBy: { createdAt: 'desc' } });
    if (last) {
      const wait = RESEND_AFTER_S - Math.floor((Date.now() - last.createdAt.getTime()) / 1000);
      if (wait > 0) {
        throw new HttpException(
          { statusCode: 429, message: `Повторно отправить код можно через ${wait} с`, retryAfterSeconds: wait },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }
    const lastHour = await this.prisma.authCode.count({
      where: { phone, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
    });
    if (lastHour >= MAX_CODES_PER_HOUR) {
      throw new HttpException('Слишком много попыток. Попробуйте через час.', HttpStatus.TOO_MANY_REQUESTS);
    }

    const code = randomDigits(4);
    await this.prisma.authCode.create({
      data: { phone, codeHash: this.hashCode(phone, code), expiresAt: new Date(Date.now() + CODE_TTL_MS) },
    });
    await this.sms.send(phone, `Код для входа в приложение кондитерской: ${code}`);
    return {
      sent: true,
      retryAfterSeconds: RESEND_AFTER_S,
      // Пока SMS-провайдер не подключён, код возвращается в ответе (кроме production)
      devCode: this.sms.isDevelopment && !this.isProd ? code : undefined,
    };
  }

  async verifyOtp(rawPhone: string, code: string): Promise<CustomerAuthResponse> {
    const phone = this.phoneOrThrow(rawPhone);
    const record = await this.prisma.authCode.findFirst({
      where: { phone, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!record) throw new UnauthorizedException('Код устарел. Запросите новый.');
    if (record.attempts >= MAX_ATTEMPTS) throw new UnauthorizedException('Слишком много попыток. Запросите новый код.');

    if (!safeEqual(record.codeHash, this.hashCode(phone, code))) {
      await this.prisma.authCode.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
      throw new UnauthorizedException('Неверный код');
    }
    await this.prisma.authCode.update({ where: { id: record.id }, data: { consumedAt: new Date() } });

    const customer = await this.prisma.customer.upsert({
      where: { phone },
      create: { phone, lastLoginAt: new Date() },
      update: { lastLoginAt: new Date() },
    });
    return { accessToken: this.tokens.signCustomer(customer.id), customer: toCustomerDto(customer) };
  }

  async staffLogin(email: string, password: string, ip?: string): Promise<StaffAuthResponse> {
    const staff = await this.prisma.staffUser.findUnique({ where: { email } });
    // Сравниваем хэш даже для несуществующего email, чтобы время ответа не выдавало наличие учётки
    const ok = await bcrypt.compare(password, staff?.passwordHash ?? this.dummyHash);
    if (!staff || !ok) throw new UnauthorizedException('Неверный email или пароль');
    if (!staff.isActive) throw new UnauthorizedException('Учётная запись заблокирована');

    const updated = await this.prisma.staffUser.update({ where: { id: staff.id }, data: { lastLoginAt: new Date() } });
    await this.audit.log({
      staff: { id: staff.id, name: staff.name, email: staff.email, role: staff.role },
      ip,
      action: 'staff.login',
      entityType: 'staff',
      entityId: staff.id,
      summary: `Вход в админ-панель: ${staff.name}`,
    });
    return { accessToken: this.tokens.signStaff(staff.id, staff.role), staff: toStaffDto(updated) };
  }

  async staffMe(id: string): Promise<StaffDto> {
    const staff = await this.prisma.staffUser.findUniqueOrThrow({ where: { id } });
    return toStaffDto(staff);
  }
}
