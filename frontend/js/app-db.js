/**
 * SGC PRO | Master Logic Engine con Base de Datos
 * Role-Based Access Control, Activity Tracking, Progress, Todos, Comments
 */

// --- 1. CONSTANTS ---
const API_BASE_URL = 'http://localhost:3000/api';

let usersCache = [];
let tasksCache = [];
let logsCache = [];
let currentUser = null;
let currentTaskId = null; // Track open modal task

// --- 2. API CLIENT —BASE ---

async function apiLogin(email, password) {
    try {
        const r = await fetch(`${API_BASE_URL}/login`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        return await r.json();
    } catch (e) { return { success: false, message: 'El servidor no responde. ¿Está encendido?' }; }
}

async function apiGetUsers() {
    try {
        const r = await fetch(`${API_BASE_URL}/users?t=${Date.now()}`);
        const d = await r.json();
        if (d.success) usersCache = d.data;
        return d;
    } catch (e) { return { success: false, data: [] }; }
}

async function apiGetTasks() {
    try {
        const r = await fetch(`${API_BASE_URL}/tasks?t=${Date.now()}`);
        const d = await r.json();
        if (d.success) tasksCache = d.data;
        return d;
    } catch (e) { return { success: false, data: [] }; }
}

async function apiGetLogs() {
    try {
        const r = await fetch(`${API_BASE_URL}/logs?t=${Date.now()}`);
        const d = await r.json();
        if (d.success) logsCache = d.data;
        return d;
    } catch (e) { return { success: false, data: [] }; }
}

async function apiSaveLog(action) {
    if (!currentUser) return { success: false };
    try {
        const r = await fetch(`${API_BASE_URL}/logs`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user: currentUser.name, email: currentUser.email, role: currentUser.role, action })
        });
        return await r.json();
    } catch (e) { return { success: false }; }
}

async function apiCreateTask(taskData) {
    try {
        const r = await fetch(`${API_BASE_URL}/tasks`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(taskData)
        });
        return await r.json();
    } catch (e) { return { success: false }; }
}

async function apiUpdateTask(id, taskData) {
    try {
        const r = await fetch(`${API_BASE_URL}/tasks/${id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(taskData)
        });
        return await r.json();
    } catch (e) { return { success: false }; }
}

async function apiDeleteTask(id) {
    try {
        const r = await fetch(`${API_BASE_URL}/tasks/${id}`, { method: 'DELETE' });
        return await r.json();
    } catch (e) { return { success: false }; }
}

// --- 3. TODOS API ---

async function apiGetTodos(taskId) {
    try {
        const r = await fetch(`${API_BASE_URL}/tasks/${taskId}/todos?t=${Date.now()}`);
        return await r.json();
    } catch (e) { return { success: false, data: [] }; }
}

async function apiCreateTodo(taskId, label) {
    try {
        const r = await fetch(`${API_BASE_URL}/tasks/${taskId}/todos`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ label })
        });
        return await r.json();
    } catch (e) { return { success: false }; }
}

async function apiToggleTodo(todoId, is_done) {
    try {
        const r = await fetch(`${API_BASE_URL}/todos/${todoId}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_done })
        });
        return await r.json();
    } catch (e) { return { success: false }; }
}

async function apiDeleteTodo(todoId) {
    try {
        const r = await fetch(`${API_BASE_URL}/todos/${todoId}`, { method: 'DELETE' });
        return await r.json();
    } catch (e) { return { success: false }; }
}

// --- 4. COMMENTS API ---

async function apiGetComments(taskId) {
    try {
        const r = await fetch(`${API_BASE_URL}/tasks/${taskId}/comments?t=${Date.now()}`);
        return await r.json();
    } catch (e) { return { success: false, data: [] }; }
}

async function apiCreateComment(taskId, content) {
    try {
        const r = await fetch(`${API_BASE_URL}/tasks/${taskId}/comments`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                author_name: currentUser.name, 
                author_email: currentUser.email,
                author_role: currentUser.role, 
                content 
            })
        });
        return await r.json();
    } catch (e) { return { success: false }; }
}

// --- 5. UTILITIES ---

function refreshIcons() { if (window.lucide) window.lucide.createIcons(); }

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
    if (activeBtn) activeBtn.classList.add('active');
    if (viewId === 'bitacora-view') renderLogs();
    if (viewId === 'user-mgmt-view') renderUsersList();
    if (viewId === 'board-view') renderBoard();
    if (viewId === 'archive-view') renderArchive();
    refreshIcons();
}

// --- 7. AUTHENTICATION ---

