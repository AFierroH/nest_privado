import { Controller, Get, Param } from '@nestjs/common'
import { FoliosService } from './folios.service'

@Controller('folios')
export class FoliosController {
  constructor(private readonly foliosService: FoliosService) {}

  @Get('next/:empresaId/:tipoDte')
  async next(
    @Param('empresaId') empresaId: number,
    @Param('tipoDte') tipoDte: number
  ) {
    return this.foliosService.obtenerSiguienteFolio(
      Number(empresaId),
      Number(tipoDte)
    )
  }
}
