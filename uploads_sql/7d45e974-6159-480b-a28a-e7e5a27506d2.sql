-- phpMyAdmin SQL Dump
-- version 5.2.1
-- Host: localhost
-- Generation Time: Oct 27, 2025 at 01:00 AM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

CREATE DATABASE IF NOT EXISTS pos_import_test;
USE pos_import_test;

-- --------------------------------------------------------
-- Table structure for table `categorias`
-- --------------------------------------------------------
CREATE TABLE `categorias` (
  `codigo_categoria` INT AUTO_INCREMENT PRIMARY KEY,
  `nombreCategoria` VARCHAR(100),
  `detalle` TEXT
);

INSERT INTO `categorias` (`nombreCategoria`, `detalle`) VALUES
('Bebidas y Jugos', 'Productos líquidos para consumo'),
('Snacks y Dulces', 'Artículos comestibles de pequeño tamaño');

-- --------------------------------------------------------
-- Table structure for table `detalleVentas`
-- --------------------------------------------------------
CREATE TABLE `detalleVentas` (
  `detalleId` INT AUTO_INCREMENT PRIMARY KEY,
  `ventaCodigo` INT,
  `productoCodigo` INT,
  `cant` INT,
  `precioUnit` DECIMAL(10,2),
  `subtotal` DECIMAL(10,2)
);

INSERT INTO `detalleVentas` (`ventaCodigo`, `productoCodigo`, `cant`, `precioUnit`, `subtotal`) VALUES
(1, 1, 2, 1500.00, 3000.00),
(1, 2, 1, 700.00, 700.00);

-- --------------------------------------------------------
-- Table structure for table `empresas`
-- --------------------------------------------------------
CREATE TABLE `empresas` (
  `empresaId` INT AUTO_INCREMENT PRIMARY KEY,
  `nombreComercial` VARCHAR(255),
  `rutEmpresa` VARCHAR(20),
  `direccionFiscal` VARCHAR(255),
  `telefonoContacto` VARCHAR(50),
  `correoEmpresa` VARCHAR(255),
  `codigoSII` VARCHAR(50),
  `claveSII` VARCHAR(50)
);

INSERT INTO `empresas` (`nombreComercial`, `rutEmpresa`, `direccionFiscal`, `telefonoContacto`, `correoEmpresa`, `codigoSII`, `claveSII`) VALUES
('MiniMarket Central', '76.987.654-3', 'Av. Comercio 99', '987654321', 'contacto@minimarket.cl', 'COD56789', 'CLAVE12345'),
('Distribuidora ABC', '77.654.321-0', 'Calle Mayor 55', '912345678', 'ventas@abcdistrib.cl', 'COD44444', 'PASS99999');

-- --------------------------------------------------------
-- Table structure for table `formas_pago`
-- --------------------------------------------------------
CREATE TABLE `formas_pago` (
  `codigo_pago` INT AUTO_INCREMENT PRIMARY KEY,
  `metodoPago` VARCHAR(100),
  `detallePago` TEXT
);

INSERT INTO `formas_pago` (`metodoPago`, `detallePago`) VALUES
('Efectivo', 'Pago directo en caja'),
('Transferencia', 'Pago vía transferencia electrónica');

-- --------------------------------------------------------
-- Table structure for table `historialProductos`
-- --------------------------------------------------------
CREATE TABLE `historialProductos` (
  `historialId` INT AUTO_INCREMENT PRIMARY KEY,
  `productoCodigo` INT,
  `fechaMovimiento` DATETIME,
  `tipoAccion` VARCHAR(50),
  `cantMovimiento` INT,
  `rut` INT
);

INSERT INTO `historialProductos` (`productoCodigo`, `fechaMovimiento`, `tipoAccion`, `cantMovimiento`, `rut`) VALUES
(1, '2025-09-17 23:22:41', 'salida', 2, 12345678),
(2, '2025-09-17 23:22:41', 'salida', 1, 12345678);

-- --------------------------------------------------------
-- Table structure for table `productos`
-- --------------------------------------------------------
CREATE TABLE `productos` (
  `codigo_producto` INT AUTO_INCREMENT PRIMARY KEY,
  `nombreItem` VARCHAR(255),
  `detalleProducto` TEXT,
  `precioCompra` DECIMAL(10,2),
  `precioNeto` DECIMAL(10,2),
  `precioVenta` DECIMAL(10,2),
  `existencias` INT,
  `categoriaCodigo` INT,
  `empresaId` INT
);

INSERT INTO `productos` (`nombreItem`, `detalleProducto`, `precioCompra`, `precioNeto`, `precioVenta`, `existencias`, `categoriaCodigo`, `empresaId`) VALUES
('Refresco Cola 1.5L', 'Bebida gaseosa sabor cola', 800.00, 1000.00, 1500.00, 40, 1, 1),
('Jugo Piña 1L', 'Jugo natural sabor piña', 700.00, 900.00, 1200.00, 22, 1, 1);

-- --------------------------------------------------------
-- Table structure for table `usuarios`
-- --------------------------------------------------------
CREATE TABLE `usuarios` (
  `rut` INT PRIMARY KEY,
  `nombreUsuario` VARCHAR(255),
  `correo` VARCHAR(255),
  `claveAcceso` VARCHAR(255),
  `rolUsuario` VARCHAR(50),
  `empresaId` INT
);

INSERT INTO `usuarios` (`rut`, `nombreUsuario`, `correo`, `claveAcceso`, `rolUsuario`, `empresaId`) VALUES
(12345678, 'Carlos Díaz', 'carlos@minimarket.cl', 'abcd', 'admin', 1),
(87654321, 'María López', 'maria@abcdistrib.cl', '1234', 'vendedor', 2);

-- --------------------------------------------------------
-- Table structure for table `ventas`
-- --------------------------------------------------------
CREATE TABLE `ventas` (
  `codigo_venta` INT AUTO_INCREMENT PRIMARY KEY,
  `fechaVenta` DATETIME,
  `totalVenta` DECIMAL(10,2),
  `rut` INT,
  `empresaId` INT
);

INSERT INTO `ventas` (`fechaVenta`, `totalVenta`, `rut`, `empresaId`) VALUES
('2025-09-17 23:22:40', 3700.00, 12345678, 1),
('2025-10-01 05:45:15', 8900.00, 12345678, 1);

-- --------------------------------------------------------
-- Table structure for table `ventas_pago`
-- --------------------------------------------------------
CREATE TABLE `ventas_pago` (
  `ventaCodigo` INT,
  `codigo_pago` INT,
  `montoPagado` DECIMAL(10,2)
);

INSERT INTO `ventas_pago` (`ventaCodigo`, `codigo_pago`, `montoPagado`) VALUES
(1, 1, 3700.00),
(2, 2, 8900.00);
