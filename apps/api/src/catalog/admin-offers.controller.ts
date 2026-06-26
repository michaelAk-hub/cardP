import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { AdminRole } from '@blue-card/shared';
import { OffersService } from './offers.service';
import { CurrentUser, Roles } from '../auth/decorators';
import { AuthPrincipal } from '../auth/auth.types';
import { CreateOfferDto, UpdateOfferDto } from './dto';

@Controller('admin')
@Roles(AdminRole.Root, AdminRole.Protoporia)
export class AdminOffersController {
  constructor(private readonly offers: OffersService) {}

  @Post('stores/:storeId/offers')
  create(
    @CurrentUser() admin: AuthPrincipal,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Body() dto: CreateOfferDto,
  ) {
    return this.offers.create(admin.id, storeId, dto);
  }

  @Get('stores/:storeId/offers')
  list(@Param('storeId', ParseUUIDPipe) storeId: string) {
    return this.offers.listForStore(storeId);
  }

  @Patch('offers/:id')
  update(
    @CurrentUser() admin: AuthPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOfferDto,
  ) {
    return this.offers.update(admin.id, id, dto);
  }

  @Delete('offers/:id')
  remove(
    @CurrentUser() admin: AuthPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.offers.remove(admin.id, id);
  }

  // Manual trigger for the same logic the daily cron runs (ops + testing).
  @Post('offers/expire-now')
  expireNow() {
    return this.offers.expireOverdue();
  }
}
