/* import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { DteService } from '../dte/dte.service';
import { PrismaService } from '../prisma.service';
import * as iconv from 'iconv-lite';
@Injectable()
export class VentaService {
  constructor(
    private dteService: DteService,
    private prisma: PrismaService 
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
        create: pagos?.map(p => ({
          id_pago: p.id_pago,
          monto: p.monto,
        })) || [],
      },
    },
    include: { detalle_venta: true, pagos: true },
  });
  return venta;
}

async emitirDte(payload: any) {
    const { id_usuario, id_empresa, total, detalles = [], usarImpresora = true } = payload;
    if (!detalles || detalles.length === 0) {
      throw new InternalServerErrorException('No hay items en la venta');
    }

    const empresaDemo = {rut: "76.543.210-K",
      razonSocial: "Comercial Temuco SpA",
      giro: "Venta de artículos electrónicos",
      direccion: "Av. Alemania 671",
      comuna: "Temuco",
      ciudad: "Araucanía",
      telefono: "+56 45 2123456",
      correo: "contacto@temuco-demo.cl",
      logo: ""};
    const fecha = new Date().toLocaleString('es-CL', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
    const venta = { id_venta: Math.floor(Math.random()*99999), fecha, total, id_usuario, id_empresa, detalles };
    const neto = Math.round(total / 1.19);
    const iva = total - neto;

    // Helpers
    const esc = (hexes: number[]) => Buffer.from(hexes);
    const textBuf = (s: string) => iconv.encode(s, 'cp858');
    const buffers: Buffer[] = [];
    function encodedWithRaw(parts:any[]) {
      const result = parts.map(p => typeof p === 'string' ? textBuf(p) : p);
      return Buffer.concat(result);
    }
    function pushCorreoSeguro(buffersArr: Buffer[], correo: string) {
      const [before, after] = correo.split('@');
      if (!after) { buffersArr.push(textBuf(correo + '\n')); return; }
      buffersArr.push(Buffer.concat([ textBuf(before), Buffer.from('@'), textBuf(after + '\n') ]));
    }

    // bytes escpos
    buffers.push(esc([0x1B,0x40]));
    buffers.push(esc([0x1C,0x2E]));
    buffers.push(esc([0x1B,0x74,0x12]));
    buffers.push(esc([0x1B,0x61,0x01]));
    buffers.push(textBuf(`${empresaDemo.razonSocial}\n`));
    buffers.push(textBuf(`RUT: ${empresaDemo.rut}\n`));
    pushCorreoSeguro(buffers, empresaDemo.correo);
    buffers.push(textBuf('------------------------------------------\n'));
    buffers.push(esc([0x1B,0x61,0x00]));
    buffers.push(encodedWithRaw(['Venta ', Buffer.from('#'), `${venta.id_venta}\n`]));
    buffers.push(textBuf(`Fecha: ${venta.fecha}\n`));
    buffers.push(textBuf('------------------------------------------\n'));

    for (const d of detalles) {
      const line = `${d.cantidad} x ${d.nombre}`;
      const precio = `$${d.precio_unitario}`;
      const formatted = line.padEnd(30).slice(0,30) + precio.padStart(10).slice(-10) + '\n';
      buffers.push(textBuf(formatted));
    }

    buffers.push(textBuf('------------------------------------------\n'));
    buffers.push(textBuf(`Neto: $${neto}\n`));
    buffers.push(textBuf(`IVA (19%): $${iva}\n`));
    buffers.push(textBuf(`TOTAL: $${venta.total}\n`));
    buffers.push(esc([0x1B,0x61,0x01]));
    buffers.push(textBuf('Gracias por su compra\n\n'));
    buffers.push(esc([0x1B,0x64,0x03]));
    buffers.push(esc([0x1D,0x56,0x42,0x00]));

    const payloadBuffer = Buffer.concat(buffers);

    return {
      usarImpresora: true, // backend ya no intenta imprimir
      venta,
      boletaBase64: payloadBuffer.toString('base64'),
      ticketBase64: payloadBuffer.toString('base64') // ESC/POS raw en base64
    };
  }
async emitirVentaCompleta(payload: any) {
  const ventaDb = await this.crearVenta(payload);

  const dtePayload = {
    ...payload,
    detalles: ventaDb.detalle_venta.map(d => ({
      id_producto: d.id_producto,
      cantidad: d.cantidad,
      precio_unitario: d.precio_unitario,
      nombre: payload.detalles.find(x => x.id_producto === d.id_producto)?.nombre || '',
    })),
    total: ventaDb.total,
    id_usuario: ventaDb.id_usuario,
    id_empresa: ventaDb.id_empresa,
  };
  const ticket = await this.emitirDte(dtePayload);

  return {
    venta: ventaDb,
    ticket,
  };
}
}
 */
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import * as iconv from 'iconv-lite';

