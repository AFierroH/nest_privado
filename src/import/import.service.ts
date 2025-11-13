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

    // Regex para encontrar: CREATE TABLE `tabla` ( ... );
    const tableRegex = /CREATE TABLE\s+`?(\w+)`?\s*\(([\s\S]*?)\);/g;
    const tables: any[] = [];
    let match;

    while ((match = tableRegex.exec(content))) {
      const [, name, body] = match;

      // Regex global para encontrar todas las definiciones de columnas
      // Busca: (opcional) ` + (nombre_col) + (opcional) ` + (tipo de dato)
      const columnRegex = /`?(\w+)`?\s+(?:VARCHAR|INT|DECIMAL|DATETIME|TEXT)/g;
      const columns: string[] = [];
      let colMatch;

      while ((colMatch = columnRegex.exec(body))) {
        // colMatch[1] es el nombre de la columna capturado (ej. "id_usuario")
        columns.push(colMatch[1]);
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

  // Esta función es un parser de tuplas SQL más inteligente.
  // Reemplaza el simple .split(',')
  private parseSqlValues(tupleBody: string): (string | number | null)[] {
    const values: (string | number | null)[] = [];
    // Esta regex captura: 'strings con comas', 123.45, 123, y NULL
    const valueRegex = /'((?:[^'\\]|\\.)*)'|(\d+\.\d+)|(\d+)|(NULL)/g;
    let match;

    while ((match = valueRegex.exec(tupleBody))) {
      if (match[1] !== undefined) { 
        // Maneja comillas escapadas (ej. 'O\'Connor')
        values.push(match[1].replace(/\\'/g, "'"));
      } else if (match[2] !== undefined) { 
        values.push(Number(match[2]));
      } else if (match[3] !== undefined) { 
        values.push(Number(match[3]));
      } else if (match[4] !== undefined) { 
        values.push(null);
      }
    }
    return values;
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
        const vals = this.parseSqlValues(t.substring(1, t.length - 1));
        const row: any = {};
        for (const destCol in mapping) {
          const src = mapping[destCol];
          if (src === '__static') {
            row[destCol] = staticValues?.[destCol] ?? null;
          } else if (src && cols.includes(src)) {
            row[destCol] = vals[cols.indexOf(src)];
          }
        }
        rowsToInsert.push(row);
      }
    }

    const totalRowsFound = rowsToInsert.length;

    if (totalRowsFound === 0) {
      fs.unlink(sqlFile, () => {});
      // Si el parser no encontró NADA error
      throw new Error('El parser no encontró filas "INSERT INTO" para la tabla seleccionada.');
    }

    const modelName = destTable.replace(/_([a-z])/g, g => g[1].toUpperCase());
    const model: any = (this.prisma as any)[modelName];
    if (!model) throw new Error(`Modelo Prisma no encontrado: ${modelName}`);

    const created = await model.createMany({
      data: rowsToInsert,
      skipDuplicates: true,
    });

    fs.unlink(sqlFile, () => {});
    
    return { 
      attempted: totalRowsFound, 
      inserted: created.count  
    };
  }
}