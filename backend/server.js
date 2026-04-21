/**
 * DGIIT | SECTURI | Backend Server con Node.js y MySQL
 * API REST para Autenticación, Usuarios, Tareas, Etapas y Retroalimentación
 */

require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { sendEmail } = require('./utils/mailer');
const { sendPush } = require('./utils/push');
const multer = require('multer');
const pdfParse = require('pdf-parse');

// ── Configuración de Multer: archivos PDF en disco ──────────────────────
const UPLOADS_DIR = path.join(__dirname, 'uploads', 'folios');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const folioStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const year = new Date().getFullYear().toString();
        const dir = path.join(UPLOADS_DIR, year);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const ts = Date.now();
        cb(null, `folio_${req.params.id}_${ts}.pdf`);
    }
});
const folioUpload = multer({
    storage: folioStorage,
    limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype !== 'application/pdf') {
            return cb(new Error('Solo se permiten archivos PDF'));
        }
        cb(null, true);
    }
});

const app = express();
const PORT = process.env.PORT || 3000;

// Manejo de errores globales
process.on('uncaughtException', (err) => { console.error('❌ EXCEPCIÓN NO CONTROLADA:', err); });
process.on('unhandledRejection', (reason) => { console.error('⚠️ RECHAZO NO CONTROLADO:', reason); });

const JWT_SECRET = process.env.JWT_SECRET || 'secret-key-fallback';

// Middleware: Verificar Token JWT
const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    // Permite token por query param ?token= (solo para el visor PDF)
    const token = (authHeader && authHeader.split(' ')[1]) || req.query.token;
    if (!token) return res.status(401).json({ success: false, message: 'Acceso denegado: Token no proporcionado' });

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(401).json({ success: false, message: 'Sesión expirada o token inválido' });
        req.user = decoded;
        next();
    });
};

// Middleware: Verificar Roles
const checkRole = (roles) => (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
        return res.status(403).json({ success: false, message: 'Permisos insuficientes para esta acción' });
    }
    next();
};

app.set('trust proxy', 1);

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            ...helmet.contentSecurityPolicy.getDefaultDirectives(),
            "img-src": ["'self'", "data:", "https://*"],
        },
    },
}));

app.use(cors({
    origin: true, // Reflejar origen de la petición
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Multer: almacenar PDFs en memoria para OCR
const uploadPDF = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') cb(null, true);
        else cb(new Error('Solo se aceptan archivos PDF'));
    }
});

// Limitación de peticiones para seguridad
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 2000, // Máximo 2000 peticiones por ventana
    message: { success: false, message: 'Demasiadas peticiones desde esta IP, por favor intenta más tarde.' }
});
app.use('/api/', limiter);

// Helper: Fecha a formato MySQL
function formatMySQLDate(dateInput) {
    if (!dateInput) return null;
    try {
        const d = new Date(dateInput);
        if (isNaN(d.getTime())) return null;
        return d.toISOString().slice(0, 19).replace('T', ' ');
    } catch (e) { return null; }
}

// Helper: Calcular progreso final según columna
function calcProgress(status, rawProgress) {
    if (status === 'TODO') return 0;
    if (status === 'DONE' || status === 'ARCHIVED') return 100;
    return Math.max(1, Math.min(99, parseInt(rawProgress) || 1));
}

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'sgc_pro',
    charset: 'utf8mb4'
};

const pool = mysql.createPool(dbConfig);

// Migraciones automáticas
async function runMigrations(conn) {
    const migrations = [
        `ALTER TABLE tasks MODIFY COLUMN status ENUM('TODO','PROGRESS','DONE','ARCHIVED') DEFAULT 'TODO'`,
        `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS progress INT DEFAULT 0`,
        `CREATE TABLE IF NOT EXISTS task_todos (
            id INT AUTO_INCREMENT PRIMARY KEY,
            task_id INT NOT NULL,
            label VARCHAR(255) NOT NULL,
            is_done TINYINT(1) DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
        `CREATE TABLE IF NOT EXISTS task_comments (
            id INT AUTO_INCREMENT PRIMARY KEY,
            task_id INT NOT NULL,
            author_name VARCHAR(100) NOT NULL,
            author_role ENUM('GOD','ADMIN','USER') NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
        // ─── Multi-Responsables ───────────────────────────────────────────
        `CREATE TABLE IF NOT EXISTS task_assignees (
            id INT AUTO_INCREMENT PRIMARY KEY,
            task_id INT NOT NULL,
            user_name VARCHAR(100) NOT NULL,
            user_email VARCHAR(100),
            added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
            UNIQUE KEY unique_task_user (task_id, user_email)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
        `ALTER TABLE task_todos ADD COLUMN assigned_to VARCHAR(100) DEFAULT NULL`,
        // Migrar responsable único existente a la nueva tabla
        `INSERT IGNORE INTO task_assignees (task_id, user_name, user_email)
            SELECT t.id, t.assignee, u.email
            FROM tasks t
            LEFT JOIN users u ON u.name = t.assignee
            WHERE t.assignee IS NOT NULL AND t.assignee != ''`,
        `ALTER TABLE users ADD COLUMN photo LONGTEXT DEFAULT NULL`,
        `CREATE TABLE IF NOT EXISTS push_subscriptions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            subscription_json TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
        // ─── access_type para usuarios ───────────────────────────────────────
        `ALTER TABLE users ADD COLUMN access_type ENUM('FOLIOS','FICHAS','AMBOS') DEFAULT 'AMBOS'`,
        // ─── Tabla Pre-Folios ───────────────────────────────────────────────
        `CREATE TABLE IF NOT EXISTS folios (
            id              INT AUTO_INCREMENT PRIMARY KEY,
            folio_number    VARCHAR(50) DEFAULT NULL,
            status          ENUM('PENDIENTE','ASIGNADO','CERRADO','CANCELADO') DEFAULT 'PENDIENTE',
            dirigido_a      VARCHAR(200) NOT NULL,
            cargo_dest      VARCHAR(200) NOT NULL,
            organismo       VARCHAR(200) NOT NULL,
            asunto          TEXT NOT NULL,
            quien_firma     VARCHAR(200) NOT NULL,
            solicitante_id  INT NOT NULL,
            solicitante_nombre VARCHAR(200) NOT NULL,
            area_resguardo  VARCHAR(200) NOT NULL,
            medio_envio     ENUM('PAM','FIRMA_AUTOGRAFA','PAM_Y_FIRMA','CORREO') NOT NULL,
            assigned_by_id  INT DEFAULT NULL,
            assigned_at     DATETIME DEFAULT NULL,
            pdf_filename    VARCHAR(255) DEFAULT NULL,
            pdf_path        VARCHAR(500) DEFAULT NULL,
            pdf_text        LONGTEXT DEFAULT NULL,
            pdf_uploaded_at DATETIME DEFAULT NULL,
            cancel_reason   TEXT DEFAULT NULL,
            cancelled_by_id INT DEFAULT NULL,
            cancelled_at    DATETIME DEFAULT NULL,
            created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (solicitante_id) REFERENCES users(id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        // ─── Centro de Notificaciones ───────────────────────────────────────
        `CREATE TABLE IF NOT EXISTS notifications (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            title VARCHAR(255) NOT NULL,
            message TEXT NOT NULL,
            type VARCHAR(50) DEFAULT 'SYSTEM',
            link_id INT DEFAULT NULL,
            is_read BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    ];
    for (const sql of migrations) {
        try {
            await conn.query(sql);
        } catch (e) {
            // Ignorar errores comunes de "columna ya existe" o "índice replicado"
            if (e.code !== 'ER_DUP_FIELDNAME' && e.code !== 'ER_DUP_KEYNAME' && e.code !== 'ER_PFS_ALREADY_EXISTS') {
                console.warn('⚙️  Migración (info):', e.message.substring(0, 80));
            }
        }
    }

    console.log('⚙️  Migraciones verificadas correctamente.');
}

async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('✅ Conectado a la base de datos MySQL');
        await runMigrations(connection);
        connection.release();
    } catch (error) {
        console.error('❌ Error conectando a MySQL:', error.message);
    }
}

