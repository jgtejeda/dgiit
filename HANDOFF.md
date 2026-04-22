# HANDOFF — Plan de Acción
> DGIIT | SECTURI | Hyper-Glass Task Manager
> Creado: 2026-04-21 | Estado: PENDIENTE

---

## REGLA DE ORO: AUDITORÍA PRIMERO, CÓDIGO DESPUÉS
Este documento registra TODAS las acciones a tomar, en orden de prioridad.
Cada agente o sesión de trabajo debe:
1. Leer este archivo antes de tocar cualquier código.
2. Marcar el ítem como `[x] HECHO` al terminar.
3. Agregar notas de lo que encontró o decidió.

---

## FASE 1 — CORRECCIONES CRÍTICAS (El sistema no funciona sin estas)
> ✅ Sesión 1 completada: 2026-04-21

### [P1-A] Corregir `renderBoard()` en `app-db.js`
**Archivo:** [frontend/js/app-db.js](frontend/js/app-db.js) — líneas 360–427
**Problema:** La función `.forEach(task => { ... })` cierra prematuramente en la línea 379.
Todo el código de construcción de tarjetas (deadlineDate, card.innerHTML, etc.) quedó
FUERA del callback del forEach. El tablero nunca renderiza fichas.
**Acción:** Integrar todo el bloque de construcción de tarjetas DENTRO del forEach,
antes del `});` de cierre. La estructura correcta debe ser:
```js
tasksCache.filter(t => t.status !== 'ARCHIVED').forEach(task => {
    // filtros
    // let deadlineDate = ...
    // const card = document.createElement(...)
    // card.innerHTML = `...`
    // stacks[task.status].appendChild(card)
});
// Update counts
```
**Impacto:** BLOQUEANTE — sin esta corrección el tablero principal no muestra datos.

---

### [P1-B] Corregir `author_email` en `POST /api/tasks`
**Archivo:** [backend/server.js](backend/server.js) — línea 680
**Problema:** Variable `author_email` no declarada.
**Acción:**
```js
// CAMBIAR:
sendContextualEmails('CREATE', { id: result.insertId, title, assignee, status, progress }, author_email);
// POR:
sendContextualEmails('CREATE', { id: result.insertId, title, assignee, status, progress }, req.user.email);
```
**Impacto:** La ruta POST /api/tasks falla al intentar notificar. La ficha se crea pero las notificaciones no se envían.

---

### [P1-C] Corregir `todoAssigneeEmail` en `POST /api/tasks/:id/todos`
**Archivo:** [backend/server.js](backend/server.js) — líneas 757–768
**Problema:** `todoAssigneeEmail` usada sin declarar.
**Acción:**
```js
// CAMBIAR el bloque completo a:
let todoAssigneeEmail = null;
if (assigned_to) {
    const [uRows] = await pool.query('SELECT email FROM users WHERE name = ?', [assigned_to]);
    if (uRows.length) todoAssigneeEmail = uRows[0].email;
}
sendContextualEmails('TODO', {
    id: req.params.id,
    todo_label: label,
    todo_assignee_email: todoAssigneeEmail
}, req.user.email);
```
**Impacto:** Puede causar errores silenciosos al crear etapas con responsable asignado.

---

### [P1-D] Reconstruir `folios.js` para que sea compatible con el backend actual
**Archivo:** [frontend/js/folios.js](frontend/js/folios.js)
**Problema:** El módulo frontend usa un esquema de datos y endpoints completamente diferentes
al backend real. Nada funciona: listar, crear, aprobar, subir PDF, ver PDF, cancelar.
**Acción:** Reescribir `folios.js` usando:
- Los nombres de campo del backend (`asunto`, `dirigido_a`, `cargo_dest`, `organismo`, `area_resguardo`, `medio_envio`, `pdf_filename`)
- Los status correctos (`PENDIENTE`, `ASIGNADO`, `CERRADO`, `CANCELADO`)
- Los endpoints correctos:
  - Listar: `GET /api/folios`
  - Crear: `POST /api/folios`
  - Asignar folio: `PUT /api/folios/:id/assign` (con `folio_number_manual`)
  - Cancelar: `PUT /api/folios/:id/cancel` (con `cancel_reason`)
  - Reabrir: `PUT /api/folios/:id/reopen`
  - Subir PDF: `PUT /api/folios/:id/upload-pdf` (multipart/form-data, campo `pdf`)
  - Ver PDF: `GET /api/folios/:id/pdf`
  - Buscar: `GET /api/folios/search?q=...`
