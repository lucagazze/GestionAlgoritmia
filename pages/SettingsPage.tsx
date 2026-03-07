
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/db';
import { Card, CardContent, CardHeader, CardTitle, Input, Button, Label } from '../components/UIComponents';
import { ShieldCheck, Key, Loader2, Save, CheckCircle, AlertTriangle, Database, Copy, Sparkles, Workflow, CalendarCheck, Megaphone } from 'lucide-react';

export default function SettingsPage() {
    const navigate = useNavigate();
    const [apiKey, setApiKey] = useState('');
    const [claudeApiKey, setClaudeApiKey] = useState('');
    const [oauthClientId, setOauthClientId] = useState('');
    const [metaAdsToken, setMetaAdsToken] = useState('');
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

            const claudeKey = await db.settings.getApiKey('claude_api_key');
            if (claudeKey) setClaudeApiKey(claudeKey.slice(0, 10) + '••••••••••••••••••••••••');

            const clientId = await db.settings.getApiKey('google_oauth_client_id');
            if (clientId) setOauthClientId(clientId);

            const metaToken = await db.settings.getApiKey('meta_ads_token');
            if (metaToken) setMetaAdsToken(metaToken.slice(0, 12) + '••••••••••••••••••••••••');
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
            if (claudeApiKey.trim() && !claudeApiKey.includes('••')) await db.settings.setApiKey(claudeApiKey.trim(), 'claude_api_key');
            if (oauthClientId.trim()) await db.settings.setApiKey(oauthClientId.trim(), 'google_oauth_client_id');
            if (metaAdsToken.trim() && !metaAdsToken.includes('••')) {
                await db.settings.setApiKey(metaAdsToken.trim(), 'meta_ads_token');
                localStorage.setItem('meta_ads_token', metaAdsToken.trim()); // sync cache
            }

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
alter table "Client" add column if not exists currency text default 'ARS';

alter table "Proposal" add column if not exists currency text default 'ARS';

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
                <h1 className="text-[26px] font-bold tracking-[-0.03em] text-zinc-900 dark:text-white">Ajustes</h1>
                <p className="text-[14px] text-zinc-400 dark:text-zinc-500 mt-0.5 font-medium">Conexiones externas y base de datos.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* Meta Ads Token */}
                <Card className="overflow-visible md:col-span-2">
                    <CardHeader className="border-b border-zinc-100 dark:border-zinc-800">
                        <CardTitle className="flex items-center gap-2 text-[14px] font-semibold text-zinc-900 dark:text-white">
                            <Megaphone className="w-4 h-4 text-blue-500" /> Meta Ads — Access Token
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-5">
                        <p className="text-[12px] text-zinc-400">Token de acceso para leer campañas, métricas e Instagram. Se guarda localmente.</p>
                        <div className="space-y-2">
                            <Label>Access Token</Label>
                            <Input
                                type="password"
                                value={metaAdsToken}
                                onChange={(e) => setMetaAdsToken(e.target.value)}
                                placeholder="EAAr..."
                                className="font-mono text-[12px]"
                            />
                            <p className="text-[11px] text-zinc-400">
                                Generalo en <span className="text-zinc-600 dark:text-zinc-300 font-medium">developers.facebook.com/tools/explorer</span> con permisos <span className="font-mono text-[10px] bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded">ads_read</span> y <span className="font-mono text-[10px] bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded">business_management</span>. Expira cada 60 días.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* Claude API Key */}
                <Card className="overflow-visible">
                    <CardHeader className="border-b border-zinc-100 dark:border-zinc-800">
                        <CardTitle className="flex items-center gap-2 text-[14px] font-semibold text-zinc-900 dark:text-white">
                            <Sparkles className="w-4 h-4 text-violet-500" /> Claude AI (Anthropic)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-5">
                        <p className="text-[12px] text-zinc-400">Para AI Studio, propuestas y análisis de campañas.</p>
                        <div className="space-y-2">
                            <Label>API Key</Label>
                            <Input
                                type="password"
                                value={claudeApiKey}
                                onChange={(e) => setClaudeApiKey(e.target.value)}
                                placeholder="sk-ant-..."
                                className="font-mono text-[12px]"
                            />
                            <p className="text-[11px] text-zinc-400">Conseguila en <span className="text-zinc-600 dark:text-zinc-300 font-medium">console.anthropic.com</span></p>
                        </div>
                    </CardContent>
                </Card>

                {/* Google API Key (GEMINI) */}
                <Card className="overflow-visible">
                    <CardHeader className="border-b border-zinc-100 dark:border-zinc-800">
                        <CardTitle className="flex items-center gap-2 text-[14px] font-semibold text-zinc-900 dark:text-white">
                            <Key className="w-4 h-4 text-zinc-500" /> Gemini AI (Google)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-5">
                        <div className="space-y-2">
                            <Label>API Key</Label>
                            <Input
                                type="password"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder="AIzaSy..."
                                className="font-mono text-[12px]"
                            />
                            <p className="text-[11px] text-zinc-400">Usado para el Copiloto de Ventas.</p>
                        </div>
                    </CardContent>
                </Card>

                {/* Google OAuth (CALENDAR) */}
                <Card>
                    <CardHeader className="border-b border-zinc-100 dark:border-zinc-800">
                        <CardTitle className="flex items-center gap-2 text-[14px] font-semibold text-zinc-900 dark:text-white">
                            <CalendarCheck className="w-4 h-4 text-zinc-500" /> Google Calendar
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-5">
                        <div className="space-y-2">
                            <Label>OAuth Client ID</Label>
                            <Input
                                type="text"
                                value={oauthClientId}
                                onChange={(e) => setOauthClientId(e.target.value)}
                                placeholder="123...apps.googleusercontent.com"
                                className="font-mono text-[12px]"
                            />
                            <p className="text-[11px] text-zinc-400">
                                Necesario para sincronizar tareas.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="flex justify-end">
                <button
                    onClick={handleSave}
                    disabled={saving || loading}
                    className="flex items-center gap-2 h-10 px-5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-[13px] font-semibold rounded-[10px] shadow-[0_1px_3px_rgba(0,0,0,0.15)] hover:bg-black dark:hover:bg-zinc-100 active:scale-[0.97] transition-all disabled:opacity-50"
                >
                    {saving ? <Loader2 className="animate-spin w-4 h-4" /> : success ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                    {success ? "Guardado" : "Guardar cambios"}
                </button>
            </div>

            <Card className="border-red-100 dark:border-red-900/20">
                 <CardHeader className="border-b border-red-100 dark:border-red-900/20">
                    <CardTitle className="flex items-center gap-2 text-[14px] font-semibold text-red-700 dark:text-red-400">
                        <Database className="w-4 h-4" /> Reparación de Base de Datos
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-5">
                    <div className="text-[13px] text-zinc-600 dark:text-zinc-300 space-y-4">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                            <div>
                                <p className="font-semibold text-zinc-900 dark:text-white">¿No podés crear o borrar tareas?</p>
                                <p className="mt-1 text-zinc-500">
                                    Problema de permisos (RLS) en Supabase. Ejecutá este script en el SQL Editor.
                                </p>
                            </div>
                        </div>

                        <div className="relative group">
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button size="sm" variant="secondary" onClick={() => {navigator.clipboard.writeText(sqlScript); alert("Script copiado! Pégalo en Supabase SQL Editor.")}}>
                                    <Copy className="w-3 h-3 mr-2" /> Copiar SQL
                                </Button>
                            </div>
                            <div className="bg-zinc-950 text-zinc-400 p-4 rounded-xl font-mono text-[10px] md:text-[11px] overflow-x-auto leading-relaxed border border-zinc-800 h-64">
                                <pre>{sqlScript}</pre>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
