import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class UsuarioService {
  constructor(private prisma: PrismaService) {}

  async getAll() {
    return this.prisma.usuario.findMany();
  }

  async create(data: any) {
    return this.prisma.usuario.create({ data });
  }

  async update(id: number, data: any) {
    return this.prisma.usuario.update({ where: { id_usuario: id }, data });
  }

  async delete(id: number) {
    return this.prisma.usuario.delete({ where: { id_usuario: id } });
  }
}
