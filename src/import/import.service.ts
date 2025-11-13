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
    const content = fs.readFileSync(sqlFile, 'utf8');

    const dbName = process.env.DB_NAME || 'pos_sii_es';
    const typeResult = await this.prisma.$queryRawUnsafe(`
        SELECT COLUMN_NAME, DATA_TYPE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = '${dbName}' AND TABLE_NAME = '${destTable}'
    `);
    
    const destTypes = new Map<string, string>();
    for (const row of typeResult as any[]) {
        destTypes.set(row.COLUMN_NAME, row.DATA_TYPE.toLowerCase());
    }
  
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
      throw new Error('El parser no encontró filas "INSERT INTO" para la tabla seleccionada.');
    }

    const cleanedRows: any[] = [];
    for (const row of rowsToInsert) {
        const cleanedRow = {};
        for (const destCol in row) {
            let value = row[destCol];
            const type = destTypes.get(destCol);

            if (value === null || value === undefined) {
                cleanedRow[destCol] = null;
                continue;
            }
            
            // Si el valor es un string vacío (""), tratarlo como null
            if (value === "") {
                cleanedRow[destCol] = null;
                continue;
            }

            try {
                switch (type) {
                    case 'int':
                    case 'bigint':
                    case 'tinyint':
                        const intVal = parseInt(value, 10);
                        cleanedRow[destCol] = isNaN(intVal) ? null : intVal;
                        break;
                    case 'decimal':
                    case 'float':
                    case 'double':
                        const floatVal = parseFloat(value);
                        cleanedRow[destCol] = isNaN(floatVal) ? null : floatVal;
                        break;
                    case 'datetime':
                    case 'timestamp':
                        const dateVal = new Date(value);
                        cleanedRow[destCol] = isNaN(dateVal.getTime()) ? null : dateVal;
                        break;
                    case 'varchar':
                    case 'text':
                    case 'char':
                    default:
                        cleanedRow[destCol] = String(value);
                        break;
                }
            } catch (e) {
                cleanedRow[destCol] = null; 
            }
        }
        cleanedRows.push(cleanedRow);
    }

    const modelName = destTable.replace(/_([a-z])/g, g => g[1].toUpperCase());
    const model: any = (this.prisma as any)[modelName];
    if (!model) throw new Error(`Modelo Prisma no encontrado: ${modelName}`);

    await this.prisma.$transaction(async (tx) => {
  for (const row of cleanedRows) {
    const columns = Object.keys(row).join(', ');
    const values = Object.values(row)
  .map(v => {
    if (v === null || v === undefined) return 'NULL'
    const strVal = String(v)
    return `'${strVal.replace(/'/g, "''")}'`
  })
  .join(', ')

    const sql = `INSERT INTO \`${destTable}\` (${columns}) VALUES (${values})`;
    await tx.$executeRawUnsafe(sql);
  }
});

    fs.unlink(sqlFile, () => {});
    
    return { inserted: cleanedRows.length };
  }
}