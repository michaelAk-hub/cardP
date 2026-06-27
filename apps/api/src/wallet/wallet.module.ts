import { Global, Module } from '@nestjs/common';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { GoogleWalletService } from './google-wallet.service';
import { AppleWalletService } from './apple-wallet.service';

// Global so ActivationService can issue/revoke passes on status changes.
@Global()
@Module({
  controllers: [WalletController],
  providers: [WalletService, GoogleWalletService, AppleWalletService],
  exports: [WalletService],
})
export class WalletModule {}
