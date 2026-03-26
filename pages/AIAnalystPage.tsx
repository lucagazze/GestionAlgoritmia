
import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  metaAds, INSIGHT_FIELDS, daysAgo, today as todayFn, presetToRange,
  type DatePreset, type TimeRange,
} from '../services/metaAds';
import { ai } from '../services/ai';
type ClaudeMessage = { role: 'user' | 'assistant'; content: string };
import {
  PieChart, Pie, Cell, Tooltip as ReTooltip, ResponsiveContainer,
} from 'recharts';
import {
  BrainCircuit, Settings, Upload, FileDown, Loader2, Send,
  X, Plus, Trash2, BarChart2, Palette, ClipboardList,
  ToggleLeft, ToggleRight, RefreshCw, Zap, TrendingUp, DollarSign,
  Activity, AlertCircle, CheckCircle2,
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

const META_ANALYST_SYSTEM = `Sos el analista senior de Meta Ads de Algoritmia. Aplicás la metodología Andromeda de Charley T (Disrupter School) como marco principal de análisis. Cada diagnóstico se basa en sus principios, no en criterios genéricos.

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

### Estructura correcta (Andromeda 1)
  1 Campaña CBO por objetivo de negocio
    ├── Conjunto Control  → Post IDs de anuncios ganadores validados
    └── Conjunto Testeo   → DCT 3:2:2 (Broad, sin intereses)
- **CBO obligatorio** (Campaign Budget Optimization): gestiona presupuesto en tiempo real donde hay oportunidad
- **ABO = ineficiente**: fuerza gasto donde puede no haber oportunidad real ese día
- Ubicaciones: **Advantage+ automático** en todos los conjuntos (Meta decide el placement óptimo)

### Framework de testeo: DCT 3:2:2
| Elemento | Cantidad |
|---|---|
| Creativos (videos O imágenes, NUNCA mezclados) | 3 |
| Textos principales | 2 |
| Títulos | 2 |
- Meta genera miles de combinaciones → después de 3-7 días identifica el ganador
- **Cosecha de ganadores**: extraer Post ID del ganador → mover al Conjunto Control
- El testeo sigue corriendo mientras sea rentable (no se apaga ni se escala)

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
- Evaluá estructura vs Andromeda: ¿usa CBO? ¿tiene Control + Testeo? ¿hay intereses/Lookalikes? ¿usa exclusiones?
- Para cada campaña: MANTENER / ESCALAR / EVALUAR / PAUSAR / DESACTIVAR con razón concreta`;

const ACTION_STYLES: Record<string, string> = {
  MANTENER:   'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  ESCALAR:    'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  EVALUAR:    'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  PAUSAR:     'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  DESACTIVAR: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
};

const PIE_COLORS = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#3b82f6','#ef4444','#14b8a6','#f97316','#84cc16'];

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
  return n.toFixed(decimals);
};

