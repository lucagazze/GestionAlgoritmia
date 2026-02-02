
import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { ai } from '../services/ai';
import { Project } from '../types';
import { Button, Card, Input, Label, Textarea, Badge } from '../components/UIComponents';
import { 
  MessageSquareMore, 
  Sparkles, 
  BrainCircuit, 
  Copy, 
  CheckCircle2, 
  User, 
  Loader2, 
  Send,
  Target,
  ShieldAlert,
  Zap
} from 'lucide-react';

type Mode = 'SCRIPT' | 'ANALYSIS';

export default function SalesCopilotPage() {
  const [activeMode, setActiveMode] = useState<Mode>('SCRIPT');
  const [clients, setClients] = useState<Project[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  
  // Script State
  const [scriptContext, setScriptContext] = useState(''); // e.g., Cold outreach, follow up
  const [scriptGoal, setScriptGoal] = useState(''); // e.g., Get a meeting
  const [generatedScript, setGeneratedScript] = useState('');
  
  // Analysis State
  const [conversationInput, setConversationInput] = useState('');
  const [analysisResult, setAnalysisResult] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [useBrain, setUseBrain] = useState(true); // ✅ Nuevo Toggle

  useEffect(() => {
    const load = async () => {
      const data = await db.projects.getAll();
      setClients(data);
    };
    load();
  }, []);

  const getClientName = () => {
      if (!selectedClientId) return "Cliente Potencial";
      return clients.find(c => c.id === selectedClientId)?.name || "Cliente";
  };
  
  const getClientIndustry = () => {
      if (!selectedClientId) return "General";
      return clients.find(c => c.id === selectedClientId)?.industry || "General";
  };

  const handleGenerate = async () => {
      setLoading(true);
      try {
          let memoryContext = "";
          
          // 🧠 RAG: Consultar al Cerebro si está activo
          if (useBrain && scriptGoal) {
              // Buscamos memorias relacionadas con el objetivo (ej: "Vender web inmobiliaria")
              const retrieved = await ai.retrieveContext(`${scriptGoal} ${getClientIndustry()}`);
              if (retrieved) {
                  memoryContext = `\n\nUSAR ESTAS LECCIONES APRENDIDAS DE LA AGENCIA:\n${retrieved}`;
              }
          }

          const result = await ai.salesCoach('SCRIPT', {
              context: scriptContext + memoryContext, // Inyectamos la memoria aquí
              goal: scriptGoal,
              clientName: getClientName(),
              industry: getClientIndustry()
          });
          
          setGeneratedScript(result || "No se pudo generar.");
      } catch (e) {
          console.error(e);
      } finally {
          setLoading(false);
      }
  };

  const handleAnalyze = async () => {
      if(!conversationInput) return;
      setLoading(true);
      try {
          const result = await ai.salesCoach('ANALYSIS', {
              lastMessage: conversationInput,
              clientName: getClientName(),
              history: "Interacción en curso..."
          });
          setAnalysisResult(result || "No se pudo analizar.");
      } catch (e) {
          console.error(e);
      } finally {
          setLoading(false);
      }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-6xl mx-auto pb-20">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-3">
             <BrainCircuit className="w-8 h-8 text-indigo-600" /> Copiloto de Ventas
          </h1>
          <p className="text-gray-500 mt-2">Tu Director Comercial IA. Genera guiones persuasivos y analiza conversaciones en tiempo real.</p>
        </div>
        
        {/* Client Selector (Global for the page) */}
        <div className="w-full md:w-64">
             <select 
                className="flex h-11 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-black shadow-sm"
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
             >
                 <option value="">-- Seleccionar Cliente (Opcional) --</option>
                 {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
             </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Sidebar / Mode Selector */}
          <div className="lg:col-span-3 space-y-2">
              <button 
                onClick={() => setActiveMode('SCRIPT')}
                className={`w-full text-left p-4 rounded-xl flex items-center gap-3 transition-all duration-200 ${activeMode === 'SCRIPT' ? 'bg-black text-white shadow-lg' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                  <MessageSquareMore className="w-5 h-5" />
                  <div>
                      <span className="font-bold block text-sm">Generador de Guiones</span>
                      <span className={`text-xs ${activeMode === 'SCRIPT' ? 'text-gray-300' : 'text-gray-400'}`}>Emails, Llamadas, WhatsApp</span>
                  </div>
              </button>

              <button 
                onClick={() => setActiveMode('ANALYSIS')}
                className={`w-full text-left p-4 rounded-xl flex items-center gap-3 transition-all duration-200 ${activeMode === 'ANALYSIS' ? 'bg-black text-white shadow-lg' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                  <Target className="w-5 h-5" />
                  <div>
                      <span className="font-bold block text-sm">Deal Doctor (Análisis)</span>
                      <span className={`text-xs ${activeMode === 'ANALYSIS' ? 'text-gray-300' : 'text-gray-400'}`}>Analiza respuestas y objeciones</span>
                  </div>
              </button>
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-9">
              
              {/* --- MODE 1: SCRIPT GENERATOR --- */}
              {activeMode === 'SCRIPT' && (
                  <div className="space-y-6 animate-in slide-in-from-right-2 duration-300">
                      <Card>
                          <div className="p-6 space-y-6">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  <div>
                                      <Label>Contexto / Canal</Label>
                                      <select 
                                        className="flex h-12 w-full rounded-xl border border-gray-200 bg-gray-50/50 px-3 py-2 text-sm outline-none focus:border-black"
                                        value={scriptContext}
                                        onChange={(e) => setScriptContext(e.target.value)}
                                      >
                                          <option value="">Selecciona...</option>
                                          <option value="Cold Email (Primer contacto)">Cold Email (Primer contacto)</option>
                                          <option value="Mensaje de LinkedIn">Mensaje de LinkedIn</option>
                                          <option value="WhatsApp de Seguimiento (Visto)">WhatsApp de Seguimiento (Me clavó visto)</option>
                                          <option value="WhatsApp de Seguimiento (Post-Propuesta)">WhatsApp de Seguimiento (Post-Propuesta)</option>
                                          <option value="Manejo de Objeción (Precio)">Respuesta a "Es muy caro"</option>
                                          <option value="Cierre de Venta">Mensaje de Cierre</option>
                                      </select>
                                  </div>
                                  <div>
                                      <Label>Objetivo Específico</Label>
                                      <Input 
                                        placeholder="Ej: Agendar una call de 15 min..." 
                                        value={scriptGoal}
                                        onChange={(e) => setScriptGoal(e.target.value)}
                                      />
                                  </div>
                              </div>
                              <div className="flex items-center gap-2 mb-4">
                                  <input 
                                      type="checkbox" 
                                      id="useBrain" 
                                      checked={useBrain} 
                                      onChange={e => setUseBrain(e.target.checked)}
                                      className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                                  />
                                  <label htmlFor="useBrain" className="text-sm text-gray-700 flex items-center gap-1 cursor-pointer select-none">
                                      <BrainCircuit className="w-4 h-4 text-purple-600" /> 
                                      Consultar "El Cerebro de la Agencia" (Casos pasados y Lecciones)
                                  </label>
                              </div>
                              <Button onClick={handleGenerate} disabled={loading || !scriptContext} className="w-full h-12 text-base shadow-xl shadow-indigo-500/10 bg-indigo-600 hover:bg-indigo-700 text-white border-transparent">
                                  {loading ? <Loader2 className="animate-spin" /> : <><Sparkles className="w-5 h-5 mr-2" /> Generar Estrategia Maestra</>}
                              </Button>
                          </div>
                      </Card>

                      {generatedScript && (
                          <div className="bg-white border border-gray-200 rounded-3xl p-8 shadow-sm relative overflow-hidden group">
                               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
                               <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                   <Button variant="secondary" size="sm" onClick={() => navigator.clipboard.writeText(generatedScript)}>
                                       <Copy className="w-4 h-4 mr-2" /> Copiar
                                   </Button>
                               </div>
                               <div className="prose prose-sm max-w-none text-gray-700">
                                   <div className="whitespace-pre-wrap font-medium leading-relaxed font-mono text-sm bg-gray-50 p-4 rounded-xl border border-gray-100">
                                       {generatedScript}
                                   </div>
                               </div>
                          </div>
                      )}
                  </div>
              )}

              {/* --- MODE 2: DEAL DOCTOR --- */}
              {activeMode === 'ANALYSIS' && (
                  <div className="space-y-6 animate-in slide-in-from-right-2 duration-300">
                       <Card className="bg-gradient-to-br from-gray-900 to-gray-800 text-white border-0 shadow-2xl">
                           <div className="p-6">
                               <div className="flex items-center gap-3 mb-4">
                                   <ShieldAlert className="w-6 h-6 text-red-400" />
                                   <h3 className="font-bold text-lg">Centro de Crisis & Análisis</h3>
                               </div>
                               <p className="text-gray-400 text-sm mb-6">
                                   Pega el último mensaje del cliente (o un resumen de la llamada). 
                                   La IA analizará el subtexto psicológico y te dirá exactamente qué responder para salvar o cerrar el deal.
                               </p>
                               
                               <div className="relative">
                                   <Textarea 
                                      className="bg-white/10 border-white/10 text-white placeholder:text-gray-500 min-h-[120px] focus:ring-white/20"
                                      placeholder='El cliente dijo: "Me gusta la propuesta pero se nos va de presupuesto y tenemos que consultarlo con el socio..."'
                                      value={conversationInput}
                                      onChange={(e) => setConversationInput(e.target.value)}
                                   />
                                   <div className="absolute bottom-3 right-3">
                                       <Button size="sm" onClick={handleAnalyze} disabled={loading || !conversationInput} className="bg-white text-black hover:bg-gray-200 border-none">
                                            {loading ? <Loader2 className="animate-spin w-4 h-4" /> : <Send className="w-4 h-4" />}
                                       </Button>
                                   </div>
                               </div>
                           </div>
                       </Card>

                       {analysisResult && (
                           <div className="space-y-4">
                               <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm animate-in slide-in-from-bottom-4">
                                   <div className="flex items-center gap-2 mb-4">
                                       <Zap className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                                       <h3 className="font-bold text-gray-900">Diagnóstico del Experto</h3>
                                   </div>
                                   <div className="prose prose-sm max-w-none text-gray-600 whitespace-pre-wrap leading-relaxed">
                                       {analysisResult}
                                   </div>
                               </div>
                           </div>
                       )}
                  </div>
              )}

          </div>
      </div>
    </div>
  );
}
