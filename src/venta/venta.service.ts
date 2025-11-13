import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import * as iconv from 'iconv-lite';
import * as bwipjs from 'bwip-js';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class VentaService {
  constructor(private prisma: PrismaService) {}

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
          create:
            pagos?.map(p => ({
              id_pago: p.id_pago,
              monto: p.monto,
            })) || [],
        },
      },
      include: { detalle_venta: true, pagos: true },
    });
    return venta;
  }

  async validarVoucher(numero: string) {
    if (!numero) throw new InternalServerErrorException('Número inválido');
    return {
      id: Math.floor(Math.random() * 999999),
      numero,
      total: 1500,
      items: [
        {
          id_producto: 1,
          nombre: 'Producto demo',
          precio_unitario: 1500,
          cantidad: 1,
        },
      ],
    };
  }

async emitirDte(payload: any) {
  const {
    id_usuario,
    id_empresa,
    total,
    detalles = [],
    usarImpresora = true,
  } = payload;

  if (!detalles || detalles.length === 0)
    throw new InternalServerErrorException('No hay items en la venta');

  const empresaDemo = {
    rut: '76.543.210-K',
    razonSocial: 'Comercial Temuco SpA',
    giro: 'Venta de artículos electrónicos',
    direccion: 'Av. Alemania 671',
    comuna: 'Temuco',
    ciudad: 'Araucanía',
    telefono: '+56 45 2123456',
    correo: 'contacto@temuco-demo.cl',
    logo: path.join(process.cwd(), 'src', 'venta', 'CocaCola.png'),
  };

  const fecha = new Date().toLocaleString('es-CL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  const venta = {
    id_venta: Math.floor(Math.random() * 99999),
    fecha,
    total,
    id_usuario,
    id_empresa,
    detalles,
  };

  const neto = Math.round(total / 1.19);
  const iva = total - neto;

  // === Cargar y convertir logo local ===
  let logoBase64 = '';
  try {
    const logoBuffer = fs.readFileSync(empresaDemo.logo);
    logoBase64 = logoBuffer.toString('base64');
  } catch (err) {
    console.warn('No se pudo leer el logo local:', err.message);
  }

  // === Generar código PDF417 ===
  const pdf417Base64 = await new Promise<string>((resolve, reject) => {
    bwipjs.toBuffer(
      {
        bcid: 'pdf417',
        text: 'SII-Fake-Code-' + venta.id_venta,
        scale: 3,
        height: 8,
        includetext: false,
      },
      (err, png) => {
        if (err) reject(err);
        else resolve(png.toString('base64'));
      },
    );
  });

  const esc = (hexes: number[]) => Buffer.from(hexes);
  const textBuf = (s: string) => iconv.encode(s, 'cp858');
  const buffers: Buffer[] = [];

  // === ESC/POS const ===
  const INIT = esc([0x1b, 0x40]);
  const FONT_A = esc([0x1b, 0x21, 0x00]);
  const BOLD_ON = esc([0x1b, 0x45, 0x01]);
  const BOLD_OFF = esc([0x1b, 0x45, 0x00]);
  const DOUBLE_HW = esc([0x1d, 0x21, 0x11]);
  const RESET_HW = esc([0x1d, 0x21, 0x00]);
  const ALIGN_CENTER = esc([0x1b, 0x61, 0x01]);
  const ALIGN_LEFT = esc([0x1b, 0x61, 0x00]);
  const CUT = esc([0x1d, 0x56, 0x42, 0x00]);
  const FEED = (n: number) => esc([0x1b, 0x64, n]);

  const formatCLP = (v: number) =>
    new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0,
    }).format(v);

  // === ENCABEZADO ===
  buffers.push(INIT);
  buffers.push(ALIGN_CENTER);
  buffers.push(DOUBLE_HW);
  buffers.push(textBuf(`${empresaDemo.razonSocial}\n`));
  buffers.push(RESET_HW);
  buffers.push(textBuf(`RUT: ${empresaDemo.rut}\n`));
  buffers.push(BOLD_ON);
  buffers.push(textBuf(`BOLETA ELECTRÓNICA Nº ${venta.id_venta}\n`));
  buffers.push(BOLD_OFF);

  // Logo en base64 para mostrar/preview
  if (logoBase64) buffers.push(textBuf(`[LOGO_BASE64:${logoBase64}]\n`));

  buffers.push(textBuf(`${empresaDemo.direccion}, ${empresaDemo.comuna}\n`));
  buffers.push(textBuf(`${empresaDemo.ciudad} — Tel: ${empresaDemo.telefono}\n`));
  buffers.push(textBuf('------------------------------------------\n'));
  buffers.push(ALIGN_LEFT);
  buffers.push(textBuf(`Fecha: ${venta.fecha}\n`));
  buffers.push(textBuf('------------------------------------------\n'));

  // === DETALLES ===
  const ANCHO_TOTAL = 42;
  const ANCHO_PRECIO = 12;
  const ANCHO_NOMBRE = ANCHO_TOTAL - ANCHO_PRECIO;

  for (const d of detalles) {
    const precioUnitario = formatCLP(d.precio_unitario);
    const subtotal = formatCLP(d.cantidad * d.precio_unitario);
    // Línea 1: cantidad x precio unitario
    buffers.push(textBuf(`${d.cantidad} x ${precioUnitario}\n`));
    // Línea 2: nombre + total alineado derecha
    const nombreRecortado =
      d.nombre.length > ANCHO_NOMBRE
        ? d.nombre.substring(0, ANCHO_NOMBRE)
        : d.nombre;
    const linea = nombreRecortado.padEnd(ANCHO_NOMBRE) + subtotal.padStart(ANCHO_PRECIO) + '\n';
    buffers.push(textBuf(linea));
  }

  buffers.push(textBuf('------------------------------------------\n'));
  // Totales a la derecha
  buffers.push(
    textBuf(`Neto:`.padEnd(ANCHO_NOMBRE) + formatCLP(neto).padStart(ANCHO_PRECIO) + '\n'),
  );
  buffers.push(
    textBuf(`IVA (19%):`.padEnd(ANCHO_NOMBRE) + formatCLP(iva).padStart(ANCHO_PRECIO) + '\n'),
  );
  buffers.push(BOLD_ON);
  buffers.push(DOUBLE_HW);
  buffers.push(
    textBuf(`TOTAL:`.padEnd(ANCHO_NOMBRE) + formatCLP(total).padStart(ANCHO_PRECIO) + '\n'),
  );
  buffers.push(RESET_HW);
  buffers.push(BOLD_OFF);

  // === PIE ===
  buffers.push(ALIGN_CENTER);
  buffers.push(FEED(1));
  buffers.push(textBuf('Gracias por su compra\n'));
  buffers.push(FEED(1));
  buffers.push(textBuf('Timbre Electrónico SII\n'));
  buffers.push(textBuf('Res. NRO.80 de 22-08-2014\n'));
  buffers.push(textBuf('Verifique el documento en www.sii.cl\n'));
  buffers.push(FEED(2));
  buffers.push(CUT);

  const payloadBuffer = Buffer.concat(buffers);

  return {
    ok: true,
    usarImpresora,
    venta,
    ticketBase64: payloadBuffer.toString('base64'),
    pdf417Base64,
    logoBase64, 
    textPreview: Buffer.concat(buffers).toString(),
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
        nombre:
          payload.detalles.find(
            x => x.id_producto === d.id_producto,
          )?.nombre || '',
      })),
      total: ventaDb.total,
      id_usuario: ventaDb.id_usuario,
      id_empresa: ventaDb.id_empresa,
    };

    const ticket = await this.emitirDte(dtePayload);

    return { venta: ventaDb, ticket };
  }

  async emitirVentaConVoucher(payload: any) {
    const { voucherNumero } = payload;
    const voucher = await this.validarVoucher(voucherNumero);
    if (!voucher)
      throw new InternalServerErrorException('Voucher inválido');

    const detalles = voucher.items.map((it: any) => ({
      id_producto: it.id_producto,
      cantidad: it.cantidad,
      precio_unitario: it.precio_unitario,
      nombre: it.nombre,
    }));

    const venta = await this.crearVenta({
      id_usuario: payload.id_usuario,
      id_empresa: payload.id_empresa,
      total: voucher.total,
      detalles,
    });

    const ticket = await this.emitirDte({
      ...payload,
      detalles,
      total: voucher.total,
      id_usuario: venta.id_usuario,
      id_empresa: venta.id_empresa,
    });

    return { venta, ticket };
  }
}
