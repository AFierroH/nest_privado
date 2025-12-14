import { Controller, Post, Body, Res, HttpStatus } from '@nestjs/common';
import { DteService } from './dte.service';
import type { Response } from 'express'; 

@Controller('dte')
export class DteController {
  constructor(private readonly dteService: DteService) {}

  @Post('emitir-prueba')
  async emitirPrueba(@Body() body: any, @Res() res: Response) {
    try {
      // Solo necesitamos el ID, el servicio se encarga del resto (folio, caf, etc.)
      const { idVenta } = body; 

      if (!idVenta) {
        return res.status(HttpStatus.BAD_REQUEST).json({ 
            ok: false, 
            error: 'Falta idVenta' 
        });
      }

      console.log('📥 Controller DTE recibió ID:', idVenta);

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