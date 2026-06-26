import { Controller, DefaultValuePipe, Get, ParseIntPipe, Query } from '@nestjs/common';
import { AdminRole } from '@blue-card/shared';
import { AnalyticsService } from './analytics.service';
import { Roles } from '../auth/decorators';

@Controller('admin/analytics')
@Roles(AdminRole.Root, AdminRole.Protoporia)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('summary')
  summary() {
    return this.analytics.summary();
  }

  @Get('signups')
  signups(
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
  ) {
    return this.analytics.signups(Math.min(Math.max(days, 1), 365));
  }
}
