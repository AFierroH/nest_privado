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
  
  // Ahora aceptamos un 'folioManual' opcional para las pruebas
  async emitirDteDesdeVenta(idVenta: number, casoPrueba: string = '', folioManual: number = 0) {
    console.log(`Iniciando emisión DTE SimpleAPI para venta #${idVenta} [Caso: ${casoPrueba}] [Folio Manual: ${folioManual}]`);

    const venta = await this.prisma.venta.findUnique({
      where: { id_venta: idVenta },
      include: { empresa: true, detalle_venta: { include: { producto: true } } }
    });

    if (!venta) throw new Error('Venta no encontrada');

    const certPath = path.join(process.cwd(), 'certificados', '21289176-2_2025-10-20.pfx'); 
    const cafPath = path.join(process.cwd(), 'certificados', 'FoliosSII2128917639120251126250.xml'); 

    if (!fs.existsSync(certPath) || !fs.existsSync(cafPath)) {
        throw new Error(`Faltan archivos de certificación en: ${certPath}`);
    }

    // --- MAPEO INTELIGENTE PARA SET DE PRUEBAS ---
    const detallesDTE = venta.detalle_venta.map((d, i) => {
        // Usamos el nombre que viene en el detalle (el que mandamos desde el frontend)
        // Esto es crucial porque en el frontend mandamos los nombres exactos del PDF (ej: "Arroz")
        const nombreItem = (d as any).nombre || d.producto.nombre; 
        
        const itemDTE: any = {
            "NroLinDet": i + 1,
            "Nombre": nombreItem.substring(0, 80), 
            "Cantidad": Number(d.cantidad),
            "Precio": Math.round(d.precio_unitario), 
            "MontoItem": Math.round(d.subtotal),
        };

        if (casoPrueba === 'CASO-4') {
            if (nombreItem.toLowerCase().includes('exento')) {
                itemDTE.IndExe = 1; // 1 = Exento de IVA
            }
        }

        if (casoPrueba === 'CASO-5') {
            itemDTE.UnmdItem = "Kg"; // Obligatorio según el set para este caso
        }

        return itemDTE;
    });

    const passwordCertificado = this.configService.get<string>('SIMPLEAPI_CERT_PASS');
    let apiKey = this.configService.get<string>('SIMPLEAPI_KEY');

    if (!apiKey) throw new Error("Falta SIMPLEAPI_KEY en .env");
    apiKey = apiKey.trim().replace(/^['"]|['"]$/g, ''); 

    if (!passwordCertificado) throw new Error("Falta SIMPLEAPI_CERT_PASS en .env");

    // --- GESTIÓN DE FOLIOS ---
    // Si el frontend nos manda un folio manual (ej: 1, 2, 3), lo usamos.
    // Si no, usamos el ID de la venta como fallback (para producción).
    // OJO: SimpleAPI valida que el folio esté dentro del rango del CAF.
    const folioFinal = folioManual > 0 ? folioManual : venta.id_venta;

    console.log(`🎫 Usando Folio para XML: ${folioFinal}`);

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
            // Referencia es OBLIGATORIA para identificar que es una prueba del SET
            "Referencia": casoPrueba ? [{
                "NroLinRef": 1,
                "TpoDocRef": "SET", // Código para Set de Pruebas
                "FolioRef": "0",
                "RazonRef": casoPrueba // Ej: CASO-1
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
                'Authorization': apiKey 
            }
        });

        console.log("Respuesta SimpleAPI Éxito. Folio:", response.data.Folio);

        const timbreRaw = response.data.TED || response.data.Timbre;

        return {
            ok: true,
            folio: response.data.Folio,
            timbre: timbreRaw, 
            xml: response.data.XML
        };

    } catch (error) {
        const errorMsg = error.response?.data ? JSON.stringify(error.response.data) : error.message;
        console.error("Error SimpleAPI:", errorMsg);
        return { ok: false, error: errorMsg };
    }
  }
}