testConnection();

// Helper: Notificaciones Contextuales Diferenciadas
async function sendContextualEmails(eventType, taskData, authorEmail, commentData = null) {
    try {
        const [authorRows] = await pool.query('SELECT name FROM users WHERE email = ?', [authorEmail]);
        const authorName = authorRows.length ? authorRows[0].name : (authorEmail || 'Alguien');
        const taskId = taskData.id;

        // Obtener responsables y admins (usando correos normalizados)
        const [asgRows] = await pool.query('SELECT LOWER(user_email) as email FROM task_assignees WHERE task_id = ?', [taskId]);
        const assigneeEmails = asgRows.map(r => r.email);
        
        const [admRows] = await pool.query('SELECT LOWER(email) as email FROM users WHERE role = "ADMIN"');
        const adminEmails = admRows.map(u => u.email);

        const [tRows] = await pool.query('SELECT title FROM tasks WHERE id = ?', [taskId]);
        const taskTitle = tRows.length ? tRows[0].title : (taskData.title || `Ficha #${taskId}`);

        // Destinatarios base
        let recipients = [...new Set([...assigneeEmails, ...adminEmails])];

        if (taskData.todo_assignee_email) {
            recipients.push(taskData.todo_assignee_email.toLowerCase());
        }

        recipients = [...new Set(recipients)].filter(e => e && e !== authorEmail.toLowerCase() && e !== 'god@sgc.pro');

        let msgPayload = { link_id: taskId, type: 'TASK' };
        
        if (eventType === 'CREATE') {
            msgPayload.title = '🚀 Nueva Ficha Creada';
            msgPayload.body = `${authorName} creó: ${taskTitle}`;
        } else if (eventType === 'UPDATE') {
            msgPayload.title = '📝 Ficha Actualizada';
            msgPayload.body = `${authorName} modificó: ${taskTitle} (${taskData.status || ''})`;
        } else if (eventType === 'COMMENT') {
            msgPayload.title = '💬 Nuevo Comentario';
            msgPayload.body = `${authorName} comentó en "${taskTitle}": ${commentData.content.substring(0, 50)}...`;
        } else if (eventType === 'TODO') {
            msgPayload.title = '🚩 Etapa Asignada';
            msgPayload.body = `${authorName} te asignó: "${taskData.todo_label}" en la ficha: ${taskTitle}`;
        }

        for (const email of recipients) {
            // 1. Notificación en Plataforma (Campana y Push)
            await broadcastPush(email, msgPayload);
            
            // 2. Notificación vía Correo Electrónico (Restaurado)
            try {
                await sendEmail({
                    to: email,
                    subject: msgPayload.title,
                    title: msgPayload.title,
                    message: msgPayload.body,
                    actionLink: `https://intratur.guanajuato.gob.mx/dgiit/`
                });
            } catch (err) {
                console.error(`❌ Fallo al enviar correo a ${email}:`, err.message);
            }
        }
    } catch (e) { console.error('❌ Error crítico en sendContextualEmails:', e); }
}

/**
 * Guarda una notificación in-app en la base de datos
 */
async function saveAppNotification(userEmail, title, message, taskId) {
    if (!userEmail) return;
    try {
        await pool.query(
            'INSERT INTO app_notifications (user_email, title, message, task_id) VALUES (?, ?, ?, ?)',
            [userEmail, title, message, taskId || null]
        );
    } catch (e) {
        console.error('Error guardando notificación in-app:', e);
    }
}

/**
 * Envía notificaciones Push a todos los dispositivos de un usuario
 */
async function broadcastPush(userEmail, payload) {
    try {
        if (!userEmail) return;
        const normalizedEmail = userEmail.toLowerCase().trim();

        // Búsqueda robusta (case-insensitive)
        const [uRows] = await pool.query('SELECT id FROM users WHERE LOWER(email) = ?', [normalizedEmail]);
        
        if (!uRows.length) {
            console.warn(`[Broadcast] Usuario no encontrado: ${normalizedEmail}`);
            return;
        }
        const userId = uRows[0].id;

        // 1. Persistir en la Bitácora (Campana Roja)
        const linkId = payload.link_id || (payload.data ? (payload.data.taskId || payload.data.folioId) : null);
        const nType = payload.type || payload.link_type || 'SYSTEM';

        await pool.query(
            'INSERT INTO notifications (user_id, title, message, type, link_id) VALUES (?, ?, ?, ?, ?)',
            [userId, payload.title || 'DGIIT', payload.body || '', nType, linkId]
        );

        // 2. Notificar vía Push (si tiene suscripciones)
        const [subs] = await pool.query('SELECT id, subscription_json FROM push_subscriptions WHERE user_id = ?', [userId]);
        for (const s of subs) {
            try {
                const subscription = JSON.parse(s.subscription_json);
                const res = await sendPush(subscription, payload);
                if (res && res.expired) {
                    await pool.query('DELETE FROM push_subscriptions WHERE id = ?', [s.id]);
                }
            } catch (err) {
                console.error(`[Push] Error en sub ${s.id}:`, err.message);
            }
        }
    } catch (e) {
        console.error('❌ Error crítico en broadcastPush:', e);
    }
}

