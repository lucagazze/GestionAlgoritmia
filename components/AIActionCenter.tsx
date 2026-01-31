
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ai } from '../services/ai';
import { db } from '../services/db';
import { Sparkles, Loader2, CornerDownLeft, Mic, MicOff, ChevronUp } from 'lucide-react';
import { TaskStatus, ProjectStatus } from '../types';

interface Message {
    role: 'user' | 'assistant';
    content: string;
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
    const [history, setHistory] = useState<Message[]>([]);
    
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const recognitionRef = useRef<any>(null);

    // --- Click Outside Logic ---
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                if (isOpen) setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    // --- Auto Focus when opening ---
    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    // --- Voice Logic ---
    const toggleListening = () => {
        if (isListening) {
            recognitionRef.current?.stop();
            setIsListening(false);
            return;
        }

        const { webkitSpeechRecognition, SpeechRecognition } = window as unknown as IWindow;
        const Recognition = SpeechRecognition || webkitSpeechRecognition;

        if (!Recognition) {
            alert("Tu navegador no soporta reconocimiento de voz. Intenta usar Chrome.");
            return;
        }

        const recognition = new Recognition();
        recognitionRef.current = recognition;
        
        recognition.lang = 'es-ES';
        recognition.interimResults = true; // Show text while speaking
        recognition.continuous = false; // Stop after one sentence/command

        recognition.onstart = () => {
            setIsListening(true);
            setPlaceholder("Te escucho...");
            setIsOpen(true);
            setInput(''); // Clear input when starting fresh
        };

        recognition.onend = () => {
            setIsListening(false);
            setPlaceholder("¿Qué quieres hacer hoy?");
        };

        recognition.onresult = (event: any) => {
            let finalTranscript = '';
            let interimTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }

            if (finalTranscript) {
                setInput(finalTranscript);
            } else if (interimTranscript) {
                setInput(interimTranscript);
            }
        };

        recognition.onerror = (event: any) => {
            console.error("Speech Error:", event.error);
            setIsListening(false);
            if (event.error === 'not-allowed') {
                alert("Permiso de micrófono denegado. Por favor permítelo en tu navegador.");
            }
        };

