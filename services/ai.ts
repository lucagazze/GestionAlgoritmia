
import { GoogleGenAI } from "@google/genai";

export const ai = {
  // --- CHAT GENERAL (Para la calculadora y asistentes simples) ---
  chat: async (messages: {role: 'system' | 'user' | 'assistant', content: string}[]) => {
    try {
      const apiKey = process.env.API_KEY;
      if (!apiKey) return "Error: API Key no configurada.";

      const aiClient = new GoogleGenAI({ apiKey });
      
      const contents = messages.map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }]
      }));
      // Filter out system message from contents array for the model, pass it as config
      const systemMsg = messages.find(m => m.role === 'system')?.content;
      const chatContents = messages.filter(m => m.role !== 'system').map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }]
      }));

      const response = await aiClient.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: chatContents,
        config: { systemInstruction: systemMsg }
      });

      return response.text;
    } catch (error) {
      console.error("AI Error:", error);
      return "Error de conexión con IA.";
    }
  },

  // --- AGENTE DE VENTAS (SALES COPILOT) ---
  salesCoach: async (mode: 'SCRIPT' | 'ANALYSIS' | 'ROLEPLAY', inputData: any) => {
      try {
        const apiKey = process.env.API_KEY;
        if (!apiKey) throw new Error("API Key missing");
        const aiClient = new GoogleGenAI({ apiKey });

        let systemPrompt = `
        Eres el Director Comercial Senior de "Algoritmia". Eres experto en metodologías de venta consultiva (SPIN Selling, Challenger Sale, Sandler).
        Tu tono es: Seguro, Profesional, Persuasivo pero ético, y Psicológicamente astuto.
        Nunca des respuestas genéricas. Ve al grano.
        `;

        let userPrompt = "";

        if (mode === 'SCRIPT') {
            systemPrompt += " Tu objetivo es redactar el guion perfecto para la situación descrita.";
            userPrompt = `
            Contexto: ${inputData.context}
            Cliente: ${inputData.clientName} (${inputData.industry})
            Situación/Objetivo: ${inputData.goal}
            
            Genera:
            1. Un asunto (si es email) o gancho de apertura (si es chat/llamada) irresistible.
            2. El cuerpo del mensaje (conciso, enfocado en el beneficio del cliente).
            3. Una explicación breve de por qué funcionará este enfoque (psicología).
            `;
        } 
        else if (mode === 'ANALYSIS') {
            systemPrompt += " Tu objetivo es analizar la conversación, detectar objeciones ocultas, medir la temperatura del lead y decirme qué responder.";
            userPrompt = `
            Cliente: ${inputData.clientName}
            Último mensaje del cliente/Situación: "${inputData.lastMessage}"
            Historial reciente: ${inputData.history || 'N/A'}

            Analiza:
            1. ¿Qué está pensando realmente el cliente? (Subtexto).
            2. Temperatura del Lead (0-100%).
            3. Estrategia recomendada.
            4. Respuesta sugerida (lista para copiar y pegar).
            `;
        }

        const response = await aiClient.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
            config: { systemInstruction: systemPrompt }
        });

        return response.text;

      } catch (error) {
          console.error("Sales Coach Error", error);
          return "Error consultando al experto en ventas.";
      }
  },

  // --- AGENTE DEL SISTEMA (Router & Ejecutor) ---
  agent: async (userInput: string, contextHistory: any[] = []) => {
      try {
        const apiKey = process.env.API_KEY;
        if (!apiKey) throw new Error("API Key missing");

        const aiClient = new GoogleGenAI({ apiKey });

        const systemPrompt = `
        Eres el Sistema Operativo Inteligente de "Algoritmia OS" (una agencia). Tu objetivo es ejecutar acciones o navegar por la app.
        
        RUTAS DISPONIBLES:
        - Calculadora/Propuestas: '/calculator'
        - Clientes/Proyectos: '/projects'
        - Tareas: '/tasks'
        - Servicios: '/services'
        - Socios: '/partners'
        - Ajustes: '/settings'
        - Copiloto de Ventas: '/sales-copilot'

        ACCIONES DISPONIBLES (Tu puedes ejecutarlas generando el JSON correcto):
        - CREATE_TASK: Requiere 'title'. Opcional: 'priority' (LOW, MEDIUM, HIGH).
        - CREATE_PROJECT: Requiere 'name'. Opcional: 'monthlyRevenue'.

        REGLAS:
        1. Si el usuario quiere ir a un lugar, devuelve type: "NAVIGATE".
        2. Si el usuario quiere crear algo y tienes toda la info, devuelve type: "ACTION".
        3. Si el usuario quiere crear algo pero FALTA información (ej: "crear tarea" pero no dice cual), devuelve type: "QUESTION" para preguntar.
        4. Si es charla casual, devuelve type: "CHAT".

        Debes responder SIEMPRE un objeto JSON con este formato:
        {
            "type": "NAVIGATE" | "ACTION" | "QUESTION" | "CHAT",
            "payload": { ...datos de la acción o ruta... },
            "message": "Texto corto y amigable para el usuario"
        }
        `;

        const history = contextHistory.map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
        }));

        history.push({ role: 'user', parts: [{ text: userInput }] });

        const response = await aiClient.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: history,
            config: {
                systemInstruction: systemPrompt,
                responseMimeType: "application/json"
            }
        });

        const text = response.text;
        if (!text) throw new Error("No response");
        
        const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanJson);

      } catch (error) {
          console.error("Agent Error", error);
          return { type: "CHAT", message: "Lo siento, tuve un error procesando eso." };
      }
  }
};
