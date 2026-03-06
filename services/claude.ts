
/**
 * Claude AI Service — Anthropic API
 * Calls the Anthropic API directly from the browser (internal tool only).
 * API key is stored in Supabase AgencySettings under key 'claude_api_key'.
 */
import { db } from './db';
import { supabase } from './supabase';

const CLAUDE_API = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6';

// ── Build agency context system prompt ────────────────────────────────
export const buildAgencyContext = async (): Promise<string> => {
  try {
    const [projects, tasks, payments, proposals] = await Promise.all([
      supabase.from('Client').select('*').in('status', ['ACTIVE', 'ONBOARDING', 'PAUSED']),
      supabase.from('Task').select('*').eq('status', 'TODO').limit(20),
      supabase.from('Payment').select('*').order('date', { ascending: false }).limit(30),
      supabase.from('Proposal').select('*, client:Client(name,industry)').eq('status', 'ACCEPTED').limit(20),
    ]);

    const clients = projects.data || [];
    const activeCl = clients.filter((c: any) => c.status === 'ACTIVE');
    const totalMRR_ARS = activeCl.filter((c: any) => c.currency === 'ARS').reduce((s: number, c: any) => s + (c.monthlyRevenue || 0), 0);
    const totalMRR_USD = activeCl.filter((c: any) => c.currency !== 'ARS').reduce((s: number, c: any) => s + (c.monthlyRevenue || 0), 0);

    const clientList = clients.map((c: any) => {
      const lines = [
        `  - ${c.name} [${c.status}] | Industria: ${c.industry || '—'} | Fee: $${(c.monthlyRevenue || 0).toLocaleString()} ${c.currency || 'ARS'}/mes`,
        c.billingDay ? `    Día de cobro: ${c.billingDay}` : '',
        c.phone ? `    Tel: ${c.phone}` : '',
        c.email ? `    Email: ${c.email}` : '',
        c.website ? `    Web: ${c.website}` : '',
      ].filter(Boolean).join('\n');
      return lines;
    }).join('\n');

    const pendingTasks = (tasks.data || []).map((t: any) =>
      `  - [${t.priority || 'SIN PRIORIDAD'}] ${t.title}${t.dueDate ? ` (Vence: ${t.dueDate.slice(0, 10)})` : ''}`
    ).join('\n');

    const recentPayments = (payments.data || []).slice(0, 10).map((p: any) =>
      `  - ${p.date?.slice(0, 10)} | $${parseFloat(p.amount || 0).toLocaleString()} | clientId: ${p.clientId}`
    ).join('\n');

    const today = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    return `Sos el asistente de IA de Algoritmia, la agencia de marketing digital y desarrollo web de Luca Gazze.

=== HOY ===
Fecha: ${today}

=== AGENCIA ===
Nombre: Algoritmia
Dueño: Luca Gazze
Especialidades: Meta Ads (gestión de campañas publicitarias), Diseño y desarrollo de sitios web, Estrategia digital, Gestión de redes sociales
MRR Total: $${totalMRR_ARS.toLocaleString()} ARS + $${totalMRR_USD.toLocaleString()} USD/mes
Clientes activos: ${activeCl.length}
Total clientes (incl. pausados): ${clients.length}

=== CLIENTES ===
${clientList || 'Sin clientes cargados.'}

=== TAREAS PENDIENTES ===
${pendingTasks || 'Sin tareas pendientes.'}

=== PAGOS RECIENTES ===
${recentPayments || 'Sin pagos registrados.'}

=== META ADS ===
- The Skirting Factory: Cuenta Meta Ads activa (act_2136106490563351). Campañas en USD. Productos: cueros premium importados desde Argentina a Texas, EE.UU.
- Resto de clientes: en su mayoría Meta Ads gestionados mensualmente.

=== TU ROL ===
- Respondé SIEMPRE en español argentino informal (tuteo, tono directo y profesional).
- Sos experto en: Meta Ads, Facebook/Instagram Ads, estrategia de contenido, propuestas comerciales, gestión de agencia, diseño web, copywriting publicitario.
- Cuando generés propuestas, usá el framework de Algoritmia: Objetivo → Situación Actual → Solución → Estrategia → Inversión.
- Cuando des estrategias, sé concreto y accionable. Nada de relleno.
- Si te piden análisis de campañas, pensá en CPM, CTR, CPC, frecuencia, relevance score, y ROAS.
- Siempre pensá como un estratega de agencia, no como un asistente genérico.
- Podés ayudar con: propuestas comerciales, scripts de venta, estrategias de contenido, análisis de campañas, reportes de resultados, onboarding de clientes, ideas creativas, y gestión operativa de la agencia.`;
  } catch (e) {
    console.error('Error building context:', e);
    return `Sos el asistente de IA de Algoritmia, la agencia de marketing digital de Luca Gazze. Respondé siempre en español argentino. Sos experto en Meta Ads, estrategia digital y gestión de agencia.`;
  }
};