async function initAuth() {
    const loginForm = document.getElementById('data-login-form');
    const loginScreen = document.getElementById('login-screen');
    const mainApp = document.getElementById('main-app');
    const errorMsg = document.getElementById('login-error');
    refreshIcons();

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const pass = document.getElementById('login-pass').value;
        const result = await apiLogin(email, pass);
        if (result.success) {
            currentUser = result.user;
            await apiSaveLog('Inicio de sesión exitoso');
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
        apiSaveLog('Cierre de sesión');
        location.reload();
    });
}

function applyRBAC() {
    const role = currentUser.role;
    const body = document.body;
    document.getElementById('nav-bitacora').classList.toggle('hidden', role !== 'GOD');
    document.getElementById('nav-users').classList.toggle('hidden', role === 'USER');
    document.getElementById('clear-archive')?.classList.toggle('hidden', role === 'USER');
    if (role === 'GOD') {
        body.classList.add('status-god');
        document.getElementById('app-title-display').innerHTML = '<i data-lucide="crown"></i> MODO OMNISCIENTE';
    } else {
        body.classList.remove('status-god');
        document.getElementById('app-title-display').innerText = `Bienvenido a DGIIT, ${currentUser.name}`;
    }
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
                <td>${l.created_at || l.time}</td>
                <td><strong>${l.user_name || l.user}</strong></td>
                <td><span class="role-badge">${l.role}</span></td>
                <td>${l.action}</td>
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
        list.innerHTML = visible.map(u => `
            <li class="user-item">
                <div class="u-info">
                    <strong>${u.name}</strong>
                    <small>${u.email}</small>
                    <div class="u-meta"><span>${u.position || 'Sin cargo'}</span> | <span>${u.department || 'Sin dept'}</span></div>
                </div>
                <div class="u-actions">
                    <span class="role-badge">${u.role}</span>
                    <button type="button" onclick="event.stopPropagation(); editUser('${u.email}')" title="Editar"><i data-lucide="edit-2"></i></button>
                    <button type="button" onclick="event.stopPropagation(); deleteUser('${u.id}')" title="Eliminar"><i data-lucide="trash-2"></i></button>
                </div>
            </li>
        `).join('');
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
                <div class="assignee-box"><i data-lucide="user"></i> ${task.assignee || 'Sin asignar'}</div>
            </div>
            <h4>${task.title}</h4>
            <p>${task.description || ''}</p>

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
        const stackId = stackEl.id.split('-')[1].toUpperCase();
        col.querySelector('.count').innerText = tasksCache.filter(t => t.status === stackId).length;
    });

    refreshIcons();
}

// --- 9. TASK MODAL ---

