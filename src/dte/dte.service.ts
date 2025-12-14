import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma.service';
import { FoliosService } from '../folios/folios.service';

@Injectable()
export class DteService {
  // Apuntamos directo al archivo index.php para evitar errores 404 de Apache
  private readonly dteUrl = 'http://dte_api:80/index.php'; 

  constructor(
    private prisma: PrismaService,
    private foliosService: FoliosService
  ) {}

  async emitirDteDesdeVenta(idVenta: number) {
    console.log(`🚀 Iniciando emisión DTE LOCAL ID Venta: ${idVenta}`);

    const venta = await this.prisma.venta.findUnique({
      where: { id_venta: idVenta },
      include: { empresa: true, detalle_venta: { include: { producto: true } } }
    });

    if (!venta) throw new Error('Venta no encontrada');

    // 1. FUENTE DE LA VERDAD: Obtenemos el folio de NUESTRA base de datos
    const { folio } = await this.foliosService.obtenerSiguienteFolio(
      venta.empresa.id_empresa,
      39 
    );
    console.log(`🎫 Folio asignado (Oficial): ${folio}`);

    const payload = {
        "documento": {
            "Encabezado": {
                "IdDoc": {
                    "TipoDTE": 39,
                    "Folio": folio, // Enviamos el folio oficial
                    "FchEmis": new Date().toISOString().split('T')[0],
                    "IndServicio": 3
                },
                "Emisor": {
                    "RUTEmisor": venta.empresa.rut,
                    "RznSoc": "MiPOSra",
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
                "NmbItem": (d as any).nombre || d.producto.nombre,
                "QtyItem": Number(d.cantidad),
                "PrcItem": Math.round(d.precio_unitario),
                "MontoItem": Math.round(d.subtotal)
            }))
        }
    };

    try {
        console.log(`📡 Enviando a microservicio PHP...`);
        
        // Enviamos a la ruta exacta
        const response = await axios.post(
            `${this.dteUrl}/dte/documentos/emitir`, 
            payload,
            { headers: { 'Content-Type': 'application/json' } }
        );

        const data = response.data;
        console.log(`✅ Respuesta PHP recibida. Timbre generado: ${!!data.ted}`);

        return {
            ok: true,
            folio: folio,        // <--- SEGURIDAD: Usamos EL NUESTRO, no data.folio
            timbre: data.ted,    // El XML del timbre (<TED>...</TED>)
            xml: data.xml
        };

    } catch (error) {
        console.error("❌ Error DTE Docker:", error.message);
        // Retornamos error pero con el folio que intentamos usar para registro
        return { ok: false, error: error.message, folio: folio }; 
    }
  }
}