// Returns the primary KPI for a campaign based on its objective
function getPrimaryMetric(objective: string, ins: any): { label: string; value: string; cost: string } {
  const obj = (objective || '').toLowerCase();
  const actions = ins?.actions || [];
  const spend = parseFloat(ins?.spend || 0);
  const costPer = (val: string) => {
    const n = parseFloat(val);
    return spend > 0 && n > 0 ? `$${(spend / n).toFixed(0)}` : '—';
  };

  // Messages / WhatsApp
  const msgVal = getMetaVal(actions,
    'onsite_conversion.messaging_conversation_started_7d',
    'onsite_conversion.messaging_first_reply',
    'onsite_conversion.send_message',
    'contact',
  );
  if (msgVal && parseFloat(msgVal) > 0) {
    return { label: 'Mensajes', value: msgVal, cost: costPer(msgVal) };
  }

  // Leads
  if (obj.includes('lead')) {
    const v = getMetaVal(actions, 'lead', 'offsite_conversion.fb_pixel_lead', 'onsite_conversion.lead_grouped') || '0';
    return { label: 'Leads', value: v, cost: costPer(v) };
  }

  // Traffic
  if (obj.includes('traffic') || obj.includes('link_click')) {
    const v = ins?.inline_link_clicks || '0';
    return { label: 'Clics', value: v, cost: costPer(v) };
  }

  // Awareness / Reach
  if (obj.includes('awareness') || obj.includes('reach')) {
    return { label: 'Alcance', value: parseInt(ins?.reach || 0).toLocaleString('es-AR'), cost: '—' };
  }

  // Video views
  if (obj.includes('video')) {
    const v = ins?.video_thruplay_watched_actions?.[0]?.value || '0';
    return { label: 'ThruPlays', value: v, cost: costPer(v) };
  }

  // App installs
  if (obj.includes('app')) {
    const v = getMetaVal(actions, 'mobile_app_install', 'app_install') || '0';
    return { label: 'Instalaciones', value: v, cost: costPer(v) };
  }

  // Engagement (interactions — fallback for OUTCOME_ENGAGEMENT without messages)
  if (obj.includes('engagement')) {
    const v = getMetaVal(actions, 'post_engagement', 'page_engagement') || '0';
    return { label: 'Interacciones', value: v, cost: costPer(v) };
  }

  // Default: Sales / Conversions
  const v = getMetaVal(actions, 'offsite_conversion.fb_pixel_purchase', 'purchase', 'omni_purchase') || '0';
  return { label: 'Compras', value: v, cost: costPer(v) };
}

