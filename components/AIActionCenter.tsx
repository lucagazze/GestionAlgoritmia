
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ai } from '../services/ai';
import { db } from '../services/db';
import { AIChatLog, AIChatSession, TaskStatus, ProjectStatus } from '../types';
import { Sparkles, Loader2, CornerDownLeft, Mic, StopCircle, ChevronUp, AlertTriangle, Check, RotateCcw, Trash2, History, MessageSquare, Plus } from 'lucide-react';

interface UndoPayload {
    undoType: 'RESTORE_TASK' | 'DELETE_TASK' | 'DELETE_PROJECT';
    data: any;
    description: string;
}

interface IWindow extends Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
}

export const AIActionCenter = () => {
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const [input, setInput] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [placeholder, setPlaceholder] = useState("¿Qué quieres hacer hoy?");
    
    // Sessions State
    const [sessions, setSessions] = useState<AIChatSession[]>([]);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'CHAT' | 'HISTORY'>('CHAT');

    // Messages State
    const [messages, setMessages] = useState<AIChatLog[]>([]);
    
    // Confirmation State (Immediate)
    const [pendingAction, setPendingAction] = useState<{type: string, payload: any} | null>(null);
    const [confirmationMessage, setConfirmationMessage] = useState<string | null>(null);

    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const recognitionRef = useRef<any>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);

    // --- Initial Load ---
    useEffect(() => {
        loadSessions();
    }, [isOpen]);

    useEffect(() => {
        if (currentSessionId) {
            loadMessages(currentSessionId);
        } else {
            setMessages([]);
        }
    }, [currentSessionId]);

    // Auto scroll
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages, isThinking, viewMode, confirmationMessage]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                if (isOpen) setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    // --- Logic ---

    const loadSessions = async () => {
        const sess = await db.chat.getSessions();
        setSessions(sess);
    };

    const loadMessages = async (id: string) => {
        const msgs = await db.chat.getMessages(id);
        setMessages(msgs);
    };

    const startNewChat = () => {
        setCurrentSessionId(null);
        setMessages([]);
        setViewMode('CHAT');
        setInput('');
    };

    const selectSession = (id: string) => {
        setCurrentSessionId(id);
        setViewMode('CHAT');
    };

    const deleteSession = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if(confirm('¿Borrar esta conversación?')) {
            await db.chat.deleteSession(id);
            await loadSessions();
            if (currentSessionId === id) startNewChat();
        }
    };

    // --- ACTION EXECUTION & UNDO ---

    const executeAction = async (actionType: string, payload: any): Promise<{ success: boolean, undo?: UndoPayload }> => {
        console.log("Executing Action:", actionType, payload); // Debug
        try {
            // --- TASKS ---
            if (actionType === 'CREATE_TASK') {
                const newTask = await db.tasks.create({
                    title: payload.title,
                    status: TaskStatus.TODO,
                    priority: payload.priority || 'MEDIUM',
                    // Fallback if AI hallucinates 'due' instead of 'dueDate'
                    dueDate: payload.dueDate || payload.due || null, 
                    description: payload.description || 'Creado por AI Assistant'
                });
                // CRITICAL: Notify App
                window.dispatchEvent(new Event('task-created'));
                return { 
                    success: true, 
                    undo: { undoType: 'DELETE_TASK', data: { id: newTask.id }, description: 'Borrar tarea creada' } 
                };
            }
            
            if (actionType === 'UPDATE_TASK') {
                if (!payload.id) return { success: false };
                
                // Get original for Undo
                const tasks = await db.tasks.getAll();
                const originalTask = tasks.find(t => t.id === payload.id);
                if (!originalTask) return { success: false };

                // Perform Update
                if (payload.status) await db.tasks.updateStatus(payload.id, payload.status);
                // Future: Update title/desc if payload has it
                
                window.dispatchEvent(new Event('task-created')); 
                return { 
                    success: true,
                    undo: { 
                        undoType: 'RESTORE_TASK', 
                        data: originalTask, // Store full original object
                        description: 'Restaurar estado anterior' 
                    }
                };
            }
            
            if (actionType === 'DELETE_TASK') {
                if (!payload.id) return { success: false };
                
                const tasks = await db.tasks.getAll();
                const taskToDelete = tasks.find(t => t.id === payload.id);
                if (!taskToDelete) return { success: false };

                await db.tasks.delete(payload.id);
                window.dispatchEvent(new Event('task-created'));
                return { 
                    success: true,
                    undo: {
                        undoType: 'RESTORE_TASK', 
                        data: taskToDelete,
                        description: 'Restaurar tarea eliminada'
                    }
                };
            }

            // --- PROJECTS ---
            if (actionType === 'CREATE_PROJECT') {
                const newProject = await db.projects.create({
                    name: payload.name,
                    monthlyRevenue: payload.monthlyRevenue || 0,
                    billingDay: 1,
                    status: ProjectStatus.ONBOARDING
                });
                window.dispatchEvent(new Event('project-created'));
                return {
                    success: true,
                    undo: { undoType: 'DELETE_PROJECT', data: { id: newProject.id }, description: 'Borrar proyecto creado' }
                };
            }
            return { success: false };
        } catch (e) {
            console.error("DB Execution Error:", e);
            return { success: false };
        }
    };

    // This handles "Undo" from HISTORY (DB PERSISTED)
    const handleUndoMessage = async (msg: AIChatLog) => {
        if (!msg.action_payload || msg.is_undone) return;
        
        const undoData = msg.action_payload as UndoPayload;
        setIsThinking(true);
        
        try {
            if (undoData.undoType === 'DELETE_TASK') {
                await db.tasks.delete(undoData.data.id);
            } else if (undoData.undoType === 'DELETE_PROJECT') {
                await db.projects.delete(undoData.data.id);
            } else if (undoData.undoType === 'RESTORE_TASK') {
                // Determine if it's a create or status update restore
                // Since data is the full task object, we can try to recreate/upsert it
                // For simplicity, we create a new one with same props if ID doesn't exist, or update if it does (not impl here).
                // Simplest robust strategy: Re-create the task.
                await db.tasks.create({
                    title: undoData.data.title,
                    description: undoData.data.description,
                    status: undoData.data.status,
                    priority: undoData.data.priority,
                    dueDate: undoData.data.dueDate
                });
            }

            window.dispatchEvent(new Event('task-created'));
            window.dispatchEvent(new Event('project-created'));

            // Mark message as undone in DB
            await db.chat.markUndone(msg.id);
            
            // Add system message confirming undo
            if (currentSessionId) {
                await db.chat.addMessage(currentSessionId, 'assistant', `✅ Deshice esa acción. (Los datos han sido restaurados/borrados).`);
                await loadMessages(currentSessionId);
            }

        } catch (e) {
            alert("Error al deshacer. Puede que el objeto ya no exista.");
        } finally {
            setIsThinking(false);
        }
    };

    // --- MAIN SEND LOGIC ---

    const handleSend = async (textOverride?: string) => {
        const userText = textOverride || input;
        if (!userText.trim()) return;

        setInput('');
        setIsOpen(true);
        setIsThinking(true);
        setPendingAction(null);
        setConfirmationMessage(null);

        // 1. Ensure Session Exists
        let sessionId = currentSessionId;
        if (!sessionId) {
            try {
                const newSession = await db.chat.createSession(userText);
                sessionId = newSession.id;
                setCurrentSessionId(sessionId);
                setSessions([newSession, ...sessions]); // Optimistic update
            } catch (e) {
                console.error("Failed to create session");
                setIsThinking(false);
                return;
            }
        }

        // 2. Add User Message
        await db.chat.addMessage(sessionId, 'user', userText);
        
        // Optimistic append
        const tempUserMsg: AIChatLog = { 
            id: 'temp-' + Date.now(), session_id: sessionId, role: 'user', content: userText, created_at: new Date().toISOString() 
        };
        setMessages(prev => [...prev, tempUserMsg]);

        try {
            const [tasks, projects, services, contractors] = await Promise.all([
                db.tasks.getAll(),
                db.projects.getAll(),
                db.services.getAll(),
                db.contractors.getAll()
            ]);
            const currentData = { tasks, projects, services, contractors };

            // Send full history of THIS session to AI
            const sessionHistory = await db.chat.getMessages(sessionId);
            
            // CALL AI
            const response = await ai.agent(userText, sessionHistory, currentData);
            
            let finalMessage = response.message || "Entendido.";
            let undoPayload: UndoPayload | undefined;
            let assistantActionType = undefined;

            if (response.type === 'NAVIGATE') {
                setTimeout(() => {
                    navigate(response.payload); 
                    setIsOpen(false);
                }, 1500);
            } 
            else if (response.type === 'CONFIRM') {
                // STOP HERE, Ask user to click Yes/No
                setPendingAction({ type: response.action, payload: response.payload });
                setConfirmationMessage(finalMessage);
                
                await db.chat.addMessage(sessionId, 'assistant', finalMessage);
                await loadMessages(sessionId);
                setIsThinking(false);
                return; 
            }
            else if (response.type === 'QUESTION') {
                // Just chat, asking for more info
            }
            
            // Only Action/Confirm types get executed if not confirmed yet?
            // Wait, if AI returns ACTION directly (skipping confirm for simple things? No, we enforced CONFIRM in prompt)
            // But if we ever relax it, we handle ACTION here:
            if (response.type === 'ACTION') {
                const result = await executeAction(response.action, response.payload);
                if (!result.success) {
                    finalMessage = "Hubo un problema técnico ejecutando la acción.";
                } else {
                    undoPayload = result.undo;
                    assistantActionType = response.action;
                }
            }

            // Save AI Message with Undo Payload if exists
            await db.chat.addMessage(sessionId, 'assistant', finalMessage, assistantActionType ? { type: assistantActionType, payload: undoPayload } : undefined);
            await loadMessages(sessionId);

        } catch (error) {
            console.error(error);
            await db.chat.addMessage(sessionId, 'assistant', "Lo siento, tuve un error de conexión.");
            await loadMessages(sessionId);
        } finally {
            setIsThinking(false);
        }
    };

    const confirmAction = async () => {
        if (!pendingAction || !currentSessionId) return;
        setIsThinking(true);
        const result = await executeAction(pendingAction.type, pendingAction.payload);
        
        let msg = result.success ? "✅ Acción ejecutada con éxito." : "❌ Error al ejecutar la acción.";
        const undoPayload = result.success ? result.undo : undefined;
        
        // Add completion message
        await db.chat.addMessage(currentSessionId, 'assistant', msg, undoPayload ? { type: pendingAction.type, payload: undoPayload } : undefined);
        await loadMessages(currentSessionId);
        
        setPendingAction(null);
        setConfirmationMessage(null);
        setIsThinking(false);
    };

    const cancelAction = async () => {
        if (!currentSessionId) return;
        await db.chat.addMessage(currentSessionId, 'assistant', "🚫 Acción cancelada.");
        await loadMessages(currentSessionId);
        setPendingAction(null);
        setConfirmationMessage(null);
    };

    // --- RENDER ---

    const toggleListening = () => {
        const { webkitSpeechRecognition, SpeechRecognition } = window as unknown as IWindow;
        const Recognition = SpeechRecognition || webkitSpeechRecognition;
        if (!Recognition) { alert("Navegador no soportado"); return; }

        if (isListening) {
            recognitionRef.current?.stop();
            setIsListening(false);
            setPlaceholder("Procesando...");
            if (input.trim().length > 0) setTimeout(() => handleSend(), 500);
            return;
        }

        const recognition = new Recognition();
        recognitionRef.current = recognition;
        recognition.lang = 'es-ES';
        recognition.interimResults = true; 
        recognition.onstart = () => { setIsListening(true); setPlaceholder("Escuchando..."); setIsOpen(true); };
        recognition.onend = () => { if (isListening) setIsListening(false); };
        recognition.onresult = (event: any) => {
            let fullStr = '';
            for (let i = 0; i < event.results.length; ++i) fullStr += event.results[i][0].transcript;
            setInput(fullStr);
        };
        try { recognition.start(); } catch (error) { setIsListening(false); }
    };

    return (
        <div 
            ref={containerRef}
            className={`
                fixed left-1/2 -translate-x-1/2 z-50 
                transition-all duration-500 ease-in-out
                w-[95%] md:w-[600px]
                ${isOpen ? 'bottom-6' : 'bottom-6'}
            `}
        >
            <div className={`
                absolute bottom-full mb-3 w-full 
                bg-white/95 backdrop-blur-2xl border border-gray-200/50 shadow-2xl rounded-3xl
                overflow-hidden transition-all duration-300 origin-bottom flex flex-col
                ${isOpen ? 'opacity-100 scale-100 h-[65vh] md:h-[550px]' : 'opacity-0 scale-95 h-0 pointer-events-none'}
            `}>
                 {/* Header */}
                 <div className="flex justify-between items-center p-3 border-b border-gray-100 bg-gray-50/80 flex-shrink-0">
                    <div className="flex items-center gap-2">
                        {viewMode === 'CHAT' && <button onClick={() => setViewMode('HISTORY')} className="p-1.5 hover:bg-gray-200 rounded-lg text-gray-500"><History className="w-4 h-4" /></button>}
                        {viewMode === 'HISTORY' && <button onClick={() => setViewMode('CHAT')} className="p-1.5 hover:bg-gray-200 rounded-lg text-gray-500"><CornerDownLeft className="w-4 h-4" /></button>}
                        
                        <span className="text-xs font-bold text-gray-600 uppercase tracking-widest">
                            {viewMode === 'HISTORY' ? 'Historial' : sessions.find(s => s.id === currentSessionId)?.title || 'Nueva Conversación'}
                        </span>
                    </div>
                    
                    <div className="flex gap-2">
                         <button onClick={startNewChat} className="text-[10px] bg-black text-white px-3 py-1.5 rounded-full flex items-center gap-1 hover:bg-gray-800 transition-colors">
                            <Plus className="w-3 h-3"/> Nuevo
                        </button>
                    </div>
                 </div>
                 
                 {/* BODY: HISTORY LIST */}
                 {viewMode === 'HISTORY' && (
                     <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar bg-gray-50/30">
                         {sessions.map(s => (
                             <div 
                                key={s.id} 
                                onClick={() => selectSession(s.id)}
                                className={`group p-3 rounded-xl border cursor-pointer hover:shadow-md transition-all flex justify-between items-center ${currentSessionId === s.id ? 'bg-white border-black ring-1 ring-black' : 'bg-white border-gray-100 hover:border-gray-300'}`}
                             >
                                 <div>
                                     <p className="font-bold text-sm text-gray-800 line-clamp-1">{s.title}</p>
                                     <p className="text-[10px] text-gray-400">{new Date(s.updated_at || s.created_at).toLocaleDateString()}</p>
                                 </div>
                                 <button onClick={(e) => deleteSession(e, s.id)} className="opacity-0 group-hover:opacity-100 p-2 hover:bg-red-50 text-gray-300 hover:text-red-500 rounded-lg transition-all">
                                     <Trash2 className="w-4 h-4" />
                                 </button>
                             </div>
                         ))}
                         {sessions.length === 0 && <div className="text-center text-gray-400 text-xs py-10">No hay historial.</div>}
                     </div>
                 )}

                 {/* BODY: CHAT MESSAGES */}
                 {viewMode === 'CHAT' && (
                     <div ref={chatContainerRef} className="p-4 flex flex-col gap-4 overflow-y-auto custom-scrollbar flex-1">
                        {messages.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full text-gray-300 gap-2 opacity-50">
                                <Sparkles className="w-10 h-10" />
                                <p className="text-xs">Soy tu Segundo Cerebro. ¿Qué hacemos hoy?</p>
                            </div>
                        )}
                        {messages.map((msg, idx) => (
                            <div 
                                key={msg.id || idx} 
                                className={`flex flex-col max-w-[85%] ${msg.role === 'user' ? 'self-end items-end' : 'self-start items-start'}`}
                            >
                                <div className={`p-3 rounded-2xl text-sm shadow-sm whitespace-pre-wrap ${
                                    msg.role === 'user' 
                                    ? 'bg-black text-white rounded-br-sm' 
                                    : 'bg-white text-gray-800 border border-gray-100 rounded-bl-sm'
                                }`}>
                                    {msg.content}
                                </div>
                                
                                {/* Persistent Undo Button */}
                                {msg.role === 'assistant' && msg.action_payload && !msg.is_undone && (
                                    <button 
                                        onClick={() => handleUndoMessage(msg)}
                                        className="mt-1 ml-1 flex items-center gap-1 text-[10px] font-bold text-gray-400 hover:text-indigo-600 bg-gray-50 hover:bg-indigo-50 px-2 py-1 rounded-full transition-all border border-gray-100"
                                    >
                                        <RotateCcw className="w-3 h-3" /> Deshacer acción
                                    </button>
                                )}
                                {msg.is_undone && (
                                    <span className="mt-1 ml-1 text-[10px] text-gray-300 italic flex items-center gap-1">
                                        <RotateCcw className="w-3 h-3" /> Deshecho
                                    </span>
                                )}
                            </div>
                        ))}
                        {isThinking && (
                            <div className="self-start bg-white border border-gray-100 p-3 rounded-2xl rounded-bl-sm flex items-center gap-2">
                                 <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                                 <span className="text-xs text-gray-500">Pensando...</span>
                            </div>
                        )}
                        <div className="h-1"></div>
                     </div>
                 )}

                 {/* CONFIRMATION ZONE */}
                 {pendingAction && (
                     <div className="p-3 bg-yellow-50/50 border-t border-yellow-100 animate-in slide-in-from-bottom-5 flex-shrink-0 backdrop-blur-sm">
                         <div className="flex items-center gap-3">
                             <AlertTriangle className="w-5 h-5 text-yellow-600" />
                             <div className="flex-1">
                                 <p className="text-xs text-gray-600 line-clamp-1">{confirmationMessage}</p>
                             </div>
                             <div className="flex gap-2">
                                 <button onClick={confirmAction} className="bg-black text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-gray-800">Sí</button>
                                 <button onClick={cancelAction} className="bg-white border border-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-gray-50">No</button>
                             </div>
                         </div>
                     </div>
                 )}
            </div>

            {/* Input Bar */}
            <div 
                onClick={() => setIsOpen(true)}
                className={`
                    relative group
                    bg-white/80 backdrop-blur-xl border border-white/60
                    shadow-2xl shadow-indigo-500/20 rounded-full
                    transition-all duration-300 cursor-text
                    flex items-center px-2 py-2 md:px-3
                    ${isOpen ? 'ring-2 ring-black/5 scale-100' : 'hover:scale-105 hover:bg-white'}
                `}
            >
                <div className={`
                    w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center text-white shadow-lg transition-all duration-500
                    ${isThinking ? 'bg-indigo-600 rotate-180' : isListening ? 'bg-red-500 animate-pulse' : 'bg-black'}
                `}>
                    {isThinking ? <Loader2 className="w-5 h-5 animate-spin" /> : isListening ? <Mic className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
                </div>

                <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !isThinking && handleSend()}
                    placeholder={isListening ? "Te escucho..." : placeholder}
                    className="flex-1 bg-transparent border-none outline-none text-base text-gray-800 placeholder:text-gray-500 font-medium px-4 h-full"
                    autoComplete="off"
                    disabled={!!pendingAction} 
                />

                <div className="flex items-center gap-2 pr-2">
                     <button 
                        onClick={(e) => { e.stopPropagation(); toggleListening(); }}
                        className={`p-2 rounded-full transition-all ${isListening ? 'text-white bg-red-500 hover:bg-red-600' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
                    >
                        {isListening ? <StopCircle className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                    </button>

                    {input.length > 0 ? (
                        <button 
                            onClick={(e) => { e.stopPropagation(); handleSend(); }}
                            className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gray-100 hover:bg-black hover:text-white flex items-center justify-center transition-colors"
                        >
                            <CornerDownLeft className="w-4 h-4 md:w-5 md:h-5" />
                        </button>
                    ) : (
                         <button onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }} className="hidden md:flex text-gray-300 hover:text-gray-500">
                            <ChevronUp className={`w-5 h-5 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
