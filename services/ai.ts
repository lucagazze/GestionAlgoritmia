

import { GoogleGenAI } from "@google/genai";
import { db } from './db';

// Usamos la versión estable de Gemini 2.0 Flash que es rápida y multimodal.
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
  ) => {
      const now = new Date();
      const localDate = now.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
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
          .map((t: any) => `[TAREA] ID:${t.id} | Título:${t.title} | Vence:${t.dueDate?.slice(0,10) || 'Sin fecha'}`)
          .join('\n');

      const activeProjects = currentData.projects
          .map((p: any) => `[CLIENTE] ID:${p.id} | Nombre:${p.name} | Fee:$${p.monthlyRevenue} | DíaCobro:${p.billingDay} | Estado:${p.status}`)
          .join('\n');
      
      const contractors = currentData.contractors
          .map((c: any) => `[EQUIPO] ID:${c.id} | Nombre:${c.name} | Rol:${c.role} | Costo:$${c.monthlyRate}`)
          .join('\n');

      const systemInstruction = `
      Eres "Algoritmia OS", el MAESTRO y CEO Operativo de esta agencia. Tienes control total sobre la base de datos.
      
      DATOS TEMPORALES:
      - Hoy es: ${localDate}
      - Hora: ${localTime}

      TU BIBLIOTECA DE CONOCIMIENTO (SOPs & POLÍTICAS INTERNAS):
      Usa esta información para responder preguntas sobre "cómo hacemos las cosas aquí".
      ${sopsContext || "No hay SOPs cargados aún."}

      BASE DE DATOS EN VIVO:
      ${activeProjects}
      ${activeTasks}
      ${contractors}

      TU MISIÓN:
      Escuchar, Pensar y EJECUTAR. No preguntes "qué hago", hazlo.
      Si te pregunto "¿Cómo se hace X?", consulta los SOPs arriba y responde citando el manual.

      REGLAS DE INTERPRETACIÓN:
      1. **AGENDAR/TAREAS**: Si pide agendar, crear recordatorio o tarea.
         - Título: OBLIGATORIO. Si no lo dice, invéntalo basado en el contexto.
         - Fecha: Calcula "mañana", "el viernes" basado en hoy.
      2. **AUDITORÍA**: Si pregunta "¿Cómo vamos?", revisa los clientes activos.
      3. **SOP/CONSULTA**: Si pregunto sobre un proceso, busca en la sección "TU BIBLIOTECA DE CONOCIMIENTO".

      FORMATO DE RESPUESTA JSON (ESTRICTO):
      {
          "type": "ACTION" | "BATCH" | "CHAT" | "DECISION",
          "action": "CREATE_TASK" | "UPDATE_TASK" | "DELETE_TASK" | "CREATE_PROJECT" | "UPDATE_PROJECT" | "CREATE_CONTRACTOR",
          "payload": { ...campos según acción... },
          "message": "Texto que dirás al usuario."
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

          const response = await client.models.generateContent({
              model: MODEL_NAME,
              contents: [
                  ...historyParts,
                  { role: 'user', parts: [userPart] }
              ],
              config: {
                  systemInstruction: systemInstruction,
                  responseMimeType: "application/json",
                  temperature: 0.1 
              }
          });

          const responseText = response.text;
          if (!responseText) return { type: "CHAT", message: "No procesé la orden, intenta ser más claro." };
          return JSON.parse(responseText);

      } catch (error) {
          console.error("Agent Error:", error);
          return { type: "CHAT", message: "Error interno del Agente. Revisa la consola." };
      }
  }
};