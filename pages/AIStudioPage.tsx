
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { claudeChat, buildAgencyContext, QUICK_PROMPTS, ClaudeMessage } from '../services/claude';
import { db } from '../services/db';
import { useToast } from '../components/Toast';
import {
  Send, Sparkles, Copy, Trash2, Plus, Settings,
  Loader2, ChevronDown, RotateCcw, Zap, Bot,
  CheckCircle2, AlertCircle, User, ArrowRight,
  FileText, BarChart3, Target, Lightbulb, MessageCircle,
  TrendingUp, Download, X
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────
interface UIMessage extends ClaudeMessage {
  id: string;
  timestamp: Date;
  isLoading?: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────
const generateId = () => Math.random().toString(36).slice(2);

const formatText = (text: string) => {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^### (.*$)/gm, '<h3 class="text-base font-bold text-gray-900 dark:text-white mt-4 mb-2">$1</h3>')
    .replace(/^## (.*$)/gm, '<h2 class="text-lg font-bold text-gray-900 dark:text-white mt-5 mb-2">$1</h2>')
    .replace(/^# (.*$)/gm, '<h1 class="text-xl font-bold text-gray-900 dark:text-white mt-5 mb-3">$1</h1>')
    .replace(/^- (.*$)/gm, '<li class="ml-4 list-disc text-gray-700 dark:text-gray-300">$1</li>')
    .replace(/^\d+\. (.*$)/gm, '<li class="ml-4 list-decimal text-gray-700 dark:text-gray-300">$1</li>')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');
};

// ── Message Bubble ─────────────────────────────────────────────────────
const MessageBubble = ({ msg, onCopy }: { msg: UIMessage; onCopy: (text: string) => void }) => {
  const isUser = msg.role === 'user';
  const isLoading = msg.isLoading;

  if (isUser) {
    return (
      <div className="flex justify-end mb-4 animate-in slide-in-from-right-4 duration-300">
        <div className="max-w-[75%]">
          <div className="bg-gray-900 dark:bg-white text-white dark:text-black px-5 py-3.5 rounded-3xl rounded-br-lg shadow-sm">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
          </div>
          <p className="text-right text-[10px] text-gray-400 mt-1 mr-2">
            {msg.timestamp.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 mb-6 animate-in slide-in-from-left-4 duration-300">
      <div className="w-8 h-8 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-md">
        <Bot className="w-4 h-4 text-white" />
      </div>
      <div className="flex-1 max-w-[85%]">
        <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-3xl rounded-tl-lg px-5 py-4 shadow-sm">
          {isLoading ? (
            <div className="flex items-center gap-2 h-6">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-xs text-gray-400">Pensando...</span>
            </div>
          ) : (
            <div
              className="text-sm leading-relaxed text-gray-700 dark:text-gray-200 prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: formatText(msg.content) }}
            />
          )}
        </div>
        {!isLoading && (
          <div className="flex items-center gap-2 mt-1.5 ml-2">
            <p className="text-[10px] text-gray-400">
              {msg.timestamp.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
            </p>
            <button
              onClick={() => onCopy(msg.content)}
              className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-indigo-500 transition-colors"
            >
              <Copy className="w-3 h-3" /> Copiar
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Quick Action Card ──────────────────────────────────────────────────
const QuickCard = ({ action, onClick }: { action: typeof QUICK_PROMPTS[0]; onClick: () => void }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-3 p-4 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl hover:border-indigo-200 dark:hover:border-indigo-700 hover:shadow-md transition-all duration-200 text-left group w-full"
  >
    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${action.color} flex items-center justify-center flex-shrink-0 text-lg shadow-sm group-hover:scale-110 transition-transform`}>
      {action.icon}
    </div>
    <div className="min-w-0">
      <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{action.label}</p>
    </div>
    <ArrowRight className="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-indigo-500 ml-auto flex-shrink-0 transition-colors" />
  </button>
);

// ── Main Component ─────────────────────────────────────────────────────
export default function AIStudioPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [systemContext, setSystemContext] = useState<string>('');
  const [isLoadingContext, setIsLoadingContext] = useState(true);
  const [showQuickActions, setShowQuickActions] = useState(true);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load API key and build context
  useEffect(() => {
    const init = async () => {
      const key = await db.settings.getApiKey('claude_api_key');
      setHasApiKey(!!key);

      if (key) {
        setIsLoadingContext(true);
        const ctx = await buildAgencyContext();
        setSystemContext(ctx);
        setIsLoadingContext(false);

        // Welcome message
        setMessages([{
          id: generateId(),
          role: 'assistant',
          content: `¡Hola, Luca! 👋 Soy tu asistente de agencia. Tengo acceso a toda la info de tus clientes, tareas, pagos y campañas.\n\n¿En qué te ayudo hoy? Podés preguntarme cualquier cosa sobre tus clientes, pedirme que te genere propuestas, estrategias de contenido, scripts de venta, análisis de campañas... lo que necesites.`,
          timestamp: new Date(),
        }]);
      } else {
        setIsLoadingContext(false);
      }
    };
    init();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;
    if (!hasApiKey) {
      showToast('Configurá tu Claude API Key en Ajustes primero.', 'error');
      navigate('/settings');
      return;
    }

    const userMsg: UIMessage = {
      id: generateId(),
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    };
    const loadingMsg: UIMessage = {
      id: generateId(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isLoading: true,
    };

    setMessages(prev => [...prev, userMsg, loadingMsg]);
    setInput('');
    setIsLoading(true);
    setShowQuickActions(false);

    // Build conversation history for API
    const history: ClaudeMessage[] = messages
      .filter(m => !m.isLoading)
      .map(m => ({ role: m.role, content: m.content }));
    history.push({ role: 'user', content: text.trim() });

    try {
      const response = await claudeChat(history, systemContext);
      setMessages(prev => prev.map(m =>
        m.isLoading
          ? { ...m, content: response, isLoading: false, timestamp: new Date() }
          : m
      ));
    } catch (e: any) {
      const errText = e.message === 'NO_API_KEY'
        ? 'No encontré tu API Key de Claude. Andá a Ajustes y agregala.'
        : `Error al conectar con Claude: ${e.message}`;
      setMessages(prev => prev.map(m =>
        m.isLoading
          ? { ...m, content: errText, isLoading: false, timestamp: new Date() }
          : m
      ));
      showToast(errText.slice(0, 60), 'error');
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [messages, isLoading, hasApiKey, systemContext, navigate, showToast]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast('Copiado al portapapeles', 'success');
  };

  const handleClear = () => {
    setMessages([]);
    setShowQuickActions(true);
  };

  const handleQuickAction = (action: typeof QUICK_PROMPTS[0]) => {
    const prompt = action.prompt();
    setInput(prompt);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  // Auto-resize textarea
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px';
  };

  // ── No API Key screen ────────────────────────────────────────────────
  if (hasApiKey === false) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="max-w-md text-center space-y-6 p-8">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-500 to-violet-600 mx-auto flex items-center justify-center shadow-2xl shadow-indigo-500/30">
            <Bot className="w-10 h-10 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Conectá la IA</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">
              Para usar el AI Studio necesitás una API Key de Anthropic (Claude). Es gratis para empezar y vale la pena.
            </p>
          </div>
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900 rounded-2xl p-4 text-left">
            <p className="text-sm font-bold text-amber-800 dark:text-amber-200 mb-1">¿Cómo conseguirla?</p>
            <ol className="text-sm text-amber-700 dark:text-amber-300 space-y-1 list-decimal list-inside">
              <li>Entrá a console.anthropic.com</li>
              <li>Creá una cuenta y generá una API Key</li>
              <li>Pegala en Ajustes → Claude API Key</li>
            </ol>
          </div>
          <button
            onClick={() => navigate('/settings')}
            className="w-full py-3.5 bg-gray-900 dark:bg-white text-white dark:text-black rounded-2xl font-bold text-sm hover:bg-black dark:hover:bg-gray-100 transition-colors shadow-lg flex items-center justify-center gap-2"
          >
            <Settings className="w-4 h-4" /> Ir a Ajustes
          </button>
        </div>
      </div>
    );
  }

  // ── Loading context ──────────────────────────────────────────────────
  if (isLoadingContext) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 mx-auto flex items-center justify-center animate-pulse">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <p className="text-gray-500 text-sm">Cargando contexto de la agencia...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-h-[900px] animate-in fade-in duration-300">

      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white leading-none">AI Studio</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
              Claude Sonnet · Con contexto de agencia
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {messages.length > 0 && (
            <button
              onClick={handleClear}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-500 hover:text-gray-900 dark:hover:text-white bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Nueva conversación
            </button>
          )}
          <button
            onClick={() => navigate('/settings')}
            className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 transition-all"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Quick Actions — shown when chat is empty */}
      {showQuickActions && messages.length <= 1 && (
        <div className="flex-shrink-0 mb-4">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Acciones rápidas</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {QUICK_PROMPTS.map((action) => (
              <QuickCard
                key={action.label}
                action={action}
                onClick={() => handleQuickAction(action)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar rounded-2xl bg-gray-50/50 dark:bg-slate-900/30 p-4 mb-4 min-h-0">
        {messages.length === 0 && !showQuickActions && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-3 opacity-50">
            <Bot className="w-10 h-10 text-gray-300" />
            <p className="text-sm text-gray-400">Empezá una conversación</p>
          </div>
        )}
        {messages.map(msg => (
          <MessageBubble key={msg.id} msg={msg} onCopy={handleCopy} />
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* Input Area */}
      <div className="flex-shrink-0">
        {/* Suggestion chips while typing */}
        {input.length === 0 && messages.length > 0 && !isLoading && (
          <div className="flex gap-2 mb-2 overflow-x-auto no-scrollbar pb-1">
            {QUICK_PROMPTS.slice(0, 4).map(a => (
              <button
                key={a.label}
                onClick={() => handleQuickAction(a)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-full whitespace-nowrap hover:border-indigo-300 hover:text-indigo-600 transition-all"
              >
                <span>{a.icon}</span> {a.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-3 items-end bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-3 shadow-sm focus-within:border-indigo-300 dark:focus-within:border-indigo-600 focus-within:ring-2 focus-within:ring-indigo-100 dark:focus-within:ring-indigo-900/30 transition-all">
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Preguntame algo... o seleccioná una acción rápida arriba"
            rows={1}
            disabled={isLoading}
            className="flex-1 resize-none bg-transparent border-none outline-none text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 leading-relaxed min-h-[24px] max-h-40 disabled:opacity-50"
            style={{ height: '24px' }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading}
            className="w-9 h-9 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-black flex items-center justify-center flex-shrink-0 hover:bg-indigo-600 dark:hover:bg-indigo-500 hover:text-white transition-all disabled:opacity-30 disabled:pointer-events-none shadow-sm active:scale-95"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-center text-[10px] text-gray-400 mt-2">
          Enter para enviar · Shift+Enter para nueva línea · Powered by Claude Sonnet
        </p>
      </div>
    </div>
  );
}
