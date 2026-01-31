import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/UIComponents';
import { ShieldCheck } from 'lucide-react';

export default function SettingsPage() {
    return (
        <div className="space-y-6 animate-in fade-in duration-500 max-w-2xl mx-auto">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-gray-900">Ajustes</h1>
                <p className="text-gray-500 mt-2">Configuración general de tu Algoritmia OS.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5" /> Configuración
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="p-4 bg-gray-50 text-gray-800 rounded-xl text-sm border border-gray-100 flex gap-3 items-start">
                        <ShieldCheck className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="font-bold">Configuración de Entorno</p>
                            <p className="mt-1 opacity-90">
                                Las claves de API y configuraciones sensibles se manejan a través de variables de entorno del sistema para mayor seguridad.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}