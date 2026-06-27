import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../auth/decorators';

// Public list powering the registration university dropdown (spec §6.1).
@Controller('universities')
@Public()
export class UniversitiesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list() {
    return this.prisma.university.findMany({
      where: { active: true },
      select: { id: true, nameEn: true, nameEl: true },
      orderBy: { nameEn: 'asc' },
    });
  }
}
