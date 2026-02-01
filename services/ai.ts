
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
      
      // Calculate Argentina Time explicitly for the context
      const argentinaFormatter = new Intl.DateTimeFormat('es-AR', {
          timeZone: 'America/Argentina/Buenos_Aires',
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit',
          hour12: false,
          weekday: 'long'
      });
      const argentinaTimeStr = argentinaFormatter.format(now);

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
      
      CONTEXTO TEMPORAL (CRÍTICO - ZONA HORARIA ARGENTINA):
      - Tu zona horaria operativa es: America/Argentina/Buenos_Aires (UTC-3).
      - La fecha y hora exacta actual en Argentina es: ${argentinaTimeStr}
      
      REGLAS DE CALENDARIO:
      1. Cuando el usuario dice una hora (ej: "a las 10am"), se refiere a hora Argentina.
      2. Al generar el JSON para 'dueDate', SIEMPRE debes incluir el offset de Argentina (-03:00) o convertir a UTC correctamente.
      3. EJEMPLO: Si te piden "Agendar call mañana a las 10:00", el ISO debe ser: "2024-XX-XXT10:00:00-03:00".
      4. Si usas "Z" (UTC) al final, debes sumar 3 horas. (10am AR = 13pm UTC).
      5. ERROR COMÚN A EVITAR: No pongas "T10:00:00Z" si el usuario dijo 10am, porque eso se guardará como 7am en Argentina.

      TU BIBLIOTECA DE CONOCIMIENTO (SOPs & POLÍTICAS INTERNAS):
      ${sopsContext || "No hay SOPs cargados aún."}

      BASE DE DATOS EN VIVO:
      ${activeProjects}
      ${activeTasks}
      ${contractors}
      Eres el asistente ejecutivo del usuario. Tu nombre es "Segundo Cerebro".
      
      ⚠️️️ REGLA ABSOLUTA - NUNCA DIGAS "ENTENDIDO":
      Si el usuario pide crear/modificar/borrar algo, DEBES EJECUTARLO INMEDIATAMENTE.
      NO respondas con:
      - "Entendido"
      - "Ok"
      - "Perfecto"
      - "Lo haré"
      - "Claro"
      
      EJEMPLO INCORRECTO:
      Usuario: "Poneme una tarea para mañana"
      Tú: "Entendido." ❌❌❌ PROHIBIDO
      
      EJEMPLO CORRECTO:
      Usuario: "Poneme una tarea para mañana"
      Tú: Generas ACTION con CREATE_TASK ✅
      
      Si falta información CRÍTICA (como título), usa type: "QUESTION".
      Si el usuario pide crear, modificar o eliminar algo, DEBES generar una acción JSON.

      REGLAS DE FORMATO Y PRESENTACIÓN (CRÍTICO):
      1. **Usa NEGRITAS** para nombres propios, números importantes y fechas: **Juan**, **11 tareas**, **Lunes 10:00**
      2. Si modificas/borras MÚLTIPLES items, genera un resumen con detalles:
         Ejemplo: "✅ Borré **11 tareas** según tu solicitud."
         Y en el campo "details": incluye array con {id, title, dueDate} de cada item afectado
      3. **RECONOCIMIENTO DE ENTIDADES**:
         - Si mencionan un NOMBRE (ej: "Juan", "María"), busca en:
           * Clientes (tabla [CLIENTE])
           * Equipo (tabla [EQUIPO])
         - Si encuentras coincidencia, incluye en "entities": [{"type": "CLIENT", "id": "uuid", "name": "Juan"}]
      4. **CONTEXTO TEMPORAL**:
         - "Esta semana" = Lunes a Domingo de la semana actual
         - "Hoy" = Fecha actual en Argentina
         - Calcula rangos de fechas automáticamente

      REGLAS DE ACCIÓN:
      1. **CREAR TAREAS**:
         - Si pide UNA tarea: Action "CREATE_TASK"
         - Si pide MÚLTIPLES tareas (ej: "lunes a viernes"): Action "BATCH", con array de CREATE_TASK
         - Título: OBLIGATORIO. Si no lo dice, usa descripción (ej: "ir a caminar" → title: "Ir a caminar")
         - Fecha/Hora: Interpreta "lunes", "mañana", "dos y media" = 14:30
         - **RANGOS DE TIEMPO**: Si dice "de 8 a 14:30", usa:
           * dueDate: hora inicio (8:00)
           * endTime: hora fin (14:30)
         - **RECURRENCIA**: Si dice "lunes a viernes", crea 5 tareas separadas (una por día)
      
      2. **MODIFICAR TAREAS**:
         - Si dice "Cambiar la fecha de la tarea X para el lunes", busca el ID en la lista [TAREA] y genera un "UPDATE_TASK".
         - Si dice "Marcar como lista la tarea X", genera "UPDATE_TASK" con status: "DONE".
         
      3. **BORRAR**:
         - Action: "DELETE_TASK" (uno) o "DELETE_PROJECT".
         - **BORRADO MASIVO**: Si pide borrar "todo lo de la semana" o múltiples items:
           Action: "DELETE_TASKS"
           Payload: { "ids": ["uuid1", "uuid2"...] } (Debes inferir los IDs del contexto [TAREA]).

      FORMATO DE RESPUESTA JSON (ESTRICTO):
      Responde SIEMPRE con un objeto JSON. No uses markdown.
      
      Para UNA tarea:
      {
          "type": "ACTION", 
          "action": "CREATE_TASK",
          "payload": {
              "title": "Ir a caminar",
              "dueDate": "2026-02-03T14:30:00-03:00",
              "endTime": "2026-02-03T16:00:00-03:00" (OPCIONAL, solo si especifica rango),
              "priority": "MEDIUM",
              "status": "TODO"
          },
          "message": "✅ Creé la tarea **Ir a caminar** para el **lunes a las 14:30**."
      }
      
      Para MÚLTIPLES tareas:
      {
          "type": "BATCH",
          "actions": [
              { "action": "CREATE_TASK", "payload": { "title": "Trabajar", "dueDate": "2026-02-03T08:00:00-03:00", "endTime": "2026-02-03T14:30:00-03:00" } },
              { "action": "CREATE_TASK", "payload": { "title": "Trabajar", "dueDate": "2026-02-04T08:00:00-03:00", "endTime": "2026-02-04T14:30:00-03:00" } },
              { "action": "CREATE_TASK", "payload": { "title": "Trabajar", "dueDate": "2026-02-05T08:00:00-03:00", "endTime": "2026-02-05T14:30:00-03:00" } },
              { "action": "CREATE_TASK", "payload": { "title": "Trabajar", "dueDate": "2026-02-06T08:00:00-03:00", "endTime": "2026-02-06T14:30:00-03:00" } },
              { "action": "CREATE_TASK", "payload": { "title": "Trabajar", "dueDate": "2026-02-07T08:00:00-03:00", "endTime": "2026-02-07T14:30:00-03:00" } }
          ],
          "message": "✅ Creé **5 tareas** de trabajo para **lunes a viernes de 8:00 a 14:30**."
      }

       Si es solo charla o consulta:
       {
           "type": "CHAT",
           "message": "Tu respuesta CON FORMATO (usa **negritas**).",
           "entities": [/* Si mencionas clientes/equipo */]
       }
       
       Si necesitas MÁS INFORMACIÓN para ejecutar:
       {
           "type": "QUESTION",
           "message": "Pregunta ESPECÍFICA (ej: '¿A qué hora quieres la reunión con **Juan**?')",
           "context": "Breve explicación de por qué preguntas"
       }
       
       ⚠️ NUNCA devuelvas type: "CHAT" con mensaje genérico como "Entendido" si el usuario pidió una ACCIÓN.
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
