import { Injectable } from '@nestjs/common';
import axios from 'axios';
import FormData from 'form-data';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';
import { FoliosService } from '../folios/folios.service';
import { Readable } from 'stream'; // <--- IMPORTANTE: Importar Readable

@Injectable()
export class DteService {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private foliosService: FoliosService
  ) {}

  async emitirDteDesdeVenta(idVenta: number, casoPrueba: string = '', folioManual: number = 0) {
    console.log(`Iniciando emisión DTE Real ID: ${idVenta}`);

    const venta = await this.prisma.venta.findUnique({
      where: { id_venta: idVenta },
      include: { empresa: true, detalle_venta: { include: { producto: true } } }
    });

    if (!venta) throw new Error('Venta no encontrada');

    // 1. Obtener Folio y CAF desde la BD (foliosService)
    // OJO: folioManual lo ignoramos por ahora si usas el sistema automático
    const { folio, cafArchivo } = await this.foliosService.obtenerSiguienteFolio(
      venta.empresa.id_empresa,
      39 // Boleta Electrónica
    );

    // 2. Ruta del Certificado Digital (PFX) - ESTE SÍ SIGUE EN DISCO
    // Asegúrate de que el nombre del archivo coincida con lo que tienes en la carpeta certificados
    const certPath = path.join(process.cwd(), 'certificados', '21289176-2_2025-10-20.pfx');

    if (!fs.existsSync(certPath)) {
        console.error("Falta certificado digital PFX");
        throw new Error(`Falta archivo certificado PFX en: ${certPath}`);
    }
    // Nota: El CAF ya no se chequea con fs.existsSync porque viene de la BD como string.

    const detallesDTE = venta.detalle_venta.map((d, i) => {
        const nombreItem = (d as any).nombre || d.producto.nombre;
        return {
            "NroLinDet": i + 1,
            "Nombre": nombreItem.substring(0, 80),
            "Cantidad": Number(d.cantidad),
            "Precio": Math.round(d.precio_unitario),
            "MontoItem": Math.round(d.subtotal),
        };
    });

    const passwordCertificado = this.configService.get<string>('SIMPLEAPI_CERT_PASS');
    let apiKey = this.configService.get<string>('SIMPLEAPI_KEY');

    const jsonInput = {
        "Documento": {
            "Encabezado": {
                "IdentificacionDTE": {
                    "TipoDTE": 39,
                    "Folio": folio,
                    "FechaEmision": new Date().toISOString().split('T')[0],
                    "IndicadorServicio": 3
                },
                "Emisor": {
                    "Rut": venta.empresa.rut.replace(/\./g, ''),
                    "RazonSocialBoleta": "MiPOSra",
                    "GiroBoleta": "Servicios Informaticos",
                    "DireccionOrigen": venta.empresa.direccion || "Temuco Centro",
                    "ComunaOrigen": "Temuco"
                },
                "Receptor": {
                    "Rut": "66666666-6",
                    "RazonSocial": "Cliente Boleta",
                    "Direccion": "S/D",
                    "Comuna": "Temuco"
                },
                "Totales": {
                    "MontoTotal": Math.round(venta.total)
                }
            },
            "Detalles": detallesDTE
        },
        "Certificado": {
            "Rut": venta.empresa.rut.replace(/\./g, ''),
            "Password": passwordCertificado
        }
    };

    const formData = new FormData();
    
    // Archivo 1: Certificado PFX (desde disco)
    formData.append('files', fs.createReadStream(certPath));

    // Archivo 2: CAF (desde memoria/string BD) <--- CAMBIO CLAVE
    // Convertimos el string XML a un Stream para que FormData lo acepte como archivo
    const cafStream = Readable.from([cafArchivo]); 
    formData.append('files2', cafStream, { filename: 'caf.xml', contentType: 'text/xml' });

    formData.append('input', JSON.stringify(jsonInput));

    const urlApi = 'https://api.simpleapi.cl/api/v1/dte/generar';

    try {
        console.log(`📡 Enviando a SimpleAPI (Folio: ${folio})...`);
        
        const headers = {
            ...formData.getHeaders(),
            'Authorization': apiKey ? apiKey.trim() : ''
        };

        const response = await axios.post(urlApi, formData, { headers });

        let xmlFinal = '';
        let timbreFinal = '';
        
        if (typeof response.data === 'string') {
            xmlFinal = response.data;
        } else if (typeof response.data === 'object') {
            xmlFinal = response.data.XML || response.data.xml || JSON.stringify(response.data);
        }

        const matchTED = xmlFinal.match(/<TED version="1.0">[\s\S]*?<\/TED>/);
        
        if (matchTED) {
            timbreFinal = matchTED[0];
            console.log("✅ Timbre (TED) extraído correctamente");
        } else {
             // Fallback
            const matchFlexible = xmlFinal.match(/<TED[\s\S]*?<\/TED>/);
            if (matchFlexible) {
                timbreFinal = matchFlexible[0];
            } else {
                console.warn("⚠️ No se encontró etiqueta TED en el XML recibido");
            }
        }

        return {
            ok: true,
            folio,
            timbre: timbreFinal,
            xml: xmlFinal
        };

    } catch (error) {
        console.error("❌ Error SimpleAPI:", error.message);
        if (error.response) console.error("Detalle:", error.response.data);
        return { ok: false, error: error.message };
    }
  }
}