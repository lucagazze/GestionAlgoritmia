
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation, matchPath } from 'react-router-dom';
import { ai } from '../services/ai';
import { db } from '../services/db';
import { AIChatLog, AIChatSession, TaskStatus, ProjectStatus } from '../types';
import { Sparkles, Loader2, CornerDownLeft, Mic, StopCircle, ChevronUp, AlertTriangle, Check, RotateCcw, Trash2, History, MessageSquare, Plus, Clock, MousePointerClick, Square, UserPlus, ListTodo, Lightbulb, AudioWaveform, ExternalLink, Info } from 'lucide-react';
import { ActionDetailsModal } from './ActionDetailsModal';

interface UndoPayload {
    undoType: 'RESTORE_TASK' | 'DELETE_TASK' | 'DELETE_PROJECT' | 'RESTORE_TASKS';
    data: any;
    description: string;
}

// --- MESSAGE RENDERER COMPONENT ---
const MessageRenderer = ({ content, role, entities, onShowDetails }: { 
    content: string, 
    role: 'user' | 'assistant',
    entities?: Array<{type: string, id: string, name: string}>,
    onShowDetails?: () => void
}) => {
    const navigate = useNavigate();
    // 1. Split by new lines to handle paragraphs and lists
    const lines = content.split('\n');

    return (
        <div className={`space-y-1 ${role === 'user' ? 'text-right' : 'text-left'}`}>
            {lines.map((line, lineIdx) => {
                if (!line.trim()) return <div key={lineIdx} className="h-2" />; // Spacer for empty lines

                // 2. Check for bullet points
                const isBullet = line.trim().startsWith('-');
                const cleanLine = isBullet ? line.trim().substring(1).trim() : line;

                // 3. Parse Bold (**), Links [text](url), and [Ver Detalles] buttons
                // We split by a regex that captures both bold and link patterns
                const parts = cleanLine.split(/(\*\*.*?\*\*|\[.*?\]\(.*?\)|\[Ver Detalles\]|\[Ver Lista Completa\])/g);

                return (
                    <div key={lineIdx} className={`${isBullet ? 'flex gap-2 ml-1' : ''}`}>
                        {isBullet && <div className="min-w-[4px] h-[4px] bg-indigo-400 rounded-full mt-2.5" />}
                        <p className={`leading-relaxed ${isBullet ? 'flex-1' : ''}`}>
                            {parts.map((part, partIdx) => {
                                // Handle Bold
                                if (part.startsWith('**') && part.endsWith('**')) {
                                    return <strong key={partIdx} className="font-bold">{part.slice(2, -2)}</strong>;
                                }
                                // Handle Links/Buttons [Label](url)
                                const linkMatch = part.match(/^\[(.*?)\]\((.*?)\)$/);
                                if (linkMatch) {
                                    const [, label, url] = linkMatch;
                                    return (
                                        <a 
                                            key={partIdx} 
                                            href={url} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className={`
                                                inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold transition-colors mx-1 no-underline
                                                ${role === 'assistant' 
                                                    ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200 border border-indigo-200' 
                                                    : 'bg-white/20 text-white hover:bg-white/30'}
                                            `}
                                        >
                                            {label} <ExternalLink className="w-3 h-3" />
                                        </a>
                                    );
                                }
                                // Handle [Ver Detalles] button
                                if (part === '[Ver Detalles]' || part === '[Ver Lista Completa]') {
                                    return (
                                        <button
                                            key={partIdx}
                                            onClick={onShowDetails}
                                            className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold transition-colors mx-1 bg-indigo-100 text-indigo-700 hover:bg-indigo-200 border border-indigo-200"
                                        >
                                            <Info className="w-3 h-3" /> {part.replace(/[\[\]]/g, '')}
                                        </button>
                                    );
                                }
                                return <span key={partIdx}>{part}</span>;
                            })}
                        </p>
                    </div>
                );
            })}
                {/* Entity Chips */}
                {entities && entities.length > 0 && (
                    <div className="flex gap-2 mt-2 flex-wrap">
                        {entities.map((entity, idx) => (
                            <button
                                key={idx}
                                onClick={() => {
                                    if (entity.type === 'CLIENT') navigate(`/projects/${entity.id}`);
                                    if (entity.type === 'CONTRACTOR') navigate(`/team`);
                                }}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
                            >
                                {entity.type === 'CLIENT' ? '👤' : '👥'} {entity.name} →
                            </button>
                        ))}
                    </div>
                )}
        </div>
    );
};

