import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma.service'

@Injectable()
export class FoliosService {
  constructor(private prisma: PrismaService) {}

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

    // 🔴 CAF agotado
    if (siguiente > caf.folio_hasta) {
      await this.prisma.folio_caf.update({
        where: { id: caf.id },
        data: { activo: false }
      })

      const next = await this.prisma.folio_caf.findFirst({
        where: {
          empresa_id: empresaId,
          tipo_dte: tipoDte,
          activo: false,
          folio_desde: { gt: caf.folio_hasta }
        },
        orderBy: { folio_desde: 'asc' }
      })

      if (!next) {
        throw new Error('CAF agotado, no hay más folios')
      }

      await this.prisma.folio_caf.update({
        where: { id: next.id },
        data: { activo: true }
      })

      return this.obtenerSiguienteFolio(empresaId, tipoDte)
    }

    // ✅ Consumir folio
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
