/**
 * DGIIT | SECTURI | Master Logic Engine con Base de Datos
 * Role-Based Access Control, Activity Tracking, Progress, Todos, Comments
 */

// --- 1. CONSTANTS ---

let usersCache = [];
let tasksCache = [];
let logsCache = [];
let currentUser = JSON.parse(localStorage.getItem('sgc_user')) || null;
let currentTaskId = null;
let currentTaskAssignees = []; // Cache de responsables del modal activo

// --- ESTADO DE FILTRADO (Buscadores independientes) ---
let currentFilters = {
    TODO:     { user: '', month: '', priority: '' },
    PROGRESS: { user: '', month: '', priority: '' },
    DONE:     { user: '', month: '', priority: '' },
    ARCHIVE:  { user: '', month: '', priority: '' }
};

function handleFilterChange(column, type, value) {
    currentFilters[column][type] = value;
    if (column === 'ARCHIVE') {
        renderArchive();
    } else {
        renderBoard();
    }
}

// --- 0. SEGURIDAD (ANTI-XSS) ---
function sanitizeHTML(str) {
    if (!str) return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;', '/': '&#x2F;' };
    return str.replace(/[&<>"'/]/g, s => map[s]);
}

// --- 2. API CLIENT —BASE ---

// --- 2. API WRAPPERS (DEPRECATED: Usamos apiClient) ---

async function apiLogin(email, password) { return await apiClient.login(email, password); }

async function apiGetUsers() {
    const d = await apiClient.getUsers();
    if (d.success) usersCache = d.data;
    return d;
}

async function apiGetTasks() {
    const d = await apiClient.getTasks();
    if (d.success) tasksCache = d.data;
    return d;
}

async function apiGetLogs() {
    const d = await apiClient.getLogs();
    if (d.success) logsCache = d.data;
    return d;
}

async function apiSaveLog(action) {
    if (!currentUser) return { success: false };
    return await apiClient.saveLog({ user: currentUser.name, email: currentUser.email, role: currentUser.role, action });
}

async function apiCreateTask(taskData) { return await apiClient.createTask(taskData); }
async function apiUpdateTask(id, taskData) { return await apiClient.updateTask(id, taskData); }
async function apiDeleteTask(id) { return await apiClient.deleteTask(id); }

// --- 3. TODOS API ---
async function apiGetTodos(taskId) { return await apiClient.getTodos(taskId); }
async function apiCreateTodo(taskId, label, assignedTo = null) { 
    return await apiClient.createTodo(taskId, label, assignedTo, currentUser?.email); 
}
async function apiToggleTodo(todoId, isDone, assignedTo = undefined) { 
    return await apiClient.toggleTodo(todoId, isDone, assignedTo, currentUser?.email); 
}
async function apiDeleteTodo(todoId) { 
    return await apiClient.deleteTodo(todoId, currentUser?.email); 
}

// --- 4. COMMENTS API ---
async function apiGetComments(taskId) { return await apiClient.getComments(taskId); }
async function apiCreateComment(taskId, content) {
    return await apiClient.createComment(taskId, content, {
        author_name: currentUser.name,
        author_email: currentUser.email,
        author_role: currentUser.role
    });
}

// --- 4b. RESPONSABLES API ---
async function apiGetAssignees(taskId) { return await apiClient.getAssignees(taskId); }
async function apiAddAssignee(taskId, data) { return await apiClient.addAssignee(taskId, data); }
async function apiRemoveAssignee(taskId, email) { return await apiClient.removeAssignee(taskId, email); }

// --- 5. UTILITIES ---

function refreshIcons() { if (window.lucide) window.lucide.createIcons(); }

function getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getProgressColor(pct) {
    if (pct === 0) return 'rgba(255,255,255,0.2)';
    if (pct === 100) return '#00e676';
    if (pct >= 70) return '#ffcc00';
    return 'var(--corp-light)';
}

// --- 6. UI CONTROLLER ---

function switchView(viewId) {
    document.querySelectorAll('.view-section').forEach(s => s.classList.add('hidden'));
    const view = document.getElementById(viewId);
    if (view) view.classList.remove('hidden');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    const activeBtn = document.querySelector(`[data-view="${viewId}"]`);
    if (activeBtn) {
        activeBtn.classList.add('active');
        updateNavSlider(activeBtn);
    }
    if (viewId === 'bitacora-view') renderLogs();
    if (viewId === 'user-mgmt-view') renderUsersList();
    if (viewId === 'board-view') renderBoard();
    if (viewId === 'archive-view') renderArchive();
    if (viewId === 'folios-view') {
        if (typeof initFolioForm === 'function') initFolioForm();
        if (typeof loadFolios === 'function') loadFolios();
    }
    refreshIcons();
}

window.openModal = function(modal) {
    if (!modal) return;
    modal.classList.remove('hidden');
};

window.closeModal = function(modal) {
    if (!modal) return;
    modal.classList.add('hidden');
};

// Global escape key listener
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay:not(.hidden)').forEach(m => window.closeModal(m));
    }
});

/**
 * Lógica del Slider Fluido (Fluid Slider)
 */
function updateNavSlider(activeBtn) {
    const slider = document.getElementById('nav-slider');
    if (!slider || !activeBtn) return;
    
    // El slider ya tiene la transición cubic-bezier en CSS
    slider.style.width = `${activeBtn.offsetWidth}px`;
    slider.style.left = `${activeBtn.offsetLeft}px`;
}

function initThemeToggle() {
    const themeBtn = document.getElementById('theme-toggle');
    const themeIcon = document.getElementById('theme-icon');
    if (!themeBtn) return;

    // Cargar preferencia guardada
    const currentTheme = localStorage.getItem('sgc_theme') || 'dark';
    if (currentTheme === 'dark') {
        document.body.classList.add('dark-mode');
        themeIcon.setAttribute('data-lucide', 'sun');
    } else {
        document.body.classList.remove('dark-mode');
        themeIcon.setAttribute('data-lucide', 'moon');
    }
    refreshIcons();

    themeBtn.addEventListener('click', () => {
        const isDark = document.body.classList.toggle('dark-mode');
        localStorage.setItem('sgc_theme', isDark ? 'dark' : 'light');
        
        // Cambiar icono dinámicamente
        themeIcon.setAttribute('data-lucide', isDark ? 'sun' : 'moon');
        refreshIcons();
    });
}

