import React, { useEffect, useState, useCallback, useRef } from 'react';
import { db } from '../services/db';
import { ai } from '../services/ai';
import { Project } from '../types';
import {
  Megaphone, Download, ChevronDown, ChevronUp, User, Target, TrendingUp,
  BarChart3, CreditCard, Palette, Loader2, CheckCircle, Sparkles, Mic,
  MicOff, Send, X, Save, AlertCircle
} from 'lucide-react';
import { generateMarketingProposalPDF, MarketingProposalData } from '../services/pdfGenerator';
import { useToast } from '../components/Toast';

// ---- Types ----
interface ScenarioRow { label: string; cpa: number; newSales: number; }
interface PlanRow { name: string; price: number; includes: string[]; }

// ---- Defaults ----
const defaultData = (): MarketingProposalData => ({
  clientName: '', clientIndustry: '', clientWebsite: '', clientLocation: '',
  clientCompetitors: '', clientDifferential: '', clientSocialPresence: '',
  clientAvgTicket: 0, clientMonthlySales: 0,
  proposalObjective: '', targetRevenue: '', timeframe: '3 meses',
  platforms: 'Meta Ads (Facebook + Instagram)', dailyAdBudget: 0,
  targetAudience: '', painPoint: '', positioning: 'Calidad y resultados',
  agencyName: 'Algoritmia', agencyWebsite: 'www.algoritmiadesarrollos.com.ar',
  proposalLanguage: 'Español', includeCTA: true, includeTerms: true, brandColor: '#1A3C6E',
  numInitialAds: 6,
  plans: [
    { name: 'Plan Básico', price: 300, includes: ['Gestión de 1 plataforma', 'Hasta 3 creatividades/mes', 'Reporte mensual', 'Optimización semanal'] },
    { name: 'Plan Completo', price: 500, includes: ['Gestión de 2 plataformas', 'Creatividades ilimitadas', 'Reporte semanal', 'Optimización diaria', 'Email marketing', 'Configuración técnica'] },
  ],
  excludedFromService: 'Producción audiovisual profesional, inversión en pauta publicitaria (es adicional), diseño de identidad de marca.',
  contractConditions: 'Contrato mínimo de 3 meses. Pago mensual anticipado.',
  avgTicket: 0, showThreeScenarios: true,
  scenarios: [
    { label: 'Pesimista', cpa: 25, newSales: 8 },
    { label: 'Normal', cpa: 18, newSales: 15 },
    { label: 'Optimista', cpa: 12, newSales: 25 },
  ],
});

// ---- Required fields for validation ----
const REQUIRED_FIELDS: (keyof MarketingProposalData)[] = [
  'clientName', 'clientIndustry', 'proposalObjective', 'platforms',
  'targetAudience', 'avgTicket', 'dailyAdBudget'
];

// ---- Collapsible Section ----
const Section: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean; hasErrors?: boolean }> = ({ title, icon, children, defaultOpen = true, hasErrors }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`bg-white dark:bg-slate-900 rounded-2xl border overflow-hidden transition-all ${hasErrors ? 'border-red-300 dark:border-red-700' : 'border-gray-100 dark:border-slate-800'}`}>
      <button className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors" onClick={() => setOpen(!open)}>
        <div className="flex items-center gap-3 font-bold text-gray-900 dark:text-white text-sm">
          <span className="text-indigo-600">{icon}</span>
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