        try {
            recognition.start();
        } catch (error) {
            console.error("Error starting speech recognition:", error);
            setIsListening(false);
        }
    };
    
    const executeAction = async (actionType: string, payload: any) => {
        try {
            if (actionType === 'CREATE_TASK') {
                await db.tasks.create({
                    title: payload.title,
                    status: TaskStatus.TODO,
                    priority: payload.priority || 'MEDIUM',
                    dueDate: payload.dueDate || null, 
                    description: 'Creado por AI Assistant'
                });
                window.dispatchEvent(new Event('task-created'));
                return true;
            }
            if (actionType === 'CREATE_PROJECT') {
                await db.projects.create({
                    name: payload.name,
                    monthlyRevenue: payload.monthlyRevenue || 0,
                    billingDay: 1,
                    status: ProjectStatus.ONBOARDING
                });
                window.dispatchEvent(new Event('project-created'));
                return true;
            }
            return false;
        } catch (e) {
            console.error("DB Execution Error:", e);
            return false;
        }
    };

    const handleSend = async (textOverride?: string) => {
        const userText = textOverride || input;
        if (!userText.trim()) return;

        // Stop listening if sending manually while listening
        if (isListening) {
            recognitionRef.current?.stop();
            setIsListening(false);
        }

        setInput('');
        setIsOpen(true);
        setIsThinking(true);

        const newHistory: Message[] = [...history, { role: 'user', content: userText }];
        setHistory(newHistory);

        try {
            const response = await ai.agent(userText, newHistory);
            
            let finalMessage = response.message;

            if (response.type === 'NAVIGATE') {
                setTimeout(() => {
                    navigate(response.payload);
                    setIsOpen(false); // Close after navigating
                }, 1500);
            } 
            else if (response.type === 'ACTION') {
                const success = await executeAction(response.action, response.payload);
                if (!success) {
                    finalMessage = "Error técnico guardando en base de datos. Verifica la consola.";
                }
            }

            setHistory(prev => [...prev, { role: 'assistant', content: finalMessage }]);

        } catch (error) {
            console.error(error);
            setHistory(prev => [...prev, { role: 'assistant', content: "Error crítico comunicando con la IA." }]);
        } finally {
            setIsThinking(false);
        }
    };

    const handleKeyDown = async (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !isThinking) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div 
            ref={containerRef}
            className={`
                fixed left-1/2 -translate-x-1/2 z-50 
                transition-all duration-500 ease-in-out
                w-[90%] md:w-[600px]
                ${isOpen ? 'bottom-8' : 'bottom-6'}
            `}
        >
            {/* --- Chat History (Expandable Upwards) --- */}
            <div className={`
                absolute bottom-full mb-3 w-full 
                bg-white/90 backdrop-blur-xl border border-white/50 shadow-2xl rounded-3xl
                overflow-hidden transition-all duration-300 origin-bottom
                ${isOpen && history.length > 0 ? 'opacity-100 scale-100 max-h-[60vh]' : 'opacity-0 scale-95 max-h-0 pointer-events-none'}
            `}>
                 <div className="flex justify-between items-center p-4 border-b border-gray-100/50 bg-gray-50/50">
                    <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-indigo-500" />
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Algoritmia AI</span>
                    </div>
                    <button onClick={() => setHistory([])} className="text-[10px] text-gray-400 hover:text-red-500">
                        Borrar Historial
                    </button>
                 </div>
                 
                 <div className="p-4 flex flex-col gap-3 overflow-y-auto custom-scrollbar max-h-[50vh]">
                    {history.map((msg, idx) => (
                        <div 
                            key={idx} 
                            className={`p-3 rounded-2xl text-sm max-w-[85%] shadow-sm animate-in slide-in-from-bottom-2 duration-300 ${
                                msg.role === 'user' 
                                ? 'bg-black text-white self-end rounded-br-sm' 
                                : 'bg-white text-gray-800 self-start border border-gray-100 rounded-bl-sm'
                            }`}
                        >
                            {msg.content}
                        </div>
                    ))}
                    {isThinking && (
                        <div className="self-start bg-white border border-gray-100 p-3 rounded-2xl rounded-bl-sm flex items-center gap-2">
                             <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                             <span className="text-xs text-gray-500">Procesando...</span>
                        </div>
                    )}
                 </div>
            </div>

            {/* --- Main Input Bar (The Floating Pill) --- */}
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
                {/* Icon Box */}
                <div className={`
                    w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center text-white shadow-lg transition-all duration-500
                    ${isThinking ? 'bg-indigo-600 rotate-180' : isListening ? 'bg-red-500 animate-pulse' : 'bg-black'}
                `}>
                    {isThinking ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                </div>

                {/* Input Field */}
                <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={isListening ? "Te escucho..." : placeholder}
                    className="flex-1 bg-transparent border-none outline-none text-base text-gray-800 placeholder:text-gray-500 font-medium px-4 h-full"
                    autoComplete="off"
                />

                {/* Actions Right */}
                <div className="flex items-center gap-2 pr-2">
                     <button 
                        onClick={(e) => { e.stopPropagation(); toggleListening(); }}
                        className={`p-2 rounded-full transition-all ${isListening ? 'text-red-500 bg-red-50' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
                        title="Activar/Desactivar Micrófono"
                    >
                        {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                    </button>

                    {input.length > 0 ? (
                        <button 
                            onClick={(e) => { e.stopPropagation(); handleSend(); }}
                            className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gray-100 hover:bg-black hover:text-white flex items-center justify-center transition-colors"
                        >
                            <CornerDownLeft className="w-4 h-4 md:w-5 md:h-5" />
                        </button>
                    ) : (
                         // Toggle Button (Open/Close visually)
                         <button 
                            onClick={(e) => { 
                                e.stopPropagation(); 
                                setIsOpen(!isOpen); 
                            }}
                            className="hidden md:flex text-gray-300 hover:text-gray-500"
                        >
                            <ChevronUp className={`w-5 h-5 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                        </button>
                    )}
                </div>
            </div>
            
            {/* Hints when closed or empty */}
            {(!isOpen && history.length === 0) && (
                 <div className="absolute -top-10 left-0 w-full flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
                    <span className="bg-black/80 text-white text-[10px] px-3 py-1 rounded-full backdrop-blur-md">
                        Prueba: "Crear tarea llamar cliente mañana"
                    </span>
                 </div>
            )}
        </div>
    );
};
