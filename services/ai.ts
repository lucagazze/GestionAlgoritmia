
import { GoogleGenAI } from "@google/genai";
import { db } from './db';

// Using Gemini 3 Flash Preview as per guidelines for basic/complex text tasks
const MODEL_NAME = 'gemini-3-flash-preview';
const EMBEDDING_MODEL = 'text-embedding-004'; // For vector embeddings (RAG)

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
   * Generate vector embedding for text (RAG)
   */
  embed: async (text: string): Promise<number[] | null> => {
      try {
          const client = await getClient();
          const response = await client.models.embedContent({
              model: EMBEDDING_MODEL,
              contents: text
          });
          // Return the vector array
          return response.embeddings?.[0]?.values || null;
      } catch (error) {
          console.error("Embedding Error:", error);
          return null;
      }
  },

  agent: async (
      userInput: string | { mimeType: string; data: string },
      contextHistory: any[] = [],
      currentData: any
  ): Promise<any> => {
      const { tasks = [], projects = [], services = [], contractors = [] } = currentData;

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

      // --- RAG: RETRIEVE RELEVANT MEMORIES ---
      let relevantContext = "";
      
      if (typeof userInput === 'string') {
          try {
              const vector = await ai.embed(userInput);
              if (vector) {
                  const memories = await db.documents.search(vector);
                  
                  if (memories.length > 0) {
                      relevantContext = memories.map((m: any) => 
                          `[MEMORIA - ${m.metadata?.type || 'INFO'}]: ${m.content}`
                      ).join('\n\n');
                      console.log(`🧠 Found ${memories.length} relevant memories`);
                  }
              }
          } catch (e) {
              console.error("RAG search failed:", e);
          }
      }

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

      FECHA/HORA ACTUAL (Argentina): ${argentinaTimeStr}
      
      BASE DE DATOS EN VIVO:
      ${activeProjects}
      ${activeTasks}
      ${contractors}
      
      MEMORIA A LARGO PLAZO (RAG):
      ${relevantContext || "No hay memoria histórica relevante para esta consulta."}
      
      MANUALES Y SOPs:
      ${sopsContext || "No hay SOPs disponibles."}
      
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

      🔄 REACT LOOP - TAREAS COMPLEJAS MULTI-PASO:
      Si la solicitud requiere MÚLTIPLES PASOS o INFORMACIÓN que no tienes:
      
      1. USA type: "REASONING" para pensar y planificar
      2. Especifica el próximo paso en "nextAction"
      3. El sistema ejecutará la acción y te dará el resultado
      4. Continúa con el siguiente paso
      
      EJEMPLO - Tarea compleja:
      Usuario: "Busca los proyectos atrasados y mándales un mensaje"
      
      Iteración 1 - Tú respondes:
      {
        "type": "REASONING",
        "thought": "Primero necesito buscar proyectos con fecha de cobro vencida",
        "nextAction": {
          "action": "QUERY_DATABASE",
          "payload": {
            "table": "Project",
            "filter": { "overdue": true }
          }
        }
      }
      
      Sistema te responde: "Found 2 results: [Project A, Project B]"
      
      Iteración 2 - Tú respondes:
      {
        "type": "REASONING",
        "thought": "Encontré 2 proyectos. Ahora envío mensajes de recordatorio",
        "nextAction": {
          "action": "SEND_PORTAL_MESSAGE",
          "payload": {
            "projectId": "A",
            "message": "Recordatorio de pago"
          }
        }
      }
      
      ... y así hasta completar la tarea.
      
      Cuando termines TODAS las acciones, responde con type: "CHAT" y un resumen.
      
      ACCIONES DISPONIBLES:
      
      📋 TAREAS:
      - CREATE_TASK: Crear tarea (title, description, dueDate, priority, assigneeId, projectId)
      - UPDATE_TASK: Actualizar tarea (id, ...campos)
      - DELETE_TASK: Borrar tarea (id)
      - DELETE_TASKS: Borrar múltiples (ids: string[])
      
      📂 PROYECTOS:
      - CREATE_PROJECT: Crear proyecto (name, monthlyRevenue, industry)
      - UPDATE_PROJECT: Actualizar proyecto (id, ...campos)
      - DELETE_PROJECT: Borrar proyecto (id)
      
      💰 CRM & CLIENTES:
      - ADD_CLIENT_NOTE: Agregar nota (clientId, content, type: 'CALL'|'EMAIL'|'MEETING'|'OTHER')
      - UPDATE_CLIENT_HEALTH: Actualizar health score (clientId, healthScore: 'GOOD'|'RISK'|'CRITICAL')
      - GET_CLIENT_NOTES: Consultar notas (clientId, limit?)
      
      🤖 AUTOMATIZACIÓN:
      - CREATE_SOP: Crear manual (title, category, content)
      - GET_SOPS: Consultar manuales (category?)
      
      🧭 NAVEGACIÓN:
      - NAVIGATE_TO: Ir a página (path: '/tasks'|'/projects'|'/settings'|'/analytics')
      - OPEN_PROJECT: Abrir proyecto (projectId)
      - OPEN_TASK: Mostrar tarea (taskId)
      
      🔄 REACT LOOP (para tareas complejas):
      - QUERY_DATABASE: Buscar datos (table, filter, limit)
      - SEND_PORTAL_MESSAGE: Enviar mensaje a cliente

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
      
      
      EJEMPLO REAL - SOLICITUD COMPLEJA:
      Usuario: "Poneme una tarea para el lunes a las dos y media ir a caminar. Y poneme también para entre las ocho a las dos y media de toda la semana de lunes a viernes trabajar."
      
      Análisis:
      - "lunes a las dos y media ir a caminar" = 1 tarea (Lunes 14:30)
      - "entre las ocho a las dos y media" = rango 8:00-14:30
      - "toda la semana de lunes a viernes trabajar" = 5 tareas (Lun-Vie)
      
      Respuesta CORRECTA:
      {
          "type": "BATCH",
          "actions": [
              { "action": "CREATE_TASK", "payload": { "title": "Ir a caminar", "dueDate": "2026-02-03T14:30:00-03:00" } },
              { "action": "CREATE_TASK", "payload": { "title": "Trabajar", "dueDate": "2026-02-03T08:00:00-03:00", "endTime": "2026-02-03T14:30:00-03:00" } },
              { "action": "CREATE_TASK", "payload": { "title": "Trabajar", "dueDate": "2026-02-04T08:00:00-03:00", "endTime": "2026-02-04T14:30:00-03:00" } },
              { "action": "CREATE_TASK", "payload": { "title": "Trabajar", "dueDate": "2026-02-05T08:00:00-03:00", "endTime": "2026-02-05T14:30:00-03:00" } },
              { "action": "CREATE_TASK", "payload": { "title": "Trabajar", "dueDate": "2026-02-06T08:00:00-03:00", "endTime": "2026-02-06T14:30:00-03:00" } },
              { "action": "CREATE_TASK", "payload": { "title": "Trabajar", "dueDate": "2026-02-07T08:00:00-03:00", "endTime": "2026-02-07T14:30:00-03:00" } }
          ],
          "message": "✅ Creé **6 tareas**: 1 para **ir a caminar** (Lunes 14:30) y 5 de **trabajo** (Lun-Vie 8:00-14:30)."
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
