import { Module } from '@nestjs/common';
import { IdDocumentController } from './id-document.controller';
import { IdDocumentService } from './id-document.service';

@Module({
  controllers: [IdDocumentController],
  providers: [IdDocumentService],
})
export class IdDocumentModule {}
