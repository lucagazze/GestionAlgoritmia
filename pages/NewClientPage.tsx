import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/db';
import { ProjectStatus } from '../types';
import {
  User, Target, TrendingUp, BarChart3, Loader2, Sparkles, ChevronDown, ChevronUp, AlertCircle, Save
} from 'lucide-react';
import { useToast } from '../components/Toast';
import { AIFillModal } from '../components/modals/AIFillModal';

// ---- Types ----
interface NewClientData {
  clientName: string;
  clientIndustry: string;
  clientWebsite: string;
  clientLocation: string;
  clientEmail: string;
  clientPhone: string;
  clientCompetitors: string;
  clientDifferential: string;
  clientSocialPresence: string;
  
  targetAudience: string;
  proposalObjective: string;
  painPoint: string;
  positioning: string;
  
  platforms: string;
  dailyAdBudget: string;
  
  avgTicket: string;
  monthlySales: string;
  targetRevenue: string;
  timeframe: string;
}

const defaultData = (): NewClientData => ({
  clientName: '', clientIndustry: '', clientWebsite: '', clientLocation: '',
  clientEmail: '', clientPhone: '',
  clientCompetitors: '', clientDifferential: '', clientSocialPresence: '',
  targetAudience: '', proposalObjective: '', painPoint: '', positioning: '',
  platforms: '', dailyAdBudget: '',
  avgTicket: '', monthlySales: '', targetRevenue: '', timeframe: '',
});

// Se quitaron las constraints para permitir creación flexible.
const REQUIRED_FIELDS: (keyof NewClientData)[] = ['clientName'];

// ---- UI Components ----
const Section: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean; hasErrors?: boolean }> = ({ title, icon, children, defaultOpen = true, hasErrors }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`bg-white dark:bg-slate-900 rounded-2xl border overflow-hidden transition-all ${hasErrors ? 'border-red-300 dark:border-red-700' : 'border-gray-100 dark:border-slate-800'}`}>
      <button type="button" className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors" onClick={() => setOpen(!open)}>
        <div className="flex items-center gap-3 font-bold text-gray-900 dark:text-white text-sm">
          <span className="text-indigo-600 dark:text-indigo-400">{icon}</span>
          {title}
          {hasErrors && <span className="flex items-center gap-1 text-red-500 text-xs font-semibold"><AlertCircle className="w-3.5 h-3.5" />Campos requeridos</span>}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && <div className="px-5 pb-5 space-y-3 border-t border-gray-50 dark:border-slate-800 pt-4">{children}</div>}
    </div>
  );
};

const FormField: React.FC<{ label: string; children: React.ReactNode; hint?: string; required?: boolean; missing?: boolean }> = ({ label, children, hint, required, missing }) => (
  <div className="space-y-1">
    <label className={`text-xs font-bold uppercase tracking-wide flex items-center gap-1 ${missing ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'}`}>
      {label}
      {required && <span className="text-red-400">*</span>}
      {missing && <span className="text-red-400 text-[10px] normal-case font-medium">(requerido)</span>}
    </label>
    <div className={missing ? 'ring-2 ring-red-400 ring-offset-1 rounded-xl' : ''}>{children}</div>
    {hint && <p className="text-[11px] text-gray-400">{hint}</p>}
  </div>
);

const inputCls = "w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition text-gray-900 dark:text-white";
const textareaCls = inputCls + " resize-none";