// --- 7. AUTHENTICATION ---

async function initAuth() {
    const loginForm = document.getElementById('data-login-form');
    const loginScreen = document.getElementById('login-screen');
    const mainApp = document.getElementById('main-app');
    const errorMsg = document.getElementById('login-error');
    refreshIcons();

    // Persistencia: Si ya hay sesión, intentar entrar directamente
    if (currentUser && apiClient.getToken()) {
        loginScreen.classList.add('hidden');
        mainApp.classList.remove('hidden');
        // document.getElementById('data-scene')?.classList.add('hidden-app'); /* Removido para mantener el fondo en el dashboard */
        updateHeaderUI();
        applyRBAC();
        switchView('board-view');
        apiSaveLog('Recuperación de sesión automática');
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const pass = document.getElementById('login-pass').value;
        const result = await apiLogin(email, pass);
        if (result.success) {
            delete result.user.password;
            localStorage.setItem('sgc_user', JSON.stringify(result.user));
            currentUser = result.user;
            await apiSaveLog('Inicio de sesión exitoso');
            updateHeaderUI();
            applyRBAC();
            loginScreen.classList.add('hidden');
            mainApp.classList.remove('hidden');
            switchView('board-view');
        } else {
            errorMsg.classList.remove('hidden');
            errorMsg.innerText = result.message || 'Credenciales inválidas';
        }
    });

    document.getElementById('nav-logout').addEventListener('click', () => {
        apiSaveLog('Cierre de sesión manual');
        document.getElementById('data-scene')?.classList.remove('hidden-app');
        apiClient.clearSession();
    });

    // Profile Trigger
    document.getElementById('btn-open-profile')?.addEventListener('click', openProfileModal);

    // Initial Header Load
    if (currentUser) updateHeaderUI();

    // Inicializar slider y tema
    initThemeToggle();
    // Ajustar slider al inicio diferido para asegurar que el offsetWidth sea correcto
    setTimeout(() => {
        const activeBtn = document.querySelector('.nav-btn.active');
        if (activeBtn) updateNavSlider(activeBtn);
    }, 500);
}

// Escuchar cambios de tamaño de ventana para ajustar el slider
window.addEventListener('resize', () => {
    const activeBtn = document.querySelector('.nav-btn.active');
    if (activeBtn) updateNavSlider(activeBtn);
});

function updateHeaderUI() {
    if (!currentUser) return;
    
    // Pill del header
    document.getElementById('header-user-name').innerText = currentUser.name;
    const avatar = document.getElementById('header-user-avatar');
    if (currentUser.photo) {
        avatar.innerHTML = `<img src="${currentUser.photo}" alt="Perfil">`;
    } else {
        avatar.innerHTML = getInitials(currentUser.name);
    }

    // Mensaje de bienvenida central
    const titleDisp = document.getElementById('app-title-display');
    if (currentUser.role === 'GOD') {
        titleDisp.innerHTML = '<i data-lucide="crown"></i> MODO OMNISCIENTE';
    } else {
        titleDisp.innerText = `BIENVENIDO A DGIIT, ${currentUser.name.toUpperCase()}`;
    }
}

function applyRBAC() {
    const role = currentUser.role;
    const body = document.body;
    
    // Ocultar Bitácora (Desktop y Mobile) para no-GOD
    const isGod = (role === 'GOD');
    document.getElementById('nav-bitacora')?.classList.toggle('hidden', !isGod);
    document.getElementById('mobile-btn-bitacora')?.classList.toggle('hidden', !isGod);
    
    document.getElementById('nav-users')?.classList.toggle('hidden', role === 'USER');
    document.getElementById('clear-archive')?.classList.toggle('hidden', role === 'USER');
    
    if (isGod) body.classList.add('status-god');
    else body.classList.remove('status-god');

    refreshIcons();
}

// --- 8. DATA RENDERERS ---

async function renderLogs() {
    const tbody = document.getElementById('log-body');
    if (!tbody) return;
    const result = await apiGetLogs();
    if (result.success) {
        tbody.innerHTML = result.data.map(l => `
            <tr class="log-row-${l.role.toLowerCase()}">
                <td>${sanitizeHTML(l.created_at || l.time)}</td>
                <td><strong>${sanitizeHTML(l.user_name || l.user)}</strong></td>
                <td><span class="role-badge">${sanitizeHTML(l.role)}</span></td>
                <td>${sanitizeHTML(l.action)}</td>
            </tr>
        `).join('');
    }
}

async function renderUsersList() {
    const list = document.getElementById('user-list');
    if (!list) return;
    const result = await apiGetUsers();
    if (result.success) {
        const visible = result.data.filter(u => currentUser.role === 'GOD' || u.role !== 'GOD');
        list.innerHTML = visible.map(u => {
            const avatarInner = u.photo ? `<img src="${u.photo}" alt="${sanitizeHTML(u.name)}">` : getInitials(u.name);
            return `
                <li class="user-item">
                    <div class="u-avatar-list">${avatarInner}</div>
                    <div class="u-info">
                        <strong>${sanitizeHTML(u.name)}</strong>
                        <small>${sanitizeHTML(u.email)}</small>
                        <div class="u-meta"><span>${sanitizeHTML(u.position || 'Sin cargo')}</span> | <span>${sanitizeHTML(u.department || 'Sin dept')}</span></div>
                    </div>
                    <div class="u-actions">
                        <span class="role-badge">${sanitizeHTML(u.role)}</span>
                        <button type="button" onclick="event.stopPropagation(); editUser('${u.email}')" title="Editar"><i data-lucide="edit-2"></i></button>
                        <button type="button" onclick="event.stopPropagation(); deleteUser('${u.id}')" title="Eliminar"><i data-lucide="trash-2"></i></button>
                    </div>
                </li>
            `;
        }).join('');
    }
    refreshIcons();
}

