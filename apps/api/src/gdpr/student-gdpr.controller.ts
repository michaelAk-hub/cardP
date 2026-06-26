import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { GdprService } from './gdpr.service';
import { StudentDeletionService } from './student-deletion.service';
import { CurrentUser } from '../auth/decorators';
import { AuthPrincipal } from '../auth/auth.types';

// Student self-service GDPR (spec §8): export my data / delete my account.
@Controller('student/me')
export class StudentGdprController {
  constructor(
    private readonly gdpr: GdprService,
    private readonly deletion: StudentDeletionService,
  ) {}

  @Get('data-export')
  export(@CurrentUser() user: AuthPrincipal) {
    this.assertStudent(user);
    return this.gdpr.exportStudent(user.id);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteSelf(@CurrentUser() user: AuthPrincipal): Promise<void> {
    this.assertStudent(user);
    await this.deletion.delete(user.id);
  }

  private assertStudent(user: AuthPrincipal): void {
    if (user.type !== 'student') {
      throw new UnauthorizedException('Student token required');
    }
  }
}
