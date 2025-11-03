/* // Lógica de negocio para emisión de DTE y estadísticas
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { createCanvas, loadImage } from 'canvas'; // sólo para PNG preview
import escpos from 'escpos';

export function getFormattedDate() {
  const now = new Date();
  return now.toLocaleString('es-CL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

@Injectable()
export class DteService {
  constructor(private prisma: PrismaService) {}

  async emitirDte(payload: any) {
    const { id_usuario, id_empresa, total, detalles = [], usarImpresora = true } = payload;
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
      logo: "https://picsum.photos/100/100"
    };

    const fecha = getFormattedDate();
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

    // ------------------------- ESC/POS -------------------------
    if (usarImpresora) {
      const escpos: any[] = [];

      escpos.push('\x1B\x40'); // init
      escpos.push('\x1C\x2E'); // FS .
      escpos.push('\x1B\x52\x0B');      // Spain 2
      escpos.push('\x1B\x74\x13');      // CP1252
      escpos.push("Prueba caracteres: á é í ó ú ñ Ñ ü Ü ç Ç €\n\n");
      escpos.push('\x1B\x61\x31'); // center align
      escpos.push(`${empresaDemo.razonSocial}\n`);
      escpos.push(`RUT: ${empresaDemo.rut}\n`);
      escpos.push(`${empresaDemo.giro}\n`);
      escpos.push(`${empresaDemo.direccion}, ${empresaDemo.comuna}\n`);
      escpos.push(`${empresaDemo.ciudad}\n`);
      escpos.push(`Tel: ${empresaDemo.telefono}\n`);
      escpos.push(`${empresaDemo.correo}\n`);
      escpos.push('------------------------------------------\n');
      escpos.push('\x1B\x61\x30'); // left align
      escpos.push(`Venta #: ${venta.id_venta}\n`);
      escpos.push(`Fecha: ${venta.fecha}\n`);
      escpos.push('------------------------------------------\n');

      for (const d of detalles) {
        const line = `${d.cantidad} x Prod#${d.id_producto}`;
        const precio = `$${d.precio_unitario}`;
        escpos.push(line.padEnd(30) + precio.padStart(10) + '\n');
      }

      escpos.push('------------------------------------------\n');
      escpos.push(`Neto: $${neto}\n`);
      escpos.push(`IVA (19%): $${iva}\n`);
      escpos.push(`TOTAL: $${venta.total}\n`);
      escpos.push('------------------------------------------\n');
      escpos.push('\x1B\x61\x31');
      escpos.push('Gracias por su compra\n\n');
      escpos.push('\x1D\x56\x30'); // corte

      return {
        usarImpresora: true,
        printer: 'XP-80C',
        ticket: escpos,
        venta,
      };
    }

    // ------------------------- PNG PREVIEW -------------------------
    const width = 570;
    const lineHeight = 20;
    const height = 300 + detalles.length * lineHeight;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#FFF';
    ctx.fillRect(0, 0, width, height);

    try {
      const logo = await loadImage(empresaDemo.logo);
      ctx.drawImage(logo, width - 80, 10, 80, 80);
    } catch {}

    ctx.fillStyle = '#000';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`${empresaDemo.razonSocial}`, width / 2, 40);

    ctx.font = '12px Arial';
    ctx.fillText(`RUT: ${empresaDemo.rut}`, width / 2, 60);
    ctx.fillText(`${empresaDemo.giro}`, width / 2, 75);
    ctx.fillText(`${empresaDemo.direccion}, ${empresaDemo.comuna}`, width / 2, 90);
    ctx.fillText(`${empresaDemo.ciudad}`, width / 2, 105);

    ctx.font = '12px Arial';
    ctx.textAlign = 'left';
    let y = 120;
    ctx.fillText(`Venta #: ${venta.id_venta}`, 10, y);
    ctx.fillText(`Fecha: ${venta.fecha}`, 10, y + 18);
    y += 40;

    ctx.fillText('------------------------------------------', 10, y);
    y += 20;

    for (const d of detalles) {
      ctx.fillText(`${d.cantidad} x Prod#${d.id_producto}`, 10, y);
      ctx.textAlign = 'right';
      ctx.fillText(`$${d.precio_unitario}`, width - 10, y);
      ctx.textAlign = 'left';
      y += lineHeight;
    }

    ctx.fillText('------------------------------------------', 10, y);
    y += 20;
    ctx.fillText(`Neto: $${neto}`, 10, y);
    y += 18;
    ctx.fillText(`IVA (19%): $${iva}`, 10, y);
    y += 18;
    ctx.font = 'bold 14px Arial';
    ctx.fillText(`TOTAL: $${venta.total}`, 10, y);

    const buffer = canvas.toBuffer('image/png');
    const base64 = buffer.toString('base64');

    return {
      usarImpresora: false,
      venta,
      boletaBase64: base64,
    };
  }

  // Estadísticas
  async productosMasVendidos() {
    return this.prisma.detalle_venta.groupBy({
      by: ['id_producto'],
      _sum: { cantidad: true },
      orderBy: { _sum: { cantidad: 'desc' } },
      take: 5,
    });
  }

  async ventasPorEmpresa() {
    return this.prisma.venta.groupBy({
      by: ['id_empresa'],
      _sum: { total: true },
      _count: { _all: true },
    });
  }

  async ingresosPorFecha(inicio: string, fin: string) {
    return this.prisma.venta.findMany({
      where: { fecha: { gte: new Date(inicio), lte: new Date(fin) } },
      select: { fecha: true, total: true },
    });
  }
}
 */


