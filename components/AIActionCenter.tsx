
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation, matchPath } from 'react-router-dom';
import { ai } from '../services/ai';
import { db } from '../services/db';
import { AIChatLog, AIChatSession, TaskStatus, ProjectStatus } from '../types';
import { Sparkles, Loader2, CornerDownLeft, Mic, StopCircle, ChevronUp, AlertTriangle, Check, RotateCcw, Trash2, History, MessageSquare, Plus, Clock, MousePointerClick, Square, UserPlus, ListTodo, Lightbulb, AudioWaveform } from 'lucide-react';

interface UndoPayload {
    undoType: 'RESTORE_TASK' | 'DELETE_TASK' | 'DELETE_PROJECT';
    data: any;
    description: string;
}

// Audio Utils for Gemini Live (Manual PCM Encoding)
function b64Encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function createBlob(data: Float32Array) {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: b64Encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

export const AIActionCenter = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [isOpen, setIsOpen] = useState(false);
    const [input, setInput] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    
    // Audio Real-Time State
    const [isRecording, setIsRecording] = useState(false);
    const [audioVolume, setAudioVolume] = useState(0);
    
    // Refs for cleaning up audio resources
    const audioContextRef = useRef<AudioContext | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);
    const liveSessionRef = useRef<any>(null);

    const [placeholder, setPlaceholder] = useState("¿Qué hacemos hoy, Jefe?");
    
    // Context State
    const [activeContextData, setActiveContextData] = useState<any>(null);
    const [quickChips, setQuickChips] = useState<{label: string, prompt: string}[]>([]);
    
    // Sessions State
    const [sessions, setSessions] = useState<AIChatSession[]>([]);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'CHAT' | 'HISTORY'>('CHAT');

    // Messages State
    const [messages, setMessages] = useState<AIChatLog[]>([]);
    
    // Confirmation & Decision State
    const [pendingAction, setPendingAction] = useState<{type: string, payload: any} | null>(null);
    const [confirmationMessage, setConfirmationMessage] = useState<string | null>(null);
    const [decisionOptions, setDecisionOptions] = useState<{label: string, action: string, payload: any}[] | null>(null);

    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);

    // --- Context Awareness & Proactivity ---
    useEffect(() => {
        const checkContext = async () => {
            const projectMatch = matchPath("/projects/:id", location.pathname);
            if (projectMatch && projectMatch.params.id) {
                const projects = await db.projects.getAll();
                const project = projects.find(p => p.id === projectMatch.params.id);
                if (project) {
                    setActiveContextData({ type: 'PROJECT', data: project });
                    setQuickChips([
                        { label: "Crear Tarea", prompt: `Crear tarea para ${project.name}: ` },
                        { label: "Analizar Estado", prompt: `Analiza el estado de ${project.name}` }
                    ]);
                    setPlaceholder(`Ordenes sobre ${project.name}...`);
                }
            } else {
                setActiveContextData(null);
                setQuickChips([
                    { label: "Auditoría General", prompt: "¿Cómo vamos hoy? Haz una auditoría." },
                    { label: "Agendar Reunión", prompt: "Agendar reunión mañana a las 10 con..." },
                    { label: "Resumen Financiero", prompt: "¿Cuánto facturamos este mes?" }
                ]);
                setPlaceholder("¿Qué hacemos hoy, Jefe?");
            }
        };
        checkContext();
    }, [location.pathname]);

    // --- Initial Load ---
    useEffect(() => { loadSessions(); }, [isOpen]);
    useEffect(() => {
        if (currentSessionId) loadMessages(currentSessionId);
        else setMessages([]);
    }, [currentSessionId]);

    useEffect(() => {
        if (chatContainerRef.current) chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }, [messages, isThinking, viewMode, confirmationMessage, decisionOptions]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                if (isOpen && !isRecording && !isThinking) setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, isRecording, isThinking]);

    // --- Logic ---
    const loadSessions = async () => { const sess = await db.chat.getSessions(); setSessions(sess); };
    const loadMessages = async (id: string) => { const msgs = await db.chat.getMessages(id); setMessages(msgs); };
    const startNewChat = () => { setCurrentSessionId(null); setMessages([]); setViewMode('CHAT'); setInput(''); setDecisionOptions(null); setPendingAction(null); };
    const selectSession = (id: string) => { setCurrentSessionId(id); setViewMode('CHAT'); setDecisionOptions(null); setPendingAction(null); };

    const deleteSession = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if(confirm('¿Borrar esta conversación?')) {
            await db.chat.deleteSession(id);
            await loadSessions();
            if (currentSessionId === id) startNewChat();
        }
    };
    
    const formatTime = (dateStr: string) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    };

    const executeAction = async (actionType: string, payload: any): Promise<{ success: boolean, undo?: UndoPayload, error?: string }> => {
        try {
            console.log("Executing Action:", actionType, payload);
            
            if (actionType === 'CREATE_TASK') {
                const safeTitle = payload.title || payload.description?.slice(0, 30) || "Tarea sin título";
                const newTask = await db.tasks.create({
                    title: safeTitle,
                    status: TaskStatus.TODO,
                    priority: payload.priority || 'MEDIUM',
                    dueDate: payload.dueDate || payload.due || null, 
                    description: payload.description || '',
                    projectId: activeContextData?.type === 'PROJECT' ? activeContextData.data.id : payload.projectId
                });
                window.dispatchEvent(new Event('task-created'));
                return { success: true, undo: { undoType: 'DELETE_TASK', data: { id: newTask.id }, description: 'Borrar tarea creada' } };
            }
            if (actionType === 'UPDATE_TASK') {
                if (!payload.id) return { success: false, error: 'Falta ID' };
                await db.tasks.update(payload.id, payload);
                window.dispatchEvent(new Event('task-created')); 
                return { success: true };
            }
            if (actionType === 'DELETE_TASK') {
                if (!payload.id) return { success: false, error: 'Falta ID' };
                await db.tasks.delete(payload.id);
                window.dispatchEvent(new Event('task-created'));
                return { success: true };
            }
            if (actionType === 'DELETE_PROJECT') {
                if (!payload.id) return { success: false, error: 'Falta ID del proyecto' };
                await db.projects.delete(payload.id);
                return { success: true };
            }
            if (actionType === 'CREATE_PROJECT') {
                const newProject = await db.projects.create({
                    name: payload.name || "Nuevo Proyecto",
                    monthlyRevenue: payload.monthlyRevenue || 0,
                    industry: payload.industry || '',
                    notes: '',
                    billingDay: 1,
                    status: ProjectStatus.ONBOARDING
                });
                return { success: true, undo: { undoType: 'DELETE_PROJECT', data: { id: newProject.id }, description: 'Borrar proyecto' } };
            }
            return { success: false };
        } catch (e: any) { 
            console.error("Execute Action Error:", e);
            if (e.message?.includes("policy") || e.message?.includes("permission") || e.code === '42501') {
                return { success: false, error: "⚠️ Error de Permisos: Ve a 'Ajustes' y ejecuta el script de reparación." };
            }
            return { success: false, error: "Error en base de datos." }; 
        }
    };

    const handleUndoMessage = async (msg: AIChatLog) => {
        if (!msg.action_payload || msg.is_undone) return;
        const undoData = msg.action_payload as UndoPayload;
        setIsThinking(true);
        try {
            if (undoData.undoType === 'DELETE_TASK') await db.tasks.delete(undoData.data.id);
            else if (undoData.undoType === 'DELETE_PROJECT') await db.projects.delete(undoData.data.id);
            
            window.dispatchEvent(new Event('task-created'));
            await db.chat.markUndone(msg.id);
            if (currentSessionId) {
                await db.chat.addMessage(currentSessionId, 'assistant', `✅ Deshice esa acción.`);
                await loadMessages(currentSessionId);
            }
        } catch (e) { alert("Error al deshacer."); } finally { setIsThinking(false); }
    };

    // --- GEMINI LIVE REAL-TIME AUDIO ---
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: { sampleRate: 16000 } });
            mediaStreamRef.current = stream;
            
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            audioContextRef.current = audioContext;

            const source = audioContext.createMediaStreamSource(stream);
            const processor = audioContext.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;

            setIsOpen(true);
            setIsRecording(true);
            
            const sessionPromise = ai.connectLive({
                onopen: () => {
                    console.log("Gemini Live Connected");
                    processor.onaudioprocess = (e) => {
                        const inputData = e.inputBuffer.getChannelData(0);
                        
                        // Volume visualizer simple logic
                        let sum = 0;
                        for(let i=0; i<inputData.length; i++) sum += inputData[i] * inputData[i];
                        setAudioVolume(Math.sqrt(sum / inputData.length));

                        const pcmBlob = createBlob(inputData);
                        sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob }));
                    };
                    source.connect(processor);
                    processor.connect(audioContext.destination);
                },
                onmessage: (msg: any) => {
                    // Handle Real-time Transcription: Append to input field
                    if (msg.serverContent?.inputAudioTranscription?.text) {
                        const text = msg.serverContent.inputAudioTranscription.text;
                        setInput(prev => prev + text);
                    }
                },
                onclose: () => {
                    console.log("Gemini Live Closed");
                    setIsRecording(false);
                },
                onerror: (e: any) => {
                    console.error("Gemini Live Error", e);
                    setIsRecording(false);
                    stopRecording();
                }
            });
            
            liveSessionRef.current = sessionPromise;

        } catch (err) {
            console.error("Failed to start recording:", err);
            alert("No se pudo acceder al micrófono o conectar con la IA.");
            setIsRecording(false);
        }
    };

    const stopRecording = async () => {
        setIsRecording(false);
        setAudioVolume(0);

        if (processorRef.current) {
            processorRef.current.disconnect();
            processorRef.current.onaudioprocess = null;
            processorRef.current = null;
        }
        if (audioContextRef.current) {
            await audioContextRef.current.close();
            audioContextRef.current = null;
        }
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
        }
        
        // Close session
        if (liveSessionRef.current) {
            liveSessionRef.current.then((session: any) => session.close());
            liveSessionRef.current = null;
        }
        
        // Focus input after recording to allow editing/sending
        setTimeout(() => inputRef.current?.focus(), 100);
    };

    const handleSend = async (textOverride?: string) => {
        const userText = textOverride || input;
        if (!userText.trim()) return;
        
        setInput('');
        setIsOpen(true);
        setIsThinking(true);
        setPendingAction(null);
        setConfirmationMessage(null);
        setDecisionOptions(null);

        let sessionId = currentSessionId;
        if (!sessionId) {
            try {
                const title = userText.slice(0, 30);
                const newSession = await db.chat.createSession(title);
                sessionId = newSession.id;
                setCurrentSessionId(sessionId);
                setSessions([newSession, ...sessions]); 
            } catch (e) { setIsThinking(false); return; }
        }

        await db.chat.addMessage(sessionId, 'user', userText);
        await loadMessages(sessionId);

        try {
            const [tasks, projects, services, contractors] = await Promise.all([
                db.tasks.getAll(), db.projects.getAll(), db.services.getAll(), db.contractors.getAll()
            ]);
            
            const response: any = await ai.agent(
                userText, 
                await db.chat.getMessages(sessionId), 
                { tasks, projects, services, contractors }
            );
            
            if (!response) { 
                await db.chat.addMessage(sessionId, 'assistant', "No pude procesar eso. Intenta de nuevo.");
                setIsThinking(false); 
                return; 
            }
            
            let finalMessage = response.message || "Entendido.";
            
            if (response.type === 'BATCH' && response.actions) {
                let successCount = 0;
                let failError = '';
                for (const act of response.actions) { 
                    const res = await executeAction(act.action, act.payload); 
                    if(res.success) successCount++;
                    else failError = res.error || 'Error desconocido';
                }
                finalMessage = successCount > 0 ? `✅ Ejecuté ${successCount} acciones.` : `❌ Falló: ${failError}`;
                await db.chat.addMessage(sessionId, 'assistant', finalMessage);
            }
            else if (response.type === 'DECISION') {
                setDecisionOptions(response.options);
                await db.chat.addMessage(sessionId, 'assistant', finalMessage);
            }
            else if (response.type === 'ACTION') {
                const result = await executeAction(response.action, response.payload);
                if (result.success) {
                    await db.chat.addMessage(sessionId, 'assistant', finalMessage, { type: response.action, payload: result.undo });
                } else {
                    await db.chat.addMessage(sessionId, 'assistant', `❌ No pude hacerlo: ${result.error || 'Error desconocido.'}`);
                }
            }
            else {
                await db.chat.addMessage(sessionId, 'assistant', finalMessage);
            }
            await loadMessages(sessionId);
        } catch (error) {
            console.error(error);
            await db.chat.addMessage(sessionId, 'assistant', "Tuve un problema técnico. ¿Me lo repites?");
            await loadMessages(sessionId);
        } finally {
            setIsThinking(false);
        }
    };

    const handleDecisionClick = async (option: {label: string, action: string, payload: any}) => {
        if (!currentSessionId) return;
        setIsThinking(true);
        setDecisionOptions(null);
        const result = await executeAction(option.action, option.payload);
        const msg = result.success ? `✅ Hecho: ${option.label}` : `❌ Error: ${result.error}`;
        await db.chat.addMessage(currentSessionId, 'assistant', msg, result.success ? {type: option.action, payload: result.undo} : undefined);
        await loadMessages(currentSessionId);
        setIsThinking(false);
    };

    const confirmAction = async () => {
        if (!pendingAction || !currentSessionId) return;
        setIsThinking(true);
        const result = await executeAction(pendingAction.type, pendingAction.payload);
        await db.chat.addMessage(currentSessionId, 'assistant', "✅ Acción ejecutada.", result.success ? { type: pendingAction.type, payload: result.undo } : undefined);
        await loadMessages(currentSessionId);
        setPendingAction(null);
        setConfirmationMessage(null);
        setIsThinking(false);
    };

    const cancelAction = async () => {
        if (!currentSessionId) return;
        await db.chat.addMessage(currentSessionId, 'assistant', "🚫 Cancelado.");
        await loadMessages(currentSessionId);
        setPendingAction(null);
        setConfirmationMessage(null);
    };

    return (
        <div ref={containerRef} className={`fixed left-1/2 -translate-x-1/2 z-50 transition-all duration-500 w-[95%] md:w-[600px] bottom-6`}>
            <div className={`absolute bottom-full mb-3 w-full bg-white/95 backdrop-blur-2xl border border-gray-200/50 shadow-2xl rounded-3xl overflow-hidden transition-all duration-300 origin-bottom flex flex-col ${isOpen ? 'opacity-100 scale-100 h-[65vh] md:h-[550px]' : 'opacity-0 scale-95 h-0 pointer-events-none'}`}>
                 <div className="flex justify-between items-center p-3 border-b border-gray-100 bg-gray-50/80 flex-shrink-0">
                    <div className="flex items-center gap-2">
                        {viewMode === 'CHAT' && <button onClick={() => setViewMode('HISTORY')} className="p-1.5 hover:bg-gray-200 rounded-lg text-gray-500"><History className="w-4 h-4" /></button>}
                        {viewMode === 'HISTORY' && <button onClick={() => setViewMode('CHAT')} className="p-1.5 hover:bg-gray-200 rounded-lg text-gray-500"><CornerDownLeft className="w-4 h-4" /></button>}
                        <span className="text-xs font-bold text-gray-600 uppercase tracking-widest">{viewMode === 'HISTORY' ? 'Historial' : sessions.find(s => s.id === currentSessionId)?.title || 'Nueva Conversación'}</span>
                    </div>
                    {activeContextData && (
                        <div className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded text-[10px] font-bold border border-blue-100">
                            <Lightbulb className="w-3 h-3" /> {activeContextData.data.name}
                        </div>
                    )}
                    <button onClick={startNewChat} className="text-[10px] bg-black text-white px-3 py-1.5 rounded-full flex items-center gap-1 hover:bg-gray-800"><Plus className="w-3 h-3"/> Nuevo</button>
                 </div>
                 
                 {viewMode === 'HISTORY' && (
                     <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar bg-gray-50/30">
                         {sessions.map(s => (
                             <div key={s.id} onClick={() => selectSession(s.id)} className={`group p-3 rounded-xl border cursor-pointer hover:shadow-md transition-all flex justify-between items-center ${currentSessionId === s.id ? 'bg-white border-black ring-1 ring-black' : 'bg-white border-gray-100'}`}>
                                 <div><p className="font-bold text-sm text-gray-800 line-clamp-1">{s.title}</p><p className="text-[10px] text-gray-400">{new Date(s.updated_at || s.created_at).toLocaleDateString()}</p></div>
                                 <button onClick={(e) => deleteSession(e, s.id)} className="opacity-0 group-hover:opacity-100 p-2 hover:bg-red-50 text-gray-300 hover:text-red-500 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                             </div>
                         ))}
                     </div>
                 )}

                 {viewMode === 'CHAT' && (
                     <div ref={chatContainerRef} className="p-4 flex flex-col gap-4 overflow-y-auto custom-scrollbar flex-1">
                        {messages.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full text-gray-300 gap-2 opacity-50">
                                <Sparkles className="w-10 h-10" />
                                <p className="text-xs">Soy tu Segundo Cerebro. {activeContextData ? `Hablemos de ${activeContextData.data.name}.` : "¿Qué ordenamos hoy?"}</p>
                            </div>
                        )}
                        {messages.map((msg, idx) => (
                            <div key={msg.id || idx} className={`flex flex-col max-w-[85%] ${msg.role === 'user' ? 'self-end items-end' : 'self-start items-start'}`}>
                                <div className={`p-3 rounded-2xl text-sm shadow-sm whitespace-pre-wrap ${msg.role === 'user' ? 'bg-black text-white rounded-br-sm' : 'bg-white text-gray-800 border border-gray-100 rounded-bl-sm'}`}>{msg.content}</div>
                                <div className="flex items-center gap-2 mt-1 px-1">
                                    <span className="text-[10px] text-gray-300">{formatTime(msg.created_at)}</span>
                                    {msg.role === 'assistant' && msg.action_payload && !msg.is_undone && (
                                        <button onClick={() => handleUndoMessage(msg)} className="flex items-center gap-1 text-[9px] font-bold text-gray-400 hover:text-indigo-600 bg-gray-50 hover:bg-indigo-50 px-2 py-0.5 rounded-full border border-gray-100"><RotateCcw className="w-2.5 h-2.5" /> Deshacer</button>
                                    )}
                                </div>
                            </div>
                        ))}
                        {decisionOptions && (
                            <div className="self-start w-[85%] grid gap-2 animate-in slide-in-from-left-4">
                                <p className="text-xs text-gray-400 font-bold ml-1 uppercase">Opciones:</p>
                                {decisionOptions.map((opt, idx) => (
                                    <button key={idx} onClick={() => handleDecisionClick(opt)} className="text-left bg-white border-2 border-indigo-100 hover:border-indigo-500 hover:bg-indigo-50 p-3 rounded-xl transition-all shadow-sm flex items-center gap-3 group">
                                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white flex items-center justify-center transition-colors"><MousePointerClick className="w-4 h-4" /></div>
                                        <span className="text-sm font-medium text-gray-700 group-hover:text-indigo-900">{opt.label}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                        {isThinking && <div className="self-start bg-white border border-gray-100 p-3 rounded-2xl rounded-bl-sm flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin text-indigo-500" /><span className="text-xs text-gray-500">Ejecutando...</span></div>}
                        
                        <div className="h-1"></div>
                     </div>
                 )}
            </div>

            {/* Quick Prompts (Chips) */}
            {isOpen && !isThinking && !isRecording && !input && viewMode === 'CHAT' && messages.length === 0 && (
                <div className="absolute bottom-full mb-4 left-0 w-full flex gap-2 overflow-x-auto px-1 pb-1 no-scrollbar animate-in slide-in-from-bottom-2">
                    {quickChips.map((chip, idx) => (
                        <button key={idx} onClick={() => handleSend(chip.prompt)} className="flex items-center gap-2 bg-white/90 backdrop-blur border border-gray-200 px-4 py-2 rounded-full text-xs font-bold text-gray-700 hover:bg-black hover:text-white transition-all shadow-lg shadow-black/5 whitespace-nowrap">
                            <Sparkles className="w-3 h-3 text-yellow-500" /> {chip.label}
                        </button>
                    ))}
                </div>
            )}

            <div onClick={() => setIsOpen(true)} className={`relative group bg-white/80 backdrop-blur-xl border border-white/60 shadow-2xl shadow-indigo-500/20 rounded-full transition-all duration-300 cursor-text flex items-center px-2 py-2 md:px-3 ${isOpen ? 'ring-2 ring-black/5 scale-100' : 'hover:scale-105 hover:bg-white'}`}>
                {/* Main Dynamic Button */}
                <div 
                    onClick={(e) => { e.stopPropagation(); if (isRecording) stopRecording(); else startRecording(); }}
                    className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center text-white shadow-lg transition-all duration-500 cursor-pointer ${isThinking ? 'bg-indigo-600 rotate-180' : isRecording ? 'bg-red-500 scale-110 shadow-red-500/50' : 'bg-black hover:bg-gray-800'}`}
                >
                    {isThinking ? <Loader2 className="w-5 h-5 animate-spin" /> : isRecording ? <AudioWaveform className="w-5 h-5 animate-pulse" style={{transform: `scaleY(${1 + audioVolume * 5})`}} /> : <Mic className="w-5 h-5" />}
                </div>
                
                <input ref={inputRef} type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !isThinking && !isRecording && handleSend()} placeholder={isRecording ? "Escuchando en vivo..." : placeholder} className="flex-1 bg-transparent border-none outline-none text-base text-gray-800 placeholder:text-gray-500 font-medium px-4 h-full" autoComplete="off" disabled={!!pendingAction || !!decisionOptions || isRecording} />
                
                <div className="flex items-center gap-2 pr-2">
                     {isThinking ? <div className="text-xs text-gray-400 animate-pulse">AI</div> : input.length > 0 ? <button onClick={(e) => { e.stopPropagation(); handleSend(); }} className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gray-100 hover:bg-black hover:text-white flex items-center justify-center transition-colors"><CornerDownLeft className="w-4 h-4 md:w-5 md:h-5" /></button> : <button onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }} className="hidden md:flex text-gray-300 hover:text-gray-500"><ChevronUp className={`w-5 h-5 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} /></button>}
                </div>
            </div>
        </div>
    );
};
