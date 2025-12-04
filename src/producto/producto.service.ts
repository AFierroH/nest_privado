import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class ProductoService {
  constructor(private prisma: PrismaService) {}

// producto.service.ts
async getProductos(search?: string, idEmpresa?: number, page = 1, limit = 20) {
    const whereClause: any = {};
    if (search) {
      whereClause.OR = [
        { nombre: { contains: search } }, // Prisma en Postgres es Case-Sensitive por defecto, cuidado
      ];
    }
    if (idEmpresa) {
      whereClause.id_empresa = idEmpresa;
    }

    // CALCULAR EL SALTO
    const skip = (page - 1) * limit;

    return this.prisma.producto.findMany({
      where: whereClause,
      skip: skip,      // <--- Saltar los anteriores
      take: limit,     // <--- Tomar solo el límite
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