// ============================================
// AUTH
// ============================================

app.post('/api/login', async (req, res) => {
    try {
        let { email, password } = req.body;
        if (email) email = email.trim();
        if (password) password = password.trim();

        const [rows] = await pool.query(
            'SELECT id, email, name, role, position, department, password, photo FROM users WHERE email = ?',
            [email]
        );

        if (rows.length > 0) {
            const user = rows[0];
            const dbPassword = user.password;

            // 1. Intentar comparar con hash (bcrypt)
            let isMatch = false;
            try {
                isMatch = await bcrypt.compare(password, dbPassword);
            } catch (e) {
                isMatch = false;
                require('fs').appendFileSync('login_debug.log', `Bcrypt error for ${email}: ${e.message}\n`);
            }

            // 2. Fallback: Comparar texto plano (migración)
            const isPlainTextMatch = (password === dbPassword);
            
            require('fs').appendFileSync('login_debug.log', `Login attempt for ${email}: isMatch=${isMatch}, isPlainTextMatch=${isPlainTextMatch}\n`);

            if (isMatch || isPlainTextMatch) {
                // Si hizo match con texto plano, actualizar a hash automáticamente
                if (isPlainTextMatch && !isMatch) {
                    const salt = await bcrypt.genSalt(10);
                    const hashedPassword = await bcrypt.hash(password, salt);
                    await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, user.id]);
                    console.log(`🔐 Password migrado a hash para usuario: ${email}`);
                }

                // Limpiar password antes de responder
                delete user.password;

                // Generar Token JWT (6 horas)
                const token = jwt.sign(
                    { id: user.id, email: user.email, role: user.role },
                    JWT_SECRET,
                    { expiresIn: '6h' }
                );

                res.json({ success: true, user, token });
            } else {
                res.status(401).json({ success: false, message: 'Credenciales inválidas' });
            }
        } else {
            res.status(401).json({ success: false, message: 'Credenciales inválidas' });
        }
    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ success: false, message: 'Error del servidor' });
    }
});

// ============================================
// USUARIOS
// ============================================

app.get('/api/users', verifyToken, checkRole(['GOD', 'ADMIN']), async (req, res) => {
    try {
        let query = 'SELECT id, email, name, role, position, department, photo FROM users';
        let params = [];
        
        // Si no es GOD, ocultar a los usuarios GOD
        if (req.user.role !== 'GOD') {
            query += " WHERE role != 'GOD'";
        }
        
        query += ' ORDER BY id DESC';
        const [rows] = await pool.query(query, params);
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error GET /api/users:', error);
        res.status(500).json({ success: false, message: 'Error del servidor' });
    }
});

app.post('/api/users', verifyToken, checkRole(['GOD', 'ADMIN']), async (req, res) => {
    try {
        const { email, password, name, role, position, department } = req.body;
        
        // Encriptar password antes de guardar
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const [result] = await pool.query(
            'INSERT INTO users (email, password, name, role, position, department) VALUES (?, ?, ?, ?, ?, ?)',
            [email, hashedPassword, name, role, position, department]
        );
        res.json({ success: true, id: result.insertId });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error del servidor' });
    }
});

app.put('/api/users/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        let { email, name, role, position, department, password, photo } = req.body;
        
        if (password) password = password.trim();
        
        // Solo ADMIN/GOD pueden editar a otros. Los usuarios normales solo pueden editarse a sí mismos (vía /api/profile).
        if (req.user.role === 'USER' && req.user.id != id) {
            return res.status(403).json({ success: false, message: 'No tienes permiso para editar este perfil' });
        }

        if (password) {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);
            await pool.query(
                'UPDATE users SET email = ?, name = ?, role = ?, position = ?, department = ?, password = ?, photo = ? WHERE id = ?',
                [email, name, role, position, department, hashedPassword, photo || null, id]
            );
        } else {
            await pool.query(
                'UPDATE users SET email = ?, name = ?, role = ?, position = ?, department = ?, photo = ? WHERE id = ?',
                [email, name, role, position, department, photo || null, id]
            );
        }
        res.json({ success: true });
    } catch (error) {
        console.error('Error actualizando usuario:', error);
        res.status(500).json({ success: false, message: 'Error del servidor' });
    }
});

// NUEVO: Perfil Propio (Self-Update)
app.put('/api/profile', verifyToken, async (req, res) => {
    console.log('📬 Petición recibida en /api/profile');
    try {
        const userEmail = req.user.email;
        let { name, position, department, password, photo } = req.body;

        if (password) password = password.trim();

        if (photo) {
            console.log(`📸 Recibiendo foto para ${userEmail}. Tamaño: ${photo.length} bytes`);
        }

        if (password) {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);
            await pool.query(
                'UPDATE users SET name = ?, position = ?, department = ?, password = ?, photo = ? WHERE email = ?',
                [name, position, department, hashedPassword, photo || null, userEmail]
            );
        } else {
            await pool.query(
                'UPDATE users SET name = ?, position = ?, department = ?, photo = ? WHERE email = ?',
                [name, position, department, photo || null, userEmail]
            );
        }
        res.json({ success: true });
    } catch (error) {
        console.error('Error actualizando perfil:', error);
        res.status(500).json({ success: false, message: 'Error del servidor' });
    }
});

app.delete('/api/users/:id', verifyToken, checkRole(['GOD', 'ADMIN']), async (req, res) => {
    try {
        await pool.query('DELETE FROM users WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error del servidor' });
    }
});

// ============================================
// TAREAS
// ============================================

