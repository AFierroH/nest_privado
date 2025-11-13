import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import * as iconv from 'iconv-lite';
import * as bwipjs from 'bwip-js';
import * as fs from 'fs';
import * as path from 'path';
import PDFDocument from 'pdfkit';
import * as xmlbuilder from 'xmlbuilder2';

@Injectable()
export class VentaService {
  constructor(private prisma: PrismaService) {}

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
      logo: "https://upload.wikimedia.org/wikipedia/commons/4/45/Coca-Cola_logo.svg"
    };

    const fecha = new Date().toLocaleString('es-CL', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
    const venta = { id_venta: Math.floor(Math.random() * 99999), fecha, total, id_usuario, id_empresa, detalles };
    const neto = Math.round(total / 1.19);
    const iva = total - neto;

    // ----------------------------------------------------------------------
    // ✅ Generar código PDF417 real
    // ----------------------------------------------------------------------
    const pdf417Base64 = await new Promise<string>((resolve, reject) => {
      bwipjs.toBuffer({
        bcid: 'pdf417',
        text: `RUTEmisor:${empresaDemo.rut}|Folio:${venta.id_venta}|MntTotal:${total}|FchEmis:${fecha}|TipoDTE:39`,
        scale: 3,
        height: 6,
        includetext: false,
      }, (err, png) => {
        if (err) reject(err);
        else resolve(png.toString('base64'));
      });
    });

    // ----------------------------------------------------------------------
    // ✅ Generar XML del DTE simulado
    // ----------------------------------------------------------------------
    const xmlObj = {
      DTE: {
        '@version': '1.0',
        Documento: {
          Encabezado: {
            IdDoc: {
              TipoDTE: 39,
              Folio: venta.id_venta,
              FchEmis: fecha,
            },
            Emisor: {
              RUTEmisor: empresaDemo.rut,
              RznSoc: empresaDemo.razonSocial,
              GiroEmis: empresaDemo.giro,
              DirOrigen: empresaDemo.direccion,
              CmnaOrigen: empresaDemo.comuna,
              CiudadOrigen: empresaDemo.ciudad,
            },
            Totales: {
              MntNeto: neto,
              IVA: iva,
              MntTotal: total,
            },
          },
          Detalles: detalles.map((d, i) => ({
            NroLinDet: i + 1,
            NmbItem: d.nombre,
            QtyItem: d.cantidad,
            PrcItem: d.precio_unitario,
            MontoItem: d.cantidad * d.precio_unitario,
          })),
        },
      },
    };

    const xmlStr = xmlbuilder.create(xmlObj).end({ prettyPrint: true });
    const saveDir = path.join(process.cwd(), 'boletas_guardadas');
    fs.mkdirSync(saveDir, { recursive: true });
    const xmlPath = path.join(saveDir, `boleta_${venta.id_venta}.xml`);
    fs.writeFileSync(xmlPath, xmlStr, 'utf8');

    // ----------------------------------------------------------------------
    // ✅ Generar PDF de boleta
    // ----------------------------------------------------------------------
    const pdfPath = path.join(saveDir, `boleta_${venta.id_venta}.pdf`);
    const doc = new PDFDocument({ margin: 30 });
    const stream = fs.createWriteStream(pdfPath);
    doc.pipe(stream);

    doc.fontSize(16).text(empresaDemo.razonSocial, { align: 'center' });
    doc.fontSize(10).text(`RUT: ${empresaDemo.rut}`, { align: 'center' });
    doc.moveDown();
    doc.text(`BOLETA ELECTRÓNICA Nº ${venta.id_venta}`, { align: 'center' });
    doc.moveDown();
    doc.text(`${empresaDemo.direccion}, ${empresaDemo.comuna}`, { align: 'center' });
    doc.text(`${empresaDemo.ciudad} — Tel: ${empresaDemo.telefono}`, { align: 'center' });
    doc.moveDown();
    doc.text(`Fecha: ${venta.fecha}`);
    doc.moveDown();

    doc.text('----------------------------------------');
    for (const d of detalles) {
      doc.text(`${d.cantidad} x ${d.nombre}`);
      doc.text(`  ${new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(d.cantidad * d.precio_unitario)}`);
    }
    doc.text('----------------------------------------');
    doc.text(`Neto: ${neto}`);
    doc.text(`IVA: ${iva}`);
    doc.text(`TOTAL: ${total}`, { align: 'right' });
    doc.moveDown();

    const pdf417Buffer = Buffer.from(pdf417Base64, 'base64');
    doc.image(pdf417Buffer, { fit: [220, 60], align: 'center', valign: 'center' });
    doc.moveDown();
    doc.text('Timbre Electrónico SII', { align: 'center' });
    doc.text('Res. NRO.80 de 22-08-2014', { align: 'center' });
    doc.text('Verifique el documento en www.sii.cl', { align: 'center' });
    doc.end();

    await new Promise((res, rej) => {
      stream.on('finish', res);
      stream.on('error', rej);
    });

    // ----------------------------------------------------------------------
    // ✅ Preparar ticket ESC/POS
    // ----------------------------------------------------------------------
    const esc = (h: number[]) => Buffer.from(h);
    const textBuf = (s: string) => iconv.encode(s, 'cp858');
    const buffers: Buffer[] = [];

    const INIT = esc([0x1B, 0x40]);
    const ALIGN_CENTER = esc([0x1B, 0x61, 0x01]);
    const ALIGN_LEFT = esc([0x1B, 0x61, 0x00]);
    const DOUBLE_HW = esc([0x1D, 0x21, 0x11]);
    const RESET_HW = esc([0x1D, 0x21, 0x00]);
    const BOLD_ON = esc([0x1B, 0x45, 0x01]);
    const BOLD_OFF = esc([0x1B, 0x45, 0x00]);
    const CUT = esc([0x1D, 0x56, 0x42, 0x00]);
    const FEED = (n: number) => esc([0x1B, 0x64, n]);

    const ANCHO_TOTAL = 42;
    const ANCHO_PRECIO = 12;
    const ANCHO_NOMBRE = ANCHO_TOTAL - ANCHO_PRECIO;

    buffers.push(INIT, ALIGN_CENTER, DOUBLE_HW, textBuf(`${empresaDemo.razonSocial}\n`));
    buffers.push(RESET_HW);
    buffers.push(textBuf(`RUT: ${empresaDemo.rut}\n`));
    buffers.push(BOLD_ON, textBuf(`BOLETA ELECTRÓNICA Nº ${venta.id_venta}\n`), BOLD_OFF);
    buffers.push(textBuf(`${empresaDemo.direccion}, ${empresaDemo.comuna}\n`));
    buffers.push(textBuf(`${empresaDemo.ciudad} — Tel: ${empresaDemo.telefono}\n`));
    buffers.push(textBuf('------------------------------------------\n'));
    buffers.push(ALIGN_LEFT);
    buffers.push(textBuf(`Fecha: ${venta.fecha}\n`));
    buffers.push(textBuf('------------------------------------------\n'));

    for (const d of detalles) {
      const nombre = `${d.cantidad} x ${d.nombre}`.padEnd(ANCHO_NOMBRE);
      const precio = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(d.cantidad * d.precio_unitario).padStart(ANCHO_PRECIO);
      buffers.push(textBuf(`${nombre}${precio}\n`));
    }

    buffers.push(textBuf('------------------------------------------\n'));
    buffers.push(textBuf(`TOTAL:`.padEnd(ANCHO_NOMBRE) + `${total}`.padStart(ANCHO_PRECIO) + '\n'));
    buffers.push(ALIGN_CENTER, textBuf('Gracias por su compra\n'), FEED(1));
    buffers.push(textBuf('Timbre Electrónico SII\nRes. NRO.80 de 22-08-2014\nVerifique el documento en www.sii.cl\n'));
    buffers.push(FEED(3), CUT);

    const payloadBuffer = Buffer.concat(buffers);

    return {
      ok: true,
      usarImpresora,
      venta,
      xmlPath,
      pdfPath,
      pdf417Base64,
      ticketBase64: payloadBuffer.toString('base64'),
      textPreview: Buffer.concat(buffers).toString(),
    };
  }
}
