import { GoogleGenAI } from "@google/genai";
import { db } from './db';

const MODEL_NAME = 'gemini-3-flash-preview';

const getClient = async () => {
    const dbKey = await db.settings.getApiKey('google_api_key');
    const apiKey = dbKey || process.env.API_KEY;
    
    if (!apiKey) {
        throw new Error("No Google API Key found. Please add it in Settings.");
    }
    return new GoogleGenAI({ apiKey });
};

// ✨ FUNCTION DECLARATIONS for Native Function Calling
const tools = [{
    functionDeclarations: [
        {
            name: "manage_tasks",
            description: "Crear, actualizar o borrar tareas. SIEMPRE usa esto cuando el usuario pida crear/modificar/eliminar tareas. Soporta múltiples acciones en una sola llamada.",
            parameters: {
                type: "object",
                properties: {
                    actions: {
                        type: "array",
                        description: "Array de acciones. IMPORTANTE: Si pide 'lunes a viernes', crea 5 items separados (uno por día).",
                        items: {
                            type: "object",
                            properties: {
                                action: { 
                                    type: "string", 
                                    enum: ["CREATE", "UPDATE", "DELETE"],
                                    description: "CREATE=nueva, UPDATE=modificar, DELETE=borrar"
                                },
                                title: { 
                                    type: "string",
                                    description: "Título OBLIGATORIO para CREATE. Ej: 'Ir a caminar', 'Trabajar'"
                                },
                                dueDate: { 
                                    type: "string",
                                    description: "ISO date. Interpreta: 'lunes'=próximo lunes, 'dos y media'=14:30"
                                },
                                endTime: { 
                                    type: "string",
                                    description: "ISO date (opcional). Usa si dice 'de 8 a 14:30'"
                                },
                                priority: { 
                                    type: "string",
                                    enum: ["LOW", "MEDIUM", "HIGH"]
                                },
                                status: {
                                    type: "string",
                                    enum: ["TODO", "DONE"]
                                },
                                id: { 
                                    type: "string",
                                    description: "UUID (OBLIGATORIO para UPDATE/DELETE)"
                                }
                            },
                            required: ["action"]
                        }
                    },
                    summary: {
                        type: "string",
                        description: "Mensaje confirmando. Usa **negritas**. Ej: 'Creé **6 tareas**: 1 para caminar y 5 de trabajo'"
                    }
                },
                required: ["actions", "summary"]
            }
        },
        {
            name: "chat_response",
            description: "Responder conversacionalmente cuando NO se requiere acción",
            parameters: {
                type: "object",
                properties: {
                    message: { 
                        type: "string",
                        description: "Respuesta. Usa **negritas** para nombres/números"
                    }
                },
                required: ["message"]
            }
        },
        {
            name: "ask_question",
            description: "Preguntar al usuario cuando falta información crítica",
            parameters: {
                type: "object",
                properties: {
                    question: { type: "string" },
                    context: { type: "string" }
                },
                required: ["question"]
            }
        }
    ]
}];

export interface Message {
    role: 'user' | 'assistant';
    content: string;
}

export interface ContextData {
    tasks?: any[];
    projects?: any[];
    services?: any[];
    contractors?: any[];
}

