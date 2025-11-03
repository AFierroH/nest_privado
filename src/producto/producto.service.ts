import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class ProductoService {
  constructor(private prisma: PrismaService) {}

  async getProductos(search?: string) {
    return this.prisma.producto.findMany({
      where: search ? { nombre: { contains: search } } : {},
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
