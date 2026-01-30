
import { GoogleGenAI } from "@google/genai";

// Initialization with process.env.API_KEY as per security guidelines
const aiClient = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const ai = {
  chat: async (messages: {role: 'system' | 'user' | 'assistant', content: string}[]) => {
    try {
      // 1. Extract System Instruction
      const systemMessage = messages.find(m => m.role === 'system');
      const systemInstruction = systemMessage ? systemMessage.content : undefined;

      // 2. Format History for Gemini (User/Model roles)
      const contents = messages
        .filter(m => m.role !== 'system')
        .map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }]
        }));

      // 3. Generate Content using Gemini 3 Flash (Fast & Smart)
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
      return "Error de conexión con IA. Por favor verifica tu API Key en las variables de entorno.";
    }
  }
};
