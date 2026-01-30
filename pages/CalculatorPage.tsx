import React, { useEffect, useState, useMemo } from 'react';
import { db } from '../services/db';
import { Service, ServiceType, ProposalStatus } from '../types';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Slider, Badge, Textarea } from '../components/UIComponents';
import { Calculator, Check, Copy, Save, Wand2, DollarSign, TrendingUp, Layers, FileDown, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export default function CalculatorPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Inputs
  const [clientName, setClientName] = useState('');
  const [objective, setObjective] = useState('');
  const [duration, setDuration] = useState(6);
  const [margin, setMargin] = useState(2.5);

  // Generated Outputs
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const init = async () => {
      const data = await db.services.getAll();
      setServices(data);
      setIsLoading(false);
    };
    init();
  }, []);

  const toggleService = (id: string) => {
    setSelectedServiceIds(prev => 
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

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
    const oneTimeCost = selected.filter(s => s.type === ServiceType.ONE_TIME).reduce((acc, s) => acc + s.baseCost, 0);
    const recurringCost = selected.filter(s => s.type === ServiceType.RECURRING).reduce((acc, s) => acc + s.baseCost, 0);
    const totalInternalCost = oneTimeCost + (recurringCost * duration);

    const roundPrice = (price: number) => Math.ceil(price / 50) * 50;

    const setupFee = roundPrice(oneTimeCost * margin);
    const monthlyFee = roundPrice(recurringCost * margin);
    const contractValue = setupFee + (monthlyFee * duration);
    
    const profit = contractValue - totalInternalCost;
    const profitMargin = contractValue > 0 ? (profit / contractValue) * 100 : 0;

    return { selected, setupFee, monthlyFee, contractValue, profit, profitMargin };
  }, [services, selectedServiceIds, margin, duration]);

  // --- PDF GENERATION ---
  const generatePDF = () => {
    const doc: any = new jsPDF();
    const { selected, setupFee, monthlyFee, contractValue } = calculations;

    // Header
    doc.setFillColor(20, 20, 20); // Almost black
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("ALGORITMIA", 15, 20);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Growth Partner & Digital Agency", 15, 26);

    doc.setFontSize(30);
    doc.setTextColor(255, 255, 255);
    doc.text("PROPUESTA", 195, 25, { align: "right" });

    // Client Info
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("PREPARADO PARA:", 15, 55);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(14);
    doc.text(clientName || "Cliente Potencial", 15, 62);
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("OBJETIVO:", 15, 75);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(objective || "Escalar facturación y optimizar procesos digitales.", 15, 82);

    // Services Table
    const tableData = selected.map(s => [
      s.name,
      s.type === ServiceType.ONE_TIME ? "Implementación (Único)" : "Recurrente (Mensual)",
      s.description || "Servicio profesional estándar"
    ]);

    doc.autoTable({
      startY: 95,
      head: [['Servicio', 'Modalidad', 'Alcance']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [30, 30, 30], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 10, cellPadding: 5 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60 }, 1: { cellWidth: 40 } }
    });

    // Investment Summary
    const finalY = doc.lastAutoTable.finalY + 15;
    
    // Background for summary
    doc.setFillColor(245, 245, 245);
    doc.rect(15, finalY, 180, 50, 'F');
    doc.setDrawColor(200, 200, 200);
    doc.rect(15, finalY, 180, 50, 'S');

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("INVERSIÓN REQUERIDA", 25, finalY + 12);

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text("Setup Inicial:", 25, finalY + 25);
    doc.text("Fee Mensual:", 25, finalY + 35);
    doc.text("Contrato:", 110, finalY + 35);

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`$${setupFee.toLocaleString()} USD`, 65, finalY + 25);
    doc.text(`$${monthlyFee.toLocaleString()} USD`, 65, finalY + 35);
    doc.text(`${duration} Meses`, 140, finalY + 35);

    // Total Value Highlight
    doc.setFontSize(16);
    doc.setTextColor(34, 197, 94); // Green
    doc.text(`VALOR TOTAL: $${contractValue.toLocaleString()} USD`, 100, finalY + 25);

    // Footer
    doc.setTextColor(150, 150, 150);
    doc.setFontSize(9);
    doc.text("Algoritmia © 2026. Esta propuesta tiene una validez de 15 días.", 105, 280, { align: "center" });

    doc.save(`Propuesta_Algoritmia_${clientName.replace(/\s+/g, '_')}.pdf`);
  };

  const generatePrompt = () => {
    const { selected, setupFee, monthlyFee, contractValue } = calculations;
    
    const phases = selected.reduce((acc, s) => {
      const key = s.type === ServiceType.ONE_TIME ? 'Fase 1: Infraestructura & Setup' : 'Fase 2: Growth & Gestión Recurrente';
      if (!acc[key]) acc[key] = [];
      acc[key].push(`- ${s.name}: ${s.description || 'Implementación estándar'}`);
      return acc;
    }, {} as Record<string, string[]>);

    const prompt = `
Actúa como un Estratega de Agencia Senior. Escribe una propuesta comercial "High-Ticket" para un cliente llamado "${clientName}".

**Contexto del Cliente:**
- Nombre: ${clientName}
- Objetivo Principal (Punto B): "${objective}"
- Duración del Contrato: ${duration} Meses

**Hoja de Ruta Estratégica (Roadmap):**
${Object.entries(phases).map(([phase, items]: [string, string[]]) => `\n${phase}\n${items.join('\n')}`).join('\n')}

**Inversión Requerida:**
- Inversión Inicial (Setup): $${setupFee.toLocaleString()} (Pago Único)
- Fee Mensual (Retainer): $${monthlyFee.toLocaleString()} / mes
- Valor Total del Contrato: $${contractValue.toLocaleString()}

**Instrucciones para la IA:**
1. Escribe un Resumen Ejecutivo persuasivo enfocándote en el ROI de lograr "${objective}".
2. Detalla el "Alcance del Trabajo" usando la hoja de ruta de arriba, haz que suene premium y orientado a resultados.
3. Presenta la inversión de forma clara y directa.
4. Mantén un tono profesional, seguro y directo (Estilo Alex Hormozi - valor primero, sin rodeos).
    `.trim();

    setGeneratedPrompt(prompt);
    setShowPrompt(true);
  };

  const saveProposal = async () => {
    if (!clientName || selectedServiceIds.length === 0) {
      alert("Por favor ingresa un nombre de cliente y selecciona al menos un servicio.");
      return;
    }

    setIsSaving(true);
    const { setupFee, monthlyFee, contractValue, selected } = calculations;

    try {
      await db.proposals.create({
        status: ProposalStatus.DRAFT,
        objective,
        durationMonths: duration,
        marginMultiplier: margin,
        totalOneTimePrice: setupFee,
        totalRecurringPrice: monthlyFee,
        totalContractValue: contractValue,
        aiPromptGenerated: generatedPrompt,
        items: selected.map(s => ({
          id: '', 
          serviceId: s.id,
          serviceSnapshotName: s.name,
          serviceSnapshotCost: s.baseCost
        }))
      }, clientName);
      
      alert("¡Propuesta Guardada con Éxito!");
    } catch (error) {
      console.error(error);
      alert("Error al guardar la propuesta.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <div className="flex h-screen items-center justify-center text-gray-400"><Loader2 className="animate-spin w-8 h-8 mr-2" /> Cargando Sistema...</div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in duration-500 pb-20">
      
      {/* LEFT COLUMN: INPUTS */}
      <div className="lg:col-span-7 space-y-8">
        
        {/* Client Info */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2"><Check className="w-5 h-5 text-green-600" /> Configuración del Deal</h2>
          <Card>
            <CardContent className="space-y-6 pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <Label>Cliente / Lead</Label>
                  <Input 
                    placeholder="Ej: Inmobiliaria Horizonte" 
                    value={clientName} 
                    onChange={e => setClientName(e.target.value)} 
                  />
                </div>
                <div>
                  <Label>Objetivo Principal (Punto B)</Label>
                  <Input 
                    placeholder="Ej: Vender 5 deptos al mes" 
                    value={objective} 
                    onChange={e => setObjective(e.target.value)} 
                  />
                </div>
              </div>
              
              <div className="bg-gray-50/50 p-5 rounded-xl space-y-6 border border-gray-100">
                <Slider 
                  label="Duración del Contrato" 
                  value={duration} 
                  min={1} 
                  max={24} 
                  suffix="Meses"
                  onChange={e => setDuration(parseInt(e.target.value))} 
                />
                <Slider 
                  label="Multiplicador de Margen (Rentabilidad)" 
                  value={margin} 
                  min={1.0} 
                  max={5.0}
                  step={0.1} 
                  suffix="x"
                  onChange={e => setMargin(parseFloat(e.target.value))} 
                />
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Services Selector */}
        <section className="space-y-4">
          <div className="flex justify-between items-center">
             <h2 className="text-xl font-bold flex items-center gap-2"><Layers className="w-5 h-5 text-blue-600" /> Stack de Servicios</h2>
             <Badge>{selectedServiceIds.length} seleccionados</Badge>
          </div>
          
          <div className="space-y-6">
            {Object.entries(servicesByCategory).map(([category, items]: [string, Service[]]) => (
              <div key={category}>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 ml-1">{category}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {items.map(service => {
                    const isSelected = selectedServiceIds.includes(service.id);
                    return (
                      <div 
                        key={service.id}
                        onClick={() => toggleService(service.id)}
                        className={`cursor-pointer border rounded-xl p-4 transition-all duration-200 shadow-sm hover:shadow-md ${
                          isSelected 
                            ? 'bg-gray-900 border-gray-900 text-white ring-2 ring-gray-900 ring-offset-2' 
                            : 'bg-white border-gray-100 hover:border-gray-300 text-gray-900'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <span className="font-semibold text-sm leading-tight pr-2">{service.name}</span>
                          {isSelected && <Check className="w-4 h-4 text-green-400 flex-shrink-0" />}
                        </div>
                        <div className={`text-xs mt-2 flex justify-between items-center ${isSelected ? 'text-gray-400' : 'text-gray-500'}`}>
                          <span>{service.type === ServiceType.ONE_TIME ? 'Único' : 'Mensual'}</span>
                          <span className="font-mono opacity-60">${service.baseCost}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* RIGHT COLUMN: OUTPUTS (Sticky) */}
      <div className="lg:col-span-5">
        <div className="sticky top-6 space-y-6">
          
          <Card className="border-gray-200 shadow-xl shadow-gray-200/50">
            <CardHeader className="bg-gray-50/80 backdrop-blur-sm border-b border-gray-100">
              <CardTitle className="flex items-center gap-2">
                <Calculator className="w-5 h-5" /> Estructura de Precios
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              
              {/* Customer Facing Price */}
              <div className="space-y-4">
                <div className="flex justify-between items-end pb-3 border-b border-dashed border-gray-200">
                  <span className="text-gray-500 font-medium">Setup Inicial</span>
                  <div className="text-right">
                    <span className="text-2xl font-bold tracking-tight">${calculations.setupFee.toLocaleString()}</span>
                    <span className="text-xs text-gray-400 block">Pago único</span>
                  </div>
                </div>
                <div className="flex justify-between items-end pb-3 border-b border-dashed border-gray-200">
                  <span className="text-gray-500 font-medium">Fee Mensual</span>
                  <div className="text-right">
                    <span className="text-2xl font-bold tracking-tight">${calculations.monthlyFee.toLocaleString()}</span>
                    <span className="text-xs text-gray-400 block">Recurrente</span>
                  </div>
                </div>
                <div className="flex justify-between items-center pt-2 bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <span className="font-bold text-gray-900 text-sm uppercase tracking-wide">Valor Total (LTV)</span>
                  <span className="text-3xl font-black tracking-tight text-gray-900">${calculations.contractValue.toLocaleString()}</span>
                </div>
              </div>

              {/* Internal Profit (Green) */}
              <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100/50 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-2 opacity-10">
                   <TrendingUp className="w-24 h-24 text-emerald-900" />
                </div>
                <div className="flex items-center gap-2 mb-1 text-emerald-800 font-bold text-xs uppercase tracking-wider relative z-10">
                  Beneficio Neto Interno
                </div>
                <div className="flex justify-between items-end relative z-10">
                  <Badge variant="green" className="bg-emerald-100/80">{calculations.profitMargin.toFixed(0)}% Margen</Badge>
                  <span className="text-2xl font-bold text-emerald-700 tracking-tight">${calculations.profit.toLocaleString()}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <Button 
                  onClick={generatePrompt}
                  variant="outline" 
                  className="w-full bg-white"
                  disabled={selectedServiceIds.length === 0}
                >
                  <Wand2 className="w-4 h-4 mr-2 text-purple-600" /> Crear Copy
                </Button>
                <Button 
                   onClick={generatePDF}
                   variant="outline"
                   className="w-full bg-white"
                   disabled={selectedServiceIds.length === 0}
                >
                   <FileDown className="w-4 h-4 mr-2" /> PDF
                </Button>
                <Button 
                  onClick={saveProposal}
                  className="w-full col-span-2 py-6 text-lg shadow-lg shadow-black/10"
                  disabled={isSaving || selectedServiceIds.length === 0}
                >
                  {isSaving ? <Loader2 className="animate-spin" /> : <><Save className="w-5 h-5 mr-2" /> Guardar en CRM</>}
                </Button>
              </div>

            </CardContent>
          </Card>

          {/* AI Prompt Result Area */}
          {showPrompt && (
            <div className="animate-in slide-in-from-bottom-4 duration-500">
              <Card className="bg-gray-900 text-white border-gray-800">
                <CardHeader className="flex flex-row items-center justify-between py-3 border-gray-800">
                  <span className="font-semibold text-sm flex items-center gap-2"><Wand2 className="w-4 h-4 text-purple-400"/> Prompt Generado</span>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="text-white hover:bg-white/10 hover:text-white"
                    onClick={() => navigator.clipboard.writeText(generatedPrompt)}
                  >
                    <Copy className="w-3 h-3 mr-1" /> Copiar
                  </Button>
                </CardHeader>
                <div className="p-0">
                  <Textarea 
                    className="min-h-[200px] border-0 focus:ring-0 rounded-b-xl rounded-t-none resize-none bg-gray-900 text-gray-300 text-xs font-mono p-4"
                    readOnly 
                    value={generatedPrompt} 
                  />
                </div>
              </Card>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}