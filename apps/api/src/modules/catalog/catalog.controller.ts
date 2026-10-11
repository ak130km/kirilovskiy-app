import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { CatalogService } from './catalog.service';

class ProductsQueryDto {
  /** slug категории */
  @IsOptional() @IsString() category?: string;
  /** только «Популярное» */
  @IsOptional() @Transform(({ value }) => value === 'true' || value === true) @IsBoolean() featured?: boolean;
  @IsOptional() @IsString() @MaxLength(100) search?: string;
}

@ApiTags('Каталог')
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('categories')
  categories() {
    return this.catalog.categories();
  }

  @Get('products')
  products(@Query() q: ProductsQueryDto) {
    return this.catalog.products(q);
  }

  /** Карточка товара по id или slug */
  @Get('products/:idOrSlug')
  product(@Param('idOrSlug') idOrSlug: string) {
    return this.catalog.product(idOrSlug);
  }
}
