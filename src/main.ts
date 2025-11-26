// Arranca el servidor NestJS en el puerto 3000
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useStaticAssets(join(__dirname, '..', 'uploads'), { prefix: '/uploads/' });
  app.enableCors({
      origin: true,
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
      credentials: true,
  });
  app.setGlobalPrefix('api');
  await app.listen(3000);
  console.log(`Servidor corriendo en: ${await app.getUrl()}`);
}
bootstrap();