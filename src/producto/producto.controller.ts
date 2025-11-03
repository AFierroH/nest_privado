import { Controller, Get, Post, Put, Delete, Param, Body, Query } from '@nestjs/common';
import { ProductoService } from './producto.service';

@Controller('productos')
export class ProductoController {
  constructor(private readonly productoService: ProductoService) {}

  @Get()
  async getProductos(@Query('search') search?: string) {
    return this.productoService.getProductos(search);
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
