import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma.service';
import { FoliosService } from '../folios/folios.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class DteService {
  private readonly dteUrl = 'http://dte_api:80';

  constructor(
    private prisma: PrismaService,
    private foliosService: FoliosService
  ) {}


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

const { folio, cafArchivo } = await this.foliosService.obtenerSiguienteFolio(
        venta.empresa.id_empresa,
        39
      );
      
      if (!cafArchivo) {
        throw new Error("No hay archivo CAF disponible");
      }

      let cafLimpio = cafArchivo;
      
      if (cafLimpio.includes('\\n')) {
          cafLimpio = cafLimpio.replace(/\\n/g, ''); 
      }
      
      cafLimpio = cafLimpio.trim();
      
      console.log(`Folio asignado: ${folio}`);

      // 3. PREPARAR PAYLOAD PARA LIBREDTE
      const payload = {
        caf: cafLimpio,
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

      const response = await axios.post(
        `${this.dteUrl}/dte/documentos/emitir`, 
        payload,
        { headers: { 'Content-Type': 'application/json' }, timeout: 15000 }
      );

      const data = response.data;
      
      if (!data.xml || !data.ted) {
        throw new Error("El microservicio no generó XML o TED correctamente");
      }

      const uploadDir = path.join(process.cwd(), 'uploads', 'xml_emitidos');
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
      
      const filePath = path.join(uploadDir, `T39_F${folio}.xml`);
      fs.writeFileSync(filePath, data.xml, { encoding: 'utf8' });


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