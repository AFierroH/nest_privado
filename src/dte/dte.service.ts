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
    console.log(`Iniciando emisión DTE SimpleAPI (REST) para venta #${idVenta} [Caso: ${casoPrueba || 'Normal'}]`);

    // Obtenemos la venta. Asegúrate de que tu modelo Prisma tenga estos campos.
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

    // --- MAPEO INTELIGENTE PARA CASOS DE PRUEBA ---
    const detallesDTE = venta.detalle_venta.map((d, i) => {
        // Preferimos el nombre guardado en la venta (snapshot), si no, el del producto maestro
        // (Nota: 'nombre' debe existir en tu modelo detalle_venta, si no usa d.producto.nombre)
        const nombreItem = (d as any).nombre || d.producto.nombre; 
        
        const itemDTE: any = {
            "NroLinDet": i + 1,
            "Nombre": nombreItem.substring(0, 80), // SimpleAPI soporta 80
            "Cantidad": Number(d.cantidad),
            "Precio": Math.round(d.precio_unitario), 
            "MontoItem": Math.round(d.subtotal),
        };

        // LÓGICA ESPECÍFICA PARA EL SET DE PRUEBAS SII
        // CASO 4: Requiere items exentos
        if (casoPrueba === 'CASO-4') {
            // El set dice: "item exento 2". Buscamos esa palabra clave.
            if (nombreItem.toLowerCase().includes('exento')) {
                itemDTE.IndExe = 1; // 1 = Exento de IVA
            }
        }

        // CASO 5: Requiere Unidad de Medida Kg
        if (casoPrueba === 'CASO-5') {
            itemDTE.UnmdItem = "Kg"; // Obligatorio según el set
        }

        return itemDTE;
    });

    const passwordCertificado = this.configService.get<string>('SIMPLEAPI_CERT_PASS');
    let apiKey = this.configService.get<string>('SIMPLEAPI_KEY');

    if (!apiKey) throw new Error("Falta SIMPLEAPI_KEY en .env");
    apiKey = apiKey.trim().replace(/^['"]|['"]$/g, ''); 

    if (!passwordCertificado) throw new Error("Falta SIMPLEAPI_CERT_PASS en .env");

    // --- GESTIÓN DE FOLIOS ---
    // IMPORTANTE: En certificación, los folios se gastan.
    // Si ya usaste el 1, cambia esto manualmente a 2, 3, etc. o implementa lógica en BD.
    // Para el set de pruebas, intenta usar folios distintos para cada caso si puedes.
    const folioAUsar = 10; // <--- AJUSTA ESTE NÚMERO PARA CADA PRUEBA SI FALLA POR "FOLIO USADO"

    console.log(`🎫 Usando Folio Manual: ${folioAUsar}`);

    const jsonInput = {
        "Documento": {
            "Encabezado": {
                "IdentificacionDTE": {
                    "TipoDTE": 39,
                    "Folio": folioAUsar,
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
                    // Nota: Si hay exentos (Caso 4), SimpleAPI suele recalcular, 
                    // pero idealmente deberías separar Neto/Exento aquí. 
                    // Por simplicidad enviamos MontoTotal y dejamos que la API haga su magia.
                    "MontoTotal": Math.round(venta.total)
                }
            },
            "Detalles": detallesDTE,
            // Referencia OBLIGATORIA para el Set de Pruebas
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