- Los modales ya en `index.html`: `modal-assign-folio`, `modal-upload-pdf`, `modal-cancel-folio`, `modal-reopen-folio`
**Nota:** El HTML de `index.html` ya tiene los modales para el workflow correcto del backend.
El problema es SOLO el JavaScript en `folios.js`.
**Impacto:** BLOQUEANTE — el módulo de folios es completamente inoperable.

---

## FASE 2 — CORRECCIONES DE SEGURIDAD

### [P2-A] Proteger DELETE /api/tasks/:id con checkRole
**Archivo:** [backend/server.js](backend/server.js) — línea 725
**Problema:** Cualquier usuario autenticado (incluso USER) puede borrar fichas permanentemente.
**Acción:**
```js
// CAMBIAR:
app.delete('/api/tasks/:id', verifyToken, async (req, res) => {
// POR:
app.delete('/api/tasks/:id', verifyToken, checkRole(['GOD', 'ADMIN']), async (req, res) => {
```

---

### [P2-B] Eliminar logs de debug del código de producción
**Archivos afectados:**
- [backend/server.js](backend/server.js) — líneas 443, 449 (`require('fs').appendFileSync('login_debug.log', ...)`)
- [backend/server.js](backend/server.js) — múltiples líneas con `require('fs').appendFileSync('notify_debug2.log', ...)`
**Acción:** Eliminar todas las líneas que escriben a `login_debug.log`, `notify_debug.log`, `notify_debug2.log`.
Los archivos `.log` en el disco también deben eliminarse o añadirse a `.gitignore`.
**Nota:** Si se necesita debug, usar `console.error()` que va a los logs de Docker.

---

### [P2-C] Eliminar inyección de notificación hardcodeada
**Archivo:** [backend/server.js](backend/server.js) — líneas 973–979 en `GET /api/notifications`
**Problema:** Código de prueba que inserta una notificación hardcodeada con "Gib" en el mensaje,
para todos los usuarios que nunca hayan recibido una con "🔧".
**Acción:** Eliminar el bloque completo:
```js
// ELIMINAR ESTE BLOQUE:
const [testCheck] = await pool.query('SELECT id FROM notifications WHERE user_id = ? AND title LIKE "%🔧%"', [req.user.id]);
if (testCheck.length === 0) {
    await pool.query(
        'INSERT INTO notifications (user_id, title, message, type) VALUES (?, "🔧 Sistema Reconectado", "Gib, la conexión...", "SYSTEM")',
        [req.user.id]
    );
}
```

---

### [P2-D] Corregir JWT_SECRET fallback inseguro
**Archivo:** [backend/server.js](backend/server.js) — línea 55
**Problema:** `const JWT_SECRET = process.env.JWT_SECRET || 'secret-key-fallback';`
Si el .env no carga correctamente, todos los tokens se firman con la clave pública conocida.
**Acción:**
```js
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('❌ FATAL: JWT_SECRET no configurado en .env. Abortando.');
    process.exit(1);
}
```

---

## FASE 3 — LIMPIEZA Y CONSISTENCIA

### [P3-A] Eliminar `saveAppNotification()` de server.js
**Archivo:** [backend/server.js](backend/server.js) — líneas 362–372
**Problema:** Función dead code que referencia tabla `app_notifications` que no existe.
**Acción:** Eliminar la función completa.

---

### [P3-B] Corregir `package.json` — multer duplicado
**Archivo:** [backend/package.json](backend/package.json)
**Problema:** `"multer": "^2.1.1"` y `"multer": "^1.4.5-lts.1"` ambos presentes.
**Acción:** Eliminar la línea `"multer": "^2.1.1",` (la primera, la versión mayor).
Quedar con: `"multer": "^1.4.5-lts.1"`.
Luego ejecutar `npm install` para limpiar `package-lock.json`.

