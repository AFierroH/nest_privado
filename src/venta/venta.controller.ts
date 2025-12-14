import { Controller, Post, Body } from '@nestjs/common';
import { VentaService } from './venta.service';

@Controller('ventas')
export class VentaController {
  constructor(private readonly ventaService: VentaService) {}

  @Post()
  async crearVenta(@Body() payload: any) {
    return this.ventaService.emitirVentaCompleta(payload);
  }
}