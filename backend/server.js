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
const { sendEmail } = require('./utils/mailer');
const { sendPush } = require('./utils/push');
const multer = require('multer');
const pdfParse = require('pdf-parse');

const app = express();
const PORT = process.env.PORT || 3000;

// Manejo de errores globales
process.on('uncaughtException', (err) => { console.error('❌ EXCEPCIÓN NO CONTROLADA:', err); });
process.on('unhandledRejection', (reason) => { console.error('⚠️ RECHAZO NO CONTROLADO:', reason); });

const JWT_SECRET = process.env.JWT_SECRET || 'secret-key-fallback';

// Middleware: Verificar Token JWT
const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
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
        `ALTER TABLE tasks ADD COLUMN progress INT DEFAULT 0`,
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
        // ─── Módulo Pre-Folios ────────────────────────────────────────────
        `ALTER TABLE users ADD COLUMN access_type ENUM('TASKS','FOLIOS','BOTH') DEFAULT 'BOTH'`,
        `CREATE TABLE IF NOT EXISTS folios (
            id INT AUTO_INCREMENT PRIMARY KEY,
            folio_number VARCHAR(50) DEFAULT NULL,
            status ENUM('PENDING','APPROVED','CANCELLED') DEFAULT 'PENDING',
            directed_to VARCHAR(200) NOT NULL,
            position VARCHAR(200) NOT NULL,
            organism VARCHAR(200) NOT NULL,
            subject TEXT NOT NULL,
            signed_by_name VARCHAR(150) NOT NULL,
            signed_by_email VARCHAR(150) NOT NULL,
            requested_by_name VARCHAR(150) NOT NULL,
            requested_by_email VARCHAR(150) NOT NULL,
            area VARCHAR(200) NOT NULL,
            delivery_mode ENUM('PAM','FIRMA_AUTOGRAFA','PAM_Y_FIRMA','CORREO') NOT NULL DEFAULT 'CORREO',
            original_guard TINYINT(1) DEFAULT 0,
            evidence_pdf LONGBLOB DEFAULT NULL,
            evidence_pdf_name VARCHAR(255) DEFAULT NULL,
            evidence_ocr_text MEDIUMTEXT DEFAULT NULL,
            cancel_reason TEXT DEFAULT NULL,
            cancelled_by VARCHAR(150) DEFAULT NULL,
            cancelled_at TIMESTAMP NULL DEFAULT NULL,
            approved_by VARCHAR(150) DEFAULT NULL,
            approved_at TIMESTAMP NULL DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
        `CREATE TABLE IF NOT EXISTS folio_counter (
            id INT AUTO_INCREMENT PRIMARY KEY,
            last_number INT DEFAULT 0
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
        `INSERT IGNORE INTO folio_counter (id, last_number) VALUES (1, 0)`
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
        // 1. Obtener datos del Autor (quien realiza la acción)
        const [authorRows] = await pool.query('SELECT name, role FROM users WHERE email = ?', [authorEmail]);
        const authorName = authorRows.length ? authorRows[0].name : (authorEmail || 'Alguien');
        const authorRole = authorRows.length ? authorRows[0].role : 'USER';

        // 2. Obtener correos de los Administradores
        const [adminRows] = await pool.query('SELECT email FROM users WHERE role = "ADMIN"');
        const adminEmails = adminRows.map(u => u.email);

        // 3. Obtener el correo del Asignado a la tarea actual
        let assigneeEmail = null;
        let taskTitle = taskData.title || `Ficha #${taskData.id}`;
        let assigneeName = taskData.assignee;

        if (eventType === 'COMMENT') {
            const [taskRows] = await pool.query('SELECT title, assignee FROM tasks WHERE id = ?', [taskData.id]);
            if (taskRows.length) {
                taskTitle = taskRows[0].title;
                assigneeName = taskRows[0].assignee;
            }
        }

        if (assigneeName) {
            const [asgRows] = await pool.query('SELECT email FROM users WHERE name = ?', [assigneeName]);
            if (asgRows.length) assigneeEmail = asgRows[0].email;
        }

        // ==========================================
        // LÓGICA DE DISTRIBUCIÓN Y MENSAJES
        // ==========================================
        
        if (eventType === 'CREATE') {
            // A) Al usuario creador: "Inf que hizo"
            if (authorEmail) {
                await sendEmail({
                    to: authorEmail,
                    subject: 'Recibo: Has creado una nueva ficha',
                    title: 'Ficha Creada',
                    message: `Has creado exitosamente la ficha: <b>${taskTitle}</b> y la has asignado a ${assigneeName || 'Nadie'}.`,
                    actionLink: 'http://localhost:3030'
                });
                await saveAppNotification(authorEmail, 'Ficha Creada', `Creaste la ficha: ${taskTitle}`, taskData.id);
            }
            // B) Al Asignado (si es distinto al creador): "Te asignaron"
            if (assigneeEmail && assigneeEmail !== authorEmail && assigneeEmail !== 'god@sgc.pro') {
                sendEmail({
                    to: assigneeEmail,
                    subject: 'Se te ha asignado un nuevo proyecto',
                    title: 'Nueva Asignación',
                    message: `<b>${authorName}</b> te ha asignado la ficha: <b>${taskTitle}</b>.`,
                    actionLink: 'http://localhost:3030'
                });
                await broadcastPush(assigneeEmail, {
                    title: '🚀 Nueva Asignación',
                    body: `${authorName} te asignó la ficha: ${taskTitle}`,
                    data: { taskId: taskData.id }
                });
                await saveAppNotification(assigneeEmail, 'Nueva Asignación', `${authorName} te ha asignado la ficha: ${taskTitle}`, taskData.id);
            }
            // C) A los ADMINS: "Fulano de tal hizo esto"
            const adminsToNotify = adminEmails.filter(e => e !== authorEmail);
            if (adminsToNotify.length > 0) {
                await sendEmail({
                    to: adminsToNotify.join(', '),
                    subject: 'Notificación de Auditoría: Ficha Creada',
                    title: 'Auditoría: Nueva Ficha',
                    message: `El usuario <b>${authorName}</b> ha creado la ficha: <b>${taskTitle}</b> y la asignó a ${assigneeName}.`,
                    actionLink: 'http://localhost:3030'
                });
                for (const admin of adminsToNotify) {
                    await saveAppNotification(admin, 'Auditoría: Nueva Ficha', `${authorName} creó la ficha: ${taskTitle}`, taskData.id);
                }
            }
        } 
        else if (eventType === 'UPDATE') {
            // A) Al usuario que hizo la modificación
            if (authorEmail) {
                await sendEmail({
                    to: authorEmail,
                    subject: 'Recibo: Has modificado una ficha',
                    title: 'Cambios Guardados',
                    message: `Has modificado la ficha: <b>${taskTitle}</b>. Nuevo estado: ${taskData.status}. Progreso: ${taskData.progress}%.`,
                    actionLink: 'http://localhost:3030'
                });
                await saveAppNotification(authorEmail, 'Cambios Guardados', `Modificaste la ficha: ${taskTitle} (${taskData.progress}%)`, taskData.id);
            }
            // B) Al Asignado (si no fue quien la modificó)
            if (assigneeEmail && assigneeEmail !== authorEmail && assigneeEmail !== 'god@sgc.pro') {
                await sendEmail({
                    to: assigneeEmail,
                    subject: 'Cambios en tu proyecto asignado',
                    title: 'Ficha Modificada',
                    message: `<b>${authorName}</b> ha modificado tu ficha <b>${taskTitle}</b>. Nuevo estado: ${taskData.status}. Progreso: ${taskData.progress}%.`,
                    actionLink: 'http://localhost:3030'
                });
                await broadcastPush(assigneeEmail, {
                    title: '📝 Ficha Actualizada',
                    body: `${authorName} modificó tu ficha: ${taskTitle}`,
                    data: { taskId: taskData.id }
                });
                await saveAppNotification(assigneeEmail, 'Ficha Modificada', `${authorName} modificó tu ficha: ${taskTitle} (${taskData.progress}%)`, taskData.id);
            }
            // C) A los ADMINS
            const adminsToNotify = adminEmails.filter(e => e !== authorEmail);
            if (adminsToNotify.length > 0) {
                await sendEmail({
                    to: adminsToNotify.join(', '),
                    subject: `Auditoría: Cambios en ${taskTitle}`,
                    title: 'Auditoría de Proyecto',
                    message: `El usuario <b>${authorName}</b> ha modificado la ficha <b>${taskTitle}</b>. Estado: ${taskData.status}. Progreso: ${taskData.progress}%.`,
                    actionLink: 'http://localhost:3030'
                });
                for (const admin of adminsToNotify) {
                    await saveAppNotification(admin, 'Auditoría de Proyecto', `${authorName} modificó la ficha: ${taskTitle} (${taskData.progress}%)`, taskData.id);
                }
            }
        }
        else if (eventType === 'COMMENT') {
            // Notificar a TODOS: Admins, Autor y Responsables de la ficha
            const [asgRows] = await pool.query('SELECT user_email FROM task_assignees WHERE task_id = ?', [taskData.id]);
            const assigneeEmails = asgRows.map(r => r.user_email).filter(e => e); // Evitar nulls
            
            const allRecipients = new Set([...adminEmails, ...assigneeEmails]);
            if (authorEmail) allRecipients.add(authorEmail);

            const validRecipients = Array.from(allRecipients).filter(e => e && e.trim() !== '');

            if (validRecipients.length > 0) {
                await sendEmail({
                    to: validRecipients.join(', '),
                    subject: `Nuevo comentario en: ${taskTitle}`,
                    title: 'Nota en Proyecto',
                    message: `El usuario <b>${authorName}</b> ha comentado en la ficha <b>${taskTitle}</b>: <br/><br/>"<i>${commentData.content}</i>"`,
                    actionLink: 'http://localhost:3030'
                });

                // Enviar push a todos excepto al autor
                for (const email of validRecipients) {
                    await saveAppNotification(email, 'Nuevo Comentario', `${authorName} comentó en ${taskTitle}`, taskData.id);
                    if (email !== authorEmail && email !== 'god@sgc.pro') {
                        await broadcastPush(email, {
                            title: '💬 Nuevo Comentario',
                            body: `${authorName}: ${commentData.content}`,
                            data: { taskId: taskData.id }
                        });
                    }
                }
            }
        }
        else if (eventType === 'ADD_ASSIGNEE') {
            const addedUserEmail = taskData.added_user_email;
            const addedUserName = taskData.added_user_name;

            if (addedUserEmail && addedUserEmail !== authorEmail && addedUserEmail !== 'god@sgc.pro') {
                await sendEmail({
                    to: addedUserEmail,
                    subject: 'Te han asignado a un nuevo proyecto',
                    title: 'Nueva Asignación',
                    message: `Hola <b>${addedUserName}</b>, el usuario <b>${authorName}</b> te ha agregado como responsable en la ficha: <b>${taskData.title}</b>.`,
                    actionLink: 'http://localhost:3030'
                });
                await broadcastPush(addedUserEmail, {
                    title: '🚀 Nueva Asignación',
                    body: `${authorName} te agregó a la ficha: ${taskData.title}`,
                    data: { taskId: taskData.id }
                });
                await saveAppNotification(addedUserEmail, 'Nueva Asignación', `${authorName} te agregó a la ficha: ${taskData.title}`, taskData.id);
            }
        }
        else if (eventType === 'TODO_CREATE') {
            if (taskData.assigned_to_name) {
                const [asgRows] = await pool.query('SELECT email FROM users WHERE name = ?', [taskData.assigned_to_name]);
                if (asgRows.length) {
                    const todoUserEmail = asgRows[0].email;
                    if (todoUserEmail && todoUserEmail !== 'god@sgc.pro') {
                        await sendEmail({
                            to: todoUserEmail,
                            subject: 'Nueva etapa asignada',
                            title: 'Nueva Etapa',
                            message: `Hola, se ha añadido la etapa: <b>${taskData.label}</b> en la ficha <b>${taskData.title}</b> y se te ha asignado como responsable.`,
                            actionLink: 'http://localhost:3030'
                        });
                        await broadcastPush(todoUserEmail, {
                            title: '📝 Nueva Etapa',
                            body: `Se te asignó: ${taskData.label} en ${taskData.title}`,
                            data: { taskId: taskData.id }
                        });
                        await saveAppNotification(todoUserEmail, 'Nueva Etapa', `Se te asignó la etapa: ${taskData.label}`, taskData.id);
                    }
                }
            }
        }
        else if (eventType === 'TODO_COMPLETE' || eventType === 'TODO_DELETE') {
            // Notificar a TODOS: Admins, Autor y Responsables de la ficha
            const [asgRows] = await pool.query('SELECT user_email FROM task_assignees WHERE task_id = ?', [taskData.id]);
            const assigneeEmails = asgRows.map(r => r.user_email).filter(e => e); // Evitar nulls
            
            const allRecipients = new Set([...adminEmails, ...assigneeEmails]);
            if (authorEmail) allRecipients.add(authorEmail);

            // Filtrar cualquier valor nulo o vacío por si acaso
            const validRecipients = Array.from(allRecipients).filter(e => e && e.trim() !== '');

            const subject = eventType === 'TODO_COMPLETE' ? `Etapa terminada: ${taskData.label}` : `Etapa eliminada: ${taskData.label}`;
            const title = eventType === 'TODO_COMPLETE' ? 'Etapa Completada' : 'Etapa Eliminada';
            const action = eventType === 'TODO_COMPLETE' ? 'marcado como terminada' : 'eliminado';
            
            if (validRecipients.length > 0) {
                await sendEmail({
                    to: validRecipients.join(', '),
                    subject: subject,
                    title: title,
                    message: `El usuario <b>${authorName}</b> ha ${action} la etapa: <b>${taskData.label}</b> de la ficha <b>${taskData.title}</b>.`,
                    actionLink: 'http://localhost:3030'
                });
                for (const email of validRecipients) {
                    await saveAppNotification(email, title, `${authorName} ha ${action} la etapa: ${taskData.label}`, taskData.id);
                }
            }
        }
    } catch (e) {
        console.error('Error en notificaciones contextuales:', e);
    }
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
        const [uRows] = await pool.query('SELECT id FROM users WHERE email = ?', [userEmail]);
        if (!uRows.length) return;
        const userId = uRows[0].id;

        const [subs] = await pool.query('SELECT id, subscription_json FROM push_subscriptions WHERE user_id = ?', [userId]);
        for (const s of subs) {
            const subscription = JSON.parse(s.subscription_json);
            const res = await sendPush(subscription, payload);
            if (res.expired) {
                await pool.query('DELETE FROM push_subscriptions WHERE id = ?', [s.id]);
            }
        }
    } catch (e) {
        console.error('Error en broadcastPush:', e);
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
        const [rows] = await pool.query('SELECT id, email, name, role, position, department, photo FROM users ORDER BY id DESC');
        res.json({ success: true, data: rows });
    } catch (error) {
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
        
        // Notificar usando lógica cruzada
        await sendContextualEmails('CREATE', { id: result.insertId, title, assignee, status, progress }, req.user.email);

        res.json({ success: true, id: result.insertId });
    } catch (error) {
        console.error('Error creando tarea:', error);
        res.status(500).json({ success: false, message: 'Error del servidor' });
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

        // Notificar usando lógica cruzada
        await sendContextualEmails('UPDATE', { id, title, assignee, status, progress: finalProgress }, req.user.email);

        console.log(`✅ Tarea ${id} actualizada → status: ${status}, progress: ${finalProgress}%`);
        res.json({ success: true, progress: finalProgress });
    } catch (error) {
        console.error('Error actualizando tarea:', error);
        res.status(500).json({ success: false, message: 'Error del servidor' });
    }
});

