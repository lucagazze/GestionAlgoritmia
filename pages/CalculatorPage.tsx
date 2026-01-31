
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { db } from '../services/db';
import { ai } from '../services/ai';
import { Service, ServiceType, ProposalStatus, Contractor } from '../types';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Badge, Textarea } from '../components/UIComponents';
import { Check, Copy, Save, Wand2, User, Layers, FileDown, Loader2, Bot, X, ChevronRight, ChevronLeft, Sparkles, RefreshCw, TrendingUp } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

// WIZARD STEPS
const STEPS: { number: number; title: string; icon: React.ElementType }[] = [
    { number: 1, title: "Contexto", icon: User },
    { number: 2, title: "Estrategia", icon: Layers },
    { number: 3, title: "Cierre", icon: FileDown }
];

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export default function CalculatorPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [services, setServices] = useState<Service[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // --- STEP 1: CLIENT DISCOVERY ---
  const [clientInfo, setClientInfo] = useState({
      name: '',
      industry: '',
      targetAudience: '',
      currentSituation: '', 
      objective: '',        
  });
  const [isGeneratingContext, setIsGeneratingContext] = useState(false);

  // --- STEP 3 (Variables moved here) ---
  const [contractVars, setContractVars] = useState({
      budget: '',
      duration: 6
      // Margin removed
  });

  // --- STEP 2: STRATEGY ---
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  // Renamed logic: customPrices now means "Final Selling Price" set by user
  const [customPrices, setCustomPrices] = useState<Record<string, number>>({});
  const [outsourcingCosts, setOutsourcingCosts] = useState<Record<string, number>>({});
  const [assignedContractors, setAssignedContractors] = useState<Record<string, string>>({});

  // --- STEP 3: REVIEW & AI ---
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [showPrompt, setShowPrompt] = useState(false);

  // --- AI CHAT ---
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: 'system', content: 'Eres un experto en ventas de agencia. Ayuda al usuario a completar la información del cliente.' },
    { role: 'assistant', content: '¡Hola! ¿Necesitas ayuda para definir el objetivo o los dolores del cliente?' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const init = async () => {
      const [servicesData, contractorsData] = await Promise.all([
        db.services.getAll(),
        db.contractors.getAll()
      ]);
      setServices(servicesData);
      setContractors(contractorsData);
      setIsLoading(false);
    };
    init();
  }, []);

  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isChatOpen]);

  // --- LOGIC: CALCULATIONS ---
  const toggleService = (id: string) => {
    setSelectedServiceIds(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  // Defaults to baseCost if not overridden
  const getSellingPrice = (service: Service) => customPrices[service.id] !== undefined ? customPrices[service.id] : service.baseCost;

  const servicesByCategory = useMemo<Record<string, Service[]>>(() => {
    const grouped: Record<string, Service[]> = {};
    services.forEach(s => {
      if (!grouped[s.category]) grouped[s.category] = [];
      grouped[s.category].push(s);
    });
    return grouped;
  }, [services]);

  const calculations = useMemo(() => {
    const selected = services.filter(s => selectedServiceIds.includes(s.id));
    
    let totalOutsourcingOneTime = 0;
    let totalOutsourcingRecurring = 0;

    selected.forEach(s => {
        const outCost = outsourcingCosts[s.id] || 0;
        if (s.type === ServiceType.ONE_TIME) totalOutsourcingOneTime += outCost;
        else totalOutsourcingRecurring += outCost;
    });

    const oneTimeTotal = selected.filter(s => s.type === ServiceType.ONE_TIME).reduce((acc, s) => acc + getSellingPrice(s), 0);
    const recurringTotal = selected.filter(s => s.type === ServiceType.RECURRING).reduce((acc, s) => acc + getSellingPrice(s), 0);

    const setupFee = oneTimeTotal;
    const monthlyFee = recurringTotal;
    const contractValue = setupFee + (monthlyFee * contractVars.duration);
    
    const totalOutsourcingCost = totalOutsourcingOneTime + (totalOutsourcingRecurring * contractVars.duration);
    
    const profit = contractValue - totalOutsourcingCost; 
    
    return { selected, setupFee, monthlyFee, contractValue, profit, totalOutsourcingCost };
  }, [services, selectedServiceIds, contractVars, customPrices, outsourcingCosts]);

  // --- ACTIONS ---
  const handleAiAutoFill = async () => {
      if (!clientInfo.name && !clientInfo.industry) {
          alert("Por favor, ingresa al menos el Nombre y Rubro para que la IA tenga contexto.");
          return;
      }
      setIsGeneratingContext(true);
      try {
          const prompt = `
          Actúa como consultor de marketing experto. Basado en el nombre "${clientInfo.name}" y rubro "${clientInfo.industry}" (y si hay algo escrito en objetivo/situación: "${clientInfo.objective} ${clientInfo.currentSituation}"), 
          genera:
          1. Una "Situación Actual" típica (dolores) de este tipo de cliente (max 20 palabras).
          2. Un "Objetivo" ambicioso pero realista (max 20 palabras).
          3. Un "Público Objetivo" sugerido.
          
          Responde SOLO en formato JSON válido: {"situation": "...", "objective": "...", "audience": "..."}`;
          
          const response = await ai.chat([{ role: 'user', content: prompt }]);
          
          const cleanJson = response.replace(/```json/g, '').replace(/```/g, '').trim();
          const data = JSON.parse(cleanJson);
          
          setClientInfo(prev => ({
              ...prev,
              currentSituation: prev.currentSituation || data.situation,
              objective: prev.objective || data.objective,
              targetAudience: prev.targetAudience || data.audience
          }));

      } catch (e) {
          console.error(e);
          alert("No se pudo autocompletar. Intenta de nuevo.");
      } finally {
          setIsGeneratingContext(false);
      }
  };

  const saveProposal = async () => {
    if (!clientInfo.name || selectedServiceIds.length === 0) {
      alert("Falta nombre del cliente o servicios.");
      return;
    }

    setIsSaving(true);
    const { setupFee, monthlyFee, contractValue, selected } = calculations;

    try {
      await db.proposals.create({
        status: ProposalStatus.DRAFT,
        objective: clientInfo.objective,
        durationMonths: contractVars.duration,
        totalOneTimePrice: setupFee,
        totalRecurringPrice: monthlyFee,
        totalContractValue: contractValue,
        aiPromptGenerated: generatedPrompt,
        items: selected.map(s => ({
          id: '', 
          serviceId: s.id,
          serviceSnapshotName: s.name,
          serviceSnapshotCost: getSellingPrice(s)
        }))
      }, clientInfo.name, clientInfo.industry);
      
      alert("¡Propuesta Guardada!");
    } catch (error) {
      console.error(error);
      alert("Error al guardar.");
    } finally {
      setIsSaving(false);
    }
  };

  const generatePrompt = () => {
    const { selected, setupFee, monthlyFee, contractValue } = calculations;
    
    const phases = selected.reduce((acc, s) => {
      const key = s.type === ServiceType.ONE_TIME ? 'Fase 1: Infraestructura & Setup' : 'Fase 2: Growth & Gestión Recurrente';
      if (!acc[key]) acc[key] = [];
      acc[key].push(`- ${s.name}: ${s.description}`);
      return acc;
    }, {} as Record<string, string[]>);

    const prompt = `
Actúa como Estratega de Agencia Senior. Escribe una propuesta para "${clientInfo.name}" (${clientInfo.industry}).

**Contexto del Cliente:**
- Situación Actual: ${clientInfo.currentSituation}
- Público Objetivo: ${clientInfo.targetAudience}
- Objetivo (Punto B): "${clientInfo.objective}"
- Presupuesto Disponible: ${contractVars.budget || 'No especificado'}

**Oferta (Hoja de Ruta):**
${(Object.entries(phases) as [string, string[]][]).map(([phase, items]) => `\n${phase}\n${items.join('\n')}`).join('\n')}

**Inversión:**
- Setup: $${setupFee.toLocaleString()} (Único)
- Fee Mensual: $${monthlyFee.toLocaleString()}
- Duración: ${contractVars.duration} meses
- Valor Total: $${contractValue.toLocaleString()}

**Instrucciones:**
1. Crea una intro empática basada en su situación actual.
2. Explica cómo la oferta resuelve sus dolores y los lleva al objetivo.
3. Presenta el precio con autoridad.
    `.trim();

    setGeneratedPrompt(prompt);
    setShowPrompt(true);
  };

  const handleAiChat = async () => {
      if (!chatInput) return;
      const newHistory: ChatMessage[] = [...chatMessages, { role: 'user', content: chatInput }];
      setChatMessages(newHistory);
      setChatInput('');
      setIsAiThinking(true);
      
      try {
          const res = await ai.chat(newHistory);
          if (res) setChatMessages(prev => [...prev, { role: 'assistant', content: res }]);
      } catch (e) {
          console.error(e);
      } finally {
          setIsAiThinking(false);
      }
  }

  const generatePDF = () => {
      const doc: any = new jsPDF();
      doc.text(`Propuesta para ${clientInfo.name}`, 10, 10);
      doc.text(`Total: $${calculations.contractValue}`, 10, 20);
      doc.save("propuesta.pdf");
  }

  if (isLoading) return <div className="flex h-screen items-center justify-center text-gray-400"><Loader2 className="animate-spin w-8 h-8 mr-2" /> Cargando Sistema...</div>;

  return (
    <div className="pb-20 animate-in fade-in duration-500 max-w-5xl mx-auto">
      
      {/* HEADER */}
      <div className="mb-8 mt-4 flex items-center justify-between">
          <div>
              <h1 className="text-3xl font-bold tracking-tight text-gray-900">Cotizador</h1>
              <p className="text-gray-500">Generador de presupuestos High-Ticket.</p>
          </div>
      </div>

      {/* STEPS HEADER */}
      <div className="flex justify-between items-center mb-8 px-6 py-4 bg-white/80 backdrop-blur-md rounded-full border border-gray-100 shadow-lg sticky top-4 z-20 mx-4">
         {STEPS.map((step, idx) => {
             const Icon = step.icon;
             const isActive = currentStep === step.number;
             const isCompleted = currentStep > step.number;
             
             return (
                 <div key={step.number} onClick={() => setCurrentStep(step.number)} className={`flex items-center gap-3 cursor-pointer group`}>
                     <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 ${isActive ? 'bg-black text-white shadow-md scale-110' : isCompleted ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400 group-hover:bg-gray-200'}`}>
                         {isCompleted ? <Check className="w-5 h-5"/> : step.number}
                     </div>
                     <div className={`${isActive ? 'opacity-100' : 'opacity-40'} hidden md:block transition-opacity`}>
                         <div className="text-xs font-bold uppercase tracking-wider">{step.title}</div>
                     </div>
                     {idx < STEPS.length - 1 && <div className="w-8 lg:w-12 h-[1px] bg-gray-200 mx-2 hidden md:block"></div>}
                 </div>
             )
         })}
         <div className="flex gap-2">
             <Button variant="outline" size="sm" onClick={() => setIsChatOpen(!isChatOpen)} className="rounded-full">
                 <Bot className="w-4 h-4 mr-2" /> Ayuda
             </Button>
         </div>
      </div>

      <div className="grid grid-cols-1 gap-6 px-4">
          {/* STEP 1: DISCOVERY FORM */}
          {currentStep === 1 && (
             <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                <Card className="overflow-visible">
                    <CardHeader className="flex flex-row justify-between items-center">
                        <CardTitle className="flex items-center gap-2"><User className="w-5 h-5"/> Información del Cliente</CardTitle>
                        <Button variant="ghost" size="sm" onClick={handleAiAutoFill} disabled={isGeneratingContext} className="text-blue-600 hover:bg-blue-50">
                             {isGeneratingContext ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                             Autocompletar con IA
                        </Button>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <Label>Nombre de Empresa / Cliente</Label>
                                <Input value={clientInfo.name} onChange={e => setClientInfo({...clientInfo, name: e.target.value})} placeholder="Ej: TechSolutions Inc" autoFocus />
                            </div>
                            <div>
                                <Label>Rubro / Industria</Label>
                                <Input value={clientInfo.industry} onChange={e => setClientInfo({...clientInfo, industry: e.target.value})} placeholder="Ej: SaaS B2B, Inmobiliaria..." />
                            </div>
                        </div>
                        
                        <div>
                            <Label>Público Objetivo</Label>
                            <Input value={clientInfo.targetAudience} onChange={e => setClientInfo({...clientInfo, targetAudience: e.target.value})} placeholder="¿A quién le venden?" />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="relative">
                                <Label>Situación Actual (Dolores)</Label>
                                <Textarea value={clientInfo.currentSituation} onChange={e => setClientInfo({...clientInfo, currentSituation: e.target.value})} placeholder="¿Qué problemas tienen hoy?" />
                            </div>
                            <div>
                                <Label>Objetivo Principal (Punto B)</Label>
                                <Textarea value={clientInfo.objective} onChange={e => setClientInfo({...clientInfo, objective: e.target.value})} placeholder="¿Qué quieren lograr con la agencia?" />
                            </div>
                        </div>

                        <div className="flex justify-end pt-4">
                            <Button onClick={() => setCurrentStep(2)} className="w-full md:w-auto shadow-lg shadow-black/20">
                                Definir Estrategia <ChevronRight className="w-4 h-4 ml-2" />
                            </Button>
                        </div>
                    </CardContent>
                </Card>
             </div>
          )}

          {/* STEP 2: STRATEGY (SERVICES) */}
          {currentStep === 2 && (
              <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                  <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                    <h2 className="text-xl font-bold">Selecciona Servicios</h2>
                    <Badge variant="blue" className="bg-black text-white px-3 py-1 rounded-full">{selectedServiceIds.length} Seleccionados</Badge>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {(Object.entries(servicesByCategory) as [string, Service[]][]).map(([cat, items]) => (
                          <div key={cat} className="space-y-3">
                              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">{cat}</h3>
                              {items.map(s => {
                                  const isSelected = selectedServiceIds.includes(s.id);
                                  const assignedId = assignedContractors[s.id];
                                  return (
                                      <div key={s.id} onClick={() => toggleService(s.id)} 
                                           className={`cursor-pointer border rounded-2xl p-4 transition-all duration-200 ${isSelected ? 'border-black bg-white ring-2 ring-black/5 shadow-lg scale-[1.02]' : 'border-gray-100 bg-white hover:border-gray-300 hover:shadow-md'}`}>
                                          <div className="flex justify-between items-start mb-2">
                                              <span className="font-semibold text-sm leading-tight">{s.name}</span>
                                              {isSelected && <div className="w-5 h-5 bg-black rounded-full flex items-center justify-center"><Check className="w-3 h-3 text-white" /></div>}
                                          </div>
                                          {isSelected && (
                                              <div className="space-y-2 mt-3 pt-3 border-t border-gray-100 animate-in fade-in" onClick={e => e.stopPropagation()}>
                                                  <div className="flex justify-between items-center">
                                                      <label className="text-[10px] text-gray-500 font-bold uppercase">Precio de Venta</label>
                                                      <input type="number" className="w-20 text-right text-xs bg-gray-50 rounded px-1 py-1 font-bold outline-none focus:ring-1 focus:ring-black" 
                                                             value={getSellingPrice(s)} onChange={e => setCustomPrices({...customPrices, [s.id]: parseFloat(e.target.value)})} />
                                                  </div>
                                                  <div className="flex justify-between items-center bg-gray-50 p-1.5 rounded-lg">
                                                      <select 
                                                        className="text-[10px] bg-transparent outline-none w-24 font-medium" 
                                                        value={assignedId || ''} 
                                                        onChange={e => {
                                                            const pid = e.target.value;
                                                            const partner = contractors.find(c => c.id === pid);
                                                            setAssignedContractors({...assignedContractors, [s.id]: pid});
                                                            // Auto-fill outsourcing cost based on partner's monthly rate
                                                            if (partner && partner.monthlyRate > 0) {
                                                                setOutsourcingCosts(prev => ({...prev, [s.id]: partner.monthlyRate}));
                                                            }
                                                        }}
                                                      >
                                                          <option value="">(Interno)</option>
                                                          {contractors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                                      </select>
                                                      {assignedId && (
                                                          <input type="number" placeholder="$ Costo" className="w-12 text-right text-[10px] bg-white rounded px-1 border border-gray-200"
                                                                 value={outsourcingCosts[s.id] || ''} onChange={e => setOutsourcingCosts({...outsourcingCosts, [s.id]: parseFloat(e.target.value)})} />
                                                      )}
                                                  </div>
                                              </div>
                                          )}
                                      </div>
                                  )
                              })}
                          </div>
                      ))}
                  </div>

                  <div className="flex justify-between pt-6">
                        <Button variant="ghost" onClick={() => setCurrentStep(1)}>
                            <ChevronLeft className="w-4 h-4 mr-2" /> Volver
                        </Button>
                        <Button onClick={() => setCurrentStep(3)} disabled={selectedServiceIds.length === 0} className="shadow-lg shadow-black/20">
                            Ir al Cierre <ChevronRight className="w-4 h-4 ml-2" />
                        </Button>
                  </div>
              </div>
          )}

          {/* STEP 3: REVIEW & FINANCIALS */}
          {currentStep === 3 && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in slide-in-from-right-4 duration-300">
                  {/* LEFT COLUMN: Variables & Actions */}
                  <div className="lg:col-span-5 space-y-6">
                      {/* Financial Variables Control Panel */}
                      <Card className="border-2 border-black/5 shadow-xl bg-white/80 backdrop-blur-sm">
                          <CardHeader className="bg-gray-50/50 border-b border-gray-100">
                              <CardTitle className="flex items-center gap-2 text-base"><RefreshCw className="w-4 h-4"/> Variables del Contrato</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-6 pt-6">
                                <div>
                                    <Label>Duración del Contrato</Label>
                                    <div className="flex gap-2 mt-2">
                                        {[3, 6, 12].map(m => (
                                            <button 
                                                key={m}
                                                onClick={() => setContractVars({...contractVars, duration: m})}
                                                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${contractVars.duration === m ? 'bg-black text-white border-black' : 'bg-white border-gray-200 hover:bg-gray-50'}`}
                                            >
                                                {m} Meses
                                            </button>
                                        ))}
                                    </div>
                                    <div className="mt-2">
                                        <Input 
                                            type="number" 
                                            placeholder="Otro..." 
                                            value={contractVars.duration} 
                                            onChange={e => setContractVars({...contractVars, duration: parseInt(e.target.value) || 0})}
                                            className="text-center"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <Label>Presupuesto del Cliente ($)</Label>
                                    <Input value={contractVars.budget} onChange={e => setContractVars({...contractVars, budget: e.target.value})} placeholder="Opcional - solo referencia" />
                                </div>
                          </CardContent>
                      </Card>

                      <Card className="bg-gray-900 text-white">
                          <CardHeader>
                              <CardTitle className="text-white flex items-center gap-2"><Wand2 className="w-5 h-5"/> Generador de Propuesta</CardTitle>
                          </CardHeader>
                          <CardContent>
                              {!showPrompt ? (
                                  <Button onClick={generatePrompt} className="bg-white text-black hover:bg-gray-200 w-full font-bold">
                                      Generar Copy con IA
                                  </Button>
                              ) : (
                                  <div className="space-y-4">
                                      <Textarea readOnly value={generatedPrompt} className="bg-gray-800 border-gray-700 text-gray-300 min-h-[200px] font-mono text-xs rounded-xl" />
                                      <Button variant="secondary" onClick={() => navigator.clipboard.writeText(generatedPrompt)} className="w-full">
                                          <Copy className="w-4 h-4 mr-2" /> Copiar Texto
                                      </Button>
                                  </div>
                              )}
                          </CardContent>
                      </Card>
                  </div>

                  {/* RIGHT COLUMN: Final Pricing Display */}
                  <div className="lg:col-span-7 space-y-6">
                      <Card className="h-full border-0 shadow-2xl shadow-black/5 bg-gradient-to-br from-white to-gray-50 flex flex-col justify-between">
                          <div className="p-8">
                              <h3 className="text-gray-400 font-bold uppercase tracking-widest text-xs mb-8">Resumen Económico</h3>
                              
                              <div className="space-y-8">
                                  <div className="flex justify-between items-end border-b border-gray-100 pb-4">
                                      <div>
                                          <p className="text-sm font-medium text-gray-500 mb-1">Fee Mensual (Recurrente)</p>
                                          <p className="text-xs text-gray-400">Durante {contractVars.duration} meses</p>
                                      </div>
                                      <div className="text-4xl font-bold tracking-tighter">${calculations.monthlyFee.toLocaleString()}</div>
                                  </div>

                                  <div className="flex justify-between items-end border-b border-gray-100 pb-4">
                                      <div>
                                          <p className="text-sm font-medium text-gray-500 mb-1">Setup / Onboarding</p>
                                          <p className="text-xs text-gray-400">Pago Único</p>
                                      </div>
                                      <div className="text-3xl font-bold tracking-tighter text-gray-700">${calculations.setupFee.toLocaleString()}</div>
                                  </div>

                                  <div className="bg-black text-white p-6 rounded-2xl flex justify-between items-center shadow-lg">
                                      <div>
                                          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Valor Total Contrato</p>
                                          <p className="text-xs opacity-50 mt-1">LTV (Life Time Value)</p>
                                      </div>
                                      <div className="text-3xl font-bold tracking-tight">${calculations.contractValue.toLocaleString()}</div>
                                  </div>

                                  {/* Internal Profit Stats */}
                                  <div className="grid grid-cols-2 gap-4">
                                      <div className="p-4 bg-green-50 rounded-xl border border-green-100 text-center">
                                          <p className="text-xs text-green-800 font-bold uppercase mb-1">Ganancia Estimada</p>
                                          <p className="text-xl font-bold text-green-700">${calculations.profit.toLocaleString()}</p>
                                      </div>
                                      <div className="p-4 bg-red-50 rounded-xl border border-red-100 text-center">
                                          <p className="text-xs text-red-800 font-bold uppercase mb-1">Costos Externos</p>
                                          <p className="text-xl font-bold text-red-700">${calculations.totalOutsourcingCost.toLocaleString()}</p>
                                      </div>
                                  </div>
                              </div>
                          </div>

                          <div className="p-6 bg-gray-50 border-t border-gray-100 flex gap-3">
                              <Button variant="outline" className="flex-1 bg-white" onClick={generatePDF}>
                                  <FileDown className="w-4 h-4 mr-2" /> PDF
                              </Button>
                              <Button onClick={saveProposal} disabled={isSaving} className="flex-[2] text-base shadow-xl shadow-black/10 hover:scale-[1.02] transition-transform">
                                  {isSaving ? <Loader2 className="animate-spin" /> : <><Save className="w-5 h-5 mr-2" /> Finalizar y Guardar</>}
                              </Button>
                          </div>
                      </Card>
                  </div>
              </div>
          )}

          {/* AI CHAT OVERLAY */}
          {isChatOpen && (
            <div className="fixed bottom-6 right-6 w-80 h-[500px] bg-white rounded-3xl shadow-2xl border border-gray-200 flex flex-col z-50 animate-in slide-in-from-bottom-10 overflow-hidden">
                <div className="p-4 bg-black text-white flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                        <span className="font-bold text-sm">Asistente IA</span>
                    </div>
                    <button onClick={() => setIsChatOpen(false)}><X className="w-4 h-4"/></button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                    {chatMessages.filter(m => m.role !== 'system').map((msg, idx) => (
                        <div key={idx} className={`p-3 rounded-2xl text-xs leading-relaxed ${msg.role === 'user' ? 'bg-black text-white ml-auto rounded-tr-none' : 'bg-white border text-gray-700 rounded-tl-none shadow-sm'} max-w-[90%]`}>
                            {msg.content}
                        </div>
                    ))}
                    {isAiThinking && <div className="flex gap-1 items-center text-gray-400 text-xs ml-2"><Loader2 className="w-3 h-3 animate-spin"/> Escribiendo...</div>}
                    <div ref={chatEndRef} />
                </div>
                <div className="p-3 border-t bg-white">
                    <form onSubmit={(e) => {e.preventDefault(); handleAiChat();}} className="flex gap-2">
                        <Input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Pregunta algo..." className="h-10 text-xs rounded-full pl-4" />
                        <Button type="submit" size="sm" className="h-10 w-10 rounded-full p-0 flex-shrink-0"><TrendingUp className="w-4 h-4" /></Button>
                    </form>
                </div>
            </div>
          )}
      </div>
    </div>
  );
}
