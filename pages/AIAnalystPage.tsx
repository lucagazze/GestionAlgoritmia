
import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  metaAds, INSIGHT_FIELDS, AD_INSIGHT_FIELDS, daysAgo, today as todayFn, presetToRange, getPrevPeriod,
  type DatePreset, type TimeRange,
} from '../services/metaAds';
import { ai } from '../services/ai';
import { useToast } from '../components/Toast';
import { GPTOptimizerTab } from '../components/tabs/GPTOptimizerTab';
type ClaudeMessage = { role: 'user' | 'assistant'; content: string };
import {
  PieChart, Pie, Cell, Tooltip as ReTooltip, ResponsiveContainer,
} from 'recharts';
import {
  BrainCircuit, Settings, Upload, FileDown, Loader2, Send,
  X, Plus, Trash2, BarChart2, Palette, ClipboardList,
  ToggleLeft, ToggleRight, RefreshCw, Zap, TrendingUp, DollarSign,
  Activity, AlertCircle, AlertTriangle, CheckCircle2, ExternalLink,
  Calendar, ChevronDown, ChevronLeft, ChevronRight, Building2, MessageSquare,
  PanelRightClose, PanelRightOpen,
} from 'lucide-react';

// ── Default YT channels ─────────────────────────────────────────────────────
const DEFAULT_YT_CHANNELS = [
  { name: 'Alex Izquierdo Marketing', url: '', active: true },
  { name: 'Ben Heath',                url: '', active: true },
  { name: 'CT the Disruptor',         url: '', active: true },
  { name: 'Felipe Vergara',           url: '', active: true },
  { name: 'Juan ADS',                 url: '', active: true },
  { name: 'Nick Theriot',             url: '', active: true },
];

const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: 'today',        label: 'Hoy' },
  { value: 'yesterday',    label: 'Ayer' },
  { value: 'last_7d',      label: 'Últimos 7 días' },
  { value: 'last_14d',     label: 'Últimos 14 días' },
  { value: 'last_28d',     label: 'Últimos 28 días' },
  { value: 'this_month',   label: 'Este mes' },
  { value: 'last_month',   label: 'Mes anterior' },
];

const buildMetaAnalystSystem = (activeChannels: string[]) => {
  const extraExperts = activeChannels.length > 0
    ? `\n\n### EXPERTOS EXTRA (SKILLS ACTIVOS)\nAdemás de la base de Andromeda, ADAPTÁ y ENRIQUECÉ tus recomendaciones integrando fuertemente las metodologías, filosofías y tácticas particulares de los siguientes referentes de Meta Ads: **${activeChannels.join(', ')}**. Si aplica, mencioná cómo lo abordaría alguno de ellos o justificá tus consejos nombrando sus conceptos.`
    : '';

  return `Sos el analista senior de Meta Ads de Algoritmia. Aplicás la metodología Andromeda de Charley T (Disrupter School) como marco principal de análisis. Cada diagnóstico se basa en sus principios, no en criterios genéricos.${extraExperts}

---

## METODOLOGÍA ANDROMEDA — CHARLEY T (FUENTE PRINCIPAL)

### Filosofía core
- El algoritmo de Meta es más inteligente que el anunciante → colaborar, no microgestionar
- **Simplicidad escala, complejidad falla**: muchas campañas = fragmentación de datos + ruido
- Los anuncios amplían modelos de negocio: un ad no salva un producto/oferta malo

### Segmentación: BROAD SIEMPRE
- **Intereses y Lookalikes = obsoletos**: encarecen el CPM artificialmente (pagarle una "tasa" a Meta por algo que el algoritmo ya hace gratis con Broad)
- **El creativo ES la segmentación**: el contenido le dice al algoritmo quién es el público objetivo
- Señal de cuenta sana: sin intereses, sin Lookalikes, sin exclusiones de audiencias

### Estructura de cuenta (metodología Algoritmia)
- **Campaña = Buyer Persona**: cada campaña apunta a un segmento de cliente específico (quién es, qué desea, qué le duele)
- **Conjunto de anuncios = Punto de dolor**: cada conjunto aborda un problema concreto de ese buyer persona
- **Anuncios = Mensaje por nivel de consciencia**: los creativos dentro del conjunto hablan al mismo dolor pero desde distintos niveles (Inconsciente → Problema → Solución → Producto → Decisión)
- **CBO obligatorio** (Campaign Budget Optimization): gestiona presupuesto en tiempo real donde hay oportunidad
- **ABO = ineficiente**: fuerza gasto donde puede no haber oportunidad real ese día
- Ubicaciones: **Advantage+ automático** en todos los conjuntos (Meta decide el placement óptimo)

### Escalado: Regla del 5%
- Aumentar presupuesto CBO un **5% tres veces por semana** (≈20% semanal distribuido)
- Así se evita reiniciar la Fase de Aprendizaje y desestabilizar costos
- Antes de escalar: "¿Puedo gastar más mañana sin perder rentabilidad?" → Si Sí: aumentar | Si No: testear nuevos ángulos creativos

### ROAS de plataforma = métrica de vanidad
- Mirar siempre: **Blended ROAS / MER** (ingresos totales ÷ inversión total en publicidad)
- Hay que saber siempre el CPA máximo permitido según el margen real + LTV del cliente

### El Ladrón de Crédito
- Anuncios de retargeting agresivo o cupones parecen ganadores → pero solo le aparecen a personas que ya iban a comprar → "roban el crédito" a los videos de prospección
- Solución correcta: todos los anuncios (TOFU + decisión) en el **mismo CBO Broad** → Meta gestiona el viaje completo del cliente sin fragmentation

### Reglas inquebrantables
1. **No tocar la campaña si funciona** — cada cambio manual reinicia el aprendizaje
2. **No usar exclusiones** — no excluir compradores anteriores ni visitantes. Dejar al algoritmo decidir
3. **Huir de la "Estrategia del Cazador"** — no buscar éxito rápido. Ser "Granjero": plantar buenos creativos y dejar que el Social Proof crezca
4. Un anuncio que aparece solo a gente que ya iba a comprar no es ganador: es un ladrón de crédito

---

## BENCHMARKS META ADS
- **CTR de enlace**: bueno ≥1.5% | aceptable 1–1.5% | malo <1% ← este sí es universal (porcentaje, no depende de moneda ni nicho)
- **Frecuencia**: OK ≤2.5 | atención 2.5–3.5 | fatiga >3.5 ← universal
- **CPM**: benchmark según moneda → ARS: bueno <10.000 | USD: bueno <15. Para otras monedas, evaluá relativo al alcance obtenido.
- **CPC, CPA**: sin umbral fijo — dependen del ticket promedio del negocio. Evaluá si el costo por resultado es sostenible dado el margen del cliente.
- **ROAS**: depende del margen del negocio. Un ROAS de 2 puede ser excelente con márgenes altos y malo con márgenes bajos.
- **CTR ≥ 1.5%** y **Frecuencia ≤ 2.5** sí son benchmarks universales (son ratios, no dependen de moneda ni nicho).

---

## REGLAS DE COMUNICACIÓN
- Respondé SIEMPRE en español argentino natural y profesional
- Usá Markdown: **negrita** para términos clave, ## para secciones, - para listas
- Sé directo y accionable. Cada respuesta debe tener un "qué hacer" concreto
- NO uses frases vacías como "excelente pregunta" o "es importante mencionar"
- Nombrá cada campaña exactamente como aparece en los datos
- Cuantificá siempre: no "el CTR es bajo" → "el CTR es 0.75% cuando el benchmark es ≥1.5%"
- NUNCA inventes datos. Evaluá estrictamente lo que ves en los números: Gasto, ROAS, CTR, CPM, Frecuencia, Alcance, CPA. No asumas nada sobre configuración interna (CBO, ABO, targeting, exclusiones) que no esté explícitamente en los datos.
- Para cada campaña: MANTENER / ESCALAR / EVALUAR / PAUSAR / DESACTIVAR con razón concreta`;
};

const ACTION_STYLES: Record<string, string> = {
  MANTENER:   'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  ESCALAR:    'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  EVALUAR:    'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  PAUSAR:     'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  DESACTIVAR: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
};

const PIE_COLORS = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#3b82f6','#ef4444','#14b8a6','#f97316','#84cc16'];

