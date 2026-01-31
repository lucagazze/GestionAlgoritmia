
import { GoogleGenAI } from "@google/genai";
import { db } from './db';

// We use Gemini 2.5 Flash Preview for its speed, low cost, and native audio capabilities.
const MODEL_NAME = 'gemini-2.5-flash-preview';

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
   * General Chat function
   */
  chat: async (messages: any[]) => {
      try {
          const client = await getClient();
          
          // Adapt simple message format to Gemini format
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
              config: {
                  systemInstruction: systemInstruction
              }
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
   * The Agency OS Agent - Handles Text AND Audio inputs
   */
  agent: async (
      userInput: string | { mimeType: string, data: string }, // Can be text or Audio Base64
      contextHistory: any[] = [], 
      currentData: any
  ) => {
      const now = new Date();
      const localDate = now.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
      const localTime = now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
      
      // Prepare context data for the prompt
      const activeTasks = currentData.tasks
          .filter((t: any) => t.status !== 'DONE')
          .slice(0, 40)
          .map((t: any) => `ID:${t.id} | "${t.title}" | Due:${t.dueDate?.slice(0,10) || 'N/A'}`)
          .join('\n');

      const activeProjects = currentData.projects
          .map((p: any) => `ID:${p.id} | "${p.name}" | Status:${p.status}`)
          .join('\n');
          
      const systemInstruction = `
      Eres "Algoritmia OS", el cerebro operativo de la agencia.
      FECHA ACTUAL: ${localDate} | HORA: ${localTime}.

      OBJETIVO:
      Interpreta la intención del usuario (que puede venir en AUDIO o TEXTO) y genera acciones estructuradas.
      
      REGLAS DE ORO:
      1. **AUDIO NATIVO:** Estás escuchando al usuario. Si duda, se corrige o habla coloquialmente, interpreta su intención final. No transcribas, ACTÚA.
      2. **FECHAS:** Si dice "mañana", calcula la fecha basándote en que hoy es ${localDate}. Si dice "el viernes", es el próximo viernes.
      3. **CONTEXTO:** Usa la lista de Tareas y Proyectos para entender referencias (ej: "Llama a Juan" -> buscar si hay un proyecto con contacto Juan).

      BASE DE DATOS ACTUAL:
      [PROYECTOS ACTIVOS]
      ${activeProjects}

      [TAREAS PENDIENTES]
      ${activeTasks}

      FORMATO DE RESPUESTA (JSON ÚNICAMENTE):
      
      Si es una ACCIÓN (Crear/Editar):
      {
          "type": "ACTION", 
          "action": "CREATE_TASK" | "UPDATE_TASK" | "CREATE_PROJECT" | "UPDATE_PROJECT" | "DELETE_TASK",
          "payload": { ... }, 
          "message": "Breve confirmación hablada (ej: 'Listo, agendado para el viernes')."
      }
      * Nota: Para CREATE_TASK, "dueDate" debe ser ISO string (YYYY-MM-DDTHH:mm:ss).

      Si son MÚLTIPLES acciones:
      {
          "type": "BATCH",
          "actions": [ { "action": "...", "payload": "..." } ],
          "message": "Resumen de lo hecho."
      }

      Si necesitas DECIDIR (Ambigüedad):
      {
          "type": "DECISION",
          "message": "¿Te refieres al proyecto X o Y?",
          "options": [ { "label": "Opción A", "action": "...", "payload": ... } ]
      }
      
      Si es solo CHARLA:
      { "type": "CHAT", "message": "Respuesta útil y conversacional..." }
      `;

      try {
          const client = await getClient();
          
          // Construct the user message part
          let userPart;
          if (typeof userInput === 'string') {
              userPart = { text: userInput };
          } else {
              // Audio Input - Gemini Flash supports audio directly via inlineData
              userPart = { inlineData: { mimeType: userInput.mimeType, data: userInput.data } };
          }

          // Build history for context (last 6 messages to save context window)
          const historyParts = contextHistory.slice(-6).map(m => {
              return {
                  role: m.role === 'assistant' ? 'model' : 'user',
                  parts: [{ text: typeof m.content === 'string' ? m.content : '[Interacción Compleja]' }]
              };
          });

          const response = await client.models.generateContent({
              model: MODEL_NAME,
              contents: [
                  ...historyParts,
                  { role: 'user', parts: [userPart] }
              ],
              config: {
                  systemInstruction: systemInstruction,
                  responseMimeType: "application/json", // Force JSON output for reliability
                  temperature: 0.3 // Lower temperature for more deterministic actions
              }
          });

          const responseText = response.text;
          if (!responseText) return { type: "CHAT", message: "No entendí, ¿puedes repetir?" };

          return JSON.parse(responseText);

      } catch (error) {
          console.error("Agent Error:", error);
          return { type: "CHAT", message: "Tuve un problema procesando eso. Intenta de nuevo." };
      }
  }
};
