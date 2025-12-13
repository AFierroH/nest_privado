/*M!999999\- enable the sandbox mode */ 
-- MariaDB dump 10.19-12.0.2-MariaDB, for Win64 (AMD64)
--
-- Host: localhost    Database: pos_sii_es
-- ------------------------------------------------------
-- Server version	12.0.2-MariaDB

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*M!100616 SET @OLD_NOTE_VERBOSITY=@@NOTE_VERBOSITY, NOTE_VERBOSITY=0 */;

--
-- Estructura actualizada para tabla `categoria`
--

LOCK TABLES `categoria` WRITE;
/*!40000 ALTER TABLE `categoria` DISABLE KEYS */;
set autocommit=0;
INSERT INTO `categoria` VALUES
(1,'Bebidas','Refrescos y jugos'),
(2,'Snacks','Galletas, papas fritas, etc'),
(3,'Tecnología','Computadoras, televisores y gadgets'),
(4,'Electrodomésticos','Frigoríficos, lavadoras, microondas'),
(5,'Deportes','Bicicletas, equipos deportivos, accesorios'),
(6,'Vehículos','Motocicletas y autos');
/*!40000 ALTER TABLE `categoria` ENABLE KEYS */;
UNLOCK TABLES;
commit;

--
-- Estructura actualizada para tabla `empresa`
--

LOCK TABLES `empresa` WRITE;
/*!40000 ALTER TABLE `empresa` DISABLE KEYS */;
set autocommit=0;
INSERT INTO `empresa` VALUES
(1,'Supermercado Prueba','76.123.456-7','Av. Principal 123','987654321','contacto@superprueba.cl',NULL,'COD12345','CLAVE67890');
/*!40000 ALTER TABLE `empresa` ENABLE KEYS */;
UNLOCK TABLES;
commit;

--
-- Estructura actualizada para tabla `usuario`
--

LOCK TABLES `usuario` WRITE;
/*!40000 ALTER TABLE `usuario` DISABLE KEYS */;
set autocommit=0;
INSERT INTO `usuario` VALUES
(1,'Juan Pérez','juan@superprueba.cl','1234','admin',1),
(2,'armin','armin','1234','admin',NULL);
/*!40000 ALTER TABLE `usuario` ENABLE KEYS */;
UNLOCK TABLES;
commit;

--
-- Estructura actualizada para tabla `producto`
-- ADVERTENCIA: Se ajustó al esquema: 
-- (id, nombre, descripcion, precio, stock, codigo_barra, marca, proveedor, n_sellos, descuento_pct, id_categoria, id_empresa)
--

LOCK TABLES `producto` WRITE;
/*!40000 ALTER TABLE `producto` DISABLE KEYS */;
set autocommit=0;
INSERT INTO `producto` VALUES
(1,'Coca Cola 1.5L','Bebida gaseosa',1500.00,40,NULL,'Coca Cola','Andina',3,0,1,1),
(2,'Jugo Natural 1L','Jugo de naranja',1200.00,22,NULL,'Watts','CCU',1,0,1,1),
(3,'Papas Fritas 200g','Snack salado',1000.00,32,NULL,'Lays','Pepsico',2,0,2,1),
(15,'Agua Mineral 500ml','Agua sin gas',300.00,50,NULL,'Cachantun','CCU',0,0,1,1),
(16,'Galletas Dulces 100g','Galletas de chocolate',450.00,30,NULL,'McKay','Nestle',2,0,2,1),
(17,'Refresco Limón 500ml','Bebida gaseosa',350.00,40,NULL,'Sprite','Coca Cola',1,0,1,1),
(18,'Snack Mixto 150g','Snack salado variado',400.00,25,NULL,'Marco Polo','ICB',2,0,2,1),
(19,'Coca Cola 2L','Bebida gaseosa',1500.00,40,NULL,'Coca Cola','Andina',3,0,1,1),
(20,'Jugo Tropical 1L','Jugo de frutas',1200.00,25,NULL,'Watts','CCU',1,0,1,1),
(21,'Papas Fritas 300g','Snack salado',2000.00,35,NULL,'Lays','Pepsico',2,0,2,1),
(22,'Galletas Saladas 150g','Snack salado',1800.00,20,NULL,'Crackelet','Costa',2,0,2,1),
(23,'Auriculares Bluetooth','Audio inalámbrico',2500.00,15,NULL,'Sony','Sony Chile',0,0,3,1),
(24,'Laptop Gamer','Portátil para juegos',45000.00,10,NULL,'Asus','PC Factory',0,5,3,1),
(25,'Smart TV 55"','Televisor 4K',32000.00,5,NULL,'Samsung','Samsung Chile',0,10,3,1),
(26,'Bicicleta MTB','Bicicleta montaña',28000.00,8,NULL,'Trek','Sparta',0,0,5,1),
(27,'Consola de Juegos','Videojuegos última generación',35000.00,6,NULL,'Sony','Microplay',0,0,3,1),
(28,'Microondas 25L','Electrodoméstico cocina',22000.00,4,NULL,'Thomas','Ripley',0,0,4,1),
(29,'Motocicleta 150cc','Moto urbana',350000.00,2,NULL,'Honda','Honda Motor',0,0,6,1),
(30,'Refrigerador 400L','Frigo grande',420000.00,3,NULL,'LG','LG Electronics',0,15,4,1),
(31,'Auto usado','Sedán 2010',700000.00,1,NULL,'Toyota','Particular',0,0,6,1),
(32,'Laptop Workstation','Computadora profesional',250000.00,2,NULL,'Dell','Dell Chile',0,0,3,1),
(33,'TV 85" OLED','Televisor premium',280000.00,1,NULL,'LG','LG Electronics',0,0,3,1);
/*!40000 ALTER TABLE `producto` ENABLE KEYS */;
UNLOCK TABLES;
commit;

