import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma.service';
import { FoliosService } from '../folios/folios.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class DteService {
  // URL del microservicio PHP (Docker interno)
  // Usamos el puerto 80 porque dentro de la red Docker se ven directo
  private readonly dteUrl = 'http://dte_api:80'; 

  constructor(
    private prisma: PrismaService,
    private foliosService: FoliosService
  ) {}

  async emitirDteDesdeVenta(idVenta: number) {
    console.log(`🚀 Iniciando emisión DTE LOCAL ID Venta: ${idVenta}`);

    // 1. OBTENER DATOS DE LA VENTA
    const venta = await this.prisma.venta.findUnique({
      where: { id_venta: idVenta },
      include: { empresa: true, detalle_venta: { include: { producto: true } } }
    });

    if (!venta) throw new Error('Venta no encontrada');

    // 2. OBTENER FOLIO Y CAF (Fuente de la verdad)
    const { folio, cafArchivo } = await this.foliosService.obtenerSiguienteFolio(
      venta.empresa.id_empresa,
      39 // Boleta Electrónica
    );
    
    // Verificamos que tengamos CAF
    if (!cafArchivo) throw new Error("No se encontró archivo CAF activo para emitir. Carga un CAF en el sistema.");
    
    console.log(`🎫 Folio asignado (Oficial): ${folio}`);

    // 3. PREPARAR PAYLOAD PARA PHP (LibreDTE)
    const payload = {
        "caf": cafArchivo,
        "documento": {
            "Encabezado": {
                "IdDoc": {
                    "TipoDTE": 39,
                    "Folio": folio,
                    "FchEmis": new Date().toISOString().split('T')[0], // YYYY-MM-DD
                    "IndServicio": 3
                },
                "Emisor": {
                    "RUTEmisor": venta.empresa.rut,
                    "RznSoc": "MiPOSra", // Puedes usar venta.empresa.nombre si lo tienes
                    "GiroEmis": "Ventas",
                    "DirOrigen": venta.empresa.direccion || "Sin Direccion",
                    "CmnaOrigen": "Temuco"
                },
                "Receptor": {
                    "RUTRecep": "66666666-6",
                    "RznSocRecep": "Publico General",
                    "GiroRecep": "Particular",
                    "DirRecep": "S/D",
                    "CmnaRecep": "Temuco"
                },
                "Totales": {
                    "MntTotal": Math.round(venta.total)
                }
            },
            "Detalle": venta.detalle_venta.map((d, i) => ({
                "NroLinDet": i + 1,
                "NmbItem": ((d as any).nombre || d.producto.nombre).substring(0, 80), // Cortamos por seguridad
                "QtyItem": Number(d.cantidad),
                "PrcItem": Math.round(d.precio_unitario),
                "MontoItem": Math.round(d.subtotal)
            }))
        }
    };

    try {
        console.log(`📡 Enviando a microservicio PHP...`);
        
        // 4. LLAMADA AL MICROSERVICIO (PHP)
        const response = await axios.post(
            `${this.dteUrl}/dte/documentos/emitir`, 
            payload,
            { headers: { 'Content-Type': 'application/json' } }
        );

        const data = response.data;

        // Logs de depuración
        console.log("📦 RESPUESTA PHP:", JSON.stringify(data.mensaje || "OK"));

        // VALIDACIÓN CRÍTICA
        if (!data.xml || !data.ted) {
            console.error("⚠️ PHP respondió pero falta XML o TED:", data);
            throw new Error("El microservicio no generó el DTE correctamente (Falta XML o TED).");
        }

        // -------------------------------------------------------
        // 5. GUARDAR ARCHIVO XML EN DISCO (Para EnvioDTE futuro)
        // -------------------------------------------------------
        // Guardamos en 'uploads/xml_emitidos' que debe estar mapeado en Docker
        const uploadDir = path.join(process.cwd(), 'uploads', 'xml_emitidos');
        
        // Crear carpeta si no existe (recursivo)
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        // Nombre estandar: T39_F{Folio}.xml
        const fileName = `T39_F${folio}.xml`;
        const filePath = path.join(uploadDir, fileName);

        // Escribir archivo
        fs.writeFileSync(filePath, data.xml, { encoding: 'utf8' });
        console.log(`💾 XML guardado físicamente en: ${filePath}`);

        // -------------------------------------------------------
        // 6. ACTUALIZAR BASE DE DATOS
        // -------------------------------------------------------
        await this.prisma.venta.update({
            where: { id_venta: idVenta },
            data: {
                folio: folio,
                xml_dte: data.xml,      // Guardamos el XML string para reimpresión rápida
                estado_sii: 'PENDIENTE', // Marcamos para que el Cron Job lo tome después
                fecha_emision: new Date()
            }
        });

        // 7. RETORNAR AL FRONTEND
        return {
            ok: true,
            folio: folio,
            ted: data.ted,   // El XML del timbre (<TED>...</TED>) para imprimir
            xml: data.xml    // Por si el frontend lo quiere descargar
        };

    } catch (error) {
        console.error("❌ Error DTE Service:", error.message);
        // Si falló axios, intentamos mostrar qué dijo PHP
        if (axios.isAxiosError(error) && error.response) {
            console.error("DATA ERROR PHP:", JSON.stringify(error.response.data));
        }
        
        // Retornamos error pero manejado
        return { 
            ok: false, 
            error: error.message || "Error desconocido al emitir DTE",
            folio: folio // Devolvemos el folio para saber cuál falló
        }; 
    }
  }
}