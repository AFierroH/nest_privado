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
    console.log('Iniciando emisión de venta completa...');

    const ventaDb = await this.crearVenta(payload);
    console.log(`Venta guardada con ID: ${ventaDb.id_venta}`);

    let dteResult: any = null;
    let folioFinal = ventaDb.id_venta;
    let timbreXml: string | null = null;
    let pdf417Base64: string | null = null;
    
    try {
      console.log('Emitiendo DTE al SII...');
      dteResult = await this.dteService.emitirDteDesdeVenta(ventaDb.id_venta);
      
      if (dteResult && dteResult.ok) {
        console.log('DTE emitido exitosamente');
        
        folioFinal = dteResult.folio || ventaDb.id_venta;
        timbreXml = dteResult.ted || null;
        pdf417Base64 = dteResult.pdf417Base64 || null; 
        
        console.log(`Folio: ${folioFinal}`);
        console.log(`TED: ${timbreXml ? 'SÍ' : 'NO'}`);
        console.log(`PDF417: ${pdf417Base64 ? 'SÍ' : 'NO'}`);
        
      } else {
        console.warn('DTE falló:', dteResult?.error || 'Error desconocido');
      }
      
    } catch (error) {
      console.error('Error en emisión DTE:', error.message);
    }

    return { 
      venta: ventaDb,
      folio: folioFinal,
      timbre: timbreXml,              
      ticket: {
        pdf417Base64: pdf417Base64,   
        ok: !!pdf417Base64
      },
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