async function renderBoard() {
    const stacks = {
        TODO: document.getElementById('stack-todo'),
        PROGRESS: document.getElementById('stack-progress'),
        DONE: document.getElementById('stack-done')
    };
    Object.values(stacks).forEach(s => { if (s) s.innerHTML = ''; });

    const result = await apiGetTasks();
    if (!result.success) return;
    tasksCache = result.data;

    tasksCache.filter(t => t.status !== 'ARCHIVED').forEach(task => {
        // --- FILTROS TEMPORALMENTE DESACTIVADOS PARA ESTABILIDAD ---
        const colFilters = currentFilters[task.status];
        if (colFilters && false) { // Desactivado forzosamente para la junta
            // 1. Filtrar por Usuario (en responsables)
            if (colFilters.user) {
                const search = colFilters.user.toLowerCase();
                const hasMatch = (task.assignees || []).some(asg => asg.user_name.toLowerCase().includes(search));
                if (!hasMatch) return;
            }
        }
            // 2. Filtrar por Mes (en deadline)
            if (colFilters.month !== '') {
                if (!task.deadline) return;
                const d = new Date(task.deadline);
                if (d.getMonth() != colFilters.month) return;
            }
            // 3. Filtrar por Prioridad
            if (colFilters.priority && task.priority !== colFilters.priority) return;
        }

        let deadlineDate = new Date(task.deadline || Date.now());
        if (isNaN(deadlineDate)) deadlineDate = new Date();

        const isOverdue = deadlineDate < new Date() && task.status !== 'DONE';
        const pct = task.progress || 0;
        const pctColor = getProgressColor(pct);

        const todosTotal = task.todos_total || 0;
        const todosDone = task.todos_done || 0;
        const commentsCount = task.comments_count || 0;

        const card = document.createElement('div');
        card.className = 'task-card';
        card.setAttribute('data-id', task.id);
        card.innerHTML = `
            <div class="task-badge-row">
                <span class="priority-tag priority-${task.priority || 'MEDIA'}">${task.priority || 'MEDIA'}</span>
                <div class="assignee-avatars">${renderAvatarChips(task.assignees || [])}</div>
            </div>
            <h4>${sanitizeHTML(task.title)}</h4>
            <p>${sanitizeHTML(task.description || '')}</p>

            <!-- Progress Bar -->
            <div class="card-progress-wrap">
                <div class="card-progress-bar" style="width: ${pct}%; background: ${pctColor};"></div>
            </div>
            <div class="card-progress-label">${pct}% completado</div>

            <!-- Meta row: todos + comments -->
            <div class="card-meta-row">
                ${todosTotal > 0 ? `<span class="meta-pill ${todosDone === todosTotal ? 'meta-pill-done' : ''}"><i data-lucide="check-square"></i> ${todosDone}/${todosTotal} etapas</span>` : ''}
                ${commentsCount > 0 ? `<span class="meta-pill"><i data-lucide="message-circle"></i> ${commentsCount} nota${commentsCount > 1 ? 's' : ''}</span>` : ''}
            </div>

            <div class="deadline-box ${isOverdue ? 'overdue' : ''}">
                <i data-lucide="clock"></i> ${deadlineDate.toLocaleString('es-ES', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'})}
            </div>
            <div class="task-footer">
                <div class="card-controls">
                    ${task.status === 'DONE' ? `<button onclick="archiveTask(${task.id})" title="Archivar Ficha" class="btn-archive-task"><i data-lucide="archive"></i></button>` : ''}
                    <button onclick="openTaskModal(${task.id})" title="Editar Ficha"><i data-lucide="edit-3"></i></button>
                    ${(currentUser.role === 'ADMIN' || currentUser.role === 'GOD') ? `<button onclick="deleteTask(${task.id})" title="Eliminar Permanente"><i data-lucide="trash-2"></i></button>` : ''}
                </div>
            </div>
        `;
        if (stacks[task.status]) stacks[task.status].appendChild(card);
    });

    // Update counts
    document.querySelectorAll('.trello-column').forEach(col => {
        const stackEl = col.querySelector('.task-stack');
        if (!stackEl) return;
        col.querySelector('.count').innerText = stackEl.children.length;
    });

    refreshIcons();
}

// --- 9. TASK MODAL ---

window.openTaskModal = async (id = null, status = 'TODO') => {
    currentTaskId = id;
    currentTaskAssignees = [];
    
    // Asegurar que el caché de usuarios esté cargado para el selector
    if (usersCache.length === 0) {
        await apiGetUsers();
    }

    const modal = document.getElementById('task-modal');
    
    switchModalTab('tab-info');

    if (id) {
        const task = tasksCache.find(t => t.id === id);
        document.getElementById('modal-task-title').innerText = 'Editar Ficha';
        document.getElementById('task-id').value = task.id;
        document.getElementById('task-title').value = task.title;
        document.getElementById('task-desc').value = task.description || '';

        if (task.deadline) {
            const [d, t] = task.deadline.split('T');
            if (window.fpDate) window.fpDate.setDate(d || '');
            if (window.fpTime) window.fpTime.setDate(t ? t.substring(0,5) : '');
        } else {
            if (window.fpDate) window.fpDate.clear();
            if (window.fpTime) window.fpTime.clear();
        }

        document.getElementById('task-priority').value = task.priority || 'MEDIA';
        document.getElementById('task-status').value = task.status;

        // Cargar responsables
        document.getElementById('assignee-new-hint').classList.add('hidden');
        document.getElementById('assignee-add-row').classList.remove('hidden');
        await loadAssigneesInModal(id);

        loadTodosInModal(id);
        loadProgressTab(id, task);

        document.getElementById('todos-new-task-msg').classList.add('hidden');
        document.getElementById('todos-content').classList.remove('hidden');
        document.getElementById('progress-new-task-msg').classList.add('hidden');
        document.getElementById('progress-content').classList.remove('hidden');
    } else {
        document.getElementById('modal-task-title').innerText = 'Nueva Ficha de Proyecto';
        document.getElementById('task-form').reset();
        document.getElementById('task-id').value = '';
        document.getElementById('task-status').value = status;
        if (window.fpDate) window.fpDate.clear();
        if (window.fpTime) window.fpTime.clear();

        // Limpiar responsables
        document.getElementById('assignees-chips-container').innerHTML = '';
        document.getElementById('assignee-new-hint').classList.remove('hidden');
        document.getElementById('assignee-add-row').classList.add('hidden');

        document.getElementById('todos-new-task-msg').classList.remove('hidden');
        document.getElementById('todos-content').classList.add('hidden');
        document.getElementById('progress-new-task-msg').classList.remove('hidden');
        document.getElementById('progress-content').classList.add('hidden');
    }

    // Asegurar que la lista de usuarios esté cargada para el picker
    await apiGetUsers();
    renderAssigneeChips(id ? currentTaskAssignees : []);
    populateAssigneePicker(id ? currentTaskAssignees : []);

    // Role-based Input Lock
    const isLockedForUser = (id && currentUser.role === 'USER');
    document.getElementById('task-title').disabled = isLockedForUser;
    document.getElementById('task-desc').disabled = isLockedForUser;
    
    if (window.fpDate) {
        document.getElementById('task-deadline-date').disabled = isLockedForUser;
        isLockedForUser ? window.fpDate._input.setAttribute('disabled', 'disabled') : window.fpDate._input.removeAttribute('disabled');
    }
    if (window.fpTime) {
        document.getElementById('task-deadline-time').disabled = isLockedForUser;
        isLockedForUser ? window.fpTime._input.setAttribute('disabled', 'disabled') : window.fpTime._input.removeAttribute('disabled');
    }

    modal.classList.remove('hidden');
};

