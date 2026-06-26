import { Global, Module } from '@nestjs/common';
import { GdprService } from './gdpr.service';
import { StudentDeletionService } from './student-deletion.service';
import { StudentGdprController } from './student-gdpr.controller';

// Global so the admin students module can reuse StudentDeletionService for
// admin-initiated erasure.
@Global()
@Module({
  controllers: [StudentGdprController],
  providers: [GdprService, StudentDeletionService],
  exports: [StudentDeletionService, GdprService],
})
export class GdprModule {}
