import { Controller, Post, Get, Param, UploadedFile, UseInterceptors, Body } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ImportService } from './import.service';
import { PrismaService } from '../prisma.service';


@Controller('import')
export class ImportController {
  constructor(
    private readonly importService: ImportService,
    private readonly prismaService: PrismaService,
  ) {}

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
  async getDestSchema(): Promise<Record<string, string[]>> {
    const dbName = process.env.DB_NAME || 'pos_sii_es';

    const result = await this.prismaService.$queryRawUnsafe(`
      SELECT TABLE_NAME, COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = '${dbName}';
    `);

    const schema: Record<string, string[]> = {};
    for (const row of result as any[]) {
      if (!schema[row.TABLE_NAME]) schema[row.TABLE_NAME] = [];
      schema[row.TABLE_NAME].push(row.COLUMN_NAME);
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
