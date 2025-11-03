import { Controller, Get, Query } from '@nestjs/common';
import { EstadisticasService } from './estadisticas.service';

@Controller('estadisticas')
export class EstadisticasController {
  constructor(private readonly service: EstadisticasService) {}

  @Get('ingresos-por-fecha')
  async ingresos(@Query('inicio') inicio: string, @Query('fin') fin: string) {
    const id_empresa = 1; // TODO: obtener desde usuario logueado
    return this.service.ingresosPorFecha(inicio, fin, id_empresa);
  }

  @Get('productos-mas-vendidos')
  async topProductos() {
    const id_empresa = 1; // TODO: obtener desde usuario logueado
    return this.service.productosMasVendidos(id_empresa);
  }
}
