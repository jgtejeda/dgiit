/**
 * Utilidad para envío de Notificaciones Push usando Web-Push
 */
const webpush = require('web-push');

// Configurar VAPID Keys desde el .env
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
        process.env.WEB_PUSH_CONTACT || 'mailto:example@yourdomain.com',
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
    );
    console.log('🔔 Web-Push configurado correctamente.');
} else {
    console.warn('⚠️ Web-Push no configurado: Faltan llaves VAPID en .env');
}

/**
 * Envía una notificación a una suscripción específica
 * @param {Object} subscription - El objeto de suscripción del navegador
 * @param {Object} payload - Los datos de la notificación { title, body, data }
 */
async function sendPush(subscription, payload) {
    try {
        await webpush.sendNotification(subscription, JSON.stringify(payload));
        return { success: true };
    } catch (error) {
        console.error('❌ Error enviando Push:', error.endpoint, error.statusCode);
        // Si el endpoint ya no es válido (404 o 410), se debe eliminar de la DB
        if (error.statusCode === 404 || error.statusCode === 410) {
            return { success: false, expired: true };
        }
        return { success: false, error: error.message };
    }
}

module.exports = { sendPush };
