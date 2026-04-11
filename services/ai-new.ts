import { GoogleGenAI } from "@google/genai";
import { db } from './db';

const MODEL_NAME = 'gemini-3-flash-preview';

const getClient = async () => {
    const dbKey = await db.settings.getApiKey('google_api_key');
    const apiKey = dbKey || process.env.API_KEY;
    
    if (!apiKey) {
        throw new Error("No Google API Key found. Please add it in Settings.");
    }
    return new GoogleGenAI({ apiKey });
};

// ✨ FUNCTION DECLARATIONS for Native Function Calling
const tools = [{
    functionDeclarations: [
        {
            name: "manage_tasks",
            description: "Gestión de TAREAS (Todo List). ⚠️ NO USAR PARA CLIENTES/PROYECTOS. Solo para crear, actualizar o borrar items de la lista de tareas.",
            parameters: {
                type: "object",
                properties: {
                    actions: {
                        type: "array",
                        description: "Array de acciones. IMPORTANTE: Si pide 'lunes a viernes', crea 5 items separados (uno por día).",
                        items: {
                            type: "object",
                            properties: {
                                action: { 
                                    type: "string", 
                                    enum: ["CREATE", "UPDATE", "DELETE"],
                                    description: "CREATE=nueva, UPDATE=modificar, DELETE=borrar"
                                },
                                title: { 
                                    type: "string",
                                    description: "Título OBLIGATORIO para CREATE. Ej: 'Ir a caminar', 'Trabajar'"
                                },
                                dueDate: { 
                                    type: "string",
                                    description: "ISO date. Interpreta: 'lunes'=próximo lunes, 'dos y media'=14:30"
                                },
                                endTime: { 
                                    type: "string",
                                    description: "ISO date (opcional). Usa si dice 'de 8 a 14:30'"
                                },
                                priority: { 
                                    type: "string",
                                    enum: ["LOW", "MEDIUM", "HIGH"]
                                },
                                status: {
                                    type: "string",
                                    enum: ["TODO", "DONE"]
                                },
                                id: { 
                                    type: "string",
                                    description: "UUID (OBLIGATORIO para UPDATE/DELETE)"
                                }
                            },
                            required: ["action"]
                        }
                    },
                    summary: {
                        type: "string",
                        description: "Mensaje confirmando. Usa **negritas**. Ej: 'Creé **6 tareas**: 1 para caminar y 5 de trabajo'"
                    }
                },
                required: ["actions", "summary"]
            }
        },
        {
            name: "chat_response",
            description: "Responder conversacionalmente cuando NO se requiere acción",
            parameters: {
                type: "object",
                properties: {
                    message: { 
                        type: "string",
                        description: "Respuesta. Usa **negritas** para nombres/números"
                    }
                },
                required: ["message"]
            }
        },
        {
            name: "ask_question",
            description: "Preguntar al usuario cuando falta información crítica",
            parameters: {
                type: "object",
                properties: {
                    question: { type: "string" },
                    context: { type: "string" }
                },
                required: ["question"]
            }
        }
    ],
}, 
{
    functionDeclarations: [
        {
            name: "manage_clients",
            description: "Crear o actualizar clientes (PROYECTOS). Usa esto cuando el usuario quiera agregar un nuevo cliente o modificar uno existente. Si falta info, INVENTA datos realistas.",
            parameters: {
                type: "object",
                properties: {
                    action: { 
                        type: "string", 
                        enum: ["CREATE", "UPDATE", "DELETE"],
                        description: "CREATE=nuevo cliente, UPDATE=modificar existente, DELETE=eliminar cliente"
                    },
                    name: { 
                        type: "string",
                        description: "Nombre de la empresa/cliente. Ej: 'Puertas Blindadas Jack'"
                    },
                    industry: { 
                        type: "string",
                        description: "Industria/Rubro. Ej: 'Seguridad', 'Software', 'Real Estate'"
                    },
                    monthlyRevenue: { 
                        type: "number",
                        description: "Fee mensual estimado. Si no dice, estima un valor realista (ej: 500-2000)"
                    },
                    billingDay: {
                        type: "number",
                        description: "Día del mes de cobro (1-31). Ej: 24"
                    },
                    status: {
                        type: "string",
                        enum: ["ONBOARDING", "ACTIVE", "PAUSED", "COMPLETED"],
                        description: "Estado del proyecto. Default: ACTIVE"
                    },
                    description: {
                        type: "string",
                        description: "Resumen completo del cliente: qué hacen, dónde están, desde cuándo, servicios que se les da. Incluye TODO el contexto."
                    },
                    location: {
                        type: "string", 
                        description: "Ubicación (Ciudad/País). Ej: 'Buenos Aires, Argentina'"
                    },
                    id: { 
                        type: "string",
                        description: "UUID (Solo para UPDATE)"
                    }
                },
                required: ["action", "name", "description"]
            }
        }
    ]
}];

