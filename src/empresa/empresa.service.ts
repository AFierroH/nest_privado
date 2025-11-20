import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class EmpresaService {
  constructor(private prisma: PrismaService) {}

  getEmpresas() { 
    return this.prisma.empresa.findMany(); 
  }

  // --- NUEVO: Buscar una sola empresa por ID ---
  getEmpresaById(id: number) {
    return this.prisma.empresa.findUnique({
      where: { id_empresa: id } 
    });
  }

  createEmpresa(data: any) { 
    return this.prisma.empresa.create({ data }); 
  }
  updateLogo(id: number, logoUrl: string) {
    return this.prisma.empresa.update({
      where: { id_empresa: id },
      data: { logo_url: logoUrl } 
    });
  }
}