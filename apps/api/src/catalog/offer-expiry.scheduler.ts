import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OffersService } from './offers.service';

// Daily auto-expiry of offers past their expiry_date (spec §6.8).
@Injectable()
export class OfferExpiryScheduler {
  private readonly logger = new Logger(OfferExpiryScheduler.name);

  constructor(private readonly offers: OffersService) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async handleExpiry(): Promise<void> {
    const { expired } = await this.offers.expireOverdue();
    this.logger.log(`offer-expiry cron ran (expired=${expired})`);
  }
}
