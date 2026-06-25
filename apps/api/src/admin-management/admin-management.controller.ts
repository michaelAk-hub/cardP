import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { AdminRole } from '@blue-card/shared';
import { AdminManagementService } from './admin-management.service';
import { CurrentUser, Roles } from '../auth/decorators';
import { AuthPrincipal } from '../auth/auth.types';
import { CreateAdminDto } from './dto';

// All routes are root-only (RolesGuard enforces AdminRole.Root).
@Controller('admins')
@Roles(AdminRole.Root)
export class AdminManagementController {
  constructor(private readonly admins: AdminManagementService) {}

  @Post()
  create(@CurrentUser() root: AuthPrincipal, @Body() dto: CreateAdminDto) {
    return this.admins.create(root.id, dto);
  }

  @Get()
  list() {
    return this.admins.list();
  }

  @Patch(':id/disable')
  disable(
    @CurrentUser() root: AuthPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.admins.disable(root.id, id);
  }

  @Patch(':id/enable')
  enable(
    @CurrentUser() root: AuthPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.admins.enable(root.id, id);
  }
}
