
import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { Card, CardContent, CardHeader, CardTitle, Input, Button, Label } from '../components/UIComponents';
import { ShieldCheck, Key, Loader2, Save, CheckCircle, AlertTriangle } from 'lucide-react';

export default function SettingsPage() {
    const [apiKey, setApiKey] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            setLoading(true);
            const key = await db.settings.getApiKey();
            if (key) setApiKey(key);
        } catch (e) {
            console.error("Error loading settings", e);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!apiKey.trim()) return;
        setSaving(true);
        try {
            await db.settings.setApiKey(apiKey.trim());
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        } catch (e) {
            console.error("Error saving settings", e);
            alert("Error guardando la clave. Verifica que la tabla 'AgencySettings' exista en Supabase.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 max-w-3xl mx-auto pb-20">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-gray-900">Ajustes del Sistema</h1>
                <p className="text-gray-500 mt-2">Configura las conexiones externas y credenciales de tu Algoritmia OS.</p>
            </div>

            <Card className="border-indigo-100 shadow-lg shadow-indigo-500/5 overflow-visible">
                <CardHeader className="bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
                    <CardTitle className="flex items-center gap-2 text-indigo-900">
                        <Key className="w-5 h-5 text-indigo-600" /> API Keys & IA
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3 text-sm text-blue-800">
                        <ShieldCheck className="w-5 h-5 flex-shrink-0 text-blue-600 mt-0.5" />
                        <div>
                            <p className="font-bold">Conexión Segura</p>
                            <p className="opacity-90 mt-1">
                                Estamos utilizando <strong>OpenAI (GPT-4o-mini)</strong>. Tu clave de API se guarda en tu base de datos privada o se usa la configurada por defecto.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <Label>OpenAI API Key</Label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Input 
                                    type="password" 
                                    value={apiKey} 
                                    onChange={(e) => setApiKey(e.target.value)} 
                                    placeholder="sk-..." 
                                    className="pr-10 font-mono text-sm"
                                />
                                {loading && (
                                    <div className="absolute right-3 top-3">
                                        <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                                    </div>
                                )}
                            </div>
                            <Button onClick={handleSave} disabled={saving || loading} className="min-w-[120px]">
                                {saving ? <Loader2 className="animate-spin w-4 h-4" /> : success ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Save className="w-4 h-4 mr-2" />}
                                {success ? "Guardado" : "Guardar"}
                            </Button>
                        </div>
                        <p className="text-xs text-gray-400 pl-1">
                           Actualmente hay una clave hardcodeada activa, pero si escribes una aquí, el sistema usará esta.
                        </p>
                    </div>
                </CardContent>
            </Card>

            <Card>
                 <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-gray-700">
                        <AlertTriangle className="w-5 h-5" /> Base de Datos
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-sm text-gray-600 space-y-2">
                        <p>Si tienes errores al guardar, asegúrate de correr este SQL en tu Supabase:</p>
                        <div className="bg-gray-900 text-gray-300 p-4 rounded-xl font-mono text-xs overflow-x-auto selection:bg-indigo-500 selection:text-white">
                            create table if not exists "AgencySettings" (<br/>
                            &nbsp;&nbsp;id uuid default gen_random_uuid() primary key,<br/>
                            &nbsp;&nbsp;key text unique not null,<br/>
                            &nbsp;&nbsp;value text<br/>
                            );
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
