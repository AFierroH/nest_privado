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

    const tableRegex = /CREATE TABLE\s+`?(\w+)`?\s*\(([\s\S]*?)\);/g;
    const tables: any[] = [];
    let match;

    while ((match = tableRegex.exec(content))) {
      const [, name, body] = match;
      const columns: string[] = [];
      const lines = body.split('\n');
      const lineRegex = /^\s*`?(\w+)`?\s+/; 
      
      for (const line of lines) {
        const colMatch = line.trim().match(lineRegex);
        if (colMatch && colMatch[1]) {
          const colName = colMatch[1];
          const keywords = [
            'PRIMARY', 'FOREIGN', 'KEY', 'CONSTRAINT', 
            'UNIQUE', 'INDEX', 'CHECK'
          ];
          if (!keywords.includes(colName.toUpperCase())) {
            columns.push(colName);
          }
        }
      }
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
      schema[row.TABLE_NAME].push(row.COLUMN_NAME);
    }
    return schema;
  }

  private parseSqlValues(tupleBody: string): (string | number | null)[] {
    const splitRegex = /,(?=(?:[^']*'[^']*')*[^']*$)/g;
    
    return tupleBody.split(splitRegex).map(v => {
        const val = v.trim();
        
        if (val.toUpperCase() === 'NULL') {
            return null;
        }
        if (val.startsWith("'") && val.endsWith("'")) {
            return val.substring(1, val.length - 1).replace(/\\'/g, "'");
        }
        if (!isNaN(Number(val))) {
            return val; 
        }
        return val;
    });
  }


  async preview(body: any) {
    const { uploadId, sourceTable, destTable, mapping } = body;
    const sqlFile = path.join(this.uploadsDir, `${uploadId}.sql`);
    const content = fs.readFileSync(sqlFile, 'utf8');

    const insertRegex = new RegExp(
      `INSERT INTO\\s+\`?${sourceTable}\`?\\s*\\(([^)]+)\\)\\s*VALUES\\s*([\\s\S]+?);`,
      'gi',
    );

    const preview: any[] = [];
    let match;
    while ((match = insertRegex.exec(content))) {
      const cols = match[1].split(',').map(c => c.replace(/`/g, '').trim());
      const valuesChunk = match[2];
      const tuples = valuesChunk.match(/\(([^)]+)\)/g) || [];

      for (const t of tuples.slice(0, 5)) {
        const vals = this.parseSqlValues(t.substring(1, t.length - 1));
        const row: any = {};
        for (const destCol in mapping) {
          const src = mapping[destCol];
          if (src === '__static') row[destCol] = body.staticValues?.[destCol] ?? null;
          else if (src && cols.includes(src)) {
            row[destCol] = vals[cols.indexOf(src)];
          }
        }
        preview.push(row);
      }
    }
    return { preview };
  }

async applyMapping(body: any) {
  const { uploadId, sourceTable, destTable, mapping, staticValues } = body;
  const sqlFile = path.join(this.uploadsDir, `${uploadId}.sql`);

  console.log('==============================');
  console.log('applyMapping() llamado');
  console.log('Body recibido:', JSON.stringify(body, null, 2));
  console.log('Ruta SQL file:', sqlFile);
  console.log('==============================');

  try {
    if (!fs.existsSync(sqlFile)) {
      throw new Error(`Archivo SQL no encontrado: ${sqlFile}`);
    }

    const content = fs.readFileSync(sqlFile, 'utf8');
    console.log(`Tamaño del archivo SQL: ${content.length} bytes`);

    // Regex de INSERT
    const insertRegex = new RegExp(
      `INSERT INTO\\s+\`?${sourceTable}\`?\\s*\\(([^)]+)\\)\\s*VALUES\\s*([\\s\\S]+?);`,
      'gi',
    );

    let match;
    const rowsToInsert: any[] = [];
    while ((match = insertRegex.exec(content))) {
      const cols = match[1].split(',').map(c => c.replace(/`/g, '').trim());
      const tuples = match[2].match(/\(([^)]+)\)/g) || [];

      for (const t of tuples) {
        const vals = this.parseSqlValues(t.substring(1, t.length - 1));
        const row: any = {};
        for (const destCol in mapping) {
          const src = mapping[destCol];
          if (src === '__static') row[destCol] = staticValues?.[destCol] ?? null;
          else if (src && cols.includes(src)) row[destCol] = vals[cols.indexOf(src)];
        }
        rowsToInsert.push(row);
      }
    }

    console.log(`Filas detectadas: ${rowsToInsert.length}`);
    console.log('Primeras filas:', rowsToInsert.slice(0, 3));

    if (rowsToInsert.length === 0) {
      throw new Error('No se detectaron filas INSERT válidas en el archivo SQL');
    }

    // Intentar obtener modelo Prisma
    const modelName = destTable.replace(/_([a-z])/g, (_, g) => g.toUpperCase());
    const prismaModel = (this.prisma as any)[modelName];

    if (!prismaModel) {
      console.error('Modelo Prisma no encontrado:', modelName);
      console.log('Modelos disponibles:', Object.keys(this.prisma));
      throw new Error(`Modelo Prisma no encontrado: ${modelName}`);
    }

    console.log(`Modelo Prisma usado: ${modelName}`);

    // Insertar datos
    const created = await prismaModel.createMany({
      data: rowsToInsert,
      skipDuplicates: true,
    });

    console.log(`createMany completado: ${created.count} filas insertadas`);
    fs.unlink(sqlFile, () => {});
    return { inserted: created.count };
  } catch (error: any) {
    console.error('Error completo en applyMapping:');
    console.error(error);
    throw new Error(`Error en importación: ${error.message}`);
  }
}


}