// // Lógica de negocio para emisión de DTE y estadísticas
// import { Injectable, InternalServerErrorException } from '@nestjs/common';
// import { PrismaService } from '../prisma.service';
// import { createCanvas, loadImage } from 'canvas';
// import escpos from 'escpos';

// // IMPORTANTE: activar soporte para impresoras de red
// escpos.Network = require('escpos-network');

// export function getFormattedDate() {
//   const now = new Date();
//   return now.toLocaleString('es-CL', {
//     year: 'numeric',
//     month: '2-digit',
//     day: '2-digit',
//     hour: '2-digit',
//     minute: '2-digit',
//   });
// }

// @Injectable()
// export class DteService {
//   constructor(private prisma: PrismaService) {}

//   async emitirDte(payload: any) {
//     const { id_usuario, id_empresa, total, detalles = [], usarImpresora = true } = payload;
//     if (!detalles || detalles.length === 0) {
//       throw new InternalServerErrorException('No hay items en la venta');
//     }

//     const empresaDemo = {
//       rut: "76.543.210-K",
//       razonSocial: "Comercial Temuco SpA",
//       giro: "Venta de artículos electrónicos",
//       direccion: "Av. Alemania 671",
//       comuna: "Temuco",
//       ciudad: "Araucanía",
//       telefono: "+56 45 2123456",
//       correo: "contacto@temuco-demo.cl",
//       logo: "https://picsum.photos/100/100"
//     };

//     const fecha = getFormattedDate();
//     const venta = {
//       id_venta: Math.floor(Math.random() * 99999),
//       fecha,
//       total,
//       id_usuario,
//       id_empresa,
//       detalles,
//     };

//     const neto = Math.round(total / 1.19);
//     const iva = total - neto;

//     // ------------------------- ESC/POS con librería -------------------------
//     if (usarImpresora) {
//       const printerIp = '192.168.200.169'; // cambia por la IP real de tu impresora
//       const printerPort = 9100;

//       const device = new escpos.Network(printerIp, printerPort);
//       const printer = new escpos.Printer(device, { encoding: 'CP858' }); // usar CP858 para acentos y €

//       return new Promise((resolve, reject) => {
//         device.open(async (err: any) => {
//           if (err) {
//             return reject(new InternalServerErrorException('No se pudo conectar a la impresora'));
//           }

//           try {
//             printer
//               .align('CT')
              
//               .style('B')
//               .raw(Buffer.from([0x1B, 0x74, 0x13]))
//               .text(empresaDemo.razonSocial)
//               .text(`RUT: ${empresaDemo.rut}`)
//               .text(empresaDemo.giro)
//               .text(`${empresaDemo.direccion}, ${empresaDemo.comuna}`)
//               .text(empresaDemo.ciudad)
//               .text(`Tel: ${empresaDemo.telefono}`)
//               .text(empresaDemo.correo)
//               .drawLine()
//               .align('LT')
//               .text(`Venta #: ${venta.id_venta}`)
//               .text(`Fecha: ${venta.fecha}`)
//               .drawLine();