window.openTaskModal = async (id = null, status = 'TODO') => {
    currentTaskId = id;
    const modal = document.getElementById('task-modal');
    
    // Switch to Tab 1
    switchModalTab('tab-info');

    // Populate assignees
    const usersResult = await apiGetUsers();
    if (usersResult.success) {
        document.getElementById('task-assignee').innerHTML = usersResult.data
            .filter(u => u.role !== 'GOD')
            .map(u => `<option value="${u.name}">${u.name} (${u.position || 'Sin cargo'})</option>`)
            .join('');
    }

    if (id) {
        const task = tasksCache.find(t => t.id === id);
        document.getElementById('modal-task-title').innerText = 'Editar Ficha';
        document.getElementById('task-id').value = task.id;
        document.getElementById('task-title').value = task.title;
        document.getElementById('task-desc').value = task.description || '';
        document.getElementById('task-assignee').value = task.assignee || '';

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

        // Load todos and comments in background
        loadTodosInModal(id);
        loadProgressTab(id, task);

        // Show tabs content areas (not empty msgs)
        document.getElementById('todos-new-task-msg').classList.add('hidden');
        document.getElementById('todos-content').classList.remove('hidden');
        document.getElementById('progress-new-task-msg').classList.add('hidden');
        document.getElementById('progress-content').classList.remove('hidden');

    } else {
        document.getElementById('modal-task-title').innerText = 'Nueva Ficha de Proyecto';
        document.getElementById('task-form').reset();
        document.getElementById('task-id').value = '';
        document.getElementById('task-status').value = status;
        document.getElementById('task-assignee').value = currentUser.name;
        if (window.fpDate) window.fpDate.clear();
        if (window.fpTime) window.fpTime.clear();

        // Hide content, show hints for new tasks
        document.getElementById('todos-new-task-msg').classList.remove('hidden');
        document.getElementById('todos-content').classList.add('hidden');
        document.getElementById('progress-new-task-msg').classList.remove('hidden');
        document.getElementById('progress-content').classList.add('hidden');
    }

    // Role-based Input Lock (Usuarios Estándar no pueden modificar datos base de fichas creadas)
    const isLockedForUser = (id && currentUser.role === 'USER');
    document.getElementById('task-title').disabled = isLockedForUser;
    document.getElementById('task-desc').disabled = isLockedForUser;
    document.getElementById('task-assignee').disabled = isLockedForUser;
    
    // Flatpickr instances need to act according to disabled state
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

// Load todos into modal Tab 2
async function loadTodosInModal(taskId) {
    const container = document.getElementById('todo-list-container');
    container.innerHTML = '<p class="loading-msg">Cargando etapas...</p>';
    const result = await apiGetTodos(taskId);
    renderTodos(result.success ? result.data : []);
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
                <span class="todo-label-text">${todo.label}</span>
            </label>
            <button class="btn-todo-delete" onclick="handleTodoDelete(${todo.id})">
                <i data-lucide="trash-2"></i>
            </button>
        </div>
    `).join('');
    refreshIcons();
}

window.handleTodoToggle = async (todoId, isDone) => {
    await apiToggleTodo(todoId, isDone);
    await loadTodosInModal(currentTaskId);
    // Update board counts without full reload
    renderBoard();
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
                    <span class="comment-role-badge ${roleClass}">${c.author_role}</span>
                    <strong class="comment-author">${c.author_name}</strong>
                    <span class="comment-date">${dateStr}</span>
                </div>
                <p class="comment-body">${c.content}</p>
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
    const id = document.getElementById('task-id').value;

    const dateVal = document.getElementById('task-deadline-date').value;
    const timeVal = document.getElementById('task-deadline-time').value;
    const deadlineVal = (dateVal && timeVal) ? `${dateVal} ${timeVal}` : '';

    const taskData = {
        title: document.getElementById('task-title').value,
        description: document.getElementById('task-desc').value,
        assignee: document.getElementById('task-assignee').value,
        deadline: deadlineVal,
        priority: document.getElementById('task-priority').value,
        status: document.getElementById('task-status').value,
        progress: id ? (tasksCache.find(t => t.id == id)?.progress || 0) : 0,
        author_email: currentUser?.email
    };

    if (id) {
        const result = await apiUpdateTask(id, taskData);
        if (result.success) {
            currentTaskId = parseInt(id);
            // Enable todos/comments tabs after save
            document.getElementById('todos-new-task-msg').classList.add('hidden');
            document.getElementById('todos-content').classList.remove('hidden');
            document.getElementById('progress-new-task-msg').classList.add('hidden');
            document.getElementById('progress-content').classList.remove('hidden');
            // Reload progress tab with updated task data
            const updatedTask = { ...taskData, progress: result.progress ?? taskData.progress };
            loadProgressTab(currentTaskId, updatedTask);
        }
        await apiSaveLog(`Actualizó ficha: "${taskData.title}"`);
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
            loadTodosInModal(result.id);
            loadProgressTab(result.id, { progress: 0, status: taskData.status });
        }
        await apiSaveLog(`Creó ficha: "${taskData.title}" para ${taskData.assignee}`);
    }

    renderBoard();
    closeTaskModal();
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
        await apiSaveLog(`Actualizó progreso de "${task.title}" a ${finalPct}%`);
        renderBoard();
    }
});

// Add todo
document.getElementById('btn-add-todo').addEventListener('click', async () => {
    const input = document.getElementById('new-todo-input');
    const label = input.value.trim();
    if (!label || !currentTaskId) return;
    const result = await apiCreateTodo(currentTaskId, label);
    if (result.success) {
        input.value = '';
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
        let deadlineDate = new Date(task.deadline || Date.now());
        if (isNaN(deadlineDate)) deadlineDate = new Date();
        const card = document.createElement('div');
        card.className = 'task-card';
        card.innerHTML = `
            <div class="task-badge-row">
                <span class="priority-tag priority-${task.priority || 'MEDIA'}">${task.priority || 'MEDIA'}</span>
                <div class="assignee-box"><i data-lucide="user"></i> ${task.assignee || 'Sin asignar'}</div>
            </div>
            <h4>${task.title}</h4>
            <p>${task.description || ''}</p>
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
        await fetch(`${API_BASE_URL}/users/${user.id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...user, password: newPass })
        });
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
            const response = await fetch(`${API_BASE_URL}/users/${id}`, { 
                method: 'DELETE',
                headers: { 'Cache-Control': 'no-cache' }
            });
            const result = await response.json();
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
    await fetch(`${API_BASE_URL}/users`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
    });
    await apiSaveLog(`Creó usuario: ${newUser.name}`);
    renderUsersList();
    e.target.reset();
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
            l.style.transform = `translate3d(${tx*d*800}px, ${ty*d*800}px, 0)`;
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

// INIT
document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    initParallax();
    initClock();
    initPickers();
    initSortable();
});
