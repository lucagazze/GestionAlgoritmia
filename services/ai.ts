
import { db } from './db';

const MODEL = 'gpt-4o-mini';

let cachedApiKey: string | null = null;

const getApiKey = async () => {
    if (cachedApiKey) return cachedApiKey;
    const key = await db.settings.getApiKey();
    if (key) {
        cachedApiKey = key;
        return key;
    }
    return null;
};

const fetchOpenAI = async (messages: any[], jsonMode = false, signal?: AbortSignal) => {
    try {
        const apiKey = await getApiKey();
        if (!apiKey) {
            console.error("API Key no encontrada.");
            return null;
        }

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: MODEL,
                messages,
                response_format: jsonMode ? { type: "json_object" } : undefined,
                temperature: 0.7
            }),
            signal 
        });

        if (!response.ok) throw new Error(await response.text());
        const data = await response.json();
        return data.choices[0].message.content;
    } catch (error: any) {
        if (error.name === 'AbortError') return null;
        console.error("AI Service Error:", error);
        return null;
    }
};

export const ai = {
  chat: async (messages: any[]) => {
      const response = await fetchOpenAI(messages);
      return response || "Error de conexión.";
  },

  salesCoach: async (mode: 'SCRIPT' | 'ANALYSIS' | 'ROLEPLAY', inputData: any) => {
      return await fetchOpenAI([
          { role: 'system', content: "Eres director comercial." },
          { role: 'user', content: JSON.stringify(inputData) }
      ]);
  },

  analyzeAgencyHealth: async (projects: any[], tasks: any[]) => {
      const today = new Date().toISOString().split('T')[0];
      
      // Filter only relevant data to save tokens
      const riskProjects = projects.filter(p => {
          if (p.status !== 'ACTIVE' && p.status !== 'ONBOARDING') return false;
          // Check ghosting (>7 days)
          const lastContact = p.lastContactDate ? new Date(p.lastContactDate) : new Date(p.createdAt);
          const diffDays = Math.ceil(Math.abs(new Date().getTime() - lastContact.getTime()) / (1000 * 60 * 60 * 24));
          return diffDays > 7;
      }).map(p => ({
          id: p.id,
          name: p.name,
          industry: p.industry,
          phone: p.phone,
          lastContactDays: Math.ceil(Math.abs(new Date().getTime() - (p.lastContactDate ? new Date(p.lastContactDate).getTime() : new Date(p.createdAt).getTime())) / (1000 * 60 * 60 * 24))
      }));

      const overdueTasksCount = tasks.filter(t => t.status !== 'DONE' && t.dueDate && t.dueDate < new Date().toISOString()).length;
      
      const prompt = `
      Eres un "Auditor de Agencia" experto y proactivo. Analiza la situación hoy (${today}).
      
      DATA:
      - Clientes en Riesgo (Ghosting > 7 días): ${JSON.stringify(riskProjects)}
      - Tareas Vencidas: ${overdueTasksCount}
      
      TAREA:
      Genera un reporte JSON accionable.
      
      Para cada cliente en riesgo ("riskClients"), REDACTA UN MENSAJE DE REACTIVACIÓN ("recoveryMessage") para enviar por WhatsApp. 
      El mensaje debe ser casual, empático y profesional (ej: "Hola [Nombre], hace mucho no hablamos, quería contarte que...").
      
      FORMATO JSON:
      {
        "overallScore": 0-100, (100 es perfecto)
        "summary": "Resumen corto de 1 linea",
        "actionItems": [
            {
                "type": "CLIENT_GHOSTING",
                "clientId": "...",
                "title": "Cliente Descuidado: [Nombre]",
                "description": "Hace X días no hay contacto.",
                "actionLabel": "Enviar Mensaje",
                "generatedMessage": "Hola [Nombre]..." 
            },
            {
                "type": "OVERDUE_TASKS",
                "title": "Limpieza de Tareas",
                "description": "Tienes X tareas vencidas.",
                "actionLabel": "Reprogramar para Hoy",
                "count": ${overdueTasksCount}
            }
        ]
      }
      `;

      const response = await fetchOpenAI([{ role: 'system', content: "Eres un auditor operativo." }, { role: 'user', content: prompt }], true);
      try {
          return JSON.parse(response || "{}");
      } catch (e) {
          console.error("Error parsing health scan", e);
          return null;
      }
  },

  agent: async (userInput: string, contextHistory: any[] = [], currentData: any, signal?: AbortSignal) => {
      const now = new Date();
      const localDate = now.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
      const localTime = now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
      
      const activeTasks = currentData.tasks
          .filter((t: any) => t.status !== 'DONE')
          .slice(0, 40)
          .map((t: any) => `ID:${t.id} | "${t.title}" | Due:${t.dueDate?.slice(0,16) || 'N/A'}`)
          .join('\n');

      const activeProjects = currentData.projects
          .map((p: any) => `ID:${p.id} | "${p.name}"`)
          .join('\n');
          
      const systemPrompt = `
      Eres el "Sistema Operativo" de la agencia.
      FECHA: ${localDate} | HORA: ${localTime}.

      REGLAS CRÍTICAS:
      1. ESTADOS DE TAREA: Solo existen "TODO" (Por hacer) y "DONE" (Terminado). No uses in_progress.
      2. PRECIO: No calculamos márgenes. El precio es directo.
      3. NUEVO CLIENTE: Si el usuario dice "Nuevo Cliente" o similar, NO inventes datos. Pregunta paso a paso o analiza el texto si ya te dio la info.
         - Si falta info, pregunta: "¿Cómo se llama el cliente?", "¿Cuál es el fee mensual?", "¿De qué rubro es?".
         - Si tienes toda la info (Nombre, Rubro, Fee), genera la acción CREATE_PROJECT.

      TUS PODERES:
      1. CREAR TAREAS: Batch support (arrays). Detecta fechas relativas (ej: "próximo lunes").
      2. CREAR CLIENTES: Usa acción CREATE_PROJECT. Payload: { name, monthlyRevenue, industry, notes }.
      3. BORRAR: Si hay ambigüedad, devuelve type "DECISION".
      4. HÁBITOS: Sé proactivo si ves patrones rotos.

      BASE DE DATOS:
      [TAREAS PENDIENTES]
      ${activeTasks}
      [CLIENTES]
      ${activeProjects}

      FORMATOS JSON:

      A) ACCIÓN ÚNICA:
      {
          "type": "ACTION", 
          "action": "CREATE_TASK" | "CREATE_PROJECT",
          "payload": { ... }, 
          "message": "He creado..."
      }

      B) BATCH (Múltiples):
      {
          "type": "BATCH",
          "actions": [ ... ],
          "message": "Listo..."
      }

      C) DECISIÓN (Ambigüedad):
      {
          "type": "DECISION",
          "message": "¿Cual borro?",
          "options": [ { "label": "...", "action": "...", "payload": ... } ]
      }

      D) PREGUNTAS (Si necesitas info):
      { "type": "QUESTION", "message": "¿Cuál es el nombre del cliente?" }
      
      E) CHAT:
      { "type": "CHAT", "message": "..." }
      `;

      const apiMessages = [
          { role: 'system', content: systemPrompt },
          ...contextHistory.slice(-10).map(m => ({ role: m.role, content: m.content })),
          { role: 'user', content: userInput }
      ];

      const responseText = await fetchOpenAI(apiMessages, true, signal);
      
      if (!responseText) return null;

      try {
          return JSON.parse(responseText);
      } catch (e) {
          return { type: "CHAT", message: responseText };
      }
  }
};
