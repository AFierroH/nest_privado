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
  
  async emitirDteDesdeVenta(idVenta: number, casoPrueba: string = '') {
    console.log(`Iniciando emisión DTE SimpleAPI (REST) para venta #${idVenta}`);

    const venta = await this.prisma.venta.findUnique({
      where: { id_venta: idVenta },
      include: { empresa: true, detalle_venta: { include: { producto: true } } }
    });

    if (!venta) throw new Error('Venta no encontrada');

    const certPath = path.join(process.cwd(), 'certificados', '21289176-2_2025-10-20.pfx'); 
    const cafPath = path.join(process.cwd(), 'certificados', 'FoliosSII2128917639120251126250.xml'); 

    if (!fs.existsSync(certPath) || !fs.existsSync(cafPath)) {
        throw new Error(`Faltan archivos. Buscando en: ${certPath}`);
    }

    const detallesDTE = venta.detalle_venta.map((d, i) => {
        return {
            "NroLinDet": i + 1,
            "Nombre": d.producto.nombre.substring(0, 40),
            "Cantidad": d.cantidad,
            "Precio": Math.round(d.precio_unitario), 
            "MontoItem": Math.round(d.subtotal),
        };
    });

    const passwordCertificado = this.configService.get<string>('SIMPLEAPI_CERT_PASS');
    let apiKey = this.configService.get<string>('SIMPLEAPI_KEY');

    // --- BLOQUE DE DEPURACIÓN CRÍTICO ---
    if (!apiKey) {
        console.error("❌ ERROR: La variable SIMPLEAPI_KEY es undefined o vacía.");
        throw new Error("Falta SIMPLEAPI_KEY en .env");
    }

    // Limpiamos espacios y comillas que a veces se cuelan en Docker
    apiKey = apiKey.trim().replace(/^['"]|['"]$/g, ''); 

    console.log(`🔑 DEBUG API KEY: Longitud=${apiKey.length}, Inicio=${apiKey.substring(0, 4)}****`);
    // ------------------------------------

    if (!passwordCertificado) throw new Error("Falta SIMPLEAPI_CERT_PASS en .env");

    const jsonInput = {
        "Documento": {
            "Encabezado": {
                "IdentificacionDTE": {
                    "TipoDTE": 39,
                    "Folio": 0, 
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
            },
            auth: {
                username: apiKey, 
                password: '' 
            }
        });

        console.log("✅ Respuesta SimpleAPI Éxito. Folio:", response.data.Folio);

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
        
        // Si es 401, lanzamos error específico
        if (error.response?.status === 401) {
             console.error("Verifica que tu API KEY sea correcta en https://simpleapi.cl/admin");
        }
        
        return { ok: false, error: errorMsg };
    }
  }
}