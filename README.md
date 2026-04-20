# DGIIT | SECTURI | Hyper-Glass Dashboard

Dashboard de gestión de proyectos con estilo Glassmorphism y conexión a base de datos MySQL.

## 📋 Requisitos Previos

- **Node.js** (v16 o superior)
- **MySQL** (v8.0 o superior) - MAMP o MySQL standalone
- **npm** (v8 o superior)

## 🚀 Instalación y Configuración

### 1. Configurar la Base de Datos MySQL

#### Para MAMP:
1. Asegúrate de que MAMP esté ejecutándose
2. Abre phpMyAdmin en `http://localhost:8889/phpmyadmin`
3. Importa el archivo `database.sql`

#### Para MySQL standalone:
Ejecuta el script SQL para crear la base de datos y las tablas:

```bash
mysql -u root -p < database.sql
```

O importa el archivo `database.sql` desde tu cliente MySQL preferido.

### 2. Configurar Variables de Entorno

Edita el archivo `.env` y configura tus credenciales de MySQL:

#### Para MAMP (por defecto):
```env
DB_HOST=127.0.0.1
DB_PORT=8889
DB_USER=root
DB_PASSWORD=root
DB_NAME=dgiit_secturi
PORT=3000
```

#### Para MySQL standalone:
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=tu_contraseña
DB_NAME=dgiit_secturi
PORT=3000
```

### 3. Instalar Dependencias

```bash
npm install
```

### 4. Iniciar el Servidor

```bash
npm start
```

El servidor se iniciará en `http://localhost:3000`

### 5. Acceder a la Aplicación

Abre tu navegador y ve a:
```
http://localhost:3000
```

## 📁 Estructura del Proyecto

```
glass-task/
├── .env                 # Variables de entorno (NO subir a Git)
├── server.js           # Servidor Node.js/Express
├── app-db.js           # Lógica de la aplicación con DB
├── api-client.js       # Cliente API para llamadas HTTP
├── database.sql        # Script SQL para crear la DB
├── index.html          # Estructura HTML
├── styles.css          # Estilos CSS
├── package.json        # Dependencias npm
└── README.md           # Este archivo
```

## 🔌 Endpoints de la API

### Autenticación
- `POST /api/login` - Iniciar sesión

### Usuarios
- `GET /api/users` - Obtener todos los usuarios
- `POST /api/users` - Crear nuevo usuario
- `PUT /api/users/:id` - Actualizar usuario
- `DELETE /api/users/:id` - Eliminar usuario

### Tareas
- `GET /api/tasks` - Obtener todas las tareas
- `POST /api/tasks` - Crear nueva tarea
- `PUT /api/tasks/:id` - Actualizar tarea
- `DELETE /api/tasks/:id` - Eliminar tarea

### Logs
- `GET /api/logs` - Obtener logs
- `POST /api/logs` - Guardar log

## 👤 Credenciales por Defecto

Después de ejecutar `database.sql`, los siguientes usuarios estarán disponibles:

| Email | Contraseña | Rol |
|-------|-----------|-----|
| `god@sgc.pro` | `god123` | GOD |
| `emartinezes@guanajuato.gob.mx` | `guanajuato123` | ADMIN |
| `admin1@sgc.pro` | `admin123` | ADMIN |
| `user@sgc.pro` | `user123` | USER |

## 🛠️ Desarrollo

### Modo Desarrollo

```bash
npm run dev
```

### Reiniciar Servidor Automáticamente (con nodemon)

Instala nodemon globalmente:
```bash
npm install -g nodemon
```

Luego ejecuta:
```bash
nodemon server.js
```

## 📝 Notas Importantes

1. **NUNCA** subas el archivo `.env` a Git. Ya está incluido en `.gitignore`.
2. Cambia las contraseñas por defecto después de la instalación.
3. El servidor solo sirve la API. Los archivos estáticos (HTML, CSS, JS) se sirven directamente desde el navegador.

## 🔒 Seguridad

- Las contraseñas se almacenan en texto plano en la base de datos (recomendación: usar hash con bcrypt en producción)
- Implementar HTTPS en producción
- Agregar validación de inputs en el servidor
- Implementar rate limiting para evitar ataques de fuerza bruta

## 📄 Licencia

ISC
