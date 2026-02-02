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
            description: "Gestión de TAREAS (Todo List). ⚠️ NO USAR PARA CLIENTES/PROYECTOS. Solo para crear, actualizar o borrar items de la lista de tareas.",
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
    ],
}, 
{
    functionDeclarations: [
        {
            name: "manage_clients",
            description: "Crear o actualizar clientes (PROYECTOS). Usa esto cuando el usuario quiera agregar un nuevo cliente o modificar uno existente. Si falta info, INVENTA datos realistas.",
            parameters: {
                type: "object",
                properties: {
                    action: { 
                        type: "string", 
                        enum: ["CREATE", "UPDATE", "DELETE"],
                        description: "CREATE=nuevo cliente, UPDATE=modificar existente, DELETE=eliminar cliente"
                    },
                    name: { 
                        type: "string",
                        description: "Nombre de la empresa/cliente. Ej: 'Puertas Blindadas Jack'"
                    },
                    industry: { 
                        type: "string",
                        description: "Industria/Rubro. Ej: 'Seguridad', 'Software', 'Real Estate'"
                    },
                    monthlyRevenue: { 
                        type: "number",
                        description: "Fee mensual estimado. Si no dice, estima un valor realista (ej: 500-2000)"
                    },
                    billingDay: {
                        type: "number",
                        description: "Día del mes de cobro (1-31). Ej: 24"
                    },
                    status: {
                        type: "string",
                        enum: ["ONBOARDING", "ACTIVE", "PAUSED", "COMPLETED"],
                        description: "Estado del proyecto. Default: ACTIVE"
                    },
                    description: {
                        type: "string",
                        description: "Resumen completo del cliente: qué hacen, dónde están, desde cuándo, servicios que se les da. Incluye TODO el contexto."
                    },
                    location: {
                        type: "string", 
                        description: "Ubicación (Ciudad/País). Ej: 'Buenos Aires, Argentina'"
                    },
                    id: { 
                        type: "string",
                        description: "UUID (Solo para UPDATE)"
                    }
                },
                required: ["action", "name", "description"]
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
1. ⚠️ RESPUESTAS CORTAS Y DIRECTAS. Solo confirma la acción.
2. Si pide crear/modificar/borrar → USA manage_tasks o manage_clients.
3. Si el usuario refiere a "este cliente" o "el de recién", BUSCA el ID en el historial reciente.
4. Si falta el ID para un UPDATE, y acabas de crear uno, USA ESE ID.
5. Interpreta fechas relativas ("lunes", "24 de cada mes").
6. NO expliques obviedades. Solo di "Listo", "Hecho", "Agendado".

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
            } as any);

            console.log('🤖 RAW RESPONSE:', response);

            // Check if AI called a function
            if (response.functionCalls && response.functionCalls.length > 0) {
                const functionCall = response.functionCalls[0];
                console.log('✅ FUNCTION CALLED:', functionCall.name, functionCall.args);

                if (functionCall.name === 'manage_tasks') {
                    return {
                        type: 'BATCH',
                        actions: (functionCall.args as any).actions.map((a: any) => ({
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
                } else if (functionCall.name === 'manage_clients') {
                    const args = functionCall.args as any;
                    return {
                        type: 'BATCH', // Reusing BATCH type for now, frontend should handle ACTION types generically if possible, or I'll map it to CREATE_CLIENT payload
                        actions: [{
                            action: args.action === 'CREATE' ? 'CREATE_PROJECT' : 
                                    args.action === 'UPDATE' ? 'UPDATE_PROJECT' : 'DELETE_PROJECT',
                            payload: {
                                name: args.name,
                                industry: args.industry || 'General',
                                monthlyRevenue: args.monthlyRevenue || 0,
                                billingDay: args.billingDay || 1,
                                status: args.status || 'ACTIVE',
                                notes: args.description || '',
                                // Mapping extra fields to notes if needed or extending the Project type later
                                location: args.location, 
                                id: args.id
                            }
                        }],
                        message: `✅ Procesado cliente: **${args.name}**`
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
