import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { StaffRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { AppRequest } from './auth.types';
import { ROLES_KEY } from './decorators';
import { extractBearer, TokenService } from './token.service';

/** Обязательная авторизация клиента */
@Injectable()
export class CustomerAuthGuard implements CanActivate {
  constructor(
    private readonly tokens: TokenService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AppRequest>();
    const token = extractBearer(req.headers.authorization);
    const payload = token ? this.tokens.verifyCustomer(token) : null;
    if (!payload) throw new UnauthorizedException('Требуется вход в аккаунт');
    const exists = await this.prisma.customer.count({ where: { id: payload.sub } });
    if (!exists) throw new UnauthorizedException('Аккаунт не найден');
    req.customer = { id: payload.sub };
    return true;
  }
}

/** Необязательная авторизация клиента: гость проходит без токена */
@Injectable()
export class OptionalCustomerAuthGuard implements CanActivate {
  constructor(private readonly tokens: TokenService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<AppRequest>();
    const token = extractBearer(req.headers.authorization);
    const payload = token ? this.tokens.verifyCustomer(token) : null;
    if (payload) req.customer = { id: payload.sub };
    return true;
  }
}

/** Авторизация сотрудника + проверка ролей из @Roles() */
@Injectable()
export class StaffAuthGuard implements CanActivate {
  constructor(
    private readonly tokens: TokenService,
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AppRequest>();
    // EventSource не умеет передавать заголовки — для SSE токен приходит в query
    const queryToken = typeof req.query?.access_token === 'string' ? req.query.access_token : null;
    const token = extractBearer(req.headers.authorization) ?? queryToken;
    const payload = token ? this.tokens.verifyStaff(token) : null;
    if (!payload) throw new UnauthorizedException('Требуется вход сотрудника');

    const staff = await this.prisma.staffUser.findUnique({ where: { id: payload.sub } });
    if (!staff || !staff.isActive) throw new UnauthorizedException('Сотрудник заблокирован');

    const roles = this.reflector.getAllAndOverride<StaffRole[] | undefined>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (roles?.length && !roles.includes(staff.role)) {
      throw new ForbiddenException('Недостаточно прав');
    }
    req.staff = { id: staff.id, name: staff.name, email: staff.email, role: staff.role };
    return true;
  }
}
