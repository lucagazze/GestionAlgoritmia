
import { GoogleGenAI } from "@google/genai";
import { db } from './db';

// 'gemini-2.0-flash-exp' has been deprecated/removed.
// Switching to 'gemini-2.0-flash' (Stable) which fully supports Multimodal inputs (Audio/Video).
const MODEL_NAME = 'gemini-2.0-flash';

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
      const isoDate = now.toISOString();

      // Prepare context data for the prompt
      const activeTasks = currentData.tasks
          .filter((t: any) => t.status !== 'DONE')
          .slice(0, 40)
          .map((t: any) => `ID:${t.id} | "${t.title}" | Due:${t.dueDate?.slice(0,10) || 'N/A'}`)
          .join('\n');

      const activeProjects = currentData.projects
          .map((p: any) => `ID:${p.id} | "${p.name}" | Status:${p.status}`)
          .join('\n');
      
      const contractors = currentData.contractors
          .map((c: any) => `ID:${c.id} | "${c.name}" | Role:${c.role}`)
          .join('\n');

      const systemInstruction = `
      Eres "Algoritmia OS", el CEO Operativo (IA) de la agencia. Tienes control total.
      DATOS REALES DE HOY:
      - Fecha: ${localDate}
      - Hora: ${localTime}
      - ISO Date (Para cálculos): ${isoDate}

      TU MISIÓN:
      Escuchar al usuario, interpretar su intención y EJECUTAR acciones en la base de datos mediante JSON estructurado.
      Si el usuario dice "Agendar reunión mañana", TU DEBES calcular la fecha exacta de mañana y crear la tarea.

      BASE DE DATOS ACTUAL (CONTEXTO):
      [PROYECTOS]
      ${activeProjects}
      [TAREAS PENDIENTES]
      ${activeTasks}
      [EQUIPO]
      ${contractors}

      --- REGLAS DE RESPUESTA (IMPORTANTE) ---
      Devuelve SOLO un JSON válido. Sin markdown, sin explicaciones previas.

      1. ACCIÓN: CREAR TAREA
      Si el usuario quiere agendar, recordar o hacer algo.
      {
          "type": "ACTION",
          "action": "CREATE_TASK",
          "payload": {
              "title": "Título CORTO y claro de la acción",
              "description": "Detalles adicionales si los hay",
              "priority": "HIGH" | "MEDIUM" | "LOW",
              "dueDate": "YYYY-MM-DDTHH:mm:ss" (Calcula la fecha futura basada en 'hoy')
          },
          "message": "Confirmación hablada (ej: 'Listo, agendado para mañana a las 10')."
      }
      * IMPORTANTE: 'title' es OBLIGATORIO. Si no es obvio, invéntalo basado en la descripción.

      2. ACCIÓN: CREAR CLIENTE / PROYECTO
      {
          "type": "ACTION",
          "action": "CREATE_PROJECT",
          "payload": {
              "name": "Nombre Empresa",
              "industry": "Rubro (opcional)"
          },
          "message": "Confirmación."
      }

      3. ACCIÓN: MODIFICAR / COMPLETAR
      Si el usuario dice "Ya hice la tarea X" o "Cambia la fecha".
      {
          "type": "ACTION",
          "action": "UPDATE_TASK",
          "payload": { "id": "UUID_EXACTO_DE_LA_LISTA", "status": "DONE" },
          "message": "Tarea completada."
      }

      4. RESPUESTA SIMPLE (CHAT)
      { "type": "CHAT", "message": "Tu respuesta..." }

      5. DECISIÓN (AMBIGÜEDAD)
      { "type": "DECISION", "message": "¿A cuál te refieres?", "options": [...] }
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
                  temperature: 0.1 // VERY LOW temperature for strict JSON adherence
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
