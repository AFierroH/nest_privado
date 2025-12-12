import { Controller, Get, Query } from '@nestjs/common';
import { EstadisticasService } from './estadisticas.service';

@Controller('estadisticas')
export class EstadisticasController {
  constructor(private readonly estadisticaService: EstadisticasService) {}

  @Get()
  async getEstadisticas(
    @Query('rango') rango?: string,
    @Query('inicio') inicio?: string,
    @Query('fin') fin?: string,
    @Query('categoria') categoria?: string,
    @Query('marca') marca?: string,
    @Query('idEmpresa') idEmpresa?: string,
  ) {
    // Empaquetamos todo en un objeto para el servicio
    return this.estadisticaService.getEstadisticas({
      rango: rango || '7d', // Valor por defecto si no viene nada
      inicio,
      fin,
      categoria,
      marca,
      idEmpresa: idEmpresa ? Number(idEmpresa) : undefined
    });
  }
}