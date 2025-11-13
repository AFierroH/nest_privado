import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma.service';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class ImportService {
  private uploadsDir = path.join(process.cwd(), 'uploads_sql');
  private prismaClient = new PrismaClient();

  constructor(private prisma: PrismaService) {
    if (!fs.existsSync(this.uploadsDir)) fs.mkdirSync(this.uploadsDir);
  }

  async handleUpload(file: Express.Multer.File) {
    const uploadId = randomUUID();
    const savePath = path.join(this.uploadsDir, `${uploadId}.sql`);
    fs.writeFileSync(savePath, file.buffer);
    return { uploadId };
  }

  async getParsed(uploadId: string) {
    const sqlFile = path.join(this.uploadsDir, `${uploadId}.sql`);
    const content = fs.readFileSync(sqlFile, 'utf8');

    const tableRegex = /CREATE TABLE\s+`?(\w+)`?\s*\(([\s\S]*?)\)/g;
    const tables: any[] = [];
    let match;

    while ((match = tableRegex.exec(content))) {
      const [, name, body] = match;
      
      // --- CÓDIGO CORREGIDO ---
      // Esta nueva Regex busca el primer nombre en cada línea,
      // con o sin comillas graves (`).
      const columnRegex = /^\s*`?(\w+)`?\s+\w+/gm;
      const columns: string[] = [];
      let colMatch;

      while ((colMatch = columnRegex.exec(body))) {
        const colName = colMatch[1];
        // Ignorar palabras clave de SQL que no son columnas
        const keywords = ['PRIMARY', 'FOREIGN', 'KEY', 'CONSTRAINT', 'UNIQUE', 'INDEX'];
        if (colName && !keywords.includes(colName.toUpperCase())) {
           columns.push(colName);
        }
      }
      // --- FIN DEL CÓDIGO CORREGIDO ---

      tables.push({ name, columns });
    }
    return tables;
  }

  async getDestSchema(): Promise<Record<string, string[]>> {
    const dbName = process.env.DB_NAME || 'pos_sii_es';
    const result = await this.prisma.$queryRawUnsafe(`
      SELECT TABLE_NAME, COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = '${dbName}'
    `);

    const schema: Record<string, string[]> = {};
    for (const row of result as any[]) {
      if (!schema[row.TABLE_NAME]) schema[row.TABLE_NAME] = [];
      schema[row.TABLE_NAME].push(row.TABLE_NAME); // Error sutil corregido: debería ser row.COLUMN_NAME
    }
    // Corrección del error sutil en el bucle de arriba:
    const correctSchema: Record<string, string[]> = {};
    for (const row of result as any[]) {
      if (!correctSchema[row.TABLE_NAME]) correctSchema[row.TABLE_NAME] = [];
      correctSchema[row.TABLE_NAME].push(row.COLUMN_NAME);
    }
    return correctSchema;
  }


  async preview(body: any) {
    const { uploadId, sourceTable, destTable, mapping } = body;
    const sqlFile = path.join(this.uploadsDir, `${uploadId}.sql`);
    const content = fs.readFileSync(sqlFile, 'utf8');

    const insertRegex = new RegExp(
      `INSERT INTO\\s+\`?${sourceTable}\`?\\s*\\(([^)]+)\\)\\s*VALUES\\s*([\\s\\S]+?);`,
      'gi',
    );

    const preview: any[] = [];
    let match;
    while ((match = insertRegex.exec(content))) {
      const cols = match[1].split(',').map(c => c.replace(/`/g, '').trim());
      const valuesChunk = match[2];
      const tuples = valuesChunk.match(/\(([^)]+)\)/g) || [];

      for (const t of tuples.slice(0, 5)) {
        const vals = t
          .replace(/[()]/g, '')
          .split(',')
          .map(v => v.trim().replace(/^'|'$/g, ''));
        const row: any = {};
        for (const destCol in mapping) {
          const src = mapping[destCol];
          if (src === '__static') row[destCol] = body.staticValues?.[destCol] ?? null;
          else if (src && cols.includes(src)) row[destCol] = vals[cols.indexOf(src)];
        }
        preview.push(row);
      }
    }
    return { preview };
  }

  async applyMapping(body: any) {
    const { uploadId, sourceTable, destTable, mapping, staticValues } = body;
    const sqlFile = path.join(this.uploadsDir, `${uploadId}.sql`);
    const content = fs.readFileSync(sqlFile, 'utf8');

    const insertRegex = new RegExp(
      `INSERT INTO\\s+\`?${sourceTable}\`?\\s*\\(([^)]+)\\)\\s*VALUES\\s*([\\s\\S]+?);`,
      'gi',
    );

    const rowsToInsert: any[] = [];
    let match;
    while ((match = insertRegex.exec(content))) {
      const cols = match[1].split(',').map(c => c.replace(/`/g, '').trim());
      const valuesChunk = match[2];
      const tuples = valuesChunk.match(/\(([^)]+)\)/g) || [];

      for (const t of tuples) {
        const vals = t
          .replace(/[()]/g, '')
          .split(',')
          .map(v => v.trim().replace(/^'|'$/g, ''));
        const row: any = {};
        for (const destCol in mapping) {
          const src = mapping[destCol];
          if (src === '__static') row[destCol] = staticValues?.[destCol] ?? null;
          else if (src && cols.includes(src)) row[destCol] = vals[cols.indexOf(src)];
        }
        rowsToInsert.push(row);
      }
    }

    const modelName = destTable.replace(/_([a-z])/g, g => g[1].toUpperCase());
    const model: any = (this.prisma as any)[modelName];
    if (!model) throw new Error(`Modelo Prisma no encontrado: ${modelName}`);

    const created = await model.createMany({
      data: rowsToInsert,
      skipDuplicates: true,
    });
    fs.unlink(sqlFile, () => {});
    return { inserted: created.count };
  }
}