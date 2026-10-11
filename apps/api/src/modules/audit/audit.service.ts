import { Injectable, Logger } from '@nestjs/common';
import type { AuditLogDto, Paginated } from '@kirilovskiy/shared';
import { Prisma } from '@prisma/client';
import type { AuthStaff } from '../../common/auth/auth.types';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuditEntry {
  staff?: AuthStaff | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  changes?: unknown;
  ip?: string | null;
}

export interface AuditQuery {
  page?: number;
  pageSize?: number;
  staffId?: string;
  entityType?: string;
  entityId?: string;
  search?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Записывает действие сотрудника. Ошибка записи журнала не должна ломать само действие. */
  async log(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          staffUserId: entry.staff?.id ?? null,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId ?? null,
          summary: entry.summary,
          changes: (entry.changes ?? undefined) as Prisma.InputJsonValue | undefined,
          ip: entry.ip ?? null,
        },
      });
    } catch (e) {
      this.logger.error(`Не удалось записать журнал действий: ${e}`);
    }
  }

  async list(q: AuditQuery): Promise<Paginated<AuditLogDto>> {
    const page = Math.max(1, q.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, q.pageSize ?? 50));
    const where: Prisma.AuditLogWhereInput = {
      staffUserId: q.staffId || undefined,
      entityType: q.entityType || undefined,
      entityId: q.entityId || undefined,
      summary: q.search ? { contains: q.search, mode: 'insensitive' } : undefined,
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        include: { staffUser: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return {
      total,
      page,
      pageSize,
      items: rows.map((r) => ({
        id: r.id,
        action: r.action,
        entityType: r.entityType,
        entityId: r.entityId,
        summary: r.summary,
        changes: r.changes,
        ip: r.ip,
        createdAt: r.createdAt.toISOString(),
        staff: r.staffUser,
      })),
    };
  }

  /** Разница «было → стало» по указанным полям */
  static diff<T extends object>(
    before: T,
    after: T,
    fields: (keyof T)[],
  ): Record<string, { from: unknown; to: unknown }> | undefined {
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    for (const field of fields) {
      const from = before[field] instanceof Date ? (before[field] as Date).toISOString() : before[field];
      const to = after[field] instanceof Date ? (after[field] as Date).toISOString() : after[field];
      if (JSON.stringify(from) !== JSON.stringify(to)) {
        changes[String(field)] = { from: from ?? null, to: to ?? null };
      }
    }
    return Object.keys(changes).length ? changes : undefined;
  }
}