// ---- Main Page ----
export default function NewClientPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  
  const [data, setData] = useState<NewClientData>(defaultData());
  const [saving, setSaving] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [missingFields, setMissingFields] = useState<Set<string>>(new Set());

  const set = useCallback((field: keyof NewClientData, value: any) => {
    setData(prev => ({ ...prev, [field]: value }));
    setMissingFields(prev => { const n = new Set(prev); n.delete(field as string); return n; });
  }, []);

  const handleAIFill = (filled: any) => {
    setData(prev => ({
      ...prev,
      clientIndustry: filled.clientIndustry || prev.clientIndustry,
      clientLocation: filled.clientLocation || prev.clientLocation,
      clientWebsite: filled.clientWebsite || prev.clientWebsite,
      
      targetAudience: filled.targetAudience || prev.targetAudience,
      proposalObjective: filled.proposalObjective || prev.proposalObjective,
      painPoint: filled.painPoint || prev.painPoint,
      
      dailyAdBudget: filled.dailyAdBudget || prev.dailyAdBudget,
      platforms: filled.platforms || prev.platforms,
      avgTicket: filled.avgTicket || prev.avgTicket,
      clientCompetitors: filled.clientCompetitors || prev.clientCompetitors,
    }));
    
    // Compute missing
    const missing = new Set<string>();
    const merged = { ...data, ...filled };
    REQUIRED_FIELDS.forEach(f => {
      const v = merged[f];
      if (!v || v === 0 || v === '') missing.add(f as string);
    });
    setMissingFields(missing);
  };

  const handleSave = async () => {
    if (!data.clientName) {
      showToast('⚠️ El nombre del negocio es obligatorio.', 'error');
      setMissingFields(new Set(['clientName']));
      return;
    }

    setSaving(true);
    try {
      // 1. Crear el proyecto (Client table)
      const project = await db.projects.create({
        name: data.clientName,
        industry: data.clientIndustry,
        email: data.clientEmail,
        phone: data.clientPhone,
        proposalUrl: data.clientWebsite,
        status: ProjectStatus.ONBOARDING,
        monthlyRevenue: 0,
        billingDay: 1,
      });

      // 2. Crear el ClientProfile con the AI/Strategy Context
      const hasContext = 
        data.targetAudience || data.painPoint || data.proposalObjective || 
        data.dailyAdBudget || data.platforms || data.avgTicket || 
        data.clientCompetitors || data.monthlySales || data.clientDifferential || 
        data.clientSocialPresence || data.targetRevenue || data.timeframe || data.positioning || data.clientLocation;

      if (hasContext) {
        await db.clientProfiles.upsert(project.id, {
          targetAudience: data.targetAudience,
          problem: data.painPoint,
          objectives: data.proposalObjective,
          dailyAdBudget: data.dailyAdBudget,
          platforms: data.platforms,
          avgTicket: data.avgTicket,
          competitors: data.clientCompetitors,
          monthlySales: data.monthlySales,
          differential: data.clientDifferential,
          socialPresence: data.clientSocialPresence,
          targetRevenue: data.targetRevenue,
          timeframe: data.timeframe,
          positioning: data.positioning
        });
      }

      showToast('🎉 Cliente creado exitosamente!', 'success');
      navigate(`/projects/${project.id}`);
    } catch (error) {
      console.error(error);
      showToast('Error al crear el cliente.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const isMissing = (field: keyof NewClientData) => missingFields.has(field as string);

  return (
    <div className="space-y-6 pb-20 max-w-5xl mx-auto animate-in fade-in duration-500">
      {showAIModal && (
        <AIFillModal
          onClose={() => setShowAIModal(false)}
          onFill={handleAIFill}
        />
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-3">
            <User className="w-8 h-8 text-indigo-600" /> Nuevo Cliente
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Ingresá toda la información comercial y estratégica del cliente en un solo lugar.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAIModal(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-indigo-100 to-violet-100 dark:from-indigo-900/30 dark:to-violet-900/30 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-bold px-4 py-2.5 rounded-xl hover:bg-indigo-200 dark:hover:bg-indigo-800/50 transition-all text-sm"
          >
            <Sparkles className="w-4 h-4" /> Autocompletar con IA
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold px-6 py-2.5 rounded-xl shadow-lg shadow-indigo-500/30 transition-all text-sm active:scale-95"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            {saving ? 'Guardando...' : 'Crear Cliente'}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {/* Missing fields banner */}
        {missingFields.size > 0 && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <div>
              <p className="font-bold text-red-700 dark:text-red-400 text-sm">Faltan {missingFields.size} campo{missingFields.size > 1 ? 's' : ''} requerido{missingFields.size > 1 ? 's' : ''}</p>
            </div>
          </div>
        )}

        {/* Block 1 — Client Info */}
        <Section title="Información Básica del Cliente" icon={<User className="w-4 h-4" />} hasErrors={['clientName'].some(f => isMissing(f as any))}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FormField label="Nombre del negocio / marca" required missing={isMissing('clientName')}>
              <input className={inputCls} value={data.clientName} onChange={e => set('clientName', e.target.value)} placeholder="Ej: Pampita Moda" />
            </FormField>
            <FormField label="Rubro / Industria">
              <input className={inputCls} value={data.clientIndustry} onChange={e => set('clientIndustry', e.target.value)} placeholder="Ej: Moda, Gastronomía..." />
            </FormField>
            <FormField label="Email Principal">
              <input className={inputCls} type="email" value={data.clientEmail} onChange={e => set('clientEmail', e.target.value)} placeholder="contacto@empresa.com" />
            </FormField>
            <FormField label="Teléfono (WhatsApp)">
              <input className={inputCls} type="tel" value={data.clientPhone} onChange={e => set('clientPhone', e.target.value)} placeholder="+54 9 11..." />
            </FormField>
            <FormField label="Sitio web / Tienda online">
              <input className={inputCls} value={data.clientWebsite} onChange={e => set('clientWebsite', e.target.value)} placeholder="https://..." />
            </FormField>
            <FormField label="Ubicación Física">
              <input className={inputCls} value={data.clientLocation} onChange={e => set('clientLocation', e.target.value)} placeholder="Ej: Argentina, CABA" />
            </FormField>
          </div>
        </Section>

        {/* Block 2 — Commercial Data */}
        <Section title="Estructura Comercial" icon={<BarChart3 className="w-4 h-4" />}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FormField label="Ticket promedio ($ / USD)">
              <input className={inputCls} type="text" value={data.avgTicket || ''} onChange={e => set('avgTicket', e.target.value)} placeholder="Ej: 50 USD o 15000 ARS" />
            </FormField>
            <FormField label="Facturación mensual estimada (aprox)">
              <input className={inputCls} type="text" value={data.monthlySales || ''} onChange={e => set('monthlySales', e.target.value)} placeholder="Ej: Entre 3000 y 5000" />
            </FormField>
            <FormField label="Principales competidores">
              <input className={inputCls} value={data.clientCompetitors} onChange={e => set('clientCompetitors', e.target.value)} placeholder="Ej: Marca A, Marca B" />
            </FormField>
            <FormField label="Presencia actual en redes">
              <input className={inputCls} value={data.clientSocialPresence} onChange={e => set('clientSocialPresence', e.target.value)} placeholder="Ej: Instagram 5k, TikTok 10k" />
            </FormField>
          </div>
          <FormField label="Ventaja competitiva / Diferencial">
            <textarea className={textareaCls} rows={2} value={data.clientDifferential} onChange={e => set('clientDifferential', e.target.value)} placeholder="¿Por qué elegirlos a ellos y no a la competencia?" />
          </FormField>
        </Section>

        {/* Block 3 — Strategic Objective */}
        <Section title="Objetivos y Estrategia Inicial" icon={<Target className="w-4 h-4" />}>
          <FormField label="Objetivo principal del cliente">
            <textarea className={textareaCls} rows={2} value={data.proposalObjective} onChange={e => set('proposalObjective', e.target.value)} placeholder="Ej: Duplicar las ventas online en 3 meses mediante Meta Ads." />
          </FormField>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FormField label="Meta numérica / Deseo (opcional)">
              <input className={inputCls} value={data.targetRevenue} onChange={e => set('targetRevenue', e.target.value)} placeholder="Ej: Pasar de $3M a $6M/mes" />
            </FormField>
            <FormField label="Plazo de tiempo esperado">
              <input className={inputCls} value={data.timeframe} onChange={e => set('timeframe', e.target.value)} placeholder="Ej: 3 a 6 meses" />
            </FormField>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FormField label="Plataformas / Servicios pensados">
              <input className={inputCls} value={data.platforms} onChange={e => set('platforms', e.target.value)} placeholder="Ej: Meta Ads, Google Ads, TikTok Ads" />
            </FormField>
            <FormField label="Inversión diaria dispuesta en pauta">
              <input className={inputCls} type="text" value={data.dailyAdBudget} onChange={e => set('dailyAdBudget', e.target.value)} placeholder="Ej: Aprox $10 USD" />
            </FormField>
          </div>
          <FormField label="Público objetivo ideal">
            <textarea className={textareaCls} rows={2} value={data.targetAudience} onChange={e => set('targetAudience', e.target.value)} placeholder="Ej: Mujeres 25-45 años, Buenos Aires, interesadas en moda sustentable" />
          </FormField>
          <FormField label="Su dolor actual (Punto A)">
            <textarea className={textareaCls} rows={2} value={data.painPoint} onChange={e => set('painPoint', e.target.value)} placeholder="¿Qué problema tienen hoy que nosotros vamos a resolver?" />
          </FormField>
          <FormField label="Posicionamiento deseado">
            <input className={inputCls} value={data.positioning} onChange={e => set('positioning', e.target.value)} placeholder="Ej: Precio accesible, Calidad premium, Autoridad tech..." />
          </FormField>
        </Section>
      </div>
    </div>
  );
}
