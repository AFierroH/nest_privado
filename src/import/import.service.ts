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
    // 1. Recibimos empresaId del frontend
    const { uploadId, sourceTable, destTable, mapping, staticValues, empresaId } = body;
    const sqlFile = path.join(this.uploadsDir, `${uploadId}.sql`);

    if (!fs.existsSync(sqlFile)) throw new Error(`Archivo SQL no encontrado`);

    const content = fs.readFileSync(sqlFile, 'utf8');
    const dbName = process.env.DB_NAME || 'pos_sii_es';

    // Obtener Tipos y Nulabilidad de la BD
    const typeResult = await this.prisma.$queryRawUnsafe(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = '${dbName}' AND TABLE_NAME = '${destTable}'
    `);

    // Guardamos info de columnas para saber tipos y si existe id_empresa
    const destInfo = new Map<string, { type: string, nullable: boolean }>();
    for (const row of typeResult as any[]) {
      destInfo.set(row.COLUMN_NAME, { 
        type: row.DATA_TYPE.toLowerCase(), 
        nullable: row.IS_NULLABLE === 'YES' 
      });
    }

    const insertRegex = new RegExp(`INSERT INTO\\s+\`?${sourceTable}\`?\\s*\\(([^)]+)\\)\\s*VALUES\\s*([\\s\\S]+?);`, 'gi');
    let match;
    const cleanedRows: any[] = [];

    while ((match = insertRegex.exec(content))) {
      const cols = match[1].split(',').map(c => c.replace(/`/g, '').trim());
      const tuples = match[2].match(/\(([^)]+)\)/g) || [];

      for (const t of tuples) {
        const vals = this.parseSqlValues(t.substring(1, t.length - 1));
        const rowObject: any = {};

        for (const destCol in mapping) {
          const src = mapping[destCol];
          if (!src || src === '' || src === '__skip') continue;

          let rawValue: any = null;
          if (src === '__static') rawValue = staticValues?.[destCol];
          else if (cols.includes(src)) rawValue = vals[cols.indexOf(src)];

          const colInfo = destInfo.get(destCol);
          const type = colInfo?.type || 'string';
          
          if (rawValue === 'NULL' || rawValue === undefined) rawValue = null;
          if (typeof rawValue === 'string') rawValue = rawValue.trim();

          if (rawValue === null || rawValue === '') {
             if (colInfo?.nullable) {
                 rowObject[destCol] = null;
             } else {
                 if (/int|float|double|decimal/.test(type)) rowObject[destCol] = 0;
                 else if (/bool/.test(type)) rowObject[destCol] = false;
                 else rowObject[destCol] = "";
             }
             continue; 
          }

          try {
            if (/int/.test(type)) {
              const cleanNum = String(rawValue).replace(/[^0-9.-]/g, ''); 
              rowObject[destCol] = parseInt(cleanNum, 10);
            } else if (/(decimal|float|double)/.test(type)) {
              const cleanNum = String(rawValue).replace(/[^0-9.-]/g, '');
              rowObject[destCol] = parseFloat(cleanNum);
            } else if (/(datetime|timestamp|date)/.test(type)) {
              const d = new Date(rawValue);
              rowObject[destCol] = isNaN(d.getTime()) ? new Date() : d;
            } else if (/(bit|boolean|tinyint)/.test(type)) {
              rowObject[destCol] = ['1', 'true', 'on', 'yes'].includes(String(rawValue).toLowerCase());
            } else {
              rowObject[destCol] = String(rawValue);
            }
          } catch (e) {
            rowObject[destCol] = null;
          }
        }
        
        // 2. FORZADO AUTOMÁTICO DE EMPRESA (OPCIÓN 2)
        // Si la tabla destino tiene columna 'id_empresa', le clavamos el ID de la sesión
        if (destInfo.has('id_empresa') && empresaId) {
            rowObject['id_empresa'] = Number(empresaId);
        }

        if (Object.keys(rowObject).length > 0) {
            cleanedRows.push(rowObject);
        }
      }
    }

    const modelName = destTable.replace(/_([a-z])/g, (_, g) => g.toUpperCase());
    const prismaModel = (this.prisma as any)[modelName] || (this.prisma as any)[destTable];

    if (!prismaModel) throw new Error(`Modelo Prisma no encontrado: ${destTable}`);

    const BATCH_SIZE = 500;
    let insertedCount = 0;
    for (let i = 0; i < cleanedRows.length; i += BATCH_SIZE) {
        const batch = cleanedRows.slice(i, i + BATCH_SIZE);
        const res = await prismaModel.createMany({
            data: batch,
            skipDuplicates: true,
        });
        insertedCount += res.count;
    }

    fs.unlink(sqlFile, () => {});
    return { inserted: insertedCount };
  }
}