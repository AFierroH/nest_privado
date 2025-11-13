<p align="center">
<a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

<p align="center">
<h1>Librería Backend Compartida (nest_privado)</h1>
</p>

<p align="center">
Un paquete privado para centralizar la lógica de NestJS del ecosistema POS-SII.
</p>

<p align="center">
<a href="#" target="_blank"><img src="https://www.google.com/search?q=https://img.shields.io/badge/framework-NestJS-red.svg" alt="Framework NestJS" /></a>
<a href="#" target="_blank"><img src="https://www.google.com/search?q=https://img.shields.io/badge/status-privado-red.svg" alt="Paquete Privado" /></a>
<a href="#" target="_blank"><img src="https://www.google.com/search?q=https://img.shields.io/badge/npm-v1.0.0-blue.svg" alt="NPM Version" /></a>
<a href="#" target="_blank"><img src="https://www.google.com/search?q=https://img.shields.io/badge/license-MIT-blue.svg" alt="Package License" /></a>
</p>

Descripción

Esta librería es un paquete privado de npm/pnpm que centraliza la lógica de negocio, la configuración y las utilidades compartidas del backend para el ecosistema de proyectos POS-SII.

El propósito principal de este paquete es seguir el principio D.R.Y. (Don't Repeat Yourself), asegurando que todos los microservicios o aplicaciones del backend compartan una base de código común, consistente y mantenible.

Decisiones de Diseño y Justificación

La creación de esta librería fue una decisión técnica clave para evitar la duplicación de código entre los distintos servicios que componen la plataforma (ej. API principal, servicios de workers, etc.).

Al centralizar la lógica en este paquete:

Se unifica la conexión a la base de datos, exportando un PrismaModule y un PrismaService preconfigurados.

Se estandarizan los DTOs (Data Transfer Objects), asegurando que todas las API utilicen las mismas estructuras de datos.

Se centraliza la lógica de autenticación y autorización (ej. Guards de NestJS, estrategias de Passport).

Se comparten decoradores, interceptores y filtros de excepciones comunes para mantener un comportamiento coherente en todas las APIs.

Módulos Incluidos

AuthModule: Configuración centralizada de JWT, Guards (ej. JwtAuthGuard, RolesGuard).

PrismaModule: Servicio PrismaService singleton para toda la aplicación.

ConfigModule: Carga y validación de variables de entorno (.env).

CommonModule: Decoradores (ej. @GetUser()), Interceptores (ej. LoggingInterceptor) y Filtros (ej. HttpExceptionFilter) compartidos.

SharedDTOs: Interfaces y DTOs de validación para entidades comunes (Usuario, Producto, Venta).

Uso

Este paquete no está pensado para ejecutarse de forma independiente. Se instala como una dependencia en otros proyectos de NestJS (como AFierroH/pos_sii_nest).

# Ejemplo de instalación local durante el desarrollo
# (Desde la carpeta de pos_sii_nest)
npm install ../nest_privado
