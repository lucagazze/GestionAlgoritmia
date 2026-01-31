
import { db } from './db';

const MODEL = 'gpt-4o-mini';

// Cache simple en memoria para no consultar la DB en cada mensaje de una misma sesión
let cachedApiKey: string | null = null;

const getApiKey = async () => {
    if (cachedApiKey) return cachedApiKey;
    
    // Consultamos a Supabase (AgencySettings)
    const key = await db.settings.getApiKey();
    if (key) {
        cachedApiKey = key;
        return key;
    }
    return null;
};

// Helper genérico para fetch a OpenAI
const fetchOpenAI = async (messages: any[], jsonMode = false) => {
    try {
        const apiKey = await getApiKey();

        if (!apiKey) {
            console.error("API Key no encontrada en Supabase (Tabla: AgencySettings, Key: openai_api_key)");
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
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("OpenAI API Error:", errorText);
            
            // Si el error es de autenticación, limpiamos la caché para reintentar la próxima vez
            if (response.status === 401) cachedApiKey = null;
            
            throw new Error(`Error ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;
    } catch (error) {
        console.error("AI Service Error:", error);
        return null;
    }
};

export const ai = {
  // --- CHAT GENERAL ---
  chat: async (messages: {role: 'system' | 'user' | 'assistant', content: string}[]) => {
      const response = await fetchOpenAI(messages);
      return response || "Error de conexión con OpenAI o falta configurar la API Key.";
  },

  // --- AGENTE DE VENTAS ---
  salesCoach: async (mode: 'SCRIPT' | 'ANALYSIS' | 'ROLEPLAY', inputData: any) => {
      let systemPrompt = `
      Eres el Director Comercial Senior de "Algoritmia".
      Objetivo: Ayudar a cerrar ventas high-ticket.
      Sé conciso, persuasivo y profesional.
      `;

      let userPrompt = "";

      if (mode === 'SCRIPT') {
          userPrompt = `Genera un guion de ventas para: ${inputData.context}. Cliente: ${inputData.clientName}. Rubro: ${inputData.industry || 'General'}. Objetivo: ${inputData.goal}`;
      } 
      else if (mode === 'ANALYSIS') {
          userPrompt = `Analiza esta respuesta del cliente: "${inputData.lastMessage}". Dame una estrategia y respuesta sugerida.`;
      }

      const messages = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
      ];

      const response = await fetchOpenAI(messages);
      return response;
  },

  // --- AGENTE DEL SISTEMA (Router & Ejecutor) ---
  agent: async (userInput: string, contextHistory: any[] = [], currentData: { tasks: any[], projects: any[], services: any[], contractors: any[] }) => {
      // 1. FECHA Y HORA ACTUAL
      const now = new Date();
      const localDate = now.toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      const localTime = now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
      
      // 2. CONTEXT PRUNING
      const activeTasks = currentData.tasks
          .filter(t => t.status !== 'DONE')
          .slice(0, 40)
          .map(t => `ID:${t.id} | "${t.title}" | ${t.status} | Due:${t.dueDate?.slice(0,10) || 'N/A'}`)
          .join('\n');

      const activeProjects = currentData.projects
          .filter(p => p.status === 'ACTIVE' || p.status === 'ONBOARDING')
          .map(p => `ID:${p.id} | "${p.name}" | Rev:$${p.monthlyRevenue}`)
          .join('\n');
          
      const servicesSummary = currentData.services.map(s => `- ${s.name} ($${s.baseCost})`).join('\n');
      
      const systemPrompt = `
      Eres el "Sistema Operativo" de la agencia.
      FECHA: ${localDate} | HORA: ${localTime}

      BASE DE DATOS ACTIVA:
      [TAREAS PENDIENTES]
      ${activeTasks || "No hay tareas pendientes."}
      [PROYECTOS]
      ${activeProjects || "No hay proyectos activos."}
      [SERVICIOS]
      ${servicesSummary}

      TU OBJETIVO:
      1. Identificar la intención del usuario (Crear, Editar, Borrar, Consultar).
      2. Si faltan datos clave (ej: fecha, cliente), PREGUNTA usando type "QUESTION".
      3. Si tienes todo, genera la acción.

      FORMATO JSON OBLIGATORIO:
      
      A) ACCIONES:
      {
          "type": "CONFIRM", 
          "action": "CREATE_TASK" | "UPDATE_TASK" | "DELETE_TASK" | "CREATE_PROJECT",
          "payload": {
              "title": "Titulo",
              "dueDate": "YYYY-MM-DDTHH:mm:00",
              "id": "UUID (Solo para update/delete)"
          }, 
          "message": "Confirmación..."
      }

      B) PREGUNTAS:
      {
          "type": "QUESTION",
          "message": "¿Pregunta?"
      }

      C) CHAT / CONSULTA:
      {
          "type": "CHAT",
          "message": "Respuesta..."
      }
      
      D) NAVEGACIÓN:
      {
          "type": "NAVIGATE",
          "payload": "/tasks",
          "message": "Vamos."
      }
      `;

      // Preparamos historial simple
      const apiMessages = [
          { role: 'system', content: systemPrompt },
          ...contextHistory.slice(-10).map(m => ({ role: m.role, content: m.content })),
          { role: 'user', content: userInput }
      ];

      const responseText = await fetchOpenAI(apiMessages, true);
      
      if (!responseText) {
          return { type: "CHAT", message: "Error conectando con la IA." };
      }

      try {
          return JSON.parse(responseText);
      } catch (e) {
          console.error("Error parsing JSON from AI", e);
          return { type: "CHAT", message: responseText };
      }
  }
};
