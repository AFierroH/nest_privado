import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { DteService } from '../dte/dte.service'; // <--- IMPORTANTE: Importar tu servicio DTE

@Injectable()
export class VentaService {
  // Inyectamos DteService
  constructor(
    private prisma: PrismaService,
    private dteService: DteService 
  ) {}

  // 1. Crear la venta en BD (Igual que antes)
  async crearVenta(payload: any) {
    const { id_usuario, id_empresa, total, detalles, pagos } = payload;
    
    // Validar stock o lógica extra aquí si es necesario

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

  // 2. Este es el método principal que llama el Frontend
  async emitirVentaCompleta(payload: any) {
    // A. Guardamos en BD
    const ventaDb = await this.crearVenta(payload);

    // B. Emitimos al SII Real usando DteService
    // Usamos el ID de la venta como Folio
    let dteResult: any = { ok: false, timbre: null, xml: null };
    
    try {
        // Llamamos a tu servicio que ya funciona con SimpleAPI
        dteResult = await this.dteService.emitirDteDesdeVenta(ventaDb.id_venta);
        
        if (!dteResult.ok) {
            console.error("Error emitiendo DTE:", dteResult.error);
            // No lanzamos error para no "deshacer" la venta en BD, pero avisamos
        }
    } catch (e) {
        console.error("Excepción al conectar con SII:", e);
    }

    // C. Preparamos respuesta para el Frontend
    return { 
        venta: ventaDb,
        // Si el DTE fue exitoso, enviamos el timbre real. Si no, null.
        timbre: dteResult.timbre || null, 
        folio: dteResult.folio || ventaDb.id_venta,
        xml: dteResult.xml || null
    };
  }

  // Mantenemos validación de voucher por si la usas
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