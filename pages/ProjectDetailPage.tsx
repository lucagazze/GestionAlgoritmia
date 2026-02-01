

import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../services/db';
import { ai } from '../services/ai';
import { Project, ProjectStatus, Contractor, ClientNote, Task, TaskStatus, Deliverable, PortalMessage } from '../types';
import { Badge, Button, Input, Label, Textarea, Card, Slider, Modal } from '../components/UIComponents';
import { 
  ArrowLeft, Mic2, ListTodo, Plus, Trash2, ExternalLink, Copy, 
  Sparkles, Globe, Loader2, Save,
  CheckCircle2, User, Wallet, Palette, FileText, UploadCloud, MessageSquare, Send
} from 'lucide-react';
import jsPDF from 'jspdf';

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Tabs
  const [activeTab, setActiveTab] = useState<'PROFILE' | 'ENTREGAS' | 'PORTAL' | 'FINANCE' | 'MEETINGS' | 'HISTORY'>('PROFILE');

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
      if (id) loadProject();
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
                    { id: 'ENTREGAS', label: 'Entregables', icon: UploadCloud },
                    { id: 'PORTAL', label: 'Chat Portal', icon: MessageSquare },
                    { id: 'FINANCE', label: 'Rentabilidad', icon: Wallet },
                    { id: 'MEETINGS', label: 'Bitácora IA', icon: Mic2 },
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
                
                {/* PROFILE TAB */}
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
                    </div>
                )}

                {/* DELIVERABLES TAB (NEW) */}
                {activeTab === 'ENTREGAS' && (
                    <div className="space-y-6 animate-in fade-in">
                        <div className="flex justify-between items-center">
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Entregables para Aprobación</h2>
                            <Button onClick={() => setIsDelivModalOpen(true)}><Plus className="w-4 h-4 mr-2"/> Subir Entregable</Button>
                        </div>

                        {deliverables.length === 0 ? (
                            <div className="text-center py-20 border-2 border-dashed border-gray-200 dark:border-slate-800 rounded-2xl text-gray-400">
                                <UploadCloud className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                <p>No hay entregables pendientes.</p>
                            </div>
                        ) : (
                            <div className="grid gap-4">
                                {deliverables.map(deliv => (
                                    <Card key={deliv.id} className="p-4 flex items-center justify-between group">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${deliv.status === 'APPROVED' ? 'bg-green-100 text-green-600' : deliv.status === 'CHANGES_REQUESTED' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'}`}>
                                                {deliv.status === 'APPROVED' ? <CheckCircle2 className="w-5 h-5"/> : <FileText className="w-5 h-5"/>}
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-gray-900 dark:text-white">{deliv.name}</h4>
                                                <a href={deliv.url} target="_blank" className="text-xs text-blue-500 hover:underline truncate max-w-[200px] block">{deliv.url}</a>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <Badge variant={deliv.status === 'APPROVED' ? 'green' : deliv.status === 'CHANGES_REQUESTED' ? 'outline' : 'blue'}>
                                                {deliv.status === 'APPROVED' ? 'APROBADO' : deliv.status === 'CHANGES_REQUESTED' ? 'CAMBIOS SOLICITADOS' : 'PENDIENTE'}
                                            </Badge>
                                            <button onClick={() => handleDeleteDeliverable(deliv.id)} className="p-2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-4 h-4"/></button>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        )}

                        <Modal isOpen={isDelivModalOpen} onClose={() => setIsDelivModalOpen(false)} title="Nuevo Entregable">
                            <form onSubmit={handleAddDeliverable} className="space-y-4">
                                <div><Label>Nombre del Archivo/Entrega</Label><Input value={delivForm.name} onChange={e => setDelivForm({...delivForm, name: e.target.value})} placeholder="Ej: Diseño Home v1" autoFocus/></div>
                                <div><Label>Link (Drive, Figma, WeTransfer)</Label><Input value={delivForm.url} onChange={e => setDelivForm({...delivForm, url: e.target.value})} placeholder="https://..." /></div>
                                <div className="flex justify-end pt-2"><Button type="submit">Publicar en Portal</Button></div>
                            </form>
                        </Modal>
                    </div>
                )}

                {/* PORTAL CHAT TAB (NEW) */}
                {activeTab === 'PORTAL' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in h-[600px]">
                        <div className="lg:col-span-2 flex flex-col bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                            <div className="p-4 border-b border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 flex justify-between items-center">
                                <h3 className="font-bold flex items-center gap-2"><MessageSquare className="w-4 h-4"/> Chat con Cliente</h3>
                                <div className="flex items-center gap-2">
                                    <div className="text-xs text-gray-500 bg-white dark:bg-slate-900 px-2 py-1 rounded border">Link del Portal:</div>
                                    <div className="flex items-center gap-1 bg-blue-50 text-blue-600 px-2 py-1 rounded text-xs font-mono">
                                        <Globe className="w-3 h-3" /> /portal/{formData.publicToken?.slice(0,6)}...
                                    </div>
                                    <button onClick={() => navigator.clipboard.writeText(`${window.location.origin}/#/portal/${formData.publicToken}`)} className="p-1 hover:bg-gray-200 rounded"><Copy className="w-3 h-3"/></button>
                                </div>
                            </div>
                            
                            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50 dark:bg-slate-950" ref={chatScrollRef}>
                                {portalMessages.length === 0 && <div className="text-center text-gray-400 mt-20 text-sm">El historial de chat está vacío.</div>}
                                {portalMessages.map((msg, idx) => (
                                    <div key={idx} className={`flex ${msg.sender === 'AGENCY' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[70%] p-3 rounded-xl text-sm ${msg.sender === 'AGENCY' ? 'bg-black text-white rounded-br-none' : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none'}`}>
                                            <p>{msg.content}</p>
                                            <div className={`text-[10px] mt-1 text-right ${msg.sender === 'AGENCY' ? 'text-gray-400' : 'text-gray-400'}`}>
                                                {new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="p-4 bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800">
                                <div className="flex gap-2">
                                    <Input 
                                        value={chatInput} 
                                        onChange={e => setChatInput(e.target.value)} 
                                        onKeyDown={e => e.key === 'Enter' && handleSendPortalMessage()}
                                        placeholder="Escribe un mensaje al cliente..." 
                                        className="flex-1"
                                    />
                                    <Button onClick={handleSendPortalMessage} className="px-4"><Send className="w-4 h-4"/></Button>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <Card className="p-6 text-center">
                                <Globe className="w-10 h-10 mx-auto text-blue-500 mb-2" />
                                <h3 className="font-bold">Acceso al Portal</h3>
                                <p className="text-xs text-gray-500 mb-4">El cliente ve el progreso, chat y entregables aquí.</p>
                                {formData.publicToken ? (
                                    <a href={`/#/portal/${formData.publicToken}`} target="_blank" className="block w-full">
                                        <Button variant="outline" className="w-full">Abrir Portal <ExternalLink className="w-3 h-3 ml-2"/></Button>
                                    </a>
                                ) : (
                                    <Button onClick={() => setFormData({...formData, publicToken: Math.random().toString(36).substring(2)})} className="w-full">Generar Link</Button>
                                )}
                            </Card>
                            
                            <Card className="p-6">
                                <Label>Progreso Visible ({formData.progress}%)</Label>
                                <Slider value={formData.progress || 0} min={0} max={100} onChange={e => setFormData({...formData, progress: parseInt(e.target.value)})} />
                            </Card>
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

                {/* FINANCE TAB */}
                {activeTab === 'FINANCE' && (
                    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Card className="p-6">
                                <h3 className="font-bold mb-4 flex items-center gap-2 text-gray-900 dark:text-white"><Wallet className="w-4 h-4"/> Estructura de Costos</h3>
                                <div className="space-y-4">
                                    <div><Label>Ingreso (Fee Cliente)</Label><Input type="number" className="font-mono font-bold text-green-700" value={formData.monthlyRevenue} onChange={e => setFormData({...formData, monthlyRevenue: parseFloat(e.target.value)})} /></div>
                                    <div className="pt-2 border-t border-gray-100 dark:border-slate-800">
                                        <Label>Costo Socio</Label>
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
                                    <div><Label>Costos Fijos Internos</Label><Input type="number" className="font-mono text-red-600" value={formData.internalCost} onChange={e => setFormData({...formData, internalCost: parseFloat(e.target.value)})} placeholder="$0" /></div>
                                </div>
                            </Card>
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