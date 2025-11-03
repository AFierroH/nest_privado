import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { UsuarioService } from './usuario.service';

@Controller('usuarios')
export class UsuarioController {
  constructor(private readonly usuarioService: UsuarioService) {}

  @Get()
  async all() {
    return this.usuarioService.getAll();
  }

  @Post()
  async create(@Body() data: any) {
    return this.usuarioService.create(data);
  }

  @Put(':id')
  async update(@Param('id') id: number, @Body() data: any) {
    return this.usuarioService.update(Number(id), data);
  }

  @Delete(':id')
  async delete(@Param('id') id: number) {
    return this.usuarioService.delete(Number(id));
  }
}