---

### [P3-C] Corregir eventos `TODO_COMPLETE` y `TODO_DELETE` en `sendContextualEmails`
**Archivo:** [backend/server.js](backend/server.js) — función `sendContextualEmails`
**Problema:** Los eventos 'TODO_COMPLETE' y 'TODO_DELETE' no tienen case en el switch,
generando `msgPayload.title` y `msgPayload.body` undefined.
**Acción:** Agregar los casos:
```js
} else if (eventType === 'TODO_COMPLETE') {
    msgPayload.title = '✅ Etapa Completada';
    msgPayload.body = `${authorName} marcó como completada: "${taskData.label}" en "${taskData.title}"`;
} else if (eventType === 'TODO_DELETE') {
    msgPayload.title = '🗑️ Etapa Eliminada';
    msgPayload.body = `${authorName} eliminó la etapa: "${taskData.label}" de "${taskData.title}"`;
}
```

---

### [P3-D] Resolver conflicto de notificaciones entre `notifications.js` y `notifications-center.js`
**Archivos:** [frontend/js/notifications.js](frontend/js/notifications.js) y [frontend/js/notifications-center.js](frontend/js/notifications-center.js)
**Problema:** `notifications.js` usa localStorage con datos mock. `notifications-center.js` usa el
backend real. Ambos manipulan `notif-list` y `notif-badge`, se sobreescriben entre sí.
**Acción:** Eliminar la función `loadNotifications()` y `markAllAsRead()` de `notifications.js`,
así como el `defaultNotifications` mock. El módulo `notifications.js` debe quedar SOLO con:
- `urlBase64ToUint8Array()`
- `initPushNotificationUI()`
- `subscribeUser()` / `unsubscribeUser()` / `handlePushButtonClick()`
El centro de notificaciones real es responsabilidad de `notifications-center.js`.

---

### [P3-E] Corregir filtros del tablero en `app-db.js`
**Archivo:** [frontend/js/app-db.js](frontend/js/app-db.js) — líneas 361–378
**Problema:** El bloque de filtros tiene indentación inconsistente — el filtro de usuario está
dentro del `if(false)` desactivado, pero los filtros de mes y prioridad están fuera.
**Acción:** Una vez corregido el BUG-003 (forEach), decidir:
- Opción A: Reactivar todos los filtros (quitar el `&& false`)
- Opción B: Desactivar TODOS correctamente envolviéndolos en el `if(false)` o eliminándolos
- La UX actual muestra controles de filtro al usuario pero no funcionan → confuso

---

### [P3-F] Mover valores hardcodeados a variables de entorno/config
**Archivo:** [backend/server.js](backend/server.js)
**Valores hardcodeados a externalizar:**
- `ELIZABETH_EMAIL = 'emartinezes@guanajuato.gob.mx'` → usar `process.env.ADMIN_EMAIL`
- `SITE_URL = 'https://intratur.guanajuato.site/dgiit'` → agregar `SITE_URL` al .env
**Acción:**
```js
const ELIZABETH_EMAIL = process.env.ADMIN_EMAIL || 'emartinezes@guanajuato.gob.mx';
const SITE_URL = process.env.SITE_URL || 'https://intratur.guanajuato.gob.mx/dgiit/';
```
Y agregar a `.env.example`:
```env
ADMIN_EMAIL=emartinezes@guanajuato.gob.mx
SITE_URL=https://intratur.guanajuato.gob.mx/dgiit/
```

---

## FASE 4 — MEJORAS DOCUMENTADAS (No urgentes)

### [P4-A] Actualizar README.md
**Archivo:** [README.md](README.md)
**Problema:** Describe la estructura antigua del proyecto (archivos en la raíz, no en /backend y /frontend).
Menciona "contraseñas en texto plano" cuando ya hay bcrypt.
**Acción:** Actualizar la estructura de archivos y la sección de seguridad.

---

