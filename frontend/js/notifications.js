/**
 * DGIIT | SECTURI — Mobile Push Notifications Logic
 */

const VAPID_PUBLIC_KEY = 'BKapufKs7-w4OaboX7a-UUsZjtBGjg3DdPV6RAlQPsz8tBWMvV9AtKft3Wc6NHaN_CT0nipZUIafhvmbez_enzg';

/**
 * Convierte llave VAPID a formato compatible con el navegador
 */
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

/**
 * Inicializa el estado de las notificaciones en la UI
 */
async function initPushNotificationUI() {
    console.log('🔔 Inicializando UI de Notificaciones...');
    const btn = document.getElementById('btn-toggle-push');
    const msg = document.getElementById('push-status-msg');
    if (!btn || !msg) return;

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        btn.style.display = 'none';
        msg.innerText = 'Tu navegador no soporta notificaciones push.';
        return;
    }

    try {
        // No bloquear la UI si el SW tarda en responder
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        
        if (subscription) {
            btn.innerText = 'DESACTIVAR';
            btn.style.background = 'rgba(255, 50, 50, 0.2)';
            btn.style.color = '#ff5555';
            msg.innerText = 'Notificaciones activas en este dispositivo ✅';
        } else {
            btn.innerText = 'ACTIVAR';
            btn.style.background = '';
            btn.style.color = '';
            msg.innerText = 'Las notificaciones están desactivadas.';
        }
    } catch (err) {
        console.warn('Error al verificar suscripción:', err);
    }
}

/**
 * Suscribe al usuario al servicio Push
 */
async function subscribeUser() {
    const registration = await navigator.serviceWorker.ready;
    const subscribeOptions = {
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    };

    try {
        const subscription = await registration.pushManager.subscribe(subscribeOptions);
        console.log('Push Subscription:', subscription);
        
        // Enviar al backend usando el cliente API existente
        const result = await apiClient.subscribePush(subscription);
        if (result.success) {
            alert('Notificaciones activadas con éxito ✅');
            initPushNotificationUI();
        } else {
            alert('Error al registrar dispositivo: ' + result.message);
        }
    } catch (e) {
        console.error('Error suscribiendo push:', e);
        alert('Error: Se requieren permisos de notificación o el navegador no es compatible.');
    }
}

/**
 * Desuscribe al usuario
 */
async function unsubscribeUser() {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
        await subscription.unsubscribe();
        alert('Notificaciones desactivadas en este dispositivo.');
        initPushNotificationUI();
    }
}

/**
 * Maneja el click en el botón de perfil
 */
async function handlePushButtonClick() {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
        await unsubscribeUser();
    } else {
        await subscribeUser();
    }
}

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    initPushNotificationUI();
});

// Escuchar eventos usando delegación para mayor robustez
document.addEventListener('click', e => {
    const pushBtn = e.target.closest('#btn-toggle-push');
    if (pushBtn) {
        console.log('🔔 Click detectado en botón push');
        handlePushButtonClick();
    }

    // Toggle Notifications Dropdown
    const notifToggle = e.target.closest('#notifications-toggle');
    const notifDropdown = document.getElementById('notifications-dropdown');
    
    if (notifToggle && notifDropdown) {
        if (notifDropdown.classList.contains('hidden') || notifDropdown.style.display === 'none') {
            notifDropdown.classList.remove('hidden');
            notifDropdown.style.display = 'flex';
        } else {
            notifDropdown.classList.add('hidden');
            notifDropdown.style.display = 'none';
        }
    } else if (notifDropdown && !e.target.closest('#notifications-dropdown')) {
        // Close if clicked outside
        notifDropdown.classList.add('hidden');
        notifDropdown.style.display = 'none';
    }

    // Mark all as read
    const markAllReadBtn = e.target.closest('#mark-all-read');
    if (markAllReadBtn) {
        markAllAsRead();
    }
});

// --- Dynamic Notifications Logic ---
const defaultNotifications = [
    { id: 1, title: 'Nueva actualización', desc: 'El sistema ha sido actualizado a la v2.1', time: 'Hace 5 min', icon: 'info', read: false, type: 'info' },
    { id: 2, title: 'Alerta de tarea', desc: 'Una tarea está por vencer mañana.', time: 'Hace 2 hrs', icon: 'alert-triangle', read: false, type: 'warning' },
    { id: 3, title: 'Tarea completada', desc: 'Juan finalizó "Revisión mensual".', time: 'Ayer', icon: 'check-circle', read: true, type: 'success' }
];

function loadNotifications() {
    let stored = localStorage.getItem('dgiit_notifications');
    let notifs = stored ? JSON.parse(stored) : defaultNotifications;
    
    // Save defaults if empty
    if (!stored) {
        localStorage.setItem('dgiit_notifications', JSON.stringify(notifs));
    }

    const list = document.getElementById('notif-list');
    const badge = document.getElementById('notif-badge');
    if (!list) return;

    list.innerHTML = '';
    let unreadCount = 0;

    notifs.forEach(n => {
        if (!n.read) unreadCount++;
        
        let bg = 'rgba(255, 255, 255, 0.05)';
        let color = '#fff';
        let extraClass = n.read ? 'opacity: 0.6;' : '';
        let unreadClass = n.read ? '' : 'unread';

        if (!n.read) {
            if (n.type === 'info') {
                bg = 'rgba(0, 242, 255, 0.1)';
                color = 'var(--corp-light)';
            } else if (n.type === 'warning') {
                bg = 'rgba(255, 150, 0, 0.1)';
                color = '#ff9900';
            }
        }

        const html = `
            <div class="notif-item ${unreadClass}" style="padding: 12px 15px; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; gap: 12px; cursor: pointer; transition: background 0.2s; ${extraClass}">
                <div style="background: ${bg}; color: ${color}; width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                    <i data-lucide="${n.icon}" style="width: 16px;"></i>
                </div>
                <div style="flex: 1;">
                    <p style="margin: 0; font-size: 0.8rem; font-weight: 700;">${n.title}</p>
                    <p style="margin: 4px 0 0; font-size: 0.7rem; color: rgba(255,255,255,0.6);">${n.desc}</p>
                    <p style="margin: 4px 0 0; font-size: 0.65rem; color: rgba(255,255,255,0.4);">${n.time}</p>
                </div>
            </div>
        `;
        list.insertAdjacentHTML('beforeend', html);
    });

    if (badge) {
        if (unreadCount > 0) {
            badge.innerText = unreadCount;
            badge.style.opacity = '1';
        } else {
            badge.style.opacity = '0';
        }
    }

    if (window.lucide) {
        window.lucide.createIcons();
    }
}

function markAllAsRead() {
    let stored = localStorage.getItem('dgiit_notifications');
    let notifs = stored ? JSON.parse(stored) : defaultNotifications;
    notifs.forEach(n => n.read = true);
    localStorage.setItem('dgiit_notifications', JSON.stringify(notifs));
    loadNotifications();
}

// Inicializar al cargar el DOM
document.addEventListener('DOMContentLoaded', () => {
    loadNotifications();
});
