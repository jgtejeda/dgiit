-- SGC PRO | Base de Datos MySQL
-- Ejecutar este script para crear la base de datos y tablas

SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

-- Crear base de datos
CREATE DATABASE IF NOT EXISTS sgc_pro CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE sgc_pro;

-- Limpiar tablas si existen
DROP TABLE IF EXISTS task_comments;
DROP TABLE IF EXISTS task_todos;
DROP TABLE IF EXISTS logs;
DROP TABLE IF EXISTS tasks;
DROP TABLE IF EXISTS users;

-- Tabla de usuarios
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    role ENUM('GOD', 'ADMIN', 'USER') DEFAULT 'USER',
    position VARCHAR(100),
    department VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabla de tareas
CREATE TABLE IF NOT EXISTS tasks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    status ENUM('TODO', 'PROGRESS', 'DONE', 'ARCHIVED') DEFAULT 'TODO',
    assignee VARCHAR(100),
    deadline DATETIME,
    priority ENUM('BAJA', 'MEDIA', 'ALTA', 'CRÍTICA') DEFAULT 'MEDIA',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabla de etapas (todos)
CREATE TABLE IF NOT EXISTS task_todos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    task_id INT NOT NULL,
    label VARCHAR(255) NOT NULL,
    is_done TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabla de comentarios
CREATE TABLE IF NOT EXISTS task_comments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    task_id INT NOT NULL,
    author_name VARCHAR(100) NOT NULL,
    author_role ENUM('GOD','ADMIN','USER') NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabla de logs
CREATE TABLE IF NOT EXISTS logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_name VARCHAR(100) NOT NULL,
    email VARCHAR(100),
    role VARCHAR(20),
    action TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Insertar usuarios por defecto
INSERT INTO users (email, password, name, role, position, department) VALUES
('god@sgc.pro', 'god123', 'Omnisciente', 'GOD', 'Super Usuario', 'Sistema'),
('emartinezes@guanajuato.gob.mx', 'guanajuato123', 'Elizabeth Martínez Escobar', 'ADMIN', 'Enlace Administrativo/a', 'Dirección General de Innovación e Inteligencia Turística'),
('admin1@sgc.pro', 'admin123', 'Admin Primario', 'ADMIN', 'Administrador', 'Operaciones'),
('user@sgc.pro', 'user123', 'Operativo Estándar', 'USER', 'Operativo', 'Tierra');

-- Insertar tareas por defecto
INSERT INTO tasks (title, description, status, assignee, deadline, priority) VALUES
('Análisis de Capas PNG', 'Optimizar motor blending CSS para mejorar profundidad visual.', 'TODO', 'Omnisciente', '2026-04-10 12:00:00', 'ALTA'),
('Motor Parallax 3D', 'Implementar inercia y multiplicadores de capa avanzados.', 'PROGRESS', 'Elizabeth Martínez Escobar', '2026-04-09 18:00:00', 'CRÍTICA');

-- Verificar datos
SELECT 'Base de datos sgc_pro creada exitosamente' AS status;
SELECT * FROM users;
SELECT * FROM tasks;
