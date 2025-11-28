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
    console.log(`Iniciando emisión DTE [Caso: ${casoPrueba}] [Folio Manual: ${folioManual}]`);

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

    // --- MAPEO DE PRODUCTOS (LÓGICA SET DE PRUEBAS) ---
    const detallesDTE = venta.detalle_venta.map((d, i) => {
        // Usamos el nombre guardado en la venta para respetar los nombres del Set de Pruebas
        const nombreItem = (d as any).nombre || d.producto.nombre; 
        
        const itemDTE: any = {
            "NroLinDet": i + 1,
            "Nombre": nombreItem.substring(0, 80), 
            "Cantidad": Number(d.cantidad),
            "Precio": Math.round(d.precio_unitario), 
            "MontoItem": Math.round(d.subtotal),
        };

        // CASO 4: Ítem exento
        // El set dice "item exento 2". Si detectamos esa frase, marcamos exención.
        if (casoPrueba === 'CASO-4' && nombreItem.toLowerCase().includes('exento')) {
            itemDTE.IndExe = 1; 
        }

        // CASO 5: Unidad Kg
        // El set dice "Arroz". Si es caso 5, forzamos Kg.
        if (casoPrueba === 'CASO-5') {
            itemDTE.UnmdItem = "Kg"; 
        }

        return itemDTE;
    });

    const passwordCertificado = this.configService.get<string>('SIMPLEAPI_CERT_PASS');
    let apiKey = this.configService.get<string>('SIMPLEAPI_KEY');

    if (!apiKey) throw new Error("Falta SIMPLEAPI_KEY");
    apiKey = apiKey.trim().replace(/^['"]|['"]$/g, ''); 

    // Usar folio manual si existe, sino el ID de venta
    const folioFinal = folioManual > 0 ? folioManual : venta.id_venta;

    console.log(`🎫 Generando XML con Folio: ${folioFinal}`);

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
                    // SimpleAPI recalcula, pero enviamos el total referencial
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
        console.log("📡 Enviando a SimpleAPI...");
        
        const response = await axios.post(urlApi, formData, {
            headers: {
                ...formData.getHeaders(),
                'Authorization': apiKey 
            }
        });

        // Log completo para depurar si sale undefined
        console.log("Respuesta SimpleAPI DATA:", JSON.stringify(response.data).substring(0, 200) + "...");

        return {
            ok: true,
            // Si la API no devuelve folio (a veces pasa en modo manual), usamos el que enviamos
            folio: response.data.Folio || folioFinal,
            timbre: response.data.TED || response.data.Timbre, 
            xml: response.data.XML // <--- ESTE ES EL ARCHIVO QUE NECESITAS
        };

    } catch (error) {
        const errorMsg = error.response?.data ? JSON.stringify(error.response.data) : error.message;
        console.error("Error SimpleAPI:", errorMsg);
        return { ok: false, error: errorMsg };
    }
  }
}