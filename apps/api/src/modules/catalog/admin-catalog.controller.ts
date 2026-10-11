import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { AuthStaff } from '../../common/auth/auth.types';
import { ClientIp, CurrentStaff, Roles } from '../../common/auth/decorators';
import { StaffAuthGuard } from '../../common/auth/guards';
import { MAX_UPLOAD_BYTES } from '../uploads/storage.service';
import {
  AdminProductsQueryDto,
  CreateCategoryDto,
  CreateProductDto,
  ReorderImagesDto,
  StopListDto,
  UpdateCategoryDto,
  UpdateProductDto,
} from './admin-catalog.dto';
import { AdminCatalogService } from './admin-catalog.service';

@ApiTags('Админка: категории')
@ApiBearerAuth()
@UseGuards(StaffAuthGuard)
@Roles('ADMIN', 'MANAGER')
@Controller('admin/categories')
export class AdminCategoriesController {
  constructor(private readonly service: AdminCatalogService) {}

  @Get()
  @Roles('ADMIN', 'MANAGER', 'OPERATOR')
  list() {
    return this.service.listCategories();
  }

  @Post()
  create(@Body() dto: CreateCategoryDto, @CurrentStaff() staff: AuthStaff, @ClientIp() ip: string) {
    return this.service.createCategory(dto, { staff, ip });
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
    @CurrentStaff() staff: AuthStaff,
    @ClientIp() ip: string,
  ) {
    return this.service.updateCategory(id, dto, { staff, ip });
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentStaff() staff: AuthStaff, @ClientIp() ip: string) {
    return this.service.deleteCategory(id, { staff, ip });
  }
}

@ApiTags('Админка: товары')
@ApiBearerAuth()
@UseGuards(StaffAuthGuard)
@Roles('ADMIN', 'MANAGER')
@Controller('admin')
export class AdminProductsController {
  constructor(private readonly service: AdminCatalogService) {}

  @Get('allergens')
  @Roles('ADMIN', 'MANAGER', 'OPERATOR')
  allergens() {
    return this.service.listAllergens();
  }

  @Get('products')
  @Roles('ADMIN', 'MANAGER', 'OPERATOR')
  list(@Query() q: AdminProductsQueryDto) {
    return this.service.listProducts(q);
  }

  @Get('products/:id')
  @Roles('ADMIN', 'MANAGER', 'OPERATOR')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getProduct(id);
  }

  @Post('products')
  create(@Body() dto: CreateProductDto, @CurrentStaff() staff: AuthStaff, @ClientIp() ip: string) {
    return this.service.createProduct(dto, { staff, ip });
  }

  @Patch('products/:id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
    @CurrentStaff() staff: AuthStaff,
    @ClientIp() ip: string,
  ) {
    return this.service.updateProduct(id, dto, { staff, ip });
  }

  /** Перенос в архив (мягкое удаление) */
  @Delete('products/:id')
  @HttpCode(204)
  archive(@Param('id', ParseUUIDPipe) id: string, @CurrentStaff() staff: AuthStaff, @ClientIp() ip: string) {
    return this.service.archiveProduct(id, { staff, ip });
  }

  @Post('products/:id/restore')
  restore(@Param('id', ParseUUIDPipe) id: string, @CurrentStaff() staff: AuthStaff, @ClientIp() ip: string) {
    return this.service.restoreProduct(id, { staff, ip });
  }

  /** Стоп-лист доступен всем сотрудникам, включая операторов */
  @Patch('products/:id/stop-list')
  @Roles('ADMIN', 'MANAGER', 'OPERATOR')
  stopList(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StopListDto,
    @CurrentStaff() staff: AuthStaff,
    @ClientIp() ip: string,
  ) {
    return this.service.setStopList(id, dto, { staff, ip });
  }

  @Post('products/:id/images')
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  addImage(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentStaff() staff: AuthStaff,
    @ClientIp() ip: string,
  ) {
    return this.service.addImage(id, file, { staff, ip });
  }

  @Delete('products/:id/images/:imageId')
  removeImage(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
    @CurrentStaff() staff: AuthStaff,
    @ClientIp() ip: string,
  ) {
    return this.service.removeImage(id, imageId, { staff, ip });
  }

  @Patch('products/:id/images/order')
  reorderImages(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReorderImagesDto) {
    return this.service.reorderImages(id, dto.imageIds);
  }
}
