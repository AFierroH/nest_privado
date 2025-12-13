import { Controller, Post, Body, Res, HttpStatus } from '@nestjs/common';
import { DteService } from './dte.service';
// 👇 CAMBIO IMPORTANTE: Usar 'import type' para Response si solo se usa como tipo
import type { Response } from 'express'; 

@Controller('dte')
export class DteController {
  constructor(private readonly dteService: DteService) {}

  @Post('emitir-prueba')
  async emitirPrueba(@Body() body: any, @Res() res: Response) {
    try {
      // 1. Extraemos los datos del body que viene del frontend
      const { idVenta, caso, folioManual } = body; 

      console.log('📥 Controller recibió:', { idVenta, caso, folioManual });

      // 2. Pasamos folioManual al servicio (Asegúrate que el 3er argumento sea folioManual)
      // Si folioManual viene undefined, pasamos 0
      const resultado = await this.dteService.emitirDteDesdeVenta(
          idVenta, 
          caso, 
          Number(folioManual) || 0 
      );

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