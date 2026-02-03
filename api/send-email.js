import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  // Configuración de CORS para permitir peticiones desde tu propio dominio
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Credenciales DIRECTAS (Para tu prueba rápida)
  // OJO: Idealmente esto va en variables de entorno en Vercel
  const transporter = nodemailer.createTransport({
    host: 'smtp.hostinger.com',
    port: 465,
    secure: true,
    auth: {
      user: 'info@algoritmiadesarrollos.com.ar',
      pass: 'Qpzm123Qpzm-' 
    },
  });

  try {
    const { destEmail } = req.body || {};
    
    // Enviar el mail
    await transporter.sendMail({
      from: '"Algoritmia Bot" <info@algoritmiadesarrollos.com.ar>',
      to: destEmail || 'info@algoritmiadesarrollos.com.ar', // Por defecto se auto-envía
      subject: 'Prueba de Conexión SMTP desde Vercel',
      html: `
        <h3>¡Funciona! 🚀</h3>
        <p>Este es un correo enviado desde tu Landing Page usando el servidor de Hostinger.</p>
        <p>Datos de prueba:</p>
        <ul>
            <li>Fecha: ${new Date().toLocaleString()}</li>
            <li>Origen: LabPage Test</li>
        </ul>
      `,
    });

    return res.status(200).json({ success: true, message: 'Email enviado correctamente' });
  } catch (error) {
    console.error('Error SMTP:', error);
    return res.status(500).json({ error: error.message });
  }
}
