import {
  Controller,
  Post,
  Get,
  UploadedFile,
  UseInterceptors
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { FoliosService } from './folios.service'

@Controller('folios')
export class FoliosController {
  constructor(private readonly foliosService: FoliosService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file')) 
  async uploadCaf(@UploadedFile() file: Express.Multer.File) {
    return this.foliosService.procesarCafXml(file)
  }

  @Get()
  async listar() {
    return this.foliosService.listar()
  }
}