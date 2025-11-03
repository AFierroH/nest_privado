// Arranca el servidor NestJS en el puerto 3000
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.setGlobalPrefix('api');
  await app.listen(3000);
  console.log(`Servidor corriendo en: ${await app.getUrl()}`);
}
bootstrap();