//             for (const d of detalles) {
//               const line = `${d.cantidad} x Prod#${d.id_producto}`;
//               const precio = `$${d.precio_unitario}`;
//               printer.text(line.padEnd(30) + precio.padStart(10));
//             }

//             printer
//               .drawLine()
//               .text(`Neto: $${neto}`)
//               .text(`IVA (19%): $${iva}`)
//               .style('B')
//               .text(`TOTAL: $${venta.total}`)
//               .style('NORMAL')
//               .drawLine()
//               .align('CT')
//               .text('Gracias por su compra\n\n')
//               .cut()
//               .close();

//             resolve({
//               usarImpresora: true,
//               printer: 'XP-80C',
//               venta,
//             });
//           } catch (error) {
//             reject(new InternalServerErrorException('Error al imprimir el ticket'));
//           }
//         });
//       });
//     }

//     // ------------------------- PNG PREVIEW -------------------------
//     const width = 570;
//     const lineHeight = 20;
//     const height = 300 + detalles.length * lineHeight;
//     const canvas = createCanvas(width, height);
//     const ctx = canvas.getContext('2d');

//     ctx.fillStyle = '#FFF';
//     ctx.fillRect(0, 0, width, height);

//     try {
//       const logo = await loadImage(empresaDemo.logo);
//       ctx.drawImage(logo, width - 80, 10, 80, 80);
//     } catch {}

//     ctx.fillStyle = '#000';
//     ctx.font = 'bold 16px Arial';
//     ctx.textAlign = 'center';
//     ctx.fillText(`${empresaDemo.razonSocial}`, width / 2, 40);

//     ctx.font = '12px Arial';
//     ctx.fillText(`RUT: ${empresaDemo.rut}`, width / 2, 60);
//     ctx.fillText(`${empresaDemo.giro}`, width / 2, 75);
//     ctx.fillText(`${empresaDemo.direccion}, ${empresaDemo.comuna}`, width / 2, 90);
//     ctx.fillText(`${empresaDemo.ciudad}`, width / 2, 105);

//     ctx.font = '12px Arial';
//     ctx.textAlign = 'left';
//     let y = 120;
//     ctx.fillText(`Venta #: ${venta.id_venta}`, 10, y);
//     ctx.fillText(`Fecha: ${venta.fecha}`, 10, y + 18);
//     y += 40;

//     ctx.fillText('------------------------------------------', 10, y);
//     y += 20;

//     for (const d of detalles) {
//       ctx.fillText(`${d.cantidad} x Prod#${d.id_producto}`, 10, y);
//       ctx.textAlign = 'right';
//       ctx.fillText(`$${d.precio_unitario}`, width - 10, y);
//       ctx.textAlign = 'left';
//       y += lineHeight;
//     }

//     ctx.fillText('------------------------------------------', 10, y);
//     y += 20;
//     ctx.fillText(`Neto: $${neto}`, 10, y);
//     y += 18;
//     ctx.fillText(`IVA (19%): $${iva}`, 10, y);
//     y += 18;
//     ctx.font = 'bold 14px Arial';
//     ctx.fillText(`TOTAL: $${venta.total}`, 10, y);

//     const buffer = canvas.toBuffer('image/png');
//     const base64 = buffer.toString('base64');

//     return {
//       usarImpresora: false,
//       venta,
//       boletaBase64: base64,
//     };
//   }

//   // Estadísticas
//   async productosMasVendidos() {
//     return this.prisma.detalle_venta.groupBy({
//       by: ['id_producto'],
//       _sum: { cantidad: true },
//       orderBy: { _sum: { cantidad: 'desc' } },
//       take: 5,
//     });
//   }

//   async ventasPorEmpresa() {
//     return this.prisma.venta.groupBy({
//       by: ['id_empresa'],
//       _sum: { total: true },
//       _count: { _all: true },
//     });
//   }

