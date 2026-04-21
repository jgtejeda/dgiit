-- MySQL dump 10.13  Distrib 8.0.45, for Linux (aarch64)
--
-- Host: localhost    Database: sgc_pro
-- ------------------------------------------------------
-- Server version	8.0.45

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `logs`
--

DROP TABLE IF EXISTS `logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_name` varchar(100) NOT NULL,
  `email` varchar(100) DEFAULT NULL,
  `role` varchar(20) DEFAULT NULL,
  `action` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=179 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `logs`
--

LOCK TABLES `logs` WRITE;
/*!40000 ALTER TABLE `logs` DISABLE KEYS */;
INSERT INTO `logs` VALUES (1,'Omnisciente','god@sgc.pro','GOD','Inicio de sesión exitoso','2026-04-17 20:32:45'),(2,'Omnisciente','god@sgc.pro','GOD','Inicio de sesión exitoso','2026-04-17 20:33:05'),(3,'Omnisciente','god@sgc.pro','GOD','Inicio de sesión exitoso','2026-04-17 20:39:57'),(4,'Omnisciente','god@sgc.pro','GOD','Inicio de sesión exitoso','2026-04-17 20:41:35'),(5,'Omnisciente','god@sgc.pro','GOD','Inicio de sesión exitoso','2026-04-17 20:51:01'),(6,'Omnisciente','god@sgc.pro','GOD','Inicio de sesión exitoso','2026-04-17 20:58:13'),(7,'Omnisciente','god@sgc.pro','GOD','Eliminó usuario: user@sgc.pro','2026-04-17 20:58:23'),(8,'Omnisciente','god@sgc.pro','GOD','Eliminó usuario: admin1@sgc.pro','2026-04-17 20:58:27'),(9,'Omnisciente','god@sgc.pro','GOD','Creó usuario: MARCO ANTONIO MORALES GARCÍA','2026-04-17 20:59:59'),(10,'Omnisciente','god@sgc.pro','GOD','Cierre de sesión','2026-04-17 21:00:04'),(11,'MARCO ANTONIO MORALES GARCÍA','mamoralesg@guanajuato.gob.mx','ADMIN','Inicio de sesión exitoso','2026-04-17 21:00:22'),(12,'MARCO ANTONIO MORALES GARCÍA','mamoralesg@guanajuato.gob.mx','ADMIN','Arrastró ficha \"Análisis de Capas PNG\" a PROGRESS','2026-04-17 21:00:26'),(13,'MARCO ANTONIO MORALES GARCÍA','mamoralesg@guanajuato.gob.mx','ADMIN','Creó usuario: GIBRANN','2026-04-17 21:01:12'),(14,'MARCO ANTONIO MORALES GARCÍA','mamoralesg@guanajuato.gob.mx','ADMIN','Cierre de sesión','2026-04-17 21:01:14'),(15,'GIBRANN','jgtejeda@guanajuato.gob.mx','ADMIN','Inicio de sesión exitoso','2026-04-17 21:01:32'),(16,'GIBRANN','jgtejeda@guanajuato.gob.mx','ADMIN','Eliminó usuario: emartinezes@guanajuato.gob.mx','2026-04-17 21:01:56'),(17,'GIBRANN','jgtejeda@guanajuato.gob.mx','ADMIN','Eliminó usuario: mamoralesg@guanajuato.gob.mx','2026-04-17 21:01:59'),(18,'GIBRANN','jgtejeda@guanajuato.gob.mx','ADMIN','Inicio de sesión exitoso','2026-04-17 21:07:42'),(19,'GIBRANN','jgtejeda@guanajuato.gob.mx','ADMIN','Eliminó ficha permanentemente: \"Motor Parallax 3D\"','2026-04-17 21:07:46'),(20,'GIBRANN','jgtejeda@guanajuato.gob.mx','ADMIN','Eliminó ficha permanentemente: \"Análisis de Capas PNG\"','2026-04-17 21:07:47'),(21,'GIBRANN','jgtejeda@guanajuato.gob.mx','ADMIN','Creó ficha: \"Motor Parallax 3D\" para GIBRANN','2026-04-17 21:08:09'),(22,'GIBRANN','jgtejeda@guanajuato.gob.mx','ADMIN','Actualizó ficha: \"Motor Parallax 3D\"','2026-04-17 21:08:14'),(23,'GIBRANN','jgtejeda@guanajuato.gob.mx','ADMIN','Inicio de sesión exitoso','2026-04-17 21:09:41'),(24,'GIBRANN','jgtejeda@guanajuato.gob.mx','ADMIN','Eliminó ficha permanentemente: \"Motor Parallax 3D\"','2026-04-17 21:09:44'),(25,'GIBRANN','jgtejeda@guanajuato.gob.mx','ADMIN','Creó ficha: \"Motor Parallax 3D\" para GIBRANN','2026-04-17 21:10:09'),(26,'GIBRANN','jgtejeda@guanajuato.gob.mx','ADMIN','Arrastró ficha \"Motor Parallax 3D\" a PROGRESS','2026-04-17 21:10:17'),(27,'GIBRANN','jgtejeda@guanajuato.gob.mx','ADMIN','Dejó una nota en la ficha #4','2026-04-17 21:10:34'),(28,'GIBRANN','jgtejeda@guanajuato.gob.mx','ADMIN','Creó usuario: gimbo','2026-04-17 21:15:46'),(29,'GIBRANN','jgtejeda@guanajuato.gob.mx','ADMIN','Cierre de sesión','2026-04-17 21:15:49'),(30,'gimbo','gibranntn@gmail.com','USER','Inicio de sesión exitoso','2026-04-17 21:16:03'),(31,'gimbo','gibranntn@gmail.com','USER','Inicio de sesión exitoso','2026-04-17 21:16:45'),(32,'gimbo','gibranntn@gmail.com','USER','Creó ficha: \"Motor Parallax 3D\" para gimbo','2026-04-17 21:17:02'),(33,'gimbo','gibranntn@gmail.com','USER','Inicio de sesión exitoso','2026-04-17 21:23:00'),(34,'gimbo','gibranntn@gmail.com','USER','Cierre de sesión','2026-04-17 21:23:20'),(35,'GIBRANN','jgtejeda@guanajuato.gob.mx','ADMIN','Inicio de sesión exitoso','2026-04-17 21:23:23'),(36,'GIBRANN','jgtejeda@guanajuato.gob.mx','ADMIN','Inicio de sesión exitoso','2026-04-17 21:25:03'),(37,'GIBRANN','jgtejeda@guanajuato.gob.mx','ADMIN','Cierre de sesión','2026-04-17 21:25:37'),(38,'gimbo','gibranntn@gmail.com','USER','Inicio de sesión exitoso','2026-04-17 21:25:41'),(39,'gimbo','gibranntn@gmail.com','USER','Cierre de sesión','2026-04-17 21:28:45'),(40,'Omnisciente','god@sgc.pro','GOD','Inicio de sesión exitoso','2026-04-17 21:34:06'),(41,'Omnisciente','god@sgc.pro','GOD','Cierre de sesión','2026-04-17 21:37:24'),(42,'Omnisciente','god@sgc.pro','GOD','Inicio de sesión exitoso','2026-04-17 21:37:35'),(43,'Omnisciente','god@sgc.pro','GOD','Cierre de sesión','2026-04-17 21:37:39'),(44,'Omnisciente','god@sgc.pro','GOD','Cierre de sesión','2026-04-17 21:38:34'),(45,'Omnisciente','god@sgc.pro','GOD','Inicio de sesión exitoso','2026-04-17 21:40:04'),(46,'Omnisciente','god@sgc.pro','GOD','Cierre de sesión','2026-04-17 21:40:09'),(47,'Omnisciente','god@sgc.pro','GOD','Inicio de sesión exitoso','2026-04-17 21:42:32'),(48,'Omnisciente','god@sgc.pro','GOD','Cierre de sesión','2026-04-17 21:42:38'),(49,'gimbo','gibranntn@gmail.com','USER','Inicio de sesión exitoso','2026-04-17 21:42:41'),(50,'gimbo','gibranntn@gmail.com','USER','Cierre de sesión','2026-04-17 21:42:47'),(51,'Omnisciente','god@sgc.pro','GOD','Inicio de sesión exitoso','2026-04-19 01:07:22'),(52,'Omnisciente','god@sgc.pro','GOD','Arrastró ficha \"Motor Parallax 3D\" a PROGRESS','2026-04-19 01:07:27'),(53,'Omnisciente','god@sgc.pro','GOD','Cierre de sesión','2026-04-19 01:07:41'),(54,'gimbo','gibranntn@gmail.com','USER','Inicio de sesión exitoso','2026-04-19 01:07:58'),(55,'gimbo','gibranntn@gmail.com','USER','Actualizó progreso de \"Motor Parallax 3D\" a 17%','2026-04-19 01:08:28'),(56,'gimbo','gibranntn@gmail.com','USER','Dejó una nota en la ficha #5','2026-04-19 01:08:34'),(57,'gimbo','gibranntn@gmail.com','USER','Cierre de sesión','2026-04-19 01:09:27'),(58,'Omnisciente','god@sgc.pro','GOD','Inicio de sesión exitoso','2026-04-19 01:42:15'),(59,'Omnisciente','god@sgc.pro','GOD','Inicio de sesión exitoso','2026-04-19 23:30:50'),(60,'Omnisciente','god@sgc.pro','GOD','Inicio de sesión exitoso','2026-04-19 23:30:50'),(61,'Omnisciente','god@sgc.pro','GOD','Actualizó su ficha de perfil','2026-04-19 23:31:18'),(62,'Omnisciente','god@sgc.pro','GOD','Cierre de sesión manual','2026-04-19 23:36:42'),(63,'Omnisciente','god@sgc.pro','GOD','Inicio de sesión exitoso','2026-04-19 23:36:44'),(64,'Omnisciente','god@sgc.pro','GOD','Inicio de sesión exitoso','2026-04-19 23:36:44'),(65,'Omnisciente','god@sgc.pro','GOD','Inicio de sesión exitoso','2026-04-19 23:43:00'),(66,'Omnisciente','god@sgc.pro','GOD','Inicio de sesión exitoso','2026-04-19 23:43:00'),(67,'Omnisciente','god@sgc.pro','GOD','Cierre de sesión manual','2026-04-19 23:46:43'),(68,'Omnisciente','god@sgc.pro','GOD','Inicio de sesión exitoso','2026-04-19 23:46:46'),(69,'Omnisciente','god@sgc.pro','GOD','Inicio de sesión exitoso','2026-04-19 23:46:46'),(70,'Omnisciente','god@sgc.pro','GOD','Cierre de sesión manual','2026-04-19 23:46:51'),(71,'Omnisciente','god@sgc.pro','GOD','Inicio de sesión exitoso','2026-04-19 23:51:36'),(72,'Omnisciente','god@sgc.pro','GOD','Inicio de sesión exitoso','2026-04-19 23:51:36'),(73,'Omnisciente','god@sgc.pro','GOD','Recuperación de sesión automática','2026-04-19 23:57:04'),(74,'Omnisciente','god@sgc.pro','GOD','Cierre de sesión manual','2026-04-19 23:57:19'),(75,'Omnisciente','god@sgc.pro','GOD','Inicio de sesión exitoso','2026-04-20 00:05:54'),(76,'Omnisciente','god@sgc.pro','GOD','Inicio de sesión exitoso','2026-04-20 00:05:54'),(77,'Omnisciente','god@sgc.pro','GOD','Cierre de sesión manual','2026-04-20 00:08:13'),(78,'Omnisciente','god@sgc.pro','GOD','Inicio de sesión exitoso','2026-04-20 00:08:41'),(79,'Omnisciente','god@sgc.pro','GOD','Inicio de sesión exitoso','2026-04-20 00:08:41'),(80,'Omnisciente','god@sgc.pro','GOD','Cierre de sesión manual','2026-04-20 00:08:47'),(81,'Omnisciente','god@sgc.pro','GOD','Inicio de sesión exitoso','2026-04-20 00:45:54'),(82,'Omnisciente','god@sgc.pro','GOD','Inicio de sesión exitoso','2026-04-20 00:45:55'),(83,'Omnisciente','god@sgc.pro','GOD','Cierre de sesión manual','2026-04-20 00:46:05'),(84,'Omnisciente','god@sgc.pro','GOD','Inicio de sesión exitoso','2026-04-20 00:51:36'),(85,'Omnisciente','god@sgc.pro','GOD','Inicio de sesión exitoso','2026-04-20 00:51:36'),(86,'Omnisciente','god@sgc.pro','GOD','Cierre de sesión manual','2026-04-20 00:51:40'),(87,'Omnisciente','god@sgc.pro','GOD','Inicio de sesión exitoso','2026-04-20 00:52:58'),(88,'Omnisciente','god@sgc.pro','GOD','Inicio de sesión exitoso','2026-04-20 00:52:58'),(89,'Omnisciente','god@sgc.pro','GOD','Recuperación de sesión automática','2026-04-20 00:55:01'),(90,'Omnisciente','god@sgc.pro','GOD','Recuperación de sesión automática','2026-04-20 00:55:07'),(91,'Omnisciente','god@sgc.pro','GOD','Recuperación de sesión automática','2026-04-20 00:56:24'),(92,'Omnisciente','god@sgc.pro','GOD','Recuperación de sesión automática','2026-04-20 00:57:42'),(93,'Omnisciente','god@sgc.pro','GOD','Arrastró ficha \"Motor Parallax 3D\" a TODO','2026-04-20 00:57:51'),(94,'Omnisciente','god@sgc.pro','GOD','Arrastró ficha \"Motor Parallax 3D\" a PROGRESS','2026-04-20 00:58:22'),(95,'Omnisciente','god@sgc.pro','GOD','Arrastró ficha \"Motor Parallax 3D\" a TODO','2026-04-20 00:58:24'),(96,'Omnisciente','god@sgc.pro','GOD','Recuperación de sesión automática','2026-04-20 01:00:09'),(97,'Omnisciente','god@sgc.pro','GOD','Cierre de sesión manual','2026-04-20 01:00:24'),(98,'Omnisciente','god@sgc.pro','GOD','Inicio de sesión exitoso','2026-04-20 01:00:28'),(99,'Omnisciente','god@sgc.pro','GOD','Inicio de sesión exitoso','2026-04-20 01:00:28'),(100,'Omnisciente','god@sgc.pro','GOD','Recuperación de sesión automática','2026-04-20 01:01:44'),(101,'Omnisciente','god@sgc.pro','GOD','Recuperación de sesión automática','2026-04-20 01:02:57'),(102,'Omnisciente','god@sgc.pro','GOD','Recuperación de sesión automática','2026-04-20 01:03:48'),(103,'Omnisciente','god@sgc.pro','GOD','Cierre de sesión manual','2026-04-20 01:04:03'),(104,'Omnisciente','god@sgc.pro','GOD','Inicio de sesión exitoso','2026-04-20 01:04:06'),(105,'Omnisciente','god@sgc.pro','GOD','Inicio de sesión exitoso','2026-04-20 01:04:06'),(106,'Omnisciente','god@sgc.pro','GOD','Recuperación de sesión automática','2026-04-20 01:44:37'),(107,'Omnisciente','god@sgc.pro','GOD','Recuperación de sesión automática','2026-04-20 01:44:39'),(108,'Omnisciente','god@sgc.pro','GOD','Recuperación de sesión automática','2026-04-20 01:44:43'),(109,'Omnisciente','god@sgc.pro','GOD','Cierre de sesión manual','2026-04-20 01:45:29'),(110,'Omnisciente','god@sgc.pro','GOD','Inicio de sesión exitoso','2026-04-20 01:45:31'),(111,'Omnisciente','god@sgc.pro','GOD','Inicio de sesión exitoso','2026-04-20 01:45:31'),(112,'Omnisciente','god@sgc.pro','GOD','Recuperación de sesión automática','2026-04-20 01:45:46'),(113,'Omnisciente','god@sgc.pro','GOD','Recuperación de sesión automática','2026-04-20 01:45:53'),(114,'Omnisciente','god@sgc.pro','GOD','Recuperación de sesión automática','2026-04-20 01:46:00'),(115,'Omnisciente','god@sgc.pro','GOD','Inicio de sesión exitoso','2026-04-21 17:55:48'),(116,'Omnisciente','god@sgc.pro','GOD','Inicio de sesión exitoso','2026-04-21 17:55:48'),(117,'Omnisciente','god@sgc.pro','GOD','Recuperación de sesión automática','2026-04-21 17:55:53'),(118,'Omnisciente','god@sgc.pro','GOD','Eliminó ficha permanentemente: \"Motor Parallax 3D\"','2026-04-21 17:55:56'),(119,'Omnisciente','god@sgc.pro','GOD','Eliminó ficha permanentemente: \"Motor Parallax 3D\"','2026-04-21 17:55:58'),(120,'Omnisciente','god@sgc.pro','GOD','Cambió contraseña de usuario: gibranntn@gmail.com','2026-04-21 17:56:19'),(121,'Omnisciente','god@sgc.pro','GOD','Cierre de sesión manual','2026-04-21 17:56:24'),(122,'gimbo','gibranntn@gmail.com','USER','Inicio de sesión exitoso','2026-04-21 17:59:56'),(123,'gimbo','gibranntn@gmail.com','USER','Inicio de sesión exitoso','2026-04-21 17:59:56'),(124,'Omnisciente','god@sgc.pro','GOD','Inicio de sesión exitoso','2026-04-21 18:00:31'),(125,'Omnisciente','god@sgc.pro','GOD','Inicio de sesión exitoso','2026-04-21 18:00:31'),(126,'Omnisciente','god@sgc.pro','GOD','Cambió contraseña de usuario: god@sgc.pro','2026-04-21 18:00:43'),(127,'Omnisciente','god@sgc.pro','GOD','Cierre de sesión manual','2026-04-21 18:00:45'),(128,'Omnisciente','god@sgc.pro','GOD','Inicio de sesión exitoso','2026-04-21 18:04:53'),(129,'Omnisciente','god@sgc.pro','GOD','Inicio de sesión exitoso','2026-04-21 18:04:53'),(130,'Omnisciente','god@sgc.pro','GOD','Inicio de sesión exitoso','2026-04-21 18:09:25'),(131,'Omnisciente','god@sgc.pro','GOD','Inicio de sesión exitoso','2026-04-21 18:09:25'),(132,'Omnisciente','god@sgc.pro','GOD','Creó usuario: ely','2026-04-21 18:10:38'),(133,'ely','emartinezes@guanajuato.gob.mx','ADMIN','Inicio de sesión exitoso','2026-04-21 18:10:56'),(134,'ely','emartinezes@guanajuato.gob.mx','ADMIN','Inicio de sesión exitoso','2026-04-21 18:10:56'),(135,'Omnisciente','god@sgc.pro','GOD','Inicio de sesión exitoso','2026-04-21 18:11:26'),(136,'Omnisciente','god@sgc.pro','GOD','Inicio de sesión exitoso','2026-04-21 18:11:26'),(137,'Omnisciente','god@sgc.pro','GOD','Cambió contraseña de usuario: gibranntn@gmail.com','2026-04-21 18:11:36'),(138,'Omnisciente','god@sgc.pro','GOD','Cierre de sesión manual','2026-04-21 18:11:37'),(139,'ely','emartinezes@guanajuato.gob.mx','ADMIN','Inicio de sesión exitoso','2026-04-21 18:11:58'),(140,'ely','emartinezes@guanajuato.gob.mx','ADMIN','Inicio de sesión exitoso','2026-04-21 18:11:58'),(141,'ely','emartinezes@guanajuato.gob.mx','ADMIN','Eliminó usuario: gibranntn@gmail.com','2026-04-21 18:12:07'),(142,'ely','emartinezes@guanajuato.gob.mx','ADMIN','Creó usuario: gib','2026-04-21 18:12:31'),(143,'ely','emartinezes@guanajuato.gob.mx','ADMIN','Cierre de sesión manual','2026-04-21 18:12:33'),(144,'gib','gibranntn@gmail.com','USER','Inicio de sesión exitoso','2026-04-21 18:12:43'),(145,'gib','gibranntn@gmail.com','USER','Inicio de sesión exitoso','2026-04-21 18:12:43'),(146,'gib','gibranntn@gmail.com','USER','Cierre de sesión manual','2026-04-21 18:12:46'),(147,'gib','gibranntn@gmail.com','USER','Inicio de sesión exitoso','2026-04-21 18:14:27'),(148,'gib','gibranntn@gmail.com','USER','Inicio de sesión exitoso','2026-04-21 18:14:27'),(149,'ely','emartinezes@guanajuato.gob.mx','ADMIN','Inicio de sesión exitoso','2026-04-21 18:16:20'),(150,'ely','emartinezes@guanajuato.gob.mx','ADMIN','Inicio de sesión exitoso','2026-04-21 18:16:20'),(151,'ely','emartinezes@guanajuato.gob.mx','ADMIN','Recuperación de sesión automática','2026-04-21 18:24:18'),(152,'ely','emartinezes@guanajuato.gob.mx','ADMIN','Recuperación de sesión automática','2026-04-21 18:24:20'),(153,'ely','emartinezes@guanajuato.gob.mx','ADMIN','Cierre de sesión manual','2026-04-21 18:24:26'),(154,'gib','gibranntn@gmail.com','USER','Inicio de sesión exitoso','2026-04-21 18:24:30'),(155,'gib','gibranntn@gmail.com','USER','Inicio de sesión exitoso','2026-04-21 18:24:30'),(156,'ely','emartinezes@guanajuato.gob.mx','ADMIN','Inicio de sesión exitoso','2026-04-21 18:24:35'),(157,'ely','emartinezes@guanajuato.gob.mx','ADMIN','Inicio de sesión exitoso','2026-04-21 18:24:35'),(158,'ely','emartinezes@guanajuato.gob.mx','ADMIN','Recuperación de sesión automática','2026-04-21 18:27:23'),(159,'ely','emartinezes@guanajuato.gob.mx','ADMIN','Creó ficha: \"Motor Parallax 3D\"','2026-04-21 18:27:36'),(160,'ely','emartinezes@guanajuato.gob.mx','ADMIN','Arrastró ficha \"Motor Parallax 3D\" a PROGRESS','2026-04-21 18:27:39'),(161,'ely','emartinezes@guanajuato.gob.mx','ADMIN','Recuperación de sesión automática','2026-04-21 18:29:26'),(162,'ely','emartinezes@guanajuato.gob.mx','ADMIN','Actualizó ficha: \"Motor Parallax 3D\"','2026-04-21 18:29:37'),(163,'ely','emartinezes@guanajuato.gob.mx','ADMIN','Recuperación de sesión automática','2026-04-21 18:34:02'),(164,'ely','emartinezes@guanajuato.gob.mx','ADMIN','Recuperación de sesión automática','2026-04-21 18:34:02'),(165,'ely','emartinezes@guanajuato.gob.mx','ADMIN','Recuperación de sesión automática','2026-04-21 18:34:03'),(166,'ely','emartinezes@guanajuato.gob.mx','ADMIN','Recuperación de sesión automática','2026-04-21 18:34:03'),(167,'ely','emartinezes@guanajuato.gob.mx','ADMIN','Recuperación de sesión automática','2026-04-21 18:34:03'),(168,'ely','emartinezes@guanajuato.gob.mx','ADMIN','Recuperación de sesión automática','2026-04-21 18:36:56'),(169,'ely','emartinezes@guanajuato.gob.mx','ADMIN','Actualizó progreso de \"Motor Parallax 3D\" a 29%','2026-04-21 18:38:15'),(170,'ely','emartinezes@guanajuato.gob.mx','ADMIN','Dejó una nota en la ficha #6','2026-04-21 18:38:20'),(171,'ely','emartinezes@guanajuato.gob.mx','ADMIN','Recuperación de sesión automática','2026-04-21 18:41:03'),(172,'ely','emartinezes@guanajuato.gob.mx','ADMIN','Recuperación de sesión automática','2026-04-21 18:41:41'),(173,'gib','gibranntn@gmail.com','USER','Inicio de sesión exitoso','2026-04-21 18:49:04'),(174,'gib','gibranntn@gmail.com','USER','Inicio de sesión exitoso','2026-04-21 18:49:04'),(175,'gib','gibranntn@gmail.com','USER','Recuperación de sesión automática','2026-04-21 18:49:07'),(176,'ely','emartinezes@guanajuato.gob.mx','ADMIN','Inicio de sesión exitoso','2026-04-21 18:52:08'),(177,'ely','emartinezes@guanajuato.gob.mx','ADMIN','Inicio de sesión exitoso','2026-04-21 18:52:09'),(178,'ely','emartinezes@guanajuato.gob.mx','ADMIN','Recuperación de sesión automática','2026-04-21 18:52:11');
/*!40000 ALTER TABLE `logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `push_subscriptions`
--

DROP TABLE IF EXISTS `push_subscriptions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `push_subscriptions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `subscription_json` text NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `push_subscriptions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `push_subscriptions`
--

LOCK TABLES `push_subscriptions` WRITE;
/*!40000 ALTER TABLE `push_subscriptions` DISABLE KEYS */;
/*!40000 ALTER TABLE `push_subscriptions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `task_assignees`
--

DROP TABLE IF EXISTS `task_assignees`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `task_assignees` (
  `id` int NOT NULL AUTO_INCREMENT,
  `task_id` int NOT NULL,
  `user_name` varchar(100) NOT NULL,
  `user_email` varchar(100) DEFAULT NULL,
  `added_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_task_user` (`task_id`,`user_email`),
  CONSTRAINT `task_assignees_ibfk_1` FOREIGN KEY (`task_id`) REFERENCES `tasks` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `task_assignees`
--

LOCK TABLES `task_assignees` WRITE;
/*!40000 ALTER TABLE `task_assignees` DISABLE KEYS */;
INSERT INTO `task_assignees` VALUES (6,6,'gib','gibranntn@gmail.com','2026-04-21 18:29:31'),(7,6,'GIBRANN','jgtejeda@guanajuato.gob.mx','2026-04-21 18:29:35');
/*!40000 ALTER TABLE `task_assignees` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `task_comments`
--

DROP TABLE IF EXISTS `task_comments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `task_comments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `task_id` int NOT NULL,
  `author_name` varchar(100) NOT NULL,
  `author_role` enum('GOD','ADMIN','USER') NOT NULL,
  `content` text NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `task_id` (`task_id`),
  CONSTRAINT `task_comments_ibfk_1` FOREIGN KEY (`task_id`) REFERENCES `tasks` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `task_comments`
--

LOCK TABLES `task_comments` WRITE;
/*!40000 ALTER TABLE `task_comments` DISABLE KEYS */;
INSERT INTO `task_comments` VALUES (3,6,'ely','ADMIN','hoa','2026-04-21 18:38:20');
/*!40000 ALTER TABLE `task_comments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `task_todos`
--

DROP TABLE IF EXISTS `task_todos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `task_todos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `task_id` int NOT NULL,
  `label` varchar(255) NOT NULL,
  `is_done` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `assigned_to` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `task_id` (`task_id`),
  CONSTRAINT `task_todos_ibfk_1` FOREIGN KEY (`task_id`) REFERENCES `tasks` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `task_todos`
--

LOCK TABLES `task_todos` WRITE;
/*!40000 ALTER TABLE `task_todos` DISABLE KEYS */;
/*!40000 ALTER TABLE `task_todos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tasks`
--

DROP TABLE IF EXISTS `tasks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tasks` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(200) NOT NULL,
  `description` text,
  `status` enum('TODO','PROGRESS','DONE','ARCHIVED') DEFAULT 'TODO',
  `assignee` varchar(100) DEFAULT NULL,
  `deadline` datetime DEFAULT NULL,
  `priority` enum('BAJA','MEDIA','ALTA','CRÍTICA') DEFAULT 'MEDIA',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `progress` int DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tasks`
--

LOCK TABLES `tasks` WRITE;
/*!40000 ALTER TABLE `tasks` DISABLE KEYS */;
INSERT INTO `tasks` VALUES (6,'Motor Parallax 3D','ssss','PROGRESS','','2026-04-30 12:00:00','MEDIA','2026-04-21 18:27:36','2026-04-21 18:38:15',29);
/*!40000 ALTER TABLE `tasks` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `email` varchar(100) NOT NULL,
  `password` varchar(255) NOT NULL,
  `name` varchar(100) NOT NULL,
  `role` enum('GOD','ADMIN','USER') DEFAULT 'USER',
  `position` varchar(100) DEFAULT NULL,
  `department` varchar(100) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `photo` longtext,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'god@sgc.pro','$2a$10$0cA1EeiLVzau6xQcFSraDORPeyKU0u/fFR4EJzr4gxPvQYdsrlXT6','Omnisciente','GOD','Super Usuario','Sistema','2026-04-17 20:32:18','2026-04-21 18:04:02','data:image/jpeg;base64,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'),(6,'jgtejeda@guanajuato.gob.mx','$2a$10$idclvWXjW0CvgRE5nenRDO5L/XD0BEIbsWq9X8cPCQy2D5GwVFqh6','GIBRANN','ADMIN','admin tec','dish','2026-04-17 21:01:12','2026-04-17 21:01:12',NULL),(8,'emartinezes@guanajuato.gob.mx','$2a$10$ZveRvdulZqcY6Wyfk/W.OuwgYjt1AvHzEt1zvZx8y737fUcD3Zaj.','ely','ADMIN','enlace','dgiit','2026-04-21 18:10:38','2026-04-21 18:10:38',NULL),(9,'gibranntn@gmail.com','$2a$10$p3srWF1M0uZO5LojzCHiy.uRAq2YiAomx.MVlzvN3QG0HnjLwwRoG','gib','USER','si','di','2026-04-21 18:12:31','2026-04-21 18:12:31',NULL);
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-04-21 18:54:05
