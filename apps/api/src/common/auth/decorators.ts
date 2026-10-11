import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { StaffRole } from '@prisma/client';
import type { AppRequest } from './auth.types';

export const ROLES_KEY = 'staffRoles';

/** Ограничить доступ ролями сотрудников (по умолчанию — все роли) */
export const Roles = (...roles: StaffRole[]) => SetMetadata(ROLES_KEY, roles);

export const CurrentCustomer = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<AppRequest>().customer,
);

export const CurrentStaff = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<AppRequest>().staff,
);

/** IP клиента для журнала действий */
export const ClientIp = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest<AppRequest>();
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded) return forwarded.split(',')[0].trim();
  return req.ip ?? null;
});