// ── Funnel Badge with rich tooltip ───────────────────────────────────────────
const FunnelBadge: React.FC<{
  stage: 'TOFU'|'MOFU'|'BOFU';
  info: { reason: string; description: string };
  ins?: any;
  currency?: string;
  size?: 'xs' | 'sm';
}> = ({ stage, info, ins, currency = 'ARS', size = 'xs' }) => {
  const styles = {
    TOFU: { badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-800' },
    MOFU: { badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-800' },
    BOFU: { badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-800' },
  };
  const s = styles[stage];
  const textSize = size === 'xs' ? 'text-[7px]' : 'text-[9px]';
  const ctr = ins ? parseFloat(ins.inline_link_click_ctr || 0) : null;
  const freq = ins ? parseFloat(ins.frequency || 0) : null;
  const roas = ins?.purchase_roas?.[0]?.value ? parseFloat(ins.purchase_roas[0].value) : null;
  const spend = ins ? parseFloat(ins.spend || 0) : null;
  const cpm = ins ? parseFloat(ins.cpm || 0) : null;
  const reach = ins?.reach ? parseInt(ins.reach) : null;
  const score = ins ? calcPerfScore(ins, currency) : null;
  const scoreColor = score !== null ? (score >= 70 ? 'text-emerald-600' : score >= 45 ? 'text-amber-500' : 'text-red-500') : '';

  const benchmarks: Record<string, { ctr: number; freq: number }> = {
    TOFU: { ctr: 0.8, freq: 3 }, MOFU: { ctr: 1.0, freq: 4 }, BOFU: { ctr: 1.5, freq: 3.5 },
  };
  const bench = benchmarks[stage];

  return (
    <div className="relative group inline-flex flex-shrink-0">
      <span className={`${textSize} font-bold px-1 py-0.5 rounded cursor-help ${s.badge}`}>{stage}</span>
      {/* Tooltip */}
      <div className={`absolute bottom-full left-0 mb-2 w-64 bg-zinc-900 dark:bg-zinc-800 text-white rounded-xl shadow-2xl border ${s.border} opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 z-[100]`}
           style={{ minWidth: '240px' }}>
        {/* Header */}
        <div className={`px-3 py-2 border-b border-zinc-700 flex items-center justify-between`}>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${s.badge}`}>{stage}</span>
          {score !== null && <span className={`text-[11px] font-bold ${scoreColor}`}>Score {score}</span>}
        </div>
        {/* Description */}
        <div className="px-3 py-2 border-b border-zinc-700/50">
          <p className="text-[10px] text-zinc-300 leading-snug">{info.description}</p>
          <p className="text-[9px] text-zinc-500 mt-1">{info.reason}</p>
        </div>
        {/* Metrics */}
        {ins && (
          <div className="px-3 py-2 grid grid-cols-2 gap-1.5">
            {spend !== null && spend > 0 && <div><p className="text-[8px] text-zinc-500 uppercase">Gasto</p><p className="text-[11px] font-bold text-white">{fmtNum(spend, 0)} {currency}</p></div>}
            {reach !== null && <div><p className="text-[8px] text-zinc-500 uppercase">Alcance</p><p className="text-[11px] font-bold text-white">{reach.toLocaleString('es-AR')}</p></div>}
            {ctr !== null && ctr > 0 && <div><p className="text-[8px] text-zinc-500 uppercase">CTR</p><p className={`text-[11px] font-bold ${ctr >= bench.ctr ? 'text-emerald-400' : 'text-red-400'}`}>{fmtNum(ctr, 2)}% {ctr >= bench.ctr ? '✓' : `↓ bench ${bench.ctr}%`}</p></div>}
            {freq !== null && freq > 0 && <div><p className="text-[8px] text-zinc-500 uppercase">Frecuencia</p><p className={`text-[11px] font-bold ${freq <= bench.freq ? 'text-emerald-400' : 'text-red-400'}`}>{fmtNum(freq, 2)} {freq > bench.freq ? '⚠ alta' : '✓'}</p></div>}
            {cpm !== null && cpm > 0 && <div><p className="text-[8px] text-zinc-500 uppercase">CPM</p><p className="text-[11px] font-bold text-white">{fmtNum(cpm, 0)} {currency}</p></div>}
            {roas !== null && roas > 0 && <div><p className="text-[8px] text-zinc-500 uppercase">ROAS</p><p className={`text-[11px] font-bold ${roas >= 2 ? 'text-emerald-400' : roas >= 1 ? 'text-amber-400' : 'text-red-400'}`}>{fmtNum(roas, 2)}</p></div>}
          </div>
        )}
        {!ins && <p className="px-3 py-2 text-[10px] text-zinc-500 italic">Sin métricas en el período seleccionado</p>}
        {/* Arrow */}
        <div className="absolute top-full left-3 border-4 border-transparent border-t-zinc-900 dark:border-t-zinc-800" />
      </div>
    </div>
  );
};

const FUNNEL_STYLES = {
  TOFU: { badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300', row: 'bg-blue-50/20 dark:bg-blue-900/5', dot: 'bg-blue-400', label: 'TOFU', desc: 'Frío — Atraer' },
  MOFU: { badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', row: 'bg-amber-50/20 dark:bg-amber-900/5', dot: 'bg-amber-400', label: 'MOFU', desc: 'Tibio — Considerar' },
  BOFU: { badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300', row: 'bg-emerald-50/20 dark:bg-emerald-900/5', dot: 'bg-emerald-400', label: 'BOFU', desc: 'Caliente — Cerrar' },
} as const;
type FunnelStage = 'TOFU' | 'MOFU' | 'BOFU';

function classifyFunnel(objective: string, optimizationGoal?: string, name?: string): FunnelStage {
  return getFunnelInfo(objective, optimizationGoal, name).stage;
}

interface FunnelInfo { stage: FunnelStage; reason: string; description: string; }
function getFunnelInfo(objective: string, optimizationGoal?: string, name?: string): FunnelInfo {
  const obj  = (objective || '').toUpperCase();
  const goal = (optimizationGoal || '').toUpperCase();
  const n    = (name || '').toLowerCase();
  const hasGoal = optimizationGoal && optimizationGoal.trim() !== '' && optimizationGoal.toUpperCase() !== 'NONE';
  const reasonStr = `Obj: ${objective || '—'} | Opt: ${optimizationGoal || 'sin dato'}`;

  // 0 — Hints por nombre del conjunto/campaña (override explícito)
  if (/\btofu\b|prospect|frio|fría|awareness|brand|intro|cold/.test(n))
    return { stage: 'TOFU', reason: `${reasonStr} | Nombre: TOFU`, description: 'TOFU detectado por nombre del conjunto. Audiencia fría — reconocimiento de marca. Benchmark: CTR >0.8%.' };
  if (/\bmofu\b|tibi|conside|traffic|tráfico|visit|visit|remark|retarg.*mofu|engag/.test(n))
    return { stage: 'MOFU', reason: `${reasonStr} | Nombre: MOFU`, description: 'MOFU detectado por nombre. Audiencia tibia — consideración. Benchmark: CTR >1%.' };
  if (/\bbofu\b|hot|caliente|conver|retarget|remarketing|custom.?aud/.test(n))
    return { stage: 'BOFU', reason: `${reasonStr} | Nombre: BOFU`, description: 'BOFU detectado por nombre. Audiencia caliente — conversión directa. Benchmark: CTR >1.5%.' };

  // 1 — TOFU: alcance puro, awareness, impresiones
  const tofuGoals = ['REACH', 'IMPRESSIONS', 'BRAND_AWARENESS', 'AD_RECALL_LIFT'];
  const tofuObjs  = ['OUTCOME_AWARENESS', 'OUTCOME_REACH', 'AWARENESS', 'REACH'];
  if (tofuGoals.some(k => goal.includes(k)) || tofuObjs.some(k => obj.includes(k)))
    return { stage: 'TOFU', reason: reasonStr, description: 'TOFU — optimización para alcance/awareness. Audiencia fría, sin conversión directa. Benchmark: CTR >0.8%, Frec <3.' };

  // 2 — MOFU: consideración, tráfico, engagement, video, mensajes, clics
  const mofuGoals = [
    'LINK_CLICKS', 'LINK_CLICK',            // tráfico
    'LANDING_PAGE_VIEWS', 'LANDING_PAGE',   // vistas de página
    'POST_ENGAGEMENT', 'PAGE_ENGAGEMENT',   // engagement
    'VIDEO_VIEWS', 'THRUPLAY',              // video
    'PAGE_LIKES',                           // likes de página
    'CONVERSATIONS', 'REPLIES',             // mensajes
    'MESSAGING_APPOINTMENT',                // citas por mensaje
    'EVENT_RESPONSES',                      // eventos
    'VISIT_INSTAGRAM_PROFILE',              // perfil IG
  ];
  const mofuObjs = ['OUTCOME_TRAFFIC', 'OUTCOME_ENGAGEMENT', 'TRAFFIC', 'ENGAGEMENT', 'VIDEO_VIEWS', 'MESSAGES'];
  if (mofuGoals.some(k => goal.includes(k)) || mofuObjs.some(k => obj.includes(k) || goal.includes(k)))
    return { stage: 'MOFU', reason: reasonStr, description: 'MOFU — optimización para consideración / tráfico. Audiencia tibia. Benchmark: CTR >1%, Frec <4.' };

  // 3 — BOFU: conversiones directas, leads, compras, valor
  const bofuGoals = [
    'OFFSITE_CONVERSIONS', 'OFFSITE_CONVERSION',
    'VALUE', 'PURCHASE_ROAS',
    'LEAD_GENERATION', 'QUALITY_LEAD', 'QUALIFIED_LEAD', 'CONVERTED_LEAD',
    'MESSAGING_PURCHASE',
    'APP_INSTALLS', 'APP_INSTALL',
    'IN_STORE_SALES', 'STORE_VISITS',
    'CATALOG_SALES',
  ];
  if (bofuGoals.some(k => goal.includes(k)))
    return { stage: 'BOFU', reason: reasonStr, description: 'BOFU — optimización directa para conversión/lead. Audiencia caliente. Benchmark: CTR >1.5%, Frec <3.5.' };

  // 4 — Fallback por objetivo de campaña (solo si NO hay optimization_goal válido)
  //     Si hay goal pero no matcheó nada de BOFU → es MOFU por defecto, no BOFU
  if (!hasGoal) {
    const bofuObjKeys = ['OUTCOME_SALES', 'OUTCOME_LEADS', 'OUTCOME_APP', 'SALES', 'OUTCOME_CONVERSION'];
    if (bofuObjKeys.some(k => obj.includes(k)))
      return { stage: 'BOFU', reason: `${reasonStr} — inferido por objetivo (sin optimization_goal)`, description: 'BOFU inferido por objetivo de campaña (sin optimization_goal disponible). Benchmark: CTR >1.5%.' };
  }

  // 5 — Default: MOFU (no BOFU — mejor clasificación neutral)
  return { stage: 'MOFU', reason: `${reasonStr} — sin dato suficiente`, description: 'Clasificación MOFU por defecto — optimization_goal no reconocido. Revisá la config del conjunto.' };
}

function funnelBadPerf(stage: FunnelStage, ins: any): string[] {
  if (!ins) return [];
  const issues: string[] = [];
  const ctr = parseFloat(ins.inline_link_click_ctr || 0);
  const freq = parseFloat(ins.frequency || 0);
  const roas = parseFloat(ins.purchase_roas?.[0]?.value || 0);
  const spend = parseFloat(ins.spend || 0);
  const cpm = parseFloat(ins.cpm || 0);
  const actions: any[] = ins.actions || [];
  const hasAnyResult = actions.some((a: any) =>
    ['lead','offsite_conversion.fb_pixel_purchase','omni_purchase','onsite_conversion.lead_grouped',
     'onsite_conversion.messaging_conversation_started_7d','offsite_conversion.fb_pixel_lead'].includes(a.action_type)
    && parseFloat(a.value || 0) > 0
  );
  if (stage === 'TOFU') {
    if (ctr > 0 && ctr < 0.8) issues.push('CTR bajo para TOFU');
    if (freq > 3.5) issues.push('Frecuencia alta — rotar');
    if (ctr === 0 && spend > 200) issues.push('Sin clics — creativo frío');
  } else if (stage === 'MOFU') {
    if (ctr > 0 && ctr < 0.5) issues.push('CTR muy bajo');
    if (freq > 4) issues.push('Frecuencia alta — rotar');
  } else {
    // BOFU: evaluar según el tipo de conversión real
    if (roas > 0 && roas < 1) issues.push('ROAS < 1 — pierde dinero');
    if (spend > 500 && roas === 0 && !hasAnyResult) issues.push('Sin conversiones — revisar pixel');
    if (freq > 4) issues.push('Frecuencia alta — saturado');
    if (ctr > 0 && ctr < 0.5) issues.push('CTR muy bajo');
    if (cpm > 0 && roas === 0 && !hasAnyResult && spend > 1000) issues.push('CPM sin retorno');
  }
  return issues;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const getMetaVal = (actions: any[], ...types: string[]): string | null => {
  for (const t of types) {
    const v = actions?.find((a: any) => a.action_type === t)?.value;
    if (v != null) return v;
  }
  return null;
};

const fmtNum = (v: any, decimals = 0): string => {
  const n = parseFloat(v || 0);
  if (isNaN(n)) return '—';
  return n.toLocaleString('es-AR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};

// Returns the primary result matching Meta Ads Manager — strictly objective-based
function getPrimaryMetric(objective: string, ins: any): { label: string; value: string; cost: string } {
  const obj = (objective || '').toLowerCase();
  const actions = ins?.actions || [];
  const spend = parseFloat(ins?.spend || 0);
  const costPer = (val: string) => {
    const n = parseFloat(val);
    return spend > 0 && n > 0 ? '$' + (spend / n).toFixed(0) : '—';
  };
  const first = (v: string | null | undefined) => v || '0';
  const getV = (...types: string[]) => first(getMetaVal(actions, ...types));

  let label = 'Resultado';
  let v = '0';

  if (obj.includes('sales') || obj.includes('conversion')) {
    v = getV('offsite_conversion.fb_pixel_purchase', 'omni_purchase', 'purchase', 'onsite_conversion.purchase');
    label = 'Compras';
  } else if (obj.includes('lead')) {
    v = getV('lead', 'offsite_conversion.fb_pixel_lead', 'onsite_conversion.lead_grouped');
    label = 'Leads';
  } else if (obj.includes('engagement')) {
    const msgs = getV('onsite_conversion.messaging_conversation_started_7d', 'onsite_conversion.messaging_first_reply');
    if (parseFloat(msgs) > 0) {
      v = msgs; label = 'Mensajes';
    } else {
      v = getV('post_engagement', 'page_engagement');
      label = 'Interacciones';
    }
  } else if (obj.includes('traffic') || obj.includes('link_click')) {
    v = ins?.inline_link_clicks || '0';
    label = 'Clics';
  } else if (obj.includes('awareness') || obj.includes('reach')) {
    v = String(parseInt(ins?.reach || 0));
    label = 'Alcance';
  } else if (obj.includes('video')) {
    v = first(ins?.video_thruplay_watched_actions?.[0]?.value);
    label = 'ThruPlays';
  } else if (obj.includes('app')) {
    v = getV('mobile_app_install', 'app_install');
    label = 'Instalaciones';
  }

  // Fallback inteligente: si la métrica principal dio 0 (ej. Sales sin compras sino mensajes, o Leads en 0)
  // priorizamos conversiones secundarias reales que sí ocurrieron en la campaña
  if (parseFloat(v) === 0) {
    const purch = getV('offsite_conversion.fb_pixel_purchase', 'omni_purchase', 'purchase', 'onsite_conversion.purchase');
    if (parseFloat(purch) > 0) { v = purch; label = 'Compras'; } else {
      const msgs = getV('onsite_conversion.messaging_conversation_started_7d', 'onsite_conversion.messaging_first_reply');
      if (parseFloat(msgs) > 0) { v = msgs; label = 'Mensajes'; } else {
        const leads = getV('lead', 'offsite_conversion.fb_pixel_lead', 'onsite_conversion.lead_grouped');
        if (parseFloat(leads) > 0) { v = leads; label = 'Leads'; } else {
          const clicks = ins?.inline_link_clicks || '0';
          if (parseFloat(clicks) > 0) { v = clicks; label = 'Clics'; } else {
            if (actions.length > 0) { v = actions[0]?.value || '0'; label = 'Resultado'; }
          }
        }
      }
    }
  }

  if (label === 'Alcance' || label === 'Impresiones') {
    return { label, value: v, cost: '—' };
  }
  return { label, value: v, cost: costPer(v) };
}

function buildCampDataString(camps: any[], insights: Record<string, any>): string {
  return camps.map((c: any) => {
    const ins = insights[c.id];
    if (!ins) return `${c.name} [${c.status}|${c.objective||'—'}] — Sin datos en el período`;
    const metric = getPrimaryMetric(c.objective || '', ins);
    const roas = ins.purchase_roas?.[0]?.value ? fmtNum(ins.purchase_roas[0].value, 2) : '—';
    const atc = getMetaVal(ins.actions || [], 'offsite_conversion.fb_pixel_add_to_cart', 'add_to_cart') || '0';
    const valorRes = getMetaVal(ins.action_values || [], 'offsite_conversion.fb_pixel_purchase', 'omni_purchase', 'purchase', 'lead', 'offsite_conversion.fb_pixel_lead') || '—';
    return `${c.name} [${c.status}|${c.objective||'—'}] | Gasto: ${fmtNum(ins.spend, 0)} | Resultado: ${metric.label}=${metric.value} | Costo/R: ${metric.cost} | Valor conversiones: ${valorRes} | ROAS: ${roas} | Alcance: ${ins.reach || '0'} | CTR: ${fmtNum(ins.inline_link_click_ctr, 2)}% | CPM: ${fmtNum(ins.cpm, 0)} | CPC: ${fmtNum(ins.cpc, 0)} | Frecuencia: ${fmtNum(ins.frequency, 2)} | Impresiones: ${ins.impressions || '0'}`;
  }).join('\n');
}

function parseActionsFromAnalysis(text: string, camps: any[]): Record<string, { action: string; reason: string }> {
  const result: Record<string, { action: string; reason: string }> = {};
  const keywords = ['MANTENER', 'ESCALAR', 'EVALUAR', 'PAUSAR', 'DESACTIVAR'];
  for (const camp of camps) {
    const nameEsc = camp.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Try to match: CampaignName ... ACTION — reason
    const regex = new RegExp(`${nameEsc}[^\\n]*?(MANTENER|ESCALAR|EVALUAR|PAUSAR|DESACTIVAR)[^\\n—]*?(?:—\\s*([^\\n]+))?`, 'i');
    const match = text.match(regex);
    if (match) {
      result[camp.id] = { action: match[1].toUpperCase(), reason: (match[2] || '').trim() };
    } else {
      // Fallback: search anywhere in text
      for (const kw of keywords) {
        const kwRegex = new RegExp(`${nameEsc}[^\\n]*?${kw}[^\\n—]*?(?:—\\s*([^\\n]+))?`, 'i');
        const kwMatch = text.match(kwRegex);
        if (kwMatch) {
          result[camp.id] = { action: kw, reason: (kwMatch[1] || '').trim() };
          break;
        }
        if (text.toLowerCase().includes(kw.toLowerCase()) && text.toLowerCase().includes(camp.name.toLowerCase())) {
          result[camp.id] = { action: kw, reason: '' };
          break;
        }
      }
    }
  }
  return result;
}

function buildAnalysisPrompt(accountId: string, period: string, campData: string, accountName: string, currency = 'USD'): string {
  const isUSD = currency === 'USD';
  return `🚨 INSTRUCCIÓN CRÍTICA DE MONEDA: Esta cuenta opera en ${currency}.
Es OBLIGATORIO que todo tu análisis, referencias de costos, rentabilidad y benchmarks estén calibrados 100% en ${currency}.
${!isUSD ? `Al ser ${currency}, NO uses parámetros ni benchmarks de USD. Un CPM o CPA que parece altísimo en USD puede ser excelente o muy barato en ${currency}. Procesá los números de forma relativa a la moneda local.` : 'Al ser USD, utilizá los benchmarks estándar.'}
Primero verificá que estás razonando en ${currency}, y RECIÉN AHÍ hacé el análisis de los datos.

Analizá esta cuenta de Meta Ads aplicando el método Andromeda de Charley T como marco principal.

CUENTA: ${accountName} (${accountId})
MONEDA PRINCIPAL PARA EL ANÁLISIS: ${currency}
PERÍODO: ${period}

DATOS DE CAMPAÑAS (incluye conjuntos de anuncios y anuncios individuales):
${campData}

Generá el análisis con estas secciones. Usá emojis de semáforo para marcar el estado rápidamente: 🟢 bien, 🟡 atencion, 🔴 problema critico.

## DIAGNÓSTICO GENERAL
Estado de la cuenta en 3-4 líneas: inversión total, ROAS blended, CTR cuenta, frecuencia. Benchmarks: CTR >1.5% bueno, >2.5% excelente. Frecuencia <2.5 ok, >3.5 fatiga crítica. Una frase de diagnóstico general con emoji de semáforo.

## ANÁLISIS POR CAMPAÑA (detalle completo)
IMPORTANTE: En los datos, los nombres vienen entre comillas: CAMPAÑA "Nombre Real", CONJUNTO "Nombre Real", ANUNCIO "Nombre Real". Usá EXACTAMENTE ese texto entre comillas, sin agregar Estado, Objetivo, funnel ni ningún otro sufijo.

Para CADA campaña en los datos, hacer un bloque así:

### [nombre entre comillas tal como aparece] — 🟢/🟡/🔴 MANTENER/ESCALAR/EVALUAR/PAUSAR
**Métricas clave:** Gasto: X | ROAS: X | CTR: X% | Frecuencia: X | CPM: X
**Veredicto en 1 línea:** [razón con número concreto que lo justifica]

**Conjuntos de anuncios:**
Para cada conjunto con datos, una línea:
- [nombre del conjunto entre comillas]: 🟢/🟡/🔴 Gasto=X | CTR=X% | Frec=X | [acción: mantener/testear/pausar] — [razón en 5 palabras]

**Anuncios individuales:**
Para cada anuncio con datos, una línea:
- [nombre del anuncio entre comillas] ([TOFU/MOFU/BOFU]): 🟢/🟡/🔴 Gasto=X | CTR=X% | [problema si existe] — [acción concreta]
Si un anuncio tiene alertas detectadas (alta frecuencia, CTR bajo, ROAS negativo), marcarlo con 🔴 y explicar brevemente.
Si no tiene datos en el período, indicar: ⚫ Sin gasto en período

## PROBLEMAS DETECTADOS (según Andromeda)
Los 3-5 problemas concretos marcados con 🔴: estructura incorrecta, métricas fuera de benchmark, posibles "ladrones de crédito", fase de aprendizaje reiniciada, presupuesto mal distribuido, fragmentación excesiva, etc.
Cada problema: **Problema:** descripción | **Evidencia:** número concreto | **Impacto:** consecuencia

## OPORTUNIDADES INMEDIATAS
3 acciones marcadas con 🟢, ordenadas por impacto esperado:
1. **[Qué hacer]** → [Por qué] → [Resultado esperado con estimación]
2. ...
3. ...

## PRÓXIMO PASO ESTA SEMANA
Una sola acción. Concisa, accionable, con la campaña o conjunto exacto a modificar.

Sé específico: usá números reales de los datos, nombrá campañas y anuncios exactamente, siempre compará contra benchmarks. Si un conjunto o anuncio no tiene datos en el período, indicarlo con ⚫ y no inventar métricas.`;
}

function buildCreativityPrompt(campData: string, accountName: string, period: string, currency = 'USD'): string {
  return `🚨 INSTRUCCIÓN CRÍTICA DE MONEDA: Esta cuenta opera en ${currency}.
Ajustá cualquier comentario sobre costos creativos, inversión o rentabilidad a esta moneda. No asumas USD si la moneda es otra.

Analizá la estrategia creativa de la cuenta ${accountName} (${period}) aplicando el framework de Charley T.

DATOS:
${campData}

## ESTADO CREATIVO GENERAL
CTR promedio vs benchmark (≥1.5%), frecuencia, señales de fatiga creativa.

## ESTRUCTURA CREATIVA (Metodología Algoritmia)
La estructura correcta es: Campaña = Buyer Persona, Conjunto = Punto de dolor, Creativos = Mensajes para distintos niveles de consciencia (Inconsciente / Problema / Solución / Producto / Decisión).
Basándote SOLO en los datos de CTR, frecuencia y rendimiento por campaña: ¿los anuncios parecen estar hablándole a públicos específicos o son genéricos? ¿Hay señales de que todos los anuncios dicen lo mismo (misma tasa de CTR, misma frecuencia) o hay variación que sugiere mensajes diferenciados?

## EL CREATIVO COMO SEGMENTACIÓN
¿El CTR y el alcance sugieren que los creativos actuales le "hablan" claramente a un perfil específico? ¿Un dolor o deseo concreto que permite al algoritmo encontrar al público correcto? Evaluá esto solo desde los números, no desde los nombres.

## SEÑALES DE "LADRÓN DE CRÉDITO"
¿Hay anuncios de retargeting agresivo, cupones o descuentos directos corriendo por separado? Si los hay, explicar el riesgo y recomendar integrarlos al CBO Broad principal.

## SOCIAL PROOF Y POST ID
¿Los anuncios ganadores acumulan likes/comentarios/compartidas? ¿Se están usando Post IDs para preservar esa prueba social? Si no, qué perder por no hacerlo.

## 5 IDEAS DE CREATIVOS A TESTEAR
Para cada idea: formato (video/imagen/carrusel), ángulo del mensaje, nivel de consciencia del avatar (Inconsciente / Problema / Solución / Producto / Decisión), y gancho de los primeros 3 segundos.`;
}

function buildClientCampData(camps: any[], insights: Record<string, any>): string {
  return camps.map((c: any) => {
    const ins = insights[c.id];
    if (!ins || parseFloat(ins.spend || '0') <= 0) return null;
    const metric = getPrimaryMetric(c.objective || '', ins);
    const roas = ins.purchase_roas?.[0]?.value ? fmtNum(ins.purchase_roas[0].value, 2) : '—';
    return `Campaña: ${c.name}\n  Gasto: ${fmtNum(ins.spend, 0)} | Resultado: ${metric.label}=${metric.value} | Costo/Resultado: ${metric.cost} | ROAS: ${roas} | Alcance: ${ins.reach || '0'} | CTR: ${fmtNum(ins.inline_link_click_ctr, 2)}% | Impresiones: ${ins.impressions || '0'} | Clicks: ${ins.clicks || '0'}`;
  }).filter(Boolean).join('\n');
}

const getCpmThreshold = (currency: string) => currency === 'ARS' ? 10000 : 15;

function calcPerfScore(ins: any, currency: string): number {
  // Score 0-100 basado en todas las métricas — no solo conversiones
  // CTR: engagement del creativo (25pts)
  // CPM: eficiencia de entrega (15pts)
  // Frecuencia: saturación de audiencia (20pts)
  // Resultados relativos: lead/compra/click por cada 1000 ARS/USD invertidos (20pts)
  // ROAS: solo si hay datos de compra (20pts)
  if (!ins || parseFloat(ins.spend || '0') <= 0) return 0;
  const cpmThreshold = getCpmThreshold(currency);
  let score = 50;
  const ctr = parseFloat(ins.inline_link_click_ctr || 0);
  const roas = ins.purchase_roas?.[0]?.value ? parseFloat(ins.purchase_roas[0].value) : 0;
  const freq = parseFloat(ins.frequency || 0);
  const cpm = parseFloat(ins.cpm || 0);
  const spend = parseFloat(ins.spend || 0);
  const actions: any[] = ins.actions || [];
  // Contar resultados de cualquier tipo (leads, compras, mensajes)
  const totalResults = actions
    .filter((a: any) => ['lead','offsite_conversion.fb_pixel_purchase','omni_purchase',
      'onsite_conversion.lead_grouped','onsite_conversion.messaging_conversation_started_7d',
      'offsite_conversion.fb_pixel_lead','link_click'].includes(a.action_type))
    .reduce((s: number, a: any) => s + parseFloat(a.value || 0), 0);
  const costPerResult = totalResults > 0 ? spend / totalResults : 0;

  // CTR — señal de engagement del creativo (±20)
  if (ctr >= 2.5) score += 20;
  else if (ctr >= 1.5) score += 12;
  else if (ctr >= 1) score += 5;
  else if (ctr >= 0.5) score -= 8;
  else if (ctr > 0) score -= 18;

  // Frecuencia — saturación de audiencia (solo penaliza, no premia)
  if (freq > 5) score -= 25;
  else if (freq > 4) score -= 18;
  else if (freq > 3.5) score -= 12;
  else if (freq > 2.5) score -= 5;

  // CPM — eficiencia de entrega (±10)
  if (cpm > 0 && cpm < cpmThreshold * 0.5) score += 8;
  else if (cpm > cpmThreshold * 2) score -= 12;
  else if (cpm > cpmThreshold * 1.5) score -= 7;
  else if (cpm > cpmThreshold) score -= 3;

  // ROAS — solo si hay datos de compra (±20)
  if (roas >= 4) score += 20;
  else if (roas >= 2.5) score += 12;
  else if (roas >= 1.5) score += 6;
  else if (roas > 0 && roas < 1) score -= 18;

  // Eficiencia relativa: resultados por unidad de gasto (±8)
  // Si tiene resultados sin datos de compra, al menos suma algo
  if (roas === 0 && costPerResult > 0) {
    const efficiency = (currency === 'ARS' ? 1000 : 1) / costPerResult;
    if (efficiency > 0.5) score += 8;
    else if (efficiency > 0.1) score += 4;
  }

  return Math.max(0, Math.min(100, score));
}

// ── Detect campaign objectives ────────────────────────────────────────────────
type CampaignObjectiveType = 'sales' | 'leads' | 'traffic' | 'messages' | 'engagement' | 'awareness' | 'mixed';

function classifyObjective(objective: string, actions?: any[]): Exclude<CampaignObjectiveType, 'mixed'> {
  const obj = (objective || '').toUpperCase();
  if (obj.includes('SALES') || obj.includes('CONVERSION') || obj.includes('PRODUCT_CATALOG') || obj.includes('STORE_VISIT')) return 'sales';
  if (obj.includes('LEAD')) return 'leads';
  if (obj.includes('TRAFFIC') || obj.includes('LINK_CLICK')) return 'traffic';
  if (obj.includes('MESSAGE')) return 'messages';
  if (obj.includes('ENGAGEMENT') || obj.includes('POST_ENGAGEMENT') || obj.includes('PAGE_LIKE')) {
    // Detect Click-to-WhatsApp campaigns: Meta uses OUTCOME_ENGAGEMENT objective
    // but the real optimized metric is messaging conversations, not post_engagement
    if (actions && actions.length > 0) {
      const msgs = parseFloat(getMetaVal(actions,
        'onsite_conversion.messaging_conversation_started_7d',
        'onsite_conversion.messaging_first_reply') || '0');
      if (msgs > 0) return 'messages';
    }
    return 'engagement';
  }
  if (obj.includes('AWARENESS') || obj.includes('REACH') || obj.includes('BRAND') || obj.includes('VIDEO_VIEW')) return 'awareness';
  return 'sales'; // default
}

// Returns all active objective types sorted by spend descending (no 'mixed')
function detectActiveObjectives(camps: any[], insights: Record<string, any>): Exclude<CampaignObjectiveType, 'mixed'>[] {
  const spend: Record<string, number> = {};
  for (const c of camps) {
    const ins = insights[c.id];
    const s = parseFloat(ins?.spend || '0');
    if (s <= 0) continue;
    const type = classifyObjective(c.objective || '', ins?.actions || []);
    spend[type] = (spend[type] || 0) + s;
  }
  return (Object.entries(spend) as [Exclude<CampaignObjectiveType, 'mixed'>, number][])
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k);
}

function detectDominantObjective(camps: any[], insights: Record<string, any>): CampaignObjectiveType {
  const active = detectActiveObjectives(camps, insights);
  if (active.length === 0) return 'sales';
  if (active.length === 1) return active[0];
  // Check if second objective has >30% of total spend
  const spend: Record<string, number> = {};
  for (const c of camps) {
    const ins = insights[c.id];
    const s = parseFloat(ins?.spend || '0');
    if (s <= 0) continue;
    const type = classifyObjective(c.objective || '', ins?.actions || []);
    spend[type] = (spend[type] || 0) + s;
  }
  const total = Object.values(spend).reduce((a, b) => a + b, 0);
  if (total === 0) return active[0];
  const second = active[1];
  if (second && (spend[second] || 0) / total > 0.30) return 'mixed';
  return active[0];
}

function buildClientReportPrompt(camps: any[], insights: Record<string, any>, accountName: string, period: string, currency: string, accountInsights: any, prevInsights?: any, prevPeriod?: string): string {
  const campData = buildClientCampData(camps, insights);
  const curr = currency || 'ARS';
  const objType = detectDominantObjective(camps, insights);

  // ── Base metrics (always available) ──
  const totalSpend = accountInsights ? fmtNum(accountInsights.spend, 0) : '—';
  const totalReach = accountInsights?.reach ? parseInt(accountInsights.reach).toLocaleString('es-AR') : '—';
  const totalImpressions = accountInsights?.impressions ? parseInt(accountInsights.impressions).toLocaleString('es-AR') : '—';
  const freq = accountInsights ? fmtNum(accountInsights.frequency, 2) : '—';
  const ctr = accountInsights ? fmtNum(accountInsights.inline_link_click_ctr, 2) : '—';
  const ctrVal = accountInsights ? parseFloat(accountInsights.inline_link_click_ctr || '0') : 0;
  const cpm = accountInsights ? fmtNum(accountInsights.cpm, 0) : '—';
  const totalClicks = accountInsights?.inline_link_clicks ? parseInt(accountInsights.inline_link_clicks).toLocaleString('es-AR') : '—';
  const cpc = accountInsights ? fmtNum(accountInsights.cpc, 2) : '—';

  // ── Objective-specific metrics ──
  const totalPurchases = accountInsights?.actions ? (getMetaVal(accountInsights.actions, 'offsite_conversion.fb_pixel_purchase', 'omni_purchase', 'purchase') || '0') : '0';
  const totalPurchaseValue = accountInsights?.action_values ? (getMetaVal(accountInsights.action_values, 'offsite_conversion.fb_pixel_purchase', 'omni_purchase', 'purchase') || '0') : '0';
  const costPerPurchase = parseFloat(totalPurchases) > 0 && accountInsights?.spend
    ? fmtNum(parseFloat(accountInsights.spend) / parseFloat(totalPurchases), 2) : '—';
  const blendedRoas = accountInsights?.purchase_roas?.[0]?.value ? fmtNum(accountInsights.purchase_roas[0].value, 2) : '—';
  const roasVal = accountInsights?.purchase_roas?.[0]?.value ? parseFloat(accountInsights.purchase_roas[0].value) : 0;

  const totalLeads = accountInsights?.actions ? (getMetaVal(accountInsights.actions, 'lead', 'offsite_conversion.fb_pixel_lead', 'onsite_conversion.lead_grouped') || '0') : '0';
  const costPerLead = parseFloat(totalLeads) > 0 && accountInsights?.spend
    ? fmtNum(parseFloat(accountInsights.spend) / parseFloat(totalLeads), 2) : '—';

  const totalMessages = accountInsights?.actions ? (getMetaVal(accountInsights.actions,
    'onsite_conversion.messaging_conversation_started_7d',
    'onsite_conversion.messaging_first_reply') || '0') : '0';
  const costPerMessage = parseFloat(totalMessages) > 0 && accountInsights?.spend
    ? fmtNum(parseFloat(accountInsights.spend) / parseFloat(totalMessages), 2) : '—';

  const totalEngagements = accountInsights?.actions ? (getMetaVal(accountInsights.actions, 'post_engagement', 'page_engagement') || '0') : '0';
  const costPerEngagement = parseFloat(totalEngagements) > 0 && accountInsights?.spend
    ? fmtNum(parseFloat(accountInsights.spend) / parseFloat(totalEngagements), 2) : '—';

  // ── Comparison block ──
  let comparisonBlock = '';
  let prevSpend = '';
  let prevReach = '';
  if (prevInsights && prevPeriod) {
    prevSpend = fmtNum(prevInsights.spend, 0);
    prevReach = prevInsights?.reach ? parseInt(prevInsights.reach).toLocaleString('es-AR') : '—';
    const prevRoas = prevInsights?.purchase_roas?.[0]?.value ? fmtNum(prevInsights.purchase_roas[0].value, 2) : '—';
    const prevCtr = fmtNum(prevInsights.inline_link_click_ctr, 2);
    const spendDiff = prevInsights.spend && accountInsights?.spend ? ((parseFloat(accountInsights.spend) - parseFloat(prevInsights.spend)) / parseFloat(prevInsights.spend) * 100).toFixed(1) : null;
    const reachDiff = prevInsights.reach && accountInsights?.reach ? ((parseInt(accountInsights.reach) - parseInt(prevInsights.reach)) / parseInt(prevInsights.reach) * 100).toFixed(1) : null;
    comparisonBlock = `\nCOMPARACIÓN CON PERÍODO ANTERIOR (${prevPeriod}):
- Inversión anterior: ${prevSpend} ${curr}${spendDiff ? ` → variación: ${parseFloat(spendDiff) >= 0 ? '+' : ''}${spendDiff}%` : ''}
- Personas alcanzadas anterior: ${prevReach}${reachDiff ? ` → variación: ${parseFloat(reachDiff) >= 0 ? '+' : ''}${reachDiff}%` : ''}
- ROAS anterior: ${prevRoas}
- CTR anterior: ${prevCtr}%\n`;
  }

  // ── Objective-specific data block & sections ──
  const objLabels: Record<CampaignObjectiveType, string> = {
    sales: 'VENTAS / CONVERSIONES',
    leads: 'CLIENTES POTENCIALES (LEADS)',
    traffic: 'TRÁFICO AL SITIO WEB',
    messages: 'MENSAJES / CONVERSACIONES',
    engagement: 'INTERACCIÓN',
    awareness: 'RECONOCIMIENTO / ALCANCE',
    mixed: 'MIXTO (múltiples objetivos)',
  };

  let objectiveDataBlock = '';
  let section2 = '';
  let section3 = '';
  let conclusionHint = '';

  if (objType === 'sales') {
    objectiveDataBlock = `- Compras generadas: ${totalPurchases}
- Valor total en ventas: ${totalPurchaseValue} ${curr}
- Costo por compra: ${costPerPurchase} ${curr}
- ROAS: ${blendedRoas}x`;
    section2 = `## RESULTADOS DE VENTAS
En 2-3 oraciones: cuántas compras se generaron, cuánto fue el valor total en ventas, cuál fue el costo promedio por compra, y cuál fue el ROAS. Explicá el ROAS en términos simples (por cada ${curr} 1 invertido, cuánto se recuperó en ventas). ${roasVal >= 3 ? 'El ROAS es alto — mencioná que es un buen retorno.' : roasVal > 0 && roasVal < 1 ? 'El ROAS está por debajo de 1 — mencioná que no se recuperó la inversión.' : ''} Poné en **negrita** todos los números.`;
    section3 = `## CLICS Y ENGAGEMENT
En 1-2 oraciones: cuántos clics al sitio se generaron y cuál fue el CTR. Explicá el CTR en términos simples (de cada 100 personas que vieron el anuncio, cuántas hicieron clic). ${ctrVal >= 1.5 ? 'El CTR supera el 1.5% — mencioná que es un buen resultado.' : ''} Poné en **negrita** los números.`;
    conclusionHint = 'Indicá si fue una buena o mala semana en términos de ROAS y ventas. Mencioná qué campañas tuvieron más compras o mejor ROAS. Si alguna campaña gastó sin generar compras, mencionarla.';
  } else if (objType === 'leads') {
    objectiveDataBlock = `- Leads (clientes potenciales) generados: ${totalLeads}
- Costo por lead: ${costPerLead} ${curr}`;
    section2 = `## RESULTADOS DE LEADS
En 2-3 oraciones: cuántos clientes potenciales (leads) se generaron, cuál fue el costo promedio por lead, y qué campañas los generaron. Explicá en términos simples qué es un lead (una persona que mostró interés y dejó sus datos). Poné en **negrita** todos los números.`;
    section3 = `## CLICS Y ALCANCE
En 1-2 oraciones: cuántos clics al sitio se generaron, cuál fue el CTR, y cuántas impresiones tuvieron los anuncios. Poné en **negrita** los números.`;
    conclusionHint = 'Indicá si fue una buena semana en términos de generación de leads y costo por lead. Mencioná qué campañas trajeron más leads. Si alguna campaña gastó sin generar leads, mencionarla.';
  } else if (objType === 'traffic') {
    objectiveDataBlock = `- Clics al sitio: ${totalClicks}
- CTR promedio: ${ctr}%
- Costo por clic: ${cpc} ${curr}
- CPM: ${cpm} ${curr}`;
    section2 = `## RESULTADOS DE TRÁFICO
En 2-3 oraciones: cuántos clics al sitio web se generaron, cuál fue el CTR (explicar en términos simples: de cada 100 personas que vieron el anuncio, cuántas hicieron clic), y cuánto costó cada clic en promedio. ${ctrVal >= 1.5 ? 'El CTR es bueno para el sector.' : ctrVal > 0 && ctrVal < 0.8 ? 'El CTR está por debajo de lo esperado para este tipo de campaña.' : ''} Poné en **negrita** todos los números.`;
    section3 = `## ALCANCE E IMPRESIONES
En 1-2 oraciones: a cuántas personas distintas llegaron los anuncios, cuántas impresiones totales tuvieron, y cuál fue la frecuencia (cuántas veces vio el anuncio cada persona). Poné en **negrita** los números.`;
    conclusionHint = 'Indicá si fue una buena semana en términos de tráfico y costo por clic. Mencioná qué campañas generaron más clics. Si alguna campaña tuvo CTR muy bajo, mencionarla.';
  } else if (objType === 'messages') {
    objectiveDataBlock = `- Conversaciones iniciadas: ${totalMessages}
- Costo por conversación: ${costPerMessage} ${curr}
- Clics al sitio: ${totalClicks}
- CTR promedio: ${ctr}%`;
    section2 = `## RESULTADOS DE MENSAJES
En 2-3 oraciones: cuántas conversaciones se iniciaron en respuesta a los anuncios, cuánto costó cada conversación en promedio, y qué campañas generaron más mensajes. Explicá en términos simples qué representa cada conversación (una persona que hizo clic en "Enviar mensaje" o escribió al negocio). Poné en **negrita** todos los números.`;
    section3 = `## CLICS Y ALCANCE
En 1-2 oraciones: cuántos clics totales se generaron y cuál fue el CTR. Poné en **negrita** los números.`;
    conclusionHint = 'Indicá si fue una buena semana en términos de mensajes recibidos y costo por conversación. Mencioná qué campañas generaron más conversaciones.';
  } else if (objType === 'engagement') {
    objectiveDataBlock = `- Interacciones totales: ${totalEngagements}
- Costo por interacción: ${costPerEngagement} ${curr}
- Clics al sitio: ${totalClicks}
- CTR promedio: ${ctr}%`;
    section2 = `## RESULTADOS DE INTERACCIÓN
En 2-3 oraciones: cuántas interacciones totales generaron los anuncios (me gusta, comentarios, compartidos, etc.), cuánto costó cada interacción, y qué campañas tuvieron más engagement. Poné en **negrita** todos los números.`;
    section3 = `## ALCANCE E IMPRESIONES
En 1-2 oraciones: a cuántas personas distintas llegaron los anuncios, cuántas impresiones totales tuvieron, y cuál fue la frecuencia. Poné en **negrita** los números.`;
    conclusionHint = 'Indicá si fue una buena semana en términos de interacción y costo por resultado. Mencioná qué campañas generaron más engagement.';
  } else if (objType === 'awareness') {
    objectiveDataBlock = `- Impresiones totales: ${totalImpressions}
- Frecuencia: ${freq} veces por persona
- CPM (costo por 1.000 impresiones): ${cpm} ${curr}
- CTR: ${ctr}%`;
    section2 = `## ALCANCE E IMPRESIONES
En 2-3 oraciones: a cuántas personas distintas llegaron los anuncios, cuántas impresiones totales tuvieron, cuántas veces vio el anuncio cada persona en promedio (frecuencia), y cuánto costó llegar a 1.000 personas (CPM). Poné en **negrita** todos los números.`;
    section3 = `## ENGAGEMENT
En 1-2 oraciones: cuántos clics se generaron y cuál fue el CTR. Poné en **negrita** los números.`;
    conclusionHint = 'Indicá si fue una buena semana en términos de alcance y eficiencia del CPM. Mencioná qué campañas tuvieron mayor alcance.';
  } else {
    // mixed — build per-objective blocks and sections
    const activeObjs = detectActiveObjectives(camps, insights);
    const mixedDataParts: string[] = [];
    const mixedSections: string[] = [];
    const objSectionTitles: Record<string, string> = {
      sales: 'RESULTADOS DE VENTAS',
      leads: 'RESULTADOS DE LEADS (CLIENTES POTENCIALES)',
      messages: 'RESULTADOS DE MENSAJES / WHATSAPP',
      traffic: 'RESULTADOS DE TRÁFICO',
      engagement: 'RESULTADOS DE INTERACCIÓN',
      awareness: 'RESULTADOS DE ALCANCE',
    };

    // Which campaigns belong to each objective (for the prompt context)
    const campsByObj: Record<string, string[]> = {};
    for (const c of camps) {
      const ins = insights[c.id];
      if (!ins || parseFloat(ins.spend || '0') <= 0) continue;
      const type = classifyObjective(c.objective || '');
      if (!campsByObj[type]) campsByObj[type] = [];
      campsByObj[type].push(c.name);
    }

    for (const obj of activeObjs) {
      const campNames = (campsByObj[obj] || []).join(', ') || '—';
      if (obj === 'sales') {
        mixedDataParts.push(`VENTAS: Compras=${totalPurchases} | Valor ventas=${totalPurchaseValue} ${curr} | CPA=${costPerPurchase} ${curr} | ROAS=${blendedRoas}x | Campañas: ${campNames}`);
        mixedSections.push(`## ${objSectionTitles.sales}
Para las campañas de ventas (${campNames}): cuántas compras se generaron, cuál fue el valor total en ventas, el costo por compra, y el ROAS. Explicá el ROAS en términos simples. Poné en **negrita** todos los números.`);
      } else if (obj === 'leads') {
        mixedDataParts.push(`LEADS: Leads generados=${totalLeads} | Costo por lead=${costPerLead} ${curr} | Campañas: ${campNames}`);
        mixedSections.push(`## ${objSectionTitles.leads}
Para las campañas de clientes potenciales (${campNames}): cuántos leads se generaron y cuánto costó cada uno. Explicá en términos simples qué es un lead (persona que mostró interés y dejó sus datos o inició contacto). Poné en **negrita** todos los números.`);
      } else if (obj === 'messages') {
        mixedDataParts.push(`MENSAJES: Conversaciones iniciadas=${totalMessages} | Costo por conversación=${costPerMessage} ${curr} | Campañas: ${campNames}`);
        mixedSections.push(`## ${objSectionTitles.messages}
Para las campañas de mensajes/WhatsApp (${campNames}): cuántas conversaciones se iniciaron y cuánto costó cada una. Explicá en términos simples qué representa una conversación (persona que escribió o hizo clic en "Enviar mensaje"). Poné en **negrita** todos los números.`);
      } else if (obj === 'traffic') {
        mixedDataParts.push(`TRÁFICO: Clics=${totalClicks} | CTR=${ctr}% | CPC=${cpc} ${curr} | Campañas: ${campNames}`);
        mixedSections.push(`## ${objSectionTitles.traffic}
Para las campañas de tráfico (${campNames}): cuántos clics al sitio se generaron, cuál fue el CTR y el costo por clic. Poné en **negrita** todos los números.`);
      } else if (obj === 'engagement') {
        mixedDataParts.push(`INTERACCIÓN: Interacciones=${totalEngagements} | Costo/interacción=${costPerEngagement} ${curr} | Campañas: ${campNames}`);
        mixedSections.push(`## ${objSectionTitles.engagement}
Para las campañas de interacción (${campNames}): cuántas interacciones generaron los anuncios y cuánto costó cada una. Poné en **negrita** todos los números.`);
      } else if (obj === 'awareness') {
        mixedDataParts.push(`ALCANCE: Impresiones=${totalImpressions} | CPM=${cpm} ${curr} | Frecuencia=${freq} | Campañas: ${campNames}`);
        mixedSections.push(`## ${objSectionTitles.awareness}
Para las campañas de reconocimiento (${campNames}): a cuántas personas llegaron, cuántas impresiones tuvieron y cuál fue el CPM. Poné en **negrita** todos los números.`);
      }
    }

    objectiveDataBlock = mixedDataParts.join('\n');
    section2 = mixedSections[0] || '';
    section3 = mixedSections.slice(1).join('\n\n') || `## CLICS Y ENGAGEMENT\nEn 1-2 oraciones: clics totales y CTR. Poné en **negrita** los números.`;
    conclusionHint = `Esta cuenta tiene ${activeObjs.length} tipos de campaña activas. Resumí brevemente el resultado de cada tipo. Indicá cuál tuvo el mejor rendimiento relativo a la inversión.`;
  }

  return `🚨 INSTRUCCIÓN CRÍTICA DE MONEDA: Esta cuenta opera EXCLUSIVAMENTE en ${curr}. TODOS los valores monetarios deben mostrarse en ${curr}. NUNCA uses USD ni el símbolo $ sin el código de moneda ${curr}.

INSTRUCCIÓN: Generá un reporte semanal para el cliente final. El cliente no sabe de publicidad digital. Explicá todo en lenguaje simple y directo, sin jerga técnica. Describí lo que pasó con los números de forma objetiva — podés indicar si un resultado es bueno o malo en contexto, pero SIN recomendaciones de estrategia ni proyecciones futuras.

CUENTA: ${accountName}
OBJETIVO PRINCIPAL DE LAS CAMPAÑAS: ${objLabels[objType]}
PERÍODO ACTUAL: ${period}
MONEDA DE LA CUENTA: ${curr}

DATOS GLOBALES DE LA CUENTA (período actual):
- Inversión total: ${totalSpend} ${curr}
- Personas alcanzadas: ${totalReach}
- Impresiones totales: ${totalImpressions}
- Frecuencia (veces que vio el anuncio c/persona): ${freq}
- Clics al sitio: ${totalClicks}
- CTR promedio: ${ctr}%
- CPM: ${cpm} ${curr}
${objectiveDataBlock}
${comparisonBlock}
DATOS POR CAMPAÑA:
${campData}

Generá el reporte con EXACTAMENTE estas secciones (en este orden, con exactamente estos títulos):

## RESUMEN DE LA SEMANA
En 2-3 oraciones simples: cuánto se invirtió, a cuántas personas distintas llegó, cuántas impresiones totales, y la frecuencia promedio. Explicá qué significa la frecuencia. Poné en **negrita** los números clave.${prevInsights ? '\nIncluí una oración comparando con el período anterior: qué subió o bajó y en qué porcentaje.' : ''}

${section2}

${section3}

## CONCLUSIÓN
Un párrafo corto (3-4 oraciones). ${conclusionHint} Tono directo, sin tecnicismos.

Notas de formato:
- SIEMPRE usá el código de moneda ${curr} junto a los valores monetarios
- Poné en **negrita** todos los números importantes
- Tono: profesional, directo, claro para alguien sin conocimientos técnicos
- NO uses tablas — solo texto narrativo en párrafos`;
}

// ── Markdown renderer ────────────────────────────────────────────────────────
const renderInline = (txt: string): React.ReactNode => {
  const parts = txt.split(/(\*\*[^*\n]+\*\*|`[^`\n]+`)/g);
  return parts.map((p, j) => {
    if (p.startsWith('**') && p.endsWith('**'))
      return <strong key={j} className="font-semibold text-zinc-900 dark:text-white">{p.slice(2, -2)}</strong>;
    if (p.startsWith('`') && p.endsWith('`'))
      return <code key={j} className="bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded text-[11px] font-mono text-violet-600 dark:text-violet-400">{p.slice(1, -1)}</code>;
    return p;
  });
};

const renderMarkdown = (text: string): React.ReactNode => {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Table block
    if (line.trimStart().startsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trimStart().startsWith('|')) {
        tableLines.push(lines[i]);
        i++;
      }
      const isSep = (l: string) => /^\|[\s|:_-]+\|$/.test(l.trim());
      const header = tableLines[0];
      const dataRows = tableLines.slice(1).filter(l => !isSep(l));
      const cells = (row: string) => row.split('|').map(c => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
      elements.push(
        <div key={`t${i}`} className="overflow-x-auto my-4 rounded-xl border border-zinc-100 dark:border-zinc-800 shadow-sm">
          <table className="w-full text-[12px] border-collapse">
            <thead>
              <tr className="bg-violet-50 dark:bg-violet-950/40">
                {cells(header).map((c, j) => (
                  <th key={j} className="text-left px-3 py-2.5 font-bold text-violet-700 dark:text-violet-300 border-b border-violet-100 dark:border-violet-900/60">{renderInline(c)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dataRows.map((row, ri) => (
                <tr key={ri} className={`border-b border-zinc-50 dark:border-zinc-800/60 ${ri % 2 === 1 ? 'bg-zinc-50/60 dark:bg-zinc-800/20' : 'bg-white dark:bg-zinc-900'}`}>
                  {cells(row).map((c, j) => (
                    <td key={j} className="px-3 py-2 text-zinc-700 dark:text-zinc-300">{renderInline(c)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // h1
    if (line.startsWith('# ')) {
      elements.push(<h1 key={i} className="text-[20px] font-bold text-zinc-900 dark:text-white mt-5 mb-3 tracking-tight">{renderInline(line.slice(2))}</h1>);
      i++; continue;
    }
    // h2 — accent bar
    if (line.startsWith('## ')) {
      elements.push(
        <div key={i} className="flex items-center gap-2.5 mt-7 mb-3">
          <div className="w-[3px] h-5 bg-violet-500 rounded-full flex-shrink-0" />
          <h2 className="text-[14px] font-bold text-zinc-900 dark:text-white tracking-tight">{renderInline(line.slice(3))}</h2>
        </div>
      );
      i++; continue;
    }
    // h3
    if (line.startsWith('### ')) {
      elements.push(<h3 key={i} className="text-[13px] font-bold text-zinc-800 dark:text-zinc-200 mt-4 mb-1.5 flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-violet-400 inline-block" />{renderInline(line.slice(4))}</h3>);
      i++; continue;
    }
    // h4
    if (line.startsWith('#### ')) {
      elements.push(<h4 key={i} className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 mt-3 mb-1 uppercase tracking-wider">{renderInline(line.slice(5))}</h4>);
      i++; continue;
    }

    // Numbered list — group consecutive
    const numMatch = line.match(/^(\d+)\.\s+(.*)/);
    if (numMatch) {
      const items: Array<[number, string]> = [[parseInt(numMatch[1]), numMatch[2]]];
      i++;
      while (i < lines.length) {
        const m = lines[i].match(/^(\d+)\.\s+(.*)/);
        if (!m) break;
        items.push([parseInt(m[1]), m[2]]);
        i++;
      }
      elements.push(
        <ol key={`ol${i}`} className="space-y-2 my-3 ml-0.5">
          {items.map(([n, t], li) => (
            <li key={li} className="flex gap-2.5 text-[13px] text-zinc-700 dark:text-zinc-300 leading-relaxed">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 text-[10px] font-bold flex items-center justify-center mt-[1px]">{n}</span>
              <span className="flex-1">{renderInline(t)}</span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Bullet list — group consecutive
    if (line.startsWith('- ') || line.startsWith('• ') || line.startsWith('* ')) {
      const items: string[] = [line.slice(2)];
      i++;
      while (i < lines.length && (lines[i].startsWith('- ') || lines[i].startsWith('• ') || lines[i].startsWith('* '))) {
        items.push(lines[i].slice(2));
        i++;
      }
      elements.push(
        <ul key={`ul${i}`} className="space-y-1.5 my-2.5 ml-0.5">
          {items.map((item, li) => (
            <li key={li} className="flex gap-2 text-[13px] text-zinc-700 dark:text-zinc-300 leading-relaxed">
              <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-violet-400 dark:bg-violet-500 mt-[5px]" />
              <span className="flex-1">{renderInline(item)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Horizontal rule
    if (line.match(/^---+$/) || line.match(/^\*\*\*+$/)) {
      elements.push(<hr key={i} className="my-4 border-zinc-100 dark:border-zinc-800" />);
      i++; continue;
    }

    // Empty line
    if (line.trim() === '') {
      elements.push(<div key={i} className="h-1" />);
      i++; continue;
    }

    // Paragraph
    elements.push(
      <p key={i} className="text-[13px] text-zinc-700 dark:text-zinc-300 leading-relaxed mb-0.5">
        {renderInline(line)}
      </p>
    );
    i++;
  }

  return <>{elements}</>;
};

// ── Meta-style Date Picker ────────────────────────────────────
const AI_DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: 'today',        label: 'Hoy' },
  { value: 'yesterday',    label: 'Ayer' },
  { value: 'last_7d',      label: 'Últimos 7 días' },
  { value: 'last_14d',     label: 'Últimos 14 días' },
  { value: 'last_28d',     label: 'Últimos 28 días' },
  { value: 'this_month',   label: 'Este mes' },
  { value: 'last_month',   label: 'Mes anterior' },
  { value: 'last_6months', label: 'Últimos 6 meses' },
  { value: 'last_year',    label: 'Último año' },
];

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const MESES_FULL = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DIAS = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];

function diasEnMes(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function primerDia(y: number, m: number) { const d = new Date(y, m, 1).getDay(); return d === 0 ? 6 : d - 1; }
function toISO(y: number, m: number, d: number) { return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`; }

const CalMes = ({ year, month, onYearMonth, since, until, hovering, onDay, onHover, showPrev, showNext }: {
  year: number; month: number;
  onYearMonth: (y: number, m: number) => void;
  since: string; until: string; hovering: string;
  onDay: (d: string) => void; onHover: (d: string) => void;
  showPrev: boolean; showNext: boolean;
}) => {
  const total = diasEnMes(year, month);
  const offset = primerDia(year, month);
  const cells: (number|null)[] = [...Array(offset).fill(null), ...Array.from({length:total},(_,i)=>i+1)];
  while (cells.length % 7 !== 0) cells.push(null);

  const years = Array.from({length: 10}, (_, i) => new Date().getFullYear() - 3 + i);

  return (
    <div className="w-[210px]">
      {/* Month/Year header */}
      <div className="flex items-center justify-between mb-2">
        {showPrev ? (
          <button onClick={() => { const d = new Date(year, month - 1); onYearMonth(d.getFullYear(), d.getMonth()); }}
            className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-500 transition-colors">
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
        ) : <div className="w-6" />}

        <div className="flex items-center gap-1">
          <select value={month} onChange={e => onYearMonth(year, parseInt(e.target.value))}
            className="text-[12px] font-semibold text-zinc-800 dark:text-zinc-100 bg-transparent border-0 cursor-pointer focus:outline-none hover:text-blue-600 dark:hover:text-blue-400 pr-0.5">
            {MESES_FULL.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <ChevronDown className="w-3 h-3 text-zinc-400 -ml-1 pointer-events-none" />
          <select value={year} onChange={e => onYearMonth(parseInt(e.target.value), month)}
            className="text-[12px] font-semibold text-zinc-800 dark:text-zinc-100 bg-transparent border-0 cursor-pointer focus:outline-none hover:text-blue-600 dark:hover:text-blue-400 pr-0.5">
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <ChevronDown className="w-3 h-3 text-zinc-400 -ml-1 pointer-events-none" />
        </div>

        {showNext ? (
          <button onClick={() => { const d = new Date(year, month + 1); onYearMonth(d.getFullYear(), d.getMonth()); }}
            className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-500 transition-colors">
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        ) : <div className="w-6" />}
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DIAS.map(d => <div key={d} className="text-center text-[10px] font-semibold text-zinc-400 pb-0.5">{d}</div>)}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          if (!day) return <div key={i} className="h-7" />;
          const iso = toISO(year, month, day);
          const isS = iso === since, isE = iso === until;
          const inR = since && until && iso > since && iso < until;
          const inH = hovering && since && !until && iso > since && iso <= hovering;
          const isToday = iso === todayFn();
          return (
            <button key={i} onClick={() => onDay(iso)} onMouseEnter={() => onHover(iso)}
              className={[
                'h-7 w-full flex items-center justify-center text-[11px] font-medium transition-all relative',
                isS ? 'bg-blue-600 text-white rounded-l-full' : '',
                isE ? 'bg-blue-600 text-white rounded-r-full' : '',
                isS && !until ? 'rounded-full' : '',
                isS && until ? 'rounded-l-full' : '',
                isE ? 'rounded-r-full' : '',
                (inR || inH) ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-200' : '',
                !isS && !isE && !inR && !inH ? 'hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-full text-zinc-700 dark:text-zinc-300' : '',
              ].filter(Boolean).join(' ')}>
              <span className={[isS || isE ? '' : '', 'relative z-10'].join(' ')}>{day}</span>
              {isToday && !isS && !isE && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-blue-500" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const MetaDatePicker = ({ mode, preset, since, until, onApply }: {
  mode: 'preset' | 'custom'; preset: DatePreset; since: string; until: string;
  onApply: (mode: 'preset' | 'custom', preset: DatePreset, since: string, until: string) => void;
}) => {
  const [open, setOpen] = React.useState(false);
  const [sm, setSm] = React.useState<'preset'|'custom'>(mode);
  const [sp, setSp] = React.useState<DatePreset>(preset);
  const [ss, setSs] = React.useState(since);
  const [su, setSu] = React.useState(until);
  const [hov, setHov] = React.useState('');
  const nowD = new Date();
  const [ly, setLy] = React.useState(nowD.getFullYear());
  const [lm, setLm] = React.useState(nowD.getMonth() === 0 ? 11 : nowD.getMonth() - 1);
  const ref = React.useRef<HTMLDivElement>(null);

  // Right calendar is always one month ahead of left
  const rm = lm === 11 ? 0 : lm + 1;
  const ry = lm === 11 ? ly + 1 : ly;

  React.useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, []);

  const handleOpen = () => {
    setSm(mode); setSp(preset); setSs(since); setSu(until); setHov('');
    if (since) {
      const d = new Date(since);
      // Show the month before since in left calendar so since is visible in right
      const prevM = d.getMonth() === 0 ? 11 : d.getMonth() - 1;
      const prevY = d.getMonth() === 0 ? d.getFullYear() - 1 : d.getFullYear();
      setLy(prevY); setLm(prevM);
    }
    setOpen(true);
  };

  const pickPreset = (p: DatePreset) => {
    setSm('preset'); setSp(p);
    const r = presetToRange(p); setSs(r.since); setSu(r.until); setHov('');
  };

  const pickDay = (iso: string) => {
    if (!ss || (ss && su)) { setSs(iso); setSu(''); setSm('custom'); }
    else if (iso < ss) { setSs(iso); setSu(''); }
    else { setSu(iso); }
    setHov('');
  };

  const handleLeftYM = (y: number, m: number) => { setLy(y); setLm(m); };
  const handleRightYM = (y: number, m: number) => {
    // Right month changed: set left to one month before
    const prevM = m === 0 ? 11 : m - 1;
    const prevY = m === 0 ? y - 1 : y;
    setLy(prevY); setLm(prevM);
  };

  const apply = () => { onApply(sm, sp, ss, su || ss); setOpen(false); };

  const fmtLabel = (iso: string) => iso ? new Date(iso + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

  const currentLabel = mode === 'preset'
    ? `Últimos 7 días: ${fmtLabel(since)} - ${fmtLabel(until)}`
      .replace('Últimos 7 días', AI_DATE_PRESETS.find(p => p.value === preset)?.label || preset)
    : `${fmtLabel(since)} - ${fmtLabel(until)}`;

  return (
    <div className="relative" ref={ref}>
      <button onClick={handleOpen}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[7px] border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 text-[11px] font-medium bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all shadow-sm">
        <Calendar className="w-3 h-3 text-zinc-400" />
        {currentLabel}
        <ChevronDown className="w-3 h-3 text-zinc-400" />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 z-[100] bg-white dark:bg-zinc-950 rounded-xl shadow-[0_8px_40px_rgba(0,0,0,0.2)] border border-zinc-200 dark:border-zinc-700 flex overflow-hidden"
          style={{minWidth: 580}}>

          {/* Left: Presets */}
          <div className="w-[185px] border-r border-zinc-100 dark:border-zinc-800 py-2 flex-shrink-0 overflow-y-auto" style={{maxHeight: 440}}>
            <p className="px-3 pb-1.5 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Usados recientemente</p>
            {AI_DATE_PRESETS.map(p => (
              <button key={p.value} onClick={() => pickPreset(p.value)}
                className={`w-full text-left px-3 py-2 text-[12px] flex items-center gap-2.5 transition-colors ${
                  sm === 'preset' && sp === p.value
                    ? 'text-blue-600 dark:text-blue-400 font-semibold'
                    : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/60'
                }`}>
                <span className={`w-[15px] h-[15px] rounded-full border-[2px] flex-shrink-0 flex items-center justify-center ${
                  sm === 'preset' && sp === p.value ? 'border-blue-600 dark:border-blue-400' : 'border-zinc-300 dark:border-zinc-600'
                }`}>
                  {sm === 'preset' && sp === p.value && <span className="w-[7px] h-[7px] rounded-full bg-blue-600 dark:bg-blue-400" />}
                </span>
                {p.label}
              </button>
            ))}
          </div>

          {/* Right: Dual calendar */}
          <div className="flex flex-col p-4 gap-3 flex-1">
            <div className="flex gap-5" onMouseLeave={() => setHov('')}>
              <CalMes
                year={ly} month={lm} onYearMonth={handleLeftYM}
                since={ss} until={su} hovering={hov}
                onDay={pickDay} onHover={setHov}
                showPrev={true} showNext={false}
              />
              <CalMes
                year={ry} month={rm} onYearMonth={handleRightYM}
                since={ss} until={su} hovering={hov}
                onDay={pickDay} onHover={setHov}
                showPrev={false} showNext={true}
              />
            </div>

            {/* Date inputs */}
            <div className="flex items-center gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <select value={sm} onChange={e => setSm(e.target.value as 'preset'|'custom')} className="sr-only" />
              <input type="date" value={ss} onChange={e => { setSs(e.target.value); setSm('custom'); }}
                className="flex-1 px-2 py-1.5 text-[11px] bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-[6px] text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-blue-400" />
              <span className="text-zinc-400 text-[11px]">—</span>
              <input type="date" value={su} min={ss} onChange={e => { setSu(e.target.value); setSm('custom'); }}
                className="flex-1 px-2 py-1.5 text-[11px] bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-[6px] text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-blue-400" />
            </div>

            <p className="text-[10px] text-zinc-400 -mt-1">Las fechas se muestran en la Hora de Buenos Aires</p>

            <div className="flex justify-end gap-2">
              <button onClick={() => setOpen(false)}
                className="px-3.5 py-1.5 rounded-lg text-[12px] font-medium text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all">
                Cancelar
              </button>
              <button onClick={apply} disabled={!ss}
                className="px-3.5 py-1.5 rounded-lg text-[12px] font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white transition-all">
                Actualizar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


// ── KPI Card ─────────────────────────────────────────────────────────────────
const KpiCard = ({ label, value, sub, icon: Icon, color = 'text-zinc-900 dark:text-white' }: {
  label: string; value: string; sub?: string; icon?: any; color?: string;
}) => (
  <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-zinc-100 dark:border-zinc-800 shadow-sm">
    <div className="flex items-start justify-between mb-2">
      <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-[0.06em]">{label}</p>
      {Icon && <Icon className="w-3.5 h-3.5 text-zinc-400" />}
    </div>
    <p className={`text-[22px] font-bold tracking-[-0.02em] leading-none ${color}`}>{value}</p>
    {sub && <p className="text-[10px] text-zinc-400 mt-1">{sub}</p>}
  </div>
);

// ── Component ─────────────────────────────────────────────────────────────────
export default function AIAnalystPage() {
  const { showToast } = useToast();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [loadingAccounts, setLoadingAccounts] = useState(false);

  const [dateMode, setDateMode] = useState<'preset' | 'custom'>('preset');
  const [preset, setPreset] = useState<DatePreset>('today');
  const [since, setSince] = useState(daysAgo(28));
  const [until, setUntil] = useState(todayFn());

  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<'REPORTES' | 'CREATIVOS' | 'CLIENTE' | 'GPT_OPTIMIZER'>('REPORTES');

  const [isFetchingData, setIsFetchingData] = useState(false);
  const [isAnalyzingAI, setIsAnalyzingAI] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState('');
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [campaignInsights, setCampaignInsights] = useState<Record<string, any>>({});
  const [accountOverview, setAccountOverview] = useState<any>(null);
  const [accountInsights, setAccountInsights] = useState<any>(null);

  const [analysisText, setAnalysisText] = useState('');
  const [creativityText, setCreativityText] = useState('');
  const [adActions, setAdActions] = useState<Record<string, { action: string; reason: string }>>({});

  const [planObjective, setPlanObjective] = useState('');
  const [planDeadline, setPlanDeadline] = useState('3 meses');
  const [planBudget, setPlanBudget] = useState('');
  const [planStartDate, setPlanStartDate] = useState(todayFn());
  const [planText, setPlanText] = useState('');
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);

  const [analysisChat, setAnalysisChat] = useState<ClaudeMessage[]>([]);
  const [planChat, setPlanChat] = useState<ClaudeMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [skillsOpen, setSkillsOpen] = useState(false);
  const [ytChannels, setYtChannels] = useState<{ name: string; url: string; active: boolean }[]>(() => {
    try { return JSON.parse(localStorage.getItem('analyst_yt_channels') || 'null') || DEFAULT_YT_CHANNELS; }
    catch { return DEFAULT_YT_CHANNELS; }
  });
  const [newChannelName, setNewChannelName] = useState('');

  // ── Drill-down: Conjuntos + Anuncios ─────────────────────────────────────
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set());
  const [expandedAdSets, setExpandedAdSets] = useState<Set<string>>(new Set());
  const [campaignAdSets, setCampaignAdSets] = useState<Record<string, any[]>>({});
  const [adSetAds, setAdSetAds] = useState<Record<string, any[]>>({});
  const [adSetInsights, setAdSetInsights] = useState<Record<string, any>>({});
  const [adInsights, setAdInsights] = useState<Record<string, any>>({});
  const [loadingAdSets, setLoadingAdSets] = useState<Record<string, boolean>>({});
  const [loadingAds, setLoadingAds] = useState<Record<string, boolean>>({});
  const [creativeAnalysisText, setCreativeAnalysisText] = useState('');
  const [isAnalyzingCreatives, setIsAnalyzingCreatives] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [clientReportText, setClientReportText] = useState('');
  const [isGeneratingClientReport, setIsGeneratingClientReport] = useState(false);
  const [clientReportType, setClientReportType] = useState<'general' | 'complete'>('general');
  const [isAnalyzingAll, setIsAnalyzingAll] = useState(false);
  const [analyzeAllProgress, setAnalyzeAllProgress] = useState('');

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [analysisChat, planChat]);
  useEffect(() => { localStorage.setItem('analyst_yt_channels', JSON.stringify(ytChannels)); }, [ytChannels]);

  // AUTO-LOAD accounts on mount
  useEffect(() => { loadAccounts(); }, []);

  // ── Load accounts ──────────────────────────────────────────────────────────
  const loadAccounts = async () => {
    setLoadingAccounts(true);
    try {
      const res = await metaAds.getAllAdAccounts();
      const allAccts = res.data || [];
      const tr15: TimeRange = { since: daysAgo(15), until: todayFn() };
      const enriched = await Promise.all(
        allAccts.map(async (acct: any) => {
          const [ins15, campsRes] = await Promise.all([
            metaAds.getInsights(acct.id, 'spend', undefined, tr15).catch(() => null),
            metaAds.getCampaigns(acct.id).catch(() => null),
          ]);
          const spend15d = parseFloat(ins15?.spend || '0');
          const activeCamps = (campsRes?.data || []).filter((c: any) => c.status === 'ACTIVE').length;
          return { ...acct, spend15d, activeCamps };
        })
      );
      const accts = enriched.filter(a => a.spend15d > 0);
      setAccounts(accts);
      if (accts.length > 0 && !selectedAccountId) {
        setSelectedAccountId(accts[0].id);
      }
    } catch (e: any) {
      console.error('Error loading accounts:', e);
      showToast(`Error al cargar cuentas: ${e.message || 'Error desconocido'}`, 'error');
    } finally {
      setLoadingAccounts(false);
    }
  };

  // ── Toggle campaign drill-down ───────────────────────────────────────────
  const toggleCampaign = async (campId: string) => {
    const next = new Set(expandedCampaigns);
    if (next.has(campId)) { next.delete(campId); setExpandedCampaigns(next); return; }
    next.add(campId); setExpandedCampaigns(next);
    if (campaignAdSets[campId]) return;
    setLoadingAdSets(prev => ({ ...prev, [campId]: true }));
    const tr = dateMode === 'preset' ? undefined : { since, until };
    const dp = dateMode === 'preset' ? preset : undefined;
    const tryLoad = async (attempt: number): Promise<void> => {
      try {
        const res = await metaAds.getAdsets(campId);
        const adsets: any[] = res.data || [];
        setCampaignAdSets(prev => ({ ...prev, [campId]: adsets }));
        const insResults = await Promise.all(adsets.map(a => metaAds.getInsights(a.id, undefined, dp, tr).catch(() => null)));
        const insMap: Record<string, any> = {};
        adsets.forEach((a, i) => { if (insResults[i]) insMap[a.id] = insResults[i]; });
        setAdSetInsights(prev => ({ ...prev, ...insMap }));
      } catch (e: any) {
        if (attempt < 2) {
          await new Promise(r => setTimeout(r, 1000 * attempt));
          return tryLoad(attempt + 1);
        }
        console.error('Error loading adsets:', e);
        showToast('Error al cargar conjuntos de anuncios', 'error');
        setCampaignAdSets(prev => ({ ...prev, [campId]: [] }));
      }
    };
    await tryLoad(1);
    setLoadingAdSets(prev => ({ ...prev, [campId]: false }));
  };

  const toggleAdSet = async (adsetId: string) => {
    const next = new Set(expandedAdSets);
    if (next.has(adsetId)) { next.delete(adsetId); setExpandedAdSets(next); return; }
    next.add(adsetId); setExpandedAdSets(next);
    if (adSetAds[adsetId]) return;
    setLoadingAds(prev => ({ ...prev, [adsetId]: true }));
    const tr = dateMode === 'preset' ? undefined : { since, until };
    const dp = dateMode === 'preset' ? preset : undefined;
    const tryLoad = async (attempt: number): Promise<void> => {
      try {
        const res = await metaAds.getAds(adsetId);
        const adsList: any[] = res.data || [];
        setAdSetAds(prev => ({ ...prev, [adsetId]: adsList }));
        const insResults = await Promise.all(adsList.map(a => metaAds.getInsights(a.id, AD_INSIGHT_FIELDS, dp, tr).catch(() => null)));
        const insMap: Record<string, any> = {};
        adsList.forEach((a, i) => { if (insResults[i]) insMap[a.id] = insResults[i]; });
        setAdInsights(prev => ({ ...prev, ...insMap }));
      } catch (e: any) {
        if (attempt < 2) {
          await new Promise(r => setTimeout(r, 1000 * attempt));
          return tryLoad(attempt + 1);
        }
        console.error('Error loading ads:', e);
        showToast('Error al cargar anuncios del conjunto', 'error');
        setAdSetAds(prev => ({ ...prev, [adsetId]: [] }));
      }
    };
    await tryLoad(1);
    setLoadingAds(prev => ({ ...prev, [adsetId]: false }));
  };

  const analyzeCreatives = async () => {
    const allAdSets = Object.values(campaignAdSets).flat();
    if (allAdSets.length === 0) {
      setCreativeAnalysisText('Primero expandí algunas campañas en Reportes para cargar los conjuntos y creativos.');
      setActiveTab('CREATIVOS'); return;
    }
    setIsAnalyzingCreatives(true);
    setActiveTab('CREATIVOS');
    try {
      const lines: string[] = [];
      for (const [campId, adsets] of Object.entries(campaignAdSets)) {
        const camp = campaigns.find((c: any) => c.id === campId);
        const campFunnel = classifyFunnel(camp?.objective || '', undefined, camp?.name);
        lines.push(`
=== CAMPAÑA: ${camp?.name || campId} [${campFunnel}] ===`);
        for (const adset of (adsets as any[])) {
          const adsetFunnel = classifyFunnel(camp?.objective || '', adset.optimization_goal, adset.name);
          const adsetIns = adSetInsights[adset.id];
          lines.push(`  CA: ${adset.name} [${adsetFunnel}|opt:${adset.optimization_goal || '—'}] | Gasto: ${fmtNum(adsetIns?.spend, 0)} | CTR: ${fmtNum(adsetIns?.inline_link_click_ctr, 2)}% | CPM: ${fmtNum(adsetIns?.cpm, 0)} | Frec: ${fmtNum(adsetIns?.frequency, 2)} | ROAS: ${adsetIns?.purchase_roas?.[0]?.value ? fmtNum(adsetIns.purchase_roas[0].value, 2) : '—'}`);
          const adsList = adSetAds[adset.id] || [];
          for (const ad of adsList) {
            const adIns = adInsights[ad.id];
            const issues = funnelBadPerf(adsetFunnel, adIns);
            lines.push(`    AD: ${ad.name} [${adsetFunnel}] | Gasto: ${fmtNum(adIns?.spend, 0)} | CTR: ${fmtNum(adIns?.inline_link_click_ctr, 2)}% | Frec: ${fmtNum(adIns?.frequency, 2)} | CPM: ${fmtNum(adIns?.cpm, 0)} | ROAS: ${adIns?.purchase_roas?.[0]?.value ? fmtNum(adIns.purchase_roas[0].value, 2) : '—'} | Alcance: ${adIns?.reach || '0'} | Prob: ${issues.join(', ') || 'OK'}`);
          }
        }
      }
      const creativeData = lines.join('\n');
      const currency = accountOverview?.currency || 'ARS';
      const activeChannels = ytChannels.filter(c => c.active).map(c => c.name);
      const prompt = `🚨 INSTRUCCIÓN CRÍTICA DE MONEDA: Esta cuenta opera en ${currency}. Todo benchmark de costos debe ajustarse a ${currency}.

Analizá los creativos de esta cuenta de Meta Ads clasificados por su rol en el funnel (TOFU / MOFU / BOFU).

METODOLOGÍA ALGORITMIA:
- Campaña = Buyer Persona (a quién le habla)
- Conjunto de anuncios = Punto de dolor específico de ese buyer persona
- Creativos = Mensajes para distintos niveles de consciencia (Inconsciente → Problema → Solución → Producto → Decisión)

REGLA FUNDAMENTAL — cada creativo se evalúa solo por su ROL en el funnel:
- TOFU (frío): Goal = llegar a gente nueva. KPIs: Reach alto, CPM bajo, CTR ≥ 1.5%, Frecuencia ≤ 1.5. NO se le piden conversiones. Un TOFU con ROAS 0 puede estar funcionando bien.
- MOFU (tibio): Goal = generar consideración e interés. KPIs: CTR ≥ 1%, CPC razonable, engagement, clicks. NO se le piden compras directas.
- BOFU (caliente): Goal = cerrar la venta. KPIs: ROAS ≥ 2, CPA sostenible, frecuencia 2–4 OK, conversiones directas. Un BOFU con frecuencia baja puede no estar cerrando.

DATOS DE CREATIVOS (por campaña → conjunto → anuncio):
${creativeData}

## RESUMEN EJECUTIVO
Estado general: cuántos TOFU / MOFU / BOFU hay, qué stage tiene mejor y peor rendimiento. Una frase de diagnóstico.

## ANÁLISIS POR ETAPA DEL FUNNEL

### 🔵 TOFU — Creativos de Atracción
Para cada creativo TOFU: ¿está llegando a gente nueva? CTR y alcance vs benchmark. Estado: OK / PROBLEMA + razón.

### 🟡 MOFU — Creativos de Consideración
Para cada creativo MOFU: ¿genera interés y clicks? CTR y CPC vs benchmark. Estado: OK / PROBLEMA + razón.

### 🟢 BOFU — Creativos de Cierre
Para cada creativo BOFU: ¿está cerrando ventas? ROAS, CPA, frecuencia. Estado: OK / PROBLEMA + razón.

## ⚠ CREATIVOS CON BAJO RENDIMIENTO PARA SU ROL
Lista de creativos que fallan en su función. Para cada uno: nombre exacto, stage, problema concreto con número, acción específica.

## GAPS EN EL FUNNEL
¿Falta alguna etapa? ¿Demasiados BOFU sin TOFU que los alimente? ¿Buyer persona sin cobertura completa del funnel?

## 3 ACCIONES PRIORITARIAS
Ordenadas por impacto. Nombrá conjuntos y anuncios exactos. Sin vaguedades.`;
      const resp = await ai.chat([
        { role: 'system', content: buildMetaAnalystSystem(activeChannels) },
        { role: 'user', content: prompt }
      ]);
      setCreativeAnalysisText(resp);
    } catch (e: any) {
      setCreativeAnalysisText('Error: ' + e.message);
    } finally {
      setIsAnalyzingCreatives(false);
    }
  };

  // ── Build full data string ─────────────────────────────────────────────────
  // Acepta datos frescos opcionales para evitar stale closure al llamar desde analyzeAll
  const buildFullDataStringWith = (
    campAdSetsMap: Record<string, any[]> = campaignAdSets,
    adSetInsMap: Record<string, any> = adSetInsights,
    adSetAdsMap: Record<string, any[]> = adSetAds,
    adInsMap: Record<string, any> = adInsights
  ): string => {
    const lines: string[] = [];
    const range: TimeRange = dateMode === 'custom' ? { since, until } : presetToRange(preset);
    const period = `${range.since} al ${range.until}`;
    lines.push(`PERÍODO: ${period}`);
    lines.push(`CUENTA: ${accountOverview?.name || selectedAccountId} | Moneda: ${accountOverview?.currency || 'ARS'}`);
    const totalSpendAcc = parseFloat(accountInsights?.spend || '0');
    const totalReach = parseInt(accountInsights?.reach || '0');
    const blendedRoas = accountInsights?.purchase_roas?.[0]?.value ? parseFloat(accountInsights.purchase_roas[0].value) : 0;
    lines.push(`RESUMEN CUENTA: Gasto total=${fmtNum(totalSpendAcc, 0)} | ROAS blended=${blendedRoas > 0 ? fmtNum(blendedRoas, 2) : '—'} | Alcance total=${totalReach.toLocaleString('es-AR')} | CTR cuenta=${fmtNum(accountInsights?.inline_link_click_ctr, 2)}% | CPM cuenta=${fmtNum(accountInsights?.cpm, 0)} | Frecuencia cuenta=${fmtNum(accountInsights?.frequency, 2)}`);
    lines.push('');
    lines.push('NOTA DE FORMATO: Los bloques de datos tienen el formato "[TIPO | FUNNEL] NOMBRE_REAL". El nombre de campaña/conjunto/anuncio es ÚNICAMENTE el texto después del prefijo, sin corchetes ni metadatos. NO agregues Estado, Objetivo ni ningún otro campo al nombre.');
    lines.push('');
    for (const c of campaigns) {
      const ins = campaignInsights[c.id];
      if (!ins) continue;
      const campFunnel = classifyFunnel(c.objective || '', undefined, c.name);
      const metric = getPrimaryMetric(c.objective || '', ins);
      const roas = ins.purchase_roas?.[0]?.value ? fmtNum(ins.purchase_roas[0].value, 2) : '—';
      // Nombre limpio — sin metadata de estado/objetivo
      const campNameClean = c.name.replace(/\s*\[.*?\]\s*/g, '').trim();
      lines.push(`CAMPAÑA "${campNameClean}" [Funnel:${campFunnel}]`);
      lines.push(`  Configuración: Objetivo=${c.objective || '—'} | BidStrategy=${c.bid_strategy || '—'} | Presupuesto=${c.daily_budget ? 'Diario:'+c.daily_budget : c.lifetime_budget ? 'Total:'+c.lifetime_budget : '—'} | Estado=${c.status}`);
      lines.push(`  Métricas: Gasto=${fmtNum(ins.spend, 0)} | ${metric.label}=${metric.value} | Costo/R=${metric.cost} | ROAS=${roas} | CTR=${fmtNum(ins.inline_link_click_ctr, 2)}% | CPM=${fmtNum(ins.cpm, 0)} | Frecuencia=${fmtNum(ins.frequency, 2)} | Alcance=${parseInt(ins.reach || '0').toLocaleString('es-AR')}`);
      const adsets = campAdSetsMap[c.id] || [];
      for (const adset of adsets) {
        const aIns = adSetInsMap[adset.id];
        const adsetFunnel = classifyFunnel(c.objective || '', adset.optimization_goal, adset.name);
        const aMetric = aIns ? getPrimaryMetric(c.objective || '', aIns) : null;
        lines.push(`  CONJUNTO "${adset.name}" [Funnel:${adsetFunnel}]`);
        lines.push(`    Configuración: Optimización=${adset.optimization_goal || '—'} | Presupuesto=${adset.daily_budget ? 'Diario:'+adset.daily_budget : adset.lifetime_budget ? 'Total:'+adset.lifetime_budget : '—'}`);
        if (aIns) lines.push(`    Métricas: Gasto=${fmtNum(aIns.spend, 0)} | ${aMetric?.label || '—'}=${aMetric?.value || '—'} | CTR=${fmtNum(aIns.inline_link_click_ctr, 2)}% | CPM=${fmtNum(aIns.cpm, 0)} | Frecuencia=${fmtNum(aIns.frequency, 2)} | ROAS=${aIns.purchase_roas?.[0]?.value ? fmtNum(aIns.purchase_roas[0].value, 2) : '—'}`);
        else lines.push(`    Sin métricas en el período`);
        const ads = adSetAdsMap[adset.id] || [];
        for (const ad of ads) {
          const dIns = adInsMap[ad.id];
          const issues = funnelBadPerf(adsetFunnel, dIns);
          lines.push(`    ANUNCIO "${ad.name}" [Funnel:${adsetFunnel}] Estado=${ad.status}`);
          if (dIns) lines.push(`      Gasto=${fmtNum(dIns.spend, 0)} | CTR=${fmtNum(dIns.inline_link_click_ctr, 2)}% | CPM=${fmtNum(dIns.cpm, 0)} | Frec=${fmtNum(dIns.frequency, 2)} | Alcance=${dIns.reach || '0'} | ROAS=${dIns.purchase_roas?.[0]?.value ? fmtNum(dIns.purchase_roas[0].value, 2) : '—'}${issues.length ? ' | Alertas='+issues.join(', ') : ''}`);
          else lines.push(`      Sin métricas en el período`);
        }
      }
      lines.push('');
    }
    return lines.join('\n');
  };

  const buildFullDataString = () => buildFullDataStringWith();

  // ── Analyze All ──────────────────────────────────────────────────────────
  const analyzeAll = async () => {
    if (!selectedAccountId || campaigns.length === 0) return;
    setIsAnalyzingAll(true);
    setAnalysisError(null);
    const range: TimeRange = dateMode === 'custom' ? { since, until } : presetToRange(preset);
    const period = `${range.since} al ${range.until}`;
    const currency = accountOverview?.currency || 'ARS';
    const activeChannels = ytChannels.filter(c => c.active).map(c => c.name);
    const system = buildMetaAnalystSystem(activeChannels);
    try {
      // Acumuladores locales — evita stale closure de React state
      const freshCampAdSets: Record<string, any[]> = { ...campaignAdSets };
      const freshAdSetIns: Record<string, any> = { ...adSetInsights };
      const freshAdSetAds: Record<string, any[]> = { ...adSetAds };
      const freshAdIns: Record<string, any> = { ...adInsights };

      // Step 1: load all ad sets for all campaigns with spend
      const campsWithSpend = campaigns.filter(c => parseFloat(campaignInsights[c.id]?.spend || '0') > 0);
      setAnalyzeAllProgress(`Cargando conjuntos de anuncios (${campsWithSpend.length} campañas)...`);
      const unloadedCamps = campsWithSpend.filter(c => !freshCampAdSets[c.id]);
      if (unloadedCamps.length > 0) {
        await Promise.all(unloadedCamps.map(async c => {
          try {
            const res = await metaAds.getAdsets(c.id);
            const adsets: any[] = res.data || [];
            freshCampAdSets[c.id] = adsets;
            setCampaignAdSets(prev => ({ ...prev, [c.id]: adsets }));
            const insResults = await Promise.all(adsets.map(a => metaAds.getInsights(a.id, undefined, dateMode === 'preset' ? preset : undefined, dateMode === 'custom' ? { since, until } : undefined).catch(() => null)));
            const insMap: Record<string, any> = {};
            adsets.forEach((a, i) => { if (insResults[i]) { insMap[a.id] = insResults[i]; freshAdSetIns[a.id] = insResults[i]; } });
            setAdSetInsights(prev => ({ ...prev, ...insMap }));
          } catch (e) { console.error('adset load error', e); }
        }));
      }

      // Step 2: load ads for all ad sets — usa freshCampAdSets (no stale)
      setAnalyzeAllProgress('Cargando anuncios y creativos...');
      const allAdSetIds = Object.values(freshCampAdSets).flat().map((a: any) => a.id);
      const unloadedAdSets = allAdSetIds.filter(id => !freshAdSetAds[id]);
      if (unloadedAdSets.length > 0) {
        await Promise.all(unloadedAdSets.map(async id => {
          try {
            const res = await metaAds.getAds(id);
            const adsList: any[] = res.data || [];
            freshAdSetAds[id] = adsList;
            setAdSetAds(prev => ({ ...prev, [id]: adsList }));
            const insResults = await Promise.all(adsList.map(a => metaAds.getInsights(a.id, AD_INSIGHT_FIELDS, dateMode === 'preset' ? preset : undefined, dateMode === 'custom' ? { since, until } : undefined).catch(() => null)));
            const insMap: Record<string, any> = {};
            adsList.forEach((a, i) => { if (insResults[i]) { insMap[a.id] = insResults[i]; freshAdIns[a.id] = insResults[i]; } });
            setAdInsights(prev => ({ ...prev, ...insMap }));
          } catch (e) { console.error('ads load error', e); }
        }));
      }

      // Step 3: build data desde acumuladores frescos y correr análisis
      setAnalyzeAllProgress('Ejecutando análisis IA completo...');
      const fullData = buildFullDataStringWith(freshCampAdSets, freshAdSetIns, freshAdSetAds, freshAdIns);
      const [aResult, cResult, rResult] = await Promise.allSettled([
        ai.chat([{ role: 'system', content: system }, { role: 'user', content: buildAnalysisPrompt(selectedAccountId, period, fullData, accountOverview?.name || selectedAccountId, currency) }]),
        ai.chat([{ role: 'system', content: system }, { role: 'user', content: buildCreativityPrompt(fullData, accountOverview?.name || selectedAccountId, period, currency) }]),
        ai.chat([{ role: 'system', content: system }, { role: 'user', content: buildClientReportPrompt(campaigns, campaignInsights, accountOverview?.name || selectedAccountId, period, currency, accountInsights) }]),
      ]);
      if (aResult.status === 'fulfilled') { setAnalysisText(aResult.value); setAdActions(parseActionsFromAnalysis(aResult.value, campaigns)); }
      if (cResult.status === 'fulfilled') setCreativityText(cResult.value);
      if (rResult.status === 'fulfilled') setClientReportText(rResult.value);
      setActiveTab('CREATIVOS');
    } catch (e: any) {
      setAnalysisError('Error en análisis: ' + e.message);
    } finally {
      setIsAnalyzingAll(false);
      setAnalyzeAllProgress('');
    }
  };

  // ── Fetch Meta data only ──────────────────────────────────────────────────
  const fetchMetaData = async (accountId?: string) => {
    const accId = accountId || selectedAccountId;
    if (!accId) return;

    setIsFetchingData(true);
    setAnalysisError(null);
    setAnalysisText(''); // Clear previous AI analysis since data changed
    setCreativityText('');
    setClientReportText('');
    setCreativeAnalysisText('');
    setAdActions({});
    setPlanText('');
    setAnalysisChat([]);
    setCampaignAdSets({});
    setAdSetAds({});
    setAdSetInsights({});
    setAdInsights({});
    setExpandedCampaigns(new Set());
    setExpandedAdSets(new Set());

    // Para presets, pasar date_preset directamente (datos en tiempo real en Meta).
    // Solo usar time_range para fechas custom.
    const dp = dateMode === 'preset' ? preset : undefined;
    const tr = dateMode === 'custom' ? { since, until } : undefined;

    try {
      setAnalysisProgress('Cargando cuenta...');
      const [acct, campRes, acctIns] = await Promise.all([
        metaAds.getAccount(accId),
        metaAds.getCampaigns(accId),
        metaAds.getInsights(accId, INSIGHT_FIELDS, dp, tr),
      ]);
      setAccountOverview(acct);
      setAccountInsights(acctIns);

      const allCamps = campRes.data || [];
      const camps = allCamps.slice(0, 25);
      if (allCamps.length > 25) {
        showToast(`Cuenta con ${allCamps.length} campañas — mostrando las primeras 25`, 'info');
      }
      setAnalysisProgress(`Cargando insights de ${camps.length} campañas...`);

      const insights: Record<string, any> = {};
      await Promise.all(camps.map(async (c: any) => {
        const ins = await metaAds.getInsights(c.id, INSIGHT_FIELDS, dp, tr).catch(() => null);
        if (ins) insights[c.id] = ins;
      }));
      setCampaigns(camps);
      setCampaignInsights(insights);

      if (activeTab !== 'REPORTES') setActiveTab('REPORTES');
    } catch (err: any) {
      setAnalysisError(`Error al cargar datos: ${err.message}`);
    } finally {
      setIsFetchingData(false);
      setAnalysisProgress('');
    }
  };

  // AUTO-FETCH data when account or date filter changes
  useEffect(() => {
    if (selectedAccountId) {
      fetchMetaData(selectedAccountId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAccountId, dateMode, preset, since, until]);

  // ── Run AI Analysis manually ──────────────────────────────────────────────
  const handleRunAIAnalysis = async () => {
    const accId = selectedAccountId;
    if (!accId || campaigns.length === 0) return;

    setIsAnalyzingAI(true);
    setAnalysisError(null);
    setAnalysisProgress('Generando diagnóstico con IA...');

    const range: TimeRange = dateMode === 'custom' ? { since, until } : presetToRange(preset);
    const period = `${range.since} al ${range.until}`;
    const campData = buildCampDataString(campaigns, campaignInsights);
    const currency = accountOverview?.currency || 'ARS';

    try {
      const activeChannels = ytChannels.filter(c => c.active).map(c => c.name);
      const systemPrompt = buildMetaAnalystSystem(activeChannels);
      
      const [analysisResult, creativityResult] = await Promise.allSettled([
        ai.chat([{ role: 'system', content: systemPrompt }, { role: 'user', content: buildAnalysisPrompt(accId, period, campData, accountOverview?.name || accId, currency) }]),
        ai.chat([{ role: 'system', content: systemPrompt }, { role: 'user', content: buildCreativityPrompt(campData, accountOverview?.name || accId, period, currency) }]),
      ]);

      if (analysisResult.status === 'fulfilled') {
        setAnalysisText(analysisResult.value as string);
        setAdActions(parseActionsFromAnalysis(analysisResult.value as string, campaigns));
      } else {
        const msg = (analysisResult.reason as any)?.message || '';
        setAnalysisError(`Error en análisis IA: ${msg}`);
      }

      if (creativityResult.status === 'fulfilled') {
        setCreativityText(creativityResult.value);
      }
    } catch (err: any) {
      setAnalysisError(`Error en IA: ${err.message}`);
    } finally {
      setIsAnalyzingAI(false);
      setAnalysisProgress('');
      setActiveTab('CREATIVOS');
    }
  };

  // ── Generate plan ──────────────────────────────────────────────────────────
  const handleGeneratePlan = async () => {
    setIsGeneratingPlan(true);
    setPlanText('');
    setPlanChat([]);
    try {
      const campData = buildCampDataString(campaigns, campaignInsights);
      const currency = accountOverview?.currency || 'ARS';
      const prompt = `🚨 INSTRUCCIÓN CRÍTICA DE MONEDA: Esta cuenta opera en ${currency}.
Ajustá TODO el plan, sugerencias de presupuesto, estimaciones de costos (CPA, CPM) y KPIs a ${currency}. No uses benchmarks de USD si la moneda es otra.

Generá un plan estratégico completo de Meta Ads.
CUENTA: ${accountOverview?.name || selectedAccountId}
MONEDA: ${currency}
ANÁLISIS: ${analysisText || campData || 'Sin análisis previo.'}
OBJETIVO: ${planObjective}
PLAZO: ${planDeadline}
PRESUPUESTO: ${planBudget || 'No definido'}
INICIO: ${planStartDate}
# PLAN ESTRATÉGICO META ADS
## OBJETIVO Y KPIs CLAVE
## ESTRUCTURA DE CAMPAÑAS RECOMENDADA
### TOFU — Campañas de Atracción
### MOFU — Campañas de Consideración
### BOFU — Campañas de Conversión
## CRONOGRAMA DE IMPLEMENTACIÓN
## PRESUPUESTO Y DISTRIBUCIÓN
## MÉTRICAS DE SEGUIMIENTO SEMANAL
## ACCIONES PRIORITARIAS PRIMERAS 2 SEMANAS`;
      const activeChannels = ytChannels.filter(c => c.active).map(c => c.name);
      const resp = await ai.chat([{ role: 'system', content: buildMetaAnalystSystem(activeChannels) }, { role: 'user', content: prompt }]);
      setPlanText(resp);
    } catch (err: any) {
      setPlanText(`Error: ${err.message}`);
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  // ── Chat ───────────────────────────────────────────────────────────────────
  const handleChat = async (msg: string) => {
    if (!msg.trim() || isChatting) return;
    const chatHistory = analysisChat;
    const setChat = setAnalysisChat;
    const context = analysisText + '\n\n' + creativeAnalysisText;

    setIsChatting(true);
    setChatInput('');
    const newMsg: ClaudeMessage = { role: 'user', content: msg };
    setChat(prev => [...prev, newMsg]);

    try {
      const activeChannels = ytChannels.filter(c => c.active).map(c => c.name);
      const resp = await ai.chat([
        { role: 'system', content: `🚨 INSTRUCCIÓN CRÍTICA DE MONEDA: Recordá que esta cuenta opera en ${accountOverview?.currency || 'ARS'}. Ajustá tus respuestas, sugerencias y análisis a esta moneda.\n\n${buildMetaAnalystSystem(activeChannels)}\n\nContexto del análisis:\n${context}` },
        ...chatHistory,
        newMsg,
      ]);
      setChat(prev => [...prev, { role: 'assistant', content: resp }]);
    } catch (err: any) {
      setChat(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}` }]);
    } finally {
      setIsChatting(false);
    }
  };

  // ── Client Report PDF ────────────────────────────────────────────────────────
  const handleClientReportPDF = () => {
    const pw = window.open('', '_blank');
    if (!pw) { showToast('El navegador bloqueó el popup. Permitir popups para exportar PDF.', 'error'); return; }
    const range: TimeRange = dateMode === 'custom' ? { since, until } : presetToRange(preset);
    const cur = accountOverview?.currency || '';
    const today = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const objType = detectDominantObjective(campaigns, campaignInsights);

    // ── Shared KPI values ──
    const spendVal = accountInsights ? `${cur} ${fmtNum(accountInsights.spend, 0)}` : '—';
    const reachVal = accountInsights?.reach ? parseInt(accountInsights.reach).toLocaleString('es-AR') : '—';
    const clicksVal = accountInsights?.inline_link_clicks ? parseInt(accountInsights.inline_link_clicks).toLocaleString('es-AR') : '—';
    const ctrVal = accountInsights ? fmtNum(accountInsights.inline_link_click_ctr, 2) + '%' : '—';
    const cpmVal = accountInsights ? `${cur} ${fmtNum(accountInsights.cpm, 0)}` : '—';
    const freqVal = accountInsights ? fmtNum(accountInsights.frequency, 2) : '—';
    const impressionsVal = accountInsights?.impressions ? parseInt(accountInsights.impressions).toLocaleString('es-AR') : '—';
    const cpcVal = accountInsights ? `${cur} ${fmtNum(accountInsights.cpc, 2)}` : '—';

    // ── Objective-specific KPI values ──
    const purchases = accountInsights?.actions ? (getMetaVal(accountInsights.actions, 'offsite_conversion.fb_pixel_purchase', 'omni_purchase', 'purchase') || '0') : '0';
    const purchaseValue = accountInsights?.action_values ? (getMetaVal(accountInsights.action_values, 'offsite_conversion.fb_pixel_purchase', 'omni_purchase', 'purchase') || '0') : '0';
    const roasRaw = accountInsights?.purchase_roas?.[0]?.value ? parseFloat(accountInsights.purchase_roas[0].value) : 0;
    const roasStr = roasRaw > 0 ? fmtNum(roasRaw, 1) + 'x' : '—';
    const cpaStr = parseFloat(purchases) > 0 && accountInsights?.spend ? `${cur} ${fmtNum(parseFloat(accountInsights.spend) / parseFloat(purchases), 2)}` : '—';
    const purchaseValueStr = parseFloat(purchaseValue) > 0 ? `${cur} ${fmtNum(parseFloat(purchaseValue), 0)}` : '—';

    const leadsStr = accountInsights?.actions ? (getMetaVal(accountInsights.actions, 'lead', 'offsite_conversion.fb_pixel_lead', 'onsite_conversion.lead_grouped') || '0') : '0';
    const cplStr = parseFloat(leadsStr) > 0 && accountInsights?.spend ? `${cur} ${fmtNum(parseFloat(accountInsights.spend) / parseFloat(leadsStr), 2)}` : '—';

    const messagesStr = accountInsights?.actions ? (getMetaVal(accountInsights.actions, 'onsite_conversion.messaging_conversation_started_7d', 'onsite_conversion.messaging_first_reply') || '0') : '0';
    const cpmsgStr = parseFloat(messagesStr) > 0 && accountInsights?.spend ? `${cur} ${fmtNum(parseFloat(accountInsights.spend) / parseFloat(messagesStr), 2)}` : '—';

    const engStr = accountInsights?.actions ? (getMetaVal(accountInsights.actions, 'post_engagement', 'page_engagement') || '0') : '0';
    const cpeStr = parseFloat(engStr) > 0 && accountInsights?.spend ? `${cur} ${fmtNum(parseFloat(accountInsights.spend) / parseFloat(engStr), 2)}` : '—';

    // ── Build KPI rows per objective ──
    type KpiItem = { v: string; l: string };
    let row1: KpiItem[] = [];
    let row2: KpiItem[] = [];

    if (objType === 'sales') {
      row1 = [{ v: spendVal, l: 'Inversión' }, { v: reachVal, l: 'Personas alcanzadas' }, { v: purchases, l: 'Compras generadas' }, { v: roasStr, l: 'Retorno (ROAS)' }];
      row2 = [{ v: cpaStr, l: 'Costo por compra' }, { v: purchaseValueStr, l: 'Valor en ventas' }, { v: clicksVal, l: 'Clics al sitio' }, { v: ctrVal, l: 'CTR promedio' }];
    } else if (objType === 'leads') {
      row1 = [{ v: spendVal, l: 'Inversión' }, { v: reachVal, l: 'Personas alcanzadas' }, { v: leadsStr, l: 'Leads generados' }, { v: cplStr, l: 'Costo por lead' }];
      row2 = [{ v: clicksVal, l: 'Clics al sitio' }, { v: ctrVal, l: 'CTR promedio' }, { v: cpmVal, l: 'CPM' }, { v: freqVal, l: 'Frecuencia' }];
    } else if (objType === 'traffic') {
      row1 = [{ v: spendVal, l: 'Inversión' }, { v: reachVal, l: 'Personas alcanzadas' }, { v: clicksVal, l: 'Clics al sitio' }, { v: cpcVal, l: 'Costo por clic' }];
      row2 = [{ v: ctrVal, l: 'CTR promedio' }, { v: impressionsVal, l: 'Impresiones' }, { v: cpmVal, l: 'CPM' }, { v: freqVal, l: 'Frecuencia' }];
    } else if (objType === 'messages') {
      row1 = [{ v: spendVal, l: 'Inversión' }, { v: reachVal, l: 'Personas alcanzadas' }, { v: messagesStr, l: 'Conversaciones iniciadas' }, { v: cpmsgStr, l: 'Costo por conversación' }];
      row2 = [{ v: clicksVal, l: 'Clics' }, { v: ctrVal, l: 'CTR promedio' }, { v: cpmVal, l: 'CPM' }, { v: freqVal, l: 'Frecuencia' }];
    } else if (objType === 'engagement') {
      row1 = [{ v: spendVal, l: 'Inversión' }, { v: reachVal, l: 'Personas alcanzadas' }, { v: engStr, l: 'Interacciones' }, { v: cpeStr, l: 'Costo por interacción' }];
      row2 = [{ v: impressionsVal, l: 'Impresiones' }, { v: ctrVal, l: 'CTR promedio' }, { v: cpmVal, l: 'CPM' }, { v: freqVal, l: 'Frecuencia' }];
    } else if (objType === 'awareness') {
      row1 = [{ v: spendVal, l: 'Inversión' }, { v: reachVal, l: 'Personas alcanzadas' }, { v: impressionsVal, l: 'Impresiones' }, { v: cpmVal, l: 'CPM' }];
      row2 = [{ v: freqVal, l: 'Frecuencia' }, { v: ctrVal, l: 'CTR promedio' }, { v: clicksVal, l: 'Clics al sitio' }, { v: cpcVal, l: 'Costo por clic' }];
    } else {
      // mixed — row1 always base metrics, row2 dynamically built from active objectives
      row1 = [{ v: spendVal, l: 'Inversión' }, { v: reachVal, l: 'Personas alcanzadas' }, { v: clicksVal, l: 'Clics al sitio' }, { v: ctrVal, l: 'CTR promedio' }];
      const activeObjs = detectActiveObjectives(campaigns, campaignInsights);
      const objKpis: Record<string, KpiItem[]> = {
        sales: [{ v: purchases, l: 'Compras' }, { v: roasStr, l: 'ROAS' }],
        leads: [{ v: leadsStr, l: 'Leads generados' }, { v: cplStr, l: 'Costo por lead' }],
        messages: [{ v: messagesStr, l: 'Conversaciones' }, { v: cpmsgStr, l: 'Costo x conv.' }],
        traffic: [{ v: cpcVal, l: 'Costo por clic' }, { v: cpmVal, l: 'CPM' }],
        engagement: [{ v: engStr, l: 'Interacciones' }, { v: cpeStr, l: 'Costo x interac.' }],
        awareness: [{ v: impressionsVal, l: 'Impresiones' }, { v: freqVal, l: 'Frecuencia' }],
      };
      row2 = activeObjs.slice(0, 2).flatMap(obj => objKpis[obj] || []).slice(0, 4);
      // Pad to 4 if needed
      while (row2.length < 4) row2.push({ v: '—', l: '' });
    }

    const renderKpiRow = (items: KpiItem[]) =>
      `<div class="kpi-row">${items.map(k => `<div class="kpi"><div class="kv">${k.v}</div><div class="kl">${k.l}</div></div>`).join('')}</div>`;

    // ── AI report text → HTML ──
    const reportContent = clientReportText
      ? clientReportText
          .replace(/## ([^\n]+)/g, '<h2>$1</h2>')
          .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
          .replace(/\n{2,}/g, '</p><p>')
          .replace(/\n/g, ' ')
          .replace(/^/, '<p>')
          .replace(/$/, '</p>')
          .replace(/<p>\s*<h2>/g, '<h2>')
          .replace(/<\/h2>\s*<\/p>/g, '</h2>')
      : '';

    pw.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Reporte — ${accountOverview?.name || ''} — ${range.since} al ${range.until}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1a1a1a;background:#fff;font-size:13px;line-height:1.65;}
  .page{max-width:820px;margin:0 auto;padding:0 0 60px;}
  .header{background:#0d1b2a;color:white;padding:32px 40px;text-align:center;margin-bottom:36px;}
  .header h1{font-size:26px;font-weight:800;color:white;margin-bottom:6px;letter-spacing:-0.3px;}
  .header .sub{color:#B0C4D8;font-size:13px;font-weight:600;margin-bottom:4px;}
  .header .date{color:#8aa8be;font-size:11px;font-style:italic;}
  .kpi-section{padding:0 40px;margin-bottom:28px;break-inside:avoid;page-break-inside:avoid;}
  .kpi-row{display:grid;grid-template-columns:repeat(4,1fr);gap:0;border:1px solid #e5e9ed;border-radius:10px;overflow:hidden;margin-bottom:12px;break-inside:avoid;page-break-inside:avoid;}
  .kpi{padding:18px 12px;text-align:center;border-right:1px solid #e5e9ed;background:#fafbfc;}
  .kpi:last-child{border-right:none;}
  .kv{font-size:22px;font-weight:800;color:#2196F3;line-height:1.1;margin-bottom:5px;}
  .kl{font-size:9px;color:#6b7280;text-transform:uppercase;letter-spacing:.07em;}
  .content{padding:0 40px;}
  h2{font-size:11px;font-weight:800;color:#1A3A5C;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid #e5e9ed;padding-bottom:6px;margin:24px 0 10px;break-after:avoid;page-break-after:avoid;}
  p{font-size:12.5px;color:#2d3748;line-height:1.7;margin-bottom:12px;}
  strong{font-weight:700;color:#0d1b2a;}
  .footer{background:#0d1b2a;color:#8aa8be;font-size:10px;text-align:center;padding:12px 40px;font-style:italic;margin-top:40px;break-inside:avoid;page-break-inside:avoid;}
  p{break-inside:avoid;page-break-inside:avoid;}
  @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}.page{padding:0;}@page{margin:15mm 10mm;}}
</style>
</head><body>
<div class="page">
  <div class="header">
    <h1>${accountOverview?.name || 'Reporte Meta Ads'}</h1>
    <div class="sub">Reporte Semanal de Publicidad</div>
    <div class="date">${range.since} &mdash; ${range.until} &nbsp;&middot;&nbsp; Meta Ads</div>
  </div>
  <div class="kpi-section">
    ${renderKpiRow(row1)}
    ${renderKpiRow(row2)}
  </div>
  <div class="content">
    ${reportContent || '<p>Hacé click en "Generar Reporte" para producir el análisis narrativo.</p>'}
  </div>
  <div class="footer">Algoritmia &nbsp;&middot;&nbsp; ${today} &nbsp;&middot;&nbsp; Datos: Meta Ads</div>
</div>
</body></html>`);
    pw.document.close();
    setTimeout(() => pw.print(), 600);
  };

  // ── Demographic Report PDF ────────────────────────────────────────────────
  const handleDemographicReportPDF = async () => {
    if (!selectedAccountId || !hasData) return;
    setIsGeneratingClientReport(true);
    try {
      const range: TimeRange = dateMode === 'custom' ? { since, until } : presetToRange(preset);
      const [byAge, byGender, byRegion, byPlacement] = await Promise.all([
        metaAds.getInsightsBreakdown(selectedAccountId, 'age', range),
        metaAds.getInsightsBreakdown(selectedAccountId, 'gender', range),
        metaAds.getInsightsBreakdown(selectedAccountId, 'region', range).catch(() => [] as any[]),
        metaAds.getInsightsBreakdown(selectedAccountId, 'publisher_platform,platform_position', range).catch(() => [] as any[]),
      ]);

      const pw = window.open('', '_blank');
      if (!pw) { showToast('El navegador bloqueó el popup. Permitir popups para exportar PDF.', 'error'); return; }

      const cur = accountOverview?.currency || 'ARS';
      const clientName = accountOverview?.name || selectedAccountId;
      const today = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });
      const period = `${range.since} al ${range.until}`;
      const objType = detectDominantObjective(campaigns, campaignInsights);

      const totalSpend = accountInsights ? parseFloat(accountInsights.spend || '0') : byAge.reduce((s: number, r: any) => s + parseFloat(r.spend || '0'), 0);

      // ── KPI rows (top summary) ──
      const spendVal = accountInsights ? `${cur} ${fmtNum(accountInsights.spend, 0)}` : '—';
      const reachVal = accountInsights?.reach ? parseInt(accountInsights.reach).toLocaleString('es-AR') : '—';
      const clicksVal = accountInsights?.inline_link_clicks ? parseInt(accountInsights.inline_link_clicks).toLocaleString('es-AR') : '—';
      const ctrVal2 = accountInsights ? fmtNum(accountInsights.inline_link_click_ctr, 2) + '%' : '—';
      const cpmVal = accountInsights ? `${cur} ${fmtNum(accountInsights.cpm, 0)}` : '—';
      const freqVal = accountInsights ? fmtNum(accountInsights.frequency, 2) : '—';
      const impressionsVal = accountInsights?.impressions ? parseInt(accountInsights.impressions).toLocaleString('es-AR') : '—';
      const cpcVal = accountInsights ? `${cur} ${fmtNum(accountInsights.cpc, 2)}` : '—';
      const purchases = accountInsights?.actions ? (getMetaVal(accountInsights.actions, 'offsite_conversion.fb_pixel_purchase', 'omni_purchase', 'purchase') || '0') : '0';
      const purchaseValue = accountInsights?.action_values ? (getMetaVal(accountInsights.action_values, 'offsite_conversion.fb_pixel_purchase', 'omni_purchase', 'purchase') || '0') : '0';
      const roasRaw = accountInsights?.purchase_roas?.[0]?.value ? parseFloat(accountInsights.purchase_roas[0].value) : 0;
      const roasStr = roasRaw > 0 ? fmtNum(roasRaw, 1) + 'x' : '—';
      const cpaStr = parseFloat(purchases) > 0 && accountInsights?.spend ? `${cur} ${fmtNum(parseFloat(accountInsights.spend) / parseFloat(purchases), 2)}` : '—';
      const purchaseValueStr = parseFloat(purchaseValue) > 0 ? `${cur} ${fmtNum(parseFloat(purchaseValue), 0)}` : '—';
      const leadsKpi = accountInsights?.actions ? (getMetaVal(accountInsights.actions, 'lead', 'offsite_conversion.fb_pixel_lead', 'onsite_conversion.lead_grouped') || '0') : '0';
      const cplKpi = parseFloat(leadsKpi) > 0 && accountInsights?.spend ? `${cur} ${fmtNum(parseFloat(accountInsights.spend) / parseFloat(leadsKpi), 2)}` : '—';
      const msgsKpi = accountInsights?.actions ? (getMetaVal(accountInsights.actions, 'onsite_conversion.messaging_conversation_started_7d', 'onsite_conversion.messaging_first_reply') || '0') : '0';
      const cpmsgKpi = parseFloat(msgsKpi) > 0 && accountInsights?.spend ? `${cur} ${fmtNum(parseFloat(accountInsights.spend) / parseFloat(msgsKpi), 2)}` : '—';
      const engKpi = accountInsights?.actions ? (getMetaVal(accountInsights.actions, 'post_engagement', 'page_engagement') || '0') : '0';
      const cpeKpi = parseFloat(engKpi) > 0 && accountInsights?.spend ? `${cur} ${fmtNum(parseFloat(accountInsights.spend) / parseFloat(engKpi), 2)}` : '—';

      type KpiItem2 = { v: string; l: string };
      let kRow1: KpiItem2[] = [], kRow2: KpiItem2[] = [];
      if (objType === 'sales') {
        kRow1 = [{ v: spendVal, l: 'Inversión' }, { v: reachVal, l: 'Personas alcanzadas' }, { v: purchases, l: 'Compras generadas' }, { v: roasStr, l: 'Retorno (ROAS)' }];
        kRow2 = [{ v: cpaStr, l: 'Costo por compra' }, { v: purchaseValueStr, l: 'Valor en ventas' }, { v: clicksVal, l: 'Clics al sitio' }, { v: ctrVal2, l: 'CTR promedio' }];
      } else if (objType === 'leads') {
        kRow1 = [{ v: spendVal, l: 'Inversión' }, { v: reachVal, l: 'Personas alcanzadas' }, { v: leadsKpi, l: 'Leads generados' }, { v: cplKpi, l: 'Costo por lead' }];
        kRow2 = [{ v: clicksVal, l: 'Clics al sitio' }, { v: ctrVal2, l: 'CTR promedio' }, { v: cpmVal, l: 'CPM' }, { v: freqVal, l: 'Frecuencia' }];
      } else if (objType === 'messages') {
        kRow1 = [{ v: spendVal, l: 'Inversión' }, { v: reachVal, l: 'Personas alcanzadas' }, { v: msgsKpi, l: 'Conversaciones' }, { v: cpmsgKpi, l: 'Costo por conv.' }];
        kRow2 = [{ v: clicksVal, l: 'Clics' }, { v: ctrVal2, l: 'CTR promedio' }, { v: cpmVal, l: 'CPM' }, { v: freqVal, l: 'Frecuencia' }];
      } else if (objType === 'traffic') {
        kRow1 = [{ v: spendVal, l: 'Inversión' }, { v: reachVal, l: 'Personas alcanzadas' }, { v: clicksVal, l: 'Clics al sitio' }, { v: cpcVal, l: 'Costo por clic' }];
        kRow2 = [{ v: ctrVal2, l: 'CTR promedio' }, { v: impressionsVal, l: 'Impresiones' }, { v: cpmVal, l: 'CPM' }, { v: freqVal, l: 'Frecuencia' }];
      } else if (objType === 'engagement') {
        kRow1 = [{ v: spendVal, l: 'Inversión' }, { v: reachVal, l: 'Personas alcanzadas' }, { v: engKpi, l: 'Interacciones' }, { v: cpeKpi, l: 'Costo x interac.' }];
        kRow2 = [{ v: impressionsVal, l: 'Impresiones' }, { v: ctrVal2, l: 'CTR promedio' }, { v: cpmVal, l: 'CPM' }, { v: freqVal, l: 'Frecuencia' }];
      } else {
        kRow1 = [{ v: spendVal, l: 'Inversión' }, { v: reachVal, l: 'Personas alcanzadas' }, { v: clicksVal, l: 'Clics al sitio' }, { v: ctrVal2, l: 'CTR promedio' }];
        kRow2 = [{ v: impressionsVal, l: 'Impresiones' }, { v: cpmVal, l: 'CPM' }, { v: freqVal, l: 'Frecuencia' }, { v: cpcVal, l: 'CPC' }];
      }
      const renderKRow = (items: KpiItem2[]) =>
        `<div class="kpi-row">${items.map(k => `<div class="kpi"><div class="kv">${k.v}</div><div class="kl">${k.l}</div></div>`).join('')}</div>`;

      // ── Campaigns table ──
      const campRowsHtml = campaigns
        .filter(c => parseFloat(campaignInsights[c.id]?.spend || '0') > 0)
        .map(c => {
          const ins = campaignInsights[c.id];
          const metric = ins ? getPrimaryMetric(c.objective || '', ins) : null;
          const ctr = ins ? fmtNum(parseFloat(ins.inline_link_click_ctr || '0'), 2) : '—';
          const statusDot = c.status === 'ACTIVE' ? '#22c55e' : '#f59e0b';
          return `<tr>
            <td style="text-align:left;font-weight:600;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
              <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${statusDot};margin-right:6px;"></span>${c.name}
            </td>
            <td>${cur} ${fmtNum(ins?.spend, 0)}</td>
            <td>${ins?.reach ? parseInt(ins.reach).toLocaleString('es-AR') : '—'}</td>
            <td style="font-weight:700;color:#2196F3;">${metric?.value || '—'}</td>
            <td>${metric?.cost || '—'}</td>
            <td style="font-weight:700;${parseFloat(ins?.inline_link_click_ctr || '0') >= 1.5 ? 'color:#16a34a' : parseFloat(ins?.inline_link_click_ctr || '0') >= 1 ? 'color:#d97706' : 'color:#dc2626'}">${ctr}%</td>
          </tr>`;
        }).join('');

      // ── AI narrative (if available) ──
      const narrativeHtml = clientReportText
        ? clientReportText
            .replace(/## ([^\n]+)/g, '<h2 style="font-size:11px;font-weight:800;color:#1A3A5C;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid #e5e9ed;padding-bottom:6px;margin:24px 0 10px;">$1</h2>')
            .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
            .replace(/\n{2,}/g, '</p><p>')
            .replace(/\n/g, ' ')
            .replace(/^/, '<p style="font-size:12.5px;color:#2d3748;line-height:1.7;margin-bottom:12px;">')
            .replace(/$/, '</p>')
        : '';

      // ── Gender helpers ──
      const gLabel: Record<string, string> = { male: 'Masculino', female: 'Femenino', unknown: 'Desconocido' };
      const gOrder = ['male', 'female', 'unknown'];
      const gData: Record<string, any> = {};
      for (const r of byGender) { gData[r.gender] = r; }

      const gRow = (label: string, fn: (r: any) => string) =>
        `<tr><td class="row-label">${label}</td>${gOrder.map(g => `<td>${gData[g] ? fn(gData[g]) : '—'}</td>`).join('')}</tr>`;

      const objMetricRow = (r: any) => {
        const spend = parseFloat(r.spend || '0');
        const actions = r.actions || [];
        const getV = (types: string[]) => parseFloat(getMetaVal(actions, ...types) || '0');

        let v = 0;
        if (objType === 'sales') {
          v = getV(['offsite_conversion.fb_pixel_purchase', 'omni_purchase', 'purchase', 'onsite_conversion.purchase']);
        } else if (objType === 'leads') {
          v = getV(['lead', 'offsite_conversion.fb_pixel_lead', 'onsite_conversion.lead_grouped']);
        } else if (objType === 'messages') {
          v = getV(['onsite_conversion.messaging_conversation_started_7d', 'onsite_conversion.messaging_first_reply']);
        }

        // Si no encontró (o si objType es traffic/engagement/mixed), intentar en orden de valor:
        if (v === 0) {
          v = getV(['offsite_conversion.fb_pixel_purchase', 'omni_purchase', 'purchase', 'onsite_conversion.purchase']);
          if (v === 0) v = getV(['lead', 'offsite_conversion.fb_pixel_lead', 'onsite_conversion.lead_grouped']);
          if (v === 0) v = getV(['onsite_conversion.messaging_conversation_started_7d', 'onsite_conversion.messaging_first_reply']);
          if (v === 0 && (objType === 'traffic' || objType === 'mixed' || objType === 'awareness')) v = parseFloat(r.inline_link_clicks || '0');
          if (v === 0 && objType === 'engagement') v = getV(['post_engagement', 'page_engagement']);
        }

        const cost = v > 0 ? `${cur} ${fmtNum(spend / v, 0)}` : '—';
        return { val: v > 0 ? String(v) : '—', cost };
      };
      const objLabel: Record<string, [string, string]> = {
        sales: ['Resultados', 'Costo/Res.'],
        leads: ['Leads', 'Costo por lead'],
        messages: ['Conversaciones', 'Costo por conv.'],
        traffic: ['Clics', 'CPC'],
        engagement: ['Interacciones', 'Costo x interac.'],
        awareness: ['Impresiones', 'CPM'],
        mixed: ['Resultados', 'Costo/Res.'],
      };
      const [oLabel, oCostLabel] = objLabel[objType] || ['Resultados', 'Costo/Res.'];

      // ── Bar HTML ──
      const barHtml = (items: { label: string; pct: number; value: string }[]) =>
        items.map(it => `
          <div class="bar-row">
            <span class="bar-label">${it.label}</span>
            <div class="bar-track"><div class="bar-fill" style="width:${it.pct}%"></div></div>
            <span class="bar-meta">${it.value} &nbsp;<span class="bar-pct">${it.pct.toFixed(1)}%</span></span>
          </div>`).join('');

      // Gender bars
      const gBars = barHtml(gOrder.filter(g => gData[g]).map(g => {
        const sp = parseFloat(gData[g]?.spend || '0');
        return { label: gLabel[g], pct: totalSpend > 0 ? (sp / totalSpend) * 100 : 0, value: `${cur} ${fmtNum(sp, 0)}` };
      }));

      // Age sort & bars
      const ageOrder = ['13-17','18-24','25-34','35-44','45-54','55-64','65+'];
      const sortedAge = [...byAge].sort((a: any, b: any) => {
        const ia = ageOrder.indexOf(a.age); const ib = ageOrder.indexOf(b.age);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      });
      const ageBars = barHtml(sortedAge.map((r: any) => {
        const sp = parseFloat(r.spend || '0');
        return { label: r.age, pct: totalSpend > 0 ? (sp / totalSpend) * 100 : 0, value: `${cur} ${fmtNum(sp, 0)}` };
      }));

      // Age table rows
      const ageRows = sortedAge.map((r: any) => {
        const sp = parseFloat(r.spend || '0');
        const spPct = totalSpend > 0 ? ((sp / totalSpend) * 100).toFixed(1) + '%' : '—';
        const reach = parseInt(r.reach || '0').toLocaleString('es-AR');
        const ctr = fmtNum(r.inline_link_click_ctr, 2) + '%';
        const cpm = `${cur} ${fmtNum(r.cpm, 0)}`;
        const metric = objMetricRow(r);
        return `<tr>
          <td class="row-label"><strong>${r.age}</strong></td>
          <td>${cur} ${fmtNum(sp, 0)}</td>
          <td>${spPct}</td>
          <td>${reach}</td>
          <td>${ctr}</td>
          <td>${cpm}</td>
          <td>${metric.val}</td>
          <td>${metric.cost}</td>
        </tr>`;
      }).join('');

      // ── Region (location) ──
      const sortedRegion = [...byRegion]
        .filter((r: any) => parseFloat(r.spend || '0') > 0)
        .sort((a: any, b: any) => parseFloat(b.spend) - parseFloat(a.spend))
        .slice(0, 15);
      const regionRows = sortedRegion.map((r: any) => {
        const sp = parseFloat(r.spend || '0');
        const spPct = totalSpend > 0 ? ((sp / totalSpend) * 100).toFixed(1) + '%' : '—';
        const reach = parseInt(r.reach || '0').toLocaleString('es-AR');
        const impr = parseInt(r.impressions || '0').toLocaleString('es-AR');
        const ctr = fmtNum(r.inline_link_click_ctr, 2) + '%';
        const cpm = `${cur} ${fmtNum(r.cpm, 0)}`;
        const metric = objMetricRow(r);
        return `<tr>
          <td class="row-label"><strong>${r.region || r.country || '—'}</strong></td>
          <td>${cur} ${fmtNum(sp, 0)}</td>
          <td>${spPct}</td>
          <td>${reach}</td>
          <td>${impr}</td>
          <td>${ctr}</td>
          <td>${cpm}</td>
          <td>${metric.val}</td>
          <td>${metric.cost}</td>
        </tr>`;
      }).join('');
      const regionBars = barHtml(sortedRegion.slice(0, 10).map((r: any) => {
        const sp = parseFloat(r.spend || '0');
        return { label: r.region || r.country || '—', pct: totalSpend > 0 ? (sp / totalSpend) * 100 : 0, value: `${cur} ${fmtNum(sp, 0)}` };
      }));

      // ── Placement (publisher_platform + platform_position combined) ──
      const placementName = (plat: string, pos: string): string => {
        const p = (plat || '').toLowerCase();
        const pp = (pos || '').toLowerCase();
        if (p === 'instagram') {
          if (pp === 'reels') return 'Instagram Reels';
          if (pp === 'story') return 'Instagram Stories';
          if (pp === 'stream' || pp === 'feed') return 'Instagram Feed';
          if (pp === 'explore') return 'Instagram Explorar';
          if (pp === 'explore_home') return 'Instagram Explorar (inicio)';
          if (pp === 'profile_feed') return 'Instagram Perfil';
          return `Instagram ${pos}`;
        }
        if (p === 'facebook') {
          if (pp === 'feed') return 'Facebook Feed';
          if (pp === 'story') return 'Facebook Stories';
          if (pp === 'reels') return 'Facebook Reels';
          if (pp === 'right_hand_column') return 'Facebook Columna derecha';
          if (pp === 'marketplace') return 'Facebook Marketplace';
          if (pp === 'instant_article') return 'Facebook Artículos';
          if (pp === 'video_feeds') return 'Facebook Videos';
          if (pp === 'search') return 'Facebook Búsqueda';
          return `Facebook ${pos}`;
        }
        if (p === 'messenger') {
          if (pp === 'messenger_inbox') return 'Messenger Inbox';
          if (pp === 'story') return 'Messenger Stories';
          return `Messenger ${pos}`;
        }
        if (p === 'audience_network') {
          if (pp === 'classic') return 'Audience Network';
          if (pp === 'rewarded_video') return 'Audience Network Video';
          return `Audience Network ${pos}`;
        }
        return pos || plat || '—';
      };
      const sortedPlat = [...byPlacement]
        .filter((r: any) => parseFloat(r.spend || '0') > 0)
        .sort((a: any, b: any) => parseFloat(b.spend) - parseFloat(a.spend));
      const platRows = sortedPlat.map((r: any) => {
        const sp = parseFloat(r.spend || '0');
        const spPct = totalSpend > 0 ? ((sp / totalSpend) * 100).toFixed(1) + '%' : '—';
        const reach = parseInt(r.reach || '0').toLocaleString('es-AR');
        const impr = parseInt(r.impressions || '0').toLocaleString('es-AR');
        const ctr = fmtNum(r.inline_link_click_ctr, 2) + '%';
        const cpm = `${cur} ${fmtNum(r.cpm, 0)}`;
        const metric = objMetricRow(r);
        const pName = placementName(r.publisher_platform, r.platform_position);
        return `<tr>
          <td class="row-label"><strong>${pName}</strong></td>
          <td>${cur} ${fmtNum(sp, 0)}</td>
          <td>${spPct}</td>
          <td>${reach}</td>
          <td>${impr}</td>
          <td>${ctr}</td>
          <td>${cpm}</td>
          <td>${metric.val}</td>
          <td>${metric.cost}</td>
        </tr>`;
      }).join('');
      const platBars = barHtml(sortedPlat.map((r: any) => {
        const sp = parseFloat(r.spend || '0');
        return { label: placementName(r.publisher_platform, r.platform_position), pct: totalSpend > 0 ? (sp / totalSpend) * 100 : 0, value: `${cur} ${fmtNum(sp, 0)}` };
      }));


      pw.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Reporte Completo — ${clientName} — ${period}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1a1a1a;background:#fff;font-size:13px;line-height:1.65;}
  .page{max-width:860px;margin:0 auto;padding:0 0 60px;}
  .header{background:#0d1b2a;color:white;padding:32px 40px;text-align:center;margin-bottom:28px;}
  .header h1{font-size:26px;font-weight:800;color:white;margin-bottom:6px;letter-spacing:-0.3px;}
  .header .sub{color:#B0C4D8;font-size:13px;font-weight:600;margin-bottom:4px;}
  .header .date{color:#8aa8be;font-size:11px;font-style:italic;}
  .kpi-section{padding:0 40px;margin-bottom:28px;break-inside:avoid;page-break-inside:avoid;}
  .kpi-row{display:grid;grid-template-columns:repeat(4,1fr);gap:0;border:1px solid #e5e9ed;border-radius:10px;overflow:hidden;margin-bottom:10px;break-inside:avoid;page-break-inside:avoid;}
  .kpi{padding:16px 10px;text-align:center;border-right:1px solid #e5e9ed;background:#fafbfc;}
  .kpi:last-child{border-right:none;}
  .kv{font-size:20px;font-weight:800;color:#2196F3;line-height:1.1;margin-bottom:4px;}
  .kl{font-size:9px;color:#6b7280;text-transform:uppercase;letter-spacing:.07em;}
  .section{padding:0 40px;margin-bottom:0;padding-top:32px;padding-bottom:32px;break-inside:avoid;page-break-inside:avoid;}
  .section-break{break-before:page;page-break-before:always;}
  h2{font-size:11px;font-weight:800;color:#1A3A5C;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid #e5e9ed;padding-bottom:6px;margin-bottom:14px;break-after:avoid;page-break-after:avoid;}
  .camp-table{width:100%;border-collapse:collapse;font-size:11.5px;margin-bottom:4px;}
  .camp-table thead{display:table-header-group;}
  .camp-table th{background:#0d1b2a;color:white;padding:8px 10px;text-align:center;font-size:9.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;}
  .camp-table th:first-child{text-align:left;}
  .camp-table td{padding:7px 10px;text-align:center;border-bottom:1px solid #f0f2f5;font-size:11px;}
  .camp-table tr{break-inside:avoid;page-break-inside:avoid;}
  .camp-table tr:last-child td{border-bottom:none;}
  .breakdown-table{width:100%;border-collapse:collapse;font-size:11.5px;margin-bottom:18px;}
  .breakdown-table thead{display:table-header-group;}
  .breakdown-table th{background:#0d1b2a;color:white;padding:8px 10px;text-align:center;font-size:9.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;}
  .breakdown-table th:first-child{text-align:left;}
  .breakdown-table td{padding:7px 10px;text-align:center;border-bottom:1px solid #f0f2f5;}
  .breakdown-table td.row-label{text-align:left;color:#4b5563;font-size:10.5px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;background:#fafbfc;}
  .breakdown-table tr{break-inside:avoid;page-break-inside:avoid;}
  .breakdown-table tr:last-child td{border-bottom:none;}
  .breakdown-table .val-main{font-weight:800;color:#2196F3;font-size:13px;}
  .narrative{padding:0 40px;margin-bottom:32px;}
  .narrative p{font-size:12px;color:#2d3748;line-height:1.7;margin-bottom:10px;}
  .narrative strong{font-weight:700;color:#0d1b2a;}
  .bars{margin-top:4px;break-inside:avoid;page-break-inside:avoid;}
  .bar-row{display:flex;align-items:center;gap:10px;margin-bottom:7px;break-inside:avoid;page-break-inside:avoid;}
  .bar-label{width:150px;font-size:10.5px;color:#4b5563;font-weight:600;flex-shrink:0;}
  .bar-track{flex:1;height:11px;background:#f0f2f5;border-radius:5px;overflow:hidden;}
  .bar-fill{height:100%;background:linear-gradient(90deg,#1A3A5C,#2196F3);border-radius:5px;}
  .bar-meta{width:160px;font-size:10.5px;color:#374151;text-align:right;flex-shrink:0;}
  .bar-pct{font-weight:700;color:#2196F3;}
  .footer{background:#0d1b2a;color:#8aa8be;font-size:10px;text-align:center;padding:12px 40px;font-style:italic;margin-top:0;break-inside:avoid;page-break-inside:avoid;}
  @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}.page{padding:0;}
  @page{margin:15mm 10mm;}}
</style>
</head><body>
<div class="page">
  <div class="header">
    <div class="sub">REPORTE COMPLETO DE PUBLICIDAD</div>
    <h1>${clientName}</h1>
    <div class="date">Período: ${period} &nbsp;&middot;&nbsp; Generado: ${today}</div>
  </div>

  <!-- KPI Summary -->
  <div class="kpi-section">
    ${renderKRow(kRow1)}
    ${renderKRow(kRow2)}
  </div>

  <!-- Campaigns table -->
  ${campRowsHtml ? `
  <div class="section">
    <h2>Campañas Activas</h2>
    <table class="camp-table">
      <thead><tr><th>Campaña</th><th>Inversión</th><th>Alcance</th><th>Resultado</th><th>Costo/R</th><th>CTR</th></tr></thead>
      <tbody>${campRowsHtml}</tbody>
    </table>
  </div>` : ''}

  <!-- AI narrative if available -->
  ${narrativeHtml ? `<div class="narrative">${narrativeHtml}</div>` : ''}

  <div class="section section-break">
    <h2>Rendimiento por Género</h2>
    <table class="breakdown-table">
      <thead>
        <tr>
          <th></th>
          ${gOrder.map(g => `<th>${gLabel[g]}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${gRow('Inversión', r => `<span class="val-main">${cur} ${fmtNum(r.spend, 0)}</span>`)}
        ${gRow('% del gasto', r => {
          const sp = parseFloat(r.spend || '0');
          return totalSpend > 0 ? ((sp / totalSpend) * 100).toFixed(1) + '%' : '—';
        })}
        ${gRow('Alcance', r => parseInt(r.reach || '0').toLocaleString('es-AR'))}
        ${gRow('Impresiones', r => parseInt(r.impressions || '0').toLocaleString('es-AR'))}
        ${gRow('CTR', r => fmtNum(r.inline_link_click_ctr, 2) + '%')}
        ${gRow('CPM', r => `${cur} ${fmtNum(r.cpm, 0)}`)}
        ${gRow(oLabel, r => objMetricRow(r).val)}
        ${gRow(oCostLabel, r => objMetricRow(r).cost)}
      </tbody>
    </table>
    <div class="bars">${gBars}</div>
  </div>

  <div class="section section-break">
    <h2>Rendimiento por Edad</h2>
    <table class="breakdown-table">
      <thead>
        <tr>
          <th>Edad</th>
          <th>Inversión</th>
          <th>% Gasto</th>
          <th>Alcance</th>
          <th>CTR</th>
          <th>CPM</th>
          <th>${oLabel}</th>
          <th>${oCostLabel}</th>
        </tr>
      </thead>
      <tbody>${ageRows}</tbody>
    </table>
    <div class="bars">${ageBars}</div>
  </div>

  ${sortedPlat.length > 0 ? `
  <div class="section section-break">
    <h2>Rendimiento por Ubicación del Anuncio</h2>
    <table class="breakdown-table">
      <thead>
        <tr>
          <th>Placement</th>
          <th>Inversión</th>
          <th>% Gasto</th>
          <th>Alcance</th>
          <th>Impresiones</th>
          <th>CTR</th>
          <th>CPM</th>
          <th>${oLabel}</th>
          <th>${oCostLabel}</th>
        </tr>
      </thead>
      <tbody>${platRows}</tbody>
    </table>
    <div class="bars">${platBars}</div>
  </div>` : ''}

  ${sortedRegion.length > 0 ? `
  <div class="section section-break">
    <h2>Rendimiento por Ubicación Geográfica</h2>
    <table class="breakdown-table">
      <thead>
        <tr>
          <th>Región / Ciudad</th>
          <th>Inversión</th>
          <th>% Gasto</th>
          <th>Alcance</th>
          <th>Impresiones</th>
          <th>CTR</th>
          <th>CPM</th>
          <th>${oLabel}</th>
          <th>${oCostLabel}</th>
        </tr>
      </thead>
      <tbody>${regionRows}</tbody>
    </table>
    <div class="bars">${regionBars}</div>
  </div>` : ''}

  <div class="footer">Algoritmia &nbsp;&middot;&nbsp; ${today} &nbsp;&middot;&nbsp; Datos: Meta Ads</div>
</div>
</body></html>`);
      pw.document.close();
      setTimeout(() => pw.print(), 600);
    } catch (e: any) {
      showToast('Error al generar reporte de audiencia: ' + e.message, 'error');
    } finally {
      setIsGeneratingClientReport(false);
    }
  };

  // ── Export PDF ─────────────────────────────────────────────────────────────
  const handleExportPDF = () => {
    const pw = window.open('', '_blank');
    if (!pw) { showToast('El navegador bloqueó el popup. Permitir popups para exportar PDF.', 'error'); return; }
    const content = activeTab === 'CREATIVOS' ? (creativeAnalysisText || analysisText) : activeTab === 'CLIENTE' ? clientReportText : analysisText;
    const campRows = campaigns.map(c => {
      const ins = campaignInsights[c.id];
      const purchases = ins ? (getMetaVal(ins.actions || [], 'offsite_conversion.fb_pixel_purchase', 'purchase', 'omni_purchase') || '0') : '—';
      const roas = ins?.purchase_roas?.[0]?.value ? fmtNum(ins.purchase_roas[0].value, 2) : '—';
      const action = adActions[c.id]?.action || '—';
      return `<tr><td>${c.name}</td><td>${ins ? `$${fmtNum(ins.spend)}` : '—'}</td><td>${roas}</td><td>${purchases}</td><td>${ins ? `${fmtNum(ins.inline_link_click_ctr, 2)}%` : '—'}</td><td>${ins ? `$${fmtNum(ins.cpm, 2)}` : '—'}</td><td><b>${action}</b></td></tr>`;
    }).join('');

    pw.document.write(`<!DOCTYPE html><html><head><title>Reporte Meta Ads — ${accountOverview?.name || selectedAccountId}</title>
    <style>body{font-family:Arial,sans-serif;max-width:900px;margin:40px auto;color:#111;line-height:1.6;font-size:13px;}
    .header{background:#1a1a2e;color:white;padding:20px;border-radius:8px;margin-bottom:24px;}
    .header h1{color:white;margin:0;font-size:22px;}.header p{color:#a78bfa;margin:4px 0 0;}
    .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:20px 0;}
    .kpi{background:#f8f7ff;border:1px solid #e0e7ff;border-radius:8px;padding:12px;text-align:center;}
    .kpi .v{font-size:20px;font-weight:bold;color:#4f46e5;}.kpi .l{font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;}
    h2{font-size:15px;border-bottom:2px solid #6366f1;padding-bottom:4px;color:#4f46e5;margin-top:24px;}
    table{width:100%;border-collapse:collapse;margin:12px 0;font-size:11px;}
    th{background:#4f46e5;color:white;padding:8px;text-align:left;}td{padding:6px 8px;border-bottom:1px solid #f0f0f0;}
    tr:nth-child(even){background:#fafafa;}pre{white-space:pre-wrap;font-family:Arial;font-size:12px;}
    .footer{text-align:center;color:#9ca3af;font-size:10px;margin-top:32px;border-top:1px solid #eee;padding-top:12px;}</style></head><body>
    <div class="header"><h1>📊 Reporte Meta Ads</h1><p>${accountOverview?.name || selectedAccountId} · ${new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}</p></div>
    ${accountInsights ? `<div class="kpis">
    <div class="kpi"><div class="l">Gasto Total</div><div class="v">$${fmtNum(accountInsights.spend)}</div></div>
    <div class="kpi"><div class="l">ROAS</div><div class="v">${accountInsights.purchase_roas?.[0]?.value ? fmtNum(accountInsights.purchase_roas[0].value, 2) : '—'}</div></div>
    <div class="kpi"><div class="l">CTR</div><div class="v">${fmtNum(accountInsights.inline_link_click_ctr, 2)}%</div></div>
    <div class="kpi"><div class="l">CPM</div><div class="v">$${fmtNum(accountInsights.cpm, 2)}</div></div>
    </div>` : ''}
    ${campaigns.length > 0 ? `<h2>Campañas</h2><table><thead><tr><th>Campaña</th><th>Gasto</th><th>ROAS</th><th>Compras</th><th>CTR</th><th>CPM</th><th>Acción IA</th></tr></thead><tbody>${campRows}</tbody></table>` : ''}
    ${content ? `<h2>Análisis IA</h2><pre>${content.replace(/</g, '&lt;')}</pre>` : ''}
    <div class="footer">Generado por Algoritmia · Meta Ads Analyst · ${new Date().toLocaleDateString('es-AR')}</div>
    </body></html>`);
    pw.document.close();
    pw.print();
  };

  // ── Computed ───────────────────────────────────────────────────────────────
  const pieData = useMemo(() => campaigns
    .filter(c => parseFloat(campaignInsights[c.id]?.spend || 0) > 0)
    .map(c => ({
      name: c.name.length > 28 ? c.name.slice(0, 28) + '…' : c.name,
      value: Math.round(parseFloat(campaignInsights[c.id].spend)),
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10),
  [campaigns, campaignInsights]);

  const totalSpend = useMemo(() =>
    parseFloat(accountInsights?.spend || 0) || campaigns.reduce((s, c) => s + parseFloat(campaignInsights[c.id]?.spend || 0), 0),
  [accountInsights, campaigns, campaignInsights]);

  const adPerformanceData = useMemo(() => {
    const allItems: Array<{
      ad: any; ins: any; adset: any; camp: any;
      spend: number; roas: number; freq: number; ctr: number; cpa: number;
      spendPct: number;
      classification: 'SCALER' | 'RELIABLE' | 'FAKE WIN' | 'LIABILITY';
      classReason: string;
      fatigueLevel: 'ok' | 'warning' | 'danger';
    }> = [];
    for (const [campId, adsets] of Object.entries(campaignAdSets)) {
      const camp = campaigns.find((c: any) => c.id === campId);
      for (const adset of adsets as any[]) {
        const adsList = adSetAds[adset.id] || [];
        for (const ad of adsList) {
          const ins = adInsights[ad.id];
          if (!ins || parseFloat(ins.spend || 0) === 0) continue;
          const spend = parseFloat(ins.spend || 0);
          const roas = ins.purchase_roas?.[0]?.value ? parseFloat(ins.purchase_roas[0].value) : 0;
          const freq = parseFloat(ins.frequency || 0);
          const ctr = parseFloat(ins.inline_link_click_ctr || 0);
          const purchases = parseFloat(getMetaVal(ins.actions || [], 'omni_purchase', 'offsite_conversion.fb_pixel_purchase', 'purchase') || '0');
          const cpa = purchases > 0 ? spend / purchases : 0;
          allItems.push({ ad, ins, adset, camp, spend, roas, freq, ctr, cpa, spendPct: 0, classification: 'RELIABLE', classReason: '', fatigueLevel: 'ok' });
        }
      }
    }
    if (allItems.length === 0) return null;
    const totalAdSpend = allItems.reduce((s, a) => s + a.spend, 0);
    const withRoas = allItems.filter(a => a.roas > 0);
    const avgRoas = withRoas.length > 0 ? withRoas.reduce((s, a) => s + a.roas, 0) / withRoas.length : 0;
    const withCpa = allItems.filter(a => a.cpa > 0);
    const avgCpa = withCpa.length > 0 ? withCpa.reduce((s, a) => s + a.cpa, 0) / withCpa.length : 0;
    for (const item of allItems) {
      item.spendPct = totalAdSpend > 0 ? (item.spend / totalAdSpend) * 100 : 0;
      item.fatigueLevel = item.freq > 3.5 ? 'danger' : item.freq > 2.5 ? 'warning' : 'ok';
      if (avgRoas > 0 && item.roas > 0) {
        if (item.roas >= avgRoas * 1.25 && item.spend >= totalAdSpend * 0.08) {
          item.classification = 'SCALER';
          item.classReason = `ROAS ${item.roas.toFixed(1)}x — ${Math.round((item.roas / avgRoas - 1) * 100)}% sobre promedio de la cuenta`;
        } else if (item.spendPct >= 15 && item.roas < avgRoas * 0.75) {
          item.classification = 'LIABILITY';
          item.classReason = `Consume ${item.spendPct.toFixed(0)}% del presupuesto con ROAS ${item.roas.toFixed(1)}x vs promedio ${avgRoas.toFixed(1)}x`;
        } else if (item.roas < avgRoas * 0.9 && item.cpa > 0 && avgCpa > 0 && item.cpa <= avgCpa) {
          item.classification = 'FAKE WIN';
          item.classReason = `CPA parece bueno pero ROAS ${item.roas.toFixed(1)}x está bajo el promedio de la cuenta (${avgRoas.toFixed(1)}x)`;
        }
      } else if (item.roas === 0 && item.spendPct >= 12) {
        item.classification = 'LIABILITY';
        item.classReason = `Consume ${item.spendPct.toFixed(0)}% del presupuesto sin generar conversiones`;
      }
    }
    const funnelSpend = { TOFU: 0, MOFU: 0, BOFU: 0 };
    for (const item of allItems) {
      const stage = classifyFunnel(item.camp?.objective || '', item.adset.optimization_goal, item.adset.name);
      funnelSpend[stage] += item.spend;
    }
    return { items: allItems, totalAdSpend, avgRoas, avgCpa, funnelSpend };
  }, [campaignAdSets, adSetAds, adInsights, campaigns]);

  const hasData = campaigns.length > 0;
  const hasAnalysis = analysisText.length > 0;
  const isLoading = isFetchingData || isAnalyzingAI;

  const currentChat = analysisChat;
  const currentQuickPrompts: string[] = ['¿Por qué no se vende?', '¿Qué campaña pausar primero?', '¿Hay fatiga de audiencia?', '¿Dónde hay fuga de presupuesto?'];

  return (
    <div className="flex h-[calc(100vh-60px)] overflow-hidden bg-[#f5f5f7] dark:bg-[#0a0a0a]">
      {/* ── MAIN CONTENT ───────────────────────────────────────────────── */}

      {/* ── LEFT SIDEBAR: Accounts ──────────────────────────────────────── */}
      <div className="w-[240px] flex-shrink-0 flex flex-col border-r border-black/[0.06] dark:border-white/[0.05] bg-white dark:bg-zinc-900 overflow-y-auto">
        <div className="px-3 pt-3 pb-2 border-b border-zinc-100 dark:border-zinc-800">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Cuentas Meta Ads</p>
        </div>

        {loadingAccounts ? (
          <div className="flex flex-col gap-2 p-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="rounded-xl p-3 border border-zinc-100 dark:border-zinc-800 animate-pulse">
                <div className="flex items-center gap-2 mb-2.5">
                  <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex-shrink-0" />
                  <div className="flex-1 space-y-1">
                    <div className="h-3 bg-zinc-100 dark:bg-zinc-800 rounded-full w-3/4" />
                    <div className="h-2 bg-zinc-50 dark:bg-zinc-800 rounded-full w-1/3" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="h-12 bg-zinc-50 dark:bg-zinc-800 rounded-lg" />
                  <div className="h-12 bg-zinc-50 dark:bg-zinc-800 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        ) : accounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 px-3">
            <p className="text-[11px] text-zinc-400 text-center">Sin cuentas activas</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1 p-2">
            {accounts.map(a => {
              const isSelected = a.id === selectedAccountId;
              const amt = a.spend15d || 0;
              const amtLabel = amt === 0 ? '—' : amt >= 1000 ? `$${(amt/1000).toFixed(1)}K` : `$${amt.toFixed(0)}`;
              return (
                <button key={a.id}
                  onClick={() => setSelectedAccountId(a.id)}
                  className={`w-full text-left rounded-lg px-2.5 py-2 border transition-all duration-150 flex items-center gap-2 ${
                    isSelected
                      ? 'bg-violet-50 dark:bg-violet-500/10 border-violet-200 dark:border-violet-500/30'
                      : 'bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800 hover:border-zinc-200 dark:hover:border-zinc-700'
                  }`}>
                  <div className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-violet-500' : 'bg-gradient-to-br from-violet-500 to-indigo-600'}`}>
                    <Building2 className="w-3 h-3 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[11px] font-semibold truncate leading-tight ${isSelected ? 'text-violet-700 dark:text-violet-300' : 'text-zinc-800 dark:text-zinc-200'}`}>{a.name || a.id}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-zinc-400">{a.currency || 'USD'}</span>
                      <span className={`text-[10px] font-bold ${isSelected ? 'text-violet-600 dark:text-violet-300' : 'text-zinc-600 dark:text-zinc-400'}`}>{amtLabel}</span>
                      {(a.activeCamps || 0) > 0 && <span className="text-[10px] text-emerald-500 font-semibold">{a.activeCamps} act.</span>}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex flex-1 min-w-0 flex-col overflow-hidden">

        {/* Top bar */}
        <div className="flex-shrink-0 bg-white dark:bg-zinc-900 border-b border-black/[0.06] dark:border-white/[0.05] px-4 py-2.5 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center flex-shrink-0 mr-1 shadow-sm border border-black/10">
              <BrainCircuit className="w-3.5 h-3.5 text-white" />
            </div>
            
            {loadingAccounts && <Loader2 className="w-3 h-3 animate-spin text-violet-500" />}

            {selectedAccountId && (
              <a
                href={`https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${selectedAccountId.replace('act_', '')}`}
                target="_blank"
                rel="noopener noreferrer"
                title="Abrir en Meta Ads Manager"
                className="flex items-center gap-1 px-2 py-1.5 rounded-md bg-[#1877F2]/10 hover:bg-[#1877F2]/20 text-[#1877F2] text-[10px] font-bold transition-all ml-1"
              >
                <ExternalLink className="w-3 h-3" />
                Meta
              </a>
            )}
          </div>

          <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-[6px]">
            {(['preset', 'custom'] as const).map(m => (
              <button key={m} onClick={() => setDateMode(m)}
                className={`px-2 py-1 rounded-[5px] text-[10px] font-semibold transition-all ${dateMode === m ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 dark:text-zinc-400'}`}>
                {m === 'preset' ? 'Preset' : 'Custom'}
              </button>
            ))}
          </div>

          {dateMode === 'preset' ? (
            <select value={preset} onChange={e => setPreset(e.target.value as DatePreset)}
              className="text-[11px] bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-0 rounded-[6px] px-2 py-1 focus:outline-none focus:ring-1 focus:ring-violet-400">
              {DATE_PRESETS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          ) : (
            <div className="flex items-center gap-1">
              <input type="date" value={since} onChange={e => setSince(e.target.value)}
                className="text-[11px] bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-0 rounded-[6px] px-2 py-1 focus:outline-none focus:ring-1 focus:ring-violet-400" />
              <span className="text-[10px] text-zinc-400">→</span>
              <input type="date" value={until} onChange={e => setUntil(e.target.value)}
                className="text-[11px] bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-0 rounded-[6px] px-2 py-1 focus:outline-none focus:ring-1 focus:ring-violet-400" />
            </div>
          )}

          <div className="flex-1" />

          <button onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[7px] border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 text-[11px] font-medium hover:bg-zinc-50 dark:hover:bg-white/[0.04] transition-all">
            <Upload className="w-3 h-3" />
            {uploadedFiles.length > 0 ? `${uploadedFiles.length} archivo(s)` : 'Adjuntar'}
          </button>
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={e => setUploadedFiles(Array.from(e.target.files || []))} />

          <button onClick={handleExportPDF} disabled={!hasData}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[7px] border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 text-[11px] font-medium hover:bg-zinc-50 dark:hover:bg-white/[0.04] transition-all disabled:opacity-40">
            <FileDown className="w-3 h-3" />
            Exportar PDF
          </button>

          {/* Data coverage pill */}
          {hasData && (() => {
            const loadedAdSets = Object.values(campaignAdSets).flat().length;
            const loadedAds = Object.values(adSetAds).flat().length;
            return loadedAdSets > 0 ? (
              <div className="flex items-center gap-1 px-2 py-1 rounded-[6px] bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-700 text-[9px] text-zinc-400 font-mono flex-shrink-0">
                <span>{campaigns.length}c</span>
                <span className="text-zinc-200 dark:text-zinc-700">·</span>
                <span>{loadedAdSets}ca</span>
                {loadedAds > 0 && <><span className="text-zinc-200 dark:text-zinc-700">·</span><span>{loadedAds}an</span></>}
              </div>
            ) : null;
          })()}

          {/* ANALIZAR TODO — primary CTA */}
          <button onClick={analyzeAll} disabled={isAnalyzingAll || !hasData || isAnalyzingAI}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-violet-500 hover:bg-violet-600 text-white text-[11px] font-bold transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed">
            {isAnalyzingAll ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /><span>{analyzeAllProgress || 'Analizando...'}</span></> : <><BrainCircuit className="w-3.5 h-3.5" /><span>Analizar Todo</span></>}
          </button>

          {/* Chat toggle */}
          <button onClick={() => setChatOpen(o => !o)} title={chatOpen ? 'Cerrar chat' : 'Abrir chat'}
            className={`flex items-center gap-1 px-2 py-1.5 rounded-[7px] text-[11px] font-medium transition-all border ${chatOpen ? 'bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800 text-violet-600 dark:text-violet-400' : 'border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-white/[0.04]'}`}>
            {chatOpen ? <PanelRightClose className="w-3 h-3" /> : <PanelRightOpen className="w-3 h-3" />}
          </button>

          <button onClick={() => { loadAccounts(); }} disabled={loadingAccounts}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[7px] border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 text-[11px] font-medium hover:bg-zinc-50 dark:hover:bg-white/[0.04] transition-all disabled:opacity-40">
            <RefreshCw className={`w-3 h-3 ${loadingAccounts ? 'animate-spin' : ''}`} />
            Actualizar
          </button>

          <button onClick={() => setSkillsOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[7px] border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 text-[11px] font-medium hover:bg-zinc-50 dark:hover:bg-white/[0.04] transition-all">
            <BrainCircuit className="w-3 h-3 text-violet-500" />
            Skills IA
          </button>

          <button
            onClick={() => { handleRunAIAnalysis(); }}
            disabled={isLoading || !selectedAccountId}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-[7px] bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-bold tracking-wide disabled:opacity-50 transition-all shadow-sm">
            {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
            ANALIZAR
          </button>
        </div>

        {/* Progress bar */}
        {(isLoading && analysisProgress) && (
          <div className="flex-shrink-0 bg-violet-50 dark:bg-violet-900/20 border-b border-violet-100 dark:border-violet-800/40 px-4 py-2 flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 text-violet-500 animate-spin flex-shrink-0" />
            <p className="text-[12px] text-violet-700 dark:text-violet-300 font-medium">{analysisProgress}</p>
          </div>
        )}

        {/* Error banner */}
        {analysisError && (
          <div className="flex-shrink-0 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 px-4 py-2.5 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-[12px] text-amber-700 dark:text-amber-300 font-medium flex-1">{analysisError}</p>
            <button onClick={() => setAnalysisError(null)} className="text-amber-400 hover:text-amber-600 transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex-shrink-0 bg-white dark:bg-zinc-900 border-b border-black/[0.06] dark:border-white/[0.05] px-4 flex items-center">
          {([
            { id: 'REPORTES',      label: '📈 Datos' },
            { id: 'CREATIVOS',     label: '🧠 Análisis Creativo' },
            { id: 'CLIENTE',       label: '📄 Reporte Cliente' },
            { id: 'GPT_OPTIMIZER', label: '🎯 GPT Optimizer' },
          ] as const).map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-[12px] font-semibold border-b-2 transition-all -mb-px ${
                activeTab === tab.id
                  ? 'border-violet-500 text-violet-600 dark:text-violet-400'
                  : 'border-transparent text-zinc-500 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
              }`}>{tab.label}</button>
          ))}
        </div>

        {/* Content + Chat */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* Tab content */}
          <div className="flex-[2] min-w-0 overflow-y-auto p-5">

            {/* ── REPORTES ─────────────────────────────────────────── */}
            {activeTab === 'REPORTES' && (
              <div className="space-y-5 pb-28">
                {/* ── Account KPI Summary Strip ── */}
              {accountInsights && !isFetchingData && (
                <div className="flex-shrink-0 px-4 py-2.5 bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-4 overflow-x-auto">
                  {[
                    { l: 'Gasto', v: `${accountOverview?.currency || ''} ${fmtNum(accountInsights.spend, 0)}`, color: 'text-zinc-800 dark:text-zinc-100' },
                    { l: 'Alcance', v: parseInt(accountInsights.reach || '0').toLocaleString('es-AR'), color: 'text-zinc-800 dark:text-zinc-100' },
                    { l: 'ROAS', v: accountInsights.purchase_roas?.[0]?.value ? fmtNum(accountInsights.purchase_roas[0].value, 2)+'x' : '—', color: parseFloat(accountInsights.purchase_roas?.[0]?.value || '0') >= 2 ? 'text-emerald-600' : parseFloat(accountInsights.purchase_roas?.[0]?.value || '0') > 0 ? 'text-amber-500' : 'text-zinc-500' },
                    { l: 'CTR', v: fmtNum(accountInsights.inline_link_click_ctr, 2)+'%', color: parseFloat(accountInsights.inline_link_click_ctr || '0') >= 1.5 ? 'text-emerald-600' : parseFloat(accountInsights.inline_link_click_ctr || '0') >= 1 ? 'text-amber-500' : 'text-red-500' },
                    { l: 'CPM', v: fmtNum(accountInsights.cpm, 0), color: 'text-zinc-800 dark:text-zinc-100' },
                    { l: 'Frecuencia', v: fmtNum(accountInsights.frequency, 2), color: parseFloat(accountInsights.frequency || '0') > 3.5 ? 'text-red-500' : parseFloat(accountInsights.frequency || '0') > 2.5 ? 'text-amber-500' : 'text-zinc-800 dark:text-zinc-100' },
                    { l: 'Impresiones', v: parseInt(accountInsights.impressions || '0').toLocaleString('es-AR'), color: 'text-zinc-600 dark:text-zinc-400' },
                  ].map(k => (
                    <div key={k.l} className="flex items-center gap-1.5 flex-shrink-0 pr-4 border-r border-zinc-100 dark:border-zinc-800 last:border-0 last:pr-0">
                      <span className="text-[9px] text-zinc-400 uppercase tracking-wider font-semibold">{k.l}</span>
                      <span className={`text-[12px] font-bold ${k.color}`}>{k.v}</span>
                    </div>
                  ))}
                </div>
              )}

              {!hasData && !isLoading && (
                  <div className="flex flex-col items-center justify-center py-24 gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center">
                      <TrendingUp className="w-7 h-7 text-violet-400" />
                    </div>
                    <p className="text-[14px] font-semibold text-zinc-500 dark:text-zinc-400">
                      {loadingAccounts ? 'Cargando cuentas...' : accounts.length === 0 ? 'No hay cuentas activas' : 'Seleccioná una cuenta'}
                    </p>
                    <p className="text-[12px] text-zinc-400 dark:text-zinc-600">
                      {loadingAccounts ? 'Obteniendo cuentas de Meta Ads...' : accounts.length === 0 ? 'Verificá el token de acceso o actualizá las cuentas' : 'Los datos se cargan automáticamente al seleccionar'}
                    </p>
                  </div>
                )}

                {hasData && (
                  <>
                    {/* Account header */}
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <h2 className="text-[18px] font-bold text-zinc-900 dark:text-white tracking-tight truncate">{accountOverview?.name || selectedAccountId}</h2>
                        <p className="text-[12px] text-zinc-400 mt-0.5">
                          {accountOverview?.currency} · Período: {dateMode === 'custom' ? `${since} → ${until}` : DATE_PRESETS.find(p => p.value === preset)?.label}
                          {isAnalyzingAI && <span className="ml-2 text-violet-500 font-medium">· Analizando con IA...</span>}
                        </p>
                      </div>
                      {accountInsights && (() => {
                        const score = calcPerfScore(accountInsights, accountOverview?.currency || 'ARS');
                        const color = score >= 70 ? { ring: 'border-emerald-400', text: 'text-emerald-600', label: 'Saludable', bg: 'bg-emerald-50 dark:bg-emerald-900/20' } : score >= 45 ? { ring: 'border-amber-400', text: 'text-amber-600', label: 'Regular', bg: 'bg-amber-50 dark:bg-amber-900/20' } : { ring: 'border-red-400', text: 'text-red-500', label: 'Critico', bg: 'bg-red-50 dark:bg-red-900/20' };
                        return (
                          <div className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl border-2 ${color.ring} ${color.bg} flex-shrink-0`}>
                            <div className="text-center">
                              <div className={`text-[28px] font-black leading-none ${color.text}`}>{score}</div>
                              <div className={`text-[9px] font-bold uppercase tracking-wide mt-0.5 ${color.text}`}>{color.label}</div>
                            </div>
                            <div className="text-[9px] text-zinc-400 leading-tight">
                              <div>Health</div>
                              <div>Score</div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* KPI Cards */}
                    {(() => {
                      const curr = accountOverview?.currency || '';
                      // Only apply USD-specific thresholds when we KNOW the currency is USD
                      const isUSD = curr === 'USD';
                      const currencyKnown = curr !== '';
                      const ctr = parseFloat(accountInsights?.inline_link_click_ctr || 0);
                      const roasVal = parseFloat(accountInsights?.purchase_roas?.[0]?.value || 0);
                      return (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                          <KpiCard
                            label="Gasto Total"
                            value={`${curr === 'USD' ? '$' : ''}${parseInt(fmtNum(accountInsights?.spend || totalSpend)).toLocaleString('es-AR')}${curr && curr !== 'USD' ? ` ${curr}` : ''}`}
                            icon={DollarSign}
                            color="text-violet-600 dark:text-violet-400"
                          />
                          <KpiCard
                            label="ROAS"
                            value={roasVal > 0 ? fmtNum(roasVal, 2) : '—'}
                            sub={roasVal >= 2 ? '✓ Bueno' : roasVal > 0 ? '⚠ Mejorar' : undefined}
                            icon={TrendingUp}
                            color={roasVal >= 2 ? 'text-emerald-600' : roasVal > 0 ? 'text-amber-600' : 'text-zinc-900 dark:text-white'}
                          />
                          <KpiCard
                            label="CTR"
                            value={`${fmtNum(ctr, 2)}%`}
                            sub={ctr >= 1.5 ? '✓ Bueno' : ctr >= 1 ? '⚠ Aceptable' : '✗ Bajo'}
                            icon={Activity}
                            color={ctr >= 1.5 ? 'text-emerald-600' : ctr >= 1 ? 'text-amber-500' : 'text-red-500'}
                          />
                          {(() => {
                            const cpmVal = parseFloat(accountInsights?.cpm || 0);
                            const cpmThreshold = getCpmThreshold(curr);
                            const cpmOk = currencyKnown ? cpmVal <= cpmThreshold : true;
                            return (
                              <KpiCard
                                label="CPM"
                                value={`${fmtNum(cpmVal, 2)}${curr ? ` ${curr}` : ''}`}
                                sub={currencyKnown && cpmVal > 0 ? (cpmOk ? '✓ OK' : '⚠ Alto') : undefined}
                                color={currencyKnown && !cpmOk ? 'text-red-500' : 'text-zinc-900 dark:text-white'}
                              />
                            );
                          })()}
                          <KpiCard label="CPC" value={`${fmtNum(accountInsights?.cpc, 0)}${curr ? ` ${curr}` : ''}`} />
                          <KpiCard label="Alcance" value={parseInt(accountInsights?.reach || 0).toLocaleString('es-AR')} />
                          <KpiCard
                            label="Frecuencia"
                            value={fmtNum(accountInsights?.frequency, 2)}
                            sub={parseFloat(accountInsights?.frequency || 0) <= 2.5 ? '✓ OK' : parseFloat(accountInsights?.frequency || 0) <= 3.5 ? '⚠ Atención' : '✗ Fatiga'}
                            color={parseFloat(accountInsights?.frequency || 0) > 3.5 ? 'text-red-500' : parseFloat(accountInsights?.frequency || 0) > 2.5 ? 'text-amber-500' : 'text-zinc-900 dark:text-white'}
                          />
                          <KpiCard label="Impresiones" value={parseInt(accountInsights?.impressions || 0).toLocaleString('es-AR')} />
                        </div>
                      );
                    })()}

                    {/* Conversions KPIs */}
                    {accountInsights && (() => {
                      const purchases = getMetaVal(accountInsights.actions || [], 'offsite_conversion.fb_pixel_purchase', 'purchase', 'omni_purchase');
                      const atc = getMetaVal(accountInsights.actions || [], 'offsite_conversion.fb_pixel_add_to_cart', 'add_to_cart');
                      const initiate = getMetaVal(accountInsights.actions || [], 'offsite_conversion.fb_pixel_initiate_checkout', 'initiate_checkout');
                      if (!purchases && !atc) return null;
                      const costPerPurchase = purchases && parseFloat(purchases) > 0 && parseFloat(accountInsights.spend || 0) > 0
                        ? `$${(parseFloat(accountInsights.spend) / parseFloat(purchases)).toFixed(0)}`
                        : undefined;
                      return (
                        <div className="grid grid-cols-3 gap-3">
                          <KpiCard label="Compras" value={purchases || '0'} sub={costPerPurchase ? `${costPerPurchase} / compra` : undefined} icon={CheckCircle2} color="text-emerald-600" />
                          <KpiCard label="Add to Cart" value={atc || '0'} />
                          <KpiCard label="Pagos Iniciados" value={initiate || '0'} />
                        </div>
                      );
                    })()}

                    {/* Smart Alerts */}
                    {hasData && campaigns.length > 0 && (() => {
                      const curr = accountOverview?.currency || 'ARS';
                      const cpmThreshold = getCpmThreshold(curr);
                      type AlertItem = { level: 'error' | 'warn'; camp: string; msg: string };
                      const alerts: AlertItem[] = [];
                      campaigns.forEach((c: any) => {
                        const ins = campaignInsights[c.id];
                        if (!ins || parseFloat(ins.spend || '0') <= 0) return;
                        const freq = parseFloat(ins.frequency || 0);
                        const ctr = parseFloat(ins.inline_link_click_ctr || 0);
                        const cpm = parseFloat(ins.cpm || 0);
                        const roas = ins.purchase_roas?.[0]?.value ? parseFloat(ins.purchase_roas[0].value) : 0;
                        const metric = getPrimaryMetric(c.objective || '', ins);
                        if (freq > 3.5) alerts.push({ level: 'error', camp: c.name, msg: `Frecuencia ${fmtNum(freq,1)} — fatiga creativa grave` });
                        else if (freq > 2.5) alerts.push({ level: 'warn', camp: c.name, msg: `Frecuencia ${fmtNum(freq,1)} — monitorear` });
                        if (ctr > 0 && ctr < 0.5) alerts.push({ level: 'error', camp: c.name, msg: `CTR ${fmtNum(ctr,2)}% — creativos no enganchan` });
                        else if (ctr >= 0.5 && ctr < 1) alerts.push({ level: 'warn', camp: c.name, msg: `CTR ${fmtNum(ctr,2)}% — bajo benchmark de 1.5%` });
                        if (cpm > cpmThreshold * 1.5) alerts.push({ level: 'error', camp: c.name, msg: `CPM ${fmtNum(cpm,0)} ${curr} — muy elevado` });
                        if (roas > 0 && roas < 1) alerts.push({ level: 'error', camp: c.name, msg: `ROAS ${fmtNum(roas,2)} — gastando mas de lo que genera` });
                        if (metric.value === '0' && parseFloat(ins.spend||'0') > 500) alerts.push({ level: 'warn', camp: c.name, msg: `Sin resultados con ${fmtNum(ins.spend,0)} ${curr} invertidos` });
                      });
                      if (!alerts.length) return (
                        <div className="rounded-2xl border border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/40 dark:bg-emerald-900/5 px-4 py-3 flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                          <span className="text-[12px] font-semibold text-emerald-700 dark:text-emerald-400">Sin alertas — todo dentro de los parametros normales</span>
                        </div>
                      );
                      const errAlerts = alerts.filter(a => a.level === 'error');
                      const warnAlerts = alerts.filter(a => a.level === 'warn');
                      return (
                        <div className="rounded-2xl border border-amber-100 dark:border-amber-900/30 bg-amber-50/50 dark:bg-amber-900/5 overflow-hidden">
                          <div className="px-4 py-2.5 flex items-center gap-2 border-b border-amber-100 dark:border-amber-800/20">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                            <span className="text-[12px] font-bold text-zinc-800 dark:text-zinc-100">Alertas automaticas</span>
                            {errAlerts.length > 0 && <span className="px-1.5 py-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full">{errAlerts.length} criticas</span>}
                            {warnAlerts.length > 0 && <span className="px-1.5 py-0.5 bg-amber-400 text-white text-[9px] font-bold rounded-full">{warnAlerts.length} advertencias</span>}
                          </div>
                          <div className="px-4 py-3 grid grid-cols-1 md:grid-cols-2 gap-1.5">
                            {alerts.map((a, i) => (
                              <div key={i} className={`flex items-start gap-2 px-2.5 py-1.5 rounded-lg ${a.level === 'error' ? 'bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-800/20' : 'bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/20'}`}>
                                <span className={`flex-shrink-0 mt-1 w-1.5 h-1.5 rounded-full ${a.level === 'error' ? 'bg-red-500' : 'bg-amber-400'}`} />
                                <div className="min-w-0">
                                  <span className="text-[10px] font-bold text-zinc-700 dark:text-zinc-300 truncate block">{a.camp}</span>
                                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400">{a.msg}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Campaign table */}
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm overflow-hidden">
                        {(() => {
                          const campsWithSpend = campaigns.filter((c: any) => parseFloat(campaignInsights[c.id]?.spend || '0') > 0);
                          const acctCurr = accountOverview?.currency || '';
                          const cpmThreshold = getCpmThreshold(acctCurr);
                          return (<>
                        <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-3">
                          <h3 className="text-[13px] font-bold text-zinc-900 dark:text-white">Campañas activas ({campsWithSpend.length})</h3>
                          <div className="flex items-center gap-2 ml-auto">
                            {expandedCampaigns.size > 0 && (
                              <button onClick={() => { setExpandedCampaigns(new Set()); setExpandedAdSets(new Set()); }} className="text-[10px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                                <ChevronRight className="w-3 h-3 rotate-90" />Colapsar todo
                              </button>
                            )}
                            {isAnalyzingAI && <span className="text-[10px] text-violet-500 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Analizando...</span>}
                          </div>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-[11px] min-w-[900px]">
                            <thead>
                              <tr className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 text-[10px] uppercase tracking-wide">
                                <th className="text-left px-3 py-2.5 font-semibold sticky left-0 bg-zinc-50 dark:bg-zinc-800/50 z-10 min-w-[160px]">Campaña</th>
                                <th className="text-center px-2 py-2.5 font-semibold min-w-[52px]">Score</th>
                                <th className="text-left px-2 py-2.5 font-semibold min-w-[80px]">Obj.</th>
                                <th className="text-right px-2 py-2.5 font-semibold">Gasto</th>
                                <th className="text-right px-2 py-2.5 font-semibold">Resultados</th>
                                <th className="text-right px-2 py-2.5 font-semibold">ROAS</th>
                                <th className="text-right px-2 py-2.5 font-semibold">Costo/R</th>
                                <th className="text-right px-2 py-2.5 font-semibold">Valor</th>
                                <th className="text-right px-2 py-2.5 font-semibold">Alcance</th>
                                <th className="text-right px-2 py-2.5 font-semibold">CTR%</th>
                                <th className="text-right px-2 py-2.5 font-semibold">CPM</th>
                                <th className="text-right px-2 py-2.5 font-semibold">Frec.</th>
                                <th className="text-right px-2 py-2.5 font-semibold">CPC</th>
                                <th className="text-center px-2 py-2.5 font-semibold">IA</th>
                              </tr>
                            </thead>
                            <tbody>
                              {campsWithSpend.map((c: any, idx: number) => {
                                const ins = campaignInsights[c.id];
                                const action = adActions[c.id];
                                const metric = ins ? getPrimaryMetric(c.objective || '', ins) : null;
                                const roasVal = ins?.purchase_roas?.[0]?.value ? parseFloat(ins.purchase_roas[0].value) : 0;
                                const ctr = parseFloat(ins?.inline_link_click_ctr || 0);
                                const freq = parseFloat(ins?.frequency || 0);
                                const cpmVal = parseFloat(ins?.cpm || 0);
                                const cpmBad = acctCurr && cpmVal > cpmThreshold;
                                // Valor de resultados (action_values for primary conversion)
                                const actionVals = ins?.action_values || [];
                                const valorRes = getMetaVal(actionVals,
                                  'offsite_conversion.fb_pixel_purchase', 'omni_purchase', 'purchase',
                                  'lead', 'offsite_conversion.fb_pixel_lead',
                                  'onsite_conversion.messaging_conversation_started_7d',
                                ) || getMetaVal(actionVals, ...(actionVals.map((a: any) => a.action_type)));
                                const isExpanded = expandedCampaigns.has(c.id);
                                const campAdSetsList = campaignAdSets[c.id] || [];
                                const visibleAdSets = campAdSetsList.filter((a: any) => {
                                  const ins = adSetInsights[a.id];
                                  return !ins || parseFloat(ins.spend || '0') > 0;
                                });
                                return (
                                  <React.Fragment key={c.id}>
                                  <tr className={`border-t border-zinc-50 dark:border-zinc-800/50 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/30 transition-colors cursor-pointer select-none ${idx % 2 !== 0 ? 'bg-zinc-50/30 dark:bg-zinc-800/10' : ''}`} onClick={() => toggleCampaign(c.id)}>
                                    <td className="px-3 py-2.5 font-medium text-zinc-800 dark:text-zinc-200 sticky left-0 bg-white dark:bg-zinc-900 z-10 max-w-[200px]" title={c.name}>
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <ChevronRight className={`w-3 h-3 flex-shrink-0 text-zinc-400 transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`} />
                                        <span className={`flex-shrink-0 w-1.5 h-1.5 rounded-full ${c.status === 'ACTIVE' ? 'bg-emerald-400' : c.status === 'PAUSED' ? 'bg-amber-400' : 'bg-zinc-300'}`} />
                                        <span className="truncate">{c.name}</span>
                                      </div>
                                    </td>
                                    <td className="px-2 py-2 text-center">
                                      {ins ? (() => {
                                        const score = calcPerfScore(ins, acctCurr);
                                        const ringColor = score >= 70 ? 'border-emerald-400 text-emerald-600' : score >= 45 ? 'border-amber-400 text-amber-600' : 'border-red-400 text-red-500';
                                        return <div className={`inline-flex items-center justify-center w-9 h-9 rounded-full border-2 bg-white dark:bg-zinc-900 ${ringColor}`}><span className="text-[10px] font-bold">{score}</span></div>;
                                      })() : <span className="text-zinc-300 dark:text-zinc-700">—</span>}
                                    </td>
                                    <td className="px-2 py-2 text-zinc-400 dark:text-zinc-500 text-[9px]">{(c.objective || '').replace('OUTCOME_', '')}</td>
                                    <td className="px-2 py-2 text-right min-w-[80px]">
                                      <div className="font-mono font-bold text-zinc-800 dark:text-zinc-200 text-[11px]">{ins ? fmtNum(ins.spend, 0) : '—'}</div>
                                      {ins && c.daily_budget && (() => {
                                        const budget = parseFloat(c.daily_budget);
                                        const spent = parseFloat(ins.spend || 0);
                                        const pct = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;
                                        const barColor = pct > 85 ? 'bg-emerald-400' : pct > 40 ? 'bg-violet-400' : 'bg-zinc-300 dark:bg-zinc-600';
                                        return budget > 0 ? <div className="mt-1 h-1 bg-zinc-100 dark:bg-zinc-700 rounded-full overflow-hidden"><div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} /></div> : null;
                                      })()}
                                    </td>
                                    <td className="px-2 py-2 text-right font-mono font-bold text-zinc-800 dark:text-zinc-200">
                                      {metric ? <span title={metric.label} className="cursor-help">{metric.value}</span> : '—'}
                                    </td>
                                    <td className={`px-2 py-2 text-right font-mono font-bold ${roasVal >= 3 ? 'text-emerald-600' : roasVal >= 1.5 ? 'text-amber-500' : roasVal > 0 ? 'text-red-500' : 'text-zinc-400 dark:text-zinc-600'}`}
                                      title={roasVal === 0 ? 'Sin datos de compras — aplica a campañas de ecommerce' : undefined}>
                                      {roasVal > 0 ? fmtNum(roasVal, 2) : <span className="cursor-help">—</span>}
                                    </td>
                                    <td className="px-2 py-2 text-right font-mono font-bold text-zinc-800 dark:text-zinc-200">{metric?.cost ?? '—'}</td>
                                    <td className="px-2 py-2 text-right font-mono font-bold text-zinc-800 dark:text-zinc-200">
                                      {valorRes && parseFloat(valorRes) > 0 ? fmtNum(valorRes, 0) : '—'}
                                    </td>
                                    <td className="px-2 py-2 text-right font-mono font-bold text-zinc-800 dark:text-zinc-200">
                                      {ins?.reach ? parseInt(ins.reach).toLocaleString('es-AR') : '—'}
                                    </td>
                                    <td className={`px-2 py-2 text-right font-mono font-bold ${ctr >= 1.5 ? 'text-emerald-600' : ctr >= 1 ? 'text-amber-500' : ctr > 0 ? 'text-red-500' : 'text-zinc-800 dark:text-zinc-200'}`}>
                                      {ins ? fmtNum(ctr, 2) : '—'}
                                    </td>
                                    <td className={`px-2 py-2 text-right font-mono font-bold ${cpmBad ? 'text-red-500' : 'text-zinc-800 dark:text-zinc-200'}`}>
                                      {ins ? fmtNum(cpmVal, 0) : '—'}
                                    </td>
                                    <td className={`px-2 py-2 text-right font-mono font-bold ${freq > 3.5 ? 'text-red-500' : freq > 2.5 ? 'text-amber-500' : 'text-zinc-800 dark:text-zinc-200'}`}>
                                      {ins ? fmtNum(freq, 1) : '—'}
                                    </td>
                                    <td className="px-2 py-2 text-right font-mono font-bold text-zinc-800 dark:text-zinc-200">
                                      {ins?.cpc && parseFloat(ins.cpc) > 0 ? fmtNum(ins.cpc, 0) : '—'}
                                    </td>
                                    <td className="px-2 py-2 text-center">
                                      {action ? (
                                        <div className="relative group inline-block">
                                          <span className={`inline-block px-1.5 py-0.5 rounded-full text-[8px] font-bold tracking-wide cursor-help ${ACTION_STYLES[action.action] || ''}`}>
                                            {action.action}
                                          </span>
                                          {action.reason && (
                                            <div className="absolute bottom-full right-0 mb-1.5 w-56 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-[10px] leading-[1.4] rounded-lg px-2.5 py-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
                                              {action.reason}
                                              <div className="absolute top-full right-3 border-4 border-transparent border-t-zinc-900 dark:border-t-zinc-100" />
                                            </div>
                                          )}
                                        </div>
                                      ) : isAnalyzingAI ? (
                                        <Loader2 className="w-2.5 h-2.5 text-violet-400 animate-spin mx-auto" />
                                      ) : (
                                        <span className="text-zinc-300 dark:text-zinc-700">—</span>
                                      )}
                                    </td>
                                  </tr>
                                  {/* ── Ad Sets ── */}
                                  {isExpanded && (loadingAdSets[c.id] ? (
                                    <tr key={`${c.id}-loading`}><td colSpan={14} className="px-8 py-2.5 bg-zinc-50/60 dark:bg-zinc-800/20">
                                      <div className="flex items-center gap-2 text-zinc-400 text-[11px]"><Loader2 className="w-3 h-3 animate-spin" /><span>Cargando conjuntos...</span></div>
                                    </td></tr>
                                  ) : visibleAdSets.length === 0 ? (
                                    <tr key={`${c.id}-empty`}><td colSpan={14} className="px-8 py-2 text-[11px] text-zinc-400 italic bg-zinc-50/30 dark:bg-zinc-800/10">Sin conjuntos con gasto en el período</td></tr>
                                  ) : visibleAdSets.map((adset: any) => {
                                    const adsetFunnel = classifyFunnel(c.objective || '', adset.optimization_goal, adset.name);
                                    const adsetFStyle = FUNNEL_STYLES[adsetFunnel];
                                    const adsetIns = adSetInsights[adset.id];
                                    const adsetMetric = adsetIns ? getPrimaryMetric(c.objective || '', adsetIns) : null;
                                    const adsetRoas = adsetIns?.purchase_roas?.[0]?.value ? parseFloat(adsetIns.purchase_roas[0].value) : 0;
                                    const adsetCtr = parseFloat(adsetIns?.inline_link_click_ctr || 0);
                                    const adsetFreq = parseFloat(adsetIns?.frequency || 0);
                                    const adsetExpanded = expandedAdSets.has(adset.id);
                                    const adsetAdsList = adSetAds[adset.id] || [];
                                    const visibleAds = adsetAdsList.filter((ad: any) => {
                                      const ins = adInsights[ad.id];
                                      return !ins || parseFloat(ins.spend || '0') > 0;
                                    });
                                    return (
                                      <React.Fragment key={adset.id}>
                                        <tr className={`border-t border-zinc-50/80 dark:border-zinc-800/30 hover:brightness-95 cursor-pointer select-none ${adsetFStyle.row}`} onClick={e => { e.stopPropagation(); toggleAdSet(adset.id); }}>
                                          <td className={`px-2 py-1.5 sticky left-0 z-10 ${adsetFStyle.row}`} title={adset.name}>
                                            <div className="flex items-center gap-1.5 pl-7 min-w-0">
                                              <ChevronRight className={`w-2.5 h-2.5 flex-shrink-0 text-zinc-400 transition-transform duration-150 ${adsetExpanded ? 'rotate-90' : ''}`} />
                                              <span className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 truncate">{adset.name}</span>
                                            </div>
                                          </td>
                                          <td className="px-2 py-1.5 text-center">
                                            {adsetIns ? (() => {
                                              const s = calcPerfScore(adsetIns, acctCurr);
                                              const rc = s >= 70 ? 'border-emerald-400 text-emerald-600' : s >= 45 ? 'border-amber-400 text-amber-600' : 'border-red-400 text-red-500';
                                              return <div className={`inline-flex items-center justify-center w-7 h-7 rounded-full border-2 ${adsetFStyle.row} ${rc}`}><span className="text-[9px] font-bold">{s}</span></div>;
                                            })() : null}
                                          </td>
                                          <td className="px-2 py-1.5 text-zinc-400 text-[9px]">{(adset.optimization_goal || '—').replace('OUTCOME_', '')}</td>
                                          <td className="px-2 py-1.5 text-right font-mono text-[10px] font-bold text-zinc-700 dark:text-zinc-300">{adsetIns ? fmtNum(adsetIns.spend, 0) : '—'}</td>
                                          <td className="px-2 py-1.5 text-right font-mono text-[10px] text-zinc-700 dark:text-zinc-300">{adsetMetric?.value ?? '—'}</td>
                                          <td className={`px-2 py-1.5 text-right font-mono text-[10px] font-bold ${adsetRoas >= 3 ? 'text-emerald-600' : adsetRoas >= 1.5 ? 'text-amber-500' : adsetRoas > 0 ? 'text-red-500' : 'text-zinc-400'}`}>{adsetRoas > 0 ? fmtNum(adsetRoas, 2) : '—'}</td>
                                          <td className="px-2 py-1.5 text-right font-mono text-[10px] text-zinc-700">{adsetMetric?.cost ?? '—'}</td>
                                          <td className="px-2 py-1.5 text-right text-zinc-400 text-[10px]">—</td>
                                          <td className="px-2 py-1.5 text-right font-mono text-[10px] text-zinc-700">{adsetIns?.reach ? parseInt(adsetIns.reach).toLocaleString('es-AR') : '—'}</td>
                                          <td className={`px-2 py-1.5 text-right font-mono text-[10px] font-bold ${adsetCtr >= 1.5 ? 'text-emerald-600' : adsetCtr >= 1 ? 'text-amber-500' : adsetCtr > 0 ? 'text-red-500' : 'text-zinc-400'}`}>{adsetIns ? fmtNum(adsetCtr, 2) : '—'}</td>
                                          <td className="px-2 py-1.5 text-right font-mono text-[10px] text-zinc-700">{adsetIns ? fmtNum(adsetIns.cpm, 0) : '—'}</td>
                                          <td className={`px-2 py-1.5 text-right font-mono text-[10px] font-bold ${adsetFreq > 3.5 ? 'text-red-500' : adsetFreq > 2.5 ? 'text-amber-500' : 'text-zinc-700'}`}>{adsetIns ? fmtNum(adsetFreq, 1) : '—'}</td>
                                          <td className="px-2 py-1.5 text-right font-mono text-[10px] text-zinc-700">{adsetIns?.cpc && parseFloat(adsetIns.cpc) > 0 ? fmtNum(adsetIns.cpc, 0) : '—'}</td>
                                          <td className="px-2 py-1.5 text-center">{loadingAds[adset.id] && <Loader2 className="w-2.5 h-2.5 animate-spin text-zinc-400 mx-auto" />}</td>
                                        </tr>
                                        {/* ── Ads ── */}
                                        {adsetExpanded && (loadingAds[adset.id] ? (
                                          <tr key={`${adset.id}-loading`}><td colSpan={14} className="px-12 py-2 bg-zinc-50/40 dark:bg-zinc-800/10">
                                            <div className="flex items-center gap-2 text-zinc-400 text-[11px]"><Loader2 className="w-3 h-3 animate-spin" /><span>Cargando anuncios...</span></div>
                                          </td></tr>
                                        ) : visibleAds.length === 0 ? (
                                          <tr key={`${adset.id}-empty`}><td colSpan={14} className="px-14 py-2 text-[11px] text-zinc-400 italic bg-zinc-50/20">Sin anuncios con gasto en el período</td></tr>
                                        ) : visibleAds.map((ad: any) => {
                                          const adIns = adInsights[ad.id];
                                          const adFunnelInfo = getFunnelInfo(c.objective || '', adset.optimization_goal, adset.name);
                                          const adFunnel = adFunnelInfo.stage;
                                          const adFStyle = FUNNEL_STYLES[adFunnel];
                                          const adCtr = parseFloat(adIns?.inline_link_click_ctr || 0);
                                          const adFreq = parseFloat(adIns?.frequency || 0);
                                          const adRoas = adIns?.purchase_roas?.[0]?.value ? parseFloat(adIns.purchase_roas[0].value) : 0;
                                          const adIssues = funnelBadPerf(adFunnel, adIns);
                                          const thumb = ad.creative?.thumbnail_url || ad.creative?.image_url;
                                          return (
                                            <tr key={ad.id} className={`border-t border-zinc-50/40 dark:border-zinc-800/20 ${adIssues.length > 0 ? 'bg-red-50/10 dark:bg-red-900/5' : adFStyle.row}`}>
                                              <td className={`px-2 py-1.5 sticky left-0 z-10 max-w-[220px] overflow-hidden ${adIssues.length > 0 ? 'bg-red-50/10 dark:bg-red-900/5' : adFStyle.row}`}>
                                                <div className="flex items-center gap-2 pl-14 min-w-0 overflow-hidden">
                                                  {thumb ? <img src={thumb} alt="" className="w-8 h-8 rounded-md object-cover flex-shrink-0 border border-zinc-200 dark:border-zinc-700" /> : <div className={`w-8 h-8 rounded-md flex-shrink-0 flex items-center justify-center ${adFStyle.row} border border-current/10`}><span className={`text-[7px] font-bold ${adFStyle.badge.split(' ')[1]}`}>{adFunnel[0]}</span></div>}
                                                  <div className="min-w-0">
                                                    <div className="flex items-center gap-1 mb-0.5">
                                                      <FunnelBadge stage={adFunnel} info={adFunnelInfo} ins={adIns} currency={acctCurr} size="xs" />
                                                      <span className={`w-1 h-1 rounded-full flex-shrink-0 ${ad.status === 'ACTIVE' ? 'bg-emerald-400' : 'bg-zinc-300'}`} />
                                                    </div>
                                                    <p className="text-[10px] font-medium text-zinc-700 dark:text-zinc-300 truncate">{ad.name}</p>
                                                    {adIssues.length > 0 && <p className="text-[9px] text-red-500 font-medium truncate">⚠ {adIssues.join(' · ')}</p>}
                                                  </div>
                                                </div>
                                              </td>
                                              <td className="px-2 py-1.5 text-center">
                                                {adIns ? (() => {
                                                  const s = calcPerfScore(adIns, acctCurr);
                                                  const rc = s >= 70 ? 'border-emerald-400 text-emerald-600' : s >= 45 ? 'border-amber-400 text-amber-600' : 'border-red-400 text-red-500';
                                                  return <div className={`inline-flex items-center justify-center w-6 h-6 rounded-full border-2 bg-white/80 dark:bg-zinc-900/80 ${rc}`}><span className="text-[8px] font-bold">{s}</span></div>;
                                                })() : null}
                                              </td>
                                              <td className="px-2 py-1.5 text-zinc-400 text-[9px]">{ad.status === 'ACTIVE' ? '●' : '○'}</td>
                                              <td className="px-2 py-1.5 text-right font-mono text-[10px] font-bold text-zinc-700">{adIns ? fmtNum(adIns.spend, 0) : '—'}</td>
                                              <td className="px-2 py-1.5 text-right font-mono text-[10px] text-zinc-700">{adIns ? getPrimaryMetric(c.objective || '', adIns).value : '—'}</td>
                                              <td className={`px-2 py-1.5 text-right font-mono text-[10px] font-bold ${adRoas >= 3 ? 'text-emerald-600' : adRoas >= 1.5 ? 'text-amber-500' : adRoas > 0 ? 'text-red-500' : 'text-zinc-400'}`}>{adRoas > 0 ? fmtNum(adRoas, 2) : '—'}</td>
                                              <td className="px-2 py-1.5 text-right font-mono text-[10px] text-zinc-600">{adIns ? getPrimaryMetric(c.objective || '', adIns).cost : '—'}</td>
                                              <td className="px-2 py-1.5 text-right text-zinc-400 text-[10px]">—</td>
                                              <td className="px-2 py-1.5 text-right font-mono text-[10px] text-zinc-700">{adIns?.reach ? parseInt(adIns.reach).toLocaleString('es-AR') : '—'}</td>
                                              <td className={`px-2 py-1.5 text-right font-mono text-[10px] font-bold ${adCtr >= 1.5 ? 'text-emerald-600' : adCtr >= 1 ? 'text-amber-500' : adCtr > 0 ? 'text-red-500' : 'text-zinc-400'}`}>{adIns ? fmtNum(adCtr, 2) : '—'}</td>
                                              <td className="px-2 py-1.5 text-right font-mono text-[10px] text-zinc-700">{adIns ? fmtNum(adIns.cpm, 0) : '—'}</td>
                                              <td className={`px-2 py-1.5 text-right font-mono text-[10px] font-bold ${adFreq > 3.5 ? 'text-red-500' : adFreq > 2.5 ? 'text-amber-500' : 'text-zinc-700'}`}>{adIns ? fmtNum(adFreq, 1) : '—'}</td>
                                              <td className="px-2 py-1.5 text-right font-mono text-[10px] text-zinc-700">{adIns?.cpc && parseFloat(adIns.cpc) > 0 ? fmtNum(adIns.cpc, 0) : '—'}</td>
                                              <td className="px-2 py-1.5" />
                                            </tr>
                                          );
                                        }))}
                                      </React.Fragment>
                                    );
                                  }))}
                                  </React.Fragment>
                                );
                              })}
                              {/* Empty state */}
                              {campsWithSpend.length === 0 && (
                                <tr><td colSpan={14} className="px-4 py-10 text-center">
                                  <p className="text-[12px] font-semibold text-zinc-500 dark:text-zinc-400">Sin campañas con actividad en este período</p>
                                  <p className="text-[11px] text-zinc-400 dark:text-zinc-600 mt-1">Probá seleccionar un período más amplio (ej: últimos 7 días)</p>
                                </td></tr>
                              )}
                              {/* Totals row */}
                              {campsWithSpend.length > 0 && (() => {
                                const totalSpendSum = campsWithSpend.reduce((acc: number, c: any) => acc + parseFloat(campaignInsights[c.id]?.spend || 0), 0);
                                const totalReachSum = campsWithSpend.reduce((acc: number, c: any) => acc + parseInt(campaignInsights[c.id]?.reach || 0), 0);
                                const totalImpressions = campsWithSpend.reduce((acc: number, c: any) => acc + parseInt(campaignInsights[c.id]?.impressions || 0), 0);
                                const weightedCtr = totalImpressions > 0
                                  ? campsWithSpend.reduce((acc: number, c: any) => acc + parseFloat(campaignInsights[c.id]?.inline_link_click_ctr || 0) * parseInt(campaignInsights[c.id]?.impressions || 0), 0) / totalImpressions
                                  : 0;
                                const roasCamps = campsWithSpend.filter((c: any) => campaignInsights[c.id]?.purchase_roas?.[0]?.value);
                                const avgRoas = roasCamps.length > 0 ? roasCamps.reduce((acc: number, c: any) => acc + parseFloat(campaignInsights[c.id].purchase_roas[0].value), 0) / roasCamps.length : 0;
                                return (
                                  <tr className="border-t-2 border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/40">
                                    <td className="px-3 py-2.5 sticky left-0 bg-zinc-50 dark:bg-zinc-800/40 z-10">
                                      <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">TOTAL {campsWithSpend.length} campanas</span>
                                    </td>
                                    <td />
                                    <td className="px-2 py-2.5 text-center text-zinc-300">—</td>
                                    <td className="px-2 py-2.5 text-right">
                                      <div className="font-mono font-bold text-[12px] text-zinc-900 dark:text-white">{fmtNum(totalSpendSum, 0)}</div>
                                    </td>
                                    <td className="px-2 py-2.5 text-right text-zinc-300 dark:text-zinc-600">—</td>
                                    <td className={`px-2 py-2.5 text-right font-mono font-bold text-[11px] ${avgRoas >= 3 ? 'text-emerald-600' : avgRoas >= 1.5 ? 'text-amber-500' : avgRoas > 0 ? 'text-red-500' : 'text-zinc-400'}`}>{avgRoas > 0 ? fmtNum(avgRoas, 2) : '—'}</td>
                                    <td className="px-2 py-2.5 text-right text-zinc-300">—</td>
                                    <td className="px-2 py-2.5 text-right text-zinc-300">—</td>
                                    <td className="px-2 py-2.5 text-right font-mono font-bold text-[11px] text-zinc-700 dark:text-zinc-300">{totalReachSum > 0 ? totalReachSum.toLocaleString('es-AR') : '—'}</td>
                                    <td className={`px-2 py-2.5 text-right font-mono font-bold text-[11px] ${weightedCtr >= 1.5 ? 'text-emerald-600' : weightedCtr >= 1 ? 'text-amber-500' : weightedCtr > 0 ? 'text-red-500' : 'text-zinc-400'}`}>{weightedCtr > 0 ? fmtNum(weightedCtr, 2) : '—'}</td>
                                    <td className="px-2 py-2.5 text-right text-zinc-300">—</td>
                                    <td className="px-2 py-2.5 text-right text-zinc-300">—</td>
                                    <td className="px-2 py-2.5 text-right text-zinc-300">—</td>
                                    <td />
                                  </tr>
                                );
                              })()}
                            </tbody>
                          </table>
                        </div>
                        </>);})()}
                      </div>


                    {/* Benchmarks & Legend */}
                    <div className="flex items-center gap-3 text-[10px] text-zinc-400 dark:text-zinc-600 flex-wrap pb-4">
                      <span className="font-semibold text-zinc-500 dark:text-zinc-500">Benchmarks:</span>
                      <span><span className="text-emerald-500 font-bold">●</span> CTR ≥ 1.5%</span>
                      <span><span className="text-emerald-500 font-bold">●</span> Frec. ≤ 2.5</span>
                      <span><span className="text-emerald-500 font-bold">●</span> CPM ≤ {accountOverview?.currency === 'ARS' ? '10k ARS' : '$15 USD'}</span>
                      <span className="text-zinc-200 dark:text-zinc-700">|</span>
                      <span className="font-semibold text-zinc-500 dark:text-zinc-500">Score:</span>
                      <span><span className="font-bold text-emerald-600">70+</span> Bueno</span>
                      <span><span className="font-bold text-amber-500">45-70</span> Regular</span>
                      <span><span className="font-bold text-red-500">0-45</span> Critico</span>
                      <span className="text-zinc-200 dark:text-zinc-700">|</span>
                      <span className="text-blue-500 font-bold">TOFU</span> <span className="text-amber-500 font-bold">MOFU</span> <span className="text-emerald-500 font-bold">BOFU</span>
                      <button onClick={analyzeAll} disabled={isAnalyzingAll || isAnalyzingAI || !hasData} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500 text-white text-[11px] font-bold disabled:opacity-40 hover:bg-violet-600 transition-colors shadow-sm">
                        {isAnalyzingAll ? <Loader2 className="w-3 h-3 animate-spin" /> : <BrainCircuit className="w-3 h-3" />}
                        {isAnalyzingAll ? `${analyzeAllProgress || 'Analizando...'}` : 'Analizar Todo'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── CREATIVOS + ANALISIS (merged) ─────────────────────── */}
            {activeTab === 'CREATIVOS' && (
              <div className="p-4 space-y-4 overflow-y-auto pb-28">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-[15px] font-bold text-zinc-900 dark:text-white">Análisis Creativo</h2>
                    <p className="text-[11px] text-zinc-500 mt-0.5">Diagnóstico automático + análisis IA por rol en el funnel.</p>
                  </div>
                  <button onClick={analyzeCreatives} disabled={isAnalyzingCreatives || Object.keys(campaignAdSets).length === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-violet-500 hover:bg-violet-600 disabled:opacity-50 text-white text-[12px] font-semibold rounded-xl transition-colors shadow-sm">
                    {isAnalyzingCreatives ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /><span>Analizando...</span></> : <><BrainCircuit className="w-3.5 h-3.5" /><span>Analizar con IA</span></>}
                  </button>
                </div>

                {/* ── AUTO-DETECTION PANEL ── */}
                {adPerformanceData && adPerformanceData.items.length > 0 && (
                  <div className="space-y-3">
                    {/* Funnel Distribution */}
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 p-4 shadow-sm">
                      <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-3">Distribución del presupuesto por funnel</p>
                      <div className="flex rounded-lg overflow-hidden h-2.5 mb-3 bg-zinc-100 dark:bg-zinc-800">
                        {(['TOFU', 'MOFU', 'BOFU'] as const).map(stage => {
                          const pct = adPerformanceData.totalAdSpend > 0 ? (adPerformanceData.funnelSpend[stage] / adPerformanceData.totalAdSpend) * 100 : 0;
                          const colors = { TOFU: 'bg-blue-400', MOFU: 'bg-amber-400', BOFU: 'bg-emerald-500' };
                          return <div key={stage} className={`${colors[stage]}`} style={{ width: `${pct}%` }} />;
                        })}
                      </div>
                      <div className="flex gap-5">
                        {(['TOFU', 'MOFU', 'BOFU'] as const).map(stage => {
                          const spend = adPerformanceData.funnelSpend[stage];
                          const pct = adPerformanceData.totalAdSpend > 0 ? (spend / adPerformanceData.totalAdSpend) * 100 : 0;
                          const { badge } = FUNNEL_STYLES[stage];
                          return (
                            <div key={stage} className="flex items-center gap-1.5">
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${badge}`}>{stage}</span>
                              <span className="text-[13px] font-bold text-zinc-700 dark:text-zinc-300">{pct.toFixed(0)}%</span>
                            </div>
                          );
                        })}
                      </div>
                      {adPerformanceData.totalAdSpend > 0 && adPerformanceData.funnelSpend.BOFU / adPerformanceData.totalAdSpend > 0.6 && (
                        <div className="mt-2 flex items-center gap-1.5 text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                          <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                          <span>Sobre-indexado en BOFU — necesitás más TOFU para alimentar el funnel.</span>
                        </div>
                      )}
                      {adPerformanceData.totalAdSpend > 0 && adPerformanceData.funnelSpend.TOFU / adPerformanceData.totalAdSpend > 0.5 && (
                        <div className="mt-2 flex items-center gap-1.5 text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                          <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                          <span>Mayoría del presupuesto en TOFU — revisá si hay suficientes anuncios de cierre.</span>
                        </div>
                      )}
                    </div>

                    {/* Ad classification */}
                    {adPerformanceData.items.some(i => i.classification !== 'RELIABLE') && (
                      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 p-4 shadow-sm">
                        <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-3">Clasificación de anuncios</p>
                        <div className="space-y-2">
                          {(['SCALER', 'RELIABLE', 'FAKE WIN', 'LIABILITY'] as const).map(cls => {
                            const items = adPerformanceData.items.filter(i => i.classification === cls);
                            if (items.length === 0) return null;
                            const clsStyles: Record<string, { bg: string; badge: string; icon: string }> = {
                              SCALER:     { bg: 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300', icon: '🟢' },
                              RELIABLE:   { bg: 'bg-zinc-50 dark:bg-zinc-800/30 border-zinc-200 dark:border-zinc-700', badge: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300', icon: '🔵' },
                              'FAKE WIN': { bg: 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300', icon: '🟡' },
                              LIABILITY:  { bg: 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800', badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300', icon: '🔴' },
                            };
                            const s = clsStyles[cls];
                            return (
                              <div key={cls} className={`rounded-xl border px-3 py-2.5 ${s.bg}`}>
                                <div className="flex items-center gap-2 mb-1.5">
                                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${s.badge}`}>{s.icon} {cls}</span>
                                  <span className="text-[10px] text-zinc-400">{items.length} anuncio{items.length > 1 ? 's' : ''}</span>
                                </div>
                                <div className="space-y-1.5">
                                  {items.map(item => (
                                    <div key={item.ad.id} className="flex items-start justify-between gap-3">
                                      <div className="flex-1 min-w-0">
                                        <p className="text-[11px] font-semibold text-zinc-800 dark:text-zinc-100 truncate">{item.ad.name}</p>
                                        {item.classReason && <p className="text-[9px] text-zinc-500 mt-0.5">{item.classReason}</p>}
                                      </div>
                                      <div className="flex items-center gap-2 text-[9px] text-zinc-400 flex-shrink-0 font-mono">
                                        {item.roas > 0 && <span className="font-bold text-zinc-600 dark:text-zinc-300">ROAS {item.roas.toFixed(1)}x</span>}
                                        <span>{item.spendPct.toFixed(0)}% pres.</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Fatigue alerts */}
                    {adPerformanceData.items.some(i => i.fatigueLevel !== 'ok') && (
                      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 p-4 shadow-sm">
                        <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-3">Señales de fatiga creativa</p>
                        <div className="space-y-1.5">
                          {adPerformanceData.items.filter(i => i.fatigueLevel !== 'ok').sort((a, b) => b.freq - a.freq).map(item => (
                            <div key={item.ad.id} className={`flex items-center justify-between rounded-lg px-3 py-2 border ${item.fatigueLevel === 'danger' ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800' : 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800'}`}>
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-[12px]">{item.fatigueLevel === 'danger' ? '🔴' : '🟡'}</span>
                                <span className="text-[11px] font-medium text-zinc-800 dark:text-zinc-200 truncate">{item.ad.name}</span>
                              </div>
                              <div className="flex items-center gap-3 flex-shrink-0 text-[10px]">
                                <span className={`font-bold font-mono ${item.fatigueLevel === 'danger' ? 'text-red-600' : 'text-amber-600'}`}>Freq {item.freq.toFixed(2)}</span>
                                <span className="text-zinc-400 uppercase tracking-wide text-[9px]">{item.fatigueLevel === 'danger' ? 'Fatiga crítica' : 'Atención'}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-2 flex-wrap">
                  {(['TOFU', 'MOFU', 'BOFU'] as const).map(stage => {
                    const s = FUNNEL_STYLES[stage];
                    return (
                      <div key={stage} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${s.row}`}>
                        <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                        <span className={`text-[10px] font-bold ${s.badge.split(' ')[1]}`}>{stage}</span>
                        <span className="text-[10px] text-zinc-500">{s.desc}</span>
                      </div>
                    );
                  })}
                  <span className="text-[10px] text-zinc-400 ml-2">⚠ = bajo rendimiento para su rol</span>
                </div>
                {Object.keys(campaignAdSets).length > 0 ? (
                  <div className="space-y-3">
                    {Object.entries(campaignAdSets).map(([campId, adsets]) => {
                      const camp = campaigns.find((c: any) => c.id === campId);
                      const campFunnel = classifyFunnel(camp?.objective || '', undefined, camp?.name);
                      const campFStyle = FUNNEL_STYLES[campFunnel];
                      return (
                        <div key={campId} className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 overflow-hidden shadow-sm">
                          <div className={`px-4 py-2.5 flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-800 ${campFStyle.row}`}>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${campFStyle.badge}`}>{campFunnel}</span>
                            <span className="text-[12px] font-bold text-zinc-800 dark:text-zinc-100 truncate">{camp?.name || campId}</span>
                          </div>
                          {(adsets as any[]).map((adset: any) => {
                            const adsetFunnel = classifyFunnel(camp?.objective || '', adset.optimization_goal, adset.name);
                            const adsetFStyle = FUNNEL_STYLES[adsetFunnel];
                            const adsList = adSetAds[adset.id] || [];
                            const adsetIns = adSetInsights[adset.id];
                            return (
                              <div key={adset.id} className="border-b border-zinc-50 dark:border-zinc-800/50 last:border-0">
                                <div className={`px-4 py-2 flex items-center gap-2 ${adsetFStyle.row}`}>
                                  <span className={`text-[8px] font-bold px-1 py-0.5 rounded ${adsetFStyle.badge}`}>{adsetFunnel}</span>
                                  <span className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 truncate flex-1">{adset.name}</span>
                                  {adsetIns && <span className="text-[9px] text-zinc-400 flex-shrink-0">CTR: {fmtNum(adsetIns.inline_link_click_ctr, 2)}% · Frec: {fmtNum(adsetIns.frequency, 1)} · Gasto: {fmtNum(adsetIns.spend, 0)}</span>}
                                </div>
                                {adsList.length === 0 ? (
                                  <div className="px-8 py-2 text-[10px] text-zinc-400 italic">
                                    {loadingAds[adset.id] ? <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin inline" /> Cargando...</span> : 'Expandí este conjunto en Reportes para ver los anuncios'}
                                  </div>
                                ) : (
                                  <div className="px-4 pb-3 pt-1 grid grid-cols-1 gap-2">
                                    {[...adsList].sort((a: any, b: any) => parseFloat(adInsights[b.id]?.inline_link_click_ctr || 0) - parseFloat(adInsights[a.id]?.inline_link_click_ctr || 0)).map((ad: any, adRank: number) => {
                                      const adIns = adInsights[ad.id];
                                      const adFunnelInfo2 = getFunnelInfo(camp?.objective || '', adset.optimization_goal, adset.name);
                                      const adFunnel = adFunnelInfo2.stage;
                                      const adFStyle = FUNNEL_STYLES[adFunnel];
                                      const adCtr = parseFloat(adIns?.inline_link_click_ctr || 0);
                                      const adFreq = parseFloat(adIns?.frequency || 0);
                                      const adRoas = adIns?.purchase_roas?.[0]?.value ? parseFloat(adIns.purchase_roas[0].value) : 0;
                                      const adSpend = parseFloat(adIns?.spend || 0);
                                      const adScore = calcPerfScore(adIns, accountOverview?.currency || 'ARS');
                                      const issues = funnelBadPerf(adFunnel, adIns);
                                      const thumb = ad.creative?.thumbnail_url || ad.creative?.image_url;
                                      const hasProblem = issues.length > 0;
                                      const isWinner = adRank === 0 && adSpend > 0 && adCtr > 0;
                                      return (
                                        <div key={ad.id} className={`rounded-xl border flex items-start gap-3 p-3 ${hasProblem ? 'border-red-200 dark:border-red-800/40 bg-red-50/40 dark:bg-red-900/5' : isWinner ? 'border-emerald-200 dark:border-emerald-800/40 bg-emerald-50/30 dark:bg-emerald-900/5' : 'border-zinc-100 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-800/20'}`}>
                                          <div className="relative flex-shrink-0">
                                            {thumb ? <img src={thumb} alt="" className="w-14 h-14 rounded-xl object-cover border border-zinc-200 dark:border-zinc-700" /> : <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${adFStyle.row} border`}><span className={`text-[10px] font-bold ${adFStyle.badge.split(' ')[1]}`}>{adFunnel}</span></div>}
                                            {isWinner && <span className="absolute -top-1 -left-1 text-[12px]">🏆</span>}
                                            <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 flex items-center justify-center text-[7px] font-bold bg-white dark:bg-zinc-900 ${adScore >= 70 ? 'border-emerald-400 text-emerald-600' : adScore >= 45 ? 'border-amber-400 text-amber-600' : 'border-red-400 text-red-500'}`}>{adScore}</div>
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 mb-0.5 overflow-hidden">
                                              <FunnelBadge stage={adFunnel} info={adFunnelInfo2} ins={adIns} currency={accountOverview?.currency || 'ARS'} size="xs" />
                                              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${ad.status === 'ACTIVE' ? 'bg-emerald-400' : 'bg-zinc-300'}`} />
                                              <p className="text-[11px] font-semibold text-zinc-800 dark:text-zinc-100 truncate min-w-0">{ad.name}</p>
                                            </div>
                                            {hasProblem && <p className="text-[9px] text-red-500 font-semibold mb-0.5">⚠ {issues.join(' · ')}</p>}
                                            <div className="flex items-center gap-2.5 flex-wrap text-[9px] text-zinc-500">
                                              {adSpend > 0 && <span>Gasto: <strong className="text-zinc-700 dark:text-zinc-300">{fmtNum(adSpend, 0)}</strong></span>}
                                              {adCtr > 0 && <span className={adCtr >= 1.5 ? 'text-emerald-600' : adCtr >= 1 ? 'text-amber-500' : 'text-red-500'}>CTR: <strong>{fmtNum(adCtr, 2)}%</strong></span>}
                                              {adFreq > 0 && <span className={adFreq > 3.5 ? 'text-red-500' : ''}>Frec: <strong>{fmtNum(adFreq, 2)}</strong></span>}
                                              {adIns?.reach && <span>Alcance: <strong>{parseInt(adIns.reach).toLocaleString('es-AR')}</strong></span>}
                                              {adRoas > 0 && <span className={adRoas >= 2 ? 'text-emerald-600' : 'text-red-500'}>ROAS: <strong>{fmtNum(adRoas, 2)}</strong></span>}
                                              {!adIns && <span className="italic text-zinc-400">Sin métricas — expandí en Reportes</span>}
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center">
                      <Palette className="w-7 h-7 text-violet-400" />
                    </div>
                    <div>
                      <p className="text-[14px] font-semibold text-zinc-700 dark:text-zinc-300">Sin creativos cargados</p>
                      <p className="text-[12px] text-zinc-400 mt-1">Andá a Reportes → hacé click en una campaña → luego en un conjunto para cargar los anuncios</p>
                    </div>
                  </div>
                )}
                {(creativeAnalysisText || isAnalyzingCreatives) && (
                  <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm px-5 py-4">
                    <h3 className="text-[13px] font-bold text-zinc-900 dark:text-white mb-3 flex items-center gap-2"><BrainCircuit className="w-4 h-4 text-violet-500" />Análisis IA de Creativos</h3>
                    {isAnalyzingCreatives && !creativeAnalysisText ? (
                      <div className="flex items-center gap-3 py-8 justify-center"><Loader2 className="w-6 h-6 text-violet-500 animate-spin" /><span className="text-[13px] text-zinc-500">Analizando rol de cada creativo en el funnel...</span></div>
                    ) : (
                      <div className="text-[12px] leading-relaxed">{renderMarkdown(creativeAnalysisText)}</div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── ANÁLISIS ─────────────────────────────────────────── */}
            {activeTab === 'ANALISIS' && (
              <div className="pb-28">
                {isAnalyzingAI && !analysisText && (
                  <div className="flex flex-col items-center justify-center py-24 gap-4">
                    <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
                    <p className="text-[13px] text-zinc-500">{analysisProgress || 'Generando diagnóstico...'}</p>
                  </div>
                )}
                {!isAnalyzingAI && !hasAnalysis && (
                  <div className="flex flex-col items-center justify-center py-24 gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center">
                      <BarChart2 className="w-7 h-7 text-violet-400" />
                    </div>
                    <p className="text-[14px] font-semibold text-zinc-500 dark:text-zinc-400">
                      {analysisError ? analysisError : 'El análisis aparece acá después de analizar'}
                    </p>
                  </div>
                )}
                {hasAnalysis && (
                  <div>
                    {campaigns.length > 0 && (
                      <div className="mb-6 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 overflow-hidden shadow-sm">
                        <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
                          <h3 className="text-[13px] font-bold text-zinc-900 dark:text-white">Acciones IA por campaña</h3>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-[11px]">
                            <thead>
                              <tr className="bg-zinc-50 dark:bg-zinc-800/50">
                                <th className="text-left px-3 py-2 font-semibold text-zinc-500">Nombre</th>
                                <th className="text-center px-3 py-2 font-semibold text-zinc-500">Score</th>
                                <th className="text-right px-3 py-2 font-semibold text-zinc-500">Gasto</th>
                                <th className="text-right px-3 py-2 font-semibold text-zinc-500">ROAS</th>
                                <th className="text-right px-3 py-2 font-semibold text-zinc-500">Resultado</th>
                                <th className="text-right px-3 py-2 font-semibold text-zinc-500">Costo/R</th>
                                <th className="text-right px-3 py-2 font-semibold text-zinc-500">CTR%</th>
                                <th className="text-center px-3 py-2 font-semibold text-zinc-500">Acción</th>
                              </tr>
                            </thead>
                            <tbody>
                              {campaigns.filter((c: any) => parseFloat(campaignInsights[c.id]?.spend || 0) > 0).map((c: any, idx: number) => {
                                const ins = campaignInsights[c.id];
                                const action = adActions[c.id];
                                const metric = ins ? getPrimaryMetric(c.objective || '', ins) : null;
                                const score = ins ? calcPerfScore(ins, accountOverview?.currency || 'ARS') : 0;
                                return (
                                  <tr key={c.id} className={`border-t border-zinc-50 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors ${idx % 2 !== 0 ? 'bg-zinc-50/50 dark:bg-zinc-800/20' : ''}`}>
                                    <td className="px-3 py-2 font-medium text-zinc-800 dark:text-zinc-200 max-w-[220px] truncate" title={c.name}>{c.name}</td>
                                    <td className="px-3 py-2 text-center">
                                      {ins ? <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full border-2 text-[10px] font-bold ${score >= 70 ? 'border-emerald-400 text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20' : score >= 45 ? 'border-amber-400 text-amber-600 bg-amber-50 dark:bg-amber-900/20' : 'border-red-400 text-red-500 bg-red-50 dark:bg-red-900/20'}`}>{score}</div> : <span className="text-zinc-300">—</span>}
                                    </td>
                                    <td className="px-3 py-2 text-right font-mono text-zinc-700 dark:text-zinc-300">{ins ? fmtNum(ins.spend, 0) : '—'}</td>
                                    <td className="px-3 py-2 text-right font-mono text-zinc-700 dark:text-zinc-300">{ins?.purchase_roas?.[0]?.value ? fmtNum(ins.purchase_roas[0].value, 2) : '—'}</td>
                                    <td className="px-3 py-2 text-right font-mono text-zinc-700 dark:text-zinc-300">
                                      {metric ? <span title={metric.label} className="cursor-help">{metric.value}</span> : '—'}
                                    </td>
                                    <td className="px-3 py-2 text-right font-mono text-zinc-600 dark:text-zinc-400">{metric?.cost ?? '—'}</td>
                                    <td className="px-3 py-2 text-right font-mono text-zinc-700 dark:text-zinc-300">{ins ? fmtNum(ins.inline_link_click_ctr, 2) : '—'}</td>
                                    <td className="px-3 py-2 text-center">
                                      {action ? (
                                        <div className="relative group inline-block">
                                          <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wide cursor-help ${ACTION_STYLES[action.action] || ''}`}>
                                            {action.action}
                                          </span>
                                          {action.reason && (
                                            <div className="absolute bottom-full right-0 mb-1.5 w-64 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-[11px] leading-[1.5] rounded-lg px-3 py-2.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
                                              <p className="font-semibold mb-1 text-[9px] uppercase tracking-wide opacity-60">{action.action}</p>
                                              {action.reason}
                                              <div className="absolute top-full right-4 border-4 border-transparent border-t-zinc-900 dark:border-t-zinc-100" />
                                            </div>
                                          )}
                                        </div>
                                      ) : <span className="text-zinc-300 dark:text-zinc-700">—</span>}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm px-5 py-4">
                      {renderMarkdown(analysisText)}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── REPORTE CLIENTE ─────────────────────────────────────── */}
            {activeTab === 'CLIENTE' && (
              <div className="p-4 space-y-4 overflow-y-auto pb-28">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-[15px] font-bold text-zinc-900 dark:text-white">Reporte para Cliente</h2>
                    <p className="text-[11px] text-zinc-500 mt-0.5">Análisis objetivo del período, en lenguaje simple. Listo para enviar.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {clientReportType === 'general' && (
                      <button onClick={handleClientReportPDF} disabled={!clientReportText && !hasData}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 text-[11px] font-medium hover:bg-zinc-50 dark:hover:bg-white/[0.04] transition-all disabled:opacity-40">
                        <FileDown className="w-3.5 h-3.5" />Exportar PDF
                      </button>
                    )}
                    <button onClick={async () => {
                        if (clientReportType === 'complete') {
                          await handleDemographicReportPDF();
                          return;
                        }
                        setIsGeneratingClientReport(true);
                        setClientReportText('');
                        try {
                          const range: TimeRange = dateMode === 'custom' ? { since, until } : presetToRange(preset);
                          const period = `${range.since} al ${range.until}`;
                          const currency = accountOverview?.currency || 'ARS';
                          const activeChannels = ytChannels.filter(c => c.active).map(c => c.name);
                          const prevRange = getPrevPeriod(range.since, range.until);
                          const prevPeriod = `${prevRange.since} al ${prevRange.until}`;
                          let prevInsights: any = null;
                          try {
                            prevInsights = await metaAds.getInsights(selectedAccountId, INSIGHT_FIELDS, undefined, prevRange);
                          } catch (e) { /* comparison optional */ }
                          const resp = await ai.chat([
                            { role: 'system', content: buildMetaAnalystSystem(activeChannels) },
                            { role: 'user', content: buildClientReportPrompt(campaigns, campaignInsights, accountOverview?.name || selectedAccountId, period, currency, accountInsights, prevInsights || undefined, prevInsights ? prevPeriod : undefined) }
                          ]);
                          setClientReportText(resp);
                        } catch (e: any) {
                          setClientReportText('Error: ' + e.message);
                        } finally { setIsGeneratingClientReport(false); }
                      }} disabled={isGeneratingClientReport || !hasData}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-violet-500 hover:bg-violet-600 text-white text-[11px] font-semibold transition-all disabled:opacity-40">
                      {isGeneratingClientReport
                        ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /><span>Generando...</span></>
                        : clientReportType === 'complete'
                          ? <><FileDown className="w-3.5 h-3.5" /><span>Generar PDF Completo</span></>
                          : <><BrainCircuit className="w-3.5 h-3.5" /><span>Generar Reporte</span></>}
                    </button>
                  </div>
                </div>

                {/* Report type selector */}
                <div className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl px-3 py-2.5 border border-zinc-100 dark:border-zinc-700/50">
                  <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mr-1">Tipo:</span>
                  {([['general', '📊 Reporte General'], ['complete', '📋 Reporte Completo']] as const).map(([type, label]) => (
                    <button key={type} onClick={() => setClientReportType(type)}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${clientReportType === type ? 'bg-[#0d1b2a] text-white shadow-sm' : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700/50'}`}>
                      {label}
                    </button>
                  ))}
                </div>

                {/* KPI Summary — 8 KPIs adaptive by objective */}
                {accountInsights && (() => {
                  const cur = accountOverview?.currency || '';
                  const objType = detectDominantObjective(campaigns, campaignInsights);
                  const spend = `${cur} ${fmtNum(accountInsights.spend, 0)}`;
                  const reach = parseInt(accountInsights.reach || '0').toLocaleString('es-AR');
                  const clicks = accountInsights.inline_link_clicks ? parseInt(accountInsights.inline_link_clicks).toLocaleString('es-AR') : '—';
                  const ctr = fmtNum(accountInsights.inline_link_click_ctr, 2) + '%';
                  const cpm = `${cur} ${fmtNum(accountInsights.cpm, 0)}`;
                  const freq = fmtNum(accountInsights.frequency, 2);
                  const impr = accountInsights.impressions ? parseInt(accountInsights.impressions).toLocaleString('es-AR') : '—';
                  const cpc = `${cur} ${fmtNum(accountInsights.cpc, 2)}`;

                  const purchasesN = getMetaVal(accountInsights.actions || [], 'offsite_conversion.fb_pixel_purchase', 'omni_purchase', 'purchase') || '0';
                  const purchaseValN = getMetaVal(accountInsights.action_values || [], 'offsite_conversion.fb_pixel_purchase', 'omni_purchase', 'purchase') || '0';
                  const roasRaw = accountInsights.purchase_roas?.[0]?.value ? parseFloat(accountInsights.purchase_roas[0].value) : 0;
                  const roas = roasRaw > 0 ? fmtNum(roasRaw, 1) + 'x' : '—';
                  const cpa = parseFloat(purchasesN) > 0 ? `${cur} ${fmtNum(parseFloat(accountInsights.spend) / parseFloat(purchasesN), 2)}` : '—';
                  const purchaseValFmt = parseFloat(purchaseValN) > 0 ? `${cur} ${fmtNum(parseFloat(purchaseValN), 0)}` : '—';

                  const leadsN = getMetaVal(accountInsights.actions || [], 'lead', 'offsite_conversion.fb_pixel_lead', 'onsite_conversion.lead_grouped') || '0';
                  const cpl = parseFloat(leadsN) > 0 ? `${cur} ${fmtNum(parseFloat(accountInsights.spend) / parseFloat(leadsN), 2)}` : '—';

                  const msgsN = getMetaVal(accountInsights.actions || [], 'onsite_conversion.messaging_conversation_started_7d', 'onsite_conversion.messaging_first_reply') || '0';
                  const cpmsg = parseFloat(msgsN) > 0 ? `${cur} ${fmtNum(parseFloat(accountInsights.spend) / parseFloat(msgsN), 2)}` : '—';

                  const engN = getMetaVal(accountInsights.actions || [], 'post_engagement', 'page_engagement') || '0';
                  const cpe = parseFloat(engN) > 0 ? `${cur} ${fmtNum(parseFloat(accountInsights.spend) / parseFloat(engN), 2)}` : '—';

                  type K = { label: string; value: string };
                  let row1: K[] = [], row2: K[] = [];
                  if (objType === 'sales') {
                    row1 = [{ label: 'Inversión', value: spend }, { label: 'Personas alcanzadas', value: reach }, { label: 'Compras generadas', value: purchasesN }, { label: 'Retorno (ROAS)', value: roas }];
                    row2 = [{ label: 'Costo por compra', value: cpa }, { label: 'Valor en ventas', value: purchaseValFmt }, { label: 'Clics al sitio', value: clicks }, { label: 'CTR promedio', value: ctr }];
                  } else if (objType === 'leads') {
                    row1 = [{ label: 'Inversión', value: spend }, { label: 'Personas alcanzadas', value: reach }, { label: 'Leads generados', value: leadsN }, { label: 'Costo por lead', value: cpl }];
                    row2 = [{ label: 'Clics al sitio', value: clicks }, { label: 'CTR promedio', value: ctr }, { label: 'CPM', value: cpm }, { label: 'Frecuencia', value: freq }];
                  } else if (objType === 'traffic') {
                    row1 = [{ label: 'Inversión', value: spend }, { label: 'Personas alcanzadas', value: reach }, { label: 'Clics al sitio', value: clicks }, { label: 'Costo por clic', value: cpc }];
                    row2 = [{ label: 'CTR promedio', value: ctr }, { label: 'Impresiones', value: impr }, { label: 'CPM', value: cpm }, { label: 'Frecuencia', value: freq }];
                  } else if (objType === 'messages') {
                    row1 = [{ label: 'Inversión', value: spend }, { label: 'Personas alcanzadas', value: reach }, { label: 'Conversaciones', value: msgsN }, { label: 'Costo por conv.', value: cpmsg }];
                    row2 = [{ label: 'Clics', value: clicks }, { label: 'CTR promedio', value: ctr }, { label: 'CPM', value: cpm }, { label: 'Frecuencia', value: freq }];
                  } else if (objType === 'engagement') {
                    row1 = [{ label: 'Inversión', value: spend }, { label: 'Personas alcanzadas', value: reach }, { label: 'Interacciones', value: engN }, { label: 'Costo por interac.', value: cpe }];
                    row2 = [{ label: 'Impresiones', value: impr }, { label: 'CTR promedio', value: ctr }, { label: 'CPM', value: cpm }, { label: 'Frecuencia', value: freq }];
                  } else if (objType === 'awareness') {
                    row1 = [{ label: 'Inversión', value: spend }, { label: 'Personas alcanzadas', value: reach }, { label: 'Impresiones', value: impr }, { label: 'CPM', value: cpm }];
                    row2 = [{ label: 'Frecuencia', value: freq }, { label: 'CTR promedio', value: ctr }, { label: 'Clics al sitio', value: clicks }, { label: 'Costo por clic', value: cpc }];
                  } else {
                    // mixed — row1 base, row2 dynamically from active objectives
                    row1 = [{ label: 'Inversión', value: spend }, { label: 'Personas alcanzadas', value: reach }, { label: 'Clics al sitio', value: clicks }, { label: 'CTR promedio', value: ctr }];
                    const activeObjsUI = detectActiveObjectives(campaigns, campaignInsights);
                    const objKpisUI: Record<string, K[]> = {
                      sales: [{ label: 'Compras', value: purchasesN }, { label: 'ROAS', value: roas }],
                      leads: [{ label: 'Leads generados', value: leadsN }, { label: 'Costo por lead', value: cpl }],
                      messages: [{ label: 'Conversaciones', value: msgsN }, { label: 'Costo x conv.', value: cpmsg }],
                      traffic: [{ label: 'Costo por clic', value: cpc }, { label: 'CPM', value: cpm }],
                      engagement: [{ label: 'Interacciones', value: engN }, { label: 'Costo x interac.', value: cpe }],
                      awareness: [{ label: 'Impresiones', value: impr }, { label: 'Frecuencia', value: freq }],
                    };
                    row2 = activeObjsUI.slice(0, 2).flatMap(obj => objKpisUI[obj] || []).slice(0, 4);
                    while (row2.length < 4) row2.push({ label: '', value: '—' });
                  }
                  return (
                    <div className="space-y-2">
                      {[row1, row2].map((row, ri) => (
                        <div key={ri} className="grid grid-cols-4 gap-2">
                          {row.map(k => (
                            <div key={k.label} className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-100 dark:border-zinc-800 px-3 py-3 shadow-sm text-center">
                              <p className="text-[17px] font-bold text-[#2196F3] leading-none mb-1">{k.value}</p>
                              <p className="text-[9px] text-zinc-400 uppercase tracking-wider">{k.label}</p>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* Campaign quick table */}
                {campaigns.filter(c => parseFloat(campaignInsights[c.id]?.spend || '0') > 0).length > 0 && (
                  <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 overflow-hidden shadow-sm">
                    <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                      <h3 className="text-[12px] font-bold text-zinc-800 dark:text-zinc-100">Resultados por campaña</h3>
                      <span className="text-[10px] text-zinc-400">{campaigns.filter(c => parseFloat(campaignInsights[c.id]?.spend || '0') > 0).length} campañas activas</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-[11px]">
                        <thead>
                          <tr className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500">
                            <th className="text-left px-3 py-2.5 font-semibold">Campaña</th>
                            <th className="text-right px-3 py-2.5 font-semibold">Inversión</th>
                            <th className="text-right px-3 py-2.5 font-semibold">Alcance</th>
                            <th className="text-right px-3 py-2.5 font-semibold">Resultado</th>
                            <th className="text-right px-3 py-2.5 font-semibold">Costo/R</th>
                            <th className="text-right px-3 py-2.5 font-semibold">CTR</th>
                            <th className="text-center px-3 py-2.5 font-semibold">Estado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {campaigns.filter(c => parseFloat(campaignInsights[c.id]?.spend || '0') > 0).map((c: any, idx: number) => {
                            const ins = campaignInsights[c.id];
                            const metric = ins ? getPrimaryMetric(c.objective || '', ins) : null;
                            const ctr = parseFloat(ins?.inline_link_click_ctr || 0);
                            const roas = parseFloat(ins?.purchase_roas?.[0]?.value || 0);
                            const freq = parseFloat(ins?.frequency || 0);
                            // Health score: green/yellow/red
                            let health = 'neutral';
                            if (ctr >= 1.5 && freq <= 2.5) health = 'good';
                            else if (ctr < 0.8 || freq > 3.5) health = 'bad';
                            else health = 'ok';
                            const healthBadge = health === 'good'
                              ? <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" title="Buen rendimiento" />
                              : health === 'bad'
                              ? <span className="inline-block w-2 h-2 rounded-full bg-red-400" title="Bajo rendimiento" />
                              : <span className="inline-block w-2 h-2 rounded-full bg-amber-400" title="Rendimiento medio" />;
                            return (
                              <tr key={c.id} className={`border-t border-zinc-50 dark:border-zinc-800/50 ${idx % 2 !== 0 ? 'bg-zinc-50/30 dark:bg-zinc-800/10' : ''}`}>
                                <td className="px-3 py-2 font-medium text-zinc-800 dark:text-zinc-200 max-w-[200px]">
                                  <div className="flex items-center gap-1.5">
                                    <span className={`flex-shrink-0 w-1.5 h-1.5 rounded-full ${c.status === 'ACTIVE' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                                    <span className="truncate">{c.name}</span>
                                  </div>
                                </td>
                                <td className="px-3 py-2 text-right font-mono font-bold text-zinc-800 dark:text-zinc-200">{fmtNum(ins?.spend, 0)}</td>
                                <td className="px-3 py-2 text-right font-mono text-zinc-600 dark:text-zinc-400">{ins?.reach ? parseInt(ins.reach).toLocaleString('es-AR') : '—'}</td>
                                <td className="px-3 py-2 text-right font-mono font-bold text-zinc-800 dark:text-zinc-200">
                                  {metric ? <span title={metric.label}>{metric.value}</span> : '—'}
                                </td>
                                <td className="px-3 py-2 text-right font-mono text-zinc-600 dark:text-zinc-400">{metric?.cost ?? '—'}</td>
                                <td className={`px-3 py-2 text-right font-mono font-bold ${ctr >= 1.5 ? 'text-emerald-600' : ctr >= 1 ? 'text-amber-500' : ctr > 0 ? 'text-red-500' : 'text-zinc-400'}`}>{ins ? fmtNum(ctr, 2) + '%' : '—'}</td>
                                <td className="px-3 py-2 text-center">{healthBadge}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* AI Report */}
                {isGeneratingClientReport && !clientReportText && (
                  <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <Loader2 className="w-7 h-7 text-violet-500 animate-spin" />
                    <p className="text-[13px] text-zinc-500">Generando reporte para el cliente...</p>
                  </div>
                )}
                {!clientReportText && !isGeneratingClientReport && hasData && (
                  <div className="flex flex-col items-center justify-center py-12 gap-3 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                    <FileDown className="w-8 h-8 text-zinc-300" />
                    <p className="text-[12px] text-zinc-500">Hacé click en "Generar Reporte" para crear el informe para tu cliente</p>
                    <p className="text-[11px] text-zinc-400">O usá "Analizar Todo" en la barra superior para generar todo de una vez</p>
                  </div>
                )}
                {clientReportText && (
                  <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm px-6 py-5">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                          <FileDown className="w-3.5 h-3.5 text-white" />
                        </div>
                        <div>
                          <p className="text-[13px] font-bold text-zinc-900 dark:text-white">{accountOverview?.name || 'Reporte'}</p>
                          <p className="text-[10px] text-zinc-400">{dateMode === 'preset' ? preset : `${since} — ${until}`}</p>
                        </div>
                      </div>
                      <button onClick={handleClientReportPDF} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500 hover:bg-violet-600 text-white text-[11px] font-semibold transition-colors">
                        <FileDown className="w-3 h-3" />Exportar PDF
                      </button>
                    </div>
                    <div className="text-[12px] leading-relaxed border-t border-zinc-100 dark:border-zinc-800 pt-4">{renderMarkdown(clientReportText)}</div>
                  </div>
                )}
              </div>
            )}

            {/* ── CREATIVIDAD ─────────────────────────────────────────── */}
            {activeTab === 'CREATIVIDAD' && (
              <div>
                {isAnalyzingAI && !creativityText ? (
                  <div className="flex flex-col items-center justify-center py-24 gap-4">
                    <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
                    <p className="text-[13px] text-zinc-500">Analizando creatividades...</p>
                  </div>
                ) : !creativityText ? (
                  <div className="flex flex-col items-center justify-center py-24 gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center">
                      <Palette className="w-7 h-7 text-violet-400" />
                    </div>
                    <p className="text-[14px] font-semibold text-zinc-500 dark:text-zinc-400">El análisis creativo aparece acá luego de analizar</p>
                  </div>
                ) : (
                  <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm px-5 py-4">
                    {renderMarkdown(creativityText)}
                  </div>
                )}
              </div>
            )}

            {/* ── PLAN ─────────────────────────────────────────────── */}
            {activeTab === 'PLAN' && (
              <div>
                {!hasAnalysis && (
                  <div className="mb-4 flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3">
                    <span className="text-amber-500">⚠️</span>
                    <p className="text-[12px] text-amber-700 dark:text-amber-300 font-medium">Primero hacé el análisis de la cuenta para que el plan sea más preciso.</p>
                  </div>
                )}
                {!planText && !isGeneratingPlan && (
                  <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm p-5 space-y-4">
                    <h3 className="text-[14px] font-bold text-zinc-900 dark:text-white">Configurar Plan Estratégico</h3>
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-500 mb-1">¿Cuál es tu objetivo?</label>
                      <textarea value={planObjective} onChange={e => setPlanObjective(e.target.value)}
                        placeholder="Ej: Llegar a $50,000 USD en ventas mensuales..."
                        rows={3} className="w-full text-[12px] bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-[8px] px-3 py-2 text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-violet-400 resize-none" />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-zinc-500 mb-1">Plazo</label>
                        <select value={planDeadline} onChange={e => setPlanDeadline(e.target.value)}
                          className="w-full text-[12px] bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-[8px] px-3 py-2 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-violet-400">
                          {['1 mes', '2 meses', '3 meses', '6 meses', '12 meses'].map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-zinc-500 mb-1">Presupuesto mensual</label>
                        <input type="text" value={planBudget} onChange={e => setPlanBudget(e.target.value)}
                          placeholder="Ej: $5,000 USD"
                          className="w-full text-[12px] bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-[8px] px-3 py-2 text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-violet-400" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-zinc-500 mb-1">Fecha de inicio</label>
                        <input type="date" value={planStartDate} onChange={e => setPlanStartDate(e.target.value)}
                          className="w-full text-[12px] bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-[8px] px-3 py-2 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-violet-400" />
                      </div>
                    </div>
                    <button onClick={handleGeneratePlan} disabled={isGeneratingPlan}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-[10px] bg-gradient-to-r from-violet-500 to-indigo-600 text-white text-[13px] font-bold hover:opacity-90 disabled:opacity-50 transition-all shadow-md">
                      <Zap className="w-4 h-4" />
                      Generar Plan Estratégico
                    </button>
                  </div>
                )}
                {isGeneratingPlan && (
                  <div className="flex flex-col items-center justify-center py-24 gap-4">
                    <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
                    <p className="text-[13px] text-zinc-500">Generando plan estratégico...</p>
                  </div>
                )}
                {planText && !isGeneratingPlan && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-[13px] font-bold text-zinc-900 dark:text-white">Plan Generado</h3>
                      <button onClick={() => setPlanText('')} className="text-[11px] text-zinc-400 hover:text-zinc-600">Regenerar</button>
                    </div>
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm px-5 py-4">
                      {renderMarkdown(planText)}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── GPT OPTIMIZER ─────────────────────────────────────────── */}
            {activeTab === 'GPT_OPTIMIZER' && (
              <div className="p-4 pb-28">
                <GPTOptimizerTab accountId={selectedAccountId} />
              </div>
            )}

          </div>

          {/* ── CHAT PANEL — toggleable ──────────── */}
          {chatOpen && (
            <div className="flex-[1] min-w-0 border-l border-zinc-100 dark:border-zinc-800 flex flex-col bg-white dark:bg-zinc-900 overflow-hidden" style={{ maxWidth: '300px' }}>
              <div className="flex-shrink-0 px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-md bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                    <BrainCircuit className="w-3 h-3 text-white" />
                  </div>
                  <p className="text-[12px] font-bold text-zinc-900 dark:text-white">
                    Chat analista
                  </p>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {currentQuickPrompts.map(qp => (
                    <button key={qp} onClick={() => handleChat(qp)} disabled={isChatting}
                      className="text-[9px] font-medium px-2 py-0.5 rounded-full bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 border border-violet-100 dark:border-violet-800 hover:bg-violet-100 dark:hover:bg-violet-900/40 disabled:opacity-40 transition-all">
                      {qp}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
                {currentChat.length === 0 && (
                  <div className="flex items-center justify-center py-8">
                    <p className="text-[11px] text-zinc-400 dark:text-zinc-600 text-center">Preguntá algo sobre la cuenta o usá los atajos de arriba</p>
                  </div>
                )}
                {currentChat.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[90%] px-3 py-2 rounded-[10px] text-[11px] leading-relaxed ${msg.role === 'user' ? 'bg-violet-500 text-white rounded-br-sm' : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-bl-sm border border-zinc-100 dark:border-zinc-700'}`}>
                      {msg.role === 'assistant' ? renderMarkdown(msg.content) : msg.content}
                    </div>
                  </div>
                ))}
                {isChatting && (
                  <div className="flex justify-start">
                    <div className="bg-zinc-100 dark:bg-zinc-800 px-3 py-2 rounded-[10px] rounded-bl-sm">
                      <Loader2 className="w-3 h-3 text-zinc-400 animate-spin" />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              <div className="flex-shrink-0 px-3 py-3 border-t border-zinc-100 dark:border-zinc-800">
                <div className="flex items-end gap-2">
                  <textarea value={chatInput} onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChat(chatInput); } }}
                    placeholder="Preguntá algo..." rows={2}
                    className="flex-1 text-[11px] bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-[8px] px-3 py-2 text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-violet-400 resize-none" />
                  <button onClick={() => handleChat(chatInput)} disabled={!chatInput.trim() || isChatting}
                    className="p-2 rounded-[8px] bg-violet-500 hover:bg-violet-600 text-white disabled:opacity-40 transition-all flex-shrink-0">
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── SKILLS MODAL ─────────────────────────────────────────────────── */}
      {skillsOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden border border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 dark:border-zinc-800">
              <div>
                <h2 className="text-[15px] font-bold text-zinc-900 dark:text-white">🧠 Skills de Conocimiento</h2>
                <p className="text-[11px] text-zinc-400 mt-0.5">El agente se enriquece con estas fuentes</p>
              </div>
              <button onClick={() => setSkillsOpen(false)} className="p-1.5 rounded-[7px] text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
              <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4 border border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[12px] font-bold text-zinc-900 dark:text-white">SKILL 1 — NOVEDADES META ADS</h3>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">ACTIVO</span>
                </div>
                <p className="text-[11px] text-zinc-500 mb-1">Meta Newsroom + Developers Blog · Actualización automática cada 24hs</p>
                <p className="text-[10px] text-zinc-400">Última actualización: {new Date().toLocaleDateString('es-AR')}</p>
              </div>
              <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4 border border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[12px] font-bold text-zinc-900 dark:text-white">SKILL 3 — YOUTUBE REFERENTES</h3>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300">{ytChannels.filter(c => c.active).length} CANALES</span>
                </div>
                <p className="text-[11px] text-zinc-500 mb-3">Extrae insights de los últimos videos de cada canal</p>
                <div className="space-y-1.5 mb-3">
                  {ytChannels.map((ch, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <button
                        onClick={() => setYtChannels(prev => prev.map((c, j) => j === i ? { ...c, active: !c.active } : c))}
                        className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center flex-shrink-0 transition-all ${ch.active ? 'bg-violet-500 border-violet-500' : 'border-zinc-300 dark:border-zinc-600'}`}>
                        {ch.active && <span className="text-white text-[8px] font-bold">✓</span>}
                      </button>
                      <span className="text-[11px] text-zinc-700 dark:text-zinc-300 flex-1 truncate">{ch.name}</span>
                      <button onClick={() => setYtChannels(prev => prev.filter((_, j) => j !== i))}
                        className="text-zinc-300 hover:text-red-500 dark:text-zinc-600 dark:hover:text-red-400 transition-colors">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input value={newChannelName} onChange={e => setNewChannelName(e.target.value)}
                    placeholder="Nombre del canal"
                    className="flex-1 text-[11px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-[6px] px-2 py-1.5 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-violet-400" />
                  <button
                    onClick={() => { if (newChannelName.trim()) { setYtChannels(prev => [...prev, { name: newChannelName.trim(), url: '', active: true }]); setNewChannelName(''); } }}
                    className="px-3 py-1.5 rounded-[6px] bg-violet-500 text-white text-[11px] font-semibold hover:bg-violet-600 transition-all">
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
