import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { join, resolve } from 'path';
import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import type { AppConfig } from './config/configuration';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService<AppConfig, true>);
  const logger = new Logger('Bootstrap');

  app.set('trust proxy', 1);
  app.use(
    helmet({
      // Страница тестовой оплаты и Swagger используют inline-стили; API отдаёт JSON
      contentSecurityPolicy: false,
      // Фото товаров загружаются админкой и приложением с других origin
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  const origins = config.get('corsOrigins', { infer: true });
  app.enableCors({
    origin: origins.length ? origins : true,
    credentials: false,
    exposedHeaders: ['Content-Disposition'],
  });

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new PrismaExceptionFilter());
  app.enableShutdownHooks();

  // Статика: иллюстрации для демо-данных и загруженные фото
  app.useStaticAssets(join(__dirname, '..', 'public'), { prefix: '/static', maxAge: '7d' });
  app.useStaticAssets(resolve(config.get('uploadsDir', { infer: true })), { prefix: '/uploads', maxAge: '30d' });

  const swagger = new DocumentBuilder()
    .setTitle('Кондитерская Артёма Кирилловского — API')
    .setDescription('REST API мобильного приложения и админ-панели. Суммы — в копейках, время — Europe/Moscow.')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swagger));

  const port = config.get('port', { infer: true });
  await app.listen(port, '0.0.0.0');
  logger.log(`API: http://localhost:${port}/api/v1 · Swagger: http://localhost:${port}/api/docs`);
  const providers = config.get('providers', { infer: true });
  logger.log(
    `Адаптеры: оплата=${providers.payment}, курьер=${providers.courier}, 1С=${providers.accounting}, push=${providers.push}`,
  );
}

void bootstrap();
