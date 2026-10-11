import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/** Журнал обращений к внешним системам: банк, курьерская служба, 1С */
@Injectable()
export class IntegrationLogService {
  private readonly logger = new Logger('Integrations');

  constructor(private readonly prisma: PrismaService) {}

  /** Выполняет вызов адаптера и записывает результат в integration_logs */
  async track<T>(
    meta: { provider: string; operation: string; orderId?: string | null; request?: unknown },
    fn: () => Promise<T>,
  ): Promise<T> {
    const started = Date.now();
    try {
      const result = await fn();
      await this.write(meta, true, result, null, Date.now() - started);
      return result;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      this.logger.warn(`${meta.provider}.${meta.operation} — ошибка: ${message}`);
      await this.write(meta, false, null, message, Date.now() - started);
      throw e;
    }
  }

  private async write(
    meta: { provider: string; operation: string; orderId?: string | null; request?: unknown },
    success: boolean,
    response: unknown,
    error: string | null,
    durationMs: number,
  ) {
    try {
      await this.prisma.integrationLog.create({
        data: {
          provider: meta.provider,
          operation: meta.operation,
          orderId: meta.orderId ?? null,
          success,
          request: toJson(meta.request),
          response: toJson(response),
          error,
          durationMs,
        },
      });
    } catch (e) {
      this.logger.error(`Не удалось записать integration_log: ${e}`);
    }
  }
}

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  try {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  } catch {
    return String(value);
  }
}
