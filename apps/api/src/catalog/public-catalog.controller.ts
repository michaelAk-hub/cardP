import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  StreamableFile,
} from '@nestjs/common';
import { StoresService } from './stores.service';
import { Public } from '../auth/decorators';

// Student-facing catalog (any authenticated principal). Only visible stores +
// active offers. Logos are public images.
@Controller('stores')
export class PublicCatalogController {
  constructor(private readonly stores: StoresService) {}

  @Get()
  list() {
    return this.stores.publicList();
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.stores.publicGet(id);
  }

  @Public()
  @Get(':id/logo')
  async logo(@Param('id', ParseUUIDPipe) id: string): Promise<StreamableFile> {
    const { buffer, contentType } = await this.stores.readLogo(id);
    return new StreamableFile(buffer, { type: contentType });
  }
}
