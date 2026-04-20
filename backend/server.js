/**
 * SGC PRO | Backend Server con Node.js y MySQL
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

app.use(express.json({ limit: '10mb' }));

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
        `ALTER TABLE users ADD COLUMN photo LONGTEXT DEFAULT NULL`
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
            if (authorEmail && authorEmail !== 'god@sgc.pro') {
                sendEmail({
                    to: authorEmail,
                    subject: 'Recibo: Has creado una nueva ficha',
                    title: 'Ficha Creada',
                    message: `Has creado exitosamente la ficha: <b>${taskTitle}</b> y la has asignado a ${assigneeName || 'Nadie'}.`,
                    actionLink: 'http://localhost:8080'
                });
            }
            // B) Al Asignado (si es distinto al creador): "Te asignaron"
            if (assigneeEmail && assigneeEmail !== authorEmail && assigneeEmail !== 'god@sgc.pro') {
                sendEmail({
                    to: assigneeEmail,
                    subject: 'Se te ha asignado un nuevo proyecto',
                    title: 'Nueva Asignación',
                    message: `<b>${authorName}</b> te ha asignado la ficha: <b>${taskTitle}</b>.`,
                    actionLink: 'http://localhost:8080'
                });
            }
            // C) A los ADMINS: "Fulano de tal hizo esto"
            const adminsToNotify = adminEmails.filter(e => e !== authorEmail);
            if (adminsToNotify.length > 0) {
                sendEmail({
                    to: adminsToNotify.join(', '),
                    subject: 'Notificación de Auditoría: Ficha Creada',
                    title: 'Auditoría: Nueva Ficha',
                    message: `El usuario <b>${authorName}</b> ha creado la ficha: <b>${taskTitle}</b> y la asignó a ${assigneeName}.`,
                    actionLink: 'http://localhost:8080'
                });
            }
        } 
        else if (eventType === 'UPDATE') {
            // A) Al usuario que hizo la modificación
            if (authorEmail && authorEmail !== 'god@sgc.pro') {
                sendEmail({
                    to: authorEmail,
                    subject: 'Recibo: Has modificado una ficha',
                    title: 'Cambios Guardados',
                    message: `Has modificado la ficha: <b>${taskTitle}</b>. Nuevo estado: ${taskData.status}. Progreso: ${taskData.progress}%.`,
                    actionLink: 'http://localhost:8080'
                });
            }
            // B) Al Asignado (si no fue quien la modificó)
            if (assigneeEmail && assigneeEmail !== authorEmail && assigneeEmail !== 'god@sgc.pro') {
                sendEmail({
                    to: assigneeEmail,
                    subject: 'Cambios en tu proyecto asignado',
                    title: 'Ficha Modificada',
                    message: `<b>${authorName}</b> ha modificado tu ficha <b>${taskTitle}</b>. Nuevo estado: ${taskData.status}. Progreso: ${taskData.progress}%.`,
                    actionLink: 'http://localhost:8080'
                });
            }
            // C) A los ADMINS
            const adminsToNotify = adminEmails.filter(e => e !== authorEmail);
            if (adminsToNotify.length > 0) {
                sendEmail({
                    to: adminsToNotify.join(', '),
                    subject: `Auditoría: Cambios en ${taskTitle}`,
                    title: 'Auditoría de Proyecto',
                    message: `El usuario <b>${authorName}</b> ha modificado la ficha <b>${taskTitle}</b>. Estado: ${taskData.status}. Progreso: ${taskData.progress}%.`,
                    actionLink: 'http://localhost:8080'
                });
            }
        }
        else if (eventType === 'COMMENT') {
            // A) Al usuario que comentó (Recibo)
            if (authorEmail && authorEmail !== 'god@sgc.pro') {
                sendEmail({
                    to: authorEmail,
                    subject: 'Recibo: Has publicado un comentario',
                    title: 'Nota Guardada',
                    message: `En la ficha <b>${taskTitle}</b>, escribiste: <br/>"<i>${commentData.content}</i>"`,
                    actionLink: 'http://localhost:8080'
                });
            }
            // B) Lógica cruzada para el Asignado y Admins
            if (authorRole === 'ADMIN') {
                // Si el autor es admin, el único que necesita ser notificado fuertemente es el Asignado (estándar)
                if (assigneeEmail && assigneeEmail !== authorEmail && assigneeEmail !== 'god@sgc.pro') {
                    sendEmail({
                        to: assigneeEmail,
                        subject: `El administrador ${authorName} te está avisando algo`,
                        title: 'Aviso del Administrador',
                        message: `En tu ficha <b>${taskTitle}</b>, el administrador <b>${authorName}</b> te comenta: <br/>"<i>${commentData.content}</i>"`,
                        actionLink: 'http://localhost:8080'
                    });
                }
            } else {
                // Si el autor es estándar, todos los admins se enteran, y el asignado (si no es el mismo autor) se entera
                const adminsToNotify = adminEmails.filter(e => e !== authorEmail);
                if (adminsToNotify.length > 0) {
                    sendEmail({
                        to: adminsToNotify.join(', '),
                        subject: `Auditoría: Comentario en ${taskTitle}`,
                        title: 'Auditoría de Comentarios',
                        message: `El usuario <b>${authorName}</b> ha comentado en <b>${taskTitle}</b>: <br/>"<i>${commentData.content}</i>"`,
                        actionLink: 'http://localhost:8080'
                    });
                }
                if (assigneeEmail && assigneeEmail !== authorEmail && assigneeEmail !== 'god@sgc.pro') {
                    sendEmail({
                        to: assigneeEmail,
                        subject: `Nuevo comentario en tu ficha`,
                        title: 'Nota en Proyecto',
                        message: `<b>${authorName}</b> ha comentado en <b>${taskTitle}</b>: <br/>"<i>${commentData.content}</i>"`,
                        actionLink: 'http://localhost:8080'
                    });
                }
            }
        }
    } catch (e) {
        console.error('Error en notificaciones contextuales:', e);
    }
}

// ============================================
// AUTH
// ============================================

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
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
            }

            // 2. Fallback: Comparar texto plano (migración)
            const isPlainTextMatch = (password === dbPassword);

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
        const { email, name, role, position, department, password, photo } = req.body;
        
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
        const { name, position, department, password, photo } = req.body;
        const userEmail = req.user.email;

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
        const { title, description, status = 'TODO', assignee, deadline, priority = 'MEDIA', author_email } = req.body;
        const formattedDate = formatMySQLDate(deadline);
        const progress = 0;
        const [result] = await pool.query(
            'INSERT INTO tasks (title, description, status, assignee, deadline, priority, progress) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [title, description, status, assignee, formattedDate, priority, progress]
        );
        
        // Notificar usando lógica cruzada
        sendContextualEmails('CREATE', { id: result.insertId, title, assignee, status, progress }, author_email);

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
            assignee = '', deadline = null, priority = 'MEDIA', progress = 0, author_email
        } = req.body;

        const formattedDate = formatMySQLDate(deadline);
        const finalProgress = calcProgress(status, progress);

        const [result] = await pool.query(
            'UPDATE tasks SET title = ?, description = ?, status = ?, assignee = ?, deadline = ?, priority = ?, progress = ? WHERE id = ?',
            [title, description, status, assignee, formattedDate, priority, finalProgress, id]
        );

        // Notificar usando lógica cruzada
        sendContextualEmails('UPDATE', { id, title, assignee, status, progress: finalProgress }, author_email);

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
        res.json({ success: true, id: result.insertId });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.put('/api/todos/:id', verifyToken, async (req, res) => {
    try {
        const { is_done, assigned_to } = req.body;
        if (assigned_to !== undefined) {
            await pool.query(
                'UPDATE task_todos SET is_done = ?, assigned_to = ? WHERE id = ?',
                [is_done ? 1 : 0, assigned_to || null, req.params.id]
            );
        } else {
            await pool.query('UPDATE task_todos SET is_done = ? WHERE id = ?', [is_done ? 1 : 0, req.params.id]);
        }
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
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
        await pool.query('DELETE FROM task_todos WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
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
        sendContextualEmails('COMMENT', { id: req.params.id }, author_email, { content });

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

app.listen(PORT, () => {
    console.log(`🚀 Servidor SGC PRO corriendo en http://localhost:${PORT}`);
});
