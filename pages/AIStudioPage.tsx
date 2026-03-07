
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
    .replace(/^### (.*$)/gm, '<h3 class="text-[14px] font-bold text-zinc-900 dark:text-white mt-4 mb-2 tracking-tight">$1</h3>')
    .replace(/^## (.*$)/gm, '<h2 class="text-[16px] font-bold text-zinc-900 dark:text-white mt-5 mb-2 tracking-tight">$1</h2>')
    .replace(/^# (.*$)/gm, '<h1 class="text-[18px] font-bold text-zinc-900 dark:text-white mt-5 mb-3 tracking-tight">$1</h1>')
    .replace(/^- (.*$)/gm, '<li class="ml-4 list-disc text-zinc-700 dark:text-zinc-300">$1</li>')
    .replace(/^\d+\. (.*$)/gm, '<li class="ml-4 list-decimal text-zinc-700 dark:text-zinc-300">$1</li>')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');
};

// ── Message Bubble ─────────────────────────────────────────────────────
const MessageBubble = ({ msg, onCopy }: { msg: UIMessage; onCopy: (text: string) => void }) => {
  const isUser = msg.role === 'user';
  const isLoading = msg.isLoading;

  if (isUser) {
    return (
      <div className="flex justify-end mb-3">
        <div className="max-w-[78%]">
          <div className="bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-4 py-3 rounded-2xl rounded-br-sm shadow-[0_2px_8px_rgba(0,0,0,0.15)]">
            <p className="text-[13px] leading-relaxed whitespace-pre-wrap tracking-[-0.01em]">{msg.content}</p>
          </div>
          <p className="text-right text-[10px] text-zinc-400 mt-1 mr-1">
            {msg.timestamp.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2.5 mb-5">
      <div className="w-7 h-7 rounded-[8px] bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
        <Bot className="w-3.5 h-3.5 text-white" />
      </div>
      <div className="flex-1 max-w-[88%]">
        <div className="bg-white dark:bg-zinc-900 border border-black/[0.05] dark:border-white/[0.07] rounded-2xl rounded-tl-sm px-4 py-3.5 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
          {isLoading ? (
            <div className="flex items-center gap-2 h-5">
              <div className="flex gap-1">
                {[0, 150, 300].map(d => (
                  <span key={d} className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                ))}
              </div>
              <span className="text-[12px] text-zinc-400">Pensando...</span>
            </div>
          ) : (
            <div
              className="text-[13px] leading-relaxed text-zinc-700 dark:text-zinc-200 tracking-[-0.01em]"
              dangerouslySetInnerHTML={{ __html: formatText(msg.content) }}
            />
          )}
        </div>
        {!isLoading && (
          <div className="flex items-center gap-2 mt-1 ml-1">
            <p className="text-[10px] text-zinc-400">
              {msg.timestamp.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
            </p>
            <button onClick={() => onCopy(msg.content)} className="flex items-center gap-1 text-[10px] text-zinc-400 hover:text-indigo-500 transition-colors">
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
    className="flex items-center gap-3 p-3.5 bg-white dark:bg-zinc-900 border border-black/[0.04] dark:border-white/[0.06] rounded-[14px] hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 text-left group w-full shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
  >
    <div className={`w-9 h-9 rounded-[10px] bg-gradient-to-br ${action.color} flex items-center justify-center flex-shrink-0 text-base shadow-sm`}>
      {action.icon}
    </div>
    <p className="text-[13px] font-semibold text-zinc-900 dark:text-white tracking-[-0.01em] flex-1 min-w-0 truncate">{action.label}</p>
    <ArrowRight className="w-3.5 h-3.5 text-zinc-300 dark:text-zinc-600 group-hover:text-indigo-500 flex-shrink-0 transition-colors" />
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
        <div className="max-w-sm text-center space-y-5 p-6">
          <div className="w-16 h-16 rounded-[20px] bg-gradient-to-br from-indigo-500 to-violet-600 mx-auto flex items-center justify-center shadow-[0_8px_32px_rgba(99,102,241,0.4)]">
            <Bot className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-[20px] font-bold tracking-[-0.02em] text-zinc-900 dark:text-white">Conectá la IA</h1>
            <p className="text-[13px] text-zinc-500 dark:text-zinc-400 mt-1.5 leading-relaxed">
              Para usar el AI Studio necesitás una API Key de Anthropic. Entrá a console.anthropic.com y pegala en Ajustes.
            </p>
          </div>
          <button
            onClick={() => navigate('/settings')}
            className="w-full h-11 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-[12px] font-semibold text-[13px] tracking-[-0.01em] hover:bg-black dark:hover:bg-zinc-100 active:scale-[0.97] transition-all shadow-[0_1px_3px_rgba(0,0,0,0.15)] flex items-center justify-center gap-2"
          >
            <Settings className="w-4 h-4" /> Ir a Ajustes
          </button>
        </div>
      </div>
    );
  }

  if (isLoadingContext) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-[12px] bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div className="w-4 h-4 border-2 border-zinc-200 dark:border-zinc-700 border-t-indigo-500 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-h-[900px]">

      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-[10px] bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-[0_2px_8px_rgba(99,102,241,0.35)]">
            <Bot className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <h1 className="text-[17px] font-bold tracking-[-0.02em] text-zinc-900 dark:text-white leading-none">AI Studio</h1>
            <p className="text-[11px] text-zinc-400 mt-0.5 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
              Claude Sonnet · Contexto de agencia cargado
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {messages.length > 0 && (
            <button onClick={handleClear} className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-[10px] hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all">
              <RotateCcw className="w-3.5 h-3.5" /> Nueva
            </button>
          )}
          <button onClick={() => navigate('/settings')} className="p-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-[10px] hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all">
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      {showQuickActions && messages.length <= 1 && (
        <div className="flex-shrink-0 mb-4">
          <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-[0.08em] mb-2.5">Acciones rápidas</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {QUICK_PROMPTS.map(a => <QuickCard key={a.label} action={a} onClick={() => handleQuickAction(a)} />)}
          </div>
        </div>
      )}

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto rounded-2xl bg-zinc-50/60 dark:bg-zinc-800/20 p-4 mb-3 min-h-0 border border-black/[0.03] dark:border-white/[0.04]">
        {messages.length === 0 && !showQuickActions && (
          <div className="flex flex-col items-center justify-center h-full gap-2 opacity-40">
            <Bot className="w-8 h-8 text-zinc-400" />
            <p className="text-[13px] text-zinc-400">Empezá una conversación</p>
          </div>
        )}
        {messages.map(msg => <MessageBubble key={msg.id} msg={msg} onCopy={handleCopy} />)}
        <div ref={chatEndRef} />
      </div>

      {/* Input Area */}
      <div className="flex-shrink-0">
        {input.length === 0 && messages.length > 0 && !isLoading && (
          <div className="flex gap-1.5 mb-2 overflow-x-auto pb-1">
            {QUICK_PROMPTS.slice(0, 4).map(a => (
              <button key={a.label} onClick={() => handleQuickAction(a)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-full whitespace-nowrap hover:border-indigo-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all">
                <span>{a.icon}</span>{a.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2.5 items-end bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-2xl p-3 shadow-[0_1px_4px_rgba(0,0,0,0.06)] focus-within:border-indigo-300 dark:focus-within:border-indigo-500/50 focus-within:shadow-[0_0_0_3px_rgba(99,102,241,0.1)] transition-all">
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Preguntame algo..."
            rows={1}
            disabled={isLoading}
            className="flex-1 resize-none bg-transparent border-none outline-none text-[13px] text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600 leading-relaxed tracking-[-0.01em] min-h-[22px] max-h-40 disabled:opacity-50"
            style={{ height: '22px' }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading}
            className="w-8 h-8 rounded-[9px] bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 flex items-center justify-center flex-shrink-0 hover:bg-indigo-600 hover:text-white transition-all disabled:opacity-30 disabled:pointer-events-none active:scale-[0.95]"
          >
            {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          </button>
        </div>
        <p className="text-center text-[10px] text-zinc-400 mt-1.5">
          Enter para enviar · Shift+Enter para nueva línea
        </p>
      </div>
    </div>
  );
}
