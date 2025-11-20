import { Controller, Get, Post, Body, Param, ParseIntPipe } from '@nestjs/common'; // <--- Importar Param y ParseIntPipe
import { EmpresaService } from './empresa.service';

@Controller('empresas')
export class EmpresaController {
  constructor(private readonly empresaService: EmpresaService) {}

  @Get() 
  getAll() { 
    return this.empresaService.getEmpresas(); 
  }

  @Get(':id')
  getOne(@Param('id', ParseIntPipe) id: number) {
    return this.empresaService.getEmpresaById(id);
  }

  @Post() 
  create(@Body() data: any) { 
    return this.empresaService.createEmpresa(data); 
  }
}