
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ai } from '../services/ai';
import { db } from '../services/db';
import { Sparkles, ArrowRight, Loader2, Command, CornerDownLeft, Mic, MicOff } from 'lucide-react';
import { TaskStatus, ProjectStatus } from '../types';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

// Web Speech API Interface
interface IWindow extends Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
}

export const AIActionCenter = () => {
    const navigate = useNavigate();
    const [input, setInput] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [placeholder, setPlaceholder] = useState("¿Qué quieres hacer hoy?");
    const [history, setHistory] = useState<Message[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);

    // --- Voice Recognition Logic ---
    const startListening = () => {
        const { webkitSpeechRecognition, SpeechRecognition } = window as unknown as IWindow;
        const Recognition = SpeechRecognition || webkitSpeechRecognition;

        if (!Recognition) {
            alert("Tu navegador no soporta reconocimiento de voz. Usa Chrome.");
            return;
        }

        const recognition = new Recognition();
        recognition.lang = 'es-ES';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
            setIsListening(true);
            setPlaceholder("Escuchando...");
        };

        recognition.onend = () => {
            setIsListening(false);
            setPlaceholder("¿Qué quieres hacer hoy?");
        };

        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            setInput(transcript);
            // Optional: Auto-submit after voice
            // handleSend(transcript); 
        };

        recognition.start();
    };
    
    const executeAction = async (actionType: string, payload: any) => {
        try {
            if (actionType === 'CREATE_TASK') {
                await db.tasks.create({
                    title: payload.title,
                    status: TaskStatus.TODO,
                    priority: payload.priority || 'MEDIUM',
                    dueDate: payload.dueDate || null, // Handles the date from AI
                    description: 'Creado por AI Assistant'
                });
                return true;
            }
            if (actionType === 'CREATE_PROJECT') {
                await db.projects.create({
                    name: payload.name,
                    monthlyRevenue: payload.monthlyRevenue || 0,
                    billingDay: 1,
                    status: ProjectStatus.ONBOARDING
                });
                return true;
            }
            return false;
        } catch (e) {
            console.error(e);
            return false;
        }
    };

    const handleSend = async (textOverride?: string) => {
        const userText = textOverride || input;
        if (!userText.trim()) return;

        setInput('');
        setIsThinking(true);

        const newHistory: Message[] = [...history, { role: 'user', content: userText }];
        setHistory(newHistory);

        try {
            const response = await ai.agent(userText, newHistory);
            
            setHistory(prev => [...prev, { role: 'assistant', content: response.message }]);

            if (response.type === 'NAVIGATE') {
                setTimeout(() => {
                    navigate(response.payload);
                    setHistory([]); 
                }, 1000);
            } 
            else if (response.type === 'ACTION') {
                const success = await executeAction(response.action, response.payload);
                if (success) {
                    // Trigger custom event or context update if needed
                }
            }

        } catch (error) {
            setHistory(prev => [...prev, { role: 'assistant', content: "Hubo un error técnico. Intenta de nuevo." }]);
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
        <div className="w-full max-w-2xl mx-auto mb-8 relative z-10">
            {/* Chat History Bubbles */}
            <div className="absolute bottom-full left-0 w-full mb-4 flex flex-col justify-end gap-2 max-h-60 overflow-y-auto px-2 custom-scrollbar">
                {history.length > 0 && history.map((msg, idx) => (
                    <div 
                        key={idx} 
                        className={`p-3 rounded-2xl text-sm max-w-[80%] shadow-sm backdrop-blur-md animate-in slide-in-from-bottom-2 duration-300 ${
                            msg.role === 'user' 
                            ? 'bg-black/80 text-white self-end rounded-br-sm' 
                            : 'bg-white/80 text-gray-800 self-start border border-white/50 rounded-bl-sm'
                        }`}
                    >
                        {msg.content}
                    </div>
                ))}
            </div>

            {/* Main Input Bar */}
            <div className={`
                relative group
                bg-white/70 backdrop-blur-xl border border-white/50 
                shadow-2xl shadow-indigo-500/10 rounded-2xl 
                transition-all duration-300
                ${isThinking ? 'ring-2 ring-indigo-400/50' : isListening ? 'ring-2 ring-red-400/50' : 'hover:bg-white/90 focus-within:bg-white focus-within:ring-2 focus-within:ring-black/5'}
            `}>
                <div className="flex items-center px-4 h-16">
                    <div className="mr-4 text-indigo-500">
                        {isThinking ? (
                            <Loader2 className="w-6 h-6 animate-spin" />
                        ) : (
                            <Sparkles className="w-6 h-6 animate-pulse" />
                        )}
                    </div>
                    
                    <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={placeholder}
                        className="flex-1 bg-transparent border-none outline-none text-lg text-gray-800 placeholder:text-gray-400 font-medium h-full"
                        autoComplete="off"
                        disabled={isListening}
                    />

                    <div className="ml-2 flex items-center gap-2">
                         {/* Voice Button */}
                        <button 
                            onClick={startListening}
                            className={`p-2 rounded-full transition-all duration-300 ${isListening ? 'bg-red-500 text-white animate-pulse' : 'hover:bg-gray-100 text-gray-400 hover:text-gray-600'}`}
                            title="Usar micrófono"
                        >
                            {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                        </button>

                        {input.length > 0 && (
                            <button 
                                onClick={() => handleSend()}
                                className="hidden md:flex items-center gap-1 text-xs font-bold border border-gray-200 rounded px-2 py-1 bg-gray-50 hover:bg-black hover:text-white transition-colors"
                            >
                                ENTER <CornerDownLeft className="w-3 h-3" />
                            </button>
                        )}
                    </div>
                </div>
                
                {/* Decorative gradients */}
                <div className={`absolute -inset-0.5 bg-gradient-to-r from-pink-500 via-indigo-500 to-cyan-500 rounded-2xl opacity-0 transition-opacity -z-10 blur-md ${isListening ? 'opacity-20' : 'group-focus-within:opacity-10'}`}></div>
            </div>
            
            {/* Examples (Only show if history is empty) */}
            {history.length === 0 && !isThinking && !isListening && (
                <div className="flex justify-center gap-2 mt-4 opacity-60 hover:opacity-100 transition-opacity">
                    <button onClick={() => setInput("Agendar tarea comer pizza mañana 19hs")} className="text-xs bg-white/50 px-3 py-1.5 rounded-full border border-gray-100 hover:bg-white hover:scale-105 transition-all">
                        "Agendar tarea..."
                    </button>
                    <button onClick={() => setInput("Crear nueva propuesta")} className="text-xs bg-white/50 px-3 py-1.5 rounded-full border border-gray-100 hover:bg-white hover:scale-105 transition-all">
                        "Crear propuesta"
                    </button>
                </div>
            )}
        </div>
    );
};
