import { Controller, Get, Post, Body, Param, ParseIntPipe, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path'; // <--- IMPORTANTE: Importar join
import { EmpresaService } from './empresa.service';

@Controller('empresas')
export class EmpresaController {
  constructor(private readonly empresaService: EmpresaService) {}

  @Post(':id/logo')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: join(process.cwd(), 'uploads'), 
      filename: (req, file, cb) => {
        const randomName = Array(32).fill(null).map(() => (Math.round(Math.random() * 16)).toString(16)).join('');
        cb(null, `${randomName}${extname(file.originalname)}`);
      }
    })
  }))
  async uploadLogo(@Param('id', ParseIntPipe) id: number, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new Error('Archivo no recibido');
    
    // URL pública para guardar en BD
    const logoUrl = `http://147.182.245.46:3000/uploads/${file.filename}`;
    
    return this.empresaService.updateLogo(id, logoUrl);
  }

  @Get() 
  getAll() { return this.empresaService.getEmpresas(); }

  @Get(':id')
  getOne(@Param('id', ParseIntPipe) id: number) { return this.empresaService.getEmpresaById(id); }

  @Post() 
  create(@Body() data: any) { return this.empresaService.createEmpresa(data); }
}