### [P4-B] ⏳ PENDIENTE — Decidir el destino de la columna `access_type` en `users`
**Estado:** Requiere decisión de negocio antes de tocar código.
**Archivo afectado:** [backend/server.js](backend/server.js) — migración línea ~220, `verifyToken` línea ~64

#### Contexto
La migración `runMigrations()` agrega la columna `access_type` a la tabla `users`:
```sql
ALTER TABLE users ADD COLUMN access_type ENUM('FOLIOS','FICHAS','AMBOS') DEFAULT 'AMBOS'
```
El campo se incluye en el JWT al hacer login (línea ~455):
```js
{ id, name, email, role, access_type }
```
Y por tanto está disponible en `req.user.access_type` en todas las rutas protegidas.

**Sin embargo, ninguna ruta valida este campo.** Un usuario con `access_type = 'FOLIOS'`
puede igualmente listar fichas (`GET /api/tasks`), crear tareas, etc. La columna existe
en el esquema y en el token, pero no tiene ningún efecto real en el sistema.

#### Las dos opciones posibles

**Opción A — Implementar el control de acceso (recomendada si hay usuarios con acceso parcial):**
Agregar un middleware `checkAccessType` y aplicarlo a las rutas principales:
```js
function checkAccessType(type) {
    return (req, res, next) => {
        // GOD y ADMIN siempre pasan
        if (req.user.role === 'GOD' || req.user.role === 'ADMIN') return next();
        if (req.user.access_type === 'AMBOS' || req.user.access_type === type) return next();
        return res.status(403).json({ success: false, message: 'Sin acceso a este módulo' });
    };
}

// Aplicar en:
app.get('/api/tasks', verifyToken, checkAccessType('FICHAS'), ...)
app.post('/api/tasks', verifyToken, checkAccessType('FICHAS'), ...)
app.get('/api/folios', verifyToken, checkAccessType('FOLIOS'), ...)
app.post('/api/folios', verifyToken, checkAccessType('FOLIOS'), ...)
```
También habría que exponer un endpoint para que GOD/ADMIN puedan cambiar el `access_type`
de un usuario (o incluirlo en el formulario de edición de usuario en el frontend).

**Opción B — Eliminar la columna (si todos los usuarios deben tener acceso completo):**
```sql
ALTER TABLE users DROP COLUMN access_type;
```
Y retirar `access_type` del SELECT en el login y del payload del JWT.
La migración también debe actualizarse para no intentar agregar la columna.

#### Impacto en frontend
Si se elige Opción A, el frontend (`app-db.js`) debería:
- Ocultar el tab de "Folios" en el menú de navegación si `currentUser.access_type === 'FICHAS'`
- Ocultar el tab de "Tablero" si `currentUser.access_type === 'FOLIOS'`
- Actualmente el frontend no hace esta validación — muestra ambas secciones siempre.

---

### [P4-C] Limpiar archivos de debug del repositorio
**Archivos:**
- [backend/login_debug.log](backend/login_debug.log) → Eliminar
- [backend/notify_debug.log](backend/notify_debug.log) → Eliminar
- [backend/notify_debug2.log](backend/notify_debug2.log) → Eliminar
- [backend/debug_db.js](backend/debug_db.js) → Evaluar si conservar o eliminar
**Acción:** Agregar al `.gitignore`: `*.log`, `debug_db.js`

---

### [P4-D] Implementar `ensureSuperUser` en .env.example con password seguro
**Archivo:** [backend/.env.example](backend/.env.example) — línea 30
**Problema:** `SUPERUSER_PASS=god123` en el archivo de ejemplo.
**Acción:** Cambiar a `SUPERUSER_PASS=CAMBIAR_A_PASSWORD_SEGURO` para evitar que nadie
use la contraseña de ejemplo en producción.

---

### [P4-E] Evaluar archivar `app.js`
**Archivo:** [frontend/js/app.js](frontend/js/app.js)
**Estado:** No está cargado en `index.html`. Es código legacy completo con localStorage.
**Acción:** Mover a una carpeta `_legacy/` o eliminar tras confirmar que ninguna lógica
es necesaria. No borrar sin revisión.

---