//   async ingresosPorFecha(inicio: string, fin: string) {
//     return this.prisma.venta.findMany({
//       where: { fecha: { gte: new Date(inicio), lte: new Date(fin) } },
//       select: { fecha: true, total: true },
//     });
//   }
// }
// Lógica de negocio para emisión de DTE y estadísticas

//////////////////////////////////////////////////////////
/* import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { createCanvas, loadImage } from 'canvas';
import * as iconv from 'iconv-lite';
import net from 'net';

export function getFormattedDate() {
  const now = new Date();
  return now.toLocaleString('es-CL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

@Injectable()
export class DteService {
  constructor(private prisma: PrismaService) {}
  
  async emitirDte(payload: any) {
    const { id_usuario, id_empresa, total, detalles = [], usarImpresora = true } = payload;
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
      logo: "https://picsum.photos/100/100"
    };

    const fecha = getFormattedDate();
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

    // ------------------------- ESC/POS directo por TCP (codificando a CP858) -------------------------
    if (usarImpresora) {
      const PRINTER_IP = '192.168.200.169'; // <- cambia por la IP real
      const PRINTER_PORT = 9100;

      // Helpers para crear buffers ESC/POS
      const esc = (hexes: number[]) => Buffer.from(hexes);
      const textBuf = (s: string) => iconv.encode(s, 'cp858'); // convierte a PC858
      const textUTF8 = (s: string) => iconv.encode(s, 'utf-8'); 
      const buffers: Buffer[] = [];
      function encodedWithRaw(parts) {
      const result = parts.map(p => typeof p === 'string' ? textBuf(p) : p);
      return Buffer.concat(result);}
      function pushCorreoSeguro(buffers, correo) {
  const [before, after] = correo.split('@');
  if (!after) {
    // Si no tiene arroba, simplemente codifica todo
    buffers.push(textBuf(correo + '\n'));
    return;
  }

  // Codifica primera parte, mete la arroba pura, y luego la segunda parte
  buffers.push(Buffer.concat([
    textBuf(before),
    Buffer.from('@'),   // Arroba sin codificar
    textBuf(after + '\n')
  ]));
}
      let allChars = '';
      for (let i = 0; i < 256; i++) {
      allChars += String.fromCharCode(i);}

      // Init y asegurar cancelar modo Kanji
      buffers.push(esc([0x1B, 0x40])); // ESC @ -> init
      buffers.push(esc([0x1C, 0x2E])); // FS . -> cancel Kanji mode


      buffers.push(esc([0x1B, 0x74, 0x12])); // ESC t 0x13 -> seleccionar PC858 en impresora p 0x02 para multilingual

      buffers.push(esc([0x1B, 0x52, 0x07])); // ESC R 0x07 -> Spain 1 o 0x0B SPAIN 2 
      // NO ES RELEVANTE NO ES RELEVANTE ^^

      // Prueba de caracteres (texto convertido a CP858)
      // buffers.push(textBuf("Prueba caracteres: á é í ó ú ñ Ñ ü Ü ç Ç € @ # $ % &/()=?¡'¿\n\n"));
      // buffers.push(textBuf(allChars + '\n\n'));

      // Cabezal centrado (ESC a 1)
      buffers.push(esc([0x1B, 0x61, 0x01])); 
      buffers.push(textBuf(`${empresaDemo.razonSocial}\n`));
      buffers.push(textBuf(`RUT: ${empresaDemo.rut}\n`));
      buffers.push(textBuf(`${empresaDemo.giro}\n`));
      buffers.push(textBuf(`${empresaDemo.direccion}, ${empresaDemo.comuna}\n`));
      buffers.push(textBuf(`${empresaDemo.ciudad}\n`));
      buffers.push(textBuf(`Tel: ${empresaDemo.telefono}\n`));
      pushCorreoSeguro(buffers, empresaDemo.correo);
      buffers.push(textBuf('------------------------------------------\n'));

      // Volver a alineación izquierda
      buffers.push(esc([0x1B, 0x61, 0x00])); // ESC a 0 -> left
      buffers.push(encodedWithRaw(['Venta ', Buffer.from('#'),  `${venta.id_venta}\n`]));
      buffers.push(textBuf(`Fecha: ${venta.fecha}\n`));
      buffers.push(textBuf('------------------------------------------\n'));

      for (const d of detalles) {
        const line = `${d.cantidad} x ${d.nombre}`;
        const precio = `$${d.precio_unitario}`;
        // ajustar ancho (simple, impresoras ~42-48 cols según fuente; aquí usamos padEnd/padStart con 40/10)
        const formatted = line.padEnd(30).slice(0, 30) + precio.padStart(10).slice(-10) + '\n';
        buffers.push(textBuf(formatted));
      }

      buffers.push(textBuf('------------------------------------------\n'));
      buffers.push(textBuf(`Neto: $${neto}\n`));
      buffers.push(textBuf(`IVA (19%): $${iva}\n`));
      buffers.push(textBuf(`TOTAL: $${venta.total}\n`));
      buffers.push(textBuf('------------------------------------------\n'));

      // Centrar mensaje y cortar
      buffers.push(esc([0x1B, 0x61, 0x01])); // center
      buffers.push(textBuf('Gracias por su compra\n\n'));

      // Feed y corte (comandos comunes)
      buffers.push(esc([0x1B, 0x64, 0x03])); // ESC d 3 -> avance de 3 líneas
      buffers.push(esc([0x1D, 0x56, 0x42, 0x00])); // GS V B 0 -> corte parcial (algunos modelos usan 0x30 en vez de 0x00)

      // Concatenar todos los buffers
      const payload = Buffer.concat(buffers);

      // Enviar por socket TCP
      return new Promise((resolve, reject) => {
        const client = new net.Socket();
        let errored = false;

        client.setTimeout(5000); // timeout de conexión/envío

        client.connect(PRINTER_PORT, PRINTER_IP, () => {
          // una vez conectado, escribir todo el payload
          client.write(payload, (err) => {
            if (err) {
              errored = true;
              client.destroy();
              return reject(new InternalServerErrorException('Error al escribir en la impresora: ' + err.message));
            }
            // esperar un momento para que la impresora reciba antes de cerrar
            setTimeout(() => {
              client.end();
            }, 200);
          });
        });

        client.on('close', () => {
          if (!errored) {
            resolve({
              usarImpresora: true,
              printer: 'XP-80C (via TCP)',
              venta,
            });
          }
        });

        client.on('error', (err) => {
          errored = true;
          client.destroy();
          reject(new InternalServerErrorException('No se pudo conectar a la impresora: ' + err.message));
        });

        client.on('timeout', () => {
          errored = true;
          client.destroy();
          reject(new InternalServerErrorException('Timeout al conectar con la impresora'));
        });
      });
    }

    // ------------------------- PNG PREVIEW -------------------------
    const width = 570;
    const lineHeight = 20;
    const height = 300 + detalles.length * lineHeight;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#FFF';
    ctx.fillRect(0, 0, width, height);

    try {
      const logo = await loadImage(empresaDemo.logo);
      ctx.drawImage(logo, width - 80, 10, 80, 80);
    } catch {}

    ctx.fillStyle = '#000';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`${empresaDemo.razonSocial}`, width / 2, 40);

    ctx.font = '12px Arial';
    ctx.fillText(`RUT: ${empresaDemo.rut}`, width / 2, 60);
    ctx.fillText(`${empresaDemo.giro}`, width / 2, 75);
    ctx.fillText(`${empresaDemo.direccion}, ${empresaDemo.comuna}`, width / 2, 90);
    ctx.fillText(`${empresaDemo.ciudad}`, width / 2, 105);

    ctx.font = '12px Arial';
    ctx.textAlign = 'left';
    let y = 120;
    ctx.fillText(`Venta #: ${venta.id_venta}`, 10, y);
    ctx.fillText(`Fecha: ${venta.fecha}`, 10, y + 18);
    y += 40;

    ctx.fillText('------------------------------------------', 10, y);
    y += 20;

    for (const d of detalles) {
      ctx.fillText(`${d.cantidad} x Prod#${d.id_producto}`, 10, y);
      ctx.textAlign = 'right';
      ctx.fillText(`$${d.precio_unitario}`, width - 10, y);
      ctx.textAlign = 'left';
      y += lineHeight;
    }

    ctx.fillText('------------------------------------------', 10, y);
    y += 20;
    ctx.fillText(`Neto: $${neto}`, 10, y);
    y += 18;
    ctx.fillText(`IVA (19%): $${iva}`, 10, y);
    y += 18;
    ctx.font = 'bold 14px Arial';
    ctx.fillText(`TOTAL: $${venta.total}`, 10, y);

    const buffer = canvas.toBuffer('image/png');
    const base64 = buffer.toString('base64');

    return {
      usarImpresora: false,
      venta,
      boletaBase64: base64,
    };
  }

  // Estadísticas...
  async productosMasVendidos() {
    return this.prisma.detalle_venta.groupBy({
      by: ['id_producto'],
      _sum: { cantidad: true },
      orderBy: { _sum: { cantidad: 'desc' } },
      take: 5,
    });
  }

  async ventasPorEmpresa() {
    return this.prisma.venta.groupBy({
      by: ['id_empresa'],
      _sum: { total: true },
      _count: { _all: true },
    });
  }

  async ingresosPorFecha(inicio: string, fin: string) {
    return this.prisma.venta.findMany({
      where: { fecha: { gte: new Date(inicio), lte: new Date(fin) } },
      select: { fecha: true, total: true },
    });
  }
}
 */