// ── Main chat function ────────────────────────────────────────────────
export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

export const claudeChat = async (
  messages: ClaudeMessage[],
  systemPrompt?: string
): Promise<string> => {
  const apiKey = await db.settings.getApiKey('claude_api_key');
  if (!apiKey) throw new Error('NO_API_KEY');

  const response = await fetch(CLAUDE_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `API Error ${response.status}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text || '';
};

// ── Quick-action prompt templates ────────────────────────────────────
export const QUICK_PROMPTS: { label: string; icon: string; color: string; prompt: (clients?: string[]) => string }[] = [
  {
    label: 'Generar Propuesta',
    icon: '📝',
    color: 'from-indigo-500 to-indigo-600',
    prompt: () => `Generame una propuesta comercial completa de Meta Ads para un cliente nuevo. El cliente tiene un negocio de [TIPO DE NEGOCIO], quiere [OBJETIVO]. Usá el formato de Algoritmia con todas las secciones: situación actual, solución, estrategia, inversión y por qué Algoritmia.`,
  },
  {
    label: 'Analizar Campaña',
    icon: '📊',
    color: 'from-blue-500 to-blue-600',
    prompt: () => `Analizá el estado de mis campañas de Meta Ads de The Skirting Factory. Basándote en métricas típicas de e-commerce (CPM, CTR, CPC, frecuencia), dame un diagnóstico y las 3 acciones más importantes que debería tomar esta semana para mejorar los resultados.`,
  },
  {
    label: 'Estrategia Mensual',
    icon: '🎯',
    color: 'from-violet-500 to-violet-600',
    prompt: () => `Dame una estrategia de trabajo completa para este mes. Tengo ${new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}. Mirá mis clientes activos y tareas pendientes, y armame un plan de acción claro con prioridades para los próximos 30 días.`,
  },
  {
    label: 'Ideas de Contenido',
    icon: '💡',
    color: 'from-amber-500 to-amber-600',
    prompt: () => `Generame 10 ideas de contenido para Instagram para uno de mis clientes. Dame el nombre del cliente o industria y te armo el calendario con hooks, formato recomendado (Reel/Post/Story) y el objetivo de cada pieza.`,
  },
  {
    label: 'Script de Venta',
    icon: '💬',
    color: 'from-emerald-500 to-emerald-600',
    prompt: () => `Escribime un script de venta para conseguir un nuevo cliente de [INDUSTRIA]. El script es para una llamada de descubrimiento de 15 minutos. Incluí las preguntas clave, cómo presentar Algoritmia, cómo manejar objeciones de precio, y el cierre.`,
  },
  {
    label: 'Reporte de Resultados',
    icon: '📈',
    color: 'from-rose-500 to-rose-600',
    prompt: () => `Ayudame a redactar un reporte de resultados mensual para un cliente. El cliente es [NOMBRE], servicio: [META ADS / WEB / etc.]. Los resultados del mes fueron: [MÉTRICAS]. Hacé que el reporte sea profesional, destaque los logros, y termine con los próximos pasos.`,
  },
];
