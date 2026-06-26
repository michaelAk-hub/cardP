import { Module } from '@nestjs/common';
import { StoresService } from './stores.service';
import { OffersService } from './offers.service';
import { AdminStoresController } from './admin-stores.controller';
import { AdminOffersController } from './admin-offers.controller';
import { PublicCatalogController } from './public-catalog.controller';
import { OfferExpiryScheduler } from './offer-expiry.scheduler';

@Module({
  controllers: [
    AdminStoresController,
    AdminOffersController,
    PublicCatalogController,
  ],
  providers: [StoresService, OffersService, OfferExpiryScheduler],
})
export class CatalogModule {}
