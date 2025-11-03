// Lógica de negocio para empresa usando Prisma
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class EmpresaService {
  constructor(private prisma: PrismaService) {}
  getEmpresas() { return this.prisma.empresa.findMany(); }
  createEmpresa(data:any) { return this.prisma.empresa.create({ data }); }
}