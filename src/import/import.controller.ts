import { Controller, Post, Get, Param, UploadedFile, UseInterceptors, Body } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ImportService } from './import.service';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@prisma/client';

@Controller('import')
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Post('upload-sql')
  @UseInterceptors(FileInterceptor('file'))
  async uploadSql(@UploadedFile() file: Express.Multer.File) {
    const result = await this.importService.handleUpload(file);
    console.log('RESULT upload-sql:', result);
    return result;
  }

  @Get('parsed/:uploadId')
  async getParsed(@Param('uploadId') uploadId: string) {
    return this.importService.getParsed(uploadId);
  }

   @Get('dest-schema')
  async getDestSchema() {

    const dmmf = Prisma.dmmf;

    const schema: Record<string, string[]> = {};

    for (const model of dmmf.datamodel.models) {
      schema[model.name.toLowerCase()] = model.fields.map((f) => f.name);
    }

    return schema;
  }

  @Post('preview')
  async preview(@Body() body: any) {
    return this.importService.preview(body);
  }

  @Post('apply')
  async applyMapping(@Body() body: any) {
    return this.importService.applyMapping(body);
  }
}