export const ai = {
    agent: async (
        userInput: string | { mimeType: string; data: string },
        contextHistory: Message[] = [],
        contextData: ContextData = {}
    ): Promise<any> => {
        const { tasks = [], projects = [], services = [], contractors = [] } = contextData;

        const now = new Date();
        const argentinaFormatter = new Intl.DateTimeFormat('es-AR', {
            timeZone: 'America/Argentina/Buenos_Aires',
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit',
            hour12: false,
            weekday: 'long'
        });
        const argentinaTimeStr = argentinaFormatter.format(now);

        const activeTasks = tasks
            .filter((t: any) => t.status !== 'DONE')
            .slice(0, 50)
            .map((t: any) => `[TAREA] ID:${t.id} | "${t.title}" | Vence:${t.dueDate || 'Sin fecha'}`)
            .join('\\n');

        const activeProjects = projects
            .map((p: any) => `[CLIENTE] ID:${p.id} | "${p.name}" | Estado:${p.status}`)
            .join('\\n');
        
        const teamMembers = contractors
            .map((c: any) => `[EQUIPO] ID:${c.id} | "${c.name}" | Rol:${c.role}`)
            .join('\\n');

        const systemInstruction = `
Eres el asistente ejecutivo. Fecha/Hora actual (Argentina): ${argentinaTimeStr}

CONTEXTO:
${activeTasks || '[No hay tareas]'}
${activeProjects || '[No hay proyectos]'}
${teamMembers || '[No hay equipo]'}

REGLAS CRÍTICAS:
1. ⚠️ NUNCA respondas solo con "Entendido", "Ok", "Perfecto"
2. Si pide crear/modificar/borrar → USA manage_tasks
3. Si pide "lunes a viernes" → Crea 5 acciones separadas (una por día)
4. Si dice "de 8 a 14:30" → usa dueDate=8:00, endTime=14:30
5. Interpreta: "dos y media"=14:30, "lunes"=próximo lunes

EJEMPLO REAL:
Usuario: "Poneme una tarea para el lunes a las dos y media ir a caminar. Y poneme también para entre las ocho a las dos y media de toda la semana de lunes a viernes trabajar."

Debes llamar manage_tasks con:
{
  "actions": [
    { "action": "CREATE", "title": "Ir a caminar", "dueDate": "2026-02-03T14:30:00-03:00" },
    { "action": "CREATE", "title": "Trabajar", "dueDate": "2026-02-03T08:00:00-03:00", "endTime": "2026-02-03T14:30:00-03:00" },
    { "action": "CREATE", "title": "Trabajar", "dueDate": "2026-02-04T08:00:00-03:00", "endTime": "2026-02-04T14:30:00-03:00" },
    { "action": "CREATE", "title": "Trabajar", "dueDate": "2026-02-05T08:00:00-03:00", "endTime": "2026-02-05T14:30:00-03:00" },
    { "action": "CREATE", "title": "Trabajar", "dueDate": "2026-02-06T08:00:00-03:00", "endTime": "2026-02-06T14:30:00-03:00" },
    { "action": "CREATE", "title": "Trabajar", "dueDate": "2026-02-07T08:00:00-03:00", "endTime": "2026-02-07T14:30:00-03:00" }
  ],
  "summary": "Creé **6 tareas**: 1 para caminar (Lunes 14:30) y 5 de trabajo (Lun-Vie 8:00-14:30)"
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

            const historyParts = contextHistory.slice(-4).map(m => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }]
            }));

            historyParts.push({
                role: 'user',
                parts: [userPart]
            });

            const response = await client.models.generateContent({
                model: MODEL_NAME,
                contents: historyParts,
                tools: tools, // ✨ NATIVE FUNCTION CALLING
                config: { systemInstruction }
            });

            console.log('🤖 RAW RESPONSE:', response);

            // Check if AI called a function
            if (response.functionCalls && response.functionCalls.length > 0) {
                const functionCall = response.functionCalls[0];
                console.log('✅ FUNCTION CALLED:', functionCall.name, functionCall.args);

                if (functionCall.name === 'manage_tasks') {
                    return {
                        type: 'BATCH',
                        actions: functionCall.args.actions.map((a: any) => ({
                            action: a.action === 'CREATE' ? 'CREATE_TASK' : 
                                    a.action === 'UPDATE' ? 'UPDATE_TASK' : 'DELETE_TASK',
                            payload: {
                                title: a.title,
                                dueDate: a.dueDate,
                                endTime: a.endTime,
                                priority: a.priority || 'MEDIUM',
                                status: a.status || 'TODO',
                                id: a.id
                            }
                        })),
                        message: functionCall.args.summary
                    };
                } else if (functionCall.name === 'chat_response') {
                    return {
                        type: 'CHAT',
                        message: functionCall.args.message
                    };
                } else if (functionCall.name === 'ask_question') {
                    return {
                        type: 'QUESTION',
                        message: functionCall.args.question,
                        context: functionCall.args.context
                    };
                }
            }

            // Fallback if no function call
            return {
                type: 'CHAT',
                message: response.text || "No pude procesar eso."
            };

        } catch (error) {
            console.error("AI Agent Error:", error);
            return null;
        }
    }
};