export interface Message {
    role: 'user' | 'assistant';
    content: string;
}

export interface ContextData {
    tasks?: any[];
    projects?: any[];
    services?: any[];
    contractors?: any[];
}

export const ai = {
    agent: async (
        userInput: string | { mimeType: string; data: string },
        contextHistory: Message[] = [],
        contextData: ContextData = {}
    ): Promise<any> => {
        const { tasks = [], projects = [], services = [], contractors = [] } = contextData;

        const now = new Date();
        const argentinaFormatter = new Intl.DateTimeFormat('es-AR', {
            timeZone: 'America/Argentina/Buenos_Aires',
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit',
            hour12: false,
            weekday: 'long'
        });
        const argentinaTimeStr = argentinaFormatter.format(now);

        const activeTasks = tasks
            .filter((t: any) => t.status !== 'DONE')
            .slice(0, 50)
            .map((t: any) => `[TAREA] ID:${t.id} | "${t.title}" | Vence:${t.dueDate || 'Sin fecha'}`)
            .join('\\n');

        const activeProjects = projects
            .map((p: any) => `[CLIENTE] ID:${p.id} | "${p.name}" | Estado:${p.status}`)
            .join('\\n');
        
        const teamMembers = contractors
            .map((c: any) => `[EQUIPO] ID:${c.id} | "${c.name}" | Rol:${c.role}`)
            .join('\\n');

        const systemInstruction = `
Eres el asistente ejecutivo. Fecha/Hora actual (Argentina): ${argentinaTimeStr}

CONTEXTO:
${activeTasks || '[No hay tareas]'}
${activeProjects || '[No hay proyectos]'}
${teamMembers || '[No hay equipo]'}

REGLAS CRÍTICAS:
1. ⚠️ RESPUESTAS CORTAS Y DIRECTAS. Solo confirma la acción.
2. Si pide crear/modificar/borrar → USA manage_tasks o manage_clients.
3. Si el usuario refiere a "este cliente" o "el de recién", BUSCA el ID en el historial reciente.
4. Si falta el ID para un UPDATE, y acabas de crear uno, USA ESE ID.
5. Interpreta fechas relativas ("lunes", "24 de cada mes").
6. NO expliques obviedades. Solo di "Listo", "Hecho", "Agendado".

EJEMPLO REAL:
Usuario: "Poneme una tarea para el lunes a las dos y media ir a caminar. Y poneme también para entre las ocho a las dos y media de toda la semana de lunes a viernes trabajar."

Debes llamar manage_tasks con:
{
  "actions": [
    { "action": "CREATE", "title": "Ir a caminar", "dueDate": "2026-02-03T14:30:00-03:00" },
    { "action": "CREATE", "title": "Trabajar", "dueDate": "2026-02-03T08:00:00-03:00", "endTime": "2026-02-03T14:30:00-03:00" },
    { "action": "CREATE", "title": "Trabajar", "dueDate": "2026-02-04T08:00:00-03:00", "endTime": "2026-02-04T14:30:00-03:00" },
    { "action": "CREATE", "title": "Trabajar", "dueDate": "2026-02-05T08:00:00-03:00", "endTime": "2026-02-05T14:30:00-03:00" },
    { "action": "CREATE", "title": "Trabajar", "dueDate": "2026-02-06T08:00:00-03:00", "endTime": "2026-02-06T14:30:00-03:00" },
    { "action": "CREATE", "title": "Trabajar", "dueDate": "2026-02-07T08:00:00-03:00", "endTime": "2026-02-07T14:30:00-03:00" }
  ],
  "summary": "Creé **6 tareas**: 1 para caminar (Lunes 14:30) y 5 de trabajo (Lun-Vie 8:00-14:30)"
}
`;

        try {
            const client = await getClient();
            
            let userPart;
            if (typeof userInput === 'string') {
                userPart = { text: userInput };
            } else {
                userPart = { inlineData: { mimeType: userInput.mimeType, data: userInput.data } };
            }

            const historyParts = contextHistory.slice(-4).map(m => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }]
            }));

            historyParts.push({
                role: 'user',
                parts: [userPart]
            });

            const response = await client.models.generateContent({
                model: MODEL_NAME,
                contents: historyParts,
                tools: tools, // ✨ NATIVE FUNCTION CALLING
                config: { systemInstruction }
            } as any);

            console.log('🤖 RAW RESPONSE:', response);

            // Check if AI called a function
            if (response.functionCalls && response.functionCalls.length > 0) {
                const functionCall = response.functionCalls[0];
                console.log('✅ FUNCTION CALLED:', functionCall.name, functionCall.args);

                if (functionCall.name === 'manage_tasks') {
                    return {
                        type: 'BATCH',
                        actions: (functionCall.args as any).actions.map((a: any) => ({
                            action: a.action === 'CREATE' ? 'CREATE_TASK' : 
                                    a.action === 'UPDATE' ? 'UPDATE_TASK' : 'DELETE_TASK',
                            payload: {
                                title: a.title,
                                dueDate: a.dueDate,
                                endTime: a.endTime,
                                priority: a.priority || 'MEDIUM',
                                status: a.status || 'TODO',
                                id: a.id
                            }
                        })),
                        message: functionCall.args.summary
                    };
                } else if (functionCall.name === 'chat_response') {
                    return {
                        type: 'CHAT',
                        message: functionCall.args.message
                    };
                } else if (functionCall.name === 'ask_question') {
                    return {
                        type: 'QUESTION',
                        message: functionCall.args.question,
                        context: functionCall.args.context
                    };
                } else if (functionCall.name === 'manage_clients') {
                    const args = functionCall.args as any;
                    return {
                        type: 'BATCH', // Reusing BATCH type for now, frontend should handle ACTION types generically if possible, or I'll map it to CREATE_CLIENT payload
                        actions: [{
                            action: args.action === 'CREATE' ? 'CREATE_PROJECT' : 
                                    args.action === 'UPDATE' ? 'UPDATE_PROJECT' : 'DELETE_PROJECT',
                            payload: {
                                name: args.name,
                                industry: args.industry || 'General',
                                monthlyRevenue: args.monthlyRevenue || 0,
                                billingDay: args.billingDay || 1,
                                status: args.status || 'ACTIVE',
                                notes: args.description || '',
                                // Mapping extra fields to notes if needed or extending the Project type later
                                location: args.location, 
                                id: args.id
                            }
                        }],
                        message: `✅ Procesado cliente: **${args.name}**`
                    };
                }
            }

            // Fallback if no function call
            return {
                type: 'CHAT',
                message: response.text || "No pude procesar eso."
            };

        } catch (error) {
            console.error("AI Agent Error:", error);
            return null;
        }
    }
};