--
-- Estructura actualizada para tabla `venta`
--

LOCK TABLES `venta` WRITE;
/*!40000 ALTER TABLE `venta` DISABLE KEYS */;
set autocommit=0;
INSERT INTO `venta` VALUES
(1,'2025-09-17 23:22:40',3700.00,1,1),
(5,'2025-10-01 05:45:15',8900.00,1,1),
(6,'2025-10-01 05:49:27',8900.00,1,1),
(7,'2025-10-01 05:49:29',8900.00,1,1),
(8,'2025-10-01 05:54:29',8900.00,1,1);
/*!40000 ALTER TABLE `venta` ENABLE KEYS */;
UNLOCK TABLES;
commit;

--
-- Estructura actualizada para tabla `detalle_venta`
--

LOCK TABLES `detalle_venta` WRITE;
/*!40000 ALTER TABLE `detalle_venta` DISABLE KEYS */;
set autocommit=0;
INSERT INTO `detalle_venta` VALUES
(1,1,1,2,1500.00,3000.00),
(2,1,3,1,700.00,700.00),
(12,5,1,3,1500.00,4500.00),
(13,5,2,2,1200.00,2400.00),
(14,5,3,2,1000.00,2000.00),
(15,6,1,3,1500.00,4500.00),
(16,6,2,2,1200.00,2400.00),
(17,6,3,2,1000.00,2000.00),
(18,7,1,3,1500.00,4500.00),
(19,7,2,2,1200.00,2400.00),
(20,7,3,2,1000.00,2000.00),
(21,8,1,3,1500.00,4500.00),
(22,8,2,2,1200.00,2400.00),
(23,8,3,2,1000.00,2000.00);
/*!40000 ALTER TABLE `detalle_venta` ENABLE KEYS */;
UNLOCK TABLES;
commit;

--
-- Estructura actualizada para tabla `forma_pago`
--

LOCK TABLES `forma_pago` WRITE;
/*!40000 ALTER TABLE `forma_pago` DISABLE KEYS */;
set autocommit=0;
INSERT INTO `forma_pago` VALUES
(1,'efectivo','Pago en billetes o monedas'),
(2,'tarjeta','Pago con tarjeta débito/crédito'),
(3,'transferencia','Transferencia bancaria');
/*!40000 ALTER TABLE `forma_pago` ENABLE KEYS */;
UNLOCK TABLES;
commit;

--
-- Estructura actualizada para tabla `venta_pago`
--

LOCK TABLES `venta_pago` WRITE;
/*!40000 ALTER TABLE `venta_pago` DISABLE KEYS */;
set autocommit=0;
INSERT INTO `venta_pago` VALUES
(1,1,3700.00);
/*!40000 ALTER TABLE `venta_pago` ENABLE KEYS */;
UNLOCK TABLES;
commit;

--
-- Estructura actualizada para tabla `historial_productos`
--

LOCK TABLES `historial_productos` WRITE;
/*!40000 ALTER TABLE `historial_productos` DISABLE KEYS */;
set autocommit=0;
INSERT INTO `historial_productos` VALUES
(1,1,'2025-09-17 23:22:41','salida',2,1),
(2,3,'2025-09-17 23:22:41','salida',1,1),
(12,1,'2025-10-01 05:45:15','salida',3,1),
(13,2,'2025-10-01 05:45:15','salida',2,1),
(14,3,'2025-10-01 05:45:15','salida',2,1),
(15,1,'2025-10-01 05:49:27','salida',3,1),
(16,2,'2025-10-01 05:49:27','salida',2,1),
(17,3,'2025-10-01 05:49:27','salida',2,1),
(18,1,'2025-10-01 05:49:29','salida',3,1),
(19,2,'2025-10-01 05:49:29','salida',2,1),
(20,3,'2025-10-01 05:49:29','salida',2,1),
(21,1,'2025-10-01 05:54:29','salida',3,1),
(22,2,'2025-10-01 05:54:29','salida',2,1),
(23,3,'2025-10-01 05:54:29','salida',2,1);
/*!40000 ALTER TABLE `historial_productos` ENABLE KEYS */;
UNLOCK TABLES;
commit;

/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;
/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*M!100616 SET NOTE_VERBOSITY=@OLD_NOTE_VERBOSITY */;