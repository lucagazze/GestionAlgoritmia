import { GoogleGenAI } from "@google/genai";

export const ai = {
  chat: async (messages: {role: 'system' | 'user' | 'assistant', content: string}[]) => {
    try {
      // 1. Get API Key (Environment Variable)
      // The API key must be obtained exclusively from the environment variable process.env.API_KEY.
      const apiKey = process.env.API_KEY;

      if (!apiKey) {
          console.error("⚠️ Error: API Key not found in environment variables.");
          return "Error: No se encontró la API Key. Por favor verifica tu configuración.";
      }

      // 2. Initialize Client JUST-IN-TIME
      const aiClient = new GoogleGenAI({ apiKey });

      // 3. Extract System Instruction
      const systemMessage = messages.find(m => m.role === 'system');
      const systemInstruction = systemMessage ? systemMessage.content : undefined;

      // 4. Format History for Gemini (User/Model roles)
      const contents = messages
        .filter(m => m.role !== 'system')
        .map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }]
        }));

      // 5. Generate Content using Gemini 3 Flash (Fast & Smart)
      const response = await aiClient.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: contents,
        config: {
            systemInstruction: systemInstruction,
        }
      });

      return response.text;
    } catch (error) {
      console.error("AI Error:", error);
      return "Hubo un error al conectar con la IA. Verifica tu clave o intenta más tarde.";
    }
  }
};