app.get('/api/tasks', verifyToken, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM tasks ORDER BY priority DESC, deadline ASC');

        // Enriquecer en bulk para evitar N+1 queries
        if (rows.length > 0) {
            const taskIds = rows.map(t => t.id);

            const [todoCounts] = await pool.query(
                `SELECT task_id, COUNT(*) as total, IFNULL(SUM(is_done),0) as done
                 FROM task_todos WHERE task_id IN (?) GROUP BY task_id`, [taskIds]
            );
            const [commentCounts] = await pool.query(
                `SELECT task_id, COUNT(*) as cnt FROM task_comments
                 WHERE task_id IN (?) GROUP BY task_id`, [taskIds]
            );
            const [allAssignees] = await pool.query(
                `SELECT ta.task_id, ta.user_name, ta.user_email, u.photo 
                 FROM task_assignees ta
                 LEFT JOIN users u ON u.email = ta.user_email
                 WHERE ta.task_id IN (?) ORDER BY ta.added_at ASC`, [taskIds]
            );

            const todoMap = {}; todoCounts.forEach(r => { todoMap[r.task_id] = r; });
            const commentMap = {}; commentCounts.forEach(r => { commentMap[r.task_id] = r; });
            const assigneeMap = {}; allAssignees.forEach(a => {
                if (!assigneeMap[a.task_id]) assigneeMap[a.task_id] = [];
                assigneeMap[a.task_id].push({ 
                    user_name: a.user_name, 
                    user_email: a.user_email,
                    photo: a.photo // Añadir la foto aquí para que aparezca en el tablero
                });
            });

            rows.forEach(task => {
                const tc = todoMap[task.id] || { total: 0, done: 0 };
                const cc = commentMap[task.id] || { cnt: 0 };
                task.todos_total    = parseInt(tc.total) || 0;
                task.todos_done     = parseInt(tc.done)  || 0;
                task.comments_count = parseInt(cc.cnt)   || 0;
                task.assignees      = assigneeMap[task.id] || [];
            });
        }

        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error obteniendo tareas:', error);
        res.status(500).json({ success: false, message: 'Error del servidor' });
    }
});

app.post('/api/tasks', verifyToken, async (req, res) => {
    try {
        const { 
            title = '', 
            description = '', 
            status = 'TODO', 
            assignee = '', 
            deadline = null, 
            priority = 'MEDIA'
        } = req.body;
        const formattedDate = formatMySQLDate(deadline);
        const progress = 0;
        const [result] = await pool.query(
            'INSERT INTO tasks (title, description, status, assignee, deadline, priority, progress) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [title, description, status, assignee, formattedDate, priority, progress]
        );
        
        // Importante: Registrar al responsable principal en la nueva tabla multi-assignee
        if (assignee) {
            const [uRows] = await pool.query('SELECT email FROM users WHERE name = ?', [assignee]);
            if (uRows.length) {
                await pool.query('INSERT IGNORE INTO task_assignees (task_id, user_name, user_email) VALUES (?, ?, ?)', 
                    [result.insertId, assignee, uRows[0].email]);
            }
        }
        
        // Notificación en segundo plano
        sendContextualEmails('CREATE', { id: result.insertId, title, assignee, status, progress }, author_email);

        res.json({ success: true, id: result.insertId });
    } catch (error) {
        console.error('❌ Error creando tarea:', error);
        res.status(500).json({ success: false, message: 'La ficha no se pudo guardar. Verifica la conexión.' });
    }
});

app.put('/api/tasks/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const {
            title = '', description = '', status = 'TODO',
            assignee = '', deadline = null, priority = 'MEDIA', progress = 0
        } = req.body;

        const formattedDate = formatMySQLDate(deadline);
        const finalProgress = calcProgress(status, progress);

        const [result] = await pool.query(
            'UPDATE tasks SET title = ?, description = ?, status = ?, assignee = ?, deadline = ?, priority = ?, progress = ? WHERE id = ?',
            [title, description, status, assignee, formattedDate, priority, finalProgress, id]
        );

        // Sincronizar responsable principal en la tabla multi-assignee
        if (assignee) {
            const [uRows] = await pool.query('SELECT email FROM users WHERE name = ?', [assignee]);
            if (uRows.length) {
                await pool.query('INSERT IGNORE INTO task_assignees (task_id, user_name, user_email) VALUES (?, ?, ?)', 
                    [id, assignee, uRows[0].email]);
            }
        }

        // Notificar usando lógica cruzada
        await sendContextualEmails('UPDATE', { id, title, assignee, status, progress: finalProgress }, req.user.email);

        console.log(`✅ Tarea ${id} actualizada → status: ${status}, progress: ${finalProgress}%`);
        res.json({ success: true, progress: finalProgress });
    } catch (error) {
        console.error('Error actualizando tarea:', error);
        res.status(500).json({ success: false, message: 'Error del servidor' });
    }
});

app.delete('/api/tasks/:id', verifyToken, async (req, res) => {
    try {
        await pool.query('DELETE FROM tasks WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error del servidor' });
    }
});

// ============================================
// ETAPAS (TODOS)
// ============================================

