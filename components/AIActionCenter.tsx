import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ai } from '../services/ai';
import { db } from '../services/db';
import { AIChatLog, AIChatSession, TaskStatus, ProjectStatus } from '../types';
import { Sparkles, Loader2, CornerDownLeft, Mic, StopCircle, ChevronUp, AlertTriangle, Check, RotateCcw, Trash2, History, MessageSquare, Plus, Clock, MousePointerClick, Square, UserPlus, ListTodo } from 'lucide-react';

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
    const [placeholder, setPlaceholder] = useState("¿Qué hacemos hoy?");
    
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
    const recognitionRef = useRef<any>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    // --- Initial Load ---
    useEffect(() => { loadSessions(); }, [isOpen]);
    useEffect(() => {
        if (currentSessionId) loadMessages(currentSessionId);
        else setMessages([]);
    }, [currentSessionId]);

    // Auto scroll
    useEffect(() => {
        if (chatContainerRef.current) chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }, [messages, isThinking, viewMode, confirmationMessage, decisionOptions]);

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

    const executeAction = async (actionType: string, payload: any): Promise<{ success: boolean, undo?: UndoPayload }> => {
        try {
            if (actionType === 'CREATE_TASK') {
                const newTask = await db.tasks.create({
                    title: payload.title,
                    status: TaskStatus.TODO,
                    priority: payload.priority || 'MEDIUM',
                    dueDate: payload.dueDate || payload.due || null, 
                    description: payload.description || 'AI Generated'
                });
                window.dispatchEvent(new Event('task-created'));
                return { success: true, undo: { undoType: 'DELETE_TASK', data: { id: newTask.id }, description: 'Borrar tarea' } };
            }
            if (actionType === 'UPDATE_TASK') {
                if (!payload.id) return { success: false };
                if (payload.status) await db.tasks.updateStatus(payload.id, payload.status);
                window.dispatchEvent(new Event('task-created')); 
                return { success: true };
            }
            if (actionType === 'DELETE_TASK') {
                if (!payload.id) return { success: false };
                await db.tasks.delete(payload.id);
                window.dispatchEvent(new Event('task-created'));
                return { success: true };
            }
            if (actionType === 'CREATE_PROJECT') {
                const newProject = await db.projects.create({
                    name: payload.name,
                    monthlyRevenue: payload.monthlyRevenue || 0,
                    industry: payload.industry,
                    notes: payload.notes,
                    billingDay: 1,
                    status: ProjectStatus.ONBOARDING
                });
                window.dispatchEvent(new Event('project-created'));
                return { success: true, undo: { undoType: 'DELETE_PROJECT', data: { id: newProject.id }, description: 'Borrar proyecto' } };
            }
            return { success: false };
        } catch (e) { console.error(e); return { success: false }; }
    };

    const handleUndoMessage = async (msg: AIChatLog) => {
        if (!msg.action_payload || msg.is_undone) return;
        const undoData = msg.action_payload as UndoPayload;
        setIsThinking(true);
        try {
            if (undoData.undoType === 'DELETE_TASK') await db.tasks.delete(undoData.data.id);
            else if (undoData.undoType === 'DELETE_PROJECT') await db.projects.delete(undoData.data.id);
            
            window.dispatchEvent(new Event('task-created'));
            window.dispatchEvent(new Event('project-created'));
            await db.chat.markUndone(msg.id);
            if (currentSessionId) {
                await db.chat.addMessage(currentSessionId, 'assistant', `✅ Deshice esa acción.`);
                await loadMessages(currentSessionId);
            }
        } catch (e) { alert("Error al deshacer."); } finally { setIsThinking(false); }
    };

    const handleSend = async (textOverride?: string) => {
        const userText = textOverride || input;
        if (!userText.trim()) return;
        
        if (abortControllerRef.current) abortControllerRef.current.abort();
        const controller = new AbortController();
        abortControllerRef.current = controller;

        setInput('');
        setIsOpen(true);
        setIsThinking(true);
        setPendingAction(null);
        setConfirmationMessage(null);
        setDecisionOptions(null);

        let sessionId = currentSessionId;
        if (!sessionId) {
            try {
                const newSession = await db.chat.createSession(userText);
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
            const response = await ai.agent(userText, await db.chat.getMessages(sessionId), { tasks, projects, services, contractors }, controller.signal);
            
            if (!response) { setIsThinking(false); return; }
            
            let finalMessage = response.message || "Entendido.";
            
            if (response.type === 'BATCH' && response.actions) {
                let successCount = 0;
                for (const act of response.actions) { await executeAction(act.action, act.payload); successCount++; }
                finalMessage = `✅ Ejecuté ${successCount} acciones.`;
                await db.chat.addMessage(sessionId, 'assistant', finalMessage);
            }
            else if (response.type === 'DECISION') {
                setDecisionOptions(response.options);
                await db.chat.addMessage(sessionId, 'assistant', finalMessage);
            }
            else if (response.type === 'ACTION') {
                const result = await executeAction(response.action, response.payload);
                await db.chat.addMessage(sessionId, 'assistant', finalMessage, result.success ? { type: response.action, payload: result.undo } : undefined);
            }
            else {
                await db.chat.addMessage(sessionId, 'assistant', finalMessage);
            }
            await loadMessages(sessionId);
        } catch (error) {
            if (!controller.signal.aborted) {
                await db.chat.addMessage(sessionId, 'assistant', "Error de conexión.");
                await loadMessages(sessionId);
            }
        } finally {
            if (abortControllerRef.current === controller) {
                 setIsThinking(false);
                 abortControllerRef.current = null;
            }
        }
    };
    
    const handleStop = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
            setIsThinking(false);
            if (inputRef.current) inputRef.current.focus();
        }
    };

    const handleDecisionClick = async (option: {label: string, action: string, payload: any}) => {
        if (!currentSessionId) return;
        setIsThinking(true);
        setDecisionOptions(null);
        const result = await executeAction(option.action, option.payload);
        const msg = result.success ? `✅ Hecho: ${option.label}` : "❌ Error.";
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

    const toggleListening = () => {
        const { webkitSpeechRecognition, SpeechRecognition } = window as unknown as IWindow;
        const Recognition = SpeechRecognition || webkitSpeechRecognition;
        if (!Recognition) { alert("Navegador no soportado"); return; }
        if (isListening) { recognitionRef.current?.stop(); setIsListening(false); setPlaceholder("Procesando..."); if (input.trim().length > 0) setTimeout(() => handleSend(), 500); return; }
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
        <div ref={containerRef} className={`fixed left-1/2 -translate-x-1/2 z-50 transition-all duration-500 w-[95%] md:w-[600px] bottom-6`}>
            <div className={`absolute bottom-full mb-3 w-full bg-white/95 backdrop-blur-2xl border border-gray-200/50 shadow-2xl rounded-3xl overflow-hidden transition-all duration-300 origin-bottom flex flex-col ${isOpen ? 'opacity-100 scale-100 h-[65vh] md:h-[550px]' : 'opacity-0 scale-95 h-0 pointer-events-none'}`}>
                 <div className="flex justify-between items-center p-3 border-b border-gray-100 bg-gray-50/80 flex-shrink-0">
                    <div className="flex items-center gap-2">
                        {viewMode === 'CHAT' && <button onClick={() => setViewMode('HISTORY')} className="p-1.5 hover:bg-gray-200 rounded-lg text-gray-500"><History className="w-4 h-4" /></button>}
                        {viewMode === 'HISTORY' && <button onClick={() => setViewMode('CHAT')} className="p-1.5 hover:bg-gray-200 rounded-lg text-gray-500"><CornerDownLeft className="w-4 h-4" /></button>}
                        <span className="text-xs font-bold text-gray-600 uppercase tracking-widest">{viewMode === 'HISTORY' ? 'Historial' : sessions.find(s => s.id === currentSessionId)?.title || 'Nueva Conversación'}</span>
                    </div>
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
                                <p className="text-xs">Soy tu Segundo Cerebro. ¿Qué hacemos hoy?</p>
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
                        {isThinking && <div className="self-start bg-white border border-gray-100 p-3 rounded-2xl rounded-bl-sm flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin text-indigo-500" /><span className="text-xs text-gray-500">Pensando...</span></div>}
                        <div className="h-1"></div>
                     </div>
                 )}
                 {pendingAction && (
                     <div className="p-3 bg-yellow-50/50 border-t border-yellow-100 animate-in slide-in-from-bottom-5 flex-shrink-0 backdrop-blur-sm">
                         <div className="flex items-center gap-3"><AlertTriangle className="w-5 h-5 text-yellow-600" /><div className="flex-1"><p className="text-xs text-gray-600 line-clamp-1">{confirmationMessage}</p></div><div className="flex gap-2"><button onClick={confirmAction} className="bg-black text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-gray-800">Sí, Borrar</button><button onClick={cancelAction} className="bg-white border border-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-gray-50">Cancelar</button></div></div>
                     </div>
                 )}
            </div>

            {/* Quick Prompts (Chips) */}
            {isOpen && !isThinking && !input && viewMode === 'CHAT' && messages.length === 0 && (
                <div className="absolute bottom-full mb-4 left-0 w-full flex gap-2 overflow-x-auto px-1 pb-1 no-scrollbar animate-in slide-in-from-bottom-2">
                    <button onClick={() => handleSend("Nuevo Cliente")} className="flex items-center gap-2 bg-white/90 backdrop-blur border border-gray-200 px-4 py-2 rounded-full text-xs font-bold text-gray-700 hover:bg-black hover:text-white transition-all shadow-lg shadow-black/5 whitespace-nowrap">
                        <UserPlus className="w-3.5 h-3.5" /> Nuevo Cliente
                    </button>
                    <button onClick={() => handleSend("Agendar Tarea")} className="flex items-center gap-2 bg-white/90 backdrop-blur border border-gray-200 px-4 py-2 rounded-full text-xs font-bold text-gray-700 hover:bg-black hover:text-white transition-all shadow-lg shadow-black/5 whitespace-nowrap">
                        <ListTodo className="w-3.5 h-3.5" /> Nueva Tarea
                    </button>
                </div>
            )}

            <div onClick={() => setIsOpen(true)} className={`relative group bg-white/80 backdrop-blur-xl border border-white/60 shadow-2xl shadow-indigo-500/20 rounded-full transition-all duration-300 cursor-text flex items-center px-2 py-2 md:px-3 ${isOpen ? 'ring-2 ring-black/5 scale-100' : 'hover:scale-105 hover:bg-white'}`}>
                <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center text-white shadow-lg transition-all duration-500 ${isThinking ? 'bg-indigo-600 rotate-180' : isListening ? 'bg-red-500 animate-pulse' : 'bg-black'}`}>
                    {isThinking ? <Loader2 className="w-5 h-5 animate-spin" /> : isListening ? <Mic className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
                </div>
                <input ref={inputRef} type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !isThinking && handleSend()} placeholder={isListening ? "Te escucho..." : placeholder} className="flex-1 bg-transparent border-none outline-none text-base text-gray-800 placeholder:text-gray-500 font-medium px-4 h-full" autoComplete="off" disabled={!!pendingAction || !!decisionOptions} />
                <div className="flex items-center gap-2 pr-2">
                     {!isThinking && <button onClick={(e) => { e.stopPropagation(); toggleListening(); }} className={`p-2 rounded-full transition-all ${isListening ? 'text-white bg-red-500 hover:bg-red-600' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}>{isListening ? <StopCircle className="w-5 h-5" /> : <Mic className="w-5 h-5" />}</button>}
                    {isThinking ? <button onClick={(e) => { e.stopPropagation(); handleStop(); }} className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center transition-colors border border-red-200"><Square className="w-4 h-4 fill-red-500" /></button> : input.length > 0 ? <button onClick={(e) => { e.stopPropagation(); handleSend(); }} className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gray-100 hover:bg-black hover:text-white flex items-center justify-center transition-colors"><CornerDownLeft className="w-4 h-4 md:w-5 md:h-5" /></button> : <button onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }} className="hidden md:flex text-gray-300 hover:text-gray-500"><ChevronUp className={`w-5 h-5 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} /></button>}
                </div>
            </div>
        </div>
    );
};