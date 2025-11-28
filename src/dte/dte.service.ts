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
    console.log(`🚀 Iniciando emisión DTE [Caso: ${casoPrueba}] [Folio Manual: ${folioManual}]`);

    const venta = await this.prisma.venta.findUnique({
      where: { id_venta: idVenta },
      include: { empresa: true, detalle_venta: { include: { producto: true } } }
    });

    if (!venta) throw new Error('Venta no encontrada');

    const certPath = path.join(process.cwd(), 'certificados', '21289176-2_2025-10-20.pfx'); 
    const cafPath = path.join(process.cwd(), 'certificados', 'FoliosSII2128917639120251126250.xml'); 

    if (!fs.existsSync(certPath) || !fs.existsSync(cafPath)) {
        throw new Error(`Faltan archivos certificados en: ${certPath}`);
    }

    const detallesDTE = venta.detalle_venta.map((d, i) => {
        const nombreItem = (d as any).nombre || d.producto.nombre; 
        const itemDTE: any = {
            "NroLinDet": i + 1,
            "Nombre": nombreItem.substring(0, 80), 
            "Cantidad": Number(d.cantidad),
            "Precio": Math.round(d.precio_unitario), 
            "MontoItem": Math.round(d.subtotal),
        };

        if (casoPrueba === 'CASO-4' && nombreItem.toLowerCase().includes('exento')) {
            itemDTE.IndExe = 1; 
        }
        if (casoPrueba === 'CASO-5') {
            itemDTE.UnmdItem = "Kg"; 
        }
        return itemDTE;
    });

    const passwordCertificado = this.configService.get<string>('SIMPLEAPI_CERT_PASS');
    let apiKey = this.configService.get<string>('SIMPLEAPI_KEY');

    if (!apiKey) throw new Error("Falta SIMPLEAPI_KEY");
    apiKey = apiKey.trim().replace(/^['"]|['"]$/g, ''); 

    const folioFinal = folioManual > 0 ? folioManual : venta.id_venta;

    console.log(`🎫 Generando con Folio: ${folioFinal}`);

    const jsonInput = {
        "Documento": {
            "Encabezado": {
                "IdentificacionDTE": {
                    "TipoDTE": 39,
                    "Folio": folioFinal, 
                    "FechaEmision": new Date().toISOString().split('T')[0],
                    "IndicadorServicio": 3
                },
                "Emisor": {
                    "Rut": "21289176-2", 
                    "RazonSocialBoleta": "MiPOSra",
                    "GiroBoleta": "Servicios Informaticos",
                    "DireccionOrigen": venta.empresa.direccion || "Sin direccion",
                    "ComunaOrigen": "Temuco"
                },
                "Receptor": {
                    "Rut": "66666666-6",
                    "RazonSocial": "Cliente Boleta",
                    "Direccion": "Direccion",
                    "Comuna": "Temuco"
                },
                "Totales": {
                    "MontoTotal": Math.round(venta.total)
                }
            },
            "Detalles": detallesDTE,
            "Referencia": casoPrueba ? [{
                "NroLinRef": 1,
                "TpoDocRef": "SET",
                "FolioRef": "0",
                "RazonRef": casoPrueba
            }] : []
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
        console.log("Enviando a SimpleAPI...");
        
        const response = await axios.post(urlApi, formData, {
            headers: {
                ...formData.getHeaders(),
                'Authorization': apiKey,
                // Quitamos Accept JSON para recibir lo que manden
            }
        });

        // --- MANEJO DE RESPUESTA ---
        let xmlFinal = '';
        let timbreFinal = '';
        
        // 1. Si es texto plano (XML Crudo)
        if (typeof response.data === 'string') {
            console.log("Recibido XML Texto Plano");
            xmlFinal = response.data;
            
            // Extraer el tag <TED> usando Regex
            const matchTED = xmlFinal.match(/<TED[\s\S]*?<\/TED>/);
            if (matchTED) {
                timbreFinal = matchTED[0];
                console.log("Timbre (TED) extraído del XML");
            } else {
                console.warn("No se encontró etiqueta TED en el XML");
            }
        } 
        // 2. Si es Objeto JSON
        else if (typeof response.data === 'object') {
            console.log("Recibido Objeto JSON");
            xmlFinal = response.data.XML || response.data.xml;
            timbreFinal = response.data.TED || response.data.Timbre;
        }

        // Fallback
        if (!xmlFinal && response.data) {
             xmlFinal = JSON.stringify(response.data);
        }

        return {
            ok: true,
            folio: folioFinal, 
            timbre: timbreFinal, // ¡Ahora sí enviamos el timbre!
            xml: xmlFinal 
        };

    } catch (error) {
        const errorMsg = error.response?.data ? JSON.stringify(error.response.data) : error.message;
        console.error("Error SimpleAPI:", errorMsg);
        return { ok: false, error: errorMsg };
    }
  }
}