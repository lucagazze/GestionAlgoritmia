
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
  const [viewMode, setViewMode] = useState<'CALCULATOR' | 'HISTORY'>('CALCULATOR');
  const [proposals, setProposals] = useState<any[]>([]);

  const [currentStep, setCurrentStep] = useState(1);
  const [services, setServices] = useState<Service[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [rewritingServiceId, setRewritingServiceId] = useState<string | null>(null);

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
  const [customDescriptions, setCustomDescriptions] = useState<Record<string, string>>({});
  const [customTypes, setCustomTypes] = useState<Record<string, 'ONE_TIME' | 'RECURRING'>>({});
  const [outsourcingCosts, setOutsourcingCosts] = useState<Record<string, number>>({});
  const [assignedContractors, setAssignedContractors] = useState<Record<string, string>>({});

  // ... (rest)

  // --- STEP 3: REVIEW & AI ---
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [showPrompt, setShowPrompt] = useState(false);

  // --- AI CHAT --

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
      const [servicesData, contractorsData, proposalsData] = await Promise.all([
        db.services.getAll(),
        db.contractors.getAll(),
        db.proposals.getAll()
      ]);
      setServices(servicesData);
      setContractors(contractorsData);
      setProposals(proposalsData);
      setIsLoading(false);
    };
    init();
  }, []);

  const handleRefreshHistory = async () => {
      setIsLoading(true);
      const data = await db.proposals.getAll();
      setProposals(data);
      setIsLoading(false);
  };

  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isChatOpen]);

  // --- LOGIC: CALCULATIONS ---
  const toggleService = (id: string) => {
    setSelectedServiceIds(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  // Defaults to baseCost if not overridden
  const getSellingPrice = (service: Service) => customPrices[service.id] !== undefined ? customPrices[service.id] : service.baseCost;
  const getServiceDescription = (service: Service) => customDescriptions[service.id] !== undefined ? customDescriptions[service.id] : (service.description || '');
  const getServiceType = (service: Service) => customTypes[service.id] !== undefined ? customTypes[service.id] : service.type;

  const servicesByCategory = useMemo<Record<string, Service[]>>(() => {
    const grouped: Record<string, Service[]> = {};
    services.forEach(s => {
      if (!grouped[s.category]) grouped[s.category] = [];
      grouped[s.category].push(s);
    });
    return grouped;
  }, [services]);


  const calculations = useMemo(() => {
    const selected = services.filter(s => selectedServiceIds.includes(s.id)).map(s => ({
        ...s,
        description: getServiceDescription(s), // Override description for calculation context
        type: getServiceType(s) as ServiceType // Override type for calculation context
    }));
    
    let totalOutsourcingOneTime = 0;
    let totalOutsourcingRecurring = 0;

    selected.forEach(s => {
        const outCost = outsourcingCosts[s.id] || 0;
        if (s.type === ServiceType.ONE_TIME) totalOutsourcingOneTime += outCost; // Use overridden type
        else totalOutsourcingRecurring += outCost;
    });

    // Use overridden type for logic
    const oneTimeTotal = selected.filter(s => s.type === ServiceType.ONE_TIME).reduce((acc, s) => acc + getSellingPrice(s), 0);
    const recurringTotal = selected.filter(s => s.type === ServiceType.RECURRING).reduce((acc, s) => acc + getSellingPrice(s), 0);

    const setupFee = oneTimeTotal;
    const monthlyFee = recurringTotal;
    const contractValue = setupFee + (monthlyFee * contractVars.duration);
    
    const totalOutsourcingCost = totalOutsourcingOneTime + (totalOutsourcingRecurring * contractVars.duration);
    
    const profit = contractValue - totalOutsourcingCost; 
    
    return { selected, setupFee, monthlyFee, contractValue, profit, totalOutsourcingCost };
  }, [services, selectedServiceIds, contractVars, customPrices, outsourcingCosts, customDescriptions, customTypes]);

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

  // State to track if we are editing an existing proposal
  const [activeProposalId, setActiveProposalId] = useState<string | null>(null);

  // ... (existing helper functions)

  const handleLoadProposal = (p: any) => {
      setActiveProposalId(p.id); // Set active ID for updates
      
      // 1. Load Client Info
      setClientInfo({
          name: p.client?.name || '',
          industry: p.client?.industry || '',
          targetAudience: p.targetAudience || '', // Correctly load
          currentSituation: p.currentSituation || '', // Correctly load
          objective: p.objective || ''
      });

      // ... (rest of load logic)
      const serviceIds: string[] = [];
      const newCustomPrices: Record<string, number> = {};
      const newCustomDescriptions: Record<string, string> = {};
      const newCustomTypes: Record<string, 'ONE_TIME' | 'RECURRING'> = {};
      const newAssignedContractors: Record<string, string> = {};
      const newOutsourcingCosts: Record<string, number> = {};
      
      loadProposalItems(p.id).then(items => {
          items.forEach((item: any) => {
              serviceIds.push(item.serviceId);
              newCustomPrices[item.serviceId] = item.serviceSnapshotCost;
              if (item.serviceSnapshotDescription) {
                  newCustomDescriptions[item.serviceId] = item.serviceSnapshotDescription;
              }
              if (item.serviceSnapshotType) {
                  newCustomTypes[item.serviceId] = item.serviceSnapshotType;
              }
              // ✅ LOAD CONTRACTOR ASSIGNMENTS
              if (item.assignedContractorId) {
                  newAssignedContractors[item.serviceId] = item.assignedContractorId;
              }
              if (item.outsourcingCost) {
                  newOutsourcingCosts[item.serviceId] = item.outsourcingCost;
              }
          });
          setSelectedServiceIds(serviceIds);
          setCustomPrices(newCustomPrices);
          setCustomDescriptions(newCustomDescriptions);
          setCustomTypes(newCustomTypes);
          setAssignedContractors(newAssignedContractors);
          setOutsourcingCosts(newOutsourcingCosts);
          
          setContractVars({
              budget: '',
              duration: p.durationMonths || 6
          });

          setViewMode('CALCULATOR');
          setCurrentStep(3);
          
          if (p.aiPromptGenerated) {
              setGeneratedPrompt(p.aiPromptGenerated);
              setShowPrompt(true);
          }
      });
  };

  const saveProposal = async () => {
    if (!clientInfo.name || selectedServiceIds.length === 0) {
      alert("Falta nombre del cliente o servicios.");
      return;
    }

    setIsSaving(true);
    const { setupFee, monthlyFee, contractValue, selected } = calculations;
    
    // Prepare Data
    const proposalData = {
        status: ProposalStatus.DRAFT,
        objective: clientInfo.objective,
        targetAudience: clientInfo.targetAudience,
        currentSituation: clientInfo.currentSituation,
        durationMonths: contractVars.duration,
        totalOneTimePrice: setupFee,
        totalRecurringPrice: monthlyFee,
        totalContractValue: contractValue,
        aiPromptGenerated: generatedPrompt
    };

    const itemsData = selected.map(s => ({
          serviceId: s.id,
          serviceSnapshotName: s.name,
          serviceSnapshotDescription: s.description, // Save description
          serviceSnapshotType: s.type, // Save type
          serviceSnapshotCost: getSellingPrice(s),
          
          // ✅ NUEVO: Vinculamos los datos de los inputs del Paso 2
          assignedContractorId: assignedContractors[s.id] || null,
          outsourcingCost: outsourcingCosts[s.id] || 0
    }));

    try {
      if (activeProposalId) {
          // UPDATE
          await db.proposals.update(activeProposalId, proposalData, itemsData);
          alert("¡Propuesta Actualizada!");
      } else {
          // CREATE NEW
          await db.proposals.create({
              ...proposalData,
              items: itemsData.map(i => ({ ...i, id: '' })) // Create expects full object structure usually, but mapping effectively
          } as any, clientInfo.name, clientInfo.industry); // Accessing internal create type structure
          alert("¡Propuesta Guardada!");
      }
      
      handleRefreshHistory();
    } catch (error) {
      console.error(error);
      alert("Error al guardar.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleNewProposal = () => {
      setActiveProposalId(null);
      setClientInfo({ name: '', industry: '', targetAudience: '', currentSituation: '', objective: '' });
      setSelectedServiceIds([]);
      setCustomPrices({});
      setCustomDescriptions({});
      setCustomTypes({});
      setAssignedContractors({});
      setOutsourcingCosts({});
      setCurrentStep(1);
      setViewMode('CALCULATOR');
  };

  // ... (rest of code)


  const loadProposalItems = async (proposalId: string) => {
      return await db.proposals.getItems(proposalId);
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

    setShowPrompt(true);
  };

  const handleAiRewrite = async (serviceId: string, currentDesc: string) => {
      setRewritingServiceId(serviceId);
      try {
          const serviceName = services.find(s => s.id === serviceId)?.name || 'este servicio';
          const prompt = `
          Actúa como Project Manager Técnico de Agencia.
          
          CONTEXTO DEL CLIENTE:
          - Empresa: ${clientInfo.name}
          - Industria: ${clientInfo.industry}
          - Situación Actual: ${clientInfo.currentSituation}
          - Objetivo: ${clientInfo.objective}
          
          SERVICIO: ${serviceName}
          Descripción Base: "${currentDesc}"
          
          TAREA:
          Reescribe la descripción siendo MUY ESPECÍFICO sobre QUÉ vamos a entregar técnicamente.
          Enfócate en:
          1. Los ENTREGABLES concretos (ej: "Landing page responsive", "Sistema de reservas online")
          2. CARACTERÍSTICAS técnicas clave (ej: "Adaptado a móvil", "Optimizado para velocidad")
          3. Lo que el cliente VA A RECIBIR físicamente
          
          ESTILO:
          - Claro y directo, como una lista de trabajo
          - Evita lenguaje de marketing o persuasivo
          - Usa términos técnicos cuando sea apropiado
          - Máximo 15 palabras
          - Sin emojis
          
          EJEMPLO BUENO: "Landing page responsive. Formulario de contacto. Optimización SEO básica."
          EJEMPLO MALO: "Creamos páginas que consolidan tu autoridad y atraen clientes de alto valor eliminando la dependencia..."
          `;
          const res = await ai.chat([{ role: 'user', content: prompt }]);
          if (res) {
              setCustomDescriptions(prev => ({...prev, [serviceId]: res.replace(/"/g, '')}));
          }
      } catch (e) {
          console.error(e);
      } finally {
          setRewritingServiceId(null);
      }
  }

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

  const handleDeleteProposal = async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (confirm("¿Estás seguro de que quieres eliminar esta propuesta? Esta acción no se puede deshacer.")) {
          try {
              await db.proposals.delete(id);
              handleRefreshHistory();
          } catch (error) {
              console.error(error);
              alert("Error al eliminar la propuesta.");
          }
      }
  };

  const generatePDF = async () => {
    try {
      console.log("Generating PDF...");
      const doc: any = new jsPDF();
      
      // -- LOGO --
      try {
        // Load logo image
        const logoImg = new Image();
        logoImg.src = '/logo.png';
        await new Promise((resolve, reject) => {
          logoImg.onload = resolve;
          logoImg.onerror = reject;
        });
        
        // Add logo to PDF (adjusted for better appearance)
        doc.addImage(logoImg, 'PNG', 14, 12, 30, 12); // x, y, width, height - smaller and better positioned
        console.log("PDF: Logo added");
      } catch (e) {
        console.warn("Could not load logo, using text fallback:", e);
        // Fallback to text if logo fails to load
        doc.setFont("helvetica", "bold");
        doc.setFontSize(22);
        doc.setTextColor(0, 0, 0);
        doc.text("ALGORITMIA", 14, 20);
      }
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100);
      doc.text("Desarrollo de Software & Growth", 14, 27);

      // -- CLIENT INFO --
      doc.setDrawColor(240);
      doc.setFillColor(250, 250, 250);
      doc.roundedRect(14, 35, 180, 25, 3, 3, 'FD');
      
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text("PREPARADO PARA", 20, 42);
      
      doc.setFontSize(14);
      doc.setTextColor(0);
      doc.setFont("helvetica", "bold");
      doc.text(clientInfo.name || "Cliente", 20, 50);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(80);
      doc.text(clientInfo.industry || "", 20, 56);

      doc.text(new Date().toLocaleDateString(), 180, 20, { align: 'right' });
      console.log("PDF: Client Info set");

      // -- CONTEXT & TRANSFORMATION (Persuasive) --
      let yPos = 70;
      
      if (clientInfo.objective || clientInfo.currentSituation || clientInfo.targetAudience) {
           doc.setFontSize(10);
           doc.setFont("helvetica", "bold");
           doc.setTextColor(0);
           doc.text("Plan Estratégico", 14, yPos);
           yPos += 7;
           
           doc.setDrawColor(230);
           doc.line(14, yPos, 194, yPos);
           yPos += 5;

           // Transformation Grid (Without Arrow)
           if (clientInfo.currentSituation && clientInfo.objective) {
                // Situation (Left)
                doc.setFontSize(8);
                doc.setTextColor(150);
                doc.text("SITUACIÓN ACTUAL (Punto A)", 14, yPos);
                
                doc.setFontSize(9);
                doc.setTextColor(80);
                const splitSit = doc.splitTextToSize(clientInfo.currentSituation || " ", 80);
                doc.text(splitSit, 14, yPos + 5);

                // Objective (Right)
                doc.setFontSize(8);
                doc.setTextColor(150);
                doc.text("OBJETIVO (Punto B)", 110, yPos);

                doc.setFontSize(9);
                doc.setTextColor(0);
                doc.setFont("helvetica", "bold");
                const splitObj = doc.splitTextToSize(clientInfo.objective || " ", 80);
                doc.text(splitObj, 110, yPos + 5);
                
                yPos += Math.max(splitSit.length, splitObj.length) * 5 + 10;
           }

           /*
           // Target Audience Tag - REMOVED PER USER REQUEST
           if (clientInfo.targetAudience) {
               // ...
           }
           */
      }
      console.log("PDF: Context set");

      // -- SERVICES TABLE --
      doc.autoTable({
          startY: yPos,
          head: [['Servicio', 'Tipo', 'Inversión']],
          body: calculations.selected.map(s => [
              s.name + (s.description ? `\n${s.description}` : ''),
              s.type === 'ONE_TIME' ? 'Setup' : 'Mes',
              `$${getSellingPrice(s).toLocaleString()}`
          ]),
          styles: { 
              fontSize: 9, 
              cellPadding: 4,
              overflow: 'linebreak',
              valign: 'top',
              textColor: [100, 100, 100] // Gray for description
          },
          headStyles: { 
              fillColor: [0, 0, 0], 
              textColor: 255, 
              fontStyle: 'bold',
              cellPadding: 4
          },
          columnStyles: { 
              0: { cellWidth: 110 },
              2: { halign: 'right', fontStyle: 'bold', textColor: [0,0,0] } 
          },
          theme: 'grid',
          // Modify cell content before drawing to style service name differently
          willDrawCell: function(data: any) {
              if (data.section === 'body' && data.column.index === 0) {
                  const text = data.cell.text;
                  if (text && text.length > 0) {
                      // Clear the cell text - we'll draw it manually
                      data.cell.text = [];
                  }
              }
          },
          // Draw service name in bold black and description in gray
          didDrawCell: function(data: any) {
              if (data.section === 'body' && data.column.index === 0) {
                  const rawText = data.row.raw[0]; // Get original text
                  if (rawText) {
                      const lines = rawText.split('\n');
                      const serviceName = lines[0];
                      const description = lines.slice(1).join('\n');
                      
                      const x = data.cell.x + data.cell.padding('left');
                      let y = data.cell.y + data.cell.padding('top') + 3;
                      
                      // Draw service name in bold black
                      data.doc.setFont("helvetica", "bold");
                      data.doc.setTextColor(0, 0, 0);
                      data.doc.setFontSize(9);
                      data.doc.text(serviceName, x, y);
                      
                      // Draw description in gray normal
                      if (description) {
                          y += 4; // Line spacing
                          data.doc.setFont("helvetica", "normal");
                          data.doc.setTextColor(100, 100, 100);
                          const descLines = data.doc.splitTextToSize(description, data.cell.width - data.cell.padding('left') - data.cell.padding('right'));
                          data.doc.text(descLines, x, y);
                      }
                  }
              }
          }
      });

      // -- SUMMARY --
      const finalY = (doc as any).lastAutoTable.finalY + 15;
      
      // Draw Summary Box
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(200);
      doc.roundedRect(120, finalY, 76, 50, 3, 3, 'FD');

      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text("Setup Inicial", 125, finalY + 10);
      doc.setFontSize(12);
      doc.setTextColor(0);
      doc.text(`$${calculations.setupFee.toLocaleString()}`, 190, finalY + 10, { align: 'right' });

      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text("Fee Mensual", 125, finalY + 20);
      doc.setFontSize(12);
      doc.setTextColor(0);
      doc.text(`$${calculations.monthlyFee.toLocaleString()}`, 190, finalY + 20, { align: 'right' });

      doc.setDrawColor(200);
      doc.line(125, finalY + 28, 190, finalY + 28);

      doc.setFontSize(11);
      doc.setTextColor(100);
      doc.text("TOTAL", 125, finalY + 40);
      doc.setFontSize(8);
      doc.text(`(${contractVars.duration} meses)`, 125, finalY + 44);
      
      doc.setFontSize(16);
      doc.setTextColor(0, 102, 204); // Blue branding
      doc.setFont("helvetica", "bold");
      doc.text(`$${calculations.contractValue.toLocaleString()}`, 190, finalY + 42, { align: 'right' });

      // -- FOOTER --
      const pageHeight = doc.internal.pageSize.height;
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text("Generado por Algoritmia para uso exclusivo.", 14, pageHeight - 10);

      doc.save(`Propuesta_${clientInfo.name.replace(/\s+/g, '_')}.pdf`);
      console.log("PDF: Saved");

    } catch (e) {
        console.error("PDF GENERATION FAILED:", e);
        alert("Error generando PDF. Revisa la consola.");
    }
  }

  // Función para generar PDF exclusivo para el socio (Orden de Trabajo)
  const generatePartnerPDF = async (contractorId: string) => {
    try {
      const partner = contractors.find(c => c.id === contractorId);
      if (!partner) return;

      // Filtramos solo los servicios asignados a ESTE socio
      const partnerServices = calculations.selected.filter(s => assignedContractors[s.id] === contractorId);

      if (partnerServices.length === 0) {
          alert("Este socio no tiene servicios asignados en esta propuesta.");
          return;
      }

      const doc: any = new jsPDF();
      
      // -- LOGO (igual que el PDF del cliente) --
      try {
        const logoImg = new Image();
        logoImg.src = '/logo.png';
        await new Promise((resolve, reject) => {
          logoImg.onload = resolve;
          logoImg.onerror = reject;
        });
        
        doc.addImage(logoImg, 'PNG', 14, 12, 30, 12);
      } catch (e) {
        console.warn("Could not load logo, using text fallback:", e);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(22);
        doc.setTextColor(0, 0, 0);
        doc.text("ALGORITMIA", 14, 20);
      }
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100);
      doc.text("Desarrollo de Software & Growth", 14, 27);

      // -- PARTNER INFO BOX --
      doc.setDrawColor(240);
      doc.setFillColor(250, 250, 250);
      doc.roundedRect(14, 35, 180, 25, 3, 3, 'FD');
      
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text("ORDEN DE TRABAJO PARA", 20, 42);
      
      doc.setFontSize(14);
      doc.setTextColor(0);
      doc.setFont("helvetica", "bold");
      doc.text(partner.name, 20, 50);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(80);
      doc.text(`Cliente Final: ${clientInfo.name}`, 20, 56);

      doc.text(new Date().toLocaleDateString(), 180, 20, { align: 'right' });

      // -- PLAN ESTRATÉGICO (igual que el PDF del cliente) --
      let yPos = 70;
      
      if (clientInfo.objective || clientInfo.currentSituation) {
           doc.setFontSize(10);
           doc.setFont("helvetica", "bold");
           doc.setTextColor(0);
           doc.text("Plan Estratégico", 14, yPos);
           yPos += 7;
           
           doc.setDrawColor(230);
           doc.line(14, yPos, 194, yPos);
           yPos += 5;

           // Transformation Grid
           if (clientInfo.currentSituation && clientInfo.objective) {
                // Situation (Left)
                doc.setFontSize(8);
                doc.setTextColor(150);
                doc.text("SITUACIÓN ACTUAL (Punto A)", 14, yPos);
                
                doc.setFontSize(9);
                doc.setTextColor(80);
                const splitSit = doc.splitTextToSize(clientInfo.currentSituation || " ", 80);
                doc.text(splitSit, 14, yPos + 5);

                // Objective (Right)
                doc.setFontSize(8);
                doc.setTextColor(150);
                doc.text("OBJETIVO (Punto B)", 110, yPos);

                doc.setFontSize(9);
                doc.setTextColor(0);
                doc.setFont("helvetica", "bold");
                const splitObj = doc.splitTextToSize(clientInfo.objective || " ", 80);
                doc.text(splitObj, 110, yPos + 5);
                
                yPos += Math.max(splitSit.length, splitObj.length) * 5 + 10;
           }
      }

      // -- SERVICES TABLE (mismo estilo que el PDF del cliente) --
      doc.autoTable({
          startY: yPos,
          head: [['Servicio / Entregable', 'Tipo', 'Tu Presupuesto']],
          body: partnerServices.map(s => [
              s.name + (customDescriptions[s.id] ? `\n${customDescriptions[s.id]}` : ''),
              customTypes[s.id] === 'ONE_TIME' ? 'Setup' : 'Mes',
              `$${(outsourcingCosts[s.id] || 0).toLocaleString()}`
          ]),
          styles: { 
              fontSize: 9, 
              cellPadding: 4,
              overflow: 'linebreak',
              valign: 'top',
              textColor: [100, 100, 100]
          },
          headStyles: { 
              fillColor: [0, 0, 0], // Negro igual que el PDF del cliente
              textColor: 255, 
              fontStyle: 'bold',
              cellPadding: 4
          },
          columnStyles: { 
              0: { cellWidth: 110 },
              2: { halign: 'right', fontStyle: 'bold', textColor: [0,0,0] } 
          },
          theme: 'grid'
      });

      // -- TOTAL --
      const totalPay = partnerServices.reduce((sum, s) => sum + (outsourcingCosts[s.id] || 0), 0);
      const finalY = (doc as any).lastAutoTable.finalY + 15;

      // Summary Box (igual que el PDF del cliente)
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(200);
      doc.roundedRect(120, finalY, 76, 30, 3, 3, 'FD');

      doc.setFontSize(11);
      doc.setTextColor(100);
      doc.text("TOTAL A PERCIBIR", 125, finalY + 12);
      
      doc.setFontSize(16);
      doc.setTextColor(0, 102, 204); // Azul igual que el PDF del cliente
      doc.setFont("helvetica", "bold");
      doc.text(`$${totalPay.toLocaleString()}`, 190, finalY + 24, { align: 'right' });

      // -- FOOTER --
      const pageHeight = doc.internal.pageSize.height;
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text("Generado por Algoritmia para uso exclusivo.", 14, pageHeight - 10);

      doc.save(`WorkOrder_${partner.name}_${clientInfo.name}.pdf`);
    } catch (e) {
        console.error("Partner PDF GENERATION FAILED:", e);
        alert("Error generando PDF. Revisa la consola.");
    }
  };

  if (isLoading) return <div className="flex h-screen items-center justify-center text-gray-400"><Loader2 className="animate-spin w-8 h-8 mr-2" /> Cargando Sistema...</div>;

  return (
    <div className="pb-20 animate-in fade-in duration-500 max-w-5xl mx-auto">
      
      {/* HEADER WITH TOGGLE */}
      <div className="mb-6 mt-2 flex items-center justify-between px-2">
          <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Cotizador</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Generador de presupuestos High-Ticket.</p>
          </div>
          <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-lg">
              <button 
                onClick={handleNewProposal} 
                className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${viewMode === 'CALCULATOR' && !activeProposalId ? 'bg-white dark:bg-slate-700 shadow-sm text-black dark:text-white' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Generador
              </button>
              <button 
                onClick={() => {setViewMode('HISTORY'); handleRefreshHistory();}} 
                className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${viewMode === 'HISTORY' ? 'bg-white dark:bg-slate-700 shadow-sm text-black dark:text-white' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Historial
              </button>
          </div>
      </div>

      {viewMode === 'HISTORY' ? (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
               {proposals.length === 0 ? (
                   <div className="text-center py-20 bg-gray-50 dark:bg-slate-900 rounded-3xl border border-dashed border-gray-200 dark:border-slate-800">
                       <p className="text-gray-400 font-medium">No hay cotizaciones guardadas aún.</p>
                       <Button variant="ghost" onClick={handleNewProposal}>Crear Nueva</Button>
                   </div>
               ) : (
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                       {proposals.map(p => (
                           <Card key={p.id} className="border-none shadow-lg shadow-black/5 hover:shadow-xl transition-all hover:-translate-y-1 bg-white dark:bg-slate-900 overflow-hidden group">
                               <div className="h-2 bg-gradient-to-r from-blue-500 to-indigo-600"></div>
                               <CardContent className="p-6 space-y-4">
                                   <div className="flex justify-between items-start">
                                       <div>
                                           <h3 className="font-bold text-lg text-gray-900 dark:text-white">{p.client?.name || 'Cliente sin nombre'}</h3>
                                           <p className="text-xs text-gray-500">{p.client?.industry || 'Sin industria'} • {new Date(p.createdAt).toLocaleDateString()}</p>
                                       </div>
                                      <Badge variant={p.status === 'DRAFT' ? 'outline' : 'blue'}>{p.status}</Badge>
                                   </div>
                                   
                                   <div className="space-y-2 pt-2">
                                       <div className="flex justify-between text-sm">
                                           <span className="text-gray-500">Recurrente</span>
                                           <span className="font-bold dark:text-white">${p.totalRecurringPrice?.toLocaleString()}</span>
                                       </div>
                                        <div className="flex justify-between text-sm">
                                           <span className="text-gray-500">Setup</span>
                                           <span className="font-bold dark:text-white">${p.totalOneTimePrice?.toLocaleString()}</span>
                                       </div>
                                       <div className="pt-2 border-t border-gray-100 dark:border-slate-800 flex justify-between items-center">
                                           <span className="text-xs font-bold uppercase text-gray-400">Total Contrato</span>
                                           <span className="text-xl font-black text-blue-600 dark:text-blue-400">${p.totalContractValue?.toLocaleString()}</span>
                                       </div>
                                   </div>
    
                                   <div className="pt-4 flex gap-2">
                                       <Button variant="outline" className="flex-1 text-xs h-8" onClick={() => handleLoadProposal(p)}>Ver Detalles</Button>
                                       <Button variant="ghost" className="h-8 w-8 p-0 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={(e) => handleDeleteProposal(p.id, e)}><div className="w-4 h-4"><X /></div></Button>
                                   </div>
                               </CardContent>
                           </Card>
                       ))}
                   </div>
               )}
          </div>
      ) : (
        /* WIZARD CONTENT */
        <>
            {/* STEPS HEADER */}
            <div className="flex justify-between items-center mb-8 px-4 py-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-full border border-gray-100 dark:border-slate-800 shadow-lg sticky top-2 z-20 mx-2 md:mx-4">
               {STEPS.map((step, idx) => {
                   const Icon = step.icon;
                   const isActive = currentStep === step.number;
                   const isCompleted = currentStep > step.number;
                   
                   return (
                       <div key={step.number} onClick={() => setCurrentStep(step.number)} className={`flex items-center gap-2 md:gap-3 cursor-pointer group`}>
                           <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center font-bold text-xs md:text-sm transition-all duration-300 ${isActive ? 'bg-black dark:bg-white text-white dark:text-black shadow-md scale-110' : isCompleted ? 'bg-green-500 text-white' : 'bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-gray-500 group-hover:bg-gray-200'}`}>
                               {isCompleted ? <Check className="w-4 h-4 md:w-5 md:h-5"/> : step.number}
                           </div>
                           <div className={`${isActive ? 'opacity-100' : 'opacity-40'} hidden sm:block transition-opacity`}>
                               <div className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200">{step.title}</div>
                           </div>
                           {idx < STEPS.length - 1 && <div className="w-4 md:w-12 h-[1px] bg-gray-200 dark:bg-slate-800 mx-1 md:mx-2"></div>}
                       </div>
                   )
               })}
               <div className="flex gap-2">
                   <Button variant="outline" size="sm" onClick={() => setIsChatOpen(!isChatOpen)} className="rounded-full w-8 h-8 md:w-auto p-0 md:px-3">
                       <Bot className="w-4 h-4 md:mr-2" /> <span className="hidden md:inline">Ayuda</span>
                   </Button>
               </div>
            </div>
    
            <div className="grid grid-cols-1 gap-6 px-2 md:px-4">
                {/* STEP 1: DISCOVERY FORM */}
                {currentStep === 1 && (
                   <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                      <Card className="overflow-visible">
                          <CardHeader className="flex flex-row justify-between items-center">
                              <CardTitle className="flex items-center gap-2"><User className="w-5 h-5"/> Información del Cliente</CardTitle>
                              <Button variant="ghost" size="sm" onClick={handleAiAutoFill} disabled={isGeneratingContext} className="text-blue-600 hover:bg-blue-50 text-xs md:text-sm">
                                   {isGeneratingContext ? <Loader2 className="animate-spin w-4 h-4 md:mr-2" /> : <Sparkles className="w-4 h-4 md:mr-2" />}
                                   <span className="hidden md:inline">Autocompletar con IA</span>
                                   <span className="md:hidden">IA</span>
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
                        <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm">
                          <h2 className="text-xl font-bold dark:text-white">Selecciona Servicios</h2>
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
                                                 className={`cursor-pointer border rounded-2xl p-4 transition-all duration-200 ${isSelected ? 'border-black dark:border-white bg-white dark:bg-slate-800 ring-2 ring-black/5 dark:ring-white/5 shadow-lg scale-[1.02]' : 'border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-gray-300 dark:hover:border-slate-600 hover:shadow-md'}`}>
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className="font-semibold text-sm leading-tight dark:text-white">{s.name}</span>
                                                    {isSelected && <div className="w-5 h-5 bg-black dark:bg-white rounded-full flex items-center justify-center"><Check className="w-3 h-3 text-white dark:text-black" /></div>}
                                                </div>
                                                {isSelected && (
                                                    <div className="space-y-2 mt-3 pt-3 border-t border-gray-100 dark:border-slate-700 animate-in fade-in" onClick={e => e.stopPropagation()}>
                                                        <div className="flex justify-between items-center">
                                                            <label className="text-[10px] text-gray-500 font-bold uppercase">Precio de Venta</label>
                                                            <input type="number" className="w-20 text-right text-xs bg-gray-50 dark:bg-slate-900 rounded px-1 py-1 font-bold outline-none focus:ring-1 focus:ring-black dark:focus:ring-white text-gray-900 dark:text-white" 
                                                                   value={getSellingPrice(s)} onChange={e => setCustomPrices({...customPrices, [s.id]: parseFloat(e.target.value)})} />
                                                        </div>
                                                        <div className="flex justify-between items-center">
                                                            <label className="text-[10px] text-gray-500 font-bold uppercase">Tipo de Cobro</label>
                                                            <select 
                                                                className="text-xs bg-gray-50 dark:bg-slate-900 rounded px-2 py-1 font-medium outline-none focus:ring-1 focus:ring-black dark:focus:ring-white text-gray-900 dark:text-white"
                                                                value={getServiceType(s)}
                                                                onChange={e => setCustomTypes({...customTypes, [s.id]: e.target.value as 'ONE_TIME' | 'RECURRING'})}
                                                            >
                                                                <option value="ONE_TIME">Único</option>
                                                                <option value="RECURRING">Mensual</option>
                                                            </select>
                                                        </div>
                                                        <div className="flex justify-between items-center bg-gray-50 dark:bg-slate-800 p-1.5 rounded-lg">
                                                            <select 
                                                              className="text-[10px] bg-transparent outline-none w-24 font-medium dark:text-white" 
                                                              value={assignedId || ''} 
                                                              onChange={e => {
                                                                  const pid = e.target.value;
                                                                  const partner = contractors.find(c => c.id === pid);
                                                                  setAssignedContractors({...assignedContractors, [s.id]: pid});
                                                                  // Auto-fill outsourcing cost based on partner's hourly rate
                                                                  if (partner && partner.hourlyRate > 0) {
                                                                      setOutsourcingCosts(prev => ({...prev, [s.id]: partner.hourlyRate}));
                                                                  }
                                                              }}
                                                            >
                                                                <option value="">(Interno)</option>
                                                                {contractors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                                            </select>
                                                            {assignedId && (
                                                                <input type="number" placeholder="$ Costo" className="w-12 text-right text-[10px] bg-white dark:bg-slate-900 rounded px-1 border border-gray-200 dark:border-slate-700 dark:text-white"
                                                                       value={outsourcingCosts[s.id] || ''} onChange={e => setOutsourcingCosts({...outsourcingCosts, [s.id]: parseFloat(e.target.value)})} />
                                                            )}
                                                        </div>

                                                        {/* CUSTOM DESCRIPTION & AI REWRITE */}
                                                        <div className="pt-2">
                                                            <div className="flex justify-between items-center mb-1">
                                                                <label className="text-[10px] text-gray-500 font-bold uppercase">Descripción</label>
                                                                <button 
                                                                    className="text-[10px] flex items-center gap-1 text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-0.5 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleAiRewrite(s.id, getServiceDescription(s));
                                                                    }}
                                                                    disabled={rewritingServiceId === s.id}
                                                                >
                                                                    {rewritingServiceId === s.id ? (
                                                                        <>
                                                                            <Loader2 className="w-3 h-3 animate-spin" />
                                                                            <span className="hidden sm:inline">Generando...</span>
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <Sparkles className="w-3 h-3" /> <span className="hidden sm:inline">Reescribir</span>
                                                                        </>
                                                                    )}
                                                                </button>
                                                            </div>
                                                            <Textarea 
                                                                className="text-xs min-h-[60px] bg-gray-50 dark:bg-slate-800 border-0 focus:ring-1 focus:ring-black dark:text-white"
                                                                value={getServiceDescription(s)}
                                                                onChange={e => setCustomDescriptions({...customDescriptions, [s.id]: e.target.value})}
                                                                onClick={e => e.stopPropagation()} 
                                                            />
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
                            <Card className="border-2 border-black/5 dark:border-white/5 shadow-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
                                <CardHeader className="bg-gray-50/50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-800">
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
                                                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${contractVars.duration === m ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700'}`}
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

                            {/* GESTIÓN DE EQUIPO (NUEVO BLOQUE) */}
                            <Card className="border border-indigo-100 dark:border-indigo-900/30 bg-indigo-50/50 dark:bg-indigo-900/10">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm flex items-center gap-2 text-indigo-900 dark:text-indigo-200">
                                        <User className="w-4 h-4"/> Órdenes de Trabajo
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-xs text-gray-500 mb-3">Generar PDF individual con presupuesto de costo:</p>
                                    <div className="flex flex-wrap gap-2">
                                        {/* Buscamos los socios únicos asignados en esta propuesta */}
                                        {Array.from(new Set(Object.values(assignedContractors))).map(partnerId => {
                                            const partner = contractors.find(c => c.id === partnerId);
                                            if (!partner) return null;
                                            return (
                                                <Button 
                                                    key={partnerId} 
                                                    variant="outline" 
                                                    size="sm" 
                                                    onClick={() => generatePartnerPDF(partnerId)}
                                                    className="text-xs bg-white dark:bg-slate-800 hover:bg-indigo-50"
                                                >
                                                    📄 PDF para {partner.name.split(' ')[0]}
                                                </Button>
                                            );
                                        })}
                                        {Object.keys(assignedContractors).length === 0 && (
                                            <span className="text-xs text-gray-400 italic">No hay socios asignados aún.</span>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
      
                            <Card className="bg-gray-900 dark:bg-slate-800 text-white border-0">
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
                            <Card className="h-full border-0 shadow-2xl shadow-black/5 bg-gradient-to-br from-white to-gray-50 dark:from-slate-900 dark:to-slate-950 flex flex-col justify-between">
                                <div className="p-8">
                                    <h3 className="text-gray-400 font-bold uppercase tracking-widest text-xs mb-8">Resumen Económico</h3>
                                    
                                    <div className="space-y-8">
                                        <div className="flex justify-between items-end border-b border-gray-100 dark:border-slate-800 pb-4">
                                            <div>
                                                <p className="text-sm font-medium text-gray-500 mb-1">Fee Mensual (Recurrente)</p>
                                                <p className="text-xs text-gray-400">Durante {contractVars.duration} meses</p>
                                            </div>
                                            <div className="text-4xl font-bold tracking-tighter dark:text-white">${calculations.monthlyFee.toLocaleString()}</div>
                                        </div>
      
                                        <div className="flex justify-between items-end border-b border-gray-100 dark:border-slate-800 pb-4">
                                            <div>
                                                <p className="text-sm font-medium text-gray-500 mb-1">Setup / Onboarding</p>
                                                <p className="text-xs text-gray-400">Pago Único</p>
                                            </div>
                                            <div className="text-3xl font-bold tracking-tighter text-gray-700 dark:text-gray-300">${calculations.setupFee.toLocaleString()}</div>
                                        </div>
      
                                        <div className="bg-black dark:bg-white text-white dark:text-black p-6 rounded-2xl flex justify-between items-center shadow-lg">
                                            <div>
                                                <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Valor Total Contrato</p>
                                                <p className="text-xs opacity-50 mt-1">LTV (Life Time Value)</p>
                                            </div>
                                            <div className="text-3xl font-bold tracking-tight">${calculations.contractValue.toLocaleString()}</div>
                                        </div>
      
                                        {/* Internal Profit Stats */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-100 dark:border-green-900 text-center">
                                                <p className="text-xs text-green-800 dark:text-green-300 font-bold uppercase mb-1">Ganancia Estimada</p>
                                                <p className="text-xl font-bold text-green-700 dark:text-green-400">${calculations.profit.toLocaleString()}</p>
                                            </div>
                                            <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-900 text-center">
                                                <p className="text-xs text-red-800 dark:text-red-300 font-bold uppercase mb-1">Costos Externos</p>
                                                <p className="text-xl font-bold text-red-700 dark:text-red-400">${calculations.totalOutsourcingCost.toLocaleString()}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
      
                                <div className="p-6 bg-gray-50 dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800 flex gap-3">
                                    <Button variant="outline" className="flex-1 bg-white dark:bg-slate-800" onClick={generatePDF}>
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
                  <div className="fixed bottom-6 right-6 w-80 h-[500px] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-gray-200 dark:border-slate-700 flex flex-col z-50 animate-in slide-in-from-bottom-10 overflow-hidden">
                      <div className="p-4 bg-black dark:bg-white text-white dark:text-black flex justify-between items-center">
                          <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                              <span className="font-bold text-sm">Asistente IA</span>
                          </div>
                          <button onClick={() => setIsChatOpen(false)}><X className="w-4 h-4"/></button>
                      </div>
                      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-slate-950">
                          {chatMessages.filter(m => m.role !== 'system').map((msg, idx) => (
                              <div key={idx} className={`p-3 rounded-2xl text-xs leading-relaxed ${msg.role === 'user' ? 'bg-black dark:bg-white text-white dark:text-black ml-auto rounded-tr-none' : 'bg-white dark:bg-slate-800 border dark:border-slate-700 text-gray-700 dark:text-gray-300 rounded-tl-none shadow-sm'} max-w-[90%]`}>
                                  {msg.content}
                              </div>
                          ))}
                          {isAiThinking && <div className="flex gap-1 items-center text-gray-400 text-xs ml-2"><Loader2 className="w-3 h-3 animate-spin"/> Escribiendo...</div>}
                          <div ref={chatEndRef} />
                      </div>
                      <div className="p-3 border-t dark:border-slate-700 bg-white dark:bg-slate-900">
                          <form onSubmit={(e) => {e.preventDefault(); handleAiChat();}} className="flex gap-2">
                              <Input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Pregunta algo..." className="h-10 text-xs rounded-full pl-4" />
                              <Button type="submit" size="sm" className="h-10 w-10 rounded-full p-0 flex-shrink-0"><TrendingUp className="w-4 h-4" /></Button>
                          </form>
                      </div>
                  </div>
                )}
            </div>
        </>
      )}
    </div>
  );
}
