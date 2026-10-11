import { Module } from '@nestjs/common';
import { AdminCategoriesController, AdminProductsController } from './admin-catalog.controller';
import { AdminCatalogService } from './admin-catalog.service';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';

@Module({
  controllers: [CatalogController, AdminCategoriesController, AdminProductsController],
  providers: [CatalogService, AdminCatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
