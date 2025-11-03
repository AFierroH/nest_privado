import { Controller, Post, Body } from '@nestjs/common';
import { DteService } from './dte.service';

@Controller('dte')
export class DteController {
  constructor(private dte: DteService) {}

  @Post('emitir')
  async emitir(@Body() payload: any) {
    // payload incluye usarImpresora boolean
    return this.dte.emitirDte(payload);
  }
}
