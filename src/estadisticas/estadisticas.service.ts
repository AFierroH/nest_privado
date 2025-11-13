import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { subDays } from 'date-fns';

@Injectable()
export class EstadisticasService {
  constructor(private prisma: PrismaService) {}

  async obtenerEstadisticas(rango: string) {
    const dias = rango === '30d' ? 30 : rango === '90d' ? 90 : 7;
    const desde = subDays(new Date(), dias);

    // Ventas por día
    const ventasPorDia = await this.prisma.venta.groupBy({
      by: ['fecha'],
      where: { fecha: { gte: desde } },
      _sum: { total: true },
      orderBy: { fecha: 'asc' },
    });

    // Productos top
    const productosTop = await this.prisma.detalle_venta.groupBy({
      by: ['id_producto'],
      _sum: { cantidad: true, subtotal: true },
      orderBy: { _sum: { cantidad: 'desc' } },
      take: 5,
    });

    const productosConNombre = await Promise.all(
      productosTop.map(async (p) => {
        const prod = await this.prisma.producto.findUnique({
          where: { id_producto: p.id_producto },
          select: { nombre: true },
        });
        return {
          nombre: prod?.nombre || 'Desconocido',
          total_vendido: p._sum.cantidad,
          ingreso: p._sum.subtotal,
        };
      }),
    );

    // Categorías más rentables
    const categorias = await this.prisma.$queryRawUnsafe(`
      SELECT c.nombre AS categoria, SUM(dv.subtotal) AS ingreso
      FROM detalle_venta dv
      JOIN producto p ON p.id_producto = dv.id_producto
      JOIN categoria c ON c.id_categoria = p.id_categoria
      JOIN venta v ON v.id_venta = dv.id_venta
      WHERE v.fecha >= '${desde.toISOString().split('T')[0]}'
      GROUP BY c.nombre
      ORDER BY ingreso DESC
    `);

    return { ventas_por_dia: ventasPorDia, productos_top: productosConNombre, categorias };
  }
}
