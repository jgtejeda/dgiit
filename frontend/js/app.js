/**
 * SGC PRO | Master Logic Engine
 * Role-Based Access Control, Activity Tracking, and Project Management
 */

// --- 1. INITIAL STATE & CONSTANTS ---
const DEFAULT_USERS = [
    { email: 'god@sgc.pro', pass: 'god123', name: 'Omnisciente', role: 'GOD', pos: 'Super Usuario', dept: 'Sistema' },
    { email: 'emartinezes@guanajuato.gob.mx', pass: 'guanajuato123', name: 'Elizabeth Martínez Escobar', role: 'ADMIN', pos: 'Enlace Administrativo/a', dept: 'Dirección General de Innovación e Inteligencia Turística' },
    { email: 'admin1@sgc.pro', pass: 'admin123', name: 'Admin Primario', role: 'ADMIN', pos: 'Administrador', dept: 'Operaciones' },
    { email: 'user@sgc.pro', pass: 'user123', name: 'Operativo Estándar', role: 'USER', pos: 'Operativo', dept: 'Tierra' }
];

const DEFAULT_TASKS = [
    { id: 1, title: 'Análisis de Capas PNG', desc: 'Optimizar motor blending CSS para mejorar profundidad visual.', status: 'TODO', assignee: 'Omnisciente', deadline: '2026-04-10T12:00', priority: 'ALTA' },
    { id: 2, title: 'Motor Parallax 3D', desc: 'Implementar inercia y multiplicadores de capa avanzados.', status: 'PROGRESS', assignee: 'Elizabeth Martínez Escobar', deadline: '2026-04-09T18:00', priority: 'CRÍTICA' }
];

// Memory initialization with Sync forced
let users = JSON.parse(localStorage.getItem('sgc_users')) || DEFAULT_USERS;
DEFAULT_USERS.forEach(du => { if (!users.find(u => u.email === du.email)) users.push(du); });

let logs = JSON.parse(localStorage.getItem('sgc_logs')) || [];
let tasks = JSON.parse(localStorage.getItem('sgc_tasks')) || DEFAULT_TASKS;
let currentUser = null;

function saveState() {
    localStorage.setItem('sgc_users', JSON.stringify(users));
    localStorage.setItem('sgc_logs', JSON.stringify(logs));
    localStorage.setItem('sgc_tasks', JSON.stringify(tasks));
}

// --- 2. CORE UTILITIES ---
function saveLog(action) {
    if (!currentUser) return;
    const log = {
        time: new Date().toLocaleString('es-ES'),
        user: currentUser.name,
        email: currentUser.email,
        role: currentUser.role,
        action: action
    };
    logs.unshift(log); 
    if (logs.length > 500) logs.pop();
    saveState();
}

function refreshIcons() {
    if (window.lucide) window.lucide.createIcons();
}

// --- 3. UI CONTROLLER ---
function switchView(viewId) {
    document.querySelectorAll('.view-section').forEach(s => s.classList.add('hidden'));
    const view = document.getElementById(viewId);
    if (view) view.classList.remove('hidden');
    
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    const activeBtn = document.querySelector(`[data-view="${viewId}"]`);
    if (activeBtn) activeBtn.classList.add('active');

    // View-specific trigger
    if (viewId === 'bitacora-view') renderLogs();
    if (viewId === 'user-mgmt-view') renderUsersList();
    if (viewId === 'board-view') renderBoard();
    if (viewId === 'archive-view') renderArchive();
    
    refreshIcons();
}

// --- 4. AUTHENTICATION ---
function initAuth() {
    const loginForm = document.getElementById('data-login-form');
    const loginScreen = document.getElementById('login-screen');
    const mainApp = document.getElementById('main-app');
    const errorMsg = document.getElementById('login-error');

    refreshIcons();

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const pass = document.getElementById('login-pass').value;
        const user = users.find(u => u.email === email && u.pass === pass);

        if (user) {
            currentUser = user;
            saveLog('Inicio de sesión exitoso');
            applyRBAC();
            loginScreen.classList.add('hidden');
            mainApp.classList.remove('hidden');
            switchView('board-view');
        } else {
            errorMsg.classList.remove('hidden');
        }
    });

    document.getElementById('nav-logout').addEventListener('click', () => {
        saveLog('Cierre de sesión');
        location.reload();
    });
}