@Injectable()
export class VentaService {
  constructor(
    private prisma: PrismaService,
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
          create: pagos?.map(p => ({
            id_pago: p.id_pago,
            monto: p.monto,
          })) || [],
        },
      },
      include: { detalle_venta: true, pagos: true },
    });
    return venta;
  }

  // Validar / traer voucher por número (ejemplo simulado)
  async validarVoucher(numero: string) {
    // Implementa búsqueda real en BD; aquí un ejemplo mock:
    if (!numero) throw new InternalServerErrorException('Número invalid');
    // Simula voucher con items
    return {
      id: Math.floor(Math.random()*999999),
      numero,
      total: 1500,
      items: [
        { id_producto: 1, nombre: 'Producto demo', precio_unitario: 1500, cantidad: 1 }
      ]
    };
  }

  // Genera ESC/POS en base64 y preview (no imprime)
  async emitirDte(payload: any) {
    const {
      id_usuario, id_empresa, total, detalles = [],
      usarImpresora = true, printerType, printerInfo, voucher
    } = payload;

    if (!detalles || detalles.length === 0) {
      throw new InternalServerErrorException('No hay items en la venta');
    }

    const empresaDemo = {
      rut: "76.543.210-K",
      razonSocial: "Comercial Temuco SpA",
      giro: "Venta de artículos electrónicos",
      direccion: "Av. Alemania 671",
      comuna: "Temuco",
      ciudad: "Araucanía",
      telefono: "+56 45 2123456",
      correo: "contacto@temuco-demo.cl",
      logo: ""
    };

    const fecha = new Date().toLocaleString('es-CL', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
    const venta = { id_venta: Math.floor(Math.random()*99999), fecha, total, id_usuario, id_empresa, detalles };
    const neto = Math.round(total / 1.19);
    const iva = total - neto;

    // Helpers
    const esc = (hexes: number[]) => Buffer.from(hexes);
    const textBuf = (s: string) => iconv.encode(s, 'cp858');
    const buffers: Buffer[] = [];

    // --- CONSTANTES ---
    const INIT = esc([0x1B, 0x40]);
    const FONT_A = esc([0x1B, 0x21, 0x00]); // Font A (12x24) - Estándar
    const FONT_B = esc([0x1B, 0x21, 0x01]); // Font B (9x17) - Comprimida/Pequeña
    const BOLD_ON = esc([0x1B, 0x45, 0x01]);
    const BOLD_OFF = esc([0x1B, 0x45, 0x00]);
    const DOUBLE_HW = esc([0x1D, 0x21, 0x11]); // Doble alto y ancho
    const RESET_HW = esc([0x1D, 0x21, 0x00]); // Reset tamaño
    const ALIGN_CENTER = esc([0x1B, 0x61, 0x01]);
    const ALIGN_LEFT = esc([0x1B, 0x61, 0x00]);
    const CUT = esc([0x1D, 0x56, 0x42, 0x00]); // Cortar (parcial)
    const FEED = (n: number) => esc([0x1B, 0x64, n]); // Feed n lineas
    // --- FIN DE CONSTANTES ---
    function encodedWithRaw(parts:any[]) {
      const result = parts.map(p => typeof p === 'string' ? textBuf(p) : p);
      return Buffer.concat(result);
    }
    function pushCorreoSeguro(buffersArr: Buffer[], correo: string) {
      const [before, after] = correo.split('@');
      if (!after) { buffersArr.push(textBuf(correo + '\n')); return; }
      buffersArr.push(Buffer.concat([ textBuf(before), Buffer.from('@'), textBuf(after + '\n') ]));
    }

    // Build ESC/POS bytes
    buffers.push(INIT);           // init
    buffers.push(FONT_A);         // <-- ¡IMPORTANTE! Selecciona la fuente estándar
    buffers.push(ALIGN_CENTER);
    buffers.push(DOUBLE_HW);      // <-- Título grande
    buffers.push(textBuf(`${empresaDemo.razonSocial}\n`));
    buffers.push(RESET_HW);       // <-- Volver a tamaño normal
    buffers.push(textBuf(`RUT: ${empresaDemo.rut}\n`));
    pushCorreoSeguro(buffers, empresaDemo.correo);
    buffers.push(textBuf('------------------------------------------\n')); // Ajusta guiones si es necesario
    buffers.push(ALIGN_LEFT);
    buffers.push(encodedWithRaw(['Venta ', Buffer.from('#'), `${venta.id_venta}\n`]));
    buffers.push(textBuf(`Fecha: ${venta.fecha}\n`));
    buffers.push(textBuf('------------------------------------------\n'));

    // Bucle de detalles de venta
    for (const d of detalles) {
      const MAX_ANCHO = 42;
    
    const line = `${d.cantidad} x ${d.nombre}`;
    const precio = `$${d.precio_unitario}`;

    const maxNombreAncho = MAX_ANCHO - precio.length - 1; 
    const nombreTruncado = line.length > maxNombreAncho ? line.substring(0, maxNombreAncho) : line;

    const formatted = nombreTruncado.padEnd(MAX_ANCHO - precio.length) + precio + '\n';
    buffers.push(textBuf(formatted));
    }

    buffers.push(textBuf('------------------------------------------\n'));
    buffers.push(textBuf(`Neto: $${neto}\n`));
    buffers.push(textBuf(`IVA (19%): $${iva}\n`));
    buffers.push(BOLD_ON);        // <-- Total en negrita
    buffers.push(DOUBLE_HW);      // <-- Total grande
    buffers.push(textBuf(`TOTAL: $${venta.total}\n`));
    buffers.push(RESET_HW);       // <-- Reset
    buffers.push(BOLD_OFF);       // <-- Reset
    buffers.push(ALIGN_CENTER);
    buffers.push(textBuf('Gracias por su compra\n\n'));
    buffers.push(FEED(3));        // feed 3 lineas
    buffers.push(CUT);            // cut
    const payloadBuffer = Buffer.concat(buffers);

    // Texto para preview en frontend si no hay imagen
    const textPreview = [
      empresaDemo.razonSocial,
      `RUT: ${empresaDemo.rut}`,
      `Venta #${venta.id_venta}`,
      `Fecha: ${venta.fecha}`,
      '------------------------------------------',
      ...detalles.map(d => `${d.cantidad} x ${d.nombre}   $${d.precio_unitario}`),
      '------------------------------------------',
      `Neto: $${neto}`,
      `IVA (19%): $${iva}`,
      `TOTAL: $${venta.total}`,
      'Gracias por su compra'
    ].join('\n');

    // Retornamos los bytes del ticket en base64 (para que el cliente/Electron los imprima)
    return {
      ok: true,
      usarImpresora,
      venta,
      ticketBase64: payloadBuffer.toString('base64'), // ESC/POS raw
      boletaBase64: null, // opcional: si generas PNG con canvas
      textPreview
    };
  }

  // Emite venta completa (crea en BD + genera ticket)
  async emitirVentaCompleta(payload: any) {
    // 1. Registrar la venta en la base de datos
    const ventaDb = await this.crearVenta(payload);

    // 2. Generar el ticket/boleta usando los datos reales de la venta
    const dtePayload = {
      ...payload,
      detalles: ventaDb.detalle_venta.map(d => ({
        id_producto: d.id_producto,
        cantidad: d.cantidad,
        precio_unitario: d.precio_unitario,
        nombre: payload.detalles.find(x => x.id_producto === d.id_producto)?.nombre || '',
      })),
      total: ventaDb.total,
      id_usuario: ventaDb.id_usuario,
      id_empresa: ventaDb.id_empresa,
    };
    const ticket = await this.emitirDte(dtePayload);

    // 3. Retornar ambos resultados
    return {
      venta: ventaDb,
      ticket,
    };
  }

  // Endpoint para validar voucher (expuesto por controller)
  async emitirVentaConVoucher(payload: any) {
    // payload incluye voucher.numero u otra info; implementa la lógica real en producción
    const { voucherNumero } = payload;
    const voucher = await this.validarVoucher(voucherNumero);
    if (!voucher) throw new InternalServerErrorException('Voucher inválido');

    // construir payload de venta desde voucher y crear venta
    const detalles = voucher.items.map((it: any) => ({
      id_producto: it.id_producto,
      cantidad: it.cantidad,
      precio_unitario: it.precio_unitario,
      nombre: it.nombre
    }));

    const venta = await this.crearVenta({
      id_usuario: payload.id_usuario,
      id_empresa: payload.id_empresa,
      total: voucher.total,
      detalles
    });

    const ticket = await this.emitirDte({
      ...payload,
      detalles,
      total: voucher.total,
      id_usuario: venta.id_usuario,
      id_empresa: venta.id_empresa
    });

    return { venta, ticket };
  }

}
