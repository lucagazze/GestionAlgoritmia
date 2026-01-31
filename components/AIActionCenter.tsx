
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ai } from '../services/ai';
import { db } from '../services/db';
import { Sparkles, ArrowRight, Loader2, Command, CornerDownLeft } from 'lucide-react';
import { TaskStatus, ProjectStatus } from '../types';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

export const AIActionCenter = () => {
    const navigate = useNavigate();
    const [input, setInput] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const [placeholder, setPlaceholder] = useState("¿Qué quieres hacer hoy?");
    const [history, setHistory] = useState<Message[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);

    // Auto-focus logic or shortcuts could go here
    
    const executeAction = async (actionType: string, payload: any) => {
        try {
            if (actionType === 'CREATE_TASK') {
                await db.tasks.create({
                    title: payload.title,
                    status: TaskStatus.TODO,
                    priority: payload.priority || 'MEDIUM',
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

    const handleKeyDown = async (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && input.trim()) {
            e.preventDefault();
            const userText = input;
            setInput('');
            setIsThinking(true);

            // Add user message to local history for context
            const newHistory: Message[] = [...history, { role: 'user', content: userText }];
            setHistory(newHistory);

            try {
                // Call AI Agent
                const response = await ai.agent(userText, newHistory);
                
                // Add AI response to history
                setHistory(prev => [...prev, { role: 'assistant', content: response.message }]);

                // Handle Behavior
                if (response.type === 'NAVIGATE') {
                    // Small delay to let the user read the message
                    setTimeout(() => {
                        navigate(response.payload);
                        setHistory([]); // Clear history on nav
                    }, 1000);
                } 
                else if (response.type === 'ACTION') {
                    const success = await executeAction(response.action, response.payload);
                    if (success) {
                         // Feedback is already in the message, maybe trigger a refresh via context if needed
                         // For now we assume optimistic updates or user will see it in the list
                    }
                }
                
                // If type is QUESTION or CHAT, the message is already added to history, 
                // we just wait for user to type again.

            } catch (error) {
                setHistory(prev => [...prev, { role: 'assistant', content: "Hubo un error técnico. Intenta de nuevo." }]);
            } finally {
                setIsThinking(false);
            }
        }
    };

    return (
        <div className="w-full max-w-2xl mx-auto mb-8 relative z-10">
            {/* Chat History Bubbles (Floating above) */}
            <div className="absolute bottom-full left-0 w-full mb-4 flex flex-col justify-end gap-2 max-h-60 overflow-y-auto px-2">
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
                ${isThinking ? 'ring-2 ring-indigo-400/50' : 'hover:bg-white/90 focus-within:bg-white focus-within:ring-2 focus-within:ring-black/5'}
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
                        placeholder={history.length > 0 ? "Escribe tu respuesta..." : placeholder}
                        className="flex-1 bg-transparent border-none outline-none text-lg text-gray-800 placeholder:text-gray-400 font-medium h-full"
                        autoComplete="off"
                    />

                    <div className="ml-2 flex items-center gap-2 text-gray-300">
                        {input.length > 0 && (
                            <div className="hidden md:flex items-center gap-1 text-xs font-bold border border-gray-200 rounded px-2 py-1 bg-gray-50">
                                ENTER <CornerDownLeft className="w-3 h-3" />
                            </div>
                        )}
                    </div>
                </div>
                
                {/* Decorative gradients */}
                <div className="absolute -inset-0.5 bg-gradient-to-r from-pink-500 via-indigo-500 to-cyan-500 rounded-2xl opacity-0 group-focus-within:opacity-10 transition-opacity -z-10 blur-md"></div>
            </div>
            
            {/* Examples (Only show if history is empty) */}
            {history.length === 0 && !isThinking && (
                <div className="flex justify-center gap-2 mt-4 opacity-60 hover:opacity-100 transition-opacity">
                    <button onClick={() => setInput("Crear nueva propuesta")} className="text-xs bg-white/50 px-3 py-1.5 rounded-full border border-gray-100 hover:bg-white hover:scale-105 transition-all">
                        "Crear propuesta"
                    </button>
                    <button onClick={() => setInput("Agendar tarea revisar emails prioridad alta")} className="text-xs bg-white/50 px-3 py-1.5 rounded-full border border-gray-100 hover:bg-white hover:scale-105 transition-all">
                        "Agendar tarea..."
                    </button>
                    <button onClick={() => setInput("Ver mis clientes")} className="text-xs bg-white/50 px-3 py-1.5 rounded-full border border-gray-100 hover:bg-white hover:scale-105 transition-all">
                        "Ver clientes"
                    </button>
                </div>
            )}
        </div>
    );
};