function applyRBAC() {
    const role = currentUser.role;
    const body = document.body;
    
    document.getElementById('nav-bitacora').classList.toggle('hidden', role !== 'GOD');
    document.getElementById('nav-users').classList.toggle('hidden', role === 'USER');

    if (role === 'GOD') {
        body.classList.add('status-god');
        document.getElementById('app-title-display').innerHTML = '<i data-lucide="crown"></i> MODO OMNISCIENTE';
    } else {
        body.classList.remove('status-god');
        document.getElementById('app-title-display').innerText = 'PROYECTO: Hyper-Glass';
    }
    refreshIcons();
}

// --- 5. DATA RENDERERS ---

function renderLogs() {
    const tbody = document.getElementById('log-body');
    if (!tbody) return;
    tbody.innerHTML = logs.map(l => `
        <tr class="log-row-${l.role.toLowerCase()}">
            <td>${l.time}</td>
            <td><strong>${l.user}</strong></td>
            <td><span class="role-badge">${l.role}</span></td>
            <td>${l.action}</td>
        </tr>
    `).join('');
}

function renderUsersList() {
    const list = document.getElementById('user-list');
    if (!list) return;
    const visibleUsers = users.filter(u => currentUser.role === 'GOD' || u.role !== 'GOD');
    list.innerHTML = visibleUsers.map(u => `
        <li class="user-item">
            <div class="u-info">
                <strong>${u.name}</strong>
                <small>${u.email}</small>
                <div class="u-meta"><span>${u.pos || 'Sin cargo'}</span> | <span>${u.dept || 'Sin dept'}</span></div>
            </div>
            <div class="u-actions">
                <span class="role-badge">${u.role}</span>
                <button onclick="editUser('${u.email}')" title="Editar Contraseña/Info"><i data-lucide="edit-2"></i></button>
                <button onclick="deleteUser('${u.email}')" title="Eliminar Acceso"><i data-lucide="trash-2"></i></button>
            </div>
        </li>
    `).join('');
    refreshIcons();
}

function renderBoard() {
    const stacks = { TODO: document.getElementById('stack-todo'), PROGRESS: document.getElementById('stack-progress'), DONE: document.getElementById('stack-done') };
    Object.values(stacks).forEach(s => { if (s) s.innerHTML = ''; });

    tasks.forEach(task => {
        let deadlineDate = new Date(task.deadline || Date.now());
        if (isNaN(deadlineDate)) deadlineDate = new Date(); // Fallback to now
        
        const isOverdue = deadlineDate < new Date() && task.status !== 'DONE';
        const card = document.createElement('div');
        card.className = 'task-card';
        card.setAttribute('data-id', task.id);
        card.innerHTML = `
            <div class="task-badge-row">
                <span class="priority-tag priority-${task.priority || 'MEDIA'}">${task.priority || 'MEDIA'}</span>
                <div class="assignee-box"><i data-lucide="user"></i> ${task.assignee || 'Sin asignar'}</div>
            </div>
            <h4>${task.title}</h4>
            <p>${task.desc || ''}</p>
            <div class="deadline-box ${isOverdue ? 'overdue' : ''}">
                <i data-lucide="clock"></i> ${deadlineDate.toLocaleString('es-ES', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'})}
            </div>
            <div class="task-footer">
                <div class="card-controls">
                    ${task.status === 'DONE' ? `<button onclick="archiveTask(${task.id})" title="Archivar Ficha" class="btn-archive-task"><i data-lucide="archive"></i></button>` : ''}
                    <button onclick="openTaskModal(${task.id})" title="Editar Ficha"><i data-lucide="edit-3"></i></button>
                    <button onclick="deleteTask(${task.id})" title="Eliminar Permanente"><i data-lucide="trash-2"></i></button>
                </div>
            </div>
        `;
        stacks[task.status].appendChild(card);
    });
    
    // Update Counts
    document.querySelectorAll('.trello-column').forEach(col => {
        const stackId = col.querySelector('.task-stack').id.split('-')[1].toUpperCase();
        col.querySelector('.count').innerText = tasks.filter(t => t.status === (stackId === 'TODO' ? 'TODO' : stackId === 'PROGRESS' ? 'PROGRESS' : 'DONE')).length;
    });

    refreshIcons();
}

