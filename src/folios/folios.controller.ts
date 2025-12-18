import {
  Controller,
  Post,
  Get,
  UploadedFile,
  UseInterceptors,
  Body,
  BadRequestException
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { FoliosService } from './folios.service'

@Controller('folios')
export class FoliosController {
  constructor(private readonly foliosService: FoliosService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file')) 
  async uploadCaf(
    @UploadedFile() file: Express.Multer.File,
    @Body('empresa_id') empresaIdStr?: string // Opcional por compatibilidad
  ) {
    if (!file) {
      throw new BadRequestException('No se recibió archivo CAF')
    }

    // Si no viene empresa_id, intentamos extraerlo del JWT o usar default
    let empresaId: number;
    
    if (empresaIdStr) {
      empresaId = parseInt(empresaIdStr, 10);
      if (isNaN(empresaId)) {
        throw new BadRequestException('empresa_id inválido');
      }
    } else {
      // Fallback: usar empresa_id = 1 o extraer del token
      // TODO: Implementar extracción del JWT si es necesario
      empresaId = 1;
      console.warn('empresa_id no recibido, usando empresa_id = 1 por defecto');
    }

    return this.foliosService.procesarCafXml(file, empresaId)
  }

  @Get()
  async listar() {
    return this.foliosService.listar()
  }
}