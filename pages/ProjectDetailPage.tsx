
import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../services/db';
import { ai } from '../services/ai';
import { Project, ProjectStatus, Contractor, ClientNote, Task, TaskStatus, Deliverable, PortalMessage, Proposal, ProposalItem } from '../types';
import { Badge, Button, Input, Label, Textarea, Card, CardContent, Slider, Modal } from '../components/UIComponents';
import { 
  ArrowLeft, Mic2, ListTodo, Plus, Trash2, ExternalLink, Copy, 
  Sparkles, Globe, Loader2, Save, Layers,
  CheckCircle2, User, Wallet, Palette, FileText, UploadCloud, MessageSquare, Send, BarChart3,
  Phone, Briefcase, TrendingUp, Clock, MapPin, Building
} from 'lucide-react';
import jsPDF from 'jspdf';
import { useToast } from '../components/Toast';
import { ProjectProfileTab } from '../components/tabs/ProjectProfileTab';
import { EditProjectModal } from '../components/modals/EditProjectModal';
import { Edit } from 'lucide-react';

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  // ... rest of imports/state

  const [project, setProject] = useState<Project | null>(null);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Tabs
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'PROFILE' | 'ACTION_PLAN' | 'HISTORY'>('OVERVIEW');

  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [activeItems, setActiveItems] = useState<ProposalItem[]>([]);

  const [clientNotes, setClientNotes] = useState<ClientNote[]>([]);
  const [clientTasks, setClientTasks] = useState<Task[]>([]);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [portalMessages, setPortalMessages] = useState<PortalMessage[]>([]);
  
  const [meetingNotes, setMeetingNotes] = useState('');
  const [isProcessingMeeting, setIsProcessingMeeting] = useState(false);
  const [isGeneratingGrowth, setIsGeneratingGrowth] = useState(false);

  // Estados para UX mejorada (Paso 3)
  const [isProgressModalOpen, setIsProgressModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [newProgressNote, setNewProgressNote] = useState('');

  // Deliverable Form
  const [isDelivModalOpen, setIsDelivModalOpen] = useState(false);
  const [delivForm, setDelivForm] = useState({ name: '', url: '' });

  // Chat Input
  const [chatInput, setChatInput] = useState('');
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState<Partial<Project>>({});



  useEffect(() => {
      if (id) loadProject().catch(err => console.error("Failed to load project:", err));
  }, [id]);

  useEffect(() => {
      if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [portalMessages, activeTab]);

  const loadProject = async () => {
      if (!id) return;
      setLoading(true);
      const [proj, conts, notes, tasks, delivs, msgs, proposalsData] = await Promise.all([
          db.projects.getById(id),        // <--- CAMBIO CLAVE AQUÍ
          db.contractors.getAll(),
          db.clientNotes.getByClient(id),
          db.tasks.getByProjectId(id),    // <--- Asegúrate de haber agregado esto en el paso anterior
          db.portal.getDeliverables(id),
          db.portal.getMessages(id),
          db.proposals.getAll() // Fetch proposals to find active services
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
      
      // Filter Active Services
      // We look for accepted proposals for this client
      const clientProposals = (proposalsData as Proposal[]).filter(p => p.clientId === id && (p.status === 'ACCEPTED' || p.status === 'PARTIALLY_ACCEPTED'));
      setProposals(clientProposals);
      
      // Get all items from these proposals
      const items = clientProposals.flatMap(p => p.items || []);
      setActiveItems(items);

      setLoading(false);
  };

  const handleSave = async () => {
      if (!id || !formData) return;
      try {
        await db.projects.update(id, formData);
        loadProject();
        showToast("Cambios guardados correctamente", "success");
      } catch (e) {
        showToast("Error al guardar cambios", "error");
      }
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
      } catch (e) { console.error(e); showToast("Error procesando IA.", "error"); } finally { setIsProcessingMeeting(false); }
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

  // ✅ Función mejorada para progreso
  const handleAddProgressSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newProgressNote || !id) return;
      await db.clientNotes.create({ clientId: id, type: 'PROGRESS', content: newProgressNote });
      setNewProgressNote('');
      setIsProgressModalOpen(false);
      loadProject();
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
                        <button onClick={() => setIsEditModalOpen(true)} className="p-1 text-gray-400 hover:text-indigo-500 transition-colors">
                            <Edit className="w-4 h-4" />
                        </button>
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
            
            <div className="flex gap-1 mb-8 overflow-x-auto no-scrollbar pb-1">
                {[
                    { id: 'OVERVIEW', label: 'Resumen', icon: BarChart3 },
                    { id: 'PROFILE', label: 'Perfil', icon: User },
                    { id: 'ACTION_PLAN', label: 'Evolución', icon: TrendingUp },
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
                
                {/* OVERVIEW TAB */}
                {activeTab === 'OVERVIEW' && (
                    <div className="animate-in fade-in space-y-6">
                        {/* 1. STATUS CARDS */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Card className="bg-white dark:bg-slate-900 border-l-4 border-l-blue-500">
                                <CardContent className="p-5">
                                    <div className="flex justify-between items-start mb-2">
                                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Facturación</p>
                                        <Wallet className="w-4 h-4 text-blue-500" />
                                    </div>
                                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                                        ${formData.monthlyRevenue?.toLocaleString()} <span className="text-sm font-normal text-gray-400">/mes</span>
                                    </h3>
                                    <div className="flex items-center gap-2 mt-2">
                                        <div className={`w-2 h-2 rounded-full ${formData.lastPaymentDate && new Date(formData.lastPaymentDate).getMonth() === new Date().getMonth() ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                        <p className="text-xs text-gray-500">
                                            {formData.lastPaymentDate && new Date(formData.lastPaymentDate).getMonth() === new Date().getMonth() ? 'Pago al día' : 'Pago pendiente'}
                                        </p>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-1">Día de cobro: {formData.billingDay || 1}</p>
                                </CardContent>
                            </Card>

                            <Card className="bg-white dark:bg-slate-900 border-l-4 border-l-purple-500">
                                <CardContent className="p-5">
                                    <div className="flex justify-between items-start mb-2">
                                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Servicios Activos</p>
                                        <Layers className="w-4 h-4 text-purple-500" />
                                    </div>
                                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                                        {activeItems.length}
                                    </h3>
                                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                                        {activeItems.map(i => i.serviceSnapshotName).join(', ') || 'Sin servicios activos'}
                                    </p>
                                </CardContent>
                            </Card>

                            <Card className="bg-white dark:bg-slate-900 border-l-4 border-l-orange-500">
                                <CardContent className="p-5">
                                    <div className="flex justify-between items-start mb-2">
                                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Tareas Pendientes</p>
                                        <ListTodo className="w-4 h-4 text-orange-500" />
                                    </div>
                                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                                        {clientTasks.filter(t => t.status === 'TODO').length}
                                    </h3>
                                    <p className="text-xs text-gray-500 mt-1">
                                        Próxima entrega: {clientTasks.find(t => t.status === 'TODO' && t.dueDate)?.dueDate ? new Date(clientTasks.find(t => t.status === 'TODO' && t.dueDate)!.dueDate!).toLocaleDateString() : 'Sin fecha'}
                                    </p>
                                </CardContent>
                            </Card>
                        </div>

                        {/* 2. SERVICES LIST */}
                        <div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-yellow-500"/> Servicios & Entregables
                            </h3>
                            <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-800 overflow-hidden">
                                {activeItems.length === 0 ? (
                                    <div className="p-8 text-center text-gray-400">No hay servicios activados en este momento.</div>
                                ) : (
                                    <div className="divide-y divide-gray-50 dark:divide-slate-800">
                                        {activeItems.map((item, i) => (
                                            <div key={i} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                <div>
                                                    <p className="font-bold text-gray-900 dark:text-white">{item.serviceSnapshotName}</p>
                                                    <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1">{item.serviceSnapshotDescription}</p>
                                                </div>
                                                <Badge variant={item.serviceSnapshotType === 'RECURRING' ? 'blue' : 'outline'}>
                                                    {item.serviceSnapshotType === 'RECURRING' ? 'Recurrente' : 'One Shot'}
                                                </Badge>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                         {/* 3. RECENT DELIVERABLES */}
                         {deliverables.length > 0 && (
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                    <ExternalLink className="w-4 h-4 text-blue-500"/> Entregables Recientes
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {deliverables.slice(0, 4).map(d => (
                                        <a href={d.url} target="_blank" rel="noreferrer" key={d.id} className="block p-4 bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700 transition-colors group">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                                                    <FileText className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-gray-900 dark:text-white text-sm">{d.name}</p>
                                                    <p className="text-xs text-gray-500">{new Date(d.createdAt).toLocaleDateString()}</p>
                                                </div>
                                            </div>
                                        </a>
                                    ))}
                                </div>
                            </div>
                         )}
                    </div>
                )} 

                {/* PROFILE TAB */}
                {activeTab === 'PROFILE' && (
                    <ProjectProfileTab formData={formData} setFormData={setFormData} />
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
                            <Button onClick={() => setIsProgressModalOpen(true)} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white"><Plus className="w-4 h-4 mr-2"/> Registrar Avance</Button>
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
        {/* Modal para Registrar Progreso */}
        <Modal isOpen={isProgressModalOpen} onClose={() => setIsProgressModalOpen(false)} title="Registrar Avance">
            <form onSubmit={handleAddProgressSubmit} className="space-y-4">
                <div>
                    <Label>¿Qué se logró esta semana?</Label>
                    <Textarea 
                        value={newProgressNote} 
                        onChange={e => setNewProgressNote(e.target.value)} 
                        placeholder="Ej: Se cerraron 3 ventas, terminamos la landing page..." 
                        className="h-32"
                        autoFocus
                    />
                </div>
                <div className="flex justify-end pt-2">
                    <Button type="submit">Guardar Avance</Button>
                </div>
            </form>
        </Modal>

        {/* Modal Editar Proyecto Global */}
        {project && (
            <EditProjectModal 
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                project={formData as Project} 
                onSave={async (updatedData) => {
                    if (!id) return;
                    await db.projects.update(id, updatedData);
                    setFormData({ ...formData, ...updatedData }); 
                    loadProject();
                    showToast("Proyecto actualizado", "success");
                }}
            />
        )}

    </div>
  );
}