app.delete('/api/tasks/:id', verifyToken, checkRole(['GOD', 'ADMIN']), async (req, res) => {
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

        // Notificar al asignado de la etapa
        const [taskRows] = await pool.query('SELECT title FROM tasks WHERE id = ?', [req.params.id]);
        if (taskRows.length && assigned_to) {
            await sendContextualEmails('TODO_CREATE', {
                id: req.params.id,
                title: taskRows[0].title,
                label: label,
                assigned_to_name: assigned_to
            }, req.user.email);
        }

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
        const [rows] = await pool.query(
            'SELECT * FROM task_assignees WHERE task_id = ? ORDER BY added_at ASC',
            [req.params.id]
        );
        res.json({ success: true, data: rows });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.post('/api/tasks/:id/assignees', verifyToken, async (req, res) => {
    try {
        const { user_name, user_email } = req.body;
        await pool.query(
            'INSERT IGNORE INTO task_assignees (task_id, user_name, user_email) VALUES (?, ?, ?)',
            [req.params.id, user_name, user_email || null]
        );

        // Notificar al nuevo responsable
        const [taskRows] = await pool.query('SELECT title FROM tasks WHERE id = ?', [req.params.id]);
        if (taskRows.length && user_email) {
            sendContextualEmails('ADD_ASSIGNEE', { 
                id: req.params.id, 
                title: taskRows[0].title,
                added_user_name: user_name,
                added_user_email: user_email
            }, req.user.email);
        }

        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
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

// --- IN-APP NOTIFICATIONS (La Campanita) ---
app.get('/api/notifications', verifyToken, async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT * FROM app_notifications WHERE user_email = ? ORDER BY created_at DESC LIMIT 50',
            [req.user.email]
        );
        res.json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error obteniendo notificaciones' });
    }
});

app.put('/api/notifications/:id/read', verifyToken, async (req, res) => {
    try {
        await pool.query('UPDATE app_notifications SET is_read = 1 WHERE id = ? AND user_email = ?', [req.params.id, req.user.email]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

app.put('/api/notifications/read-all', verifyToken, async (req, res) => {
    try {
        await pool.query('UPDATE app_notifications SET is_read = 1 WHERE user_email = ?', [req.user.email]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

// ============================================
// PRE-FOLIOS
// ============================================

const ELIZABETH_EMAIL = 'emartinezes@guanajuato.gob.mx';

// GET: Listar todos los folios (admins/god ven todos; usuarios solo los suyos)
app.get('/api/folios', verifyToken, async (req, res) => {
    try {
        let rows;
        if (req.user.role === 'GOD' || req.user.email === ELIZABETH_EMAIL || req.user.role === 'ADMIN') {
            [rows] = await pool.query('SELECT * FROM folios ORDER BY created_at DESC');
        } else {
            [rows] = await pool.query('SELECT * FROM folios WHERE requested_by_email = ? ORDER BY created_at DESC', [req.user.email]);
        }
        // No devolver el blob del PDF en el listado (demasiado pesado)
        rows.forEach(r => { delete r.evidence_pdf; });
        res.json({ success: true, data: rows });
    } catch (e) { console.error(e); res.status(500).json({ success: false, message: 'Error del servidor' }); }
});

// POST: Crear nueva petición de folio
app.post('/api/folios', verifyToken, async (req, res) => {
    try {
        const {
            directed_to, position, organism, subject,
            signed_by_name, signed_by_email,
            requested_by_name, requested_by_email,
            area, delivery_mode, original_guard
        } = req.body;

        const [result] = await pool.query(
            `INSERT INTO folios 
             (directed_to, position, organism, subject, signed_by_name, signed_by_email,
              requested_by_name, requested_by_email, area, delivery_mode, original_guard, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
            [directed_to, position, organism, subject, signed_by_name, signed_by_email,
             requested_by_name, requested_by_email, area, delivery_mode, original_guard ? 1 : 0]
        );

        // Notificar a Elizabeth
        await sendEmail({
            to: ELIZABETH_EMAIL,
            subject: `Nueva Petición de Pre-Folio de ${requested_by_name}`,
            title: 'Nueva Petición de Pre-Folio',
            message: `El usuario <b>${requested_by_name}</b> (${requested_by_email}) ha solicitado un pre-folio.<br><br>
                      <b>Dirigido a:</b> ${directed_to}<br>
                      <b>Cargo:</b> ${position}<br>
                      <b>Organismo:</b> ${organism}<br>
                      <b>Asunto:</b> ${subject}<br>
                      <b>Área:</b> ${area}<br>
                      <b>Modo de envío:</b> ${delivery_mode}<br>
                      <b>Resguardo Original:</b> ${original_guard ? 'Sí' : 'No'}<br><br>
                      Por favor ingresa al sistema para aprobarlo o cancelarlo.`,
            actionLink: 'http://localhost:3030'
        });

        res.json({ success: true, id: result.insertId });
    } catch (e) { console.error(e); res.status(500).json({ success: false, message: 'Error del servidor' }); }
});

// PUT: Aprobar folio y asignar número (solo Elizabeth)
app.put('/api/folios/:id/approve', verifyToken, async (req, res) => {
    try {
        if (req.user.email !== ELIZABETH_EMAIL) {
            return res.status(403).json({ success: false, message: 'Solo Elizabeth puede aprobar folios' });
        }

        // Incrementar contador y generar número de folio
        await pool.query('UPDATE folio_counter SET last_number = last_number + 1 WHERE id = 1');
        const [[counter]] = await pool.query('SELECT last_number FROM folio_counter WHERE id = 1');
        const year = new Date().getFullYear();
        const folioNum = String(counter.last_number).padStart(3, '0');
        const folioNumber = `SECTURI/DGIIT/${folioNum}/${year}`;

        await pool.query(
            `UPDATE folios SET status = 'APPROVED', folio_number = ?, approved_by = ?, approved_at = NOW() WHERE id = ?`,
            [folioNumber, req.user.email, req.params.id]
        );

        // Notificar al solicitante
        const [[folio]] = await pool.query('SELECT * FROM folios WHERE id = ?', [req.params.id]);
        if (folio && folio.requested_by_email) {
            await sendEmail({
                to: folio.requested_by_email,
                subject: `✅ Tu Pre-Folio ha sido Aprobado: ${folioNumber}`,
                title: 'Pre-Folio Aprobado',
                message: `Hola <b>${folio.requested_by_name}</b>,<br><br>
                          Tu petición de pre-folio ha sido aprobada.<br><br>
                          <b>Número de Folio Asignado:</b> <span style="font-size:1.2em;font-weight:bold;color:#0078d4;">${folioNumber}</span><br><br>
                          <b>Asunto:</b> ${folio.subject}<br>
                          <b>Dirigido a:</b> ${folio.directed_to}<br><br>
                          Por favor ingresa al sistema para subir tu evidencia de uso.`,
                actionLink: 'http://localhost:3030'
            });
        }

        res.json({ success: true, folio_number: folioNumber });
    } catch (e) { console.error(e); res.status(500).json({ success: false, message: 'Error del servidor' }); }
});

// PUT: Cancelar folio (solo Elizabeth)
app.put('/api/folios/:id/cancel', verifyToken, async (req, res) => {
    try {
        if (req.user.email !== ELIZABETH_EMAIL) {
            return res.status(403).json({ success: false, message: 'Solo Elizabeth puede cancelar folios' });
        }

        const { cancel_reason } = req.body;
        if (!cancel_reason || !cancel_reason.trim()) {
            return res.status(400).json({ success: false, message: 'El motivo de cancelación es obligatorio' });
        }

        await pool.query(
            `UPDATE folios SET status = 'CANCELLED', cancel_reason = ?, cancelled_by = ?, cancelled_at = NOW() WHERE id = ?`,
            [cancel_reason.trim(), req.user.email, req.params.id]
        );

        // Notificar al solicitante
        const [[folio]] = await pool.query('SELECT * FROM folios WHERE id = ?', [req.params.id]);
        if (folio && folio.requested_by_email) {
            await sendEmail({
                to: folio.requested_by_email,
                subject: `❌ Tu Pre-Folio ha sido Cancelado`,
                title: 'Pre-Folio Cancelado',
                message: `Hola <b>${folio.requested_by_name}</b>,<br><br>
                          Tu petición de pre-folio para el asunto <b>${folio.subject}</b> ha sido cancelada.<br><br>
                          <b>Motivo:</b> ${cancel_reason}<br><br>
                          Si tienes dudas, contacta a Elizabeth Martínez.`,
                actionLink: 'http://localhost:3030'
            });
        }

        res.json({ success: true });
    } catch (e) { console.error(e); res.status(500).json({ success: false, message: 'Error del servidor' }); }
});

// PUT: Reasignar folio cancelado (darle nueva vida — solo Elizabeth)
app.put('/api/folios/:id/reassign', verifyToken, async (req, res) => {
    try {
        if (req.user.email !== ELIZABETH_EMAIL) {
            return res.status(403).json({ success: false, message: 'Solo Elizabeth puede reasignar folios' });
        }

        const {
            directed_to, position, organism, subject,
            signed_by_name, signed_by_email,
            requested_by_name, requested_by_email,
            area, delivery_mode, original_guard
        } = req.body;

        await pool.query(
            `UPDATE folios SET 
             status = 'PENDING', folio_number = NULL,
             directed_to = ?, position = ?, organism = ?, subject = ?,
             signed_by_name = ?, signed_by_email = ?,
             requested_by_name = ?, requested_by_email = ?,
             area = ?, delivery_mode = ?, original_guard = ?,
             cancel_reason = NULL, cancelled_by = NULL, cancelled_at = NULL,
             evidence_pdf = NULL, evidence_pdf_name = NULL, evidence_ocr_text = NULL
             WHERE id = ?`,
            [directed_to, position, organism, subject, signed_by_name, signed_by_email,
             requested_by_name, requested_by_email, area, delivery_mode, original_guard ? 1 : 0,
             req.params.id]
        );

        // Notificar al nuevo asignado
        await sendEmail({
            to: requested_by_email,
            subject: `📋 Se te ha reasignado un Pre-Folio`,
            title: 'Pre-Folio Reasignado',
            message: `Hola <b>${requested_by_name}</b>,<br><br>
                      Se te ha reasignado una petición de pre-folio.<br><br>
                      <b>Asunto:</b> ${subject}<br>
                      <b>Dirigido a:</b> ${directed_to}<br><br>
                      Por favor ingresa al sistema para ver el detalle.`,
            actionLink: 'http://localhost:3030'
        });

        res.json({ success: true });
    } catch (e) { console.error(e); res.status(500).json({ success: false, message: 'Error del servidor' }); }
});

// POST: Subir evidencia PDF con OCR
app.post('/api/folios/:id/evidence', verifyToken, uploadPDF.single('evidence'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: 'No se recibió archivo PDF' });

        // Verificar que el folio existe y está aprobado
        const [[folio]] = await pool.query('SELECT * FROM folios WHERE id = ?', [req.params.id]);
        if (!folio) return res.status(404).json({ success: false, message: 'Folio no encontrado' });
        if (folio.status !== 'APPROVED') return res.status(400).json({ success: false, message: 'Solo se puede subir evidencia a folios aprobados' });

        // Extraer texto via OCR (pdf-parse)
        let ocrText = '';
        try {
            const pdfData = await pdfParse(req.file.buffer);
            ocrText = pdfData.text || '';
        } catch (parseErr) {
            console.warn('⚠️ OCR falló (PDF puede ser imagen sin texto):', parseErr.message);
            ocrText = '[PDF sin texto extraíble]';
        }

        await pool.query(
            'UPDATE folios SET evidence_pdf = ?, evidence_pdf_name = ?, evidence_ocr_text = ? WHERE id = ?',
            [req.file.buffer, req.file.originalname, ocrText, req.params.id]
        );

        res.json({ success: true, chars_extracted: ocrText.length });
    } catch (e) { console.error(e); res.status(500).json({ success: false, message: 'Error del servidor' }); }
});

// GET: Descargar PDF de evidencia (acepta token por header O por query param para abrir en nueva pestaña)
app.get('/api/folios/:id/evidence', async (req, res) => {
    try {
        // Aceptar token vía query param como fallback (para abrir en nueva pestaña)
        const authHeader = req.headers['authorization'];
        const token = (authHeader && authHeader.split(' ')[1]) || req.query.token;
        if (!token) return res.status(401).json({ success: false, message: 'No autorizado' });

        let decoded;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
        } catch (e) {
            return res.status(401).json({ success: false, message: 'Token inválido' });
        }

        const [[folio]] = await pool.query('SELECT evidence_pdf, evidence_pdf_name FROM folios WHERE id = ?', [req.params.id]);
        if (!folio || !folio.evidence_pdf) return res.status(404).json({ success: false, message: 'No hay evidencia' });
        res.set('Content-Type', 'application/pdf');
        res.set('Content-Disposition', `inline; filename="${folio.evidence_pdf_name || 'evidencia.pdf'}"`);
        res.send(folio.evidence_pdf);
    } catch (e) { res.status(500).json({ success: false, message: 'Error del servidor' }); }
});

// GET: Buscar folios por texto OCR
app.get('/api/folios/search', verifyToken, async (req, res) => {
    try {
        const { q } = req.query;
        if (!q) return res.json({ success: true, data: [] });
        let rows;
        const like = `%${q}%`;
        if (req.user.role === 'GOD' || req.user.email === ELIZABETH_EMAIL || req.user.role === 'ADMIN') {
            [rows] = await pool.query(
                `SELECT id, folio_number, status, directed_to, subject, requested_by_name, created_at
                 FROM folios WHERE evidence_ocr_text LIKE ? OR subject LIKE ? OR directed_to LIKE ? OR folio_number LIKE ?
                 ORDER BY created_at DESC`,
                [like, like, like, like]
            );
        } else {
            [rows] = await pool.query(
                `SELECT id, folio_number, status, directed_to, subject, requested_by_name, created_at
                 FROM folios WHERE requested_by_email = ? AND (evidence_ocr_text LIKE ? OR subject LIKE ? OR directed_to LIKE ?)
                 ORDER BY created_at DESC`,
                [req.user.email, like, like, like]
            );
        }
        res.json({ success: true, data: rows });
    } catch (e) { res.status(500).json({ success: false, message: 'Error del servidor' }); }
});

// Arrancar Servidor
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor DGIIT | SECTURI corriendo en http://localhost:${PORT}`);
});
