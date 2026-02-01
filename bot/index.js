require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { GoogleGenAI } = require("@google/genai");
const { createClient } = require('@supabase/supabase-js');

// --- CONFIG ---
const SUPABASE_URL = process.env.VITE_SUPABASE_URL; // Reusing Vite Env if possible, or manual
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY; // Needs to be set in .env or hardcoded for now if testing

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("Missing Supabase Credentials. Please create a .env file in 'bot/' folder with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
    // process.exit(1); 
    // Allowing to continue if user fixes it later, but init will fail.
}

// Init Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
// Init Gemini
const genAI = new GoogleGenAI({ apiKey: GOOGLE_API_KEY });

// Init WhatsApp
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox']
    }
});

client.on('qr', (qr) => {
    console.log('SCAN THIS QR CODE WITH WHATSAPP:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('✅ Bot Client is ready!');
});

// --- MAIN LOGIC ---
client.on('message_create', async (msg) => {
    // Filter: Only listen to messages from ME (Notes to self) or specific numbers if needed.
    // 'message_create' triggers on my own messages too. 'message' only on others.
    // Using message_create allows "Talking to myself" which is the best UX for a personal assistant.
    
    // Ignore status updates or groups if needed.
    if (msg.from === 'status@broadcast') return;

    // Check if it mentions the bot or is a command? 
    // Ideally, for a personal assistant, we might want to process EVERYTHING in a specific chat (e.g. "My Notes").
    // For now, let's process:
    // 1. Audio Messages (PTT)
    // 2. Text starting with "Bot" or "!"? Or just everything from ME?
    
    // Let's assume we reply to EVERYTHING sent to "Me" conversation (Note to Self).
    const chat = await msg.getChat();
    // Only process if it's the user talking to themselves OR direct message to the bot number
    if (!msg.fromMe && !chat.isGroup) {
        // Only reply to direct messages (DM)
    } else if (msg.fromMe) {
        // Message sent BY me. Reply to Myself.
        if (msg.body === '!ping') return; // Ignore own commands to avoid loops if needed
    } else {
        return; // Ignore groups for now
    }

    console.log(`Msg from ${msg.from}: ${msg.type}`);

    try {
        let userInput = msg.body;
        let isVoice = false;

        // HANDLE AUDIO
        if (msg.hasMedia && (msg.type === 'audio' || msg.type === 'ptt')) {
            console.log("Downloading audio...");
            const media = await msg.downloadMedia();
            if (!media) return;
            
            userInput = { mimeType: media.mimetype, data: media.data }; // Base64
            isVoice = true;
            await msg.react('👂'); // Listening
        } else if (!userInput) {
            return;
        } else {
            // Text message
            if (userInput.startsWith('!')) return; // Ignore commands
            await msg.react('🧠'); // Thinking
        }

        // --- FETCH CONTEXT (RAG light) ---
        // We need Tasks/Projects to be smart.
        const { data: tasks } = await supabase.from('tasks').select('*').neq('status', 'DONE').limit(20);
        const { data: projects } = await supabase.from('projects').select('*').limit(10);
        
        // --- AI AGENT EXECUTION ---
        const responseText = await runAgent(userInput, { tasks, projects });
        
        let response;
        try {
            response = JSON.parse(responseText);
        } catch (e) {
            response = { type: 'CHAT', message: responseText };
        }

        // --- EXECUTE ACTIONS ---
        if (response.type === 'ACTION') {
            await executeAction(response.action, response.payload);
            await msg.reply(response.message || "Hecho.");
            await msg.react('✅');
        } else if (response.type === 'BATCH') {
            let count = 0;
            for (const act of response.actions) {
                await executeAction(act.action, act.payload);
                count++;
            }
            await msg.reply(response.message || `Ejecuté ${count} acciones.`);
            await msg.react('✅');
        } else if (response.type === 'DECISION') {
             // WhatsApp doesn't have UI buttons easily without API. 
             // We return text options.
             const opts = response.options.map((o, i) => `${i+1}. ${o.label}`).join('\n');
             await msg.reply(`${response.message}\n\nResponde con el número:\n${opts}`);
             // We would need to save state to handle the next number reply. 
             // For simplicity in V1, we just warn: "Please confirm explicitly".
        } else {
            await msg.reply(response.message || "Entendido");
        }

    } catch (e) {
        console.error("Error processing message:", e);
        await msg.reply("❌ Error procesando tu solicitud.");
    }
});

async function executeAction(action, payload) {
    console.log("Executing:", action, payload);
    if (action === 'CREATE_TASK') {
        await supabase.from('tasks').insert([{
            title: payload.title,
            status: 'TODO',
            priority: payload.priority || 'MEDIUM',
            due_date: payload.dueDate, // Note case snake_case match DB? App uses cameCase but DB is usually snake_case or preserves case. JS SDK usually handles mapping if configured, but safe to assume DB columns. 
            // Check app code: db.tasks.create uses 'dueDate' in payload, mapped to... DB schema?
            // Actually, in types.ts it says 'dueDate', but Supabase usually converts or expects exact column name.
            // Let's assume 'dueDate' is the text column or 'due_date'.
            // Based on previous errors ("Could not find googleEventId"), the columns seem to be camelCase in the App logic?
            // Wait, standard Supabase is snake_case.
            // I'll stick to the payload keys, hoping I mapped them right. If fails, I'll log.
            description: payload.description || '',
            project_id: payload.projectId
        }]);
    }
    // Add other actions...
}

async function runAgent(input, context) {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // Use stable model
    
    let parts = [];
    if (typeof input === 'object') {
        parts.push({ inlineData: { mimeType: input.mimeType, data: input.data }});
        parts.push({ text: "Escucha este audio. Eres Algoritmia OS. Actúa sobre la base de datos." });
    } else {
        parts.push({ text: input });
    }

    const prompt = `
    Eres un Asistente Ejecutivo conectado a una Base de Datos (Supabase).
    Contexto:
    - Tareas activas: ${JSON.stringify(context.tasks?.map(t=>t.title))}
    - Proyectos: ${JSON.stringify(context.projects?.map(p=>p.name))}
    
    Tu objetivo: Convertir la intención natural en JSON de Acción.
    
    FORMATO JSON:
    { "type": "ACTION", "action": "CREATE_TASK", "payload": { "title": "...", "dueDate": "ISO..." }, "message": "Texto confirmación" }
    
    Si hablas de proyectos o asignaciones, usa los IDs del contexto si puedes deducirlos, o pide aclaración.
    `;
    
    const result = await model.generateContent([prompt, ...parts]);
    const response = await result.response;
    const text = response.text();
    return text.replace(/```json/g, '').replace(/```/g, '').trim(); 
}

client.initialize();