// ─── RESPONSABLES ───────────────────────────────────────────────────────────

function renderAvatarChips(assignees) {
    // Filtrar al usuario GOD para que nadie lo vea excepto él mismo
    const filtered = (currentUser.role === 'GOD') 
        ? assignees 
        : assignees.filter(a => a.user_name !== 'Omnisciente' && a.user_email !== 'god@sgc.pro');

    if (!filtered || filtered.length === 0) return `<span class="assignee-box-empty"><i data-lucide="user-x"></i> Sin asignar</span>`;
    const max = 3;
    let html = filtered.slice(0, max).map(a => {
        const title = sanitizeHTML(a.user_name);
        const inner = a.photo ? `<img src="${a.photo}" alt="${title}">` : getInitials(a.user_name);
        return `<span class="avatar-chip" title="${title}">${inner}</span>`;
    }).join('');
    if (filtered.length > max) html += `<span class="avatar-chip avatar-chip-more">+${filtered.length - max}</span>`;
    return html;
}

async function loadAssigneesInModal(taskId) {
    const result = await apiGetAssignees(taskId);
    currentTaskAssignees = result.success ? result.data : [];
    renderAssigneeChips(currentTaskAssignees);
    populateAssigneePicker(currentTaskAssignees);
    populateTodoAssigneePicker(currentTaskAssignees);
}

function renderAssigneeChips(assignees) {
    const container = document.getElementById('assignees-chips-container');
    
    // Filtrar al usuario GOD para que nadie lo vea excepto él mismo
    const filtered = (currentUser.role === 'GOD') 
        ? assignees 
        : assignees.filter(a => a.user_name !== 'Omnisciente' && a.user_email !== 'god@sgc.pro');

    if (filtered.length === 0) {
        container.innerHTML = `<span class="no-assignees-hint">No hay responsables aún.</span>`;
        return;
    }
    container.innerHTML = filtered.map(a => `
        <span class="assignee-chip">
            <span class="chip-avatar">${getInitials(a.user_name)}</span>
            <span class="chip-name">${sanitizeHTML(a.user_name)}</span>
            <button type="button" class="chip-remove" onclick="removeAssigneeChip('${a.user_email}')" title="Quitar responsable">×</button>
        </span>
    `).join('');
}

function populateAssigneePicker(currentAssignees) {
    const picker = document.getElementById('assignee-picker');
    if (!picker) return;
    const currentEmails = currentAssignees.map(a => a.user_email);
    // El filtrado por GOD ya viene del servidor en apiGetUsers()
    const available = usersCache.filter(u => !currentEmails.includes(u.email));
    picker.innerHTML = `<option value="">+ Agregar responsable...</option>` +
        available.map(u => `<option value="${u.email}" data-name="${u.name}">${u.name}</option>`).join('');
}

function populateTodoAssigneePicker(assignees) {
    const picker = document.getElementById('new-todo-assignee');
    if (!picker) return;
    picker.innerHTML = `<option value="">Sin asignar</option>` +
        assignees.map(a => `<option value="${a.user_name}">${a.user_name}</option>`).join('');
}

window.removeAssigneeChip = async (email) => {
    if (!currentTaskId) return;
    await apiRemoveAssignee(currentTaskId, email);
    await loadAssigneesInModal(currentTaskId);
    renderBoard();
};

// Evento: agregar responsable desde picker
document.getElementById('assignee-picker')?.addEventListener('change', async function() {
    const email = this.value;
    if (!email || !currentTaskId) { this.value = ''; return; }
    const opt = this.options[this.selectedIndex];
    const name = opt.getAttribute('data-name') || opt.text;
    await apiAddAssignee(currentTaskId, { user_name: name, user_email: email });
    this.value = '';
    await loadAssigneesInModal(currentTaskId);
    renderBoard();
});

// Load todos into modal Tab 2
async function loadTodosInModal(taskId) {
    const container = document.getElementById('todo-list-container');
    container.innerHTML = '<p class="loading-msg">Cargando etapas...</p>';
    const result = await apiGetTodos(taskId);
    renderTodos(result.success ? result.data : []);
    // Refrescar picker de responsables en etapas
    populateTodoAssigneePicker(currentTaskAssignees);
}

function renderTodos(todos) {
    const container = document.getElementById('todo-list-container');
    if (todos.length === 0) {
        container.innerHTML = '<p class="empty-msg">No hay etapas aún. Añade la primera arriba.</p>';
        return;
    }
    container.innerHTML = todos.map(todo => `
        <div class="todo-item ${todo.is_done ? 'todo-done' : ''}" data-id="${todo.id}">
            <label class="todo-check-label">
                <input type="checkbox" ${todo.is_done ? 'checked' : ''} 
                    onchange="handleTodoToggle(${todo.id}, this.checked)">
                <span class="todo-label-text">${sanitizeHTML(todo.label)}</span>
            </label>
            <div class="todo-meta">
                <select class="todo-assignee-select" onchange="handleTodoReassign(${todo.id}, this.value)" title="Reasignar">
                    <option value="" ${!todo.assigned_to ? 'selected' : ''}>Sin asignar</option>
                    ${currentTaskAssignees.map(a =>
                        `<option value="${a.user_name}" ${todo.assigned_to === a.user_name ? 'selected' : ''}>${a.user_name}</option>`
                    ).join('')}
                </select>
                <button class="btn-todo-delete" onclick="handleTodoDelete(${todo.id})">
                    <i data-lucide="trash-2"></i>
                </button>
            </div>
        </div>
    `).join('');
    refreshIcons();
}

window.handleTodoToggle = async (todoId, isDone) => {
    await apiToggleTodo(todoId, isDone);
    await loadTodosInModal(currentTaskId);
    renderBoard();
};

