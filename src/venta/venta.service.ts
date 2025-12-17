import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { DteService } from '../dte/dte.service';

@Injectable()
export class VentaService {
  constructor(
    private prisma: PrismaService,
    private dteService: DteService 
  ) {}

  async crearVenta(payload: any) {
    const { id_usuario, id_empresa, total, detalles, pagos } = payload;
    
    const venta = await this.prisma.venta.create({
      data: {
        fecha: new Date(),
        total,
        id_usuario,
        id_empresa,
        detalle_venta: {
          create: detalles.map(d => ({
            id_producto: d.id_producto,
            cantidad: d.cantidad,
            precio_unitario: d.precio_unitario,
            subtotal: d.cantidad * d.precio_unitario,
          })),
        },
        pagos: {
          create: pagos?.map(p => ({ id_pago: p.id_pago, monto: p.monto })) || [],
        },
      },
      include: { detalle_venta: true, pagos: true, empresa: true },
    });
    return venta;
  }

  async emitirVentaCompleta(payload: any) {
    console.log('📝 Iniciando emisión de venta completa...');
    
    // A. Guardamos en BD primero (SIEMPRE guardamos la venta)
    const ventaDb = await this.crearVenta(payload);
    console.log(`✅ Venta guardada en BD con ID: ${ventaDb.id_venta}`);

    // B. Intentamos emitir DTE
    let dteResult: any = null;
    let timbreXml = null;
    let folioFinal = ventaDb.id_venta; // Por defecto usamos el ID de venta
    
    try {
      console.log('📡 Emitiendo DTE al SII...');
      dteResult = await this.dteService.emitirDteDesdeVenta(ventaDb.id_venta);
      
      if (dteResult && dteResult.ok) {
        console.log('✅ DTE emitido exitosamente');
        
        timbreXml = dteResult.ted || null;
        folioFinal = dteResult.folio || ventaDb.id_venta;

        // --- AGREGA ESTO: Actualiza la variable ventaDb para que el frontend lo vea ---
        ventaDb.folio = folioFinal;
        ventaDb.estado_sii = 'EMITIDO'; // O el estado que uses
        ventaDb.xml_dte = 'XML_GENERADO'; // Opcional, para no enviar todo el texto
        // -----------------------------------------------------------------------------

        console.log('📜 TED (PDF417) RECIBIDO:', dteResult.ted); 
        console.log('🔢 FOLIO RECIBIDO:', dteResult.folio);
      } else {
        console.warn('⚠️ DTE falló:', dteResult?.error || 'Error desconocido');
      }
      
    } catch (error) {
      console.error('❌ Excepción al emitir DTE:', error.message);
    }

    // C. Retornamos respuesta
    return { 
      venta: ventaDb,         // ¡Ahora sí llevará el folio!
      folio: folioFinal,
      timbre: timbreXml,      
      xml: dteResult?.xml || null 
    };
  }

  async validarVoucher(numero: string) {
    if (!numero) throw new InternalServerErrorException('Número inválido');
    return {
      id: Math.floor(Math.random() * 999999),
      numero,
      total: 1500,
      items: [{ id_producto: 1, nombre: 'Producto demo', precio_unitario: 1500, cantidad: 1 }],
    };
  }
}