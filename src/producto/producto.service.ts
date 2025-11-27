import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class ProductoService {
  constructor(private prisma: PrismaService) {}

async getProductos(search?: string, idEmpresa?: number) {
    const whereClause: any = {};

    // 1. Filtro por Búsqueda (Nombre o Código)
    if (search) {
      whereClause.OR = [
        { nombre: { contains: search } },
        // Puedes agregar busqueda por ID si quieres que sea como código de barras
        // { id_producto: !isNaN(Number(search)) ? Number(search) : undefined }
      ];
    }

    // 2. FILTRO POR EMPRESA (CRÍTICO)
    if (idEmpresa) {
      whereClause.id_empresa = idEmpresa;
    }

    return this.prisma.producto.findMany({
      where: whereClause,
      take: 100, // Limitar resultados para que no explote si hay 10.000
      orderBy: { nombre: 'asc' }
    });
  }

  async createProducto(data: any) {
    return this.prisma.producto.create({ data });
  }

  async updateProducto(id: number, data: any) {
    return this.prisma.producto.update({ where: { id_producto: id }, data });
  }

  async deleteProducto(id: number) {
    return this.prisma.producto.delete({ where: { id_producto: id } });
  }

  async agregarStock(id: number, cantidad: number) {
    return this.prisma.producto.update({
      where: { id_producto: id },
      data: { stock: { increment: cantidad } },
    });
  }

  async quitarStock(id: number, cantidad: number) {
    return this.prisma.producto.update({
      where: { id_producto: id },
      data: { stock: { decrement: cantidad } },
    });
  }
}