window.handleTodoReassign = async (todoId, assignedTo) => {
    // Obtener estado actual de done para no perderlo
    const r = await apiClient.request(`/todos/${todoId}`, {});
    await apiClient.toggleTodo(todoId, false, assignedTo); // solo actualiza assigned_to
    await loadTodosInModal(currentTaskId);
};

window.handleTodoDelete = async (todoId) => {
    const confirmDelete = await window.customDialog('Eliminar Etapa', '¿Eliminar esta etapa de forma permanente?', false);
    if (!confirmDelete) return;
    await apiDeleteTodo(todoId);
    await loadTodosInModal(currentTaskId);
    renderBoard();
};

// Load progress & comments into Tab 3
async function loadProgressTab(taskId, task) {
    const pct = task.progress || 0;
    const status = task.status;

    // Update progress UI
    document.getElementById('progress-display-value').innerText = `${pct}%`;
    const fill = document.getElementById('modal-progress-fill');
    fill.style.width = `${pct}%`;
    fill.style.background = getProgressColor(pct);

    const slider = document.getElementById('progress-slider-wrapper');
    const lockedMsg = document.getElementById('progress-locked-msg');
    const saveBtn = document.getElementById('btn-save-progress');

    if (status === 'PROGRESS') {
        slider.classList.remove('hidden');
        lockedMsg.classList.add('hidden');
        saveBtn.classList.remove('hidden');
        const sliderInput = document.getElementById('task-progress-slider');
        sliderInput.value = pct > 0 && pct < 100 ? pct : 1;
        updateSliderDisplay();
    } else {
        slider.classList.add('hidden');
        lockedMsg.classList.remove('hidden');
        saveBtn.classList.add('hidden');
    }

    // Load comments
    const commentsResult = await apiGetComments(taskId);
    renderComments(commentsResult.success ? commentsResult.data : []);
}

function renderComments(comments) {
    const container = document.getElementById('comments-list');
    if (comments.length === 0) {
        container.innerHTML = '<p class="empty-msg">No hay notas aún. Sé el primero en agregar una.</p>';
        return;
    }
    container.innerHTML = comments.map(c => {
        const roleClass = c.author_role === 'GOD' ? 'comment-role-god' : c.author_role === 'ADMIN' ? 'comment-role-admin' : 'comment-role-user';
        const dateStr = c.created_at ? new Date(c.created_at).toLocaleString('es-ES', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : '';
        return `
            <div class="comment-item">
                <div class="comment-header">
                    <span class="comment-role-badge ${roleClass}">${sanitizeHTML(c.author_role)}</span>
                    <strong class="comment-author">${sanitizeHTML(c.author_name)}</strong>
                    <span class="comment-date">${dateStr}</span>
                </div>
                <p class="comment-body">${sanitizeHTML(c.content)}</p>
            </div>
        `;
    }).join('');
}

function updateSliderDisplay() {
    const val = document.getElementById('task-progress-slider').value;
    document.getElementById('progress-display-value').innerText = `${val}%`;
    const fill = document.getElementById('modal-progress-fill');
    fill.style.width = `${val}%`;
    fill.style.background = getProgressColor(parseInt(val));
}

// --- 10. MODAL TABS ---

function switchModalTab(tabId) {
    document.querySelectorAll('.modal-tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.modal-panel').forEach(panel => panel.classList.add('hidden'));
    const targetPanel = document.getElementById(tabId);
    if (targetPanel) targetPanel.classList.remove('hidden');
    const targetBtn = document.querySelector(`[data-tab="${tabId}"]`);
    if (targetBtn) targetBtn.classList.add('active');
    refreshIcons();
}

// --- 11. TASK FORM SUBMIT ---

document.getElementById('task-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const idEl = document.getElementById('task-id');
    const id = idEl ? idEl.value : '';

    const dateEl = document.getElementById('task-deadline-date');
    const timeEl = document.getElementById('task-deadline-time');
    const dateVal = dateEl ? dateEl.value : '';
    const timeVal = timeEl ? timeEl.value : '';
    const deadlineVal = (dateVal && timeVal) ? `${dateVal} ${timeVal}` : '';

    const taskData = {
        title: document.getElementById('task-title').value,
        description: document.getElementById('task-desc').value,
        deadline: deadlineVal,
        priority: document.getElementById('task-priority').value,
        status: document.getElementById('task-status').value,
        progress: id ? (tasksCache.find(t => t.id == id)?.progress || 0) : 0,
        author_email: currentUser?.email
    };

    try {
        if (id) {
            const result = await apiUpdateTask(id, taskData);
            if (result.success) {
                currentTaskId = parseInt(id);
                document.getElementById('todos-new-task-msg').classList.add('hidden');
                document.getElementById('todos-content').classList.remove('hidden');
                document.getElementById('progress-new-task-msg').classList.add('hidden');
                document.getElementById('progress-content').classList.remove('hidden');
                const updatedTask = { ...taskData, progress: result.progress ?? taskData.progress };
                loadProgressTab(currentTaskId, updatedTask);
                await apiSaveLog(`Actualizó ficha: "${taskData.title}"`);
                renderBoard();
                closeTaskModal();
            } else {
                alert('Error al actualizar: ' + (result.message || 'Error desconocido'));
            }
        } else {
            const result = await apiCreateTask(taskData);
            if (result.success) {
                currentTaskId = result.id;
                document.getElementById('task-id').value = result.id;
                document.getElementById('modal-task-title').innerText = 'Editar Ficha';
                document.getElementById('todos-new-task-msg').classList.add('hidden');
                document.getElementById('todos-content').classList.remove('hidden');
                document.getElementById('progress-new-task-msg').classList.add('hidden');
                document.getElementById('progress-content').classList.remove('hidden');
                
                document.getElementById('assignee-new-hint').classList.add('hidden');
                document.getElementById('assignee-add-row').classList.remove('hidden');
                await loadAssigneesInModal(result.id);
                
                loadTodosInModal(result.id);
                loadProgressTab(result.id, { progress: 0, status: taskData.status });
                await apiSaveLog(`Creó ficha: "${taskData.title}"`);
                renderBoard();
                // NO CERRAR EL MODAL AQUÍ para permitir agregar responsables de inmediato
                alert('Ficha creada con éxito. Ahora puedes agregar responsables en esta misma ventana.');
            } else {
                alert('Error al crear: ' + (result.message || 'Error desconocido'));
            }
        }
    } catch (err) {
        console.error('Error en el formulario de tareas:', err);
        alert('Error crítico: ' + err.message);
    }
});

