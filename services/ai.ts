
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
                temperature: 0.5 // Lower temperature for more precision on actions
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
  agent: async (userInput: string, contextHistory: any[] = [], currentData: { tasks: any[], projects: any[] }) => {
      try {
        // INJECT PRECISE DATE CONTEXT
        const now = new Date();
        const localDate = now.toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const localTime = now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
        
        // Simplify Data for Context Window (Optimization)
        const tasksSummary = currentData.tasks.map(t => `- [ID: ${t.id}] "${t.title}" (Status: ${t.status}, Priority: ${t.priority})`).join('\n');
        const projectsSummary = currentData.projects.map(p => `- [ID: ${p.id}] "${p.name}"`).join('\n');

        const systemPrompt = `
        Eres el Sistema Operativo Inteligente de "Algoritmia OS". Tu objetivo es gestionar la agencia.
        
        CONTEXTO TEMPORAL:
        - HOY: ${localDate} (${localTime})
        
        DATOS ACTUALES (Úsalos para buscar IDs si piden editar/borrar):
        TAREAS ACTIVAS:
        ${tasksSummary}
        
        PROYECTOS:
        ${projectsSummary}

        REGLAS DE COMPORTAMIENTO:
        1. Si el usuario pide crear algo, hazlo directo (ACTION).
        2. Si el usuario pide BORRAR o EDITAR algo existente:
           - Busca el ID correcto en la lista de arriba.
           - Si no estás 100% seguro de a qué tarea se refiere (ej: hay dos con nombre similar), devuelve "QUESTION" preguntando.
           - Si la acción es BORRAR o un cambio drástico, devuelve "CONFIRM" para que el usuario apruebe.
           - Si es una edición simple (ej: cambiar fecha), usa "ACTION".
        3. Si no entiendes, PREGUNTA (QUESTION).

        ACCIONES DISPONIBLES (Responde SOLO JSON):
        
        types:
        - 'ACTION': Ejecutar inmediatamente.
        - 'CONFIRM': Requiere botón de confirmación del usuario (Ideal para DELETE).
        - 'QUESTION': Necesitas más información del usuario.
        - 'NAVIGATE': Cambiar de página.
        - 'CHAT': Charla normal.

        actions (para type ACTION/CONFIRM):
        - 'CREATE_TASK': { title, priority, dueDate? }
        - 'UPDATE_TASK': { id, title?, status?, priority?, dueDate? } (Envía solo los campos a cambiar)
        - 'DELETE_TASK': { id }
        - 'CREATE_PROJECT': { name, monthlyRevenue }

        FORMATO JSON RESPUESTA:
        {
            "type": "ACTION" | "CONFIRM" | "QUESTION" | "CHAT" | "NAVIGATE",
            "action": "CREATE_TASK" | "UPDATE_TASK" | "DELETE_TASK" | null,
            "payload": { ... },
            "message": "Texto corto explicando qué vas a hacer o tu pregunta."
        }
        `;

        const messages = [
            { role: "system", content: systemPrompt },
            ...contextHistory.map(m => ({ role: m.role, content: m.content })),
            { role: "user", content: userInput }
        ];

        const responseText = await CALL_OPENAI(messages, true); // Enable JSON mode
        
        if (!responseText) throw new Error("No response from AI");
        
        // CLEANUP
        const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanJson);

      } catch (error) {
          console.error("Agent Error", error);
          return { type: "CHAT", message: "Error procesando solicitud. Verifica tu API Key en Ajustes." };
      }
  }
};
