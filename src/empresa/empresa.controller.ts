// Define endpoints HTTP para empresa
import { Controller, Get, Post, Body } from '@nestjs/common';
import { EmpresaService } from './empresa.service';

@Controller('empresas')
export class EmpresaController {
  constructor(private readonly empresaService: EmpresaService) {}
  @Get() getAll() { return this.empresaService.getEmpresas(); }
  @Post() create(@Body() data:any) { return this.empresaService.createEmpresa(data); }
}
