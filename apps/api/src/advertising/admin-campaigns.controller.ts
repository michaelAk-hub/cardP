import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { AdminRole } from '@blue-card/shared';
import { CampaignService } from './campaign.service';
import { CurrentUser, Roles } from '../auth/decorators';
import { AuthPrincipal } from '../auth/auth.types';
import { CreateCampaignDto, PreviewAudienceDto } from './dto';

// Advertising page (spec §7). Admin-only (root + protoporia).
@Controller('admin/campaigns')
@Roles(AdminRole.Root, AdminRole.Protoporia)
export class AdminCampaignsController {
  constructor(private readonly campaigns: CampaignService) {}

  // Audience size preview for the composer (matching / consenting / skipped).
  @Post('preview')
  @HttpCode(HttpStatus.OK)
  preview(@Body() dto: PreviewAudienceDto) {
    return this.campaigns.preview(dto.audience);
  }

  @Post()
  create(@CurrentUser() admin: AuthPrincipal, @Body() dto: CreateCampaignDto) {
    return this.campaigns.create(admin.id, dto);
  }

  @Get()
  list() {
    return this.campaigns.list();
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.campaigns.get(id);
  }
}
