
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../services/db';
import { ai } from '../services/ai';
import { Project, ProjectStatus, Contractor, ClientNote, Task, TaskStatus } from '../types';
import { Badge, Button, Input, Label, Textarea, Card, Slider } from '../components/UIComponents';
import { 
  ArrowLeft, Mic2, ListTodo, Plus, Trash2, ExternalLink, Copy, 
  Sparkles, Globe, Loader2, Save,
  CheckCircle2, User, Wallet, Palette, FileText
} from 'lucide-react';
import jsPDF from 'jspdf';

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Tabs
  const [activeTab, setActiveTab] = useState<'PROFILE' | 'MEETINGS' | 'FINANCE' | 'PORTAL' | 'GROWTH' | 'HISTORY'>('PROFILE');

  const [clientNotes, setClientNotes] = useState<ClientNote[]>([]);
  const [clientTasks, setClientTasks] = useState<Task[]>([]);
  
  const [meetingNotes, setMeetingNotes] = useState('');
  const [isProcessingMeeting, setIsProcessingMeeting] = useState(false);
  const [isGeneratingGrowth, setIsGeneratingGrowth] = useState(false);

  const [formData, setFormData] = useState<Partial<Project>>({});

  const BRAND_COLORS_PRESETS = [
      ['#000000', '#FFFFFF', '#333333'], 
      ['#1E3A8A', '#3B82F6', '#93C5FD'], 
      ['#064E3B', '#10B981', '#6EE7B7'], 
      ['#7C2D12', '#F59E0B', '#FDE68A'], 
      ['#4C1D95', '#8B5CF6', '#C4B5FD'], 
  ];

  useEffect(() => {
      if (id) loadProject();
  }, [id]);

  const loadProject = async () => {
      if (!id) return;
      setLoading(true);
      const [proj, conts, notes, tasks] = await Promise.all([
          db.projects.getAll().then(res => res.find(p => p.id === id)),
          db.contractors.getAll(),
          db.clientNotes.getByClient(id),
          db.tasks.getAll().then(res => res.filter(t => t.projectId === id))
      ]);
      
      if (proj) {
          setProject(proj);
          setFormData(proj); 
      }
      setContractors(conts);
      setClientNotes(notes);
      setClientTasks(tasks);
      setLoading(false);
  };

  const handleSave = async () => {
      if (!id || !formData) return;
      await db.projects.update(id, formData);
      loadProject();
      alert("Guardado correctamente.");
  };

  const processMeetingNotes = async () => {
      if (!meetingNotes.trim() || !id) return;
      setIsProcessingMeeting(true);
      try {
          const prompt = `Analiza estas notas de reunión para el cliente "${project?.name}". Genera un resumen y tareas. JSON: { "summary": "...", "tasks": [ { "title": "...", "priority": "HIGH"|"MEDIUM"|"LOW" } ] } Notes: "${meetingNotes}"`;
          const response = await ai.chat([{ role: 'user', content: prompt }]);
          const cleanJson = response.replace(/```json/g, '').replace(/```/g, '').trim();
          const data = JSON.parse(cleanJson);

          await db.clientNotes.create({ clientId: id, type: 'MEETING', content: `📝 RESUMEN:\n${data.summary}` });
          for (const t of data.tasks) {
              await db.tasks.create({ projectId: id, title: t.title, priority: t.priority, status: TaskStatus.TODO });
          }
          setMeetingNotes('');
          loadProject(); 
          setActiveTab('HISTORY');
      } catch (e) { console.error(e); alert("Error procesando IA."); } finally { setIsProcessingMeeting(false); }
  };

  const generateGrowthStrategy = async () => {
      setIsGeneratingGrowth(true);
      try {
          const prompt = `Actúa como Director de Estrategia. Crea un Roadmap de Crecimiento Trimestral para "${formData.name}" (Rubro: ${formData.industry}). 
          Objetivo: Aumentar facturación.
          Formato:
          - Mes 1: Quick Wins (2 items)
          - Mes 2: Optimización (2 items)
          - Mes 3: Escala (2 items)
          Sé breve y conciso.`;
          const res = await ai.chat([{ role: 'user', content: prompt }]);
          setFormData({...formData, growthStrategy: res});
      } catch(e) { console.error(e); } finally { setIsGeneratingGrowth(false); }
  };

  const generateInvoice = () => {
      const doc: any = new jsPDF();
      doc.setFontSize(20);
      doc.text("INVOICE / FACTURA", 20, 20);
      
      doc.setFontSize(12);
      doc.text(`Cliente: ${formData.name}`, 20, 40);
      doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 20, 50);
      doc.text(`Vencimiento: Día ${formData.billingDay}`, 20, 60);
      
      doc.line(20, 70, 190, 70);
      
      doc.text("Descripción", 20, 80);
      doc.text("Monto", 160, 80);
      
      doc.setFontSize(10);
      doc.text(`Servicios de Agencia - Mensualidad (${new Date().toLocaleDateString('es-ES', { month: 'long' })})`, 20, 90);
      doc.text(`$${formData.monthlyRevenue?.toLocaleString()}`, 160, 90);
      
      doc.line(20, 100, 190, 100);
      doc.setFontSize(14);
      doc.text(`TOTAL: $${formData.monthlyRevenue?.toLocaleString()}`, 140, 115);
      
      doc.save(`Invoice_${formData.name}_${new Date().toISOString().slice(0,7)}.pdf`);
  };

  const applyColorPreset = (colors: string[]) => {
      setFormData({...formData, brandColors: colors});
  };

  const revenue = formData.monthlyRevenue || 0;
  const partnerCost = formData.outsourcingCost || 0;
  const internalCost = formData.internalCost || 0;
  const totalCost = partnerCost + internalCost;
  const profit = revenue - totalCost;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

  if (loading || !project) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-gray-300 w-8 h-8"/></div>;

  return (
    <div className="bg-[#FAFAFA] dark:bg-[#020617] min-h-screen pb-20 animate-in fade-in slide-in-from-bottom-2 duration-500">
        
        {/* Header */}
        <div className="sticky top-0 z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-gray-200 dark:border-slate-800 px-6 py-4 flex justify-between items-center">
            <div className="flex items-center gap-4">
                <button onClick={() => navigate('/projects')} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors"><ArrowLeft className="w-5 h-5 text-gray-500 dark:text-gray-400"/></button>
                <div>
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        {formData.name} 
                        <Badge variant={formData.status === 'ACTIVE' ? 'green' : 'outline'}>{formData.status}</Badge>
                    </h1>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{formData.industry || 'Sin rubro'} • Fee: ${formData.monthlyRevenue?.toLocaleString()}/mes</p>
                </div>
            </div>
            <div className="flex gap-2">
                <Button onClick={handleSave} className="shadow-lg shadow-black/10 dark:shadow-white/5"><Save className="w-4 h-4 mr-2"/> Guardar Cambios</Button>
            </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-8">
            
            {/* Tabs */}
            <div className="flex gap-1 mb-8 overflow-x-auto no-scrollbar pb-1">
                {[
                    { id: 'PROFILE', label: 'Perfil & Recursos', icon: User },
                    { id: 'MEETINGS', label: 'Bitácora IA', icon: Mic2 },
                    { id: 'FINANCE', label: 'Rentabilidad', icon: Wallet },
                    { id: 'GROWTH', label: 'Growth Strategy', icon: Sparkles },
                    { id: 'PORTAL', label: 'Guest Portal', icon: Globe },
                    { id: 'HISTORY', label: 'Historial', icon: ListTodo },
                ].map(tab => {
                    const Icon = tab.icon;
                    return (
                        <button 
                            key={tab.id} 
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all ${activeTab === tab.id ? 'bg-black dark:bg-white text-white dark:text-black shadow-md' : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 border border-gray-100 dark:border-slate-700'}`}
                        >
                            <Icon className="w-4 h-4" /> {tab.label}
                        </button>
                    )
                })}
            </div>

            {/* Content Area */}
            <div className="grid grid-cols-1 gap-6">
                
                {/* PROFILE TAB (Merged with Resources) */}
                {activeTab === 'PROFILE' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in">
                        <div className="space-y-6">
                            <Card className="p-6 space-y-4">
                                <h3 className="font-bold text-gray-900 dark:text-white border-b border-gray-100 dark:border-slate-800 pb-2">Datos Principales</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><Label>Nombre</Label><Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
                                    <div><Label>Rubro</Label><Input value={formData.industry} onChange={e => setFormData({...formData, industry: e.target.value})} /></div>
                                    <div>
                                        <Label>Fee Mensual ($)</Label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-2.5 text-gray-400 font-bold">$</span>
                                            <Input type="number" className="pl-6 font-mono" value={formData.monthlyRevenue} onChange={e => setFormData({...formData, monthlyRevenue: parseFloat(e.target.value)})} />
                                        </div>
                                    </div>
                                    <div><Label>Día de Cobro</Label><Input type="number" value={formData.billingDay} onChange={e => setFormData({...formData, billingDay: parseInt(e.target.value)})} /></div>
                                    <div>
                                        <Label>Estado</Label>
                                        <select className="w-full h-12 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-3 text-sm dark:text-white" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})}>
                                            <option value="ONBOARDING">Onboarding</option><option value="ACTIVE">Activo</option><option value="PAUSED">Pausado</option><option value="COMPLETED">Completado</option>
                                            <optgroup label="Ventas"><option value="LEAD">Lead</option><option value="PROPOSAL">Propuesta</option></optgroup>
                                        </select>
                                    </div>
                                </div>
                            </Card>

                            <Card className="p-6 space-y-4">
                                <h3 className="font-bold text-gray-900 dark:text-white border-b border-gray-100 dark:border-slate-800 pb-2 flex items-center gap-2"><Palette className="w-4 h-4"/> Brand Kit</h3>
                                <div className="space-y-2">
                                    <Label>Colores de Marca</Label>
                                    <div className="flex gap-2 flex-wrap mb-2">
                                        {formData.brandColors?.map((c, i) => (
                                            <div key={i} className="w-10 h-10 rounded-full border shadow-sm cursor-pointer transition-transform hover:scale-110" style={{backgroundColor: c}} title={c} onClick={() => {if(confirm("Borrar color?")){const n=[...formData.brandColors!]; n.splice(i,1); setFormData({...formData, brandColors: n})}}}></div>
                                        ))}
                                        <input type="color" className="w-10 h-10 rounded-full overflow-hidden p-0 border-0 cursor-pointer" onChange={e => setFormData({...formData, brandColors: [...(formData.brandColors||[]), e.target.value]})} />
                                    </div>
                                    <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
                                        {BRAND_COLORS_PRESETS.map((preset, i) => (
                                            <button key={i} onClick={() => applyColorPreset(preset)} className="flex gap-0.5 border p-1 rounded hover:bg-gray-50 dark:hover:bg-slate-800">
                                                {preset.map(c => <div key={c} className="w-3 h-3 rounded-full" style={{backgroundColor: c}}></div>)}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </Card>
                        </div>

                        <div className="space-y-6">
                            <Card className="p-6 space-y-4 h-full">
                                <div className="flex justify-between items-center border-b border-gray-100 dark:border-slate-800 pb-2">
                                    <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2"><ExternalLink className="w-4 h-4"/> The Vault (Recursos)</h3>
                                    <button onClick={() => setFormData({...formData, resources: [...(formData.resources||[]), {id: Date.now().toString(), name: 'Nuevo Link', url: '', type: 'OTHER'}]})} className="text-xs bg-black dark:bg-white text-white dark:text-black px-2 py-1 rounded flex items-center"><Plus className="w-3 h-3 mr-1"/> Agregar</button>
                                </div>
                                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
                                    {formData.resources?.length === 0 && <p className="text-gray-400 text-xs italic">Sin recursos guardados.</p>}
                                    {formData.resources?.map((r, idx) => (
                                        <div key={idx} className="flex items-center gap-2 bg-gray-50 dark:bg-slate-800 p-2 rounded-lg border border-gray-100 dark:border-slate-700 group">
                                            <div className="p-2 bg-white dark:bg-slate-900 rounded shadow-sm"><Globe className="w-4 h-4 text-gray-400"/></div>
                                            <div className="flex-1">
                                                <input className="text-xs font-bold bg-transparent border-none w-full focus:ring-0 p-0 text-gray-900 dark:text-white" value={r.name} onChange={e => {const n=[...formData.resources!]; n[idx].name=e.target.value; setFormData({...formData, resources:n})}} />
                                                <input className="text-[10px] text-blue-500 bg-transparent border-none w-full focus:ring-0 p-0" value={r.url} placeholder="https://..." onChange={e => {const n=[...formData.resources!]; n[idx].url=e.target.value; setFormData({...formData, resources:n})}} />
                                            </div>
                                            <a href={r.url} target="_blank" className="p-1 text-gray-400 hover:text-blue-500"><ExternalLink className="w-3 h-3"/></a>
                                            <button onClick={() => {const n=[...formData.resources!]; n.splice(idx,1); setFormData({...formData, resources:n})}} className="p-1 text-gray-300 hover:text-red-500"><Trash2 className="w-3 h-3"/></button>
                                        </div>
                                    ))}
                                </div>
                            </Card>
                        </div>
                    </div>
                )}

                {/* FINANCE TAB */}
                {activeTab === 'FINANCE' && (
                    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in">
                        <div className="flex justify-end">
                            <Button onClick={generateInvoice} variant="secondary"><FileText className="w-4 h-4 mr-2"/> Generar Factura PDF</Button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Card className="p-6">
                                <h3 className="font-bold mb-4 flex items-center gap-2 text-gray-900 dark:text-white"><Wallet className="w-4 h-4"/> Estructura de Costos (Mensual)</h3>
                                <div className="space-y-4">
                                    <div><Label>Ingreso (Fee Cliente)</Label><Input type="number" className="font-mono font-bold text-green-700" value={formData.monthlyRevenue} onChange={e => setFormData({...formData, monthlyRevenue: parseFloat(e.target.value)})} /></div>
                                    
                                    <div className="pt-2 border-t border-gray-100 dark:border-slate-800">
                                        <Label>Costo Asignado a Socio (Fijo Mensual)</Label>
                                        <div className="flex gap-2">
                                            <select 
                                                className="flex h-12 w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-3 text-sm dark:text-white" 
                                                value={formData.assignedPartnerId || ''} 
                                                onChange={e => {
                                                    const pid = e.target.value;
                                                    const partner = contractors.find(c => c.id === pid);
                                                    setFormData({
                                                        ...formData, 
                                                        assignedPartnerId: pid,
                                                        outsourcingCost: partner ? partner.monthlyRate : (pid === '' ? 0 : formData.outsourcingCost)
                                                    })
                                                }}
                                            >
                                                <option value="">-- Sin Socio (Interno) --</option>
                                                {contractors.map(c => <option key={c.id} value={c.id}>{c.name} {c.monthlyRate > 0 ? `($${c.monthlyRate})` : ''}</option>)}
                                            </select>
                                            <Input type="number" className="w-32 font-mono text-red-600" value={formData.outsourcingCost} onChange={e => setFormData({...formData, outsourcingCost: parseFloat(e.target.value)})} placeholder="$ Pago" />
                                        </div>
                                    </div>

                                    <div>
                                        <Label>Costos Fijos Internos</Label>
                                        <Input type="number" className="font-mono text-red-600" value={formData.internalCost} onChange={e => setFormData({...formData, internalCost: parseFloat(e.target.value)})} placeholder="$0" />
                                    </div>
                                </div>
                            </Card>

                            <div className="space-y-6">
                                <div className={`p-6 rounded-2xl shadow-xl text-white ${profit >= 0 ? 'bg-gray-900 dark:bg-slate-800' : 'bg-red-900'}`}>
                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Ganancia Neta Mensual</p>
                                    <div className="text-4xl font-bold mt-2 tracking-tight">${profit.toLocaleString()}</div>
                                    <div className="flex gap-4 mt-4 text-sm font-medium">
                                        <span className={`${margin > 50 ? 'text-green-400' : margin > 20 ? 'text-yellow-400' : 'text-red-400'}`}>Margen: {margin.toFixed(1)}%</span>
                                        <span className="text-gray-500">|</span>
                                        <span className="text-gray-400">Costos: ${totalCost.toLocaleString()}</span>
                                    </div>
                                </div>

                                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 h-[180px] flex flex-col justify-center">
                                    <Label className="mb-4">Distribución Financiera</Label>
                                    <div className="w-full h-8 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden flex shadow-inner">
                                        <div style={{width: `${(partnerCost/revenue)*100}%`}} className="h-full bg-red-400" title="Socio"></div>
                                        <div style={{width: `${(internalCost/revenue)*100}%`}} className="h-full bg-orange-400" title="Interno"></div>
                                        <div style={{width: `${(profit/revenue)*100}%`}} className="h-full bg-green-500" title="Ganancia"></div>
                                    </div>
                                    <div className="flex justify-between text-[10px] font-bold text-gray-400 mt-2 uppercase tracking-wide">
                                        <span className="text-red-500">Outsourcing</span>
                                        <span className="text-orange-500">Fijos</span>
                                        <span className="text-green-600">Profit</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* GROWTH TAB (New) */}
                {activeTab === 'GROWTH' && (
                    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in">
                        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 p-6 rounded-2xl border border-purple-100 dark:border-purple-800">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="font-bold text-purple-900 dark:text-purple-300 text-lg flex items-center gap-2"><Sparkles className="w-5 h-5"/> Growth Roadmap</h3>
                                    <p className="text-sm text-purple-700 dark:text-purple-400">Estrategia de crecimiento trimestral para el cliente.</p>
                                </div>
                                <Button onClick={generateGrowthStrategy} disabled={isGeneratingGrowth} size="sm" className="bg-purple-600 hover:bg-purple-700 text-white border-transparent">
                                    {isGeneratingGrowth ? <Loader2 className="animate-spin w-4 h-4"/> : "Generar con IA"}
                                </Button>
                            </div>
                            <Textarea 
                                className="min-h-[300px] bg-white/80 dark:bg-slate-900/80 border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-200 font-medium leading-relaxed" 
                                value={formData.growthStrategy} 
                                onChange={e => setFormData({...formData, growthStrategy: e.target.value})}
                                placeholder="1. Quick Wins: ..." 
                            />
                        </div>
                    </div>
                )}

                {/* MEETINGS TAB */}
                {activeTab === 'MEETINGS' && (
                    <div className="max-w-3xl mx-auto animate-in fade-in">
                        <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 p-6 rounded-2xl mb-6">
                            <h3 className="font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-2 mb-2"><Mic2 className="w-5 h-5"/> Asistente de Reuniones</h3>
                            <p className="text-sm text-indigo-700 dark:text-indigo-400 mb-4">Toma notas rápidas. La IA las limpiará y creará las tareas.</p>
                            <Textarea className="bg-white dark:bg-slate-900 min-h-[200px]" placeholder="- Notas..." value={meetingNotes} onChange={e => setMeetingNotes(e.target.value)} />
                            <div className="flex justify-end mt-4"><Button onClick={processMeetingNotes} disabled={isProcessingMeeting}>Procesar Notas</Button></div>
                        </div>
                    </div>
                )}

                {/* PORTAL TAB */}
                {activeTab === 'PORTAL' && (
                    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in text-center">
                        <div className="p-8 bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-800 shadow-sm">
                            <Globe className="w-12 h-12 text-blue-500 mx-auto mb-4" />
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Portal de Cliente</h3>
                            <p className="text-gray-500 dark:text-gray-400 mb-6">Link único para que el cliente vea su estado en tiempo real.</p>
                            
                            {formData.publicToken ? (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 bg-gray-50 dark:bg-slate-800 p-3 rounded-xl border border-gray-200 dark:border-slate-700">
                                        <input readOnly value={`${window.location.origin}/#/portal/${formData.publicToken}`} className="flex-1 text-xs text-gray-600 dark:text-gray-300 bg-transparent outline-none font-mono" />
                                        <button onClick={() => navigator.clipboard.writeText(`${window.location.origin}/#/portal/${formData.publicToken}`)} className="p-2 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg text-gray-500"><Copy className="w-4 h-4"/></button>
                                        <a href={`/#/portal/${formData.publicToken}`} target="_blank" className="p-2 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg text-blue-600"><ExternalLink className="w-4 h-4"/></a>
                                    </div>
                                    <div className="text-left bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-100 dark:border-slate-800">
                                        <Label>Progreso Visible ({formData.progress}%)</Label>
                                        <Slider value={formData.progress || 0} min={0} max={100} onChange={e => setFormData({...formData, progress: parseInt(e.target.value)})} />
                                    </div>
                                </div>
                            ) : (
                                <Button onClick={() => setFormData({...formData, publicToken: Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2)})} className="bg-black text-white">Generar Link Mágico</Button>
                            )}
                        </div>
                    </div>
                )}

                {/* HISTORY TAB */}
                {activeTab === 'HISTORY' && (
                    <div className="max-w-4xl mx-auto animate-in fade-in">
                        <div className="relative border-l-2 border-gray-200 dark:border-slate-800 ml-4 space-y-8 pl-8 py-4">
                            {clientTasks.filter(t => t.status === 'DONE').length === 0 && clientNotes.length === 0 && <p className="text-gray-400 italic">No hay historial aún.</p>}
                            {[...clientNotes.map(n => ({type:'NOTE', data:n, date: n.createdAt})), ...clientTasks.filter(t => t.status === 'DONE').map(t => ({type:'TASK', data:t, date: t.created_at}))]
                                .sort((a,b) => new Date(b.date!).getTime() - new Date(a.date!).getTime())
                                .map((item, idx) => (
                                    <div key={idx} className="relative">
                                        <div className={`absolute -left-[41px] w-5 h-5 rounded-full border-4 border-white dark:border-slate-900 shadow-sm ${item.type === 'TASK' ? 'bg-green-500' : 'bg-blue-500'}`}></div>
                                        <p className="text-xs text-gray-400 font-mono mb-1">{new Date(item.date!).toLocaleString()}</p>
                                        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                                            {item.type === 'TASK' ? (
                                                <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-600"/> <span className="line-through opacity-70">{(item.data as any).title}</span></div>
                                            ) : (item.data as any).content}
                                        </div>
                                    </div>
                                ))
                            }
                        </div>
                    </div>
                )}

            </div>
        </div>
    </div>
  );
}
