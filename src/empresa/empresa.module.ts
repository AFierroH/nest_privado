// Declara controlador y servicio para empresa
import { Module } from '@nestjs/common';
import { EmpresaService } from './empresa.service';
import { EmpresaController } from './empresa.controller';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [EmpresaController],
  providers: [EmpresaService, PrismaService],
})
export class EmpresaModule {}
