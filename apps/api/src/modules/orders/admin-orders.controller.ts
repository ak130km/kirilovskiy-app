import {
  Body,
  Controller,
  Get,
  HttpCode,
  MessageEvent,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { interval, map, merge, Observable } from 'rxjs';
import type { AuthStaff } from '../../common/auth/auth.types';
import { ClientIp, CurrentStaff } from '../../common/auth/decorators';
import { StaffAuthGuard } from '../../common/auth/guards';
import { OrderStreamService } from './order-stream.service';
import { AdminOrdersQueryDto, CancelOrderDto, ChangeStatusDto } from './orders.dto';
import { OrdersService } from './orders.service';

@ApiTags('Админка: заказы')
@ApiBearerAuth()
@UseGuards(StaffAuthGuard)
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly stream: OrderStreamService,
  ) {}

  @Get()
  list(@Query() q: AdminOrdersQueryDto) {
    return this.orders.adminList(q);
  }

  /** Счётчики для вкладок: новые, в работе, готовы, не оплачены */
  @Get('counts')
  counts() {
    return this.orders.adminCounts();
  }

  /**
   * Поток событий (SSE) для звукового уведомления о новых заказах.
   * EventSource не передаёт заголовки, поэтому токен — в параметре access_token.
   */
  @Sse('stream')
  @ApiQuery({ name: 'access_token', required: true })
  events(): Observable<MessageEvent> {
    const ping = interval(25_000).pipe(map(() => ({ type: 'ping', data: { at: new Date().toISOString() } })));
    const orders = this.stream.stream.pipe(map((e) => ({ type: 'order', data: e })));
    return merge(orders, ping);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.orders.adminGet(id);
  }

  @Post(':id/status')
  @HttpCode(200)
  async changeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeStatusDto,
    @CurrentStaff() staff: AuthStaff,
    @ClientIp() ip: string,
  ) {
    await this.orders.changeStatus(id, dto.status, { actor: 'STAFF', staff, ip }, dto.comment);
    return this.orders.adminGet(id);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelOrderDto,
    @CurrentStaff() staff: AuthStaff,
    @ClientIp() ip: string,
  ) {
    const result = await this.orders.cancel(id, dto.reason, { actor: 'STAFF', staff, ip });
    return { ...result, order: await this.orders.adminGet(id) };
  }
}
