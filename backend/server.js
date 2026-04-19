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
const { sendEmail } = require('./utils/mailer');

const app = express();
const PORT = process.env.PORT || 3000;

// Manejo de errores globales
process.on('uncaughtException', (err) => { console.error('❌ EXCEPCIÓN NO CONTROLADA:', err); });
process.on('unhandledRejection', (reason) => { console.error('⚠️ RECHAZO NO CONTROLADO:', reason); });

app.use(helmet());
app.use(cors());
app.use(express.json());

// Limitación de peticiones para seguridad
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // Máximo 100 peticiones por ventana
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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    ];
    for (const sql of migrations) {
        try {
            await conn.query(sql);
        } catch (e) {
            if (e.code !== 'ER_DUP_FIELDNAME') console.warn('⚙️  Migración (omitida o ya aplicada):', e.message.substring(0, 60));
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
            'SELECT id, email, name, role, position, department, password FROM users WHERE email = ?',
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
                res.json({ success: true, user });
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

app.get('/api/users', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT id, email, name, role, position, department FROM users ORDER BY id DESC');
        res.json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error del servidor' });
    }
});

app.post('/api/users', async (req, res) => {
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

app.put('/api/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { email, name, role, position, department } = req.body;
        await pool.query(
            'UPDATE users SET email = ?, name = ?, role = ?, position = ?, department = ? WHERE id = ?',
            [email, name, role, position, department, id]
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error del servidor' });
    }
});

app.delete('/api/users/:id', async (req, res) => {
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

app.get('/api/tasks', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM tasks ORDER BY priority DESC, deadline ASC');
        // Enriquecer con conteos de etapas y comentarios
        for (const task of rows) {
            const [[todoCounts]] = await pool.query(
                'SELECT COUNT(*) as total, IFNULL(SUM(is_done), 0) as done FROM task_todos WHERE task_id = ?',
                [task.id]
            );
            const [[commentCounts]] = await pool.query(
                'SELECT COUNT(*) as cnt FROM task_comments WHERE task_id = ?',
                [task.id]
            );
            task.todos_total = parseInt(todoCounts.total) || 0;
            task.todos_done = parseInt(todoCounts.done) || 0;
            task.comments_count = parseInt(commentCounts.cnt) || 0;
        }
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error obteniendo tareas:', error);
        res.status(500).json({ success: false, message: 'Error del servidor' });
    }
});

app.post('/api/tasks', async (req, res) => {
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

app.put('/api/tasks/:id', async (req, res) => {
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

app.delete('/api/tasks/:id', async (req, res) => {
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

app.get('/api/tasks/:id/todos', async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT * FROM task_todos WHERE task_id = ? ORDER BY id ASC',
            [req.params.id]
        );
        res.json({ success: true, data: rows });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.post('/api/tasks/:id/todos', async (req, res) => {
    try {
        const { label } = req.body;
        const [result] = await pool.query(
            'INSERT INTO task_todos (task_id, label) VALUES (?, ?)',
            [req.params.id, label]
        );
        res.json({ success: true, id: result.insertId });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.put('/api/todos/:id', async (req, res) => {
    try {
        const { is_done } = req.body;
        await pool.query('UPDATE task_todos SET is_done = ? WHERE id = ?', [is_done ? 1 : 0, req.params.id]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.delete('/api/todos/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM task_todos WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
});

// ============================================
// RETROALIMENTACIÓN (COMMENTS)
// ============================================

app.get('/api/tasks/:id/comments', async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT * FROM task_comments WHERE task_id = ? ORDER BY created_at ASC',
            [req.params.id]
        );
        res.json({ success: true, data: rows });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.post('/api/tasks/:id/comments', async (req, res) => {
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

app.get('/api/logs', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM logs ORDER BY id DESC LIMIT 500');
        res.json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error del servidor' });
    }
});

app.post('/api/logs', async (req, res) => {
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
