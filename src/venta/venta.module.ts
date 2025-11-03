// src/venta/venta.module.ts
import { Module } from '@nestjs/common';
import { VentaController } from './venta.controller';
import { VentaService } from './venta.service';
import { DteModule } from '../dte/dte.module';

@Module({
  imports: [DteModule],
  controllers: [VentaController],
  providers: [VentaService],
})
export class VentaModule {}
