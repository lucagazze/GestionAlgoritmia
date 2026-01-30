
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { db } from '../services/db';
import { ai } from '../services/ai';
import { Service, ServiceType, ProposalStatus, Contractor } from '../types';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Slider, Badge, Textarea } from '../components/UIComponents';
import { Calculator, Check, Copy, Save, Wand2, TrendingUp, Layers, FileDown, Loader2, Bot, X, ChevronRight, ChevronLeft, User, Target, BarChart3, Wallet } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

// WIZARD STEPS
const STEPS: { number: number; title: string; icon: React.ElementType }[] = [
    { number: 1, title: "Descubrimiento", icon: User },
    { number: 2, title: "Estrategia & Costos", icon: Layers },
    { number: 3, title: "Propuesta & Cierre", icon: FileDown }
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
      currentSituation: '', // "Punto A"
      objective: '',        // "Punto B"
      budget: '',
      duration: 6,
      margin: 2.5
  });

  // --- STEP 2: STRATEGY ---
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
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

  const getEffectivePrice = (service: Service) => customPrices[service.id] !== undefined ? customPrices[service.id] : service.baseCost;

  const servicesByCategory = useMemo(() => {
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

    const oneTimeBasis = selected.filter(s => s.type === ServiceType.ONE_TIME).reduce((acc, s) => acc + getEffectivePrice(s), 0);
    const recurringBasis = selected.filter(s => s.type === ServiceType.RECURRING).reduce((acc, s) => acc + getEffectivePrice(s), 0);

    const roundPrice = (price: number) => Math.ceil(price / 50) * 50;

    const setupFee = roundPrice(oneTimeBasis * clientInfo.margin);
    const monthlyFee = roundPrice(recurringBasis * clientInfo.margin);
    const contractValue = setupFee + (monthlyFee * clientInfo.duration);
    
    const totalOutsourcingCost = totalOutsourcingOneTime + (totalOutsourcingRecurring * clientInfo.duration);
    
    // Simplification: Internal cost is just what's not outsourced + profit. 
    // Profit = Revenue - Outsourcing - (Implicit Agency Base Cost?)
    // Let's assume Base Cost is our internal "cost" to deliver if not outsourced.
    const internalBaseOneTime = selected.filter(s => s.type === ServiceType.ONE_TIME).reduce((acc, s) => acc + s.baseCost, 0);
    const internalBaseRecurring = selected.filter(s => s.type === ServiceType.RECURRING).reduce((acc, s) => acc + s.baseCost, 0);
    const totalInternalCost = internalBaseOneTime + (internalBaseRecurring * clientInfo.duration);
    
    const totalCost = totalInternalCost + totalOutsourcingCost; // Rough estimate of "Cost of Delivery"
    const profit = contractValue - totalCost; // Very conservative profit
    const profitMargin = contractValue > 0 ? (profit / contractValue) * 100 : 0;

    return { selected, setupFee, monthlyFee, contractValue, profit, profitMargin, totalOutsourcingCost };
  }, [services, selectedServiceIds, clientInfo, customPrices, outsourcingCosts]);

  // --- ACTIONS ---
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
        durationMonths: clientInfo.duration,
        marginMultiplier: clientInfo.margin,
        totalOneTimePrice: setupFee,
        totalRecurringPrice: monthlyFee,
        totalContractValue: contractValue,
        aiPromptGenerated: generatedPrompt,
        items: selected.map(s => ({
          id: '', 
          serviceId: s.id,
          serviceSnapshotName: s.name,
          serviceSnapshotCost: getEffectivePrice(s)
        }))
      }, clientInfo.name, clientInfo.industry);
      
      alert("¡Propuesta Guardada! Se han generado las tareas en el tablero.");
      // Optional: Redirect to dashboard
    } catch (error) {
      console.error(error);
      alert("Error al guardar la propuesta.");
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
- Presupuesto Disponible: ${clientInfo.budget || 'No especificado'}

**Oferta (Hoja de Ruta):**
${Object.entries(phases).map(([phase, items]: [string, string[]]) => `\n${phase}\n${items.join('\n')}`).join('\n')}

**Inversión:**
- Setup: $${setupFee.toLocaleString()} (Único)
- Fee Mensual: $${monthlyFee.toLocaleString()}
- Duración: ${clientInfo.duration} meses
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
      // Basic PDF Generation wrapper (same as before but simplified for brevity)
      const doc: any = new jsPDF();
      doc.text(`Propuesta para ${clientInfo.name}`, 10, 10);
      doc.text(`Total: $${calculations.contractValue}`, 10, 20);
      doc.save("propuesta.pdf");
  }

  if (isLoading) return <div className="flex h-screen items-center justify-center text-gray-400"><Loader2 className="animate-spin w-8 h-8 mr-2" /> Cargando Sistema...</div>;

  return (
    <div className="pb-20 animate-in fade-in duration-500 max-w-5xl mx-auto">
      
      {/* STEPS HEADER */}
      <div className="flex justify-between items-center mb-8 px-4 py-4 bg-white rounded-2xl border border-gray-100 shadow-sm sticky top-0 z-20">
         {STEPS.map((step, idx) => {
             const Icon = step.icon;
             const isActive = currentStep === step.number;
             const isCompleted = currentStep > step.number;
             
             return (
                 <div key={step.number} className="flex items-center gap-3">
                     <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${isActive ? 'bg-black text-white' : isCompleted ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
                         {isCompleted ? <Check className="w-5 h-5"/> : step.number}
                     </div>
                     <div className={`${isActive ? 'opacity-100' : 'opacity-40'} hidden md:block`}>
                         <div className="text-xs font-bold uppercase tracking-wider">{step.title}</div>
                     </div>
                     {idx < STEPS.length - 1 && <div className="w-12 h-[1px] bg-gray-200 mx-2 hidden md:block"></div>}
                 </div>
             )
         })}
         <div className="flex gap-2">
             <Button variant="outline" size="sm" onClick={() => setIsChatOpen(!isChatOpen)}>
                 <Bot className="w-4 h-4 mr-2" /> IA
             </Button>
         </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
          
          {/* STEP 1: DISCOVERY FORM */}
          {currentStep === 1 && (
             <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><User className="w-5 h-5"/> Información del Cliente</CardTitle>
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
                            <Label>Público Objetivo (¿A quién le venden?)</Label>
                            <Input value={clientInfo.targetAudience} onChange={e => setClientInfo({...clientInfo, targetAudience: e.target.value})} placeholder="Ej: Gerentes de RRHH de empresas medianas..." />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <Label>Situación Actual (Dolores)</Label>
                                <Textarea value={clientInfo.currentSituation} onChange={e => setClientInfo({...clientInfo, currentSituation: e.target.value})} placeholder="No tienen leads cualificados, web lenta..." />
                            </div>
                            <div>
                                <Label>Objetivo Principal (Punto B)</Label>
                                <Textarea value={clientInfo.objective} onChange={e => setClientInfo({...clientInfo, objective: e.target.value})} placeholder="Facturar $10k extra al mes, automatizar..." />
                            </div>
                        </div>

                        <div className="bg-gray-50/50 p-6 rounded-xl border border-gray-100 space-y-6">
                            <Label className="text-gray-900">Variables del Contrato</Label>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div>
                                    <Label>Presupuesto Estimado ($)</Label>
                                    <Input value={clientInfo.budget} onChange={e => setClientInfo({...clientInfo, budget: e.target.value})} placeholder="Opcional" />
                                </div>
                                <div>
                                    <Label>Duración (Meses)</Label>
                                    <Input type="number" value={clientInfo.duration} onChange={e => setClientInfo({...clientInfo, duration: parseInt(e.target.value) || 6})} />
                                </div>
                                <div>
                                    <Label>Multiplicador Margen</Label>
                                    <Input type="number" step="0.1" value={clientInfo.margin} onChange={e => setClientInfo({...clientInfo, margin: parseFloat(e.target.value) || 2.5})} />
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end pt-4">
                            <Button onClick={() => setCurrentStep(2)} className="w-full md:w-auto">
                                Siguiente Paso <ChevronRight className="w-4 h-4 ml-2" />
                            </Button>
                        </div>
                    </CardContent>
                </Card>
             </div>
          )}

          {/* STEP 2: STRATEGY (SERVICES) */}
          {currentStep === 2 && (
              <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                  <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold">Selecciona la Estrategia</h2>
                    <Badge variant="blue">{selectedServiceIds.length} Servicios</Badge>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {Object.entries(servicesByCategory).map(([cat, items]) => (
                          <div key={cat} className="space-y-3">
                              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">{cat}</h3>
                              {items.map(s => {
                                  const isSelected = selectedServiceIds.includes(s.id);
                                  const assignedId = assignedContractors[s.id];
                                  return (
                                      <div key={s.id} onClick={() => toggleService(s.id)} 
                                           className={`cursor-pointer border rounded-xl p-4 transition-all ${isSelected ? 'border-black bg-white ring-1 ring-black shadow-md' : 'border-gray-100 bg-white hover:border-gray-300'}`}>
                                          <div className="flex justify-between items-start mb-2">
                                              <span className="font-semibold text-sm leading-tight">{s.name}</span>
                                              {isSelected && <Check className="w-4 h-4 text-black" />}
                                          </div>
                                          {isSelected && (
                                              <div className="space-y-2 mt-3 pt-3 border-t border-gray-100 animate-in fade-in" onClick={e => e.stopPropagation()}>
                                                  <div className="flex justify-between items-center">
                                                      <label className="text-[10px] text-gray-500">Precio Base</label>
                                                      <input type="number" className="w-16 text-right text-xs border-b border-gray-300 focus:border-black outline-none" 
                                                             value={getEffectivePrice(s)} onChange={e => setCustomPrices({...customPrices, [s.id]: parseFloat(e.target.value)})} />
                                                  </div>
                                                  <div className="flex justify-between items-center bg-gray-50 p-1.5 rounded">
                                                      <select className="text-[10px] bg-transparent outline-none w-20" 
                                                              value={assignedId || ''} onChange={e => setAssignedContractors({...assignedContractors, [s.id]: e.target.value})}>
                                                          <option value="">(Interno)</option>
                                                          {contractors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                                      </select>
                                                      {assignedId && (
                                                          <input type="number" placeholder="$ Costo" className="w-12 text-right text-[10px] bg-transparent border-b border-gray-300"
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

                  <div className="flex justify-between pt-6 border-t border-gray-200">
                        <Button variant="ghost" onClick={() => setCurrentStep(1)}>
                            <ChevronLeft className="w-4 h-4 mr-2" /> Volver
                        </Button>
                        <Button onClick={() => setCurrentStep(3)} disabled={selectedServiceIds.length === 0}>
                            Ver Resumen <ChevronRight className="w-4 h-4 ml-2" />
                        </Button>
                  </div>
              </div>
          )}

          {/* STEP 3: REVIEW */}
          {currentStep === 3 && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in slide-in-from-right-4 duration-300">
                  <div className="lg:col-span-8 space-y-6">
                      <Card className="bg-gray-900 text-white">
                          <CardHeader>
                              <CardTitle className="text-white flex items-center gap-2"><Wand2 className="w-5 h-5"/> Generador de Propuesta IA</CardTitle>
                          </CardHeader>
                          <CardContent>
                              <p className="text-gray-400 text-sm mb-4">Utiliza los datos recopilados en el paso 1 y 2 para escribir el copy de venta.</p>
                              {!showPrompt ? (
                                  <Button onClick={generatePrompt} className="bg-white text-black hover:bg-gray-200 w-full">Generar Prompt</Button>
                              ) : (
                                  <div className="space-y-4">
                                      <Textarea readOnly value={generatedPrompt} className="bg-gray-800 border-gray-700 text-gray-300 min-h-[300px] font-mono text-xs" />
                                      <Button variant="secondary" onClick={() => navigator.clipboard.writeText(generatedPrompt)} className="w-full">
                                          <Copy className="w-4 h-4 mr-2" /> Copiar al Portapapeles
                                      </Button>
                                  </div>
                              )}
                          </CardContent>
                      </Card>
                      
                      <div className="flex gap-3">
                          <Button variant="outline" className="flex-1 bg-white" onClick={generatePDF}>
                              <FileDown className="w-4 h-4 mr-2" /> Descargar PDF
                          </Button>
                          <Button variant="ghost" onClick={() => setCurrentStep(2)}>
                            <ChevronLeft className="w-4 h-4 mr-2" /> Editar Servicios
                        </Button>
                      </div>
                  </div>

                  <div className="lg:col-span-4 space-y-6">
                      <Card className="border-2 border-black/5 shadow-xl">
                          <CardHeader className="bg-gray-50 border-b border-gray-100">
                              <CardTitle>Resumen Económico</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-6 pt-6">
                              <div>
                                  <div className="text-sm text-gray-500 mb-1">Setup (Pago Único)</div>
                                  <div className="text-3xl font-bold tracking-tight">${calculations.setupFee.toLocaleString()}</div>
                              </div>
                              <div>
                                  <div className="text-sm text-gray-500 mb-1">Fee Mensual</div>
                                  <div className="text-3xl font-bold tracking-tight">${calculations.monthlyFee.toLocaleString()}</div>
                              </div>
                              <div className="pt-4 border-t border-dashed border-gray-200">
                                  <div className="flex justify-between items-center mb-2">
                                      <span className="text-sm font-semibold">Valor Total Contrato</span>
                                      <span className="font-bold">${calculations.contractValue.toLocaleString()}</span>
                                  </div>
                                  {calculations.totalOutsourcingCost > 0 && (
                                      <div className="flex justify-between items-center text-xs text-red-500">
                                          <span>Costos Tercerizados</span>
                                          <span>-${calculations.totalOutsourcingCost.toLocaleString()}</span>
                                      </div>
                                  )}
                                  <div className="mt-3 bg-green-50 text-green-800 p-3 rounded-lg text-center font-bold border border-green-100">
                                      Ganancia Estimada: ${calculations.profit.toLocaleString()}
                                  </div>
                              </div>
                              <Button onClick={saveProposal} disabled={isSaving} className="w-full py-6 text-lg shadow-xl shadow-black/10">
                                  {isSaving ? <Loader2 className="animate-spin" /> : <><Save className="w-5 h-5 mr-2" /> Finalizar y Guardar</>}
                              </Button>
                          </CardContent>
                      </Card>
                  </div>
              </div>
          )}

          {/* AI CHAT OVERLAY */}
          {isChatOpen && (
            <div className="fixed bottom-6 right-6 w-80 h-96 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col z-50 animate-in slide-in-from-bottom-10">
                <div className="p-3 bg-black text-white rounded-t-2xl flex justify-between items-center">
                    <span className="font-bold text-sm">Asistente IA</span>
                    <button onClick={() => setIsChatOpen(false)}><X className="w-4 h-4"/></button>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50">
                    {chatMessages.filter(m => m.role !== 'system').map((msg, idx) => (
                        <div key={idx} className={`p-2 rounded-lg text-xs ${msg.role === 'user' ? 'bg-black text-white ml-auto' : 'bg-white border text-gray-800'} max-w-[90%]`}>
                            {msg.content}
                        </div>
                    ))}
                    {isAiThinking && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
                    <div ref={chatEndRef} />
                </div>
                <div className="p-2 border-t bg-white rounded-b-2xl">
                    <form onSubmit={(e) => {e.preventDefault(); handleAiChat();}} className="flex gap-2">
                        <Input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="..." className="h-8 text-xs" />
                        <Button type="submit" size="sm" className="h-8 w-8 p-0"><TrendingUp className="w-4 h-4" /></Button>
                    </form>
                </div>
            </div>
          )}
      </div>
    </div>
  );
}