### [P2-E] NUEVO 🔴 CRÍTICO — JWT_SECRET faltante en .env real
**Detectado durante:** Sesión 1 (P3-F)
**Archivo:** [backend/.env](backend/.env) — línea inexistente
**Problema:** El `.env` real NO tiene `JWT_SECRET`. El servidor cae al fallback
`'secret-key-fallback'`, que es una clave pública conocida. Cualquiera que sepa esto
puede forjar tokens JWT válidos y acceder como cualquier usuario.
**Acción inmediata:** Generar y agregar JWT_SECRET al .env:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```
Luego agregar al .env: `JWT_SECRET=<resultado>`
**Estado:** PENDIENTE — el usuario debe generar el secret y reiniciar el contenedor.

---

### [P3-G] NUEVO — Conflicto semántico en ADMIN_EMAIL vs email de Elizabeth
**Detectado durante:** Sesión 1 (P3-F)
**Archivo:** [backend/.env](backend/.env) y [backend/server.js](backend/server.js)
**Problema:** La variable `ADMIN_EMAIL` del `.env` está configurada como `jgtejeda@guanajuato.gob.mx` (Gibrann),
pero en el código se renombró `ELIZABETH_EMAIL` a `process.env.ADMIN_EMAIL` para externalizar el
email de la coordinadora de folios (Elizabeth). Esto hace que los correos de folios lleguen a Gibrann
en lugar de a Elizabeth.
**Además:** La misma variable `EMAIL_USER` en nodemailer puede ser una cuenta diferente.
**Acción requerida:** Decidir la variable correcta. Opciones:
- **Opción A (recomendada):** Crear `FOLIO_COORDINATOR_EMAIL=emartinezes@guanajuato.gob.mx` en .env
  y usarla en lugar de `ADMIN_EMAIL` para el flujo de folios.
- **Opción B:** Actualizar `ADMIN_EMAIL` en .env a Elizabeth.
**Estado:** PENDIENTE de decisión del usuario.

---

## REGISTRO DE DECISIONES Y NOTAS

> Usar esta sección para registrar decisiones importantes tomadas durante el desarrollo.
> Formato: `[FECHA] [AUTOR] — Decisión o hallazgo`

- [2026-04-21] [Auditoría inicial] — El tablero Kanban está completamente roto (BUG-003). La razón por la que los usuarios no ven fichas no es la DB sino el código JS del frontend.
- [2026-04-21] [Auditoría inicial] — El módulo de Folios tiene dos implementaciones paralelas incompatibles. El HTML de index.html corresponde al backend real, pero folios.js es una versión anterior.
- [2026-04-21] [Auditoría inicial] — El login FUNCIONA correctamente (confirmado por login_debug.log — todos los intentos muestran `isMatch=true`). El problema no está en la autenticación sino en el renderizado post-login.
- [2026-04-21] [Auditoría inicial] — `app.js` (el archivo legacy) NO está cargado. La app usa `app-db.js` + `api-client.js` + `notifications-center.js`. No hay conflicto de dos versiones cargadas simultáneamente.
- [2026-04-21] [Sesión 1] — Descubierto: `JWT_SECRET` faltante en `.env` real → el servidor usa fallback `'secret-key-fallback'`. Registrado como P2-E. El usuario debe generar y agregar el secret.
- [2026-04-21] [Sesión 1] — Descubierto: `ADMIN_EMAIL` en .env apunta a Gibrann, no a Elizabeth. Renombrado a `FOLIO_COORDINATOR_EMAIL` en el código y en `.env.example`. Registrado como P3-G. Pendiente confirmar si Elizabeth debe tener su propia variable.
- [2026-04-21] [Sesión 1] — Completados: BUG-001, BUG-002, P2-A, P2-B, P2-C, P3-A, P3-C, P3-F. Solo cambios en `backend/server.js`, `backend/.env`, `backend/.env.example`.
- [2026-04-21] [P2-E] — JWT_SECRET generado (128 hex chars) y agregado al `.env` real. El fallback inseguro sigue en server.js línea 55 pero ya no se activa porque el .env lo provee.
- [2026-04-21] [P3-G] — Decisión del usuario: coordinadora de folios no debe ser variable de entorno sino un usuario ADMIN en la DB. Solución: `ELIZABETH_EMAIL` eliminada, reemplazada por helper `getAdminEmails()` que consulta `users WHERE role='ADMIN'`. Todos los admins reciben las notificaciones de folios dinámicamente. `FOLIO_COORDINATOR_EMAIL` nunca llegó a usarse en producción — eliminada de .env y .env.example.
- [2026-04-21] [Sesión 2] — Completados: BUG-003 (renderBoard forEach), P3-E (filtros del tablero reactivados), P3-D (notifications.js limpio — eliminados mock data, loadNotifications, markAllAsRead). Solo cambios en `frontend/js/app-db.js` y `frontend/js/notifications.js`.
- [2026-04-21] [Sesión 3] — Completado: BUG-004 (folios.js reescrito completo). Todos los field names, status values y endpoints alineados con el backend. `ELIZABETH_EMAIL_FE` eliminada del frontend, permisos basados en rol ADMIN/GOD. Añadida pestaña "Cerrados" en HTML. Función `prefillReassign` renombrada a `prefillReopen`. Upload endpoint: `PUT /folios/:id/upload-pdf` con campo `pdf`. PDF viewer: `GET /folios/:id/pdf`. Assign con prompt para número manual.
- [2026-04-21] [Sesión 4] — Completados: P3-B (multer duplicado eliminado en package.json), P2-D (JWT_SECRET fallback → process.exit(1)), P4-C (login_debug.log, notify_debug.log, notify_debug2.log y debug_db.js eliminados — el último contenía contraseña hardcodeada), P4-D (SUPERUSER_PASS en .env.example → placeholder seguro), P4-E (app.js movido a frontend/js/_legacy/). Hints menores de server.js también resueltos: pdfParse top-level removido (se usa inline), uploadPDF multer de memoria eliminado (nunca se usó), result desechado en UPDATE tasks, author_email eliminado del destructuring en ruta de comentarios.
- [2026-04-22] [Sesión 5] — Implementado control de acceso con access_type (Opción A). Agregado middleware checkAccessType() en backend/server.js, actualizadas rutas /api/tasks y /api/folios, incluido access_type en respuesta de login y JWT, actualizado frontend para ocultar pestañas según access_type. Base de datos actualizada: todos los usuarios con access_type = 'AMBOS'.

---

## ORDEN DE ATAQUE RECOMENDADO

```
Sesión 1 (Backend):
  1. BUG-001 → Corregir author_email en POST /api/tasks
  2. BUG-002 → Corregir todoAssigneeEmail en POST /api/tasks/:id/todos
  3. P2-A → Proteger DELETE /api/tasks/:id con checkRole
  4. P2-C → Eliminar inyección de notificación hardcodeada
  5. P3-C → Agregar casos TODO_COMPLETE y TODO_DELETE en sendContextualEmails
  6. P2-B → Eliminar todos los appendFileSync de debug
  7. P3-A → Eliminar saveAppNotification()
  8. P3-F → Mover hardcoded values a variables de entorno

Sesión 2 (Frontend — Tablero):
  1. BUG-003 → Reconstruir renderBoard() con forEach correcto (PRIORIDAD MÁXIMA)
  2. P3-E → Decidir y corregir estado de filtros del tablero
  3. P3-D → Resolver conflicto entre notifications.js y notifications-center.js

Sesión 3 (Frontend — Folios):
  1. BUG-004 → Reescribir folios.js completo para ser compatible con backend actual
     (mapear campos, status values, endpoints)

Sesión 4 (Limpieza y Docs):
  1. P3-B → Corregir package.json multer duplicado
  2. P2-D → Corregir JWT_SECRET fallback
  3. P4-A → Actualizar README.md
  4. P4-C → Limpiar archivos de debug del repo
  5. P4-D → Corregir contraseña de ejemplo en .env.example
  6. P4-E → Archivar o eliminar app.js
```

---

*Última actualización: 2026-04-22 — Implementación de control de acceso con access_type (Opción A)*
