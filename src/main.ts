import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 1. Prefijo API (CRUCIAL)
  app.setGlobalPrefix('api');

  // 2. CORS (Permitir que el frontend se conecte)
  app.enableCors({
    origin: '*', // Permitir todo por ahora para descartar problemas
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // 3. Aumentar tamaño de subida (para las imágenes)
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '50mb' }));

  // 4. Validaciones
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
  }));

  // 5. ESCUCHAR EN 0.0.0.0 (CRUCIAL PARA DOCKER)
  await app.listen(3000, '0.0.0.0');
  
  console.log(`Servidor corriendo en: ${await app.getUrl()}`);
}
bootstrap();