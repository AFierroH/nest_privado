import { Module } from '@nestjs/common';
import { ProductoController } from './producto.controller';
import { ProductoService } from './producto.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [ProductoController],
  providers: [ProductoService, PrismaService],
})
export class ProductoModule {}
