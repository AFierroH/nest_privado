import { Controller, Get, Query } from '@nestjs/common';
import { EstadisticasService } from './estadisticas.service';

@Controller('estadisticas')
export class EstadisticasController {
  constructor(private readonly estadisticasService: EstadisticasService) {}

  @Get()
  async getEstadisticas(@Query('rango') rango: string = '7d') {
    return this.estadisticasService.obtenerEstadisticas(rango);
  }
}
