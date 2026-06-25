import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../auth/decorators';

@Controller('health')
@Public()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  // Liveness — the process is up.
  @Get()
  health(): { status: string; service: string; timestamp: string } {
    return {
      status: 'ok',
      service: 'blue-card-api',
      timestamp: new Date().toISOString(),
    };
  }

  // Readiness — dependencies (DB) are reachable.
  @Get('ready')
  async ready(): Promise<{ status: string; database: string }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', database: 'up' };
    } catch {
      return { status: 'degraded', database: 'down' };
    }
  }
}
