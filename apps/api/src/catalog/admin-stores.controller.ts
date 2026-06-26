import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AdminRole } from '@blue-card/shared';
import { StoresService } from './stores.service';
import { CurrentUser, Roles } from '../auth/decorators';
import { AuthPrincipal } from '../auth/auth.types';
import { CreateStoreDto, ListStoresQueryDto, UpdateStoreDto } from './dto';

@Controller('admin/stores')
@Roles(AdminRole.Root, AdminRole.Protoporia)
export class AdminStoresController {
  constructor(private readonly stores: StoresService) {}

  @Post()
  create(@CurrentUser() admin: AuthPrincipal, @Body() dto: CreateStoreDto) {
    return this.stores.create(admin.id, dto);
  }

  @Get()
  list(@Query() query: ListStoresQueryDto) {
    return this.stores.adminList(query);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.stores.adminGet(id);
  }

  @Patch(':id')
  update(
    @CurrentUser() admin: AuthPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStoreDto,
  ) {
    return this.stores.update(admin.id, id, dto);
  }

  @Delete(':id')
  remove(
    @CurrentUser() admin: AuthPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.stores.remove(admin.id, id);
  }

  @Post(':id/logo')
  @UseInterceptors(
    FileInterceptor('logo', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  uploadLogo(
    @CurrentUser() admin: AuthPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.stores.uploadLogo(admin.id, id, file);
  }
}