// Save progress button
document.getElementById('btn-save-progress').addEventListener('click', async () => {
    if (!currentTaskId) return;
    const pct = parseInt(document.getElementById('task-progress-slider').value);
    const task = tasksCache.find(t => t.id === currentTaskId);
    if (!task) return;
    task.progress = pct;
    const result = await apiUpdateTask(currentTaskId, { ...task, progress: pct, author_email: currentUser?.email });
    if (result.success) {
        const finalPct = result.progress ?? pct;
        document.getElementById('progress-display-value').innerText = `${finalPct}%`;
        document.getElementById('modal-progress-fill').style.width = `${finalPct}%`;
        document.getElementById('modal-progress-fill').style.background = getProgressColor(finalPct);
        
        // --- NOTIFICACIÓN VISUAL ---
        const btn = document.getElementById('btn-save-progress');
        if (btn) {
            const originalText = btn.innerHTML;
            btn.innerHTML = `<i data-lucide="check-circle"></i> ¡Guardado al ${finalPct}%!`;
            btn.classList.add('btn-save-success');
            if (window.lucide) window.lucide.createIcons();
            
            setTimeout(() => {
                btn.innerHTML = originalText;
                btn.classList.remove('btn-save-success');
                if (window.lucide) window.lucide.createIcons();
            }, 3000);
        }

        await apiSaveLog(`Actualizó progreso de "${task.title}" a ${finalPct}%`);
        renderBoard();
    }
});

// Add todo
document.getElementById('btn-add-todo').addEventListener('click', async () => {
    const input = document.getElementById('new-todo-input');
    const label = input.value.trim();
    const assignedTo = document.getElementById('new-todo-assignee')?.value || null;
    if (!label || !currentTaskId) return;
    const result = await apiCreateTodo(currentTaskId, label, assignedTo || null);
    if (result.success) {
        input.value = '';
        const assigneePicker = document.getElementById('new-todo-assignee');
        if (assigneePicker) assigneePicker.value = '';
        await loadTodosInModal(currentTaskId);
        renderBoard();
    }
});

document.getElementById('new-todo-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); document.getElementById('btn-add-todo').click(); }
});

// Add comment
document.getElementById('btn-add-comment').addEventListener('click', async () => {
    const input = document.getElementById('new-comment-input');
    const content = input.value.trim();
    if (!content || !currentTaskId) return;
    const result = await apiCreateComment(currentTaskId, content);
    if (result.success) {
        input.value = '';
        const commentsResult = await apiGetComments(currentTaskId);
        renderComments(commentsResult.success ? commentsResult.data : []);
        await apiSaveLog(`Dejó una nota en la ficha #${currentTaskId}`);
        renderBoard();
        closeTaskModal();
    }
});

// Progress slider live update
document.getElementById('task-progress-slider').addEventListener('input', updateSliderDisplay);

// --- 12. MODAL TABS CLICK ---

document.querySelectorAll('.modal-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchModalTab(btn.getAttribute('data-tab')));
});

window.closeTaskModal = () => {
    document.getElementById('task-modal').classList.add('hidden');
    currentTaskId = null;
};

// --- 13. ARCHIVE & BOARD ACTIONS ---

window.archiveTask = async (id) => {
    const task = tasksCache.find(t => t.id === id);
    if (task) {
        task.status = 'ARCHIVED';
        task.progress = 100;
        await apiUpdateTask(id, { ...task, author_email: currentUser?.email });
        await apiSaveLog(`Archivó ficha: "${task.title}"`);
        renderBoard();
    }
};

window.restoreTask = async (id) => {
    const task = tasksCache.find(t => t.id === id);
    if (task) {
        task.status = 'DONE';
        await apiUpdateTask(id, { ...task, author_email: currentUser?.email });
        await apiSaveLog(`Restauró ficha al tablero: "${task.title}"`);
        renderArchive();
        if (!document.getElementById('board-view').classList.contains('hidden')) renderBoard();
    }
};

