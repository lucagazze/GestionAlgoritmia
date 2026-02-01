import React from 'react';

export default function PrivacyPage() {
    return (
        <div className="max-w-3xl mx-auto py-12 px-4">
            <h1 className="text-3xl font-bold mb-6">Política de Privacidad</h1>
            <p className="text-gray-500 mb-8">Última actualización: {new Date().toLocaleDateString()}</p>
            
            <div className="space-y-6 text-gray-700 dark:text-gray-300">
                <section>
                    <h2 className="text-xl font-semibold mb-2">1. Introducción</h2>
                    <p>Bienvenido a Algoritmia OS. Nos comprometemos a proteger su información personal y su derecho a la privacidad. Si tiene alguna pregunta o inquietud sobre nuestra política o nuestras prácticas con respecto a su información personal, contáctenos.</p>
                </section>

                <section>
                    <h2 className="text-xl font-semibold mb-2">2. Qué información recopilamos</h2>
                    <p>Recopilamos información personal que usted nos proporciona voluntariamente al registrarse en la aplicación, como su nombre, dirección de correo electrónico y credenciales de autenticación (a través de Google/Supabase).</p>
                </section>

                <section>
                    <h2 className="text-xl font-semibold mb-2">3. Cómo utilizamos su información</h2>
                    <p>Utilizamos su información para fines legítimos comerciales, el cumplimiento de nuestro contrato con usted, el cumplimiento de nuestras obligaciones legales y/o su consentimiento.</p>
                    <ul className="list-disc ml-5 mt-2">
                        <li>Para facilitar la creación de cuentas y el proceso de inicio de sesión.</li>
                        <li>Para enviarle información administrativa.</li>
                        <li>Para integrar con servicios de terceros (como Google Calendar) bajo su solicitud explícita.</li>
                    </ul>
                </section>

                <section>
                    <h2 className="text-xl font-semibold mb-2">4. Google Calendar Data</h2>
                    <p>Nuestra aplicación utiliza la API de Google Calendar para sincronizar sus tareas. El uso de la información recibida de las API de Google se adherirá a la Política de datos del usuario de los servicios de API de Google, incluidos los requisitos de uso limitado.</p>
                </section>
            </div>
        </div>
    );
}
