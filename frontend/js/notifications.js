/**
 * DGIIT | SECTURI — Mobile Push Notifications Logic
 */

const VAPID_PUBLIC_KEY = 'BEW2llNTHlPwc9etYCmPQYYBGUxlN6taHXEy2qNPgk1ko4GJatO9FEO2coXy4dVhIyU3A4nfkLdS8n8mADHQECM';

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
    const btn = document.getElementById('btn-toggle-push');
    const msg = document.getElementById('push-status-msg');
    if (!btn || !msg) return;

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        btn.style.display = 'none';
        msg.innerText = 'Tu navegador no soporta notificaciones push.';
        return;
    }

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

// Escuchar eventos si el botón existe
document.addEventListener('click', e => {
    if (e.target && e.target.id === 'btn-toggle-push') {
        handlePushButtonClick();
    }
});