// --- 6. TASK MANAGEMENT (MODAL) ---

window.openTaskModal = (id = null, status = 'TODO') => {
    const modal = document.getElementById('task-modal');
    const assigneeSelect = document.getElementById('task-assignee');
    
    // Refresh Assignee list
    assigneeSelect.innerHTML = users.map(u => `<option value="${u.name}">${u.name} (${u.pos || 'Sin cargo'})</option>`).join('');
    
    if (id) {
        const task = tasks.find(t => t.id === id);
        document.getElementById('modal-task-title').innerText = 'Editar Ficha';
        document.getElementById('task-id').value = task.id;
        document.getElementById('task-title').value = task.title;
        document.getElementById('task-desc').value = task.desc;
        document.getElementById('task-assignee').value = task.assignee;
        
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
    } else {
        document.getElementById('modal-task-title').innerText = 'Nueva Ficha de Proyecto';
        document.getElementById('task-form').reset();
        document.getElementById('task-id').value = '';
        document.getElementById('task-status').value = status;
        document.getElementById('task-assignee').value = currentUser.name;
        if (window.fpDate) window.fpDate.clear();
        if (window.fpTime) window.fpTime.clear();
    }
    
    modal.classList.remove('hidden');
};

window.closeTaskModal = () => document.getElementById('task-modal').classList.add('hidden');

document.getElementById('task-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('task-id').value;
    
    const dateVal = document.getElementById('task-deadline-date').value;
    const timeVal = document.getElementById('task-deadline-time').value;
    const deadlineVal = (dateVal && timeVal) ? `${dateVal}T${timeVal}` : '';

    const taskData = {
        title: document.getElementById('task-title').value,
        desc: document.getElementById('task-desc').value,
        assignee: document.getElementById('task-assignee').value,
        deadline: deadlineVal,
        priority: document.getElementById('task-priority').value,
        status: document.getElementById('task-status').value
    };

    if (id) {
        const index = tasks.findIndex(t => t.id == id);
        tasks[index] = { ...tasks[index], ...taskData };
        saveLog(`Actualizó ficha: "${taskData.title}"`);
    } else {
        const newTask = { ...taskData, id: Date.now() };
        tasks.push(newTask);
        saveLog(`Creó ficha: "${taskData.title}" para ${taskData.assignee}`);
    }

    saveState();
    renderBoard();
    closeTaskModal();
});

// --- 7. GLOBAL ACTIONS & ARCHIVE ---

window.archiveTask = (id) => {
    const task = tasks.find(t => t.id === id);
    if(task) {
        task.status = 'ARCHIVED';
        saveLog(`Archivó ficha: "${task.title}"`);
        saveState();
        renderBoard();
        if(!document.getElementById('archive-view').classList.contains('hidden')) renderArchive();
    }
};

window.restoreTask = (id) => {
    const task = tasks.find(t => t.id === id);
    if(task) {
        task.status = 'DONE';
        saveLog(`Restauró ficha al tablero: "${task.title}"`);
        saveState();
        renderArchive();
        if(!document.getElementById('board-view').classList.contains('hidden')) renderBoard();
    }
};

