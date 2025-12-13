// Declara controlador y servicio para DTE
import { Module } from '@nestjs/common';
import { DteService } from './dte.service';
import { DteController } from './dte.controller';
import { PrismaService } from '../prisma.service';
import { FoliosModule } from '../folios/folios.module'
import { ConfigModule } from '@nestjs/config'

@Module({
   imports: [
    FoliosModule,
    ConfigModule
  ],
  controllers: [DteController],
  providers: [DteService, PrismaService],
  exports: [DteService],
})
export class DteModule {}