// dte.service.ts (solo emitirDte modificado)
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { createCanvas, loadImage } from 'canvas';
import * as iconv from 'iconv-lite';

@Injectable()
export class DteService {
  constructor(private prisma: PrismaService) {}

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

    // Build ESC/POS bytes (igual que tenías)
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

/*     // Generar preview PNG (igual que tenías)
    const width = 570;
    const lineHeight = 20;
    const height = 300 + detalles.length * lineHeight;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFF'; ctx.fillRect(0,0,width,height);
    try { const logo = await loadImage(empresaDemo.logo); ctx.drawImage(logo, width-80, 10, 80, 80); } catch {}
    ctx.fillStyle = '#000'; ctx.font='bold 16px Arial'; ctx.textAlign='center';
    ctx.fillText(`${empresaDemo.razonSocial}`, width/2, 40);
    ctx.font='12px Arial';
    ctx.fillText(`RUT: ${empresaDemo.rut}`, width/2, 60);
    // ... resto del texto similar ...
    let y = 120;
    ctx.fillText(`Venta #: ${venta.id_venta}`, 10, y);
    ctx.fillText(`Fecha: ${venta.fecha}`, 10, y + 18);
    y += 40;
    ctx.fillText('------------------------------------------', 10, y);
    y += 20;
    for (const d of detalles) {
      ctx.fillText(`${d.cantidad} x Prod#${d.id_producto}`, 10, y);
      ctx.textAlign = 'right';
      ctx.fillText(`$${d.precio_unitario}`, width - 10, y);
      ctx.textAlign = 'left';
      y += lineHeight;
    }
    ctx.fillText('------------------------------------------', 10, y);
    y += 20;
    ctx.fillText(`Neto: $${neto}`, 10, y);
    y += 18;
    ctx.fillText(`IVA (19%): $${iva}`, 10, y);
    y += 18;
    ctx.font='bold 14px Arial';
    ctx.fillText(`TOTAL: $${venta.total}`, 10, y);

    const pngBuffer = canvas.toBuffer('image/png'); */

    // Retornamos los bytes del ticket en base64 (para que el cliente/Electron los imprima)
    return {
      usarImpresora: true, // backend ya no intenta imprimir
      venta,
      boletaBase64: payloadBuffer.toString('base64'),
      ticketBase64: payloadBuffer.toString('base64') // ESC/POS raw en base64
    };
  }
// Estadísticas...
  async productosMasVendidos() {
    return this.prisma.detalle_venta.groupBy({
      by: ['id_producto'],
      _sum: { cantidad: true },
      orderBy: { _sum: { cantidad: 'desc' } },
      take: 5,
    });
  }

  async ventasPorEmpresa() {
    return this.prisma.venta.groupBy({
      by: ['id_empresa'],
      _sum: { total: true },
      _count: { _all: true },
    });
  }

  async ingresosPorFecha(inicio: string, fin: string) {
    return this.prisma.venta.findMany({
      where: { fecha: { gte: new Date(inicio), lte: new Date(fin) } },
      select: { fecha: true, total: true },
    });
  }
}