import { parseMultiTaskRequest } from '../utils/taskParser';
import { executeReActLoop } from '../utils/reactLoop';
import { handleMultiActionResponse } from '../utils/multiActionHandler';

export const AIActionCenter = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [isOpen, setIsOpen] = useState(false);
    const [input, setInput] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    
    // Audio Recording State
    const [isRecording, setIsRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

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
    
    // Action Details Modal State
    const [detailsModal, setDetailsModal] = useState<{
        isOpen: boolean;
        actionType: 'DELETE' | 'CREATE' | 'UPDATE';
        items: Array<{id: string, title: string, subtitle?: string, metadata?: any, type: 'TASK' | 'PROJECT' | 'CONTRACTOR'}>;
        messageId?: string;
    }>({ isOpen: false, actionType: 'DELETE', items: [] });
    
    // 📊 Execution Progress State
    const [executionProgress, setExecutionProgress] = useState<{
        total: number;
        current: number;
        status: 'executing' | 'summarizing' | 'complete';
        currentAction?: string;
    } | null>(null);

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
                if (isOpen && !isRecording && !isTranscribing) setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, isRecording, isTranscribing]);

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

    const executeAction = async (actionType: string, payload: any): Promise<{ 
        success: boolean, 
        undo?: UndoPayload, 
        error?: string, 
        details?: any[],
        message?: string,
        data?: any,
        navigate?: string
    }> => {
        try {
            console.log("Executing Action:", actionType, payload);
            
            if (actionType === 'CREATE_TASK') {
                const newTask = await db.tasks.create({
                    title: payload.title || "Nueva Tarea",
                    description: payload.description || "",
                    status: payload.status || TaskStatus.TODO,
                    dueDate: payload.dueDate || new Date().toISOString(),
                    endTime: payload.endTime, // Support for time ranges
                    priority: payload.priority || 'MEDIUM',
                    assigneeId: payload.assigneeId,
                    projectId: payload.projectId,
                    sopId: payload.sopId
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
            if (actionType === 'DELETE_TASKS') {
                if (!payload.ids || payload.ids.length === 0) return { success: false, error: 'Falta lista de IDs' };
                // Fetch first for Undo
                const tasksToRestore = await db.tasks.getMany(payload.ids);
                await db.tasks.deleteMany(payload.ids);
                window.dispatchEvent(new Event('task-created'));
                return { 
                    success: true, 
                    undo: { 
                        undoType: 'RESTORE_TASKS', 
                        data: tasksToRestore, 
                        description: `Restaurar ${payload.ids.length} tareas` 
                    } 
                };
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
            
            // 💰 FINANCE ACTIONS
            if (actionType === 'ADD_CLIENT_NOTE') {
                await db.clientNotes.create({
                    clientId: payload.clientId,
                    content: payload.content,
                    type: payload.type || 'OTHER'
                });
                return { success: true, message: `✅ Agregué nota al cliente` };
            }
            
            if (actionType === 'UPDATE_CLIENT_HEALTH') {
                await db.projects.update(payload.clientId, {
                    healthScore: payload.healthScore
                });
                return { success: true, message: `✅ Actualicé el health score a **${payload.healthScore}**` };
            }
            
            if (actionType === 'GET_CLIENT_NOTES') {
                const notes = await db.clientNotes.getByClient(payload.clientId);
                return { 
                    success: true, 
                    data: notes,
                    message: `📝 Encontré **${notes.length}** notas para este cliente`
                };
            }
            
            // 🤖 AUTOMATION ACTIONS
            if (actionType === 'CREATE_SOP') {
                await db.sops.create({
                    title: payload.title,
                    category: payload.category,
                    content: payload.content
                });
                return { success: true, message: `✅ Creé el SOP: **${payload.title}**` };
            }
            
            if (actionType === 'GET_SOPS') {
                const sops = await db.sops.getAll();
                const filtered = payload.category 
                    ? sops.filter(s => s.category === payload.category)
                    : sops;
                return { 
                    success: true, 
                    data: filtered,
                    message: `📚 Encontré **${filtered.length}** SOPs`
                };
            }
            
            // 🧭 NAVIGATION ACTIONS
            if (actionType === 'NAVIGATE_TO') {
                return { 
                    success: true, 
                    navigate: payload.path,
                    message: `🧭 Navegando a **${payload.path}**`
                };
            }
            
            if (actionType === 'OPEN_PROJECT') {
                return { 
                    success: true, 
                    navigate: `/projects/${payload.projectId}`,
                    message: `📂 Abriendo proyecto`
                };
            }
            
            if (actionType === 'OPEN_TASK') {
                return { 
                    success: true, 
                    navigate: `/tasks?highlight=${payload.taskId}`,
                    message: `✅ Mostrando tarea`
                };
            }
            
            return { success: false };
        } catch (e: any) { 
            console.error("Execute Action Error:", e);
            // Detect RLS errors
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
            else if (undoData.undoType === 'RESTORE_TASKS') {
                // Bulk Insert
                const tasks = undoData.data.map((t: any) => {
                    const { id, assignee, ...rest } = t; // remove relations if any
                    return rest;
                });
                for(const t of tasks) await db.tasks.create(t);
            }
            
            window.dispatchEvent(new Event('task-created'));
            await db.chat.markUndone(msg.id);
            if (currentSessionId) {
                await db.chat.addMessage(currentSessionId, 'assistant', `✅ Deshice esa acción.`);
                await loadMessages(currentSessionId);
            }
        } catch (e) { alert("Error al deshacer."); } finally { setIsThinking(false); }
    };

    // --- AUDIO HANDLING ---
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            let mimeType = 'audio/webm';
            if (MediaRecorder.isTypeSupported('audio/mp4')) mimeType = 'audio/mp4'; 
            else if (MediaRecorder.isTypeSupported('audio/ogg')) mimeType = 'audio/ogg';

            const mediaRecorder = new MediaRecorder(stream, { mimeType });
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) audioChunksRef.current.push(event.data);
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
                
                setIsTranscribing(true);
                try {
                    const base64Audio = await blobToBase64(audioBlob);
                    const text = await ai.transcribe({ mimeType, data: base64Audio });
                    if (text) {
                        setInput(text.trim());
                        setIsOpen(true);
                        setTimeout(() => inputRef.current?.focus(), 100);
                        // Auto-send if it was a voice command? For now, let user review.
                    }
                } catch (e) { console.error("Transcription error", e); } 
                finally { setIsTranscribing(false); setIsRecording(false); }
                
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);
            setIsOpen(true);
        } catch (err) {
            console.error(err);
            alert("No se pudo acceder al micrófono.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
        }
    };

    const blobToBase64 = (blob: Blob): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = reader.result as string;
                resolve(base64String.split(',')[1]);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
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
            
            // 🔄 DETECT COMPLEX MULTI-STEP REQUESTS
            const complexKeywords = ['busca', 'encuentra', 'manda', 'envía', 'y luego', 'después', 'primero'];
            const isComplexRequest = complexKeywords.some(keyword => userText.toLowerCase().includes(keyword));
            
            if (isComplexRequest && userText.split(' ').length > 10) {
                console.log('🔄 Detected complex request - using ReAct loop');
                setIsThinking(true);
                
                try {
                    const result = await executeReActLoop(
                        userText,
                        sessionId,
                        { tasks, projects, services, contractors },
                        5 // max iterations
                    );
                    
                    // Show thinking process
                    if (result.iterations.length > 0) {
                        const thinkingSteps = result.iterations.map((iter, idx) => 
                            `**Paso ${idx + 1}**: ${iter.thought}\n${iter.observation ? `→ ${iter.observation}` : ''}`
                        ).join('\n\n');
                        
                        await db.chat.addMessage(sessionId, 'assistant', 
                            `🤔 **Proceso de pensamiento:**\n\n${thinkingSteps}\n\n---\n\n${result.message}`
                        );
                    } else {
                        await db.chat.addMessage(sessionId, 'assistant', result.message);
                    }
                    
                    await loadMessages(sessionId);
                    setIsThinking(false);
                    return;
                } catch (error) {
                    console.error('ReAct loop error:', error);
                    // Fall back to normal processing
                }
            }
            
            // Normal single-step processing
            const response: any = await ai.agent(
                userText, 
                await db.chat.getMessages(sessionId), 
                { tasks, projects, services, contractors }
            );
            
            if (!response) { 
                await db.chat.addMessage(sessionId, 'assistant', "❌ No pude procesar eso. Intenta de nuevo.");
                setIsThinking(false); 
                return; 
            }
            
            // ✨ APPLY MULTI-TASK PARSER
            const parsedResponse = parseMultiTaskRequest(userText, response);
            console.log('📊 PARSED RESPONSE:', parsedResponse);
            
            // Validate response - NEVER allow passive responses
            if (parsedResponse.type === 'CHAT' && (!parsedResponse.message || parsedResponse.message.toLowerCase().includes('entendido'))) {
                await db.chat.addMessage(sessionId, 'assistant', "⚠️ Error interno: Respuesta inválida. Por favor reformula tu solicitud.");
                setIsThinking(false);
                return;
            }
            
            let finalMessage = parsedResponse.message || "✅ Acción completada.";
            
            if (parsedResponse.type === 'BATCH' && parsedResponse.actions) {
                // 🚀 Use multi-action handler for batch operations
                try {
                    const actions = parsedResponse.actions.map((act: any) => ({
                        action: act.action,
                        payload: act.payload
                    }));
                    
                    const summary = await handleMultiActionResponse(
                        actions,
                        sessionId,
                        executeAction,
                        setExecutionProgress,
                        navigate
                    );
                    
                    await db.chat.addMessage(sessionId, 'assistant', summary);
                    window.dispatchEvent(new Event('task-created'));
                } catch (error) {
                    console.error('Multi-action handler error:', error);
                    await db.chat.addMessage(sessionId, 'assistant', '❌ Error ejecutando acciones múltiples');
                }
            }
            else if (parsedResponse.type === 'DECISION') {
                setDecisionOptions(parsedResponse.options || []);
                await db.chat.addMessage(sessionId, 'assistant', finalMessage);
            }
            else if (response.type === 'QUESTION') {
                // AI is asking for clarification
                await db.chat.addMessage(sessionId, 'assistant', `❓ ${response.message}\n\n_${response.context || 'Necesito esta información para continuar.'}_`);
            }
            else if (parsedResponse.type === 'ACTION') {
                const result = await executeAction(parsedResponse.action, parsedResponse.payload);
                if (result.success) {
                    // Store details and entities in message metadata
                    const metadata: any = { type: response.action, payload: result.undo };
                    
                    // Use details from executeAction if available, otherwise from AI response
                    const actionDetails = result.details || response.details;
                    if (actionDetails) metadata.details = actionDetails;
                    if (parsedResponse.entities) metadata.entities = parsedResponse.entities;
                    
                    // Enhance message with [Ver Detalles] if bulk action
                    let enhancedMessage = finalMessage;
                    if (actionDetails && actionDetails.length > 0) {
                        enhancedMessage += ` [Ver Detalles]`;
                    }
                    
                    await db.chat.addMessage(sessionId, 'assistant', enhancedMessage, metadata);
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

    return (
        <div ref={containerRef} className={`fixed left-1/2 -translate-x-1/2 z-50 transition-all duration-500 w-[95%] md:w-[600px] bottom-6`}>
            <div className={`absolute bottom-full mb-3 w-full bg-white/95 backdrop-blur-2xl border border-gray-200/50 shadow-2xl rounded-3xl overflow-hidden transition-all duration-300 origin-bottom flex flex-col ${isOpen ? 'opacity-100 scale-100 h-[75vh] md:h-[550px]' : 'opacity-0 scale-95 h-0 pointer-events-none'}`}>
                 <div className="flex justify-between items-center p-3 border-b border-gray-100 bg-gray-50/80 flex-shrink-0">
                    <div className="flex items-center gap-2">
                        {viewMode === 'CHAT' && <button onClick={() => setViewMode('HISTORY')} className="p-1.5 hover:bg-gray-200 rounded-lg text-gray-500"><History className="w-4 h-4" /></button>}
                        {viewMode === 'HISTORY' && <button onClick={() => setViewMode('CHAT')} className="p-1.5 hover:bg-gray-200 rounded-lg text-gray-500"><CornerDownLeft className="w-4 h-4" /></button>}
                        <span className="text-xs font-bold text-gray-600 uppercase tracking-widest">{viewMode === 'HISTORY' ? 'Historial' : sessions.find(s => s.id === currentSessionId)?.title || 'Nueva Conversación'}</span>
                    </div>
                    {activeContextData && (
                        <div className="hidden md:flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded text-[10px] font-bold border border-blue-100">
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
                     <div ref={chatContainerRef} className="p-4 flex flex-col gap-4 overflow-y-auto custom-scrollbar flex-1 pb-20">
                        {messages.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full text-gray-300 gap-2 opacity-50">
                                <Sparkles className="w-10 h-10" />
                                <p className="text-xs">Soy tu Segundo Cerebro. {activeContextData ? `Hablemos de ${activeContextData.data.name}.` : "¿Qué ordenamos hoy?"}</p>
                            </div>
                        )}
                         {messages.map((msg, idx) => {
                             const metadata = msg.action_payload as any;
                             const entities = metadata?.entities;
                             const details = metadata?.details;
                             
                             return (
                             <div key={msg.id || idx} className={`flex flex-col max-w-[95%] md:max-w-[90%] ${msg.role === 'user' ? 'self-end items-end' : 'self-start items-start'}`}>
                                 <div className={`p-3.5 rounded-2xl text-sm shadow-sm ${msg.role === 'user' ? 'bg-black text-white rounded-br-sm' : 'bg-white text-gray-800 border border-gray-100 rounded-bl-sm'}`}>
                                     <MessageRenderer 
                                         content={msg.content} 
                                         role={msg.role} 
                                         entities={entities}
                                         onShowDetails={details ? () => {
                                             setDetailsModal({
                                                 isOpen: true,
                                                 actionType: metadata.type?.includes('DELETE') ? 'DELETE' : metadata.type?.includes('CREATE') ? 'CREATE' : 'UPDATE',
                                                 items: details.map((d: any) => ({
                                                     id: d.id,
                                                     type: 'TASK' as const,
                                                     title: d.title,
                                                     subtitle: d.dueDate ? new Date(d.dueDate).toLocaleString('es-ES') : undefined,
                                                     metadata: { Prioridad: d.priority, Estado: d.status }
                                                 })),
                                                 messageId: msg.id
                                             });
                                         } : undefined}
                                     />
                                 </div>
                                <div className="flex items-center gap-2 mt-1 px-1">
                                    <span className="text-[10px] text-gray-300">{formatTime(msg.created_at)}</span>
                                    {msg.role === 'assistant' && msg.action_payload && !msg.is_undone && (
                                        <button onClick={() => handleUndoMessage(msg)} className="flex items-center gap-1 text-[9px] font-bold text-gray-400 hover:text-indigo-600 bg-gray-50 hover:bg-indigo-50 px-2 py-0.5 rounded-full border border-gray-100"><RotateCcw className="w-2.5 h-2.5" /> Deshacer</button>
                                    )}
                                 </div>
                             </div>
                         );
                         })}
                        {decisionOptions && (
                            <div className="self-start w-[95%] md:w-[85%] grid gap-2 animate-in slide-in-from-left-4">
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
                        
                        {/* 📊 Execution Progress UI */}
                        {executionProgress && (
                            <div className="self-start bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 p-4 rounded-2xl rounded-bl-sm w-full max-w-md">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-bold text-indigo-700">
                                        {executionProgress.status === 'executing' && '⚡ Ejecutando acciones...'}
                                        {executionProgress.status === 'summarizing' && '🤖 Generando resumen...'}
                                        {executionProgress.status === 'complete' && '✅ Completado'}
                                    </span>
                                    <span className="text-xs text-indigo-600 font-mono">
                                        {executionProgress.current}/{executionProgress.total}
                                    </span>
                                </div>
                                <div className="w-full bg-white rounded-full h-2 overflow-hidden">
                                    <div 
                                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300"
                                        style={{ width: `${(executionProgress.current / executionProgress.total) * 100}%` }}
                                    />
                                </div>
                                {executionProgress.currentAction && (
                                    <p className="text-xs text-indigo-600 mt-2">
                                        {executionProgress.currentAction}
                                    </p>
                                )}
                            </div>
                        )}
                        
                        {isRecording && <div className="self-end bg-red-50 border border-red-100 p-3 rounded-2xl rounded-br-sm flex items-center gap-2 animate-pulse"><div className="w-2 h-2 rounded-full bg-red-500"></div><span className="text-xs text-red-600 font-bold">Escuchando...</span></div>}
                        {isTranscribing && <div className="self-end bg-blue-50 border border-blue-100 p-3 rounded-2xl rounded-br-sm flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin text-blue-500" /><span className="text-xs text-blue-600 font-bold">Transcribiendo...</span></div>}
                        <div className="h-1"></div>
                     </div>
                 )}
            </div>

            {/* Quick Prompts (Chips) */}
            {isOpen && !isThinking && !isRecording && !isTranscribing && !input && viewMode === 'CHAT' && messages.length === 0 && (
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
                    className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center text-white shadow-lg transition-all duration-500 cursor-pointer flex-shrink-0 ${isThinking || isTranscribing ? 'bg-indigo-600 rotate-180' : isRecording ? 'bg-red-500 scale-110 shadow-red-500/50' : 'bg-black hover:bg-gray-800'}`}
                >
                    {isThinking || isTranscribing ? <Loader2 className="w-5 h-5 animate-spin" /> : isRecording ? <AudioWaveform className="w-5 h-5 animate-pulse" /> : <Mic className="w-5 h-5" />}
                </div>
                
                <input ref={inputRef} type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !isThinking && !isTranscribing && handleSend()} placeholder={isRecording ? "Escuchando..." : isTranscribing ? "Transcribiendo..." : placeholder} className="flex-1 bg-transparent border-none outline-none text-sm md:text-base text-gray-800 placeholder:text-gray-500 font-medium px-2 md:px-4 h-full min-w-0" autoComplete="off" disabled={!!pendingAction || !!decisionOptions || isRecording || isTranscribing} />
                
                <div className="flex items-center gap-2 pr-2 flex-shrink-0">
                     {isThinking || isTranscribing ? <div className="text-xs text-gray-400 animate-pulse">AI</div> : input.length > 0 ? <button onClick={(e) => { e.stopPropagation(); handleSend(); }} className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gray-100 hover:bg-black hover:text-white flex items-center justify-center transition-colors"><CornerDownLeft className="w-4 h-4 md:w-5 md:h-5" /></button> : <button onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }} className="hidden md:flex text-gray-300 hover:text-gray-500"><ChevronUp className={`w-5 h-5 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} /></button>}
                </div>
            </div>
            
            {/* Action Details Modal */}
            <ActionDetailsModal
                isOpen={detailsModal.isOpen}
                onClose={() => setDetailsModal(prev => ({ ...prev, isOpen: false }))}
                actionType={detailsModal.actionType}
                items={detailsModal.items}
                onUndo={detailsModal.messageId ? async () => {
                    const msg = messages.find(m => m.id === detailsModal.messageId);
                    if (msg) await handleUndoMessage(msg);
                    setDetailsModal(prev => ({ ...prev, isOpen: false }));
                } : undefined}
            />
        </div>
    );
};
