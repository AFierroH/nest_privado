import { Injectable } from '@nestjs/common';
import axios from 'axios';
import FormData from 'form-data';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';

@Injectable()
export class DteService {
  constructor(private prisma: PrismaService, private configService: ConfigService) {}
  
  async emitirDteDesdeVenta(idVenta: number, casoPrueba: string = '', folioManual: number = 0) {
    console.log(`🚀 Iniciando emisión DTE Real ID: ${idVenta}`);

    const venta = await this.prisma.venta.findUnique({
      where: { id_venta: idVenta },
      include: { empresa: true, detalle_venta: { include: { producto: true } } }
    });

    if (!venta) throw new Error('Venta no encontrada');

    // RUTAS CERTIFICADOS (Asegúrate que sean correctas en tu servidor)
    const certPath = path.join(process.cwd(), 'certificados', '21289176-2_2025-10-20.pfx'); 
    const cafPath = path.join(process.cwd(), 'certificados', 'FoliosSII2128917639120251126250.xml'); 

    if (!fs.existsSync(certPath) || !fs.existsSync(cafPath)) {
        console.error("Faltan certificados");
        throw new Error(`Faltan archivos certificados`);
    }

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

    // Usar el ID de venta como folio si no es manual
    const folioFinal = folioManual > 0 ? folioManual : venta.id_venta;

    const jsonInput = {
        "Documento": {
            "Encabezado": {
                "IdentificacionDTE": {
                    "TipoDTE": 39,
                    "Folio": folioFinal, 
                    "FechaEmision": new Date().toISOString().split('T')[0],
                    "IndicadorServicio": 3 // Boleta electrónica
                },
                "Emisor": {
                    "Rut": "21289176-2", 
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
            "Rut": "21289176-2",
            "Password": passwordCertificado
        }
    };

    const formData = new FormData();
    formData.append('files', fs.createReadStream(certPath));
    formData.append('files2', fs.createReadStream(cafPath));
    formData.append('input', JSON.stringify(jsonInput));

    const urlApi = 'https://api.simpleapi.cl/api/v1/dte/generar';

    try {
        console.log("📡 Enviando a SimpleAPI...");
        
        // Quitamos headers manuales complejos, dejamos que axios y form-data lo manejen,
        // Solo inyectamos el Authorization.
        const headers = {
            ...formData.getHeaders(),
            'Authorization': apiKey ? apiKey.trim() : ''
        };

        const response = await axios.post(urlApi, formData, { headers });

        let xmlFinal = '';
        let timbreFinal = '';
        
        // Manejo de respuesta
        if (typeof response.data === 'string') {
            xmlFinal = response.data;
        } else if (typeof response.data === 'object') {
            xmlFinal = response.data.XML || response.data.xml || JSON.stringify(response.data);
        }

        // --- EXTRACCIÓN ROBUSTA DEL TED ---
        // Buscamos explícitamente el bloque <TED>...</TED>
        const matchTED = xmlFinal.match(/<TED version="1.0">[\s\S]*?<\/TED>/);
        
        if (matchTED) {
            timbreFinal = matchTED[0];
            console.log("✅ Timbre (TED) extraído correctamente");
        } else {
            // Intentar regex más flexible por si acaso
            const matchFlexible = xmlFinal.match(/<TED[\s\S]*?<\/TED>/);
            if (matchFlexible) {
                timbreFinal = matchFlexible[0];
                console.log("✅ Timbre (TED) extraído (Flexible)");
            } else {
                console.warn("⚠️ No se encontró etiqueta TED en el XML recibido");
            }
        }

        return {
            ok: true,
            folio: folioFinal, 
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