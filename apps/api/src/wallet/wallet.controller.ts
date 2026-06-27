import {
  Controller,
  Get,
  StreamableFile,
  UnauthorizedException,
} from '@nestjs/common';
import { WalletService } from './wallet.service';
import { CurrentUser } from '../auth/decorators';
import { AuthPrincipal } from '../auth/auth.types';

// Student wallet endpoints. The "Add to Wallet" artifacts are only produced for
// active accounts (enforced in WalletService).
@Controller('student/wallet')
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  @Get()
  status(@CurrentUser() user: AuthPrincipal) {
    this.assertStudent(user);
    return this.wallet.status(user.id);
  }

  @Get('google')
  google(@CurrentUser() user: AuthPrincipal) {
    this.assertStudent(user);
    return this.wallet.googleSaveUrl(user.id);
  }

  @Get('apple')
  async apple(@CurrentUser() user: AuthPrincipal): Promise<StreamableFile> {
    this.assertStudent(user);
    const { buffer } = await this.wallet.applePkpass(user.id);
    return new StreamableFile(buffer, {
      type: 'application/vnd.apple.pkpass',
      disposition: 'attachment; filename="bluecard.pkpass"',
    });
  }

  private assertStudent(user: AuthPrincipal): void {
    if (user.type !== 'student') {
      throw new UnauthorizedException('Student token required');
    }
  }
}
