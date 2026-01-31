
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
      // ... (Existing Sales Coach Logic kept brief for this file update) ...
      return await fetchOpenAI([
          { role: 'system', content: "Eres director comercial." },
          { role: 'user', content: JSON.stringify(inputData) }
      ]);
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
