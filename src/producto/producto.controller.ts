import { Controller, Get, Post, Put, Delete, Param, Body, Query } from '@nestjs/common';
import { ProductoService } from './producto.service';

@Controller('productos')
export class ProductoController {
  constructor(private readonly productoService: ProductoService) {}

  @Get()
  async getAll(
    @Query('search') search: string,
    @Query('empresaId') empresaId: string,
    @Query('page') page: string,   // <--- NUEVO
    @Query('limit') limit: string  // <--- NUEVO
  ) {
    const id = empresaId ? parseInt(empresaId) : undefined;
    // Convertimos a número, con valores por defecto (página 1, 20 productos por carga)
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 20;

    return this.productoService.getProductos(search, id, pageNum, limitNum);
  }

  @Post()
  async create(@Body() data: any) {
    return this.productoService.createProducto(data);
  }

  @Put(':id')
  async update(@Param('id') id: number, @Body() data: any) {
    return this.productoService.updateProducto(Number(id), data);
  }

  @Delete(':id')
  async delete(@Param('id') id: number) {
    return this.productoService.deleteProducto(Number(id));
  }

  @Post(':id/agregar-stock')
  async agregarStock(@Param('id') id: number, @Body() data: { cantidad: number }) {
    return this.productoService.agregarStock(Number(id), data.cantidad);
  }

  @Post(':id/quitar-stock')
  async quitarStock(@Param('id') id: number, @Body() data: { cantidad: number }) {
    return this.productoService.quitarStock(Number(id), data.cantidad);
  }
}
