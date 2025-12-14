import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma.service';
import { FoliosService } from '../folios/folios.service';

@Injectable()
export class DteService {
  // URL interna de Docker. 
  // 'dte_api' es el nombre del servicio en docker-compose.yml
  // Puerto 80 es el puerto interno del contenedor PHP.
  private readonly dteUrl = 'http://dte_api:80'; 

  constructor(
    private prisma: PrismaService,
    private foliosService: FoliosService
  ) {}

  // Quitamos parámetros innecesarios, solo necesitamos el ID de la venta
  async emitirDteDesdeVenta(idVenta: number) {
    console.log(`🚀 Iniciando emisión DTE LOCAL (Microservicio Docker) ID Venta: ${idVenta}`);

    // 1. Buscar datos de la venta
    const venta = await this.prisma.venta.findUnique({
      where: { id_venta: idVenta },
      include: { empresa: true, detalle_venta: { include: { producto: true } } }
    });

    if (!venta) throw new Error('Venta no encontrada');

    // 2. Obtener Folio Automático de tu BD
    const { folio } = await this.foliosService.obtenerSiguienteFolio(
      venta.empresa.id_empresa,
      39 // Boleta
    );
    console.log(`🎫 Folio asignado: ${folio}`);

    // 3. Preparar el JSON para el Microservicio PHP
    // (Esta estructura debe coincidir con lo que espera LibreDTE/Tu Mock)
    const payload = {
        "documento": {
            "Encabezado": {
                "IdDoc": {
                    "TipoDTE": 39,
                    "Folio": folio,
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
        console.log(`📡 Enviando a contenedor http://dte_api:80...`);
        
        // 4. LLAMADA AL MICROSERVICIO (Sin Auth, red interna segura)
        const response = await axios.post(
        `${this.dteUrl}/dte/documentos/emitir`, 
        payload,
        { headers: { 'Content-Type': 'application/json' } }
    );

    const data = response.data;
    
    // LOG PARA DEPURAR (Míralo en la consola del servidor)
    console.log(`✅ Respuesta PHP: Folio ${data.folio}, Timbre recibido: ${!!data.ted}`);

    return {
        ok: true,
        folio: data.folio,   // <--- ESTO ES IMPORTANTE
        timbre: data.ted,    // <--- ESTO ES EL XML QUE BUSCAS
        xml: data.xml
    };

    } catch (error) {
        console.error("❌ Error DTE Docker:", error.message);
        if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
             return { ok: false, error: "No se puede conectar al contenedor dte_api. ¿Está corriendo?" };
        }
        return { ok: false, error: error.message };
    }
  }
}