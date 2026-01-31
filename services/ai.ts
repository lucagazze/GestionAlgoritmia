
import { db } from "./db";

const CALL_OPENAI = async (messages: any[], jsonMode: boolean = false) => {
    // 1. Get Key from DB
    const apiKey = await db.settings.getApiKey();

    if (!apiKey) throw new Error("API Key missing. Por favor configúrala en la sección Ajustes.");

    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: messages,
                response_format: jsonMode ? { type: "json_object" } : undefined,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || "OpenAI API Error");
        }

        const data = await response.json();
        return data.choices[0].message.content;

    } catch (error) {
        console.error("OpenAI Error:", error);
        throw error;
    }
};

export const ai = {
  // --- CHAT GENERAL ---
  chat: async (messages: {role: 'system' | 'user' | 'assistant', content: string}[]) => {
    try {
      return await CALL_OPENAI(messages);
    } catch (error) {
      return "Error: No se pudo conectar con la IA. Verifica tu API Key en Ajustes.";
    }
  },

  // --- AGENTE DE VENTAS ---
  salesCoach: async (mode: 'SCRIPT' | 'ANALYSIS' | 'ROLEPLAY', inputData: any) => {
      try {
        let systemPrompt = `
        Eres el Director Comercial Senior de "Algoritmia".
        Objetivo: Ayudar a cerrar ventas high-ticket.
        `;

        let userPrompt = "";

        if (mode === 'SCRIPT') {
            userPrompt = `Genera un guion de ventas para: ${inputData.context}. Cliente: ${inputData.clientName}. Objetivo: ${inputData.goal}`;
        } 
        else if (mode === 'ANALYSIS') {
            userPrompt = `Analiza esta respuesta del cliente: "${inputData.lastMessage}". Dame una estrategia y respuesta.`;
        }

        const messages = [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
        ];

        return await CALL_OPENAI(messages);

      } catch (error) {
          return "Error consultando al experto en ventas.";
      }
  },

  // --- AGENTE DEL SISTEMA (Router & Ejecutor) ---
  agent: async (userInput: string, contextHistory: any[] = []) => {
      try {
        // INJECT PRECISE DATE CONTEXT
        const now = new Date();
        const localDate = now.toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const localTime = now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
        
        const dateContext = `
        CONTEXTO TEMPORAL ACTUAL:
        - HOY ES: ${localDate}
        - HORA ACTUAL: ${localTime}
        - ISO STRING BASE: ${now.toISOString()}
        
        INSTRUCCIONES PARA FECHAS ("dueDate"):
        1. Si el usuario dice "mañana a las 19:00", calcula la fecha de mañana y ajusta la hora a las 19:00:00.
        2. Si dice "el viernes", busca el próximo viernes.
        3. Devuelve SIEMPRE el formato ISO 8601 completo (ej: 2024-05-20T19:00:00.000Z).
        `;

        const systemPrompt = `
        Eres el Sistema Operativo Inteligente de "Algoritmia OS".
        
        ${dateContext}

        ACCIONES DISPONIBLES (Responde SOLO JSON):
        
        1. CREATE_TASK:
           - 'title': string (Resumen corto).
           - 'priority': 'LOW' | 'MEDIUM' | 'HIGH' (Si menciona urgencia es HIGH).
           - 'dueDate': string (ISO 8601). OBLIGATORIO si menciona tiempo. Si no, null.

        2. CREATE_PROJECT: 
           - 'name': string
           - 'monthlyRevenue': number

        3. NAVIGATE:
           - payload: '/tasks', '/projects', '/settings', etc.

        FORMATO JSON:
        {
            "type": "NAVIGATE" | "ACTION" | "QUESTION" | "CHAT",
            "action": "CREATE_TASK" | "CREATE_PROJECT" | null,
            "payload": { ... },
            "message": "Texto corto confirmando la acción (ej: 'Agendado para mañana 19hs')."
        }
        `;

        const messages = [
            { role: "system", content: systemPrompt },
            ...contextHistory.map(m => ({ role: m.role, content: m.content })),
            { role: "user", content: userInput }
        ];

        const responseText = await CALL_OPENAI(messages, true); // Enable JSON mode
        
        if (!responseText) throw new Error("No response from AI");
        
        // CLEANUP: OpenAI sometimes wraps JSON in markdown blocks even in JSON mode
        const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        
        return JSON.parse(cleanJson);

      } catch (error) {
          console.error("Agent Error", error);
          return { type: "CHAT", message: "Error procesando solicitud. Verifica tu API Key en Ajustes." };
      }
  }
};
