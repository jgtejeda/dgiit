/**
 * DGIIT | SECTURI — Centro de Notificaciones (UI & Logic)
 */

document.addEventListener('DOMContentLoaded', () => {
    initNotifCenter();
});

function initNotifCenter() {
    const btnCenter = document.getElementById('btn-notif-center');
    const dropdown  = document.getElementById('notif-dropdown');
    const btnMarkAll = document.getElementById('btn-mark-all-read');
    const badge     = document.getElementById('notif-badge');
    const notifList = document.getElementById('notif-list');

    if (!btnCenter || !dropdown) return;

    // Abrir/Cerrar Dropdown
    btnCenter.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = dropdown.classList.toggle('hidden');
        if (!isHidden) {
            fetchNotificationsUI();
        }
    });

    // Cerrar al hacer clic fuera
    document.addEventListener('click', (e) => {
        if (!dropdown.contains(e.target) && !btnCenter.contains(e.target)) {
            dropdown.classList.add('hidden');
        }
    });

    // Marcar todas como leídas
    btnMarkAll.addEventListener('click', async () => {
        try {
            await apiClient.markNotificationsAsRead();
            fetchNotificationsUI();
        } catch (e) {
            console.error('Error al marcar todas:', e);
        }
    });

    // Polling más rápido (cada 15 segundos) para respuesta inmediata en web
    setInterval(fetchNotificationsUI, 15000);
    
    // Carga inicial
    fetchNotificationsUI();
}

/**
 * Consulta las notificaciones y actualiza el contador/lista
 */
async function fetchNotificationsUI() {
    const badge     = document.getElementById('notif-badge');
    const notifList = document.getElementById('notif-list');
    
    try {
        const res = await apiClient.getNotifications();
        if (res.success) {
            // Verificar estado de Push para mostrar aviso si no está activo
            let isPushActive = false;
            if ('serviceWorker' in navigator && !!(await (await navigator.serviceWorker.ready).pushManager.getSubscription())) {
                isPushActive = true;
            }

            renderNotifList(res.notifications, isPushActive);
            
            // Actualizar Badge
            const unreadCount = res.notifications.filter(n => !n.is_read).length;
            if (unreadCount > 0) {
                badge.innerText = unreadCount > 9 ? '9+' : unreadCount;
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        }
    } catch (e) {
        console.warn('Error fetching notifications:', e);
    }
}

/**
 * Renderiza la lista de notificaciones en el dropdown
 */
function renderNotifList(list, isPushActive) {
    const notifList = document.getElementById('notif-list');
    
    let html = '';
    
    // Banner de activación si no está suscrito
    if (!isPushActive) {
        html += `
            <div class="notif-activation-banner" onclick="handlePushButtonClick()">
                <i data-lucide="bell-off"></i>
                <div>
                    <strong>Pulsar para activar alertas</strong>
                    <p>Recibe avisos en tu celular de inmediato</p>
                </div>
            </div>
        `;
    }

    if (!list.length) {
        html += '<div class="notif-empty">No tienes notificaciones pendientes</div>';
        notifList.innerHTML = html;
        if (window.lucide) lucide.createIcons();
        return;
    }

    html += list.map(n => {
        const timeStr = formatRelativeTime(new Date(n.created_at));
        const iconName = getIconForNotif(n.type);
        const unreadClass = n.is_read ? '' : 'unread';
        const dot = n.is_read ? '' : '<div class="unread-dot"></div>';

        return `
            <div class="notif-item ${unreadClass}" onclick="handleNotifClick(${n.id}, '${n.type}', ${n.link_id})">
                <div class="notif-icon">
                    <i data-lucide="${iconName}"></i>
                </div>
                <div class="notif-content">
                    <div class="notif-title">${n.title}</div>
                    <div class="notif-msg">${n.message}</div>
                    <span class="notif-time">${timeStr}</span>
                </div>
                ${dot}
            </div>
        `;
    }).join('');

    notifList.innerHTML = html;

    // Re-procesar iconos Lucide
    if (window.lucide) lucide.createIcons();
}

/**
 * Maneja el clic en una notificación específica
 */
async function handleNotifClick(id, type, linkId) {
    // 1. Marcar como leída en backend
    try {
        await apiClient.markNotificationsAsRead(id);
    } catch (e) { console.error(e); }

    // 2. Navegar según el tipo
    if (type === 'TASK' && linkId) {
        // Ir a tablero si no estamos ahí
        const tabBoard = document.getElementById('nav-board');
        if (tabBoard) tabBoard.click();
        
        // Abrir modal de la tarea despues de un breve delay para asegurar que el DOM cargó
        setTimeout(() => {
            if (window.openTaskModal) window.openTaskModal(linkId);
        }, 300);
    } else if (type === 'FOLIO') {
        const tabFolios = document.getElementById('nav-folios');
        if (tabFolios) tabFolios.click();
    }

    // 3. Cerrar dropdown y refrescar UI
    document.getElementById('notif-dropdown').classList.add('hidden');
    fetchNotificationsUI();
}

/**
 * Retorna icono según tipo de notificación
 */
function getIconForNotif(type) {
    switch (type) {
        case 'TASK': return 'clipboard-list';
        case 'FOLIO': return 'file-text';
        case 'SYSTEM': return 'info';
        case 'ALERT': return 'alert-triangle';
        default: return 'bell';
    }
}

/**
 * Formateador de tiempo relativo simple
 */
function formatRelativeTime(date) {
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    
    if (diff < 60) return 'hace un momento';
    if (diff < 3600) return `hace ${Math.floor(diff/60)}m`;
    if (diff < 86400) return `hace ${Math.floor(diff/3600)}h`;
    return date.toLocaleDateString();
}
