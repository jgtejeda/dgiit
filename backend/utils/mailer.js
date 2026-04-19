const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // true para 465, false para otros puertos
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

/**
 * Envía un correo electrónico profesional
 * @param {string} to - Destinatario
 * @param {string} subject - Asunto
 * @param {string} title - Título del mensaje (dentro del HTML)
 * @param {string} message - Cuerpo del mensaje
 * @param {string} actionLink - Opcional: Link para una acción (ej. ver tarea)
 */
async function sendEmail({ to, subject, title, message, actionLink = null }) {
    try {
        const html = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
            <div style="background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); padding: 25px; text-align: center; color: white;">
                <h1 style="margin: 0; font-size: 24px; letter-spacing: 1px;">SGC PRO</h1>
                <p style="margin: 5px 0 0; opacity: 0.8; font-size: 14px;">Aviso de Notificación Automática</p>
            </div>
            <div style="padding: 30px; background-color: #ffffff; color: #333333; line-height: 1.6;">
                <h2 style="color: #1e3a8a; margin-top: 0;">${title}</h2>
                <p style="font-size: 16px;">${message}</p>
                
                ${actionLink ? `
                <div style="text-align: center; margin-top: 30px;">
                    <a href="${actionLink}" style="background-color: #2563eb; color: white; padding: 12px 25px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Ver en el Sistema</a>
                </div>
                ` : ''}
            </div>
            <div style="background-color: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb;">
                <p style="margin: 0;">Este es un correo automático generado por Hyper-Glass Task Management.</p>
                <p style="margin: 5px 0 0;">© 2026 Secretaría de Turismo - Estado de Guanajuato</p>
            </div>
        </div>
        `;

        const info = await transporter.sendMail({
            from: `"SGC PRO Notifications" <${process.env.EMAIL_USER}>`,
            to,
            subject: `[SGC PRO] ${subject}`,
            html
        });

        console.log('📧 Correo enviado correctamente:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('❌ Error enviando correo:', error);
        return { success: false, error: error.message };
    }
}

module.exports = { sendEmail };
