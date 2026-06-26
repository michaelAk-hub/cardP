import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  StreamableFile,
} from '@nestjs/common';
import { AdminRole } from '@blue-card/shared';
import { AdminStudentsService } from './admin-students.service';
import { CurrentUser, Roles } from '../auth/decorators';
import { AuthPrincipal } from '../auth/auth.types';
import { DeactivateDto, IdReviewDto, ListStudentsQueryDto } from './dto';

// Admin core — students table + row actions. Any admin (root or protoporia).
@Controller('admin/students')
@Roles(AdminRole.Root, AdminRole.Protoporia)
export class AdminStudentsController {
  constructor(private readonly students: AdminStudentsService) {}

  @Get()
  list(@Query() query: ListStudentsQueryDto) {
    return this.students.list(query);
  }

  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.students.detail(id);
  }

  @Get(':id/id-document')
  idDocument(
    @CurrentUser() admin: AuthPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.students.idDocumentLinks(admin.id, id);
  }

  @Get(':id/id-photo/:side')
  async idPhoto(
    @CurrentUser() admin: AuthPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('side') side: string,
  ): Promise<StreamableFile> {
    if (side !== 'front' && side !== 'back') {
      throw new BadRequestException('side must be front or back');
    }
    const { buffer, contentType } = await this.students.streamIdPhoto(
      admin.id,
      id,
      side,
    );
    return new StreamableFile(buffer, { type: contentType });
  }

  @Post(':id/id-review')
  reviewId(
    @CurrentUser() admin: AuthPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: IdReviewDto,
  ) {
    return this.students.reviewId(admin.id, id, dto);
  }

  @Post(':id/deactivate')
  deactivate(
    @CurrentUser() admin: AuthPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DeactivateDto,
  ) {
    return this.students.deactivate(admin.id, id, dto);
  }

  @Post(':id/reactivate')
  reactivate(
    @CurrentUser() admin: AuthPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.students.reactivate(admin.id, id);
  }

  @Post(':id/send-recovery')
  sendRecovery(
    @CurrentUser() admin: AuthPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.students.sendRecovery(admin.id, id);
  }

  @Post(':id/recreate-card-serial')
  recreateCardSerial(
    @CurrentUser() admin: AuthPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.students.recreateCardSerial(admin.id, id);
  }
}
