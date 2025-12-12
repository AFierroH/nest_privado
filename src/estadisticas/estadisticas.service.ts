// src/estadistica/estadistica.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { startOfDay, endOfDay, subDays, format } from 'date-fns';

@Injectable()
export class EstadisticasService {
  constructor(private prisma: PrismaService) {}

  async getEstadisticas(query: any) {
    const { rango, inicio, fin, categoria, marca } = query;
    const idEmpresa = query.idEmpresa ? Number(query.idEmpresa) : undefined;

    // 1. DEFINIR RANGO DE FECHAS
    let fechaInicio = new Date();
    let fechaFin = new Date();

    if (inicio && fin) {
      // Rango personalizado
      fechaInicio = startOfDay(new Date(inicio));
      fechaFin = endOfDay(new Date(fin));
    } else {
      // Rangos predefinidos
      const mapDias: any = { '7d': 7, '30d': 30, '90d': 90, '365d': 365 };
      const dias = mapDias[rango] || 7;
      fechaInicio = subDays(new Date(), dias);
      fechaFin = new Date();
    }

    // 2. CONSTRUIR FILTROS (WHERE)
    const whereVenta: any = {
      fecha: { gte: fechaInicio, lte: fechaFin },
      id_empresa: idEmpresa,
    };

    // Filtro profundo: Si hay categoria o marca, filtramos las ventas que tengan AL MENOS un producto con eso
    if (categoria || marca) {
      whereVenta.detalle_venta = {
        some: {
          producto: {
            // Filtros dinámicos
            ...(categoria && { categoria: { nombre: categoria } }),
            ...(marca && { marca: { contains: marca } })
          }
        }
      };
    }

    // 3. OBTENER VENTAS CRUDAS (Prisma no agrupa fácil por fecha truncada, lo hacemos en JS para ser DB-agnostic)
    const ventasRaw = await this.prisma.venta.findMany({
      where: whereVenta,
      select: {
        fecha: true,
        total: true,
        detalle_venta: {
          include: { producto: true }
        }
      },
      orderBy: { fecha: 'asc' }
    });

    // 4. AGRUPAR VENTAS POR FECHA (SOLUCIÓN AL GRÁFICO SEPARADO)
    // Usamos un mapa para sumarizar: "2023-10-01" => $50.000
    const ventasAgrupadas = new Map<string, number>();

    ventasRaw.forEach(v => {
      // Cortamos la fecha a YYYY-MM-DD para agrupar por día
      // Ojo: Si el rango es '365d', podrías querer agrupar por mes (YYYY-MM). 
      // Aquí lo dejo por día por defecto.
      const fechaKey = v.fecha.toISOString().split('T')[0]; 
      const actual = ventasAgrupadas.get(fechaKey) || 0;
      ventasAgrupadas.set(fechaKey, actual + v.total);
    });

    // Convertir Mapa a Array para el gráfico
    const ventasChart = Array.from(ventasAgrupadas, ([fecha, total]) => ({ fecha, total }));

    // 5. TOP PRODUCTOS (Con filtros aplicados)
    // Hay que recalcularlos manualmente de las ventas filtradas
    const productoMap = new Map<string, any>();

    ventasRaw.forEach(v => {
      v.detalle_venta.forEach(d => {
        // Aplicar filtro de marca/categoria al detalle también si es necesario
        if (marca && !d.producto.marca?.includes(marca)) return;
        // (La lógica de categoría ya se filtró en el WHERE principal, pero doble check no daña)
        
        const key = d.producto.nombre;
        const actual = productoMap.get(key) || { nombre: key, cantidad: 0, total: 0 };
        actual.cantidad += d.cantidad;
        actual.total += d.subtotal;
        productoMap.set(key, actual);
      });
    });

    const topProductos = Array.from(productoMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    // 6. OBTENER LISTAS PARA FILTROS (Marcas y Categorías disponibles)
    const categoriasList = await this.prisma.categoria.findMany();
    // Truco para sacar marcas únicas usando groupBy
    const marcasRaw = await this.prisma.producto.groupBy({
      by: ['marca'],
      where: { id_empresa: idEmpresa, marca: { not: null } },
    });

    return {
      ventas_chart: ventasChart,
      top_productos: topProductos,
      categorias: categoriasList,
      marcas: marcasRaw.map(m => m.marca).filter(m => m !== '')
    };
  }
}