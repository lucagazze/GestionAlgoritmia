import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom'; // ✅ Importar useSearchParams
import { db } from '../services/db';
import { Service, Contractor, ProposalItem, ProposalStatus } from '../types';
import { Button, Input, Card, Badge, Label, Textarea } from '../components/UIComponents';
import { 
  Wand2, Plus, Trash2, FileText, DollarSign, User, 
  Briefcase, ArrowRight, Save, Download, AlertTriangle, Lock,
  Loader2, Send
} from 'lucide-react';
import { useToast } from '../components/Toast';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// ... (Interfaces ProposalFormData y ServiceItemState se mantienen igual) ...
interface ProposalFormData {
  clientName: string;
  industry: string;
  objective: string;
  targetAudience: string;
  currentSituation: string;
  durationMonths: number;
}

interface ServiceItemState extends Service {
  instanceId: string;
  assignedContractorId?: string;
  outsourcingCost?: number;
  customPrice?: number;
}

export default function SalesCopilotPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams(); // ✅ Leer parámetros URL
  const proposalIdFromUrl = searchParams.get('proposalId'); // ✅ Obtener ID
  const { showToast } = useToast();
  const pdfRef = useRef<HTMLDivElement>(null);

  // --- ESTADOS ---
  const [isLoadingDetails, setIsLoadingDetails] = useState(!!proposalIdFromUrl); // ✅ Estado de carga inicial
  const [isReadOnly, setIsReadOnly] = useState(false); // ✅ Estado de solo lectura

  const [formData, setFormData] = useState<ProposalFormData>({
    clientName: '',
    industry: '',
    objective: '',
    targetAudience: '',
    currentSituation: '',
    durationMonths: 3, // Default a 3 meses
  });

  const [availableServices, setAvailableServices] = useState<Service[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [selectedServices, setSelectedServices] = useState<ServiceItemState[]>([]);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);

  // Cargar datos iniciales y la propuesta si existe el ID
  useEffect(() => {
    loadInitialData();
    if (proposalIdFromUrl) {
        loadProposalDetails(proposalIdFromUrl);
    }
  }, [proposalIdFromUrl]);

  const loadInitialData = async () => {
    const [servicesData, contractorsData] = await Promise.all([
      db.services.getAll(),
      db.contractors.getAll(),
    ]);
    setAvailableServices(servicesData);
    setContractors(contractorsData);
  };

  // ✅ FUNCIÓN PARA CARGAR DETALLES DE LA PROPUESTA
  const loadProposalDetails = async (id: string) => {
      setIsLoadingDetails(true);
      try {
          // Necesitamos una función getById que traiga todo. Si no la tienes en db.ts, avísame.
          // Asumo que existe db.proposals.getById(id) que retorna la propuesta con cliente e items.
          // Si no, puedes usar directamente supabase aquí:
          /* const { data: proposal, error } = await supabase.from('Proposal').select('*, client:Client(*), items:ProposalItem(*)').eq('id', id).single(); */
          
          // Usando una función hipotética del servicio db:
          const proposal: any = await db.proposals.getById(id); 

          if (!proposal) {
              showToast("No se encontró la propuesta", "error");
              navigate('/quotations');
              return;
          }

          // Rellenar formulario
          setFormData({
              clientName: proposal.client?.name || '',
              industry: proposal.client?.industry || '',
              objective: proposal.objective || '',
              targetAudience: proposal.targetAudience || '',
              currentSituation: proposal.currentSituation || '',
              durationMonths: proposal.durationMonths || 1,
          });

          // Rellenar servicios seleccionados
          if (proposal.items) {
              const loadedItems: ServiceItemState[] = proposal.items.map((item: any) => ({
                  id: item.serviceId, // ID del servicio original
                  instanceId: item.id, // ID único del item en la propuesta
                  name: item.serviceSnapshotName,
                  category: 'Loaded', // Categoría genérica o podrías buscarla
                  type: item.serviceSnapshotType,
                  baseCost: item.serviceSnapshotCost, // Precio al momento de la cotización
                  description: item.serviceSnapshotDescription,
                  customPrice: item.serviceSnapshotCost, // Precio editable
                  assignedContractorId: item.assignedContractorId,
                  outsourcingCost: item.outsourcingCost
              }));
              setSelectedServices(loadedItems);
          }

          // ✅ Determinar si es solo lectura
          if (proposal.status === ProposalStatus.ACCEPTED || proposal.status === ProposalStatus.PARTIALLY_ACCEPTED) {
              setIsReadOnly(true);
              showToast("Propuesta aprobada. Modo de solo lectura.", "info");
          }

      } catch (error) {
          console.error(error);
          showToast("Error al cargar la propuesta", "error");
      } finally {
          setIsLoadingDetails(false);
      }
  };

  // --- CÁLCULOS FINANCIEROS ---
  const totals = selectedServices.reduce((acc, service) => {
    const price = service.customPrice || service.baseCost;
    const cost = service.outsourcingCost || 0;
    if (service.type === 'RECURRING') {
      acc.recurringRevenue += price;
      acc.recurringCost += cost;
    } else {
      acc.oneTimeRevenue += price;
      acc.oneTimeCost += cost;
    }
    return acc;
  }, { recurringRevenue: 0, oneTimeRevenue: 0, recurringCost: 0, oneTimeCost: 0 });

  const totalContractRevenue = (totals.recurringRevenue * formData.durationMonths) + totals.oneTimeRevenue;
  const totalContractCost = (totals.recurringCost * formData.durationMonths) + totals.oneTimeCost;
  const netProfit = totalContractRevenue - totalContractCost;
  const margin = totalContractRevenue > 0 ? Math.round((netProfit / totalContractRevenue) * 100) : 0;

  // --- HANDLERS ---
  const handleAddService = (serviceId: string) => {
    if (isReadOnly) return; // Bloqueo
    const service = availableServices.find(s => s.id === serviceId);
    if (service) {
      setSelectedServices([...selectedServices, { 
        ...service, 
        instanceId: crypto.randomUUID(),
        customPrice: service.baseCost 
      }]);
    }
  };

  const handleRemoveService = (instanceId: string) => {
      if (isReadOnly) return; // Bloqueo
      setSelectedServices(selectedServices.filter(s => s.instanceId !== instanceId));
  };

  const handleUpdateServiceItem = (instanceId: string, updates: Partial<ServiceItemState>) => {
      if (isReadOnly) return; // Bloqueo
      setSelectedServices(selectedServices.map(s => s.instanceId === instanceId ? { ...s, ...updates } : s));
  };

  // ... (handleGenerateWithAI, handleSaveProposal, handleGeneratePDF se mantienen igual, pero con chequeo de isReadOnly)

  const handleSaveProposal = async (status: 'DRAFT' | 'SENT') => {
    if (isReadOnly) { showToast("No se puede guardar una propuesta aprobada.", "error"); return; }
    if (!formData.clientName) { showToast("Falta el nombre del cliente", "error"); return; }
    
    try {
      const itemsData = selectedServices.map(s => ({
        serviceId: s.id,
        serviceSnapshotName: s.name,
        serviceSnapshotDescription: s.description,
        serviceSnapshotType: s.type,
        serviceSnapshotCost: s.customPrice || s.baseCost,
        assignedContractorId: s.assignedContractorId,
        outsourcingCost: s.outsourcingCost
      }));

      const proposalData = {
        status: status as ProposalStatus,
        objective: formData.objective,
        targetAudience: formData.targetAudience,
        currentSituation: formData.currentSituation,
        durationMonths: formData.durationMonths,
        totalOneTimePrice: totals.oneTimeRevenue,
        totalRecurringPrice: totals.recurringRevenue,
        totalContractValue: totalContractRevenue,
        aiPromptGenerated: aiPrompt,
        items: itemsData
      };

      // Si venimos de una URL con ID, actualizamos. Si no, creamos.
      if (proposalIdFromUrl) {
          await db.proposals.update(proposalIdFromUrl, proposalData as any, proposalData.items); // Asume que update maneja los items
          showToast("Propuesta actualizada", "success");
      } else {
          await db.proposals.create(proposalData as any, formData.clientName, formData.industry);
          showToast(status === 'DRAFT' ? "Borrador guardado" : "Propuesta enviada", "success");
          navigate('/quotations');
      }
      
    } catch (error) {
      console.error(error);
      showToast("Error al guardar", "error");
    }
  };


  // --- RENDER ---
  if (isLoadingDetails) {
      return <div className="flex items-center justify-center h-screen"><Loader2 className="w-8 h-8 animate-spin text-indigo-600"/></div>;
  }

  return (
    <div className="space-y-6 pb-20 relative">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-3">
            <Wand2 className="w-8 h-8 text-indigo-600" /> 
            {proposalIdFromUrl ? (isReadOnly ? "Visualizar Propuesta Aprobada" : "Editar Propuesta") : "Generador de Propuestas"}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
              {isReadOnly ? "Modo de solo lectura. Esta propuesta ya ha sido procesada." : "Arma presupuestos inteligentes y rentables."}
          </p>
        </div>
        
        {isReadOnly && (
            <Badge variant="blue" className="px-4 py-2 text-sm flex items-center gap-2 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200">
                <Lock className="w-4 h-4"/> Propuesta Bloqueada
            </Badge>
        )}

        <div className="flex gap-2">
           <Button variant="outline" onClick={() => navigate('/quotations')}>
             Cancelar / Volver
           </Button>
          {!isReadOnly && !proposalIdFromUrl && ( // Solo mostrar si es nuevo y no es readonly
             <Button onClick={() => handleSaveProposal('DRAFT')} variant="secondary">
               <Save className="w-4 h-4 mr-2"/> Guardar Borrador
             </Button>
           )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* COLUMNA IZQ: Datos Cliente y Selección Servicios */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* 1. Datos del Cliente y Objetivo */}
          <Card className={`p-6 ${isReadOnly ? 'opacity-80 pointer-events-none bg-gray-50 dark:bg-slate-900/50' : ''}`}>
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-indigo-500"/> Información del Cliente
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <Label>Nombre del Cliente / Empresa</Label>
                <Input 
                  value={formData.clientName}
                  onChange={e => setFormData({...formData, clientName: e.target.value})}
                  placeholder="Ej: Tech Solutions Inc."
                  disabled={isReadOnly}
                />
              </div>
              <div>
                <Label>Industria / Sector (Opcional)</Label>
                <Input 
                  value={formData.industry}
                  onChange={e => setFormData({...formData, industry: e.target.value})}
                  placeholder="Ej: Tecnología, Salud..."
                  disabled={isReadOnly}
                />
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <Label>Objetivo Principal</Label>
                <Textarea 
                  value={formData.objective}
                  onChange={e => setFormData({...formData, objective: e.target.value})}
                  placeholder="¿Qué quiere lograr el cliente? Ej: Aumentar ventas online un 20%."
                  disabled={isReadOnly}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div>
                    <Label>Público Objetivo</Label>
                    <Input 
                      value={formData.targetAudience}
                      onChange={e => setFormData({...formData, targetAudience: e.target.value})}
                      placeholder="Ej: PYMES en Latam"
                      disabled={isReadOnly}
                    />
                 </div>
                 <div>
                    <Label>Situación Actual</Label>
                    <Input 
                      value={formData.currentSituation}
                      onChange={e => setFormData({...formData, currentSituation: e.target.value})}
                      placeholder="Ej: Tienen web pero sin tráfico."
                      disabled={isReadOnly}
                    />
                 </div>
              </div>

              <div>
                 <Label>Duración del Contrato (Meses)</Label>
                 <Input 
                    type="number" min={1} max={60}
                    value={formData.durationMonths}
                    onChange={e => setFormData({...formData, durationMonths: Number(e.target.value)})}
                    className="w-32"
                    disabled={isReadOnly}
                 />
                 <p className="text-xs text-gray-500 mt-1">Afecta el cálculo del valor total.</p>
              </div>
            </div>

            {/* Botón IA deshabilitado si es readOnly */}
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-800">
                <Button 
                    variant="secondary" 
                    className="w-full" 
                    disabled={isGenerating || !formData.objective || isReadOnly}
                    onClick={() => { /* handleGenerateWithAI() */ showToast("Funcionalidad IA pendiente de reconexión", "info")}}
                >
                    {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <Wand2 className="w-4 h-4 mr-2 text-purple-500"/>}
                    {isReadOnly ? "Generación IA Bloqueada" : "Generar Estrategia con IA"}
                </Button>
            </div>
          </Card>

          {/* 2. Constructor de Servicios */}
          <Card className={`p-6 ${isReadOnly ? 'opacity-90 pointer-events-none' : ''}`}>
            {/* ... (Selector de servicios y Lista de servicios seleccionados - Agregar disabled={isReadOnly} a los inputs y botones) ... */}
             <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-indigo-500"/> Servicios & Costos
            </h3>

            {/* Selector de Servicios Disponibles */}
            {!isReadOnly && (
                <div className="mb-6">
                <Label className="mb-2 block">Agregar Servicio al Presupuesto</Label>
                <div className="flex gap-2">
                    <select 
                        className="flex-1 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2"
                        onChange={(e) => {
                            if (e.target.value) {
                                handleAddService(e.target.value);
                                e.target.value = ''; // Reset
                            }
                        }}
                        disabled={isReadOnly}
                    >
                        <option value="">Seleccionar servicio...</option>
                        {availableServices.map(s => (
                            <option key={s.id} value={s.id}>
                                {s.name} ({s.type === 'RECURRING' ? 'Mensual' : 'Único'} - ${s.baseCost})
                            </option>
                        ))}
                    </select>
                    <Button variant="outline" onClick={() => navigate('/services')} disabled={isReadOnly}>
                        Gestionar Servicios
                    </Button>
                </div>
                </div>
            )}

            {/* Lista de Servicios Seleccionados (Editables) */}
            <div className="space-y-4">
              {selectedServices.length === 0 && (
                <div className="text-center py-8 border-2 border-dashed border-gray-200 dark:border-slate-800 rounded-xl text-gray-400">
                  No hay servicios seleccionados. Agrega uno arriba.
                </div>
              )}
              
              {selectedServices.map((item, index) => (
                <div key={item.instanceId} className={`border border-gray-200 dark:border-slate-700 rounded-xl p-4 bg-white dark:bg-slate-800 relative group animate-in fade-in slide-in-from-bottom-2 duration-300 ${isReadOnly ? 'pointer-events-none' : ''}`}>
                  {/* Header del Item */}
                  <div className="flex justify-between items-start mb-3">
                      <div>
                          <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                              {item.name}
                              <Badge variant={item.type === 'RECURRING' ? 'blue' : 'yellow'} className="text-[10px]">
                                  {item.type === 'RECURRING' ? 'Mensual' : 'Único'}
                              </Badge>
                          </h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">{item.description}</p>
                      </div>
                      {!isReadOnly && (
                        <button 
                            onClick={() => handleRemoveService(item.instanceId)}
                            className="text-gray-400 hover:text-red-500 p-1 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                            <Trash2 className="w-4 h-4"/>
                        </button>
                      )}
                  </div>

                  {/* Inputs de Precio y Costo (Editables) */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                      <div>
                          <Label className="text-xs">Precio al Cliente ($)</Label>
                          <Input 
                              type="number"
                              value={item.customPrice}
                              onChange={e => handleUpdateServiceItem(item.instanceId, { customPrice: Number(e.target.value) })}
                              className="font-bold text-emerald-600"
                              disabled={isReadOnly}
                          />
                      </div>
                      
                      <div>
                          <Label className="text-xs">Asignar a (Opcional)</Label>
                          <select 
                              className="w-full text-sm bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg p-2 h-[38px]"
                              value={item.assignedContractorId || ''}
                              onChange={e => handleUpdateServiceItem(item.instanceId, { assignedContractorId: e.target.value })}
                              disabled={isReadOnly}
                          >
                              <option value="">(Interno / Sin asignar)</option>
                              {contractors.map(c => <option key={c.id} value={c.id}>{c.name} ({c.role})</option>)}
                          </select>
                      </div>

                      <div>
                          <Label className="text-xs flex items-center justify-between">
                             Costo Externo ($)
                             {item.customPrice && item.outsourcingCost ? (
                                 <span className={`text-[10px] ${item.customPrice - item.outsourcingCost > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                     Margen: ${item.customPrice - item.outsourcingCost}
                                 </span>
                             ) : null}
                          </Label>
                          <Input 
                              type="number"
                              placeholder="0"
                              value={item.outsourcingCost || ''}
                              onChange={e => handleUpdateServiceItem(item.instanceId, { outsourcingCost: Number(e.target.value) })}
                              className="text-red-500"
                              disabled={isReadOnly}
                          />
                      </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* COLUMNA DER: Resumen Financiero y Acciones */}
        <div className="lg:col-span-1 space-y-6 sticky top-6 h-fit">
            {/* ... (Card de Resumen Financiero igual que antes) ... */}
            <Card className="p-6 bg-indigo-50 dark:bg-slate-800/50 border-indigo-100 dark:border-slate-700 sticky top-6">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
              <DollarSign className="w-5 h-5 text-emerald-500"/> Resumen Financiero
            </h3>

            <div className="space-y-3 mb-6">
                {/* Ingresos */}
                <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-gray-100 dark:border-slate-700">
                    <p className="text-xs text-gray-500 mb-1">Ingresos Brutos (Cliente)</p>
                    <div className="flex justify-between text-sm mb-1">
                        <span>Recurrente ({formData.durationMonths} meses):</span>
                        <span className="font-medium">${(totals.recurringRevenue * formData.durationMonths).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span>Pago Único:</span>
                        <span className="font-medium">${totals.oneTimeRevenue.toLocaleString()}</span>
                    </div>
                    <div className="border-t border-gray-100 dark:border-slate-700 my-2"></div>
                    <div className="flex justify-between font-bold text-indigo-600 dark:text-indigo-400">
                        <span>Total Contrato:</span>
                        <span>${totalContractRevenue.toLocaleString()}</span>
                    </div>
                </div>

                {/* Costos */}
                <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-100 dark:border-red-800 text-red-800 dark:text-red-300">
                    <p className="text-xs opacity-70 mb-1">Costos Externos (Equipo/Socios)</p>
                    <div className="flex justify-between text-sm mb-1">
                        <span>Recurrente ({formData.durationMonths} meses):</span>
                        <span>- ${(totals.recurringCost * formData.durationMonths).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span>Pago Único:</span>
                        <span>- ${totals.oneTimeCost.toLocaleString()}</span>
                    </div>
                    <div className="border-t border-red-200 dark:border-red-700/50 my-2"></div>
                    <div className="flex justify-between font-bold">
                        <span>Total Costos:</span>
                        <span>- ${totalContractCost.toLocaleString()}</span>
                    </div>
                </div>

                 {/* Ganancia Neta */}
                 <div className="bg-emerald-100 dark:bg-emerald-900/30 p-4 rounded-xl border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100">
                    <div className="flex justify-between items-center">
                        <div>
                            <p className="text-sm font-bold">Tu Ganancia Neta</p>
                            <p className="text-xs opacity-70">Margen estimado: {margin}%</p>
                        </div>
                        <p className="text-2xl font-black">
                            ${netProfit.toLocaleString()}
                        </p>
                    </div>
                 </div>
            </div>

            {/* Warning si el margen es bajo */}
            {margin < 30 && totalContractRevenue > 0 && (
                <div className="flex items-start gap-2 text-amber-600 dark:text-amber-400 text-xs bg-amber-50 dark:bg-amber-900/20 p-2 rounded-lg mb-4">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0"/>
                    <p>Cuidado: El margen de ganancia es bajo ({margin}%). Considera aumentar precios o reducir costos externos.</p>
                </div>
            )}

            {/* Botones de Acción Final */}
            <div className="space-y-3">
                {isReadOnly ? (
                     <Button className="w-full" variant="secondary" disabled>
                        <Lock className="w-4 h-4 mr-2"/> Propuesta Cerrada
                     </Button>
                ) : (
                    <>
                        <Button 
                            onClick={() => handleSaveProposal('SENT')} 
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-md"
                            disabled={selectedServices.length === 0 || !formData.clientName}
                        >
                            <Send className="w-4 h-4 mr-2"/> Finalizar y Marcar "En Espera"
                        </Button>
                        {!proposalIdFromUrl && ( // Solo mostrar guardar borrador si es nuevo
                             <Button 
                                onClick={() => handleSaveProposal('DRAFT')} 
                                variant="secondary" 
                                className="w-full"
                            >
                                <Save className="w-4 h-4 mr-2"/> Guardar Borrador
                            </Button>
                        )}
                    </>
                )}

                <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => { setShowPdfPreview(true); /* setTimeout(...) para generar */ }}
                    disabled={selectedServices.length === 0}
                >
                    <FileText className="w-4 h-4 mr-2"/> Previsualizar PDF
                </Button>
            </div>

          </Card>
        </div>
      </div>
      
      {/* PDF Preview Modal (Se mantiene igual) */}
       {showPdfPreview && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 md:p-8 overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden relative animate-in zoom-in-95">
                {/* Header del Modal */}
                <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                        <FileText className="w-5 h-5 text-indigo-600"/> Vista Previa del Presupuesto
                    </h3>
                    <div className="flex gap-2">
                        <Button variant="secondary" size="sm" onClick={() => setShowPdfPreview(false)}>Cerrar</Button>
                        <Button size="sm" className="bg-indigo-600 text-white" onClick={() => { /* handleGeneratePDF() */ showToast("Generación PDF pendiente", "info")}}>
                            <Download className="w-4 h-4 mr-2"/> Descargar PDF
                        </Button>
                    </div>
                </div>
                
                {/* Contenido del PDF (Referencia) */}
                <div className="p-8 bg-gray-100 dark:bg-slate-950 overflow-y-auto max-h-[80vh]">
                    <div ref={pdfRef} className="bg-white text-gray-900 p-10 shadow-xl rounded-xl mx-auto max-w-3xl">
                        {/* ... (Diseño del PDF igual que antes) ... */}
                         <div className="flex justify-between items-start mb-10">
                            {/* Logo de la Agencia */}
                            <div>
                                <div className="h-12 w-12 bg-indigo-600 rounded-lg flex items-center justify-center mb-4">
                                    <Wand2 className="h-8 w-8 text-white" />
                                </div>
                                <h1 className="text-xl font-bold">Algoritmia Agency</h1>
                                <p className="text-sm text-gray-500">Soluciones Digitales Inteligentes</p>
                            </div>
                            {/* Datos del Cliente y Fecha */}
                            <div className="text-right">
                                <h2 className="text-3xl font-bold text-gray-900 mb-2">Propuesta Comercial</h2>
                                <p className="text-gray-500">Fecha: {new Date().toLocaleDateString()}</p>
                                <div className="mt-4 p-3 bg-gray-50 rounded-lg inline-block text-left border border-gray-100">
                                    <p className="text-xs text-gray-400 uppercase font-bold">Preparado para:</p>
                                    <p className="font-bold text-lg">{formData.clientName}</p>
                                    {formData.industry && <p className="text-sm text-gray-600">{formData.industry}</p>}
                                </div>
                            </div>
                        </div>

                        <hr className="my-8 border-gray-200"/>

                        {/* Resumen Ejecutivo */}
                        <div className="mb-10">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-indigo-600">
                                <ArrowRight className="w-5 h-5"/> Resumen Ejecutivo & Objetivos
                            </h3>
                            <p className="text-gray-700 leading-relaxed mb-4">{formData.objective}</p>
                            
                            <div className="grid grid-cols-2 gap-4 mt-6">
                                <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                                    <p className="font-bold text-indigo-800 mb-1">Situación Actual</p>
                                    <p className="text-sm text-indigo-700">{formData.currentSituation}</p>
                                </div>
                                <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                                    <p className="font-bold text-emerald-800 mb-1">Público Objetivo</p>
                                    <p className="text-sm text-emerald-700">{formData.targetAudience}</p>
                                </div>
                            </div>
                        </div>

                        {/* Plan de Inversión (Servicios) */}
                        <div className="mb-10">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-indigo-600">
                                <Briefcase className="w-5 h-5"/> Plan de Inversión Propuesto
                            </h3>
                            <div className="border border-gray-200 rounded-xl overflow-hidden">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50 text-gray-600 font-bold text-sm">
                                        <tr>
                                            <th className="p-4">Servicio / Solución</th>
                                            <th className="p-4 text-center">Tipo</th>
                                            <th className="p-4 text-right">Inversión</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {selectedServices.map((item) => (
                                            <tr key={item.instanceId} className="hover:bg-gray-50 transition-colors">
                                                <td className="p-4">
                                                    <p className="font-bold text-gray-900">{item.name}</p>
                                                    <p className="text-sm text-gray-500 mt-1">{item.description}</p>
                                                </td>
                                                <td className="p-4 text-center">
                                                    <Badge variant={item.type === 'RECURRING' ? 'blue' : 'yellow'} className="bg-opacity-20 text-xs">
                                                        {item.type === 'RECURRING' ? 'Mensual' : 'Único'}
                                                    </Badge>
                                                </td>
                                                <td className="p-4 text-right font-bold text-gray-900">
                                                    ${item.customPrice?.toLocaleString()}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Totales y Cierre */}
                        <div className="flex justify-end mb-10">
                            <div className="w-1/2 bg-gray-50 p-6 rounded-xl border border-gray-200">
                                <h4 className="font-bold text-lg mb-4">Resumen de Inversión</h4>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span>Inversión Mensual (Recurrente):</span>
                                        <span className="font-medium">${totals.recurringRevenue.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Inversión Inicial (Único):</span>
                                        <span className="font-medium">${totals.oneTimeRevenue.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between text-gray-500">
                                        <span>Duración del contrato:</span>
                                        <span>{formData.durationMonths} meses</span>
                                    </div>
                                    <hr className="my-2 border-gray-300"/>
                                    <div className="flex justify-between text-xl font-black text-indigo-600">
                                        <span>Valor Total del Contrato:</span>
                                        <span>${totalContractRevenue.toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      )}

    </div>
  );
}