// ── GPT Optimizer: Análisis Charley T ─────────────────────────────────────────
export interface GPTAdData {
  ad_name: string;
  campaign: string;
  adset: string;
  spend: number;
  cpa: number;
  gpt: number;
  results: number;
  revenue: number;
  roas: number;
}

export async function analyzeGPTEcosystem(
  ads: GPTAdData[],
  period: string,
  avgCpa: number,
  avgGpt: number,
  rawActivities: any[] = [],
): Promise<string> {
  const client = await getClient();

  const totalSpend   = ads.reduce((s, a) => s + a.spend, 0);
  const totalRevenue = ads.reduce((s, a) => s + a.revenue, 0);
  const totalResults = ads.reduce((s, a) => s + a.results, 0);

  const getQuad = (a: GPTAdData) => {
    if (a.cpa <= avgCpa && a.gpt >= avgGpt) return 'SCALER';
    if (a.cpa >  avgCpa && a.gpt >= avgGpt) return 'RELIABLE';
    if (a.cpa <= avgCpa && a.gpt <  avgGpt) return 'FAKE WIN';
    return 'LIABILITY';
  };

  const f = (n: number) => `$${n.toFixed(2)}`;

  const adsText = [...ads]
    .sort((a, b) => b.gpt - a.gpt)
    .map((ad, i) => {
      const pct = totalSpend > 0 ? ((ad.spend / totalSpend) * 100).toFixed(1) : '0';
      const conv = ad.results > 0 ? ad.results : '0 (sin ventas)';
      const roas = ad.roas > 0 ? ` | ROAS: ${ad.roas.toFixed(2)}x` : '';
      return `${i + 1}. "${ad.ad_name}" [${getQuad(ad)}]\n   Gasto: ${f(ad.spend)} (${pct}% del total) | CPA: ${f(ad.cpa)} | GPT: ${f(ad.gpt)} | Conversiones: ${conv}${roas}`;
    })
    .join('\n\n');

  // Format recent account activities for the prompt
  const RELEVANT_EVENTS: Record<string, string> = {
    update_ad_run_status:       'Estado de anuncio cambiado',
    update_adgroup_run_status:  'Estado de conjunto cambiado',
    update_campaign_run_status: 'Estado de campaña cambiado',
    update_adgroup_budget:      'Presupuesto de conjunto cambiado',
    update_campaign_budget:     'Presupuesto de campaña cambiado',
    ad_created:                 'Anuncio creado',
    ad_deleted:                 'Anuncio eliminado',
    update_ad_creative:         'Creativo editado',
  };

  const activitiesText = rawActivities.length === 0
    ? 'Sin cambios registrados en los últimos 7 días.'
    : rawActivities
        .filter(a => RELEVANT_EVENTS[a.event_type])
        .slice(0, 20)
        .map(a => {
          const when = a.event_time
            ? new Date(a.event_time * 1000).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
            : '—';
          const type = RELEVANT_EVENTS[a.event_type] ?? a.event_type;
          const name = a.object_name ?? '—';
          const detail = a.translated_payload ?? '';
          return `• [${when}] ${type}: "${name}"${detail ? ` — ${detail}` : ''}`;
        })
        .join('\n') || 'Sin cambios relevantes en los últimos 7 días.';

  const systemPrompt = `Eres "Algor", el Analista Estratégico Senior de Meta Ads de la agencia Algoritmia. Operas de forma fría, matemática y estrictamente bajo la metodología "Andromeda 1" y "The One Campaign Method" del Profesor Charley T.

Tu ÚNICO objetivo es MAXIMIZAR EL VOLUMEN DE GANANCIA BRUTA (GPT = Gross Profit per Transaction) y estabilizar el flujo de caja del cliente. El ROAS es una métrica de vanidad.

Recibirás datos de una Campaña CBO (Advantage+) con el rendimiento de sus anuncios. Tu trabajo es entregar una Auditoría Profunda siguiendo ESTAS REGLAS INQUEBRANTABLES:

🟢 1. SCALERS (Escaladores): CPA bajo, GPT alto. Tu acción es "DEJAR EN PAZ". Si el promedio de la CBO es rentable, recomienda subir el presupuesto de la campaña entera un 5%.
🔵 2. RELIABLE (Confiables): CPA alto, GPT alto. Pagan las cuentas. Tu acción es "DEJAR CORRER".
🟡 3. FAKE WINS (Falsos Ganadores): CPA bajo, GPT bajo o nulo. Tu acción es "CONGELAR". Advierte que escalar con estos destruirá la rentabilidad.
🔴 4. LIABILITIES (Pasivos/Basura): CPA altísimo, GPT bajo o negativo. Tu acción es "APAGAR".

⚖️ REGLA DE MICRO-MOVIMIENTOS (Prueba de Estrés):
- NUNCA recomiendes apagar todos los Liabilities juntos si gastan más del 50% de la cuenta. Recomienda apagar SOLO EL PEOR HOY, y esperar 3 días.
- Explica SIEMPRE que apagar un anuncio malo NUNCA reinicia la fase de aprendizaje de la CBO; le da oxígeno a los Scalers.

🛡️ PROTOCOLO DE TESTEO (EL SEGURO DE VIDA):
- NUNCA se meten anuncios nuevos en el Ad Set ganador ("Control").
- Todo testeo nuevo va en un Ad Set SEPARADO (dentro de la misma CBO), usando formato Flexible 3:2:2.
- ⚠️ REGLA CRÍTICA: SIEMPRE debes ordenarle al usuario que le ponga un "LÍMITE DE GASTO MÁXIMO" a ese nuevo Ad Set de testeo (10% al 15% del presupuesto diario de la CBO). Explica que si no hace esto, Meta fundirá la cuenta testeando.

🧪 LABORATORIO CREATIVO:
- Solo tienes los nombres de los anuncios. NO INVENTES de qué trata el video.
- Identifica el anuncio Scaler/Reliable e indícale al usuario: "Tu anuncio ganador es [Nombre]. Tu tarea humana es identificar qué variable visual lo hizo ganar y grabar 3 variaciones aislando solo esa variable."

CONTEXTO DE ACTIVIDAD RECIENTE: Recibirás un log de los últimos 7 días de cambios manuales. Usarlo para:
- Evitar recomendar algo que ya se hizo recientemente.
- Si un anuncio se pausó hace poco, tomarlo en cuenta al evaluar el rendimiento.
- Si hay un anuncio nuevo (menos de 7 días), ser cauteloso antes de recomendarlo apagar (está en fase de aprendizaje).
- Ajustar el timing del "Próximo Paso" si ya hubo movimientos recientes.

El período analizado es "${period}". Usá EXACTAMENTE esa frase al referirte al período. No la cambies ni inventes otra.

ESTRUCTURA EXACTA DE TU RESPUESTA (usá este formato markdown exacto, sin agregar texto fuera de estas secciones):

Hola, soy Algor. Procesé la información de la cuenta bajo la metodología Andromeda 1.

## 🔍 Análisis General del Ecosistema
[Diagnóstico crudo en 2-4 oraciones: salud de la campaña, qué anuncio canibaliza el presupuesto, cuál es la oportunidad concreta.]

---

## 📋 Desglose por Anuncio
[Agrupar POR CUADRANTE. Solo incluir cuadrantes con al menos 1 anuncio.]

### 🟢 SCALERS
- **[nombre]** — [Diagnóstico 1 oración.] → Acción: [INSTRUCCIÓN EN MAYÚSCULAS]

### 🔵 RELIABLE
- **[nombre]** — [Diagnóstico 1 oración.] → Acción: [INSTRUCCIÓN EN MAYÚSCULAS]

### 🟡 FAKE WINS
- **[nombre]** — [Diagnóstico 1 oración.] → Acción: [INSTRUCCIÓN EN MAYÚSCULAS]

### 🔴 LIABILITIES
- **[nombre]** — [Diagnóstico 1 oración.] → Acción: [INSTRUCCIÓN EN MAYÚSCULAS]

---

## ⚡ Próximo Paso de Gestión (Checklist para HOY)
[Contexto breve. Considerar cambios recientes de la cuenta.]

Instrucción exacta para HOY:
1. [Acción específica]
2. [Acción específica si aplica]
3. No toques nada más.

Volvé a revisar en [N] días. [Qué mirar cuando volvás.]

---

## 🧪 Laboratorio Creativo (Incluyendo la regla del 10%-15% de límite de gasto)
Paso 1 — OBLIGATORIO ANTES DE SUBIR CUALQUIER CREATIVO: CONFIGURAR UN LÍMITE DE GASTO MÁXIMO DEL 10% AL 15% EN EL AD SET DE TESTEO. Sin este límite, Meta desvía todo el presupuesto al test y funde la cuenta.
[Identificar el anuncio ganador por nombre. Indicar la tarea humana: identificar la variable visual ganadora y grabar 3 variaciones aislando solo esa variable. Formato 3:2:2.]`;

  const userMessage = `Período de análisis: ${period}
CPA Promedio: ${f(avgCpa)} | GPT Promedio: ${f(avgGpt)}
Total gasto: ${f(totalSpend)} | Total ventas: ${totalResults} | Total ingresos: ${f(totalRevenue)}

ANUNCIOS (${ads.length} con gasto):

${adsText}

---

ACTIVIDAD RECIENTE EN LA CUENTA (últimos 7 días):
${activitiesText}

Dame el diagnóstico completo y el plan de acción para los ${period}.`;

  const response = await (client as any).models.generateContent({
    model: MODEL_NAME,
    contents: [{ role: 'user', parts: [{ text: userMessage }] }],
    config: { systemInstruction: systemPrompt },
  });

  return (response as any).text || 'No se pudo generar el análisis.';
}
