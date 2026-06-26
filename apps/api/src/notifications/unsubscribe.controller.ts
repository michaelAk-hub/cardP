import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import { UnsubscribeService } from './unsubscribe.service';
import { Public } from '../auth/decorators';

class UnsubscribeDto {
  @IsString()
  @MinLength(1)
  token!: string;
}

// Public opt-out endpoint (link in every marketing message). GET supports a
// plain link click; POST supports programmatic opt-out.
@Controller('unsubscribe')
@Public()
@Throttle({ default: { ttl: 60_000, limit: 20 } })
export class UnsubscribeController {
  constructor(private readonly unsubscribe: UnsubscribeService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async viaLink(@Query('token') token: string): Promise<{ status: string }> {
    await this.unsubscribe.unsubscribe(token ?? '');
    return { status: 'unsubscribed' };
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  async viaPost(@Body() dto: UnsubscribeDto): Promise<{ status: string }> {
    await this.unsubscribe.unsubscribe(dto.token);
    return { status: 'unsubscribed' };
  }
}
