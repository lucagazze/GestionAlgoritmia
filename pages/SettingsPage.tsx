
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/db';
import { Card, CardContent, CardHeader, CardTitle, Input, Button, Label } from '../components/UIComponents';
import { ShieldCheck, Key, Loader2, Save, CheckCircle, AlertTriangle, Database, Copy, Sparkles, Workflow, CalendarCheck } from 'lucide-react';

export default function SettingsPage() {
    const navigate = useNavigate();
    const [apiKey, setApiKey] = useState('');
    const [oauthClientId, setOauthClientId] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            setLoading(true);
            const key = await db.settings.getApiKey('google_api_key');
            if (key) setApiKey(key);
            
            const clientId = await db.settings.getApiKey('google_oauth_client_id');
            if (clientId) setOauthClientId(clientId);
        } catch (e) {
            console.error("Error loading settings", e);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            if (apiKey.trim()) await db.settings.setApiKey(apiKey.trim(), 'google_api_key');
            if (oauthClientId.trim()) await db.settings.setApiKey(oauthClientId.trim(), 'google_oauth_client_id');
            
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        } catch (e) {
            console.error("Error saving settings", e);
            alert("Error guardando claves.");
        } finally {
            setSaving(false);
        }
    };

    const sqlScript = `
-- ==========================================
-- 1. ESTRUCTURA DE TABLAS (SI NO EXISTEN)
-- ==========================================

create table if not exists "SOP" (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  category text not null,
  content text,
  "updatedAt" timestamp with time zone default now()
);

create table if not exists "ClientNote" (
  id uuid default gen_random_uuid() primary key,
  "clientId" uuid references "Client"(id) on delete cascade,
  content text not null,
  type text not null, 
  "createdAt" timestamp with time zone default now()
);

create table if not exists "Automation" (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  "triggerType" text not null, 
  "triggerValue" text,
  conditions jsonb default '[]'::jsonb,
  actions jsonb default '[]'::jsonb,
  "isActive" boolean default true
);

create table if not exists "Deliverable" (
  id uuid default gen_random_uuid() primary key,
  "projectId" uuid references "Client"(id) on delete cascade,
  name text not null,
  url text,
  status text default 'PENDING',
  feedback text,
  "createdAt" timestamp with time zone default now()
);

create table if not exists "PortalMessage" (
  id uuid default gen_random_uuid() primary key,
  "projectId" uuid references "Client"(id) on delete cascade,
  sender text not null, 
  content text not null,
  "readAt" timestamp with time zone,
  "createdAt" timestamp with time zone default now()
);

-- ==========================================
-- 2. ACTUALIZACIÓN DE COLUMNAS FALTANTES
-- ==========================================

alter table "Client" add column if not exists phone text;
alter table "Client" add column if not exists "outsourcingCost" numeric default 0;
alter table "Client" add column if not exists "assignedPartnerId" uuid references "Contractor"(id);
alter table "Client" add column if not exists "proposalUrl" text;
alter table "Client" add column if not exists "healthScore" text default 'GOOD';
alter table "Client" add column if not exists "lastPaymentDate" timestamp with time zone;
alter table "Client" add column if not exists "lastContactDate" timestamp with time zone;
alter table "Client" add column if not exists resources jsonb default '[]'::jsonb;
alter table "Client" add column if not exists contacts jsonb default '[]'::jsonb;
alter table "Client" add column if not exists "brandColors" text[];
alter table "Client" add column if not exists "brandFonts" text[];
alter table "Client" add column if not exists "internalCost" numeric default 0;
alter table "Client" add column if not exists "publicToken" text;
alter table "Client" add column if not exists progress integer default 0;
alter table "Client" add column if not exists "growthStrategy" text;

alter table "Contractor" add column if not exists phone text;
alter table "Task" add column if not exists "sopId" uuid references "SOP"(id);
alter table "Task" add column if not exists "googleEventId" text; -- Nueva columna para Google Sync
alter table "AgencySettings" add column if not exists key text unique;

-- ==========================================
-- 3. PERMISOS TOTALES (SOLUCIÓN "NO PUEDO BORRAR")
-- ==========================================

-- Habilitar RLS en todas las tablas para poder aplicar políticas
alter table "Task" enable row level security;
alter table "Client" enable row level security;
alter table "Contractor" enable row level security;
alter table "Service" enable row level security;
alter table "Proposal" enable row level security;
alter table "ProposalItem" enable row level security;
alter table "ClientNote" enable row level security;
alter table "SOP" enable row level security;
alter table "Automation" enable row level security;
alter table "AgencySettings" enable row level security;
alter table "Deliverable" enable row level security;
alter table "PortalMessage" enable row level security;
alter table "aichatlog" enable row level security;
alter table "aichatsession" enable row level security;

-- Eliminar políticas antiguas para evitar conflictos
drop policy if exists "Public Access" on "Task";
drop policy if exists "Public Access" on "Client";
-- (Repetir para asegurar limpieza)

-- CREAR POLÍTICAS DE ACCESO TOTAL (ANON & AUTHENTICATED)
create policy "Enable all for Task" on "Task" for all using (true) with check (true);
create policy "Enable all for Client" on "Client" for all using (true) with check (true);
create policy "Enable all for Contractor" on "Contractor" for all using (true) with check (true);
create policy "Enable all for Service" on "Service" for all using (true) with check (true);
create policy "Enable all for Proposal" on "Proposal" for all using (true) with check (true);
create policy "Enable all for ProposalItem" on "ProposalItem" for all using (true) with check (true);
create policy "Enable all for ClientNote" on "ClientNote" for all using (true) with check (true);
create policy "Enable all for SOP" on "SOP" for all using (true) with check (true);
create policy "Enable all for Automation" on "Automation" for all using (true) with check (true);
create policy "Enable all for AgencySettings" on "AgencySettings" for all using (true) with check (true);
create policy "Enable all for Deliverable" on "Deliverable" for all using (true) with check (true);
create policy "Enable all for PortalMessage" on "PortalMessage" for all using (true) with check (true);
create policy "Enable all for ChatLog" on "aichatlog" for all using (true) with check (true);
create policy "Enable all for ChatSession" on "aichatsession" for all using (true) with check (true);
    `.trim();

    return (
        <div className="space-y-6 animate-in fade-in duration-500 max-w-4xl mx-auto pb-20">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Ajustes del Sistema</h1>
                <p className="text-gray-500 dark:text-gray-400 mt-2">Configura las conexiones externas y la base de datos.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 {/* Google API Key (GEMINI) */}
                <Card className="border-indigo-100 dark:border-indigo-900/50 shadow-lg shadow-indigo-500/5 overflow-visible">
                    <CardHeader className="bg-gradient-to-r from-indigo-50 to-white dark:from-slate-800 dark:to-slate-900 border-b border-indigo-100 dark:border-slate-800">
                        <CardTitle className="flex items-center gap-2 text-indigo-900 dark:text-indigo-200">
                            <Key className="w-5 h-5 text-indigo-600" /> Inteligencia Artificial (Gemini)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6 pt-6">
                        <div className="space-y-3">
                            <Label>Google Gemini API Key</Label>
                            <Input 
                                type="password" 
                                value={apiKey} 
                                onChange={(e) => setApiKey(e.target.value)} 
                                placeholder="AIzaSy..." 
                                className="font-mono text-sm"
                            />
                            <p className="text-xs text-gray-400">Usado para el Copiloto de Ventas y el Asistente.</p>
                        </div>
                    </CardContent>
                </Card>

                {/* Google OAuth (CALENDAR) */}
                <Card className="border-blue-100 dark:border-blue-900/50 shadow-lg shadow-blue-500/5">
                    <CardHeader className="bg-gradient-to-r from-blue-50 to-white dark:from-slate-800 dark:to-slate-900 border-b border-blue-100 dark:border-slate-800">
                        <CardTitle className="flex items-center gap-2 text-blue-900 dark:text-blue-200">
                            <CalendarCheck className="w-5 h-5 text-blue-600" /> Google Calendar API
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6 pt-6">
                        <div className="space-y-3">
                            <Label>OAuth Client ID (Web)</Label>
                            <Input 
                                type="text" 
                                value={oauthClientId} 
                                onChange={(e) => setOauthClientId(e.target.value)} 
                                placeholder="123...apps.googleusercontent.com" 
                                className="font-mono text-sm"
                            />
                            <p className="text-xs text-gray-400">
                                Requerido para sincronizar tareas con el calendario. <br/>
                                <a href="https://console.cloud.google.com/apis/credentials" target="_blank" className="underline text-blue-500">Obtener en Google Cloud Console</a>
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="flex justify-end">
                <Button onClick={handleSave} disabled={saving || loading} className="min-w-[150px] shadow-xl">
                    {saving ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : success ? <CheckCircle className="w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    {success ? "Configuración Guardada" : "Guardar Todo"}
                </Button>
            </div>

            <Card className="border-red-100 dark:border-red-900/30">
                 <CardHeader className="bg-red-50/50 dark:bg-red-900/10 border-b border-red-100 dark:border-red-900/30">
                    <CardTitle className="flex items-center gap-2 text-red-800 dark:text-red-200">
                        <Database className="w-5 h-5 text-red-600" /> REPARACIÓN DE BASE DE DATOS
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="text-sm text-gray-600 dark:text-gray-300 space-y-4">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0 animate-pulse" />
                            <div>
                                <p className="font-bold text-red-700 dark:text-red-400">¿No puedes crear o borrar tareas?</p>
                                <p className="mt-1">
                                    Esto es un problema de <strong>Permisos (RLS)</strong> en Supabase. 
                                    Copia el siguiente script y ejecútalo en el <strong>SQL Editor</strong> de Supabase para desbloquear todo.
                                </p>
                            </div>
                        </div>
                        
                        <div className="relative group">
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button size="sm" variant="secondary" onClick={() => {navigator.clipboard.writeText(sqlScript); alert("Script copiado! Pégalo en Supabase SQL Editor.")}}>
                                    <Copy className="w-3 h-3 mr-2" /> Copiar SQL
                                </Button>
                            </div>
                            <div className="bg-gray-900 text-gray-300 p-4 rounded-xl font-mono text-[10px] md:text-xs overflow-x-auto leading-relaxed border border-gray-700 h-64 custom-scrollbar">
                                <pre>{sqlScript}</pre>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
