import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { join, resolve } from 'path';
import type { AppConfig } from '../../config/configuration';

const ALLOWED: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Проверка сигнатуры файла: Content-Type от клиента подделать легко */
function hasValidSignature(mime: string, buf: Buffer): boolean {
  if (mime === 'image/jpeg') return buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  if (mime === 'image/png') return buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mime === 'image/webp') return buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP';
  return false;
}

/**
 * Хранилище фотографий на локальном диске (каталог UPLOADS_DIR, URL /uploads/…).
 * Для продакшена реализацию можно заменить на S3-совместимое хранилище
 * (Yandex Object Storage, Selectel) — интерфейс save/remove останется тем же.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  readonly dir: string;

  constructor(config: ConfigService<AppConfig, true>) {
    this.dir = resolve(config.get('uploadsDir', { infer: true }));
  }

  async save(file: Express.Multer.File): Promise<string> {
    const ext = ALLOWED[file.mimetype];
    if (!ext) throw new BadRequestException('Поддерживаются только JPEG, PNG и WebP');
    if (file.size > MAX_UPLOAD_BYTES) throw new BadRequestException('Файл больше 10 МБ');
    if (!hasValidSignature(file.mimetype, file.buffer)) throw new BadRequestException('Файл повреждён или не является изображением');
    await mkdir(this.dir, { recursive: true });
    const name = `${randomUUID()}.${ext}`;
    await writeFile(join(this.dir, name), file.buffer);
    return `/uploads/${name}`;
  }

  async remove(url: string): Promise<void> {
    if (!url.startsWith('/uploads/')) return; // сид-картинки и внешние URL не трогаем
    const name = url.slice('/uploads/'.length);
    if (name.includes('/') || name.includes('..')) return;
    try {
      await unlink(join(this.dir, name));
    } catch (e) {
      this.logger.warn(`Не удалось удалить файл ${url}: ${e}`);
    }
  }
}
