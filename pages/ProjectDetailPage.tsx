
import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../services/db';
import { ai } from '../services/ai';
import { Project, ProjectStatus, Contractor, ClientNote, Task, TaskStatus, Deliverable, PortalMessage } from '../types';
import { Badge, Button, Input, Label, Textarea, Card, Slider, Modal } from '../components/UIComponents';
import { 
  ArrowLeft, Mic2, ListTodo, Plus, Trash2, ExternalLink, Copy, 
  Sparkles, Globe, Loader2, Save,
  CheckCircle2, User, Wallet, Palette, FileText, UploadCloud, MessageSquare, Send, BarChart3,
  Phone, Briefcase, TrendingUp, Clock, MapPin, Building
} from 'lucide-react';
import jsPDF from 'jspdf';

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Tabs
  const [activeTab, setActiveTab] = useState<'PROFILE' | 'ACTION_PLAN' | 'HISTORY'>('PROFILE');

  const [clientNotes, setClientNotes] = useState<ClientNote[]>([]);
  const [clientTasks, setClientTasks] = useState<Task[]>([]);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [portalMessages, setPortalMessages] = useState<PortalMessage[]>([]);
  
  const [meetingNotes, setMeetingNotes] = useState('');
  const [isProcessingMeeting, setIsProcessingMeeting] = useState(false);
  const [isGeneratingGrowth, setIsGeneratingGrowth] = useState(false);

  // Deliverable Form
  const [isDelivModalOpen, setIsDelivModalOpen] = useState(false);
  const [delivForm, setDelivForm] = useState({ name: '', url: '' });

  // Chat Input
  const [chatInput, setChatInput] = useState('');
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState<Partial<Project>>({});

  const BRAND_COLORS_PRESETS = [
      ['#000000', '#FFFFFF', '#333333'], 
      ['#1E3A8A', '#3B82F6', '#93C5FD'], 
      ['#064E3B', '#10B981', '#6EE7B7'], 
      ['#7C2D12', '#F59E0B', '#FDE68A'], 
      ['#4C1D95', '#8B5CF6', '#C4B5FD'], 
  ];

  useEffect(() => {
      if (id) loadProject().catch(err => console.error("Failed to load project:", err));
  }, [id]);

  useEffect(() => {
      if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [portalMessages, activeTab]);

  const loadProject = async () => {
      if (!id) return;
      setLoading(true);
      const [proj, conts, notes, tasks, delivs, msgs] = await Promise.all([
          db.projects.getAll().then(res => res.find(p => p.id === id)),
          db.contractors.getAll(),
          db.clientNotes.getByClient(id),
          db.tasks.getAll().then(res => res.filter(t => t.projectId === id)),
          db.portal.getDeliverables(id),
          db.portal.getMessages(id)
      ]);
      
      if (proj) {
          setProject(proj);
          setFormData(proj); 
      }
      setContractors(conts);
      setClientNotes(notes);
      setClientTasks(tasks);
      setDeliverables(delivs);
      setPortalMessages(msgs);
      setLoading(false);
  };

  const handleSave = async () => {
      if (!id || !formData) return;
      await db.projects.update(id, formData);
      loadProject();
      alert("Guardado correctamente.");
  };

  const handleAddDeliverable = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!delivForm.name || !id) return;
      await db.portal.createDeliverable({
          projectId: id,
          name: delivForm.name,
          url: delivForm.url,
      });
      setIsDelivModalOpen(false);
      setDelivForm({ name: '', url: '' });
      const delivs = await db.portal.getDeliverables(id);
      setDeliverables(delivs);
  };

  const handleDeleteDeliverable = async (delivId: string) => {
      if(confirm('¿Borrar entregable?')) {
          await db.portal.deleteDeliverable(delivId);
          if (id) {
              const delivs = await db.portal.getDeliverables(id);
              setDeliverables(delivs);
          }
      }
  };

  const handleSendPortalMessage = async () => {
      if (!chatInput.trim() || !id) return;
      await db.portal.sendMessage({
          projectId: id,
          sender: 'AGENCY',
          content: chatInput
      });
      setChatInput('');
      const msgs = await db.portal.getMessages(id);
      setPortalMessages(msgs);
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

  const handleQuickAction = async (type: 'CALL' | 'INFO' | 'MEETING') => {
      if (!id) return;
      const contentMap = {
          'CALL': '📞 Hablé con el cliente recientemente.',
          'INFO': '📩 Envié información relevante al cliente.',
          'MEETING': '🤝 Tuvimos una reunión de seguimiento.'
      };
      await db.clientNotes.create({ 
          clientId: id, 
          type: type as any, 
          content: contentMap[type] 
      });
      loadProject();
  };

  const handleAddProgress = async () => {
      const text = prompt("Describe el avance (ej: 'Vendió 10 puertas esta semana'):");
      if (!text || !id) return;
      await db.clientNotes.create({ clientId: id, type: 'PROGRESS', content: text });
      loadProject();
  };

  const applyColorPreset = (colors: string[]) => {
      setFormData({...formData, brandColors: colors});
  };

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
                    { id: 'PROFILE', label: 'Perfil', icon: User },
                    { id: 'ACTION_PLAN', label: 'Plan de Acción', icon: TrendingUp },
                    { id: 'HISTORY', label: 'Historial', icon: ListTodo },
                ].map(tab => {
                    const Icon = tab.icon;
                    return (
                        <button 
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`
                                flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all
                                ${activeTab === tab.id 
                                    ? 'bg-black dark:bg-white text-white dark:text-black shadow-lg shadow-black/10 dark:shadow-white/10' 
                                    : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800'
                                }
                            `}
                        >
                            <Icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Content Area */}
            <div className="grid grid-cols-1 gap-6">
                
                {/* PROFILE TAB */}
                {activeTab === 'PROFILE' && (
                    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in">
                        
                        {/* 1. HERO / IDENTITY */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="md:col-span-2">
                                <Card className="h-full p-8 border-none shadow-xl bg-gradient-to-br from-white to-gray-50 dark:from-slate-900 dark:to-slate-800/50 rounded-3xl relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-32 bg-blue-500/5 dark:bg-blue-400/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                                    <div className="relative z-10 space-y-6">
                                        <div>
                                            <Label className="uppercase text-xs font-bold text-gray-400 tracking-wider">Cliente / Proyecto</Label>
                                            <Input 
                                                className="text-3xl md:text-4xl font-black bg-transparent border-none shadow-none p-0 h-auto focus-visible:ring-0 mt-2 text-gray-900 dark:text-white placeholder:text-gray-200" 
                                                value={formData.name} 
                                                onChange={e => setFormData({...formData, name: e.target.value})} 
                                                placeholder="Nombre del Cliente" 
                                            />
                                        </div>
                                        <div>
                                            <Label className="uppercase text-xs font-bold text-gray-400 tracking-wider">Industria</Label>
                                            <div className="flex items-center gap-2 mt-2">
                                                <Building className="w-5 h-5 text-gray-400"/>
                                                <Input 
                                                    className="font-medium text-lg bg-transparent border-none shadow-none p-0 h-auto focus-visible:ring-0 text-gray-600 dark:text-gray-300"
                                                    value={formData.industry || ''} 
                                                    onChange={e => setFormData({...formData, industry: e.target.value})} 
                                                    placeholder="Ej: Real Estate, Salud..." 
                                                />
                                            </div>
                                        </div>
                                        <div>
                                             <Label className="uppercase text-xs font-bold text-gray-400 tracking-wider">Ubicación</Label>
                                             <div className="flex items-center gap-2 mt-2">
                                                <MapPin className="w-5 h-5 text-gray-400"/>
                                                <Input 
                                                    className="font-medium text-lg bg-transparent border-none shadow-none p-0 h-auto focus-visible:ring-0 text-gray-600 dark:text-gray-300"
                                                    value={formData.location || ''} 
                                                    onChange={e => setFormData({...formData, location: e.target.value})} 
                                                    placeholder="Ciudad, País" 
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            </div>

                            {/* 2. SERVICE AGREEMENT CARD (PREMIUM) */}
                            <div className="md:col-span-1">
                                <Card className="h-full p-6 border-none shadow-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white rounded-3xl relative overflow-hidden flex flex-col justify-between">
                                    <div className="absolute top-0 right-0 p-24 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
                                    
                                    <div className="relative z-10 space-y-1">
                                        <div className="flex justify-between items-start">
                                            <Wallet className="w-8 h-8 text-white/80 mb-4 bg-white/10 p-1.5 rounded-lg"/>
                                            <div className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold border border-white/10">ACTIVE</div>
                                        </div>
                                        <Label className="text-indigo-200 uppercase text-xs font-bold tracking-wider">Acuerdo de Servicio</Label>
                                        <Textarea 
                                            className="bg-transparent border-none text-white placeholder:text-white/40 font-bold text-xl p-0 resize-none focus-visible:ring-0 min-h-[60px]"
                                            value={formData.serviceDetails || ''} 
                                            onChange={e => setFormData({...formData, serviceDetails: e.target.value})} 
                                            placeholder="Detalle (ej: Gestión Redes)" 
                                        />
                                    </div>

                                    <div className="relative z-10 pt-6 mt-4 border-t border-white/20">
                                        <div className="flex justify-between items-end">
                                            <div>
                                                <Label className="text-indigo-200 text-xs font-medium block">Inversión Mensual</Label>
                                                <div className="flex items-center">
                                                    <span className="text-2xl font-medium text-indigo-300 mr-1">$</span>
                                                    <Input 
                                                        className="bg-transparent border-none text-white placeholder:text-white/40 font-black text-4xl p-0 w-32 focus-visible:ring-0"
                                                        value={formData.monthlyRevenue} 
                                                        onChange={e => setFormData({...formData, monthlyRevenue: parseFloat(e.target.value)})} 
                                                        type="number"
                                                    />
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <Label className="text-indigo-200 text-xs font-medium block mb-1">Día de Cobro</Label>
                                                <div className="bg-white/20 backdrop-blur-md rounded-xl px-3 py-2 flex flex-col items-center min-w-[60px] border border-white/10">
                                                     <Input 
                                                        className="bg-transparent border-none text-white font-bold text-xl p-0 w-full text-center h-auto focus-visible:ring-0"
                                                        value={formData.billingDay || 1} 
                                                        onChange={e => setFormData({...formData, billingDay: parseInt(e.target.value)})} 
                                                        type="number" max={31} min={1}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            </div>
                        </div>

                        {/* 2.5 PROFITABILITY ANALYSIS (RESTORED) */}
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Card className="p-6 border-none shadow-md bg-white dark:bg-slate-900 rounded-2xl relative overflow-hidden">
                                <h3 className="font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2"><BarChart3 className="w-5 h-5 text-emerald-500"/> Análisis de Rentabilidad</h3>
                                
                                <div className="space-y-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <Label className="text-xs text-gray-400 mb-1">Costo Equipo / Fijo</Label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-2.5 text-gray-400 font-bold">$</span>
                                                <Input 
                                                    type="number" 
                                                    className="pl-6 font-mono bg-gray-50 dark:bg-slate-800 border-none" 
                                                    value={formData.internalCost || 0} 
                                                    onChange={e => setFormData({...formData, internalCost: parseFloat(e.target.value)})} 
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <Label className="text-xs text-gray-400 mb-1">Outsourcing / Ads</Label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-2.5 text-gray-400 font-bold">$</span>
                                                <Input 
                                                    type="number" 
                                                    className="pl-6 font-mono bg-gray-50 dark:bg-slate-800 border-none" 
                                                    value={formData.outsourcingCost || 0} 
                                                    onChange={e => setFormData({...formData, outsourcingCost: parseFloat(e.target.value)})} 
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-gray-50 dark:bg-slate-800 rounded-xl p-4 flex items-center justify-between">
                                        <div>
                                            <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Margen Neto</p>
                                            <p className={`text-3xl font-black ${
                                                ((formData.monthlyRevenue || 0) - (formData.internalCost || 0) - (formData.outsourcingCost || 0)) > 0 ? 'text-emerald-500' : 'text-red-500'
                                            }`}>
                                                $ {((formData.monthlyRevenue || 0) - (formData.internalCost || 0) - (formData.outsourcingCost || 0)).toLocaleString()}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <div className="w-16 h-16 rounded-full border-4 border-gray-200 dark:border-slate-700 flex items-center justify-center relative">
                                                <span className="font-bold text-sm">
                                                    {formData.monthlyRevenue ? Math.round((((formData.monthlyRevenue || 0) - (formData.internalCost || 0) - (formData.outsourcingCost || 0)) / formData.monthlyRevenue) * 100) : 0}%
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                         </div>


                        {/* 3. CONTEXT & STRATEGY */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Card className="p-6 border-none shadow-md bg-white dark:bg-slate-900 rounded-2xl">
                                <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2"><Briefcase className="w-5 h-5 text-blue-500"/> Contexto & Estrategia</h3>
                                <div className="space-y-4">
                                     <Textarea 
                                        className="bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-4 min-h-[150px] focus-visible:ring-1 focus-visible:ring-blue-500" 
                                        placeholder="Describe la situación actual del cliente, objetivos clave, y contexto importante..." 
                                        value={formData.notes} 
                                        onChange={e => setFormData({...formData, notes: e.target.value})} 
                                    />
                                    <div className="flex items-center gap-2 text-sm text-gray-500">
                                        <Clock className="w-4 h-4"/>
                                        <span>Última actualización: {new Date().toLocaleDateString()}</span>
                                    </div>
                                </div>
                            </Card>

                            <div className="space-y-6">
                                {/* CONTACT */}
                                <Card className="p-6 border-none shadow-md bg-white dark:bg-slate-900 rounded-2xl">
                                    <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2"><Phone className="w-5 h-5 text-green-500"/> Contacto Directo</h3>
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-800 rounded-xl">
                                            <div className="w-10 h-10 rounded-full bg-green-100 text-green-600 flex items-center justify-center shrink-0">
                                                <Phone className="w-5 h-5"/>
                                            </div>
                                            <Input 
                                                className="bg-transparent border-none shadow-none font-medium"
                                                value={formData.phone || ''} 
                                                onChange={e => setFormData({...formData, phone: e.target.value})} 
                                                placeholder="+54 9 11 1234 5678" 
                                            />
                                        </div>
                                        <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-800 rounded-xl">
                                             <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                                                <User className="w-5 h-5"/>
                                            </div>
                                            <Input 
                                                className="bg-transparent border-none shadow-none font-medium"
                                                value={formData.email || ''} 
                                                // Assuming email is editable in formData or we rely on contact list
                                                 onChange={e => setFormData({...formData, email: e.target.value})} 
                                                placeholder="contacto@empresa.com" 
                                            />
                                        </div>
                                    </div>
                                </Card>

                                {/* BRAND KIT */}
                                 <Card className="p-6 border-none shadow-md bg-white dark:bg-slate-900 rounded-2xl relative overflow-hidden">
                                     <div className="absolute top-0 right-0 w-20 h-20 bg-purple-500/10 rounded-full -mr-10 -mt-10"></div>
                                    <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2 relative z-10"><Palette className="w-5 h-5 text-purple-500"/> Identidad Visual</h3>
                                    <div className="flex gap-3 relative z-10">
                                        {(formData.brandColors || ['#000000', '#ffffff']).slice(0, 5).map((color, i) => (
                                            <div key={i} className="group relative">
                                                <div 
                                                    className="w-12 h-12 rounded-full shadow-sm border border-black/5 dark:border-white/10 cursor-pointer transition-transform hover:scale-110"
                                                    style={{backgroundColor: color}}
                                                    onClick={() => {
                                                        const newColor = prompt("Nuevo color HEX:", color);
                                                        if(newColor) {
                                                            const newColors = [...(formData.brandColors || [])];
                                                            newColors[i] = newColor;
                                                            setFormData({...formData, brandColors: newColors});
                                                        }
                                                    }}
                                                ></div>
                                            </div>
                                        ))}
                                        <button 
                                            className="w-12 h-12 rounded-full border-2 border-dashed border-gray-300 dark:border-slate-700 flex items-center justify-center text-gray-400 hover:border-blue-500 hover:text-blue-500 transition-colors"
                                            onClick={() => {
                                                const newColor = prompt("Nuevo color HEX:", "#000000");
                                                if(newColor) setFormData({...formData, brandColors: [...(formData.brandColors || []), newColor]});
                                            }}
                                        >
                                            <Plus className="w-4 h-4"/>
                                        </button>
                                    </div>
                                </Card>
                            </div>
                        </div>

                        {/* RESOURCES SECTION */}
                        <Card className="p-6 space-y-4 h-full border-none shadow-md bg-white dark:bg-slate-900 rounded-2xl">
                             <div className="flex justify-between items-center border-b border-gray-100 dark:border-slate-800 pb-2">
                                <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2"><ExternalLink className="w-4 h-4"/> Recursos (The Vault)</h3>
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
                )}

                {/* REMOVED TABS: ENTREGAS, PORTAL, FINANCE, MEETINGS */}

                {/* ACTION PLAN TAB */}
                {activeTab === 'ACTION_PLAN' && (
                    <div className="max-w-3xl mx-auto animate-in fade-in space-y-6">
                         <div className="flex justify-between items-center mb-6">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Evolución & Progreso</h2>
                                <p className="text-sm text-gray-500">Bitácora de crecimiento y resultados.</p>
                            </div>
                            <Button onClick={handleAddProgress} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white"><Plus className="w-4 h-4 mr-2"/> Registrar Avance</Button>
                        </div>

                        <div className="relative border-l-2 border-blue-200 dark:border-blue-900 ml-4 space-y-8 pl-8 py-2">
                            {clientNotes.filter(n => n.type === 'PROGRESS').length === 0 && <div className="text-gray-400 italic">No hay registros de progreso aún.</div>}
                            
                            {clientNotes.filter(n => n.type === 'PROGRESS').map((note, idx) => (
                                <div key={idx} className="relative group">
                                     <div className="absolute -left-[41px] w-5 h-5 rounded-full border-4 border-white dark:border-slate-900 shadow-sm bg-blue-500"></div>
                                     <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
                                        <div className="flex justify-between items-start mb-2">
                                            <Badge variant="blue">Progreso</Badge>
                                            <span className="text-xs text-gray-400 font-mono">{new Date(note.createdAt).toLocaleDateString()}</span>
                                        </div>
                                        <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-medium">{note.content}</p>
                                     </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* HISTORY TAB */}
                {activeTab === 'HISTORY' && (
                    <div className="max-w-4xl mx-auto animate-in fade-in">
                        {/* Quick Actions */}
                         <div className="flex gap-2 mb-6 justify-center">
                            <button onClick={() => handleQuickAction('CALL')} className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-300 rounded-full text-sm font-bold hover:bg-indigo-100 transition-colors"><Phone className="w-4 h-4"/> Hablé Hoy</button>
                            <button onClick={() => handleQuickAction('INFO')} className="flex items-center gap-2 px-4 py-2 bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600 dark:text-cyan-300 rounded-full text-sm font-bold hover:bg-cyan-100 transition-colors"><Send className="w-4 h-4"/> Envié Info</button>
                            <button onClick={() => handleQuickAction('MEETING')} className="flex items-center gap-2 px-4 py-2 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-300 rounded-full text-sm font-bold hover:bg-purple-100 transition-colors"><Mic2 className="w-4 h-4"/> Reunión</button>
                        </div>
                        
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