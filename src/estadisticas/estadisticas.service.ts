import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class EstadisticasService {
  constructor(private prisma: PrismaService) {}

  async ingresosPorFecha(inicio: string, fin: string, id_empresa: number) {
    return this.prisma.venta.groupBy({
      by: ['fecha'],
      where: {
        id_empresa,
        fecha: { gte: new Date(inicio), lte: new Date(fin) },
      },
      _sum: { total: true },
      orderBy: { fecha: 'asc' },
    });
  }

  async productosMasVendidos(id_empresa: number) {
    return this.prisma.detalle_venta.groupBy({
      by: ['id_producto'],
      _sum: { cantidad: true },
      orderBy: { _sum: { cantidad: 'desc' } },
      take: 10,
      where: { producto: { id_empresa } },
    });
  }
}