function renderArchive() {
    const grid = document.getElementById('archive-grid-container');
    if (!grid) return;
    grid.innerHTML = '';
    const archivedTasks = tasks.filter(t => t.status === 'ARCHIVED');
    
    archivedTasks.forEach(task => {
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
            <p>${task.desc || ''}</p>
            <div class="deadline-box">
                <i data-lucide="clock"></i> Archivada (Original: ${deadlineDate.toLocaleString('es-ES', { day:'2-digit', month:'short'})})
            </div>
            <div class="task-footer">
                <div class="card-controls">
                    <button onclick="restoreTask(${task.id})" title="Restaurar al Tablero"><i data-lucide="refresh-cw"></i></button>
                    <button onclick="deleteTask(${task.id})" title="Eliminar Permanente"><i data-lucide="trash-2"></i></button>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
    refreshIcons();
}

window.deleteTask = (id) => {
    if (confirm('¿Eliminar esta ficha de forma permanente?')) {
        const task = tasks.find(t => t.id === id);
        tasks = tasks.filter(t => t.id !== id);
        saveLog(`Eliminó ficha permanentemente: "${task.title}"`);
        saveState();
        renderBoard();
        renderArchive();
    }
};

window.editUser = (email) => {
    const user = users.find(u => u.email === email);
    const newPass = prompt(`Cambiar contraseña para ${user.name}:`, user.pass);
    if (newPass) {
        user.pass = newPass;
        saveLog(`Cambió contraseña de usuario: ${user.email}`);
        saveState();
        renderUsersList();
    }
};

window.deleteUser = (email) => {
    if (email === currentUser.email) return alert('No puedes eliminarte a ti mismo.');
    if (confirm(`¿Eliminar acceso para ${email}?`)) {
        users = users.filter(u => u.email !== email);
        saveLog(`Eliminó usuario: ${email}`);
        saveState();
        renderUsersList();
    }
};

document.getElementById('user-create-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const newUser = {
        name: document.getElementById('new-user-name').value,
        email: document.getElementById('new-user-email').value,
        pass: document.getElementById('new-user-pass').value,
        pos: document.getElementById('new-user-pos').value,
        dept: document.getElementById('new-user-dept').value,
        role: document.getElementById('new-user-role').value
    };
    users.push(newUser);
    saveLog(`Creó usuario: ${newUser.name}`);
    saveState();
    renderUsersList();
    e.target.reset();
});

document.getElementById('clear-logs')?.addEventListener('click', () => { if (confirm('¿Vaciar bitácora?')) { logs = []; saveLog('LIMPIEZA DE BITÁCORA'); renderLogs(); } });

document.getElementById('clear-archive')?.addEventListener('click', () => { 
    if (confirm('¿Eliminar irreversiblemente todas las fichas archivadas?')) { 
        tasks = tasks.filter(t => t.status !== 'ARCHIVED');
        saveLog('VACIÓ REPOSITORIO DE ARCHIVOS');
        saveState();
        renderArchive();
    } 
});

// --- 8. PARALLAX & AUX ---
function initSortable() {
    if (typeof Sortable === 'undefined') return;
    const cols = ['todo', 'progress', 'done'];
    cols.forEach(col => {
        const el = document.getElementById(`stack-${col}`);
        if(el) {
            new Sortable(el, {
                group: 'shared',
                animation: 150,
                ghostClass: 'sortable-ghost',
                dragClass: 'sortable-drag',
                onEnd: function (evt) {
                    const itemEl = evt.item;
                    const taskId = itemEl.getAttribute('data-id');
                    const newStatus = evt.to.id.split('-')[1].toUpperCase();
                    
                    const task = tasks.find(t => t.id == taskId);
                    if (task && task.status !== newStatus) {
                        task.status = newStatus;
                        saveLog(`Arrastró ficha "${task.title}" a ${newStatus}`);
                        saveState();
                        renderBoard(); // Fully refresh the board logic
                    }
                }
            });
        }
    });
}
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
function initClock() { setInterval(() => { const clock = document.getElementById('clock'); if (clock) clock.innerText = new Date().toLocaleTimeString('es-ES'); }, 1000); }
document.querySelectorAll('.nav-btn').forEach(btn => btn.addEventListener('click', () => switchView(btn.getAttribute('data-view'))));
document.getElementById('close-modal')?.addEventListener('click', closeTaskModal);
document.querySelector('.btn-add-task-modal')?.addEventListener('click', () => openTaskModal());

// --- 9. FLATPICKR INIT ---
function initPickers() {
    if (typeof flatpickr !== 'undefined') {
        window.fpDate = flatpickr("#task-deadline-date", {
            locale: "es",
            dateFormat: "Y-m-d",
            altInput: true,
            altFormat: "F j, Y"
        });

        window.fpTime = flatpickr("#task-deadline-time", {
            enableTime: true,
            noCalendar: true,
            dateFormat: "H:i",
            time_24hr: false
        });
    }
}

// INIT
document.addEventListener('DOMContentLoaded', () => { initAuth(); initParallax(); initClock(); initPickers(); initSortable(); });