// ---- AI Fill Modal ----
const AIFillModal: React.FC<{
  onClose: () => void;
  onFill: (data: Partial<MarketingProposalData>) => void;
  clientId?: string;
}> = ({ onClose, onFill, clientId }) => {
  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [savingToClient, setSavingToClient] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const { showToast } = useToast();

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = (reader.result as string).split(',')[1];
          setProcessing(true);
          const transcribed = await ai.transcribe({ mimeType: 'audio/webm', data: base64 });
          if (transcribed) {
            setText(prev => prev ? prev + ' ' + transcribed : transcribed);
            showToast('🎤 Transcripción exitosa', 'success');
          } else {
            showToast('No se pudo transcribir el audio', 'error');
          }
          setProcessing(false);
        };
        reader.readAsDataURL(blob);
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setIsRecording(true);
    } catch {
      showToast('No se pudo acceder al micrófono', 'error');
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const handleProcess = async () => {
    if (!text.trim()) { showToast('Escribí o dictá algo primero', 'error'); return; }
    setProcessing(true);
    try {
      const result = await ai.fillProposalWithAI(text);
      if (!result) { showToast('Error al procesar con IA', 'error'); return; }

      // Strip nulls — keep only non-null values
      const cleaned: Partial<MarketingProposalData> = {};
      for (const [k, v] of Object.entries(result)) {
        if (v !== null && v !== undefined) (cleaned as any)[k] = v;
      }

      // Save relevant fields to client profile if clientId is provided
      if (clientId && Object.keys(cleaned).length > 0) {
        setSavingToClient(true);
        try {
          const clientUpdate: Record<string, any> = {};
          if (cleaned.targetAudience) clientUpdate.targetAudience = cleaned.targetAudience;
          if (cleaned.proposalObjective) clientUpdate.contextObjectives = cleaned.proposalObjective;
          if (cleaned.painPoint) clientUpdate.contextProblem = cleaned.painPoint;
          if (cleaned.positioning) clientUpdate.growthStrategy = cleaned.positioning;
          if (cleaned.clientIndustry) clientUpdate.industry = cleaned.clientIndustry;
          if (cleaned.clientLocation) clientUpdate.location = cleaned.clientLocation;
          if (cleaned.clientWebsite) clientUpdate.proposalUrl = cleaned.clientWebsite;
          if (cleaned.brandColor) clientUpdate.brandColors = [cleaned.brandColor];

          if (Object.keys(clientUpdate).length > 0) {
            await db.projects.update(clientId, clientUpdate);
            showToast('💾 Información guardada en el perfil del cliente', 'success');
          }
        } catch (e) {
          console.error('Error saving to client:', e);
          showToast('No se pudo guardar en el cliente', 'error');
        } finally {
          setSavingToClient(false);
        }
      }

      onFill(cleaned);
      onClose();
      showToast(`✅ ${Object.keys(cleaned).length} campos completados por la IA`, 'success');
    } catch (e) {
      console.error(e);
      showToast('Error al procesar', 'error');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-100 dark:border-slate-800">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 p-6 text-white">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-lg">Completar con IA</h2>
                <p className="text-indigo-200 text-sm">Contame sobre el cliente y qué le vas a ofrecer — yo lleno el formulario</p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Voice button */}
          <div className="flex items-center gap-3">
            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={processing}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${isRecording
                ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse shadow-lg shadow-red-500/30'
                : 'bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200'
              }`}
            >
              {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              {isRecording ? 'Detener dictado' : 'Dictar por voz'}
            </button>
            {isRecording && (
              <div className="flex items-center gap-2 text-red-500 text-sm font-medium">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
                Grabando...
              </div>
            )}
            {processing && !isRecording && (
              <div className="flex items-center gap-2 text-indigo-600 text-sm font-medium">
                <Loader2 className="w-4 h-4 animate-spin" />
                Transcribiendo...
              </div>
            )}
          </div>

          {/* Text area */}
          <div className="relative">
            <textarea
              className={textareaCls + " min-h-[220px]"}
              placeholder={`Contame todo lo que sabés del cliente y lo que le vas a ofrecer. Por ejemplo:

"El cliente se llama Pampita Moda, vende ropa femenina en Buenos Aires. Tiene Instagram con 5k seguidores. Su ticket promedio es $50. Le voy a ofrecer Meta Ads por $400/mes, incluye gestión de campañas, 5 creatividades por mes y reporte semanal. El presupuesto de pauta es $15 por día. Su diferencial es ropa exclusiva con diseños propios..."`}
              value={text}
              onChange={e => setText(e.target.value)}
            />
            {text && (
              <button onClick={() => setText('')} className="absolute top-3 right-3 w-6 h-6 bg-gray-200 dark:bg-slate-700 rounded-full flex items-center justify-center hover:bg-gray-300 transition-colors">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <p className="text-xs text-gray-400">
            💡 Podés mezclar voz y texto. Cuanto más info des, más campos se completan. Los campos sin info quedarán en rojo para que los completes manualmente.
            {clientId && <span className="ml-1 text-indigo-500 font-semibold">La información se guardará también en el perfil del cliente.</span>}
          </p>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-300 font-bold py-3 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors text-sm">
              Cancelar
            </button>
            <button
              onClick={handleProcess}
              disabled={processing || savingToClient || !text.trim()}
              className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-indigo-500/20 text-sm active:scale-95"
            >
              {(processing || savingToClient) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {processing ? 'Analizando...' : savingToClient ? 'Guardando...' : 'Completar formulario'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ---- Main Page ----
export default function MarketingProposalPage() {
  const { showToast } = useToast();
  const [clients, setClients] = useState<Project[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [data, setData] = useState<MarketingProposalData>(defaultData());
  const [generating, setGenerating] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [missingFields, setMissingFields] = useState<Set<string>>(new Set());

  useEffect(() => { db.projects.getAll().then(setClients); }, []);

  const handleClientChange = (clientId: string) => {
    setSelectedClientId(clientId);
    if (!clientId) return;
    const client = clients.find(c => c.id === clientId);
    if (!client) return;
    setData(prev => ({
      ...prev,
      clientName: client.name || '',
      clientIndustry: client.industry || '',
      clientWebsite: client.proposalUrl || '',
      clientLocation: client.location || '',
      targetAudience: client.targetAudience || prev.targetAudience,
      proposalObjective: client.contextObjectives || prev.proposalObjective,
      positioning: client.growthStrategy || prev.positioning,
      avgTicket: prev.avgTicket || client.monthlyRevenue || 0,
      brandColor: client.brandColors?.[0] || prev.brandColor,
    }));
  };

  const set = useCallback((field: keyof MarketingProposalData, value: any) => {
    setData(prev => ({ ...prev, [field]: value }));
    setMissingFields(prev => { const n = new Set(prev); n.delete(field as string); return n; });
  }, []);

  const handleAIFill = (filled: Partial<MarketingProposalData>) => {
    setData(prev => ({ ...prev, ...filled }));
    // Compute which required fields are still missing after fill
    const missing = new Set<string>();
    const merged = { ...data, ...filled };
    REQUIRED_FIELDS.forEach(f => {
      const v = merged[f];
      if (!v || v === 0 || v === '') missing.add(f as string);
    });
    setMissingFields(missing);
  };

  const updateScenario = (index: number, field: keyof ScenarioRow, value: any) => {
    setData(prev => {
      const updated = [...prev.scenarios];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, scenarios: updated };
    });
  };

  const updatePlan = (index: number, field: keyof PlanRow, value: any) => {
    setData(prev => {
      const updated = [...prev.plans];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, plans: updated };
    });
  };

  const updatePlanIncludes = (planIndex: number, text: string) => {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    updatePlan(planIndex, 'includes', lines);
  };

  const saveToClient = async () => {
    if (!selectedClientId) { showToast('Seleccioná un cliente primero', 'error'); return; }
    try {
      await db.projects.update(selectedClientId, {
        targetAudience: data.targetAudience,
        contextObjectives: data.proposalObjective,
        contextProblem: data.painPoint,
        growthStrategy: data.positioning,
        industry: data.clientIndustry,
        location: data.clientLocation,
        proposalUrl: data.clientWebsite,
        brandColors: data.brandColor ? [data.brandColor] : undefined,
      });
      showToast('💾 Datos guardados en el perfil del cliente', 'success');
    } catch (e) { showToast('Error al guardar', 'error'); }
  };

  const handleGenerate = async () => {
    // Validate required fields
    const missing = new Set<string>();
    REQUIRED_FIELDS.forEach(f => {
      const v = data[f];
      if (!v || v === 0 || v === '') missing.add(f as string);
    });
    if (missing.size > 0) {
      setMissingFields(missing);
      showToast(`⚠️ Completá los campos requeridos (${missing.size} faltantes)`, 'error');
      return;
    }
    if (!data.clientName.trim()) { showToast('Completá el nombre del cliente', 'error'); return; }
    setGenerating(true);
    try {
      await generateMarketingProposalPDF(data);
      showToast('✅ PDF generado correctamente', 'success');
    } catch (e) {
      console.error(e);
      showToast('Error al generar el PDF', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const isMissing = (field: keyof MarketingProposalData) => missingFields.has(field as string);

  // Determine sections with errors
  const block1Errors = ['clientName', 'clientIndustry'].some(f => isMissing(f as any));
  const block2Errors = ['proposalObjective'].some(f => isMissing(f as any));
  const block3Errors = ['platforms', 'targetAudience', 'dailyAdBudget'].some(f => isMissing(f as any));
  const block5Errors = ['avgTicket'].some(f => isMissing(f as any));

  return (
    <div className="space-y-6 pb-20 max-w-7xl mx-auto">
      {showAIModal && (
        <AIFillModal
          onClose={() => setShowAIModal(false)}
          onFill={handleAIFill}
          clientId={selectedClientId || undefined}
        />
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-3">
            <Megaphone className="w-8 h-8 text-indigo-600" /> Propuesta de Marketing
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Completá el formulario y generá un PDF profesional listo para enviar.</p>
        </div>
        <div className="flex items-center gap-3">
          {selectedClientId && (
            <button onClick={saveToClient} className="flex items-center gap-2 border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-300 font-bold px-4 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800 transition-all text-sm">
              <Save className="w-4 h-4" /> Guardar en cliente
            </button>
          )}
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold px-6 py-3 rounded-xl shadow-lg shadow-indigo-500/30 transition-all text-sm active:scale-95"
          >
            {generating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
            {generating ? 'Generando PDF...' : 'Descargar PDF'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6">
        {/* LEFT — FORM */}
        <div className="space-y-4">

          {/* Client selector + AI button */}
          <div className="bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-900/20 dark:to-violet-900/10 rounded-2xl border border-indigo-100 dark:border-indigo-900/40 p-5">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="flex-1">
                <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-2">Seleccionar cliente existente</p>
                <select className={inputCls} value={selectedClientId} onChange={e => handleClientChange(e.target.value)}>
                  <option value="">— Nuevo cliente (manual) —</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}{c.industry ? ` · ${c.industry}` : ''}</option>)}
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => setShowAIModal(true)}
                  className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 transition-all active:scale-95 whitespace-nowrap text-sm"
                >
                  <Sparkles className="w-4 h-4" /> Completar con IA
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">Con <strong>Completar con IA</strong> podés dictar o escribir toda la info del cliente y la IA llena los bloques automáticamente.</p>
          </div>

          {/* Missing fields banner */}
          {missingFields.size > 0 && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <div>
                <p className="font-bold text-red-700 dark:text-red-400 text-sm">Faltan {missingFields.size} campo{missingFields.size > 1 ? 's' : ''} requerido{missingFields.size > 1 ? 's' : ''}</p>
                <p className="text-red-600 dark:text-red-300 text-xs">Los campos marcados en rojo son necesarios para generar el PDF. Completalos manualmente o usá la IA.</p>
              </div>
            </div>
          )}

          {/* Block 1 — Client */}
          <Section title="Bloque 1 — Información del Cliente" icon={<User className="w-4 h-4" />} hasErrors={block1Errors}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <FormField label="Nombre del negocio / marca" required missing={isMissing('clientName')}>
                <input className={inputCls} value={data.clientName} onChange={e => set('clientName', e.target.value)} placeholder="Ej: Pampita Moda" />
              </FormField>
              <FormField label="Rubro / Industria" required missing={isMissing('clientIndustry')}>
                <input className={inputCls} value={data.clientIndustry} onChange={e => set('clientIndustry', e.target.value)} placeholder="Ej: Moda, Gastronomía..." />
              </FormField>
              <FormField label="Sitio web / Tienda online">
                <input className={inputCls} value={data.clientWebsite} onChange={e => set('clientWebsite', e.target.value)} placeholder="https://..." />
              </FormField>
              <FormField label="Mercado objetivo (país / ciudad)">
                <input className={inputCls} value={data.clientLocation} onChange={e => set('clientLocation', e.target.value)} placeholder="Ej: Argentina, CABA y GBA" />
              </FormField>
              <FormField label="Ticket promedio (USD)">
                <input className={inputCls} type="number" value={data.clientAvgTicket || ''} onChange={e => set('clientAvgTicket', Number(e.target.value))} placeholder="50" />
              </FormField>
              <FormField label="Facturación mensual estimada (USD)">
                <input className={inputCls} type="number" value={data.clientMonthlySales || ''} onChange={e => set('clientMonthlySales', Number(e.target.value))} placeholder="3000" />
              </FormField>
            </div>
            <FormField label="Principales competidores">
              <input className={inputCls} value={data.clientCompetitors} onChange={e => set('clientCompetitors', e.target.value)} placeholder="Ej: Marca A, Marca B, Marca C" />
            </FormField>
            <FormField label="Ventaja competitiva / Diferencial">
              <textarea className={textareaCls} rows={2} value={data.clientDifferential} onChange={e => set('clientDifferential', e.target.value)} placeholder="¿Por qué elegirlos a ellos y no a la competencia?" />
            </FormField>
            <FormField label="Presencia en redes sociales">
              <input className={inputCls} value={data.clientSocialPresence} onChange={e => set('clientSocialPresence', e.target.value)} placeholder="Ej: Instagram 2k seguidores, Facebook activo" />
            </FormField>
          </Section>

          {/* Block 2 — Objective */}
          <Section title="Bloque 2 — Objetivo de la Propuesta" icon={<Target className="w-4 h-4" />} hasErrors={block2Errors}>
            <FormField label="Objetivo principal" required missing={isMissing('proposalObjective')}>
              <textarea className={textareaCls} rows={2} value={data.proposalObjective} onChange={e => set('proposalObjective', e.target.value)} placeholder="Ej: Duplicar las ventas online en 3 meses mediante Meta Ads." />
            </FormField>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <FormField label="Meta numérica (opcional)">
                <input className={inputCls} value={data.targetRevenue} onChange={e => set('targetRevenue', e.target.value)} placeholder="Ej: Pasar de USD 3.000 a USD 6.000/mes" />
              </FormField>
              <FormField label="Plazo">
                <input className={inputCls} value={data.timeframe} onChange={e => set('timeframe', e.target.value)} placeholder="Ej: 3 meses" />
              </FormField>
            </div>
          </Section>

          {/* Block 3 — Strategy */}
          <Section title="Bloque 3 — Plataformas y Estrategia" icon={<TrendingUp className="w-4 h-4" />} hasErrors={block3Errors}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <FormField label="Plataformas" required missing={isMissing('platforms')}>
                <input className={inputCls} value={data.platforms} onChange={e => set('platforms', e.target.value)} placeholder="Ej: Meta Ads, Google Ads, TikTok Ads" />
              </FormField>
              <FormField label="Inversión diaria en pauta (USD)" required missing={isMissing('dailyAdBudget')}>
                <input className={inputCls} type="number" value={data.dailyAdBudget || ''} onChange={e => set('dailyAdBudget', Number(e.target.value))} placeholder="10" />
              </FormField>
            </div>
            <FormField label="Público objetivo" required missing={isMissing('targetAudience')}>
              <textarea className={textareaCls} rows={2} value={data.targetAudience} onChange={e => set('targetAudience', e.target.value)} placeholder="Ej: Mujeres 25-45 años, Buenos Aires, interesadas en moda sustentable" />
            </FormField>
            <FormField label="Punto de dolor del cliente ideal">
              <textarea className={textareaCls} rows={2} value={data.painPoint} onChange={e => set('painPoint', e.target.value)} placeholder="¿Qué problema resuelve tu cliente?" />
            </FormField>
            <FormField label="Posicionamiento de marca">
              <input className={inputCls} value={data.positioning} onChange={e => set('positioning', e.target.value)} placeholder="Ej: Precio accesible, Calidad premium, Exclusividad" />
            </FormField>
          </Section>

          {/* Block 4 — Plans */}
          <Section title="Bloque 4 — Planes y Precios" icon={<CreditCard className="w-4 h-4" />}>
            <div className="space-y-4">
              {data.plans.map((plan, idx) => (
                <div key={idx} className="bg-gray-50 dark:bg-slate-800/50 rounded-xl p-4 space-y-3 border border-gray-100 dark:border-slate-700">
                  <div className="flex items-center gap-2 font-bold text-sm text-indigo-700 dark:text-indigo-300">
                    <span className="w-6 h-6 bg-indigo-100 dark:bg-indigo-900/50 rounded-full flex items-center justify-center text-[10px] font-black">{idx + 1}</span>
                    Plan {idx + 1}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <FormField label="Nombre del plan">
                      <input className={inputCls} value={plan.name} onChange={e => updatePlan(idx, 'name', e.target.value)} placeholder="Ej: Plan Básico" />
                    </FormField>
                    <FormField label="Precio mensual (USD)">
                      <input className={inputCls} type="number" value={plan.price || ''} onChange={e => updatePlan(idx, 'price', Number(e.target.value))} placeholder="300" />
                    </FormField>
                  </div>
                  <FormField label="¿Qué incluye? (una opción por línea)">
                    <textarea className={textareaCls} rows={5} value={plan.includes.join('\n')} onChange={e => updatePlanIncludes(idx, e.target.value)} placeholder={"Gestión de Meta Ads\nHasta 5 creatividades/mes\nReporte mensual"} />
                  </FormField>
                </div>
              ))}
            </div>
            <FormField label="¿Qué NO incluye el servicio?">
              <textarea className={textareaCls} rows={3} value={data.excludedFromService} onChange={e => set('excludedFromService', e.target.value)} />
            </FormField>
            <FormField label="Condiciones especiales">
              <textarea className={textareaCls} rows={2} value={data.contractConditions} onChange={e => set('contractConditions', e.target.value)} />
            </FormField>
            <FormField label="Cantidad de anuncios iniciales" hint="Se usará para la sección 'Los N Anuncios Iniciales' del PDF">
              <input className={inputCls} type="number" min={2} max={12} value={data.numInitialAds || 6} onChange={e => set('numInitialAds', Number(e.target.value))} />
            </FormField>
          </Section>

          {/* Block 5 — Projections */}
          <Section title="Bloque 5 — Proyecciones y Escenarios" icon={<BarChart3 className="w-4 h-4" />} hasErrors={block5Errors}>
            <FormField label="Ticket promedio para calcular ROI (USD)" required missing={isMissing('avgTicket')}>
              <input className={inputCls} type="number" value={data.avgTicket || ''} onChange={e => set('avgTicket', Number(e.target.value))} placeholder="50" />
            </FormField>
            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-700">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-slate-800 text-xs font-bold text-gray-500 uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">Escenario</th>
                    <th className="px-4 py-3 text-left">Costo por venta (USD)</th>
                    <th className="px-4 py-3 text-left">Ventas nuevas est.</th>
                    <th className="px-4 py-3 text-left text-gray-400">Ingresos (auto)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                  {data.scenarios.map((s, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/30">
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-lg text-xs font-bold ${idx === 0 ? 'bg-red-100 text-red-700' : idx === 1 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>{s.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <input className="w-24 bg-transparent border border-gray-200 dark:border-slate-600 rounded-lg px-2 py-1 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" type="number" value={s.cpa || ''} onChange={e => updateScenario(idx, 'cpa', Number(e.target.value))} />
                      </td>
                      <td className="px-4 py-3">
                        <input className="w-24 bg-transparent border border-gray-200 dark:border-slate-600 rounded-lg px-2 py-1 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" type="number" value={s.newSales || ''} onChange={e => updateScenario(idx, 'newSales', Number(e.target.value))} />
                      </td>
                      <td className="px-4 py-3 text-gray-400 font-bold">${((data.avgTicket || 0) * s.newSales).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {/* Block 6 — Visual Identity */}
          <Section title="Bloque 6 — Identidad Visual" icon={<Palette className="w-4 h-4" />} defaultOpen={false}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <FormField label="Nombre de tu agencia">
                <input className={inputCls} value={data.agencyName} onChange={e => set('agencyName', e.target.value)} />
              </FormField>
              <FormField label="Sitio web de tu agencia">
                <input className={inputCls} value={data.agencyWebsite} onChange={e => set('agencyWebsite', e.target.value)} />
              </FormField>
              <FormField label="Color de acento (hex)">
                <div className="flex gap-2 items-center">
                  <input type="color" className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer" value={data.brandColor} onChange={e => set('brandColor', e.target.value)} />
                  <input className={inputCls} value={data.brandColor} onChange={e => set('brandColor', e.target.value)} placeholder="#6366f1" />
                </div>
              </FormField>
            </div>
            <div className="flex gap-4 pt-1">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" className="rounded" checked={data.includeCTA} onChange={e => set('includeCTA', e.target.checked)} />
                Incluir sección CTA final
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" className="rounded" checked={data.includeTerms} onChange={e => set('includeTerms', e.target.checked)} />
                Incluir términos y condiciones
              </label>
            </div>
          </Section>
        </div>

        {/* RIGHT — Preview */}
        <div className="xl:sticky xl:top-4 h-fit space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="px-5 py-4 bg-gradient-to-r from-indigo-600 to-violet-600 text-white">
              <h3 className="font-bold text-sm">Vista previa</h3>
              <p className="text-indigo-200 text-xs mt-0.5">Resumen de contenido</p>
            </div>
            <div className="p-5 space-y-4 text-sm">
              <div className="rounded-xl bg-indigo-50 dark:bg-indigo-900/20 p-4 border border-indigo-100 dark:border-indigo-800">
                <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">Portada</p>
                <p className="font-bold text-gray-900 dark:text-white mt-1 text-base">{data.clientName || '— cliente —'}</p>
                <p className="text-gray-500 text-xs">{data.clientIndustry}</p>
                <p className="text-indigo-600 font-semibold text-xs mt-1">{data.agencyName} · {new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-gray-50 dark:bg-slate-800 rounded-xl p-3">
                  <p className="text-[10px] text-gray-400 font-bold uppercase">Inv. Pauta/día</p>
                  <p className="font-bold text-gray-900 dark:text-white">${data.dailyAdBudget || '—'}</p>
                </div>
                <div className="bg-gray-50 dark:bg-slate-800 rounded-xl p-3">
                  <p className="text-[10px] text-gray-400 font-bold uppercase">Inv. Pauta/mes</p>
                  <p className="font-bold text-gray-900 dark:text-white">${(data.dailyAdBudget * 30).toLocaleString()}</p>
                </div>
                <div className="bg-gray-50 dark:bg-slate-800 rounded-xl p-3">
                  <p className="text-[10px] text-gray-400 font-bold uppercase">Ticket prom.</p>
                  <p className="font-bold text-gray-900 dark:text-white">${data.avgTicket || '—'}</p>
                </div>
                <div className="bg-gray-50 dark:bg-slate-800 rounded-xl p-3">
                  <p className="text-[10px] text-gray-400 font-bold uppercase">Plataformas</p>
                  <p className="font-bold text-gray-900 dark:text-white text-xs">{data.platforms.split(',')[0] || '—'}</p>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Planes</p>
                {data.plans.map((plan, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-gray-50 dark:bg-slate-800 rounded-xl px-3 py-2.5">
                    <div>
                      <p className="font-bold text-gray-900 dark:text-white text-sm">{plan.name || `Plan ${idx + 1}`}</p>
                      <p className="text-[11px] text-gray-500">{plan.includes.length} servicios</p>
                    </div>
                    <span className="font-black text-indigo-600 dark:text-indigo-400 text-base">${plan.price}/mes</span>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Escenarios</p>
                <div className="space-y-1.5">
                  {data.scenarios.map((s, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs">
                      <span className={`px-2 py-0.5 rounded-md font-bold ${idx === 0 ? 'bg-red-100 text-red-700' : idx === 1 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>{s.label}</span>
                      <span className="text-gray-500">{s.newSales} ventas</span>
                      <span className="font-bold text-gray-900 dark:text-white">${((data.avgTicket || 0) * s.newSales).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
              {missingFields.size > 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-3 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700 dark:text-red-400 font-medium">{missingFields.size} campo{missingFields.size > 1 ? 's' : ''} requerido{missingFields.size > 1 ? 's' : ''} pendiente{missingFields.size > 1 ? 's' : ''}</p>
                </div>
              )}
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Secciones del PDF</p>
                {['1. Portada', '2. El Objetivo', '3. Sobre el Negocio', '4. La Estrategia', '5. Escenarios de Resultados', '6. Plan de Acción 3 Meses', '7. Planes y Precios', '8. Compromiso / Garantía', '9. Lo que necesitamos', data.includeCTA ? '10. CTA Final' : null].filter(Boolean).map(s => (
                  <div key={s} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 py-0.5">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />{s}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold px-6 py-4 rounded-2xl shadow-lg shadow-indigo-500/30 transition-all text-sm active:scale-95"
          >
            {generating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
            {generating ? 'Generando...' : 'Generar y Descargar PDF'}
          </button>
        </div>
      </div>
    </div>
  );
}
