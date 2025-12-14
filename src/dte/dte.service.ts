import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma.service';
import { FoliosService } from '../folios/folios.service';

@Injectable()
export class DteService {
  // URL interna de Docker (nombre del servicio en docker-compose)
  private readonly libredteUrl = 'http://libredte_web'; 

  constructor(
    private prisma: PrismaService,
    private foliosService: FoliosService
  ) {}

  async emitirDteDesdeVenta(idVenta: number) {
    console.log(`Iniciando emisión DTE LOCAL (LibreDTE) ID: ${idVenta}`);

    const venta = await this.prisma.venta.findUnique({
      where: { id_venta: idVenta },
      include: { empresa: true, detalle_venta: { include: { producto: true } } }
    });

    if (!venta) throw new Error('Venta no encontrada');

    // 1. Obtener Folio (Tu lógica de folios sigue igual)
    const { folio } = await this.foliosService.obtenerSiguienteFolio(
      venta.empresa.id_empresa,
      39 // Boleta
    );

    // 2. Preparar el JSON para LibreDTE
    // LibreDTE usa una estructura muy parecida al XML final
    const dtePayload = {
        "Encabezado": {
            "IdDoc": {
                "TipoDTE": 39,
                "Folio": folio,
                "FchEmis": new Date().toISOString().split('T')[0],
                "IndServicio": 3 // Boleta
            },
            "Emisor": {
                "RUTEmisor": venta.empresa.rut.toUpperCase(), // 11222333-K
                "RznSoc": "MiPOSra",
                "GiroEmis": "Ventas",
                "Acteco": 12345, // <--- OJO: Debes tener este dato en tu BD o hardcodeado
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
            "NmbItem": (d as any).nombre || d.producto.nombre,
            "QtyItem": Number(d.cantidad),
            "PrcItem": Math.round(d.precio_unitario),
            "MontoItem": Math.round(d.subtotal)
        }))
    };

    try {
        // PASO A: Autenticarse en LibreDTE (Obtener Token)
        // Debes haber creado este usuario en el panel http://localhost:8081
        const login = await axios.post(`${this.libredteUrl}/api/login`, {
            user: 'admin', // Usuario por defecto al instalar LibreDTE
            pass: '1234'   // Contraseña que configures
        });
        const token = login.data.token;

        // PASO B: Emitir
        console.log(`📡 Enviando a Contenedor LibreDTE (Folio: ${folio})...`);
        
        const response = await axios.post(
            `${this.libredteUrl}/api/dte/documentos/emitir`, 
            {
                empresa: venta.empresa.rut, // RUT de la empresa dueña de la firma cargada
                dte: dtePayload
            },
            { headers: { Authorization: `Bearer ${token}` } }
        );

        if (response.data.estado === 'error') {
            throw new Error(response.data.mensaje || 'Error en LibreDTE');
        }

        // Extracción de datos (LibreDTE devuelve cosas distintas a SimpleAPI)
        const xmlFinal = response.data.xml; 
        const timbreFinal = response.data.ted; // LibreDTE suele devolver el TED separado

        return {
            ok: true,
            folio,
            timbre: timbreFinal,
            xml: xmlFinal
        };

    } catch (error) {
        console.error("❌ Error LibreDTE Docker:", error.message);
        if (error.response) console.error("Detalle:", JSON.stringify(error.response.data));
        
        // Manejo de errores específicos
        if (error.code === 'ECONNREFUSED') {
            return { ok: false, error: "El contenedor de LibreDTE no está respondiendo. ¿Está encendido?" };
        }
        return { ok: false, error: error.message };
    }
  }
}