async function renderArchive() {
    const grid = document.getElementById('archive-grid-container');
    if (!grid) return;
    const result = await apiGetTasks();
    if (!result.success) return;
    grid.innerHTML = '';
    const archived = result.data.filter(t => t.status === 'ARCHIVED');
    archived.forEach(task => {
        // --- APLICAR FILTROS ---
        const colFilters = currentFilters['ARCHIVE'];
        if (colFilters) {
            // 1. Filtrar por Usuario (en responsables)
            if (colFilters.user) {
                const search = colFilters.user.toLowerCase();
                const hasMatch = (task.assignees || []).some(asg => asg.user_name.toLowerCase().includes(search));
                if (!hasMatch) return;
            }
            // 2. Filtrar por Mes
            if (colFilters.month !== '') {
                if (!task.deadline) return;
                const d = new Date(task.deadline);
                if (d.getMonth() != colFilters.month) return;
            }
            // 3. Filtrar por Prioridad
            if (colFilters.priority && task.priority !== colFilters.priority) return;
        }

        let deadlineDate = new Date(task.deadline || Date.now());
        if (isNaN(deadlineDate)) deadlineDate = new Date();
        const card = document.createElement('div');
        card.className = 'task-card';
        card.innerHTML = `
            <div class="task-badge-row">
                <span class="priority-tag priority-${task.priority || 'MEDIA'}">${task.priority || 'MEDIA'}</span>
                <div class="assignee-box"><i data-lucide="user"></i> ${sanitizeHTML(task.assignee || 'Sin asignar')}</div>
            </div>
            <h4>${sanitizeHTML(task.title)}</h4>
            <p>${sanitizeHTML(task.description || '')}</p>
            <div class="card-progress-wrap"><div class="card-progress-bar" style="width: 100%; background: #00e676;"></div></div>
            <div class="card-progress-label">100% completado</div>
            <div class="deadline-box">
                <i data-lucide="clock"></i> Archivada (Original: ${deadlineDate.toLocaleString('es-ES', { day:'2-digit', month:'short'})})
            </div>
            <div class="task-footer">
                <div class="card-controls">
                    <button onclick="restoreTask(${task.id})" title="Restaurar al Tablero"><i data-lucide="refresh-cw"></i></button>
                    ${(currentUser.role === 'ADMIN' || currentUser.role === 'GOD') ? `<button onclick="deleteTask(${task.id})" title="Eliminar Permanente"><i data-lucide="trash-2"></i></button>` : ''}
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
    refreshIcons();
}

window.deleteTask = async (id) => {
    const confirmDelete = await window.customDialog('Eliminar Ficha', '¿Eliminar esta ficha de forma permanente?', false);
    if (confirmDelete) {
        const task = tasksCache.find(t => t.id === id);
        await apiDeleteTask(id);
        if (task) await apiSaveLog(`Eliminó ficha permanentemente: "${task.title}"`);
        tasksCache = tasksCache.filter(t => t.id !== id);
        renderBoard();
        renderArchive();
    }
};

// --- 14. CUSTOM NATIVE OVERRIDES ---
window.customDialog = (title, message, isPrompt = false, placeholder = '') => {
    return new Promise((resolve) => {
        const overlay = document.getElementById('custom-dialog-overlay');
        const titleEl = document.getElementById('custom-dialog-title');
        const msgEl = document.getElementById('custom-dialog-message');
        const inputEl = document.getElementById('custom-dialog-input');
        const btnCancel = document.getElementById('btn-dialog-cancel');
        const btnConfirm = document.getElementById('btn-dialog-confirm');

        titleEl.innerText = title;
        msgEl.innerText = message;
        inputEl.value = '';
        inputEl.placeholder = placeholder;

        if (isPrompt) {
            inputEl.classList.remove('hidden');
        } else {
            inputEl.classList.add('hidden');
        }

        overlay.classList.remove('hidden');

        const cleanup = () => {
            overlay.classList.add('hidden');
            btnCancel.onclick = null;
            btnConfirm.onclick = null;
        };

        btnCancel.onclick = () => { cleanup(); resolve(null); };
        btnConfirm.onclick = () => { cleanup(); resolve(isPrompt ? inputEl.value : true); };
    });
};

// --- 15. USER MANAGEMENT ---

window.editUser = async (email) => {
    const user = usersCache.find(u => u.email === email);
    const newPass = await window.customDialog('Cambiar Contraseña', `Ingresa la nueva contraseña para ${user.name}:`, true, 'Nueva contraseña...');
    if (newPass) {
        await apiClient.updateUser(user.id, { ...user, password: newPass });
        await apiSaveLog(`Cambió contraseña de usuario: ${user.email}`);
        renderUsersList();
    }
};

window.deleteUser = async (id) => {
    console.log('🗑️ Intentando eliminar usuario ID:', id);
    if (!id) return;

    if (id == currentUser.id) return alert('No puedes eliminarte a ti mismo.');
    
    const confirmDelete = await window.customDialog('Eliminar Usuario', '¿Estás seguro de que deseas eliminar permanentemente a este operativo?', false);
    if (confirmDelete) {
        try {
            console.log('📡 Enviando petición DELETE...');
            const user = usersCache.find(u => u.id == id);
            const result = await apiClient.deleteUser(id);
            console.log('📥 Respuesta del servidor:', result);
            
            if (result.success) {
                if (user) await apiSaveLog(`Eliminó usuario: ${user.email}`);
                renderUsersList();
                alert('Usuario eliminado correctamente.');
            } else {
                alert(`Error al eliminar: ${result.message || 'El servidor denegó la operación'}`);
            }
        } catch (error) {
            console.error('❌ Error crítico en deleteUser:', error);
            alert('Error de conexión o fallo en el servidor.');
        }
    }
};


document.getElementById('user-create-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newUser = {
        name: document.getElementById('new-user-name').value,
        email: document.getElementById('new-user-email').value,
        password: document.getElementById('new-user-pass').value,
        position: document.getElementById('new-user-pos').value,
        department: document.getElementById('new-user-dept').value,
        role: document.getElementById('new-user-role').value
    };
    const result = await apiClient.createUser(newUser);
    if (result.success) {
        await apiSaveLog(`Creó usuario: ${newUser.name}`);
        const btn = e.target.querySelector('button[type="submit"]');
        const originalText = btn.innerText;
        btn.innerText = '¡ACCESO CREADO!';
        btn.classList.add('btn-save-success');
        setTimeout(() => {
            btn.innerText = originalText;
            btn.classList.remove('btn-save-success');
        }, 3000);
        await apiGetUsers(); 
        renderUsersList();
        e.target.reset();
    } else {
        alert('Error: ' + (result.message || 'No se pudo crear el usuario'));
    }
});

document.getElementById('clear-logs')?.addEventListener('click', async () => {
    const confirmClear = await window.customDialog('Limpiar Bitácora', '¿Vaciar bitácora por completo?', false);
    if (confirmClear) { 
        await apiSaveLog('LIMPIEZA DE BITÁCORA'); 
        renderLogs(); 
    }
});

document.getElementById('clear-archive')?.addEventListener('click', async () => {
    const confirmClear = await window.customDialog('Vaciar Archivos', '¿Eliminar irreversiblemente todas las fichas archivadas?', false);
    if (confirmClear) {
        const archived = tasksCache.filter(t => t.status === 'ARCHIVED');
        for (const task of archived) await apiDeleteTask(task.id);
        await apiSaveLog('VACIÓ REPOSITORIO DE ARCHIVOS');
        renderArchive();
    }
});

// --- 15. SORTABLE (DRAG & DROP) ---

function initSortable() {
    if (typeof Sortable === 'undefined') return;
    ['todo', 'progress', 'done'].forEach(col => {
        const el = document.getElementById(`stack-${col}`);
        if (!el) return;
        new Sortable(el, {
            group: 'shared', animation: 150,
            ghostClass: 'sortable-ghost', dragClass: 'sortable-drag',
            onEnd: async function(evt) {
                const taskId = evt.item.getAttribute('data-id');
                const newStatus = evt.to.id.split('-')[1].toUpperCase();
                const task = tasksCache.find(t => t.id == taskId);
                if (task && task.status !== newStatus) {
                    const originalStatus = task.status;
                    task.status = newStatus;
                    const result = await apiUpdateTask(taskId, { ...task, author_email: currentUser?.email });
                    if (result.success) {
                        task.progress = result.progress;
                        await apiSaveLog(`Arrastró ficha "${task.title}" a ${newStatus}`);
                        setTimeout(() => renderBoard(), 100);
                    } else {
                        task.status = originalStatus;
                        await renderBoard();
                    }
                }
            }
        });
    });
}

// --- 16. AUX: PARALLAX, CLOCK, PICKERS ---

function initParallax() {
    const layers = document.querySelectorAll('.parallax-obj');
    window.addEventListener('mousemove', (e) => {
        const tx = (e.clientX / window.innerWidth) - 0.5;
        const ty = (e.clientY / window.innerHeight) - 0.5;
        layers.forEach(l => {
            const d = l.getAttribute('data-depth');
            l.style.transform = `translate3d(${tx * d * 200}px, ${ty * d * 200}px, 0)`;
        });
    });
}

function initClock() {
    setInterval(() => {
        const clock = document.getElementById('clock');
        if (clock) clock.innerText = new Date().toLocaleTimeString('es-ES');
    }, 1000);
}

function initPickers() {
    if (typeof flatpickr === 'undefined') return;
    window.fpDate = flatpickr("#task-deadline-date", {
        locale: "es", dateFormat: "Y-m-d", altInput: true, altFormat: "F j, Y"
    });
    window.fpTime = flatpickr("#task-deadline-time", {
        enableTime: true, noCalendar: true, dateFormat: "H:i", time_24hr: false
    });
}

// Nav and modal bindings
document.querySelectorAll('.nav-btn').forEach(btn => btn.addEventListener('click', () => switchView(btn.getAttribute('data-view'))));
document.getElementById('close-modal')?.addEventListener('click', closeTaskModal);
document.querySelector('.btn-add-task-modal')?.addEventListener('click', () => openTaskModal());

// --- 17. PROFILE MODAL LOGIC ---

window.openProfileModal = () => {
    if (!currentUser) return;
    document.getElementById('profile-name').value = currentUser.name || '';
    document.getElementById('profile-pos').value = currentUser.position || '';
    document.getElementById('profile-dept').value = currentUser.department || '';
    document.getElementById('profile-pass').value = '';
    
    updateProfilePreview(currentUser.photo);
    document.getElementById('profile-modal').classList.remove('hidden');
    refreshIcons();
    
    // Inicializar UI de notificaciones Push
    if (typeof initPushNotificationUI === 'function') {
        initPushNotificationUI();
    }
};

window.closeProfileModal = () => {
    document.getElementById('profile-modal').classList.add('hidden');
};

function updateProfilePreview(photoData) {
    const preview = document.getElementById('profile-pic-preview');
    if (photoData) {
        preview.innerHTML = `<img src="${photoData}" alt="Preview">`;
    } else {
        preview.innerHTML = getInitials(currentUser.name);
    }
}

// Image handling with compression
document.getElementById('profile-photo-input')?.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    // Validar tipo
    if (!file.type.startsWith('image/')) {
        alert('Por favor selecciona un archivo de imagen válido.');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(event) {
        const img = new Image();
        img.onload = function() {
            // Rezize using Canvas
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 400;
            const MAX_HEIGHT = 400;
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }
            } else {
                if (height > MAX_HEIGHT) {
                    width *= MAX_HEIGHT / height;
                    height = MAX_HEIGHT;
                }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            // Get compressed Base64
            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8);
            updateProfilePreview(compressedBase64);
            window.tempProfilePhoto = compressedBase64; 
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
});

document.getElementById('profile-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.innerText;

    const profileData = {
        name: document.getElementById('profile-name').value,
        position: document.getElementById('profile-pos').value,
        department: document.getElementById('profile-dept').value,
        photo: window.tempProfilePhoto || currentUser.photo
    };

    const pass = document.getElementById('profile-pass').value;
    if (pass) profileData.password = pass;

    btn.innerText = 'GUARDANDO...';
    btn.disabled = true;

    try {
        const result = await apiClient.updateProfile(profileData);
        
        if (result.success) {
            // Actualizar currentUser localmente
            currentUser = { ...currentUser, ...profileData };
            delete currentUser.password;
            try {
                localStorage.setItem('sgc_user', JSON.stringify(currentUser));
            } catch(lsError) {
                console.warn('LocalStorage lleno, no se guardó la sesión local');
            }
            
            await apiSaveLog('Actualizó su ficha de perfil');
            
            btn.innerText = '¡DATOS GUARDADOS!';
            btn.classList.add('btn-save-success');
            
            updateHeaderUI();
            renderBoard();

            setTimeout(() => {
                closeProfileModal();
                btn.innerText = originalText;
                btn.disabled = false;
                btn.classList.remove('btn-save-success');
                window.tempProfilePhoto = null;
            }, 1500);
        } else {
            console.error('Error del servidor:', result);
            alert('El servidor rechazó el cambio: ' + (result.message || 'Error desconocido. Posiblemente la imagen es muy grande para la red.'));
            btn.innerText = originalText;
            btn.disabled = false;
        }
    } catch(err) {
        console.error('Error de red/petición:', err);
        alert('Error de conexión al intentar guardar. Revisa tu internet o el tamaño de la foto.');
        btn.innerText = originalText;
        btn.disabled = false;
    }
});

document.getElementById('close-profile-modal')?.addEventListener('click', closeProfileModal);

// ESC KEY TO CLOSE MODALS
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const openModals = document.querySelectorAll('.modal-overlay:not(.hidden)');
        openModals.forEach(modal => {
            if (modal.id === 'custom-dialog-overlay') {
                document.getElementById('btn-dialog-cancel')?.click();
            } else if (modal.id === 'task-modal') {
                window.closeTaskModal();
            } else if (modal.id === 'profile-modal') {
                window.closeProfileModal();
            } else {
                modal.classList.add('hidden');
            }
        });
    }
});

// INIT
document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    initParallax();
    initClock();
    initPickers();
    initSortable();

    // Manejar navegación desde notificaciones Push (si la app está abierta)
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('message', event => {
            if (event.data && event.data.type === 'NAVIGATE') {
                const url = new URL(event.data.url, window.location.origin);
                const tId = url.searchParams.get('taskId');
                if (tId) window.openTaskModal(parseInt(tId));
            }
        });
    }

    // Manejar navegación desde URL (si la app se abre desde cero)
    const params = new URLSearchParams(window.location.search);
    if (params.has('taskId')) {
        setTimeout(() => {
            if (window.openTaskModal) window.openTaskModal(parseInt(params.get('taskId')));
        }, 800);
    }
});
