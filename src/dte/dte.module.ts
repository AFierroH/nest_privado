// Declara controlador y servicio para DTE
import { Module } from '@nestjs/common';
import { DteService } from './dte.service';
import { DteController } from './dte.controller';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [DteController],
  providers: [DteService, PrismaService],
  exports: [DteService],
})
export class DteModule {}
