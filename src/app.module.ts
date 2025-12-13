import { AppController } from './app.controller';
import { DteModule } from './dte/dte.module';
import { AppService } from './app.service';
import { Module } from '@nestjs/common';
import { EmpresaModule } from './empresa/empresa.module';
import { UsuarioModule } from './usuario/usuario.module';
import { VentaModule } from './venta/venta.module';
import { ProductoModule } from './producto/producto.module';
import { PrismaModule } from './prisma.module';
import { AuthModule } from './auth/auth.module';
import { EstadisticasModule } from './estadisticas/estadisticas.module';
import { ImportModule } from './import/import.module';
import { EmailModule } from './email/email.module';
import { ConfigModule } from '@nestjs/config';
import { FoliosModule } from './folios/folios.module';

@Module({
  imports: [PrismaModule, EmpresaModule, UsuarioModule, VentaModule, DteModule, ProductoModule, AuthModule, EstadisticasModule, ImportModule, EmailModule, FoliosModule, ConfigModule.forRoot({ isGlobal: true })],
  controllers: [AppController],
  providers: [AppService], 
})
export class AppModule {}