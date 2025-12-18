import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma.service';
import { FoliosService } from '../folios/folios.service';
import * as fs from 'fs';
import * as path from 'path';
import * as bwipjs from 'bwip-js';

@Injectable()
export class DteService {
  private readonly dteUrl = 'http://dte_api:80';

  constructor(
    private prisma: PrismaService,
    private foliosService: FoliosService
  ) {}

  /**
   * Genera imagen PNG del PDF417 sin modificar (para mantener validez del código)
   */
  private async generarPdf417Imagen(tedXml: string): Promise<string | null> {
    try {
      const cleanData = tedXml.trim().replace(/\s+/g, ' ');

      console.log('Generando imagen PDF417...');

      const pngBuffer = await bwipjs.toBuffer({
        bcid: 'pdf417',
        text: cleanData,
        // @ts-ignore - eclevel existe pero no está en los tipos de @types/bwip-js
        eclevel: 5,
        rowheight: 8,
        scale: 3,
        includetext: false,
        paddingwidth: 8,
        paddingheight: 8,
      } as any);

      if (!pngBuffer) {
        throw new Error('No se generó buffer de imagen');
      }

      const base64 = (pngBuffer as Buffer).toString('base64');
      console.log(`PDF417 generado (${(pngBuffer as Buffer).length} bytes)`);

      return base64;

    } catch (error) {
      console.error('Error generando PDF417:', error);
      return null;
    }
  }

  async emitirDteDesdeVenta(idVenta: number) {
    console.log(`[DTE] Iniciando emisión para Venta ID: ${idVenta}`);

    try {
      // 1. OBTENER DATOS DE LA VENTA
      const venta = await this.prisma.venta.findUnique({
        where: { id_venta: idVenta },
        include: { 
          empresa: true, 
          detalle_venta: { include: { producto: true } } 
        }
      });

      if (!venta) {
        throw new Error(`Venta ${idVenta} no encontrada en BD`);
      }

      console.log(`Venta encontrada - Empresa: ${venta.empresa.rut}`);

      // 2. OBTENER FOLIO Y CAF
      const { folio, cafArchivo } = await this.foliosService.obtenerSiguienteFolio(
        venta.empresa.id_empresa,
        39
      );
      
      if (!cafArchivo) {
        throw new Error("No hay archivo CAF disponible");
      }
      
      console.log(`Folio asignado: ${folio}`);

      // 3. PREPARAR PAYLOAD PARA LIBREDTE
      const payload = {
        caf: cafArchivo,
        documento: {
          Encabezado: {
            IdDoc: {
              TipoDTE: 39,
              Folio: folio,
              FchEmis: new Date().toISOString().split('T')[0],
              IndServicio: 3
            },
            Emisor: {
              RUTEmisor: venta.empresa.rut,
              RznSoc: venta.empresa.nombre || "MiPOSra",
              GiroEmis: "Ventas",
              DirOrigen: venta.empresa.direccion || "Sin Direccion",
              CmnaOrigen: "Temuco"
            },
            Receptor: {
              RUTRecep: "66666666-6",
              RznSocRecep: "Publico General",
              GiroRecep: "Particular",
              DirRecep: "S/D",
              CmnaRecep: "Temuco"
            },
            Totales: {
              MntTotal: Math.round(venta.total)
            }
          },
          Detalle: venta.detalle_venta.map((d, i) => ({
            NroLinDet: i + 1,
            NmbItem: ((d as any).nombre || d.producto.nombre).substring(0, 80),
            QtyItem: Number(d.cantidad),
            PrcItem: Math.round(d.precio_unitario),
            MontoItem: Math.round(d.subtotal)
          }))
        }
      };

      console.log(`Enviando a LibreDTE...`);

      // 4. LLAMADA AL MICROSERVICIO
      const response = await axios.post(
        `${this.dteUrl}/dte/documentos/emitir`, 
        payload,
        { 
          headers: { 'Content-Type': 'application/json' },
          timeout: 15000
        }
      );

      const data = response.data;
      console.log(`LibreDTE respondió: ${data.mensaje || 'OK'}`);

      // 5. VALIDAR RESPUESTA
      if (!data.xml || !data.ted) {
        console.error("Respuesta incompleta:", JSON.stringify(data));
        throw new Error("El microservicio no generó XML o TED correctamente");
      }

      // 6. GUARDAR XML EN DISCO
      const uploadDir = path.join(process.cwd(), 'uploads', 'xml_emitidos');
      
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const fileName = `T39_F${folio}.xml`;
      const filePath = path.join(uploadDir, fileName);
      fs.writeFileSync(filePath, data.xml, { encoding: 'utf8' });
      
      console.log(`XML guardado en: ${filePath}`);

      // 7. GENERAR IMAGEN PDF417 DEL TIMBRE
      let pdf417Base64: any = null;
      if (data.ted) {
        pdf417Base64 = await this.generarPdf417Imagen(data.ted);
      }

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

      console.log(`Venta actualizada en BD con folio ${folio}`);

      // 9. RETORNAR RESPUESTA COMPLETA
      return {
        ok: true,
        folio: folio,
        ted: data.ted,              // XML del TED (para validación)
        xml: data.xml,              // XML completo
        pdf417Base64: pdf417Base64  // Imagen PNG base64 (para imprimir)
      };

    } catch (error) {
      console.error(`[DTE] Error:`, error.message);
      
      if (axios.isAxiosError(error)) {
        console.error("Status:", error.response?.status);
        console.error("Data:", JSON.stringify(error.response?.data));
      }

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