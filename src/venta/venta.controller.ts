import { Controller, Post, Body } from '@nestjs/common';
import { VentaService } from './venta.service';

@Controller('ventas')
export class VentaController {
  constructor(private ventaService: VentaService) {}

  @Post('emitir')
  async emitirVenta(@Body() body: any) {
    // body debe incluir: id_usuario, id_empresa, total, detalles, pagos?, usarImpresora?
    return this.ventaService.emitirVentaCompleta(body);
  }
}
