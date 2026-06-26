import { Global, Module } from '@nestjs/common';
import { ActivationService } from './activation.service';

@Global()
@Module({
  providers: [ActivationService],
  exports: [ActivationService],
})
export class ActivationModule {}