function buildCampDataString(camps: any[], insights: Record<string, any>): string {
  return camps.map((c: any) => {
    const ins = insights[c.id];
    if (!ins) return `${c.name} [${c.status}|${c.objective||'—'}] — Sin datos en el período`;
    const metric = getPrimaryMetric(c.objective || '', ins);
    const roas = ins.purchase_roas?.[0]?.value ? fmtNum(ins.purchase_roas[0].value, 2) : '—';
    const atc = getMetaVal(ins.actions || [], 'offsite_conversion.fb_pixel_add_to_cart', 'add_to_cart') || '0';
    return `${c.name} [${c.status}|${c.objective||'—'}] | Gasto: $${fmtNum(ins.spend)} | Resultado principal: ${metric.label}=${metric.value} (costo por resultado: ${metric.cost}) | ROAS: ${roas} | ATC: ${atc} | CTR: ${fmtNum(ins.inline_link_click_ctr, 2)}% | CPM: $${fmtNum(ins.cpm, 2)} | Frecuencia: ${fmtNum(ins.frequency, 2)} | Impresiones: ${ins.impressions || '0'}`;
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
  return `Analizá esta cuenta de Meta Ads aplicando el método Andromeda de Charley T como marco principal.

CUENTA: ${accountName} (${accountId})
MONEDA DE LA CUENTA: ${currency}${!isUSD ? ` ← IMPORTANTE: los valores monetarios (CPM, CPC, CPA, gasto) están en ${currency}. NO los compares contra benchmarks en USD. Evaluá CPM/CPC de forma relativa (coherencia entre gasto, alcance, resultado) sin decir que son "caros" por ser números altos en moneda local.` : ''}
PERÍODO: ${period}

DATOS DE CAMPAÑAS:
${campData}

Generá el análisis con estas secciones (usá los números de las campañas reales de los datos):

## DIAGNÓSTICO GENERAL
Estado de la cuenta: inversión total, ROAS blended estimado, métricas clave con benchmark. Una frase de diagnóstico general.

## ESTRUCTURA VS ANDROMEDA
Evaluá punto por punto:
- ¿Usa CBO o ABO? (CBO = correcto)
- ¿Tiene Conjunto Control con Post IDs de ganadores?
- ¿Tiene Conjunto Testeo con DCT 3:2:2?
- ¿Usa segmentación Broad o intereses/Lookalikes? (Broad = correcto)
- ¿Usa exclusiones de audiencia? (Sin exclusiones = correcto)
- ¿Usa Advantage+ para ubicaciones? (Sí = correcto)
- Veredicto: ¿la estructura está alineada con Andromeda? ¿Qué cambiar?

## ANÁLISIS POR CAMPAÑA
Para cada campaña activa con datos, evaluala según su objetivo real (Mensajes, Leads, Clics, Compras, Interacciones, etc. — lo que figura como "Resultado principal" en los datos). NO evalúes todas por compras si su objetivo es otro.
Formato exacto: **[Nombre exacto]**: MANTENER/ESCALAR/EVALUAR/PAUSAR — [razón en 1 línea con el número concreto que lo justifica]

## PROBLEMAS DETECTADOS (según Andromeda)
Los 3-5 problemas concretos: estructura incorrecta, métricas fuera de benchmark, posibles "ladrones de crédito", fase de aprendizaje reiniciada, presupuesto mal distribuido, etc.

## OPORTUNIDADES INMEDIATAS
3 acciones concretas ordenadas por impacto. Para cada una: qué hacer, por qué, qué resultado esperar.

## PRÓXIMO PASO (esta semana)
Una sola acción prioritaria. Concisa, accionable, sin vaguedades.

Sé específico: usá números reales de los datos, nombrá campañas exactamente, comparalos siempre contra benchmarks.`;
}

function buildCreativityPrompt(campData: string, accountName: string, period: string): string {
  return `Analizá la estrategia creativa de la cuenta ${accountName} (${period}) aplicando el framework de Charley T.

DATOS:
${campData}

## ESTADO CREATIVO GENERAL
CTR promedio vs benchmark (≥1.5%), frecuencia, señales de fatiga creativa.

## EVALUACIÓN DCT 3:2:2
¿Los conjuntos de testeo tienen 3 creativos + 2 textos + 2 títulos? ¿Los creativos son todos del mismo formato (todos video O todas imágenes, no mezclados)? ¿Hay ganadores siendo cosechados al Conjunto Control vía Post ID?

## EL CREATIVO COMO SEGMENTACIÓN
¿Los creativos actuales le "hablan" claramente a un perfil específico? ¿Le están comunicando un dolor o deseo concreto que permite al algoritmo encontrar al público correcto? Ejemplos de qué dice cada anuncio principal.

## SEÑALES DE "LADRÓN DE CRÉDITO"
¿Hay anuncios de retargeting agresivo, cupones o descuentos directos corriendo por separado? Si los hay, explicar el riesgo y recomendar integrarlos al CBO Broad principal.

## SOCIAL PROOF Y POST ID
¿Los anuncios ganadores acumulan likes/comentarios/compartidas? ¿Se están usando Post IDs para preservar esa prueba social? Si no, qué perder por no hacerlo.

## 5 IDEAS DE CREATIVOS A TESTEAR
Para cada idea: formato (video/imagen/carrusel), ángulo del mensaje, nivel de consciencia del avatar (Inconsciente / Problema / Solución / Producto / Decisión), y gancho de los primeros 3 segundos.`;
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
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [loadingAccounts, setLoadingAccounts] = useState(false);

  const [dateMode, setDateMode] = useState<'preset' | 'custom'>('preset');
  const [preset, setPreset] = useState<DatePreset>('last_28d');
  const [since, setSince] = useState(daysAgo(28));
  const [until, setUntil] = useState(todayFn());

  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<'REPORTES' | 'ANALISIS' | 'CREATIVIDAD' | 'PLAN'>('REPORTES');

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

  const hasAutoRun = useRef(false);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [analysisChat, planChat]);
  useEffect(() => { localStorage.setItem('analyst_yt_channels', JSON.stringify(ytChannels)); }, [ytChannels]);

  // AUTO-LOAD accounts on mount
  useEffect(() => { loadAccounts(); }, []);

  // AUTO-ANALYZE when first account selected
  useEffect(() => {
    if (selectedAccountId && !hasAutoRun.current) {
      hasAutoRun.current = true;
      handleFullAnalysis(selectedAccountId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAccountId]);

  // ── Load accounts ──────────────────────────────────────────────────────────
  const loadAccounts = async () => {
    setLoadingAccounts(true);
    try {
      const res = await metaAds.getAllAdAccounts();
      const allAccts = res.data || [];

      // Filter to only accounts with at least 1 active campaign
      const checks = await Promise.all(
        allAccts.map(async (acct: any) => {
          const hasSpend = await metaAds.hasRecentSpend(acct.id);
          return hasSpend ? acct : null;
        })
      );
      const accts = checks.filter(Boolean);

      setAccounts(accts);
      if (accts.length > 0 && !selectedAccountId) {
        setSelectedAccountId(accts[0].id);
      }
    } catch (e) {
      console.error('Error loading accounts:', e);
    } finally {
      setLoadingAccounts(false);
    }
  };

  // ── Full analysis: fetch Meta data + AI ───────────────────────────────────
  const handleFullAnalysis = async (accountId?: string) => {
    const accId = accountId || selectedAccountId;
    if (!accId) return;

    setIsFetchingData(true);
    setIsAnalyzingAI(false);
    setAnalysisError(null);
    setAnalysisText('');
    setCreativityText('');
    setAdActions({});
    setAnalysisChat([]);

    const range: TimeRange = dateMode === 'custom' ? { since, until } : presetToRange(preset);

    try {
      // 1. Fetch account info + campaigns + account-level insights in parallel
      setAnalysisProgress('Cargando cuenta...');
      const [acct, campRes, acctIns] = await Promise.all([
        metaAds.getAccount(accId),
        metaAds.getCampaigns(accId),
        metaAds.getInsights(accId, INSIGHT_FIELDS, undefined, range),
      ]);
      setAccountOverview(acct);
      setAccountInsights(acctIns);

      const camps = (campRes.data || []).slice(0, 25);
      setAnalysisProgress(`Cargando insights de ${camps.length} campañas...`);

      // 2. Fetch campaign insights in parallel
      const insights: Record<string, any> = {};
      await Promise.all(camps.map(async (c: any) => {
        const ins = await metaAds.getInsights(c.id, INSIGHT_FIELDS, undefined, range);
        if (ins) insights[c.id] = ins;
      }));
      setCampaigns(camps);
      setCampaignInsights(insights);
      setIsFetchingData(false);

      // Switch to Reportes — data is ready
      setActiveTab('REPORTES');

      // 3. AI Analysis (optional, gracefully handle missing key)
      setAnalysisProgress('Generando diagnóstico con IA...');
      setIsAnalyzingAI(true);

      const campData = buildCampDataString(camps, insights);
      const period = `${range.since} al ${range.until}`;

      const currency = acct?.currency || 'USD';
      const [analysisResult, creativityResult] = await Promise.allSettled([
        ai.chat([{ role: 'system', content: META_ANALYST_SYSTEM }, { role: 'user', content: buildAnalysisPrompt(accId, period, campData, acct?.name || accId, currency) }]),
        ai.chat([{ role: 'system', content: META_ANALYST_SYSTEM }, { role: 'user', content: buildCreativityPrompt(campData, acct?.name || accId, period) }]),
      ]);

      if (analysisResult.status === 'fulfilled') {
        setAnalysisText(analysisResult.value as string);
        setAdActions(parseActionsFromAnalysis(analysisResult.value as string, camps));
      } else {
        const msg = (analysisResult.reason as any)?.message || '';
        setAnalysisError(`Error en análisis IA: ${msg}`);
      }

      if (creativityResult.status === 'fulfilled') {
        setCreativityText(creativityResult.value);
      }

      setAnalysisProgress('');

    } catch (err: any) {
      setAnalysisError(`Error al cargar datos: ${err.message}`);
      setAnalysisProgress('');
    } finally {
      setIsFetchingData(false);
      setIsAnalyzingAI(false);
    }
  };

  // ── Generate plan ──────────────────────────────────────────────────────────
  const handleGeneratePlan = async () => {
    setIsGeneratingPlan(true);
    setPlanText('');
    setPlanChat([]);
    try {
      const campData = buildCampDataString(campaigns, campaignInsights);
      const prompt = `Generá un plan estratégico completo de Meta Ads.
CUENTA: ${accountOverview?.name || selectedAccountId}
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
      const resp = await ai.chat([{ role: 'system', content: META_ANALYST_SYSTEM }, { role: 'user', content: prompt }]);
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
    const isPlanTab = activeTab === 'PLAN';
    const chatHistory = isPlanTab ? planChat : analysisChat;
    const setChat = isPlanTab ? setPlanChat : setAnalysisChat;
    const context = isPlanTab ? planText : analysisText + '\n\n' + creativityText;

    setIsChatting(true);
    setChatInput('');
    const newMsg: ClaudeMessage = { role: 'user', content: msg };
    setChat(prev => [...prev, newMsg]);

    try {
      const resp = await ai.chat([
        { role: 'system', content: `${META_ANALYST_SYSTEM}\n\nContexto del análisis:\n${context}` },
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

  // ── Export PDF ─────────────────────────────────────────────────────────────
  const handleExportPDF = () => {
    const pw = window.open('', '_blank');
    if (!pw) return;
    const content = activeTab === 'PLAN' ? planText : activeTab === 'CREATIVIDAD' ? creativityText : analysisText;
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

  const hasData = campaigns.length > 0;
  const hasAnalysis = analysisText.length > 0;
  const isLoading = isFetchingData || isAnalyzingAI;

  const currentChat = activeTab === 'PLAN' ? planChat : analysisChat;
  const currentQuickPrompts = activeTab === 'PLAN'
    ? ['¿Es realista el objetivo?', '¿Cómo distribuir el presupuesto?', '¿Qué hacer si no se cumplen las metas?', '¿Qué KPI mirar primero?']
    : ['¿Por qué no se vende?', '¿Qué campaña pausar primero?', '¿Hay fatiga de audiencia?', '¿Dónde hay fuga de presupuesto?'];

  return (
    <div className="flex h-[calc(100vh-60px)] overflow-hidden bg-[#f5f5f7] dark:bg-[#0a0a0a]">

      {/* ── LEFT PANEL ─────────────────────────────────────────────────── */}
      <aside className="w-52 flex-shrink-0 bg-white dark:bg-zinc-900 border-r border-black/[0.06] dark:border-white/[0.05] flex flex-col overflow-hidden">
        <div className="px-4 pt-5 pb-3 border-b border-black/[0.05] dark:border-white/[0.04]">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
              <BrainCircuit className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-[13px] font-bold text-zinc-900 dark:text-white tracking-tight">Algoritmia</span>
          </div>
          <p className="text-[10px] text-violet-500 dark:text-violet-400 font-semibold tracking-wider uppercase ml-8">Meta Ads Analyst</p>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          <p className="text-[9px] font-semibold text-zinc-400 dark:text-zinc-600 uppercase tracking-[0.08em] px-1 mb-1.5">Cuentas</p>
          {loadingAccounts && (
            <div className="flex items-center gap-1.5 px-1 py-1">
              <Loader2 className="w-3 h-3 animate-spin text-violet-500" />
              <span className="text-[10px] text-zinc-400">Cargando...</span>
            </div>
          )}
          {!loadingAccounts && accounts.length === 0 && (
            <p className="text-[11px] text-zinc-400 dark:text-zinc-600 px-1 italic">Sin cuentas</p>
          )}
          <div className="space-y-0.5">
            {accounts.map((acct: any) => (
              <button
                key={acct.id}
                onClick={() => {
                  setSelectedAccountId(acct.id);
                  hasAutoRun.current = true;
                  handleFullAnalysis(acct.id);
                }}
                className={`w-full text-left px-2 py-1.5 rounded-[6px] text-[11px] font-medium transition-all ${
                  selectedAccountId === acct.id
                    ? 'bg-violet-600 text-white'
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/[0.06]'
                }`}
              >
                <span className="truncate block">{acct.name || acct.id}</span>
                {acct.currency && (
                  <span className={`text-[9px] ${selectedAccountId === acct.id ? 'text-violet-200' : 'text-zinc-400 dark:text-zinc-600'}`}>
                    {acct.currency}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="px-3 pb-4 space-y-2 flex-shrink-0">
          <button
            onClick={() => { hasAutoRun.current = false; loadAccounts(); }}
            disabled={loadingAccounts}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-[8px] bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-[11px] font-bold tracking-wide hover:opacity-90 disabled:opacity-50 transition-all"
          >
            {loadingAccounts ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            ACTUALIZAR
          </button>
          <button
            onClick={() => setSkillsOpen(true)}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-[8px] border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 text-[11px] font-medium hover:bg-zinc-50 dark:hover:bg-white/[0.04] transition-all"
          >
            <Settings className="w-3 h-3" />
            Skills
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT ───────────────────────────────────────────────── */}
      <div className="flex flex-1 min-w-0 flex-col overflow-hidden">

        {/* Top bar */}
        <div className="flex-shrink-0 bg-white dark:bg-zinc-900 border-b border-black/[0.06] dark:border-white/[0.05] px-4 py-2.5 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 rounded-md">
            <span className="font-mono truncate max-w-[160px]">{accountOverview?.name || selectedAccountId || 'Sin cuenta'}</span>
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

          <button
            onClick={() => { hasAutoRun.current = true; handleFullAnalysis(); }}
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
            { id: 'REPORTES',    label: '📈 Reportes' },
            { id: 'ANALISIS',    label: '📊 Análisis' },
            { id: 'CREATIVIDAD', label: '🎨 Creatividad' },
            { id: 'PLAN',        label: '📋 Plan' },
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
              <div className="space-y-5">
                {!hasData && !isLoading && (
                  <div className="flex flex-col items-center justify-center py-24 gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center">
                      <TrendingUp className="w-7 h-7 text-violet-400" />
                    </div>
                    <p className="text-[14px] font-semibold text-zinc-500 dark:text-zinc-400">
                      {accounts.length > 0 ? 'Cargando datos de la cuenta...' : 'Cargando cuentas...'}
                    </p>
                    <p className="text-[12px] text-zinc-400 dark:text-zinc-600">Los datos se cargan automáticamente al entrar</p>
                  </div>
                )}

                {hasData && (
                  <>
                    {/* Account header */}
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-[18px] font-bold text-zinc-900 dark:text-white tracking-tight">{accountOverview?.name || selectedAccountId}</h2>
                        <p className="text-[12px] text-zinc-400 mt-0.5">
                          {accountOverview?.currency} · Período: {dateMode === 'custom' ? `${since} → ${until}` : DATE_PRESETS.find(p => p.value === preset)?.label}
                          {isAnalyzingAI && <span className="ml-2 text-violet-500 font-medium">· Analizando con IA...</span>}
                        </p>
                      </div>
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
                            const cpmThreshold = curr === 'ARS' ? 10000 : 15;
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
                          <KpiCard label="CPC" value={`${fmtNum(accountInsights?.cpc, 2)}${curr ? ` ${curr}` : ''}`} />
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

                    {/* Pie chart + Campaign table */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                      {pieData.length > 0 && (
                        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm p-4">
                          <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-[0.06em] mb-3">Gasto por Campaña</p>
                          <ResponsiveContainer width="100%" height={180}>
                            <PieChart>
                              <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={2} dataKey="value">
                                {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                              </Pie>
                              <ReTooltip formatter={(v: any) => [`$${v.toLocaleString('es-AR')}`, 'Gasto']} />
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="mt-2 space-y-1">
                            {pieData.slice(0, 6).map((d, i) => (
                              <div key={i} className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                                <span className="text-[9px] text-zinc-500 dark:text-zinc-400 truncate flex-1">{d.name}</span>
                                <span className="text-[9px] font-bold text-zinc-700 dark:text-zinc-300">${d.value.toLocaleString('es-AR')}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Full campaign table */}
                      <div className={`bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm overflow-hidden ${pieData.length > 0 ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
                        {(() => {
                          const campsWithSpend = campaigns.filter((c: any) => parseFloat(campaignInsights[c.id]?.spend || 0) > 0);
                          return (<>
                        <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                          <h3 className="text-[13px] font-bold text-zinc-900 dark:text-white">KPIs por Campaña ({campsWithSpend.length})</h3>
                          {isAnalyzingAI && <span className="text-[10px] text-violet-500 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Generando acciones IA...</span>}
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-[10px]">
                            <thead>
                              <tr className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 text-[9px]">
                                <th className="text-left px-3 py-2 font-semibold">Campaña</th>
                                <th className="text-left px-2 py-2 font-semibold">Obj.</th>
                                <th className="text-right px-2 py-2 font-semibold">Gasto</th>
                                <th className="text-right px-2 py-2 font-semibold">ROAS</th>
                                <th className="text-right px-2 py-2 font-semibold">Resultado</th>
                                <th className="text-right px-2 py-2 font-semibold">Costo/R</th>
                                <th className="text-right px-2 py-2 font-semibold">CTR%</th>
                                <th className="text-right px-2 py-2 font-semibold">CPM</th>
                                <th className="text-right px-2 py-2 font-semibold">Frec.</th>
                                <th className="text-center px-2 py-2 font-semibold">IA</th>
                              </tr>
                            </thead>
                            <tbody>
                              {campsWithSpend.map((c: any, idx: number) => {
                                const ins = campaignInsights[c.id];
                                const action = adActions[c.id];
                                const metric = ins ? getPrimaryMetric(c.objective || '', ins) : null;
                                const roasVal = ins?.purchase_roas?.[0]?.value ? parseFloat(ins.purchase_roas[0].value) : 0;
                                const isUSD = accountOverview?.currency === 'USD';
                                const ctr = parseFloat(ins?.inline_link_click_ctr || 0);
                                const freq = parseFloat(ins?.frequency || 0);
                                return (
                                  <tr key={c.id} className={`border-t border-zinc-50 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors ${idx % 2 !== 0 ? 'bg-zinc-50/40 dark:bg-zinc-800/10' : ''}`}>
                                    <td className="px-3 py-2 font-medium text-zinc-800 dark:text-zinc-200 max-w-[160px] truncate" title={c.name}>
                                      <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${c.status === 'ACTIVE' ? 'bg-emerald-400' : c.status === 'PAUSED' ? 'bg-amber-400' : 'bg-zinc-300'}`} />
                                      {c.name}
                                    </td>
                                    <td className="px-2 py-2 text-zinc-500 dark:text-zinc-500 max-w-[70px] truncate">{(c.objective || '').replace('OUTCOME_', '')}</td>
                                    <td className="px-2 py-2 text-right font-mono text-zinc-700 dark:text-zinc-300">{ins ? fmtNum(ins.spend, 0) : '—'}</td>
                                    <td className={`px-2 py-2 text-right font-mono font-bold ${roasVal >= 3 ? 'text-emerald-600' : roasVal >= 1.5 ? 'text-amber-600' : roasVal > 0 ? 'text-red-500' : 'text-zinc-400'}`}>
                                      {roasVal > 0 ? fmtNum(roasVal, 2) : '—'}
                                    </td>
                                    <td className="px-2 py-2 text-right font-mono text-zinc-700 dark:text-zinc-300">
                                      {metric ? (
                                        <span title={metric.label} className="cursor-help">{metric.value}</span>
                                      ) : '—'}
                                    </td>
                                    <td className="px-2 py-2 text-right font-mono text-zinc-600 dark:text-zinc-400">{metric?.cost ?? '—'}</td>
                                    <td className={`px-2 py-2 text-right font-mono ${ctr >= 1.5 ? 'text-emerald-600' : ctr >= 1 ? 'text-amber-500' : ctr > 0 ? 'text-red-500' : 'text-zinc-600 dark:text-zinc-400'}`}>
                                      {ins ? fmtNum(ctr, 2) : '—'}
                                    </td>
                                    {(() => {
                                      const cpmVal = parseFloat(ins?.cpm || 0);
                                      const acctCurr = accountOverview?.currency || '';
                                      const cpmThreshold = acctCurr === 'ARS' ? 10000 : 15;
                                      const cpmBad = acctCurr && cpmVal > cpmThreshold;
                                      return (
                                        <td className={`px-2 py-2 text-right font-mono ${cpmBad ? 'text-red-500' : 'text-zinc-600 dark:text-zinc-400'}`}>
                                          {ins ? fmtNum(cpmVal, 0) : '—'}
                                        </td>
                                      );
                                    })()}
                                    <td className={`px-2 py-2 text-right font-mono ${freq > 3.5 ? 'text-red-500' : freq > 2.5 ? 'text-amber-500' : 'text-zinc-600 dark:text-zinc-400'}`}>
                                      {ins ? fmtNum(freq, 1) : '—'}
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
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        </>);})()}
                      </div>
                    </div>

                    {/* Benchmarks */}
                    <div className="flex items-center gap-4 text-[10px] text-zinc-400 dark:text-zinc-600 flex-wrap pb-4">
                      <span><span className="text-emerald-500 font-bold">●</span> CTR ≥ 1.5%</span>
                      <span><span className="text-emerald-500 font-bold">●</span> Frecuencia ≤ 2.5</span>
                      <span><span className="text-emerald-500 font-bold">●</span> CPM ≤ {accountOverview?.currency === 'ARS' ? '10.000 ARS' : '$15 USD'}</span>
                      <span className="text-zinc-300 dark:text-zinc-700">|</span>
                      <span><span className="text-amber-500 font-bold">●</span> Puede mejorar</span>
                      <span><span className="text-red-500 font-bold">●</span> Problema</span>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── ANÁLISIS ─────────────────────────────────────────── */}
            {activeTab === 'ANALISIS' && (
              <div>
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
                      {analysisError ? 'Configurá la API key de Claude para ver el análisis IA' : 'El análisis aparece acá después de analizar'}
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
                                return (
                                  <tr key={c.id} className={`border-t border-zinc-50 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors ${idx % 2 !== 0 ? 'bg-zinc-50/50 dark:bg-zinc-800/20' : ''}`}>
                                    <td className="px-3 py-2 font-medium text-zinc-800 dark:text-zinc-200 max-w-[220px] truncate" title={c.name}>{c.name}</td>
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

            {/* ── CREATIVIDAD ───────────────────────────────────────── */}
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
          </div>

          {/* ── CHAT PANEL — only for non-Reportes tabs ──────────── */}
          {activeTab !== 'REPORTES' && (
            <div className="flex-[1] min-w-0 border-l border-zinc-100 dark:border-zinc-800 flex flex-col bg-white dark:bg-zinc-900 overflow-hidden" style={{ maxWidth: '320px' }}>
              <div className="flex-shrink-0 px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-md bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                    <BrainCircuit className="w-3 h-3 text-white" />
                  </div>
                  <p className="text-[12px] font-bold text-zinc-900 dark:text-white">
                    {activeTab === 'PLAN' ? 'Chat estratégico' : 'Chat analista'}
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
