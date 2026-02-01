import { GoogleGenAI } from "@google/genai";
import { db } from './db';

// Using Gemini 3 Flash Preview as per guidelines for basic/complex text tasks
const MODEL_NAME = 'gemini-3-flash-preview';

// Helper to get an initialized client dynamically
const getClient = async () => {
    // 1. Try to get from Supabase
    const dbKey = await db.settings.getApiKey('google_api_key');
    // 2. Fallback to env var
    const apiKey = dbKey || process.env.API_KEY; 
    
    if (!apiKey) {
        throw new Error("No Google API Key found. Please add it in Settings.");
    }
    return new GoogleGenAI({ apiKey });
};

export const ai = {
  /**
   * Transcribe Audio only (Speech to Text)
   */
  transcribe: async (audioData: { mimeType: string, data: string }) => {
      try {
          const client = await getClient();
          const response = await client.models.generateContent({
              model: MODEL_NAME,
              contents: [{
                  role: 'user',
                  parts: [
                      { inlineData: audioData },
                      { text: "Transcribe el siguiente audio textualmente. Solo devuelve el texto plano, sin formatos, sin markdown, y sin responder a la pregunta. Solo lo que se escucha." }
                  ]
              }]
          });
          return response.text;
      } catch (error) {
          console.error("Transcription Error:", error);
          return null;
      }
  },

  /**
   * General Chat function
   */
  chat: async (messages: any[]) => {
      try {
          const client = await getClient();
          
          let systemInstruction = undefined;
          let contents = messages.map(m => {
              if (m.role === 'system') {
                  systemInstruction = m.content;
                  return null;
              }
              return {
                  role: m.role === 'assistant' ? 'model' : 'user',
                  parts: [{ text: m.content }]
              };
          }).filter(Boolean) as any[];

          const response = await client.models.generateContent({
              model: MODEL_NAME,
              contents: contents,
              config: { systemInstruction }
          });

          return response.text || "No pude generar una respuesta.";
      } catch (error) {
          console.error("AI Chat Error:", error);
          return "Error: Verifica tu API Key en Ajustes.";
      }
  },

  /**
   * Sales Coach specific function
   */
  salesCoach: async (mode: 'SCRIPT' | 'ANALYSIS' | 'ROLEPLAY', inputData: any) => {
      const prompt = `Actúa como un Director Comercial de Agencia High-Ticket. 
      Modo: ${mode}. 
      Datos: ${JSON.stringify(inputData)}. 
      Sé directo, persuasivo y utiliza marcos de venta como SPIN o Sandler.`;

      try {
          const client = await getClient();
          const response = await client.models.generateContent({
              model: MODEL_NAME,
              contents: [{ role: 'user', parts: [{ text: prompt }] }]
          });
          return response.text;
      } catch (error) {
          console.error("Sales Coach Error:", error);
          return null;
      }
  },

  /**
   * THE MASTER AGENT - Agency OS Brain (Enhanced with RAG)
   */
  agent: async (
      userInput: string | { mimeType: string, data: string }, 
      contextHistory: any[] = [], 
      currentData: any
  ): Promise<any> => {
      const now = new Date();
      // Provide full ISO string for accurate calculation
      const isoNow = now.toISOString();
      const localDate = now.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      const localTime = now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

      // --- RAG: FETCH SOPs ---
      let sopsContext = "";
      try {
          const sops = await db.sops.getAll();
          if (sops.length > 0) {
              sopsContext = sops.map(s => `[MANUAL: ${s.category}] "${s.title}":\n${s.content.slice(0, 500)}...`).join('\n\n');
          }
      } catch (e) { console.error("Failed to fetch SOPs for RAG", e); }

      // Preparar contexto digerible para la IA
      const activeTasks = currentData.tasks
          .filter((t: any) => t.status !== 'DONE')
          .slice(0, 50)
          .map((t: any) => `[TAREA] ID:${t.id} | Título:"${t.title}" | Vence:${t.dueDate || 'Sin fecha'}`)
          .join('\n');

      const activeProjects = currentData.projects
          .map((p: any) => `[CLIENTE] ID:${p.id} | Nombre:"${p.name}" | Fee:$${p.monthlyRevenue} | DíaCobro:${p.billingDay} | Estado:${p.status}`)
          .join('\n');
      
      const contractors = currentData.contractors
          .map((c: any) => `[EQUIPO] ID:${c.id} | Nombre:"${c.name}" | Rol:${c.role} | Costo:$${c.monthlyRate}`)
          .join('\n');

      const systemInstruction = `
      Eres "Algoritmia OS", el MAESTRO y CEO Operativo de esta agencia. Tienes control total sobre la base de datos.
      
      DATOS TEMPORALES (CRÍTICO):
      - Fecha/Hora ISO Actual: ${isoNow}
      - Formato Humano: ${localDate}, ${localTime}
      - IMPORTANTE: Cuando calcules fechas relativas (mañana, el viernes), usa la fecha ISO actual como base exacta.

      TU BIBLIOTECA DE CONOCIMIENTO (SOPs & POLÍTICAS INTERNAS):
      ${sopsContext || "No hay SOPs cargados aún."}

      BASE DE DATOS EN VIVO:
      ${activeProjects}
      ${activeTasks}
      ${contractors}

      TU MISIÓN:
      Escuchar, Pensar y EJECUTAR acciones. 
      Si el usuario pide crear, modificar o eliminar algo, DEBES generar una acción JSON.

      REGLAS DE ACCIÓN:
      1. **AGENDAR/CREAR TAREAS**:
         - Si dice "Agendar reunión mañana a las 10am", calcula la fecha ISO exacta (YYYY-MM-DDTHH:MM:SS) sumando días a la fecha actual.
         - Título: OBLIGATORIO. Si no lo dice, invéntalo basado en el contexto.
         - Action: "CREATE_TASK"
      
      2. **MODIFICAR TAREAS**:
         - Si dice "Cambiar la fecha de la tarea X para el lunes", busca el ID en la lista [TAREA] y genera un "UPDATE_TASK".
         - Si dice "Marcar como lista la tarea X", genera "UPDATE_TASK" con status: "DONE".
         
      3. **BORRAR**:
         - Action: "DELETE_TASK" o "DELETE_PROJECT" con el ID correspondiente.

      FORMATO DE RESPUESTA JSON (ESTRICTO):
      Responde SIEMPRE con un objeto JSON. No uses markdown.
      {
          "type": "ACTION", 
          "action": "CREATE_TASK" | "UPDATE_TASK" | "DELETE_TASK" | "CREATE_PROJECT" | "UPDATE_PROJECT",
          "payload": {
              "id": "uuid (solo para update/delete)",
              "title": "Titulo Tarea",
              "dueDate": "ISO_DATE_STRING (Crucial para agenda)",
              "priority": "HIGH" | "MEDIUM" | "LOW",
              "status": "TODO" | "DONE"
          },
          "message": "Texto breve confirmando lo que hiciste (ej: 'Agendado para mañana a las 10:00')."
      }

      Si es solo charla o consulta:
      {
          "type": "CHAT",
          "message": "Respuesta conversacional..."
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

          const historyParts = contextHistory.slice(-4).map(m => {
              return {
                  role: m.role === 'assistant' ? 'model' : 'user',
                  parts: [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }]
              };
          });

          // Add user input to history parts for the call
          historyParts.push({
              role: 'user',
              parts: [userPart]
          });

          const response = await client.models.generateContent({
              model: MODEL_NAME,
              contents: historyParts,
              config: { systemInstruction, responseMimeType: 'application/json' }
          });
          
          const textResponse = response.text;
          if (!textResponse) return null;
          
          try {
              return JSON.parse(textResponse);
          } catch (e) {
              console.error("JSON Parse Error in Agent", e);
              return { type: 'CHAT', message: textResponse };
          }
      } catch (error) {
          console.error("AI Agent Error:", error);
          return null;
      }
  }
};