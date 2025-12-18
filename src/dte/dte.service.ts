import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma.service';
import { FoliosService } from '../folios/folios.service';
import * as fs from 'fs';
import * as path from 'path';
// BORRAR ESTO: import * as bwipjs from 'bwip-js';  <-- YA NO SE NECESITA

@Injectable()
export class DteService {
  private readonly dteUrl = 'http://dte_api:80';

  constructor(
    private prisma: PrismaService,
    private foliosService: FoliosService
  ) {}

  // BORRAR TODA LA FUNCIÓN: private async generarPdf417Imagen(...) { ... }

  async emitirDteDesdeVenta(idVenta: number) {
    console.log(`[DTE] Iniciando emisión para Venta ID: ${idVenta}`);

    try {
      // 1. OBTENER DATOS (Igual que antes)
      const venta = await this.prisma.venta.findUnique({
        where: { id_venta: idVenta },
        include: { 
          empresa: true, 
          detalle_venta: { include: { producto: true } } 
        }
      });

      if (!venta) throw new Error(`Venta ${idVenta} no encontrada en BD`);

      // 2. OBTENER FOLIO (Igual que antes)
      const { folio, cafArchivo } = await this.foliosService.obtenerSiguienteFolio(
        venta.empresa.id_empresa,
        39
      );
      
      // 3. PREPARAR PAYLOAD (Igual que antes)
      const payload = {
          // ... (tu código del payload se mantiene igual)
      };

      console.log(`Enviando a LibreDTE...`);

      // 4. LLAMADA AL MICROSERVICIO
      const response = await axios.post(
        `${this.dteUrl}/dte/documentos/emitir`, 
        payload,
        { headers: { 'Content-Type': 'application/json' }, timeout: 15000 }
      );

      const data = response.data;
      
      // 5. VALIDAR RESPUESTA
      if (!data.xml || !data.ted) {
        throw new Error("El microservicio no generó XML o TED correctamente");
      }

      // 6. GUARDAR XML EN DISCO (Esto sí déjalo, es un buen respaldo)
      const uploadDir = path.join(process.cwd(), 'uploads', 'xml_emitidos');
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
      
      const filePath = path.join(uploadDir, `T39_F${folio}.xml`);
      fs.writeFileSync(filePath, data.xml, { encoding: 'utf8' });

      // 7. (PASO ELIMINADO) YA NO GENERAMOS IMAGEN AQUÍ

      // 8. ACTUALIZAR BASE DE DATOS
      await this.prisma.venta.update({
        where: { id_venta: idVenta },
        data: {
          folio: folio,
          xml_dte: data.xml,
          estado_sii: 'PENDIENTE',
          fecha_emision: new Date()
        }
      });

      console.log(`Venta finalizada. Folio: ${folio}`);

      // 9. RETORNAR SOLO LOS DATOS
      return {
        ok: true,
        folio: folio,
        ted: data.ted,      // El frontend usará esto para generar el código
        xml: data.xml,      // El XML completo
        pdf417Base64: null  // Explícito que no hay imagen
      };

    } catch (error) {
      console.error(`[DTE] Error:`, error.message);
      return { 
        ok: false, 
        error: error.message || "Error desconocido",
        folio: null,
        ted: null,
        xml: null,
        pdf417Base64: null
      }; 
    }
  }
}