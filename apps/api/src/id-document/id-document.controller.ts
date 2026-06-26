import {
  Controller,
  Post,
  UnauthorizedException,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { IdDocumentService } from './id-document.service';
import { CurrentUser } from '../auth/decorators';
import { AuthPrincipal } from '../auth/auth.types';

// Authenticated student uploads ID front + back (multipart/form-data).
@Controller('student/id-document')
export class IdDocumentController {
  constructor(private readonly idDocuments: IdDocumentService) {}

  @Post()
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'front', maxCount: 1 },
        { name: 'back', maxCount: 1 },
      ],
      { limits: { fileSize: 10 * 1024 * 1024, files: 2 } },
    ),
  )
  upload(
    @CurrentUser() user: AuthPrincipal,
    @UploadedFiles()
    files: { front?: Express.Multer.File[]; back?: Express.Multer.File[] },
  ) {
    if (user.type !== 'student') {
      throw new UnauthorizedException('Student token required');
    }
    return this.idDocuments.upload(user.id, files.front?.[0], files.back?.[0]);
  }
}
