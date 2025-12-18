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
      // 1. OBTENER VENTA
      const venta = await this.prisma.venta.findUnique({
        where: { id_venta: idVenta },
        include: { 
          empresa: true, 
          detalle_venta: { include: { producto: true } } 
        }
      });

      if (!venta) throw new Error(`Venta ${idVenta} no encontrada`);

      console.log(`Venta encontrada - Empresa: ${venta.empresa.rut}`);

      // 2. OBTENER FOLIO Y CAF (ya viene limpio desde foliosService)
      const { folio, cafArchivo } = await this.foliosService.obtenerSiguienteFolio(
        venta.empresa.id_empresa,
        39
      );
      
      if (!cafArchivo) {
        throw new Error("No hay archivo CAF disponible");
      }

      console.log(`Folio asignado: ${folio}`);
      console.log(`CAF length: ${cafArchivo.length} chars`);
      console.log(`CAF preview (primeros 100): ${cafArchivo.substring(0, 100)}`);

      // 3. PREPARAR PAYLOAD
      const payload = {
        caf: cafArchivo, // Ya viene limpio
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

      console.log('Datos del payload:');
      console.log(`   - RUT Emisor: ${payload.documento.Encabezado.Emisor.RUTEmisor}`);
      console.log(`   - Folio: ${payload.documento.Encabezado.IdDoc.Folio}`);
      console.log(`   - Total: ${payload.documento.Encabezado.Totales.MntTotal}`);

      // 4. ENVIAR A LIBREDTE
      console.log(`Enviando a LibreDTE (${this.dteUrl})...`);
      
      const response = await axios.post(
        `${this.dteUrl}/dte/documentos/emitir`, 
        payload,
        { 
          headers: { 'Content-Type': 'application/json' },
          timeout: 15000
        }
      );

      const data = response.data;
      
      console.log(`Respuesta LibreDTE:`, {
        estado: data.estado,
        mensaje: data.mensaje,
        tiene_xml: !!data.xml,
        tiene_ted: !!data.ted,
        ted_preview: data.ted ? data.ted.substring(0, 100) : 'N/A'
      });

      // 5. VALIDAR RESPUESTA
      if (!data.xml || !data.ted) {
        throw new Error("LibreDTE no generó XML o TED");
      }

      // 6. VERIFICAR QUE NO SEA FAKE
      if (data.ted.includes('Fake-Code') || data.ted.includes('fake')) {
        console.error('   TED es FAKE. Posibles causas:');
        console.error('   1. RUT del CAF no coincide con RUT Emisor');
        console.error('   2. CAF mal formado o corrupto');
        console.error('   3. Certificado PFX incorrecto');
        throw new Error('TED generado es falso (Fake-Code). Verifica CAF y certificado.');
      }

      console.log('TED válido recibido');

      // 7. GUARDAR XML
      const uploadDir = path.join(process.cwd(), 'uploads', 'xml_emitidos');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      
      const filePath = path.join(uploadDir, `T39_F${folio}.xml`);
      fs.writeFileSync(filePath, data.xml, { encoding: 'utf8' });
      
      console.log(`XML guardado: ${filePath}`);

      // 8. ACTUALIZAR BD
      await this.prisma.venta.update({
        where: { id_venta: idVenta },
        data: {
          folio: folio,
          xml_dte: data.xml,
          estado_sii: 'EMITIDO', // Cambiar a EMITIDO si es exitoso
          fecha_emision: new Date()
        }
      });

      console.log(`Venta actualizada con folio ${folio}`);

      // 9. RETORNAR
      return {
        ok: true,
        folio: folio,
        ted: data.ted,
        xml: data.xml,
        pdf417Base64: null // Por ahora null, luego lo generamos
      };

    } catch (error) {
      console.error(`[DTE] Error:`, error.message);
      
      if (axios.isAxiosError(error)) {
        console.error("HTTP Status:", error.response?.status);
        console.error("Response:", JSON.stringify(error.response?.data));
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