import React from 'react';

export default function TermsPage() {
    return (
        <div className="max-w-3xl mx-auto py-12 px-4">
            <h1 className="text-3xl font-bold mb-6">Condiciones del Servicio</h1>
            <p className="text-gray-500 mb-8">Última actualización: {new Date().toLocaleDateString()}</p>
            
            <div className="space-y-6 text-gray-700 dark:text-gray-300">
                <section>
                    <h2 className="text-xl font-semibold mb-2">1. Aceptación de los términos</h2>
                    <p>Al acceder y utilizar Algoritmia OS, usted acepta estar sujeto a estos Términos y Condiciones. Si no está de acuerdo con alguna parte de estos términos, no podrá acceder al servicio.</p>
                </section>

                <section>
                    <h2 className="text-xl font-semibold mb-2">2. Cuentas</h2>
                    <p>Cuando crea una cuenta con nosotros, debe proporcionarnos información precisa, completa y actual en todo momento. El incumplimiento de esto constituye una violación de los términos, lo que puede resultar en la terminación inmediata de su cuenta en nuestro servicio.</p>
                </section>

                <section>
                    <h2 className="text-xl font-semibold mb-2">3. Propiedad Intelectual</h2>
                    <p>El Servicio y su contenido original, características y funcionalidad son y seguirán siendo propiedad exclusiva de Algoritmia y sus licenciantes.</p>
                </section>

                <section>
                    <h2 className="text-xl font-semibold mb-2">4. Enlaces a otros sitios web</h2>
                    <p>Nuestro servicio puede contener enlaces a sitios web o servicios de terceros (como Google) que no son propiedad ni están controlados por Algoritmia.</p>
                </section>

                <section>
                    <h2 className="text-xl font-semibold mb-2">5. Terminación</h2>
                    <p>Podemos cancelar o suspender su cuenta inmediatamente, sin previo aviso ni responsabilidad, por cualquier motivo, incluso si viola los Términos.</p>
                </section>
            </div>
        </div>
    );
}
