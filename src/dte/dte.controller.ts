import { Controller, Post, Body, Res, HttpStatus } from '@nestjs/common';
import { DteService } from './dte.service';
import type { Response } from 'express'; 

@Controller('dte')
export class DteController {
  constructor(private readonly dteService: DteService) {}

  @Post('emitir-prueba')
  async emitirPrueba(@Body() body: any, @Res() res: Response) {
    try {
      const { idVenta } = body; // Solo necesitamos el ID

      console.log('📥 Controller DTE recibió ID:', idVenta);

      // CORRECCIÓN: Llamamos al servicio solo con el ID.
      // El servicio ya sabe buscar el folio en la BD y armar el JSON.
      const resultado = await this.dteService.emitirDteDesdeVenta(idVenta);

      if (!resultado.ok) {
        return res.status(HttpStatus.BAD_REQUEST).json(resultado);
      }

      return res.status(HttpStatus.OK).json(resultado);
    } catch (error) {
      console.error('Error en controller:', error);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        ok: false,
        error: error.message,
      });
    }
  }
}