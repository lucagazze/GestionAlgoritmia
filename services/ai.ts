
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
                      { text: "Transcribe exactamente lo que se dice en este audio. Devuelve SOLO el texto transcrito, sin introducción, sin explicación, sin formato. Solo el texto que se escucha." }
                  ]
              }]
          });
          
          // Clean up response - remove markdown formatting and AI commentary
          let text = response.text || '';
          
          // Remove common AI prefixes/suffixes
          text = text.replace(/^(claro,?\s*)?aquí\s+(tienes|está)\s+(la\s+)?transcripción(\s+del\s+audio)?:?\s*/i, '');
          text = text.replace(/^(la\s+)?transcripción\s+(es|dice):?\s*/i, '');
          text = text.replace(/^["'`]+|["'`]+$/g, ''); // Remove quotes/backticks at start/end
          text = text.replace(/^\*+|\*+$/g, ''); // Remove asterisks at start/end
          text = text.trim();
          
          return text;
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

  /**
   * Genera un análisis Post-Mortem de un proyecto cerrado para la Base de Conocimiento
   */
  summarizeProject: async (projectData: any, notes: any[], tasks: any[]) => {
      try {
          const client = await getClient();
          const prompt = `
            Actúa como un Consultor de Operaciones Senior. Analiza este proyecto finalizado de la agencia y genera un "Resumen de Aprendizaje" conciso para nuestra base de conocimiento.
            
            DATOS DEL PROYECTO:
            - Cliente: ${projectData.name} (${projectData.industry})
            - Revenue: $${projectData.monthlyRevenue}
            - Duración: ${projectData.createdAt} a HOY
            
            HISTORIAL:
            - Notas clave: ${notes.map(n => n.content).join(' | ').slice(0, 1000)}
            - Tareas completadas: ${tasks.filter(t => t.status === 'DONE').map(t => t.title).join(', ').slice(0, 1000)}

            SALIDA REQUERIDA (Texto plano, sin markdown excesivo):
            Genera un párrafo denso que explique:
            1. Qué hicimos (el servicio).
            2. Qué desafío tenía el cliente.
            3. Cómo lo resolvimos (estrategia).
            4. Lecciones aprendidas o datos clave para futuros proyectos similares.
          `;

          const response = await client.models.generateContent({
              model: MODEL_NAME,
              contents: [{ role: 'user', parts: [{ text: prompt }] }]
          });

          return response.text || null;
      } catch (error) {
          console.error("Project Summary Error:", error);
          return null;
      }
  },

  /**
   * RAG Helper: Encuentra contexto relevante
   */
  retrieveContext: async (query: string) => {
      try {
          // 1. Convertimos la consulta del usuario a Vector
          const vector = await ai.embed(query);
          if (!vector) return "";

          // 2. Buscamos en la DB (requiere que db.documents.search esté implementado como vimos antes)
          // Importamos db dinámicamente para evitar ciclos si es necesario, o úsala directo si no da error.
          const { db } = await import('./db'); 
          const memories = await db.documents.search(vector, 0.6, 3); // Umbral 0.6, top 3 resultados

          if (!memories || memories.length === 0) return "";

          return memories.map((m: any) => `[CASO SIMILAR/MEMORIA]: ${m.content}`).join('\n\n');
      } catch (error) {
          console.error("RAG Retrieval Error:", error);
          return "";
      }
  },

  /**
   * Sales Coach Agent
   */
  salesCoach: async (mode: 'SCRIPT' | 'ANALYSIS', payload: any) => {
      try {
          const client = await getClient();
          let prompt = "";

          if (mode === 'SCRIPT') {
              prompt = `
              ACTÚA COMO: Un Director Comercial de Elite y Copywriter Persuasivo (Estilo Alex Hormozi / Russell Brunson).
              
              OBJETIVO: Generar un guión de ventas para "${payload.clientName}" (${payload.industry}).
              CONTEXTO: ${payload.context}
              META: ${payload.goal}
              
              INSTRUCCIONES:
              1. Escribe UN solo mensaje/guión listo para enviar.
              2. Usa un tono profesional pero directo y persuasivo.
              3. Si es un email, incluye "ASUNTO:".
              4. Enfócate en el VALOR para el cliente, no en lo que vendemos.
              `;
          } else {
              prompt = `
              ACTÚA COMO: Un Experto en Negociación y Psicología de Ventas (Chris Voss).
              
              OBJETIVO: Analizar esta interacción y decirme qué responder.
              CLIENTE: ${payload.clientName}
              ÚLTIMO MENSAJE: "${payload.lastMessage}"
              HISTORIAL: ${payload.history}
              
              TU TAREA:
              1. Analiza la psicología detrás de lo que dijo el cliente (¿Es objeción real? ¿Es duda? ¿Es táctica?).
              2. Dame los 'Bullet Points' de una respuesta ganadora.
              3. Escribe la respuesta exacta sugerida.
              `;
          }

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
   * Genera ideas o guiones específicos para Redes Sociales
   */
  generateContentScript: async (type: 'IDEA' | 'SCRIPT', data: any) => {
    try {
        const client = await getClient();
        let prompt = "";

        if (type === 'IDEA') {
            prompt = `
            ACTÚA COMO: Un Estratega de Contenidos Viral (MrBeast / Hormozi).
            OBJETIVO: Generar 3 ideas de contenido de alto impacto para "${data.platform}" sobre el tema "${data.topic}".
            CONTEXTO: ${data.context || 'Sin contexto adicional'}
            
            FORMATO REQUERIDO:
            1. Título Llamativo (Clickbait ético)
            2. Concepto Central (En 1 frase)
            3. Hook Visual (Qué se ve en los primeros 3 seg)
            `;
        } else {
            prompt = `
            ACTÚA COMO: Un Guionista de TikTok/Reels Experto en Retención.
            OBJETIVO: Escribir un guion palabra por palabra para un video de "${data.platform}".
            TÍTULO: "${data.title}"
            CONCEPTO: "${data.concept}"
            HOOK ACTUAL: "${data.hook || 'N/A'}"
            
            ESTRUCTURA OBLIGATORIA:
            1. HOOK (0-3s): La frase exacta para atrapar.
            2. RETENCION (3-15s): Desarrolla el problema/curiosidad.
            3. CUERPO (15-45s): La solución/historia rápida.
            4. CTA (45-60s): Llamado a la acción claro.
            
            FORMATO: Usa un tono conversacional, dinámico y directo. Separa por bloques visuales.
            `;
        }

        const response = await client.models.generateContent({
            model: MODEL_NAME,
            contents: [{ role: 'user', parts: [{ text: prompt }] }]
        });

        return response.text;
    } catch (error) {
        console.error("Content Gen Error:", error);
        return null;
    }
  },

  /**
   * Analiza un guion existente y extrae/completa la metadata faltante
   */
  analyzeScript: async (script: string) => {
      try {
          const client = await getClient();
          const prompt = `
          ACTÚA COMO: Un Editor de Contenidos Experto.
          OBJETIVO: Analizar el siguiente GUION y extraer sus metadatos clave para clasificarlo.
          
          GUION:
          """
          ${script}
          """
          
          TAREA:
          Deduce y genera los siguientes campos basados en el texto:
          1. title: Un título corto y pegadizo (5-7 palabras).
          2. concept: Una frase resumen de qué trata el video.
          3. hook: La primera frase o gancho (si no es obvio, genéralo).
          4. visuals: Sugerencias de B-Roll o estilo visual para este guion.
          5. platform: La plataforma más adecuada (Instagram, TikTok, YouTube, LinkedIn).
          6. contentType: 'POST' o 'AD' (Si parece venta directa).
          
          FORMATO JSON:
          {
            "title": "...",
            "concept": "...",
            "hook": "...",
            "visuals": "...",
            "platform": "...",
            "contentType": "..."
          }
          `;

          const response = await client.models.generateContent({
              model: MODEL_NAME,
              contents: [{ role: 'user', parts: [{ text: prompt }] }],
              config: { responseMimeType: 'application/json' }
          });

          const text = response.text;
          if (!text) return null;
          
          return JSON.parse(text);
      } catch (error) {
          console.error("Analyze Script Error:", error);
          return null;
      }
  },

  /**
   * Genera contexto estratégico del proyecto basado en Nombre, Industria y Descripción opcional
   */
  generateProjectContext: async (projectName: string, industry: string, description?: string) => {
      try {
          const client = await getClient();
          const prompt = `
            ACTÚA COMO: Un Estratega de Negocios Senior y Consultor de Crecimiento.
            OBJETIVO: Definir el contexto estratégico inicial para un nuevo cliente: "${projectName}" del rubro "${industry}".
            
            ${description ? `CONTEXTO ADICIONAL (INFORMACIÓN BRUTA DEL CLIENTE):
            "${description}"
            Usa esta información para ser MUCHO más preciso y específico en tu análisis.
            ` : ''}

            GENERA 4 BLOQUES DE TEXTO CONCISOS Y PROFESIONALES (Sin markdown, solo texto plano):
            
            1. PÚBLICO OBJETIVO: ¿Quién es su cliente ideal? (Buyer Persona).
            2. DOLORES (SITUACIÓN ACTUAL): ¿Qué problemas tienen sus clientes o qué desafíos enfrenta el negocio hoy?
            3. OBJETIVOS (PUNTO B): ¿Qué busca lograr este negocio al contratarnos? (Aumentar ventas, posicionamiento, etc).
            4. ESTRATEGIA (MACRO): ¿Cuál debería ser el enfoque general para crecer?
            
            FORMATO JSON (IMPORTANTE):
            Responde SOLO con un JSON válido con esta estructura:
            {
              "targetAudience": "...",
              "problem": "...",
              "objectives": "...",
              "strategy": "..."
            }
          `;

          const response = await client.models.generateContent({
              model: MODEL_NAME,
              contents: [{ role: 'user', parts: [{ text: prompt }] }],
               config: { responseMimeType: 'application/json' }
          });

          const text = response.text;
          if (!text) return null;
          
          return JSON.parse(text);
      } catch (error) {
          console.error("Context Gen Error:", error);
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
      
      const contractorsList = currentData.contractors
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
      
      IMPORTANTE - REGLAS DE EJECUCIÓN:
      1. NO uses etiquetas HTML como <details>, <summary> o bloques de pensamiento en tu respuesta final. Solo texto plano y natural.
      2. ACCIÓN INMEDIATA: Si el usuario pide crear, agendar, modificar o buscar algo, DEBES generar el JSON de la tool ("action_type") INMEDIATAMENTE.
      3. PROHIBIDO ALUCINAR: Nunca respondas "He creado la tarea" si no has emitido el JSON correspondiente. Primero ejecuta, luego confirma.
      4. Si la información es ambigua para una tarea (ej: falta la hora), PREGUNTA al usuario, no inventes ni confirmes falsamente.

      ⚠️️️ REGLA ABSOLUTA - NUNCA DIGAS "ENTENDIDO":
      Si el usuario pide crear/modificar/borrar algo, DEBES EJECUTARLO INMEDIATAMENTE.

      FORMATO DE RESPUESTA JSON (ESTRICTO):
      Responde SIEMPRE con un objeto JSON. No uses markdown.
      
      Para UNA tarea:
      {
          "type": "ACTION", 
          "action": "CREATE_TASK",
          "payload": {
              "title": "Ir a caminar",
              "dueDate": "2026-02-03T14:30:00-03:00",
              "priority": "MEDIUM",
              "status": "TODO"
          },
          "message": "✅ Creé la tarea **Ir a caminar** para el **lunes a las 14:30**."
      }

      Si es solo charla o consulta:
      {
          "type": "CHAT",
          "message": "Tu respuesta CON FORMATO (usa **negritas**).",
          "entities": []
      }
      
      Si necesitas MÁS INFORMACIÓN para ejecutar:
      {
          "type": "QUESTION",
          "message": "Pregunta ESPECÍFICA",
          "context": "Por qué preguntas"
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
  },

  /**
   * Fill a Marketing Proposal form from a free-form text description.
   * Returns structured JSON matching MarketingProposalData fields.
   */
  fillProposalWithAI: async (rawText: string): Promise<any> => {
      try {
          const client = await getClient();
          const prompt = `Sos un Director Estratégico de Marketing Digital y un Copywriter persuasivo (Estilo Alex Hormozi u Ogilvy). 
Un vendedor de tu agencia te acaba de pasar información suelta y desordenada (dictada o en notas) sobre un cliente potencial y lo que le van a ofrecer.

TU MISIÓN: Estructurar esa información, pero MÁS IMPORTANTE, PENSAR y REDACTAR mágicamente el contenido persuasivo que falta (público objetivo, dolores, objetivo de la propuesta, posicionamiento, textos de recomendación) para armar una propuesta comercial de altísimo estándar y que cierre ventas. Si el usuario te da un nicho y un servicio, vos debes deducir y redactar como un verdadero experto.

INFORMACIÓN BRUTA DEL USUARIO:
"""
${rawText}
"""

Devuelve ÚNICAMENTE un JSON válido con los siguientes campos. Para campos estratégicos que el usuario no mencionó, INVENTA Y REDACTA LA MEJOR ESTRATEGIA basándote en la industria de la que se hable:

{
  "clientName": (String extraído o nulo),
  "clientIndustry": (Deducido si no se da),
  "clientWebsite": (Extraído o nulo),
  "clientLocation": (Extraído, o propuesto genéricamente por la industria),
  "clientCompetitors": "...", (Deduce competidores comunes o el panorama de mercado),
  "clientDifferential": "...", (Inventa un diferencial atractivo enfocado a conversiones si no se da),
  "clientSocialPresence": (Extraído o nulo),
  "clientAvgTicket": (Extraído numérico o string numérico, o nulo),
  "clientMonthlySales": (Extraído o nulo),
  "proposalObjective": "...", (Un objetivo persuasivo y macro orientado a resultados de negocio),
  "targetRevenue": (String de ingresos proyectados, si aplica. Opcional),
  "timeframe": (Ej: "3 a 6 meses para validación y escalado de campaña"),
  "platforms": (Extrae o deduce Meta Ads, Google Ads, TikTok Ads según la lógica),
  "dailyAdBudget": (String o número de la inversión en pauta diaria/mensual mencionada. Ej: "USD 15 diarios"),
  "targetAudience": "...", (Describe psicológicamente y demográficamente al Buyer Persona),
  "painPoint": "...", (Describe un dolor profundo que tu servicio publicitario le va a solucionar),
  "positioning": "...", (El ángulo comercial a comunicar en los anuncios),
  "recommendationText": "...", (Redacta de forma persuasiva la recomendación final del plan sugerido al cliente. Ej: "Basado en nuestro análisis, sugerimos empezar con el Plan..."),
  "plans": (Solo si se mencionan servicios o precios, estructura en un Array de Objetos: [{"name": "Plan...", "price": 500, "includes": ["Setup de campañas", "Reporte"]}] o null si no hay info),
  "contractConditions": "...", (Condiciones estándares amigables si no las menciona)
}

REGLAS:
- PENSAMIENTO ESTRATÉGICO: Actúa como el experto. Llena los campos de texto con respuestas profesionales de copywriting que enamoren al cliente al leer su propuesta.
- FORMATO JSON ESTRICTO: Responde puramente un objeto JSON, sin \`\`\`json\`\`\` ni texto extra afuera. Las claves deben coincidir EXACTAMENTE con el esquema arriba.`;

          const response = await client.models.generateContent({
              model: MODEL_NAME,
              contents: [{ role: 'user', parts: [{ text: prompt }] }],
              config: { responseMimeType: 'application/json' }
          });

          const text = response.text;
          if (!text) return null;
          return JSON.parse(text);
      } catch (error) {
          console.error("Fill Proposal AI Error:", error);
          return null;
      }
  },
};