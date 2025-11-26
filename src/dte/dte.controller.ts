import { Controller, Post, Body, Res, HttpStatus } from '@nestjs/common';
import { DteService } from './dte.service';

@Controller('dte') // 👈 Esto define la ruta base como /api/dte
export class DteController {
  constructor(private readonly dteService: DteService) {}

  // Endpoint: POST /api/dte/emitir-prueba
  @Post('emitir-prueba')
  async emitirPrueba(@Body() body: { idVenta: number; caso: string }) {
    // Llamamos al servicio que ya creamos
    return await this.dteService.emitirDteDesdeVenta(body.idVenta, body.caso);
  }
}