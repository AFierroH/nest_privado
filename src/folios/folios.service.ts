import { Injectable, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import * as xml2js from 'xml2js'

@Injectable()
export class FoliosService {
  constructor(private prisma: PrismaService) {}

  /**
   * Procesa y guarda un archivo CAF XML
   */
  async procesarCafXml(file: Express.Multer.File, empresaId: number) {
    if (!file) {
      throw new BadRequestException('Archivo CAF no recibido')
    }

    const xml = file.buffer.toString('utf-8')
    console.log(`📄 Procesando CAF para empresa ${empresaId}...`)

    const parser = new xml2js.Parser({ explicitArray: false })
    
    try {
      const data = await parser.parseStringPromise(xml)
      const caf = data.AUTORIZACION

      if (!caf || !caf.CAF || !caf.CAF.DA) {
        throw new Error('Estructura XML inválida')
      }

      const tipoDte = Number(caf.CAF.DA.TD)
      const folioDesde = Number(caf.CAF.DA.RNG.D)
      const folioHasta = Number(caf.CAF.DA.RNG.H)
      const rutEmisor = caf.CAF.DA.RE

      console.log(`📋 CAF Info:`)
      console.log(`   - Tipo DTE: ${tipoDte}`)
      console.log(`   - Folios: ${folioDesde} - ${folioHasta}`)
      console.log(`   - RUT Emisor: ${rutEmisor}`)

      // Verificar que la empresa existe
      const empresa = await this.prisma.empresa.findUnique({
        where: { id_empresa: empresaId }
      })

      if (!empresa) {
        throw new BadRequestException(`Empresa con ID ${empresaId} no encontrada`)
      }

      // ADVERTENCIA: Verificar que el RUT coincida
      if (empresa.rut !== rutEmisor) {
        console.warn(`⚠️ ADVERTENCIA: RUT del CAF (${rutEmisor}) no coincide con RUT de la empresa (${empresa.rut})`)
        // No bloqueamos, pero advertimos
      }

      // Desactivar CAFs anteriores del mismo tipo
      await this.prisma.folio_caf.updateMany({
        where: {
          empresa_id: empresaId,
          tipo_dte: tipoDte,
          activo: true
        },
        data: { activo: false }
      })

      console.log(`✅ CAFs anteriores desactivados`)

      // Crear nuevo CAF
      const nuevo = await this.prisma.folio_caf.create({
        data: {
          empresa_id: empresaId,
          tipo_dte: tipoDte,
          folio_desde: folioDesde,
          folio_hasta: folioHasta,
          folio_actual: folioDesde - 1, // Empieza en -1 para que el primero sea folioDesde
          caf_archivo: xml,
          activo: true
        }
      })

      console.log(`✅ CAF guardado con ID ${nuevo.id}`)

      return {
        id: nuevo.id,
        tipo_dte: nuevo.tipo_dte,
        folio_desde: nuevo.folio_desde,
        folio_hasta: nuevo.folio_hasta,
        folio_actual: nuevo.folio_actual,
        activo: nuevo.activo,
        rut_emisor: rutEmisor
      }
      
    } catch (e) {
      console.error('❌ Error procesando CAF:', e.message)
      throw new BadRequestException(`Error al procesar CAF: ${e.message}`)
    }
  }

  /**
   * Listar todos los CAFs
   */
  async listar() {
    return this.prisma.folio_caf.findMany({
      include: { empresa: { select: { nombre: true, rut: true } } },
      orderBy: { created_at: 'desc' }
    })
  }

  /**
   * Obtener siguiente folio disponible y su CAF
   */
  async obtenerSiguienteFolio(
    empresaId: number,
    tipoDte: number
  ): Promise<{ folio: number; cafArchivo: string }> {
    
    console.log(`🔍 Buscando CAF activo para empresa ${empresaId}, tipo ${tipoDte}`)
    
    const caf = await this.prisma.folio_caf.findFirst({
      where: {
        empresa_id: empresaId,
        tipo_dte: tipoDte,
        activo: true
      },
      orderBy: { folio_desde: 'asc' }
    })

    if (!caf) {
      throw new Error(`No hay CAF activo para empresa ${empresaId} tipo DTE ${tipoDte}`)
    }

    const siguiente = caf.folio_actual + 1

    console.log(`📊 Folio actual: ${caf.folio_actual}, siguiente: ${siguiente}, hasta: ${caf.folio_hasta}`)

    if (siguiente > caf.folio_hasta) {
      await this.prisma.folio_caf.update({
        where: { id: caf.id },
        data: { activo: false }
      })

      throw new Error(`CAF agotado. Último folio: ${caf.folio_hasta}. Carga un nuevo CAF.`)
    }

    // Incrementar folio_actual
    await this.prisma.folio_caf.update({
      where: { id: caf.id },
      data: { folio_actual: siguiente }
    })

    console.log(`✅ Folio ${siguiente} asignado`)

    return {
      folio: siguiente,
      cafArchivo: caf.caf_archivo
    }
  }
}