app.get('/api/tasks/:id/todos', verifyToken, async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT * FROM task_todos WHERE task_id = ? ORDER BY id ASC',
            [req.params.id]
        );
        res.json({ success: true, data: rows });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.post('/api/tasks/:id/todos', verifyToken, async (req, res) => {
    try {
        const { label, assigned_to } = req.body;
        const [result] = await pool.query(
            'INSERT INTO task_todos (task_id, label, assigned_to) VALUES (?, ?, ?)',
            [req.params.id, label, assigned_to || null]
        );

        // Notificar en segundo plano
        if (assigned_to) {
            const [uRows] = await pool.query('SELECT email FROM users WHERE name = ?', [assigned_to]);
            if (uRows.length) todoAssigneeEmail = uRows[0].email;
        }

        sendContextualEmails('TODO', { 
            id: req.params.id, 
            todo_label: label, 
            todo_assignee_email: todoAssigneeEmail 
        }, req.user.email);

        res.json({ success: true, id: result.insertId });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.put('/api/todos/:id', verifyToken, async (req, res) => {
    try {
        require('fs').appendFileSync('notify_debug2.log', `PUT /api/todos/${req.params.id}\n`);
        const { is_done, assigned_to } = req.body;
        
        // Obtener info antes de actualizar para la notificación
        const [todoRows] = await pool.query('SELECT t.title, td.label, td.task_id FROM task_todos td JOIN tasks t ON t.id = td.task_id WHERE td.id = ?', [req.params.id]);
        require('fs').appendFileSync('notify_debug2.log', `todoRows length: ${todoRows.length}, is_done: ${is_done}\n`);

        if (assigned_to !== undefined) {
            await pool.query(
                'UPDATE task_todos SET is_done = ?, assigned_to = ? WHERE id = ?',
                [is_done ? 1 : 0, assigned_to || null, req.params.id]
            );
        } else {
            await pool.query('UPDATE task_todos SET is_done = ? WHERE id = ?', [is_done ? 1 : 0, req.params.id]);
        }

        if (todoRows.length && is_done) {
            require('fs').appendFileSync('notify_debug2.log', `Calling sendContextualEmails TODO_COMPLETE\n`);
            await sendContextualEmails('TODO_COMPLETE', {
                id: todoRows[0].task_id,
                title: todoRows[0].title,
                label: todoRows[0].label
            }, req.user.email);
            require('fs').appendFileSync('notify_debug2.log', `Finished sendContextualEmails TODO_COMPLETE\n`);
        }

        res.json({ success: true });
    } catch (e) { 
        require('fs').appendFileSync('notify_debug2.log', `Error: ${e.message}\n`);
        res.status(500).json({ success: false }); 
    }
});

// ============================================
// RESPONSABLES (MULTI-ASSIGNEE)
// ============================================

app.get('/api/tasks/:id/assignees', verifyToken, async (req, res) => {
    try {
        let query = 'SELECT * FROM task_assignees WHERE task_id = ?';
        let params = [req.params.id];
        
        // Si el usuario no es GOD, no puede ver al responsable Omnisciente
        if (req.user.role !== 'GOD') {
            query += " AND user_name != 'Omnisciente'";
        }
        
        query += ' ORDER BY added_at ASC';
        const [rows] = await pool.query(query, params);
        res.json({ success: true, data: rows });
    } catch (e) { 
        console.error('Error GET /api/tasks/:id/assignees:', e);
        res.status(500).json({ success: false }); 
    }
});

app.post('/api/tasks/:id/assignees', verifyToken, async (req, res) => {
    try {
        const { user_name, user_email } = req.body;

        // Obtener título para el mensaje
        const [tRows] = await pool.query('SELECT title FROM tasks WHERE id = ?', [req.params.id]);
        const taskTitle = tRows.length ? tRows[0].title : 'una ficha';

        await pool.query(
            'INSERT IGNORE INTO task_assignees (task_id, user_name, user_email) VALUES (?, ?, ?)',
            [req.params.id, user_name, user_email || null]
        );

        // Notificar al nuevo responsable
        if (user_email) {
            broadcastPush(user_email, {
                title: 'Nueva Ficha Asignada 📋',
                body: `Te han asignado a la ficha: "${taskTitle}"`,
                link_id: req.params.id,
                type: 'TASK'
            });
        }

        res.json({ success: true });
    } catch (e) { 
        console.error('Error en asignación:', e);
        res.status(500).json({ success: false }); 
    }
});

app.delete('/api/tasks/:id/assignees/:email', verifyToken, async (req, res) => {
    try {
        await pool.query(
            'DELETE FROM task_assignees WHERE task_id = ? AND user_email = ?',
            [req.params.id, req.params.email]
        );
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.delete('/api/todos/:id', verifyToken, async (req, res) => {
    try {
        require('fs').appendFileSync('notify_debug2.log', `DELETE /api/todos/${req.params.id}\n`);
        const [todoRows] = await pool.query('SELECT t.title, td.label, td.task_id FROM task_todos td JOIN tasks t ON t.id = td.task_id WHERE td.id = ?', [req.params.id]);
        require('fs').appendFileSync('notify_debug2.log', `todoRows length: ${todoRows.length}\n`);

        await pool.query('DELETE FROM task_todos WHERE id = ?', [req.params.id]);

        if (todoRows.length) {
            require('fs').appendFileSync('notify_debug2.log', `Calling sendContextualEmails TODO_DELETE\n`);
            await sendContextualEmails('TODO_DELETE', {
                id: todoRows[0].task_id,
                title: todoRows[0].title,
                label: todoRows[0].label
            }, req.user.email);
            require('fs').appendFileSync('notify_debug2.log', `Finished sendContextualEmails TODO_DELETE\n`);
        }

        res.json({ success: true });
    } catch (e) { 
        require('fs').appendFileSync('notify_debug2.log', `Error in DELETE: ${e.message}\n`);
        res.status(500).json({ success: false }); 
    }
});

// ============================================
// RETROALIMENTACIÓN (COMMENTS)
// ============================================

app.get('/api/tasks/:id/comments', verifyToken, async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT * FROM task_comments WHERE task_id = ? ORDER BY created_at ASC',
            [req.params.id]
        );
        res.json({ success: true, data: rows });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.post('/api/tasks/:id/comments', verifyToken, async (req, res) => {
    try {
        const { author_name, author_role, content, author_email } = req.body;
        const [result] = await pool.query(
            'INSERT INTO task_comments (task_id, author_name, author_role, content) VALUES (?, ?, ?, ?)',
            [req.params.id, author_name, author_role, content]
        );
        
        // Notificar usando lógica cruzada
        await sendContextualEmails('COMMENT', { id: req.params.id }, req.user.email, { content });

        res.json({ success: true, id: result.insertId });
    } catch (e) { res.status(500).json({ success: false }); }
});

// ============================================
// LOGS
// ============================================

app.get('/api/logs', verifyToken, checkRole(['GOD']), async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM logs ORDER BY id DESC LIMIT 500');
        res.json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error del servidor' });
    }
});

app.post('/api/logs', verifyToken, async (req, res) => {
    try {
        const { user, email, role, action } = req.body;
        const [result] = await pool.query(
            'INSERT INTO logs (user_name, email, role, action) VALUES (?, ?, ?, ?)',
            [user, email, role, action]
        );
        res.json({ success: true, id: result.insertId });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error del servidor' });
    }
});

// ============================================
// SERVIDOR
// ============================================
// --- NOTIFICACIONES PUSH: Suscribirse (Frontend envía el objeto PushSubscription) ---
app.post('/api/notifications/subscribe', verifyToken, async (req, res) => {
    const { subscription } = req.body;
    if (!subscription) return res.status(400).json({ success: false, message: 'Suscripción requerida' });

    try {
        const subJson = JSON.stringify(subscription);
        // Insertar ignorando si ya existe la misma suscripción para ese usuario
        await pool.query('INSERT IGNORE INTO push_subscriptions (user_id, subscription_json) VALUES (?, ?)', [req.user.id, subJson]);
        res.json({ success: true, message: 'Dispositivo registrado para recibir notificaciones' });
    } catch (error) {
        console.error('Push Subscribe Error:', error);
        res.status(500).json({ success: false, message: 'Error interno al suscribir' });
    }
});

// --- CENTRO DE NOTIFICACIONES: Listar y Marcar como leído ---
app.get('/api/notifications', verifyToken, async (req, res) => {
    try {
        // --- INYECCIÓN DE PRUEBA (Solo la primera vez si no hay avisos de este tipo) ---
        const [testCheck] = await pool.query('SELECT id FROM notifications WHERE user_id = ? AND title LIKE "%🔧%"', [req.user.id]);
        if (testCheck.length === 0) {
            await pool.query(
                'INSERT INTO notifications (user_id, title, message, type) VALUES (?, "🔧 Sistema Reconectado", "Gib, la conexión de notificaciones ha sido restaurada. Ahora ya puedes recibir avisos de Eli y el equipo.", "SYSTEM")',
                [req.user.id]
            );
        }

        const [rows] = await pool.query(
            'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
            [req.user.id]
        );
        res.json({ success: true, notifications: rows });
    } catch (error) {
        console.error('Fetch Notifications Error:', error);
        res.status(500).json({ success: false, message: 'Error interno' });
    }
});

app.put('/api/notifications/mark-read', verifyToken, async (req, res) => {
    const { id } = req.body; // Si viene ID marca una, si no viene marca TODAS del usuario
    try {
        if (id) {
            await pool.query('UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?', [id, req.user.id]);
        } else {
            await pool.query('UPDATE notifications SET is_read = TRUE WHERE user_id = ?', [req.user.id]);
        }
        res.json({ success: true });
    } catch (error) {
        console.error('Mark Read Error:', error);
        res.status(500).json({ success: false, message: 'Error interno' });
    }
});

// ============================================
// PRE-FOLIO
// ============================================

const ELIZABETH_EMAIL = 'emartinezes@guanajuato.gob.mx';
const SITE_URL = 'https://intratur.guanajuato.site/dgiit';

// Helper: siguiente número de folio
async function nextFolioNumber(firstManual = null) {
    if (firstManual !== null) return firstManual;
    const [rows] = await pool.query(
        `SELECT folio_number FROM folios WHERE folio_number IS NOT NULL ORDER BY id DESC LIMIT 1`
    );
    if (!rows.length) return null; // Primer folio siempre manual
    const last = rows[0].folio_number; // SECTURI/DGIIT/XXX/2026
    const parts = last.split('/');
    const num = parseInt(parts[2] || '0', 10);
    const year = new Date().getFullYear();
    return `SECTURI/DGIIT/${String(num + 1).padStart(3, '0')}/${year}`;
}

// GET /api/folios — Listar folios
app.get('/api/folios', verifyToken, async (req, res) => {
    try {
        const { status, limit = 20, offset = 0 } = req.query;
        let query = `SELECT f.*, u.name AS assigned_by_name, u2.name AS cancelled_by_name
                     FROM folios f
                     LEFT JOIN users u ON u.id = f.assigned_by_id
                     LEFT JOIN users u2 ON u2.id = f.cancelled_by_id`;
        let params = [];
        let where = [];

        // Filtro de pertenencia (standard users solo ven lo suyo)
        if (req.user.role !== 'GOD' && req.user.role !== 'ADMIN') {
            where.push('f.solicitante_id = ?');
            params.push(req.user.id);
        }

        // Filtro de estado
        if (status && status !== 'TODOS') {
            where.push('f.status = ?');
            params.push(status);
        }

        if (where.length > 0) {
            query += ' WHERE ' + where.join(' AND ');
        }

        query += ' ORDER BY f.id DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const [rows] = await pool.query(query, params);
        res.json({ success: true, data: rows });
    } catch (e) {
        console.error('Error GET /api/folios:', e);
        res.status(500).json({ success: false, message: 'Error del servidor' });
    }
});

// GET /api/folios/search?q= — Búsqueda full-text
app.get('/api/folios/search', verifyToken, checkRole(['GOD', 'ADMIN']), async (req, res) => {
    try {
        const { q, limit = 20, offset = 0 } = req.query;
        const search = `%${q || ''}%`;
        
        const [rows] = await pool.query(
            `SELECT f.*, u.name AS assigned_by_name FROM folios f
             LEFT JOIN users u ON u.id = f.assigned_by_id
             WHERE f.folio_number LIKE ? OR f.asunto LIKE ? OR f.organismo LIKE ?
                OR f.dirigido_a LIKE ? OR f.solicitante_nombre LIKE ? OR f.pdf_text LIKE ?
             ORDER BY f.id DESC LIMIT ? OFFSET ?`,
            [search, search, search, search, search, search, parseInt(limit), parseInt(offset)]
        );
        res.json({ success: true, data: rows });
    } catch (e) {
        console.error('Error GET /api/folios/search:', e);
        res.status(500).json({ success: false, message: 'Error del servidor' });
    }
});

// POST /api/folios — Crear solicitud de pre-folio
app.post('/api/folios', verifyToken, async (req, res) => {
    try {
        const {
            dirigido_a, cargo_dest, organismo, asunto,
            quien_firma, area_resguardo, medio_envio
        } = req.body;

        const solicitante_id = req.user.id;
        const solicitante_nombre = req.user.email;

        // Obtener nombre real del usuario
        const [uRows] = await pool.query('SELECT name FROM users WHERE id = ?', [solicitante_id]);
        const nombre = uRows.length ? uRows[0].name : solicitante_nombre;

        const [result] = await pool.query(
            `INSERT INTO folios (dirigido_a, cargo_dest, organismo, asunto, quien_firma,
             solicitante_id, solicitante_nombre, area_resguardo, medio_envio)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [dirigido_a, cargo_dest, organismo, asunto, quien_firma,
             solicitante_id, nombre, area_resguardo, medio_envio]
        );

        const medioLabel = { 'PAM': 'PAM', 'FIRMA_AUTOGRAFA': 'Firma Autógrafa', 'PAM_Y_FIRMA': 'PAM y Firma Autógrafa', 'CORREO': 'Por Correo' };

        // Correo a Elizabeth
        sendEmail({
            to: ELIZABETH_EMAIL,
            subject: `Nueva Solicitud de Pre-Folio — ${nombre}`,
            title: '📋 Nueva Solicitud de Pre-Folio',
            message: `
                <p>El usuario <b>${nombre}</b> ha solicitado un número de folio.</p>
                <table style="width:100%;border-collapse:collapse;margin-top:16px;font-size:14px;">
                  <tr><td style="padding:8px;background:#f3f4f6;font-weight:bold;">Dirigido a:</td><td style="padding:8px;">${dirigido_a}</td></tr>
                  <tr><td style="padding:8px;background:#f3f4f6;font-weight:bold;">Cargo:</td><td style="padding:8px;">${cargo_dest}</td></tr>
                  <tr><td style="padding:8px;background:#f3f4f6;font-weight:bold;">Organismo / Dependencia:</td><td style="padding:8px;">${organismo}</td></tr>
                  <tr><td style="padding:8px;background:#f3f4f6;font-weight:bold;">Asunto:</td><td style="padding:8px;">${asunto}</td></tr>
                  <tr><td style="padding:8px;background:#f3f4f6;font-weight:bold;">Quien Firma:</td><td style="padding:8px;">${quien_firma}</td></tr>
                  <tr><td style="padding:8px;background:#f3f4f6;font-weight:bold;">Área de Resguardo:</td><td style="padding:8px;">${area_resguardo}</td></tr>
                  <tr><td style="padding:8px;background:#f3f4f6;font-weight:bold;">Medio de Envío:</td><td style="padding:8px;">${medioLabel[medio_envio] || medio_envio}</td></tr>
                </table>
                <p style="margin-top:16px;color:#6b7280;font-size:13px;">ID de solicitud: #${result.insertId} — Accede al sistema para asignar el folio.</p>
            `,
            actionLink: SITE_URL
        });

        // Recibo al solicitante
        sendEmail({
            to: req.user.email,
            subject: 'Recibo: Tu solicitud de pre-folio fue enviada',
            title: '✅ Solicitud Enviada',
            message: `Tu solicitud de folio para el asunto <b>${asunto}</b> ha sido enviada correctamente. Elizabeth la revisará y te notificará cuando se te asigne el número de folio.`,
            actionLink: SITE_URL
        });

        res.json({ success: true, id: result.insertId });
    } catch (e) {
        console.error('Error POST /api/folios:', e);
        res.status(500).json({ success: false, message: 'Error del servidor' });
    }
});

// PUT /api/folios/:id/assign — Elizabeth asigna número de folio
app.put('/api/folios/:id/assign', verifyToken, checkRole(['GOD', 'ADMIN']), async (req, res) => {
    try {
        const { id } = req.params;
        const { folio_number_manual } = req.body;

        const [existing] = await pool.query('SELECT * FROM folios WHERE id = ?', [id]);
        if (!existing.length) return res.status(404).json({ success: false, message: 'Folio no encontrado' });
        if (existing[0].status !== 'PENDIENTE') {
            return res.status(400).json({ success: false, message: 'Solo se pueden asignar folios en estado PENDIENTE' });
        }

        let folioNum = folio_number_manual ? folio_number_manual.trim() : await nextFolioNumber();
        if (!folioNum) return res.status(400).json({ success: false, message: 'Ingresa el número de folio manualmente (primer folio del sistema)' });

        // Verificar que no exista duplicado
        const [dup] = await pool.query('SELECT id FROM folios WHERE folio_number = ?', [folioNum]);
        if (dup.length) return res.status(400).json({ success: false, message: `El folio ${folioNum} ya existe en el sistema` });

        await pool.query(
            `UPDATE folios SET folio_number = ?, status = 'ASIGNADO', assigned_by_id = ?, assigned_at = NOW() WHERE id = ?`,
            [folioNum, req.user.id, id]
        );

        // Notificar al solicitante
        const folio = existing[0];
        const [uRows] = await pool.query('SELECT email FROM users WHERE id = ?', [folio.solicitante_id]);
        if (uRows.length) {
            sendEmail({
                to: uRows[0].email,
                subject: `Tu folio ha sido asignado: ${folioNum}`,
                title: '🎉 Folio Asignado',
                message: `Tu solicitud para el asunto <b>${folio.asunto}</b> ha recibido el número de folio oficial: <br/><h2 style="color:#1e3a8a;letter-spacing:1px;">${folioNum}</h2><p>Ahora debes cargar el PDF de evidencia de uso del folio en el sistema.</p>`,
                actionLink: SITE_URL
            });
            // Notificación Push & Historial
            broadcastPush(uRows[0].email, {
                title: 'Folio Asignado 📑',
                body: `Se ha asignado el folio ${folioNum} para: ${folio.asunto}`,
                type: 'FOLIO',
                data: { folioId: id }
            });
        }

        res.json({ success: true, folio_number: folioNum });
    } catch (e) {
        console.error('Error PUT /api/folios/:id/assign:', e);
        res.status(500).json({ success: false, message: 'Error del servidor' });
    }
});

// PUT /api/folios/:id/cancel — Cancelar folio
app.put('/api/folios/:id/cancel', verifyToken, checkRole(['GOD', 'ADMIN']), async (req, res) => {
    try {
        const { id } = req.params;
        const { cancel_reason = 'Cancelado por administrador' } = req.body;

        const [existing] = await pool.query('SELECT * FROM folios WHERE id = ?', [id]);
        if (!existing.length) return res.status(404).json({ success: false, message: 'Folio no encontrado' });
        if (existing[0].status === 'CANCELADO') {
            return res.status(400).json({ success: false, message: 'El folio ya está cancelado' });
        }

        await pool.query(
            `UPDATE folios SET status = 'CANCELADO', cancel_reason = ?, cancelled_by_id = ?, cancelled_at = NOW() WHERE id = ?`,
            [cancel_reason, req.user.id, id]
        );

        // Notificar al solicitante
        const folio = existing[0];
        const [uRows] = await pool.query('SELECT email FROM users WHERE id = ?', [folio.solicitante_id]);
        if (uRows.length) {
            sendEmail({
                to: uRows[0].email,
                subject: `Tu folio ha sido cancelado`,
                title: '❌ Folio Cancelado',
                message: `Tu solicitud de folio para el asunto <b>${folio.asunto}</b> ${folio.folio_number ? `(${folio.folio_number})` : ''} ha sido cancelada.<br/>Motivo: <i>${cancel_reason}</i>`,
                actionLink: SITE_URL
            });
            // Notificación Push & Historial
            broadcastPush(uRows[0].email, {
                title: 'Folio Cancelado ❌',
                body: `Su solicitud de folio ha sido cancelada.`,
                type: 'FOLIO',
                data: { folioId: id }
            });
        }

        res.json({ success: true });
    } catch (e) {
        console.error('Error PUT /api/folios/:id/cancel:', e);
        res.status(500).json({ success: false, message: 'Error del servidor' });
    }
});

// PUT /api/folios/:id/reopen — Reabrir folio cancelado (limpia y vuelve a PENDIENTE)
app.put('/api/folios/:id/reopen', verifyToken, checkRole(['GOD', 'ADMIN']), async (req, res) => {
    try {
        const { id } = req.params;
        const body = req.body; // Puede incluir campos actualizados del formulario

        const [existing] = await pool.query('SELECT * FROM folios WHERE id = ?', [id]);
        if (!existing.length) return res.status(404).json({ success: false, message: 'Folio no encontrado' });
        if (existing[0].status !== 'CANCELADO') {
            return res.status(400).json({ success: false, message: 'Solo se pueden reabrir folios cancelados' });
        }

        const fields = {
            dirigido_a:    body.dirigido_a    || existing[0].dirigido_a,
            cargo_dest:    body.cargo_dest    || existing[0].cargo_dest,
            organismo:     body.organismo     || existing[0].organismo,
            asunto:        body.asunto        || existing[0].asunto,
            quien_firma:   body.quien_firma   || existing[0].quien_firma,
            area_resguardo:body.area_resguardo|| existing[0].area_resguardo,
            medio_envio:   body.medio_envio   || existing[0].medio_envio,
            solicitante_id:body.solicitante_id|| existing[0].solicitante_id
        };

        // Si cambió el solicitante, buscar su nombre
        let nombre = existing[0].solicitante_nombre;
        if (body.solicitante_id && body.solicitante_id != existing[0].solicitante_id) {
            const [uRows] = await pool.query('SELECT name FROM users WHERE id = ?', [body.solicitante_id]);
            if (uRows.length) nombre = uRows[0].name;
        }

        await pool.query(
            `UPDATE folios SET status = 'PENDIENTE', folio_number = NULL,
             assigned_by_id = NULL, assigned_at = NULL,
             cancel_reason = NULL, cancelled_by_id = NULL, cancelled_at = NULL,
             pdf_filename = NULL, pdf_path = NULL, pdf_text = NULL, pdf_uploaded_at = NULL,
             dirigido_a = ?, cargo_dest = ?, organismo = ?, asunto = ?,
             quien_firma = ?, area_resguardo = ?, medio_envio = ?,
             solicitante_id = ?, solicitante_nombre = ?
             WHERE id = ?`,
            [fields.dirigido_a, fields.cargo_dest, fields.organismo, fields.asunto,
             fields.quien_firma, fields.area_resguardo, fields.medio_envio, 
             fields.solicitante_id, nombre, id]
        );

        res.json({ success: true });
    } catch (e) {
        console.error('Error PUT /api/folios/:id/reopen:', e);
        res.status(500).json({ success: false, message: 'Error del servidor' });
    }
});

// PUT /api/folios/:id/upload-pdf — Subir PDF de cierre/evidencia
app.put('/api/folios/:id/upload-pdf', verifyToken, (req, res, next) => {
    folioUpload.single('pdf')(req, res, (err) => {
        if (err) {
            return res.status(400).json({ success: false, message: err.message || 'Error al subir PDF' });
        }
        next();
    });
}, async (req, res) => {
    try {
        const { id } = req.params;
        if (!req.file) return res.status(400).json({ success: false, message: 'No se recibió ningún archivo PDF' });

        const [existing] = await pool.query('SELECT * FROM folios WHERE id = ?', [id]);
        if (!existing.length) return res.status(404).json({ success: false, message: 'Folio no encontrado' });

        // Verificar permisos: solo el solicitante o admin/god pueden subir
        if (req.user.role === 'USER' && existing[0].solicitante_id !== req.user.id) {
            fs.unlinkSync(req.file.path); // Borrar el archivo subido
            return res.status(403).json({ success: false, message: 'No tienes permiso para subir evidencia a este folio' });
        }
        if (existing[0].status !== 'ASIGNADO') {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ success: false, message: 'Solo puedes subir evidencia a folios en estado ASIGNADO' });
        }

        // Borrar PDF anterior si existe
        if (existing[0].pdf_path && fs.existsSync(existing[0].pdf_path)) {
            try { fs.unlinkSync(existing[0].pdf_path); } catch(e) {}
        }

        // Extraer texto del PDF para búsqueda
        let pdfText = '';
        try {
            const pdfParse = require('pdf-parse');
            const pdfBuffer = fs.readFileSync(req.file.path);
            const data = await pdfParse(pdfBuffer);
            pdfText = data.text ? data.text.substring(0, 50000) : '';
        } catch (e) {
            console.warn('⚠️ No se pudo extraer texto del PDF (sin capa OCR):', e.message);
        }

        await pool.query(
            `UPDATE folios SET status = 'CERRADO', pdf_filename = ?, pdf_path = ?,
             pdf_text = ?, pdf_uploaded_at = NOW() WHERE id = ?`,
            [req.file.filename, req.file.path, pdfText, id]
        );

        // Notificar a Elizabeth
        const folio = existing[0];
        sendEmail({
            to: ELIZABETH_EMAIL,
            subject: `PDF de evidencia cargado — ${folio.folio_number || 'Pre-Folio #' + id}`,
            title: '📄 Evidencia PDF Recibida',
            message: `El usuario <b>${folio.solicitante_nombre}</b> ha subido el PDF de evidencia para el folio <b>${folio.folio_number || '#' + id}</b>.<br/>Asunto: ${folio.asunto}`,
            actionLink: SITE_URL
        });

        res.json({ success: true, filename: req.file.filename });
    } catch (e) {
        console.error('Error PUT /api/folios/:id/upload-pdf:', e);
        res.status(500).json({ success: false, message: 'Error del servidor' });
    }
});

// GET /api/folios/:id/pdf — Servir el PDF (visualizador)
app.get('/api/folios/:id/pdf', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query('SELECT * FROM folios WHERE id = ?', [id]);
        if (!rows.length || !rows[0].pdf_path) {
            return res.status(404).json({ success: false, message: 'PDF no encontrado' });
        }

        const folio = rows[0];
        // Verificar permisos: USER solo ve su propio folio
        if (req.user.role === 'USER' && folio.solicitante_id !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Sin permiso' });
        }

        const filePath = folio.pdf_path;
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ success: false, message: 'Archivo no encontrado en disco' });
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${folio.pdf_filename}"`);
        fs.createReadStream(filePath).pipe(res);
    } catch (e) {
        console.error('Error GET /api/folios/:id/pdf:', e);
        res.status(500).json({ success: false, message: 'Error del servidor' });
    }
});

// Arrancar Servidor
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor DGIIT | SECTURI corriendo en http://localhost:${PORT}`);
});
