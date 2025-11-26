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

    // 1. Buscar venta
    const venta = await this.prisma.venta.findUnique({
      where: { id_venta: idVenta },
      include: { empresa: true, detalle_venta: { include: { producto: true } } }
    });

    if (!venta) throw new Error('Venta no encontrada');

    // 2. Rutas de archivos (Certificado y CAF)
    // ASEGÚRATE DE PONER TUS ARCHIVOS AQUÍ
    const certPath = path.join(process.cwd(), 'certificados', '21289176-2_2025-10-20.pfx'); 
    const cafPath = path.join(process.cwd(), 'certificados', 'FoliosSII2128917639120251126250.xml'); 

    if (!fs.existsSync(certPath) || !fs.existsSync(cafPath)) {
        throw new Error("Faltan archivos de Certificado (.p12) o CAF (.xml) en la carpeta certificados/");
    }

    // 3. Construir el JSON "Documento" según tu documentación
    const detallesDTE = venta.detalle_venta.map((d, i) => {
        const item: any = {
            "NroLinDet": i + 1,
            "Nombre": d.producto.nombre.substring(0, 40), // SimpleAPI a veces limita largo
            "Cantidad": d.cantidad,
            "Precio": Math.round(d.precio_unitario), 
            "MontoItem": Math.round(d.subtotal),
        };
        
        
        return item;
    });
    const passwordCertificado = this.configService.get<string>('SIMPLEAPI_CERT_PASS');
    
    if (!passwordCertificado) {
        throw new Error("ERROR CRÍTICO: No se ha configurado SIMPLEAPI_CERT_PASS en el archivo .env");
    }
    const jsonInput = {
        "Documento": {
            "Encabezado": {
                "IdentificacionDTE": {
                    "TipoDTE": 39, // Boleta
                    "Folio": 0,    // 0 = SimpleAPI usa el siguiente del CAF enviado
                    "FechaEmision": new Date().toISOString().split('T')[0], // YYYY-MM-DD
                    "IndicadorServicio": 3 // Ventas y Servicios
                },
                "Emisor": {
                    "Rut": "21289176-2", 
                    "RazonSocialBoleta": "MiPOSra",
                    "GiroBoleta": "Servicios Informaticos", // Ajustar a tu giro real
                    "DireccionOrigen": venta.empresa.direccion || "Sin direccion",
                    "ComunaOrigen": "Temuco" // Ajustar
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
            "Rut": "21289176-2", // Rut del dueño del certificado (sin DV ni puntos)
            "Password": passwordCertificado // <--- PON TU CONTRASEÑA REAL AQUÍ
        }
    };

    // 4. Preparar FormData (Multipart)
    const formData = new FormData();
    
    // El orden importa según la documentación:
    formData.append('files', fs.createReadStream(certPath));
    formData.append('files2', fs.createReadStream(cafPath));
    formData.append('input', JSON.stringify(jsonInput));

    const apiKey = this.configService.get<string>('SIMPLEAPI_KEY') || '';
    const urlApi = 'https://api.simpleapi.cl/api/v1/dte/generar';

    try {
        const response = await axios.post(urlApi, formData, {
            headers: {
                ...formData.getHeaders(),
                'Authorization': 'Basic ' + Buffer.from(apiKey).toString('base64')
            }
        });

        console.log("Respuesta SimpleAPI:", response.data);

        // SimpleAPI REST suele devolver { "Folio": 123, "TED": "...", "XML": "..." }
        // OJO: A veces devuelven "TED" (string XML del timbre) y a veces "Timbre" (Base64).
        // Si viene en Base64, hay que decodificarlo. Pero SimpleAPI suele mandar el XML crudo.
        const timbreRaw = response.data.TED || response.data.Timbre;

        return {
            ok: true,
            folio: response.data.Folio,
            timbre: timbreRaw, 
            xml: response.data.XML
        };

    } catch (error) {
        console.error("Error SimpleAPI:", error.response?.data || error.message);
        return { ok: false, error: JSON.stringify(error.response?.data) || error.message };
    }
  }
}