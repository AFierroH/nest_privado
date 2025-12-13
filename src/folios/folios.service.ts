import { Injectable, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import * as fs from 'fs'
import * as xml2js from 'xml2js'

@Injectable()
export class FoliosService {
  constructor(private prisma: PrismaService) {}

  /* ================================
     SUBIR Y PROCESAR CAF
     ================================ */
  async procesarCafXml(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Archivo CAF no recibido')
    }

    const xml = file.buffer.toString('utf-8')

    const parser = new xml2js.Parser({ explicitArray: false })
    const data = await parser.parseStringPromise(xml)

    try {
      const caf = data.AUTORIZACION

      const tipoDte = Number(caf.CAF.DA.TD)
      const folioDesde = Number(caf.CAF.DA.RNG.D)
      const folioHasta = Number(caf.CAF.DA.RNG.H)
      const rutEmisor = caf.CAF.DA.RE

      // ⚠️ Ajusta empresa_id como tú lo manejes
      const empresa = await this.prisma.empresa.findFirst({
        where: { rut: rutEmisor }
      })

      if (!empresa) {
        throw new Error('Empresa no encontrada para este CAF')
      }

      const nuevo = await this.prisma.folio_caf.create({
        data: {
          empresa_id: empresa.id_empresa,
          tipo_dte: tipoDte,
          folio_desde: folioDesde,
          folio_hasta: folioHasta,
          folio_actual: folioDesde - 1,
          caf_archivo: xml,
          activo: true
        }
      })

      return {
        tipo_dte: nuevo.tipo_dte,
        folio_desde: nuevo.folio_desde,
        folio_hasta: nuevo.folio_hasta,
        folio_actual: nuevo.folio_actual,
        activo: nuevo.activo
      }
    } catch (e) {
      throw new BadRequestException('CAF inválido o mal formado')
    }
  }

  /* ================================
     LISTAR CAFs
     ================================ */
  async listar() {
    return this.prisma.folio_caf.findMany({
      orderBy: { created_at: 'desc' }
    })
  }

  /* ================================
     USO EN EMISIÓN DTE
     ================================ */
  async obtenerSiguienteFolio(
    empresaId: number,
    tipoDte: number
  ): Promise<{ folio: number; cafArchivo: string }> {
    const caf = await this.prisma.folio_caf.findFirst({
      where: {
        empresa_id: empresaId,
        tipo_dte: tipoDte,
        activo: true
      },
      orderBy: { folio_desde: 'asc' }
    })

    if (!caf) {
      throw new Error('No hay CAF activo para esta empresa')
    }

    const siguiente = caf.folio_actual + 1

    if (siguiente > caf.folio_hasta) {
      await this.prisma.folio_caf.update({
        where: { id: caf.id },
        data: { activo: false }
      })

      throw new Error('CAF agotado')
    }

    await this.prisma.folio_caf.update({
      where: { id: caf.id },
      data: { folio_actual: siguiente }
    })

    return {
      folio: siguiente,
      cafArchivo: caf.caf_archivo
    }
  }
}