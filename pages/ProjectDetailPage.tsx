
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../services/db';
import { ai } from '../services/ai';
import { Project, ProjectStatus, Contractor, ClientNote, Task, ProjectResource, ProjectContact, ClientHealth, TaskStatus } from '../types';
import { Badge, Button, Input, Label, Textarea, Card, Slider } from '../components/UIComponents';
import { 
  ArrowLeft, Mic2, ListTodo, Plus, Trash2, ExternalLink, Copy, 
  Sparkles, MessageCircle, PieChart, Globe, Loader2, Save,
  CheckCircle2, User, Phone, Mail, FileText, Calendar
} from 'lucide-react';

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Tabs
  const [activeTab, setActiveTab] = useState<'PROFILE' | 'MEETINGS' | 'RESOURCES' | 'FINANCE' | 'PORTAL' | 'STRATEGY' | 'HISTORY'>('PROFILE');

  // Sub-States
  const [clientNotes, setClientNotes] = useState<ClientNote[]>([]);
  const [clientTasks, setClientTasks] = useState<Task[]>([]);
  const [newNote, setNewNote] = useState('');
  
  // AI specific
  const [meetingNotes, setMeetingNotes] = useState('');
  const [isProcessingMeeting, setIsProcessingMeeting] = useState(false);
  const [aiReportText, setAiReportText] = useState('');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  // Form Data (Mirror of project state for editing)
  const [formData, setFormData] = useState<Partial<Project>>({});

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
          setFormData(proj); // Initialize form
      }
      setContractors(conts);
      setClientNotes(notes);
      setClientTasks(tasks);
      setLoading(false);
  };

  const handleSave = async () => {
      if (!id || !formData) return;
      await db.projects.update(id, formData);
      // Reload to ensure sync
      loadProject();
      alert("Guardado correctamente.");
  };

  const processMeetingNotes = async () => {
      if (!meetingNotes.trim() || !id) return;
      setIsProcessingMeeting(true);
      try {
          const prompt = `
          Analiza estas notas crudas tomadas durante una reunión con el cliente "${project?.name}".
          
          NOTAS CRUDAS:
          "${meetingNotes}"
          
          INSTRUCCIONES:
          1. Genera un "Resumen Ejecutivo" limpio y profesional.
          2. Extrae una lista de "Action Items" (Tareas) concretas.
          
          Responde SOLO en formato JSON válido: { "summary": "...", "tasks": [ { "title": "...", "priority": "HIGH"|"MEDIUM"|"LOW" } ] }
          `;

          const response = await ai.chat([{ role: 'user', content: prompt }]);
          const cleanJson = response.replace(/```json/g, '').replace(/```/g, '').trim();
          const data = JSON.parse(cleanJson);

          // Save Summary as Note
          await db.clientNotes.create({
              clientId: id,
              type: 'MEETING',
              content: `📝 RESUMEN REUNIÓN:\n${data.summary}`
          });

          // Create Tasks
          for (const t of data.tasks) {
              await db.tasks.create({
                  projectId: id,
                  title: t.title,
                  priority: t.priority,
                  status: TaskStatus.TODO,
                  description: "Generado desde Bitácora de Reunión"
              });
          }

          setMeetingNotes('');
          loadProject(); 
          setActiveTab('HISTORY');
          alert("Minuta guardada y tareas creadas.");
      } catch (e) {
          console.error(e);
          alert("Error procesando IA.");
      } finally {
          setIsProcessingMeeting(false);
      }
  };

  // --- Renderers ---

  if (loading || !project) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-gray-300 w-8 h-8"/></div>;

  return (
    <div className="bg-[#FAFAFA] min-h-screen pb-20 animate-in fade-in slide-in-from-bottom-2 duration-500">
        
        {/* Header */}
        <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-gray-200 px-6 py-4 flex justify-between items-center">
            <div className="flex items-center gap-4">
                <button onClick={() => navigate('/projects')} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><ArrowLeft className="w-5 h-5 text-gray-500"/></button>
                <div>
                    <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        {formData.name} 
                        <Badge variant={formData.status === 'ACTIVE' ? 'green' : 'outline'}>{formData.status}</Badge>
                    </h1>
                    <p className="text-xs text-gray-500">{formData.industry || 'Sin rubro'} • Fee: ${formData.monthlyRevenue?.toLocaleString()}</p>
                </div>
            </div>
            <div className="flex gap-2">
                <Button onClick={handleSave} className="shadow-lg shadow-black/10"><Save className="w-4 h-4 mr-2"/> Guardar Cambios</Button>
            </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-8">
            
            {/* Tabs */}
            <div className="flex gap-1 mb-8 overflow-x-auto no-scrollbar pb-1">
                {[
                    { id: 'PROFILE', label: 'Perfil & Datos', icon: User },
                    { id: 'MEETINGS', label: 'Bitácora IA', icon: Mic2 },
                    { id: 'RESOURCES', label: 'Vault (Links)', icon: ExternalLink },
                    { id: 'FINANCE', label: 'Rentabilidad', icon: PieChart },
                    { id: 'PORTAL', label: 'Guest Portal', icon: Globe },
                    { id: 'STRATEGY', label: 'Growth', icon: Sparkles },
                    { id: 'HISTORY', label: 'Historial', icon: ListTodo },
                ].map(tab => {
                    const Icon = tab.icon;
                    return (
                        <button 
                            key={tab.id} 
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all ${activeTab === tab.id ? 'bg-black text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-100'}`}
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in">
                        <Card className="p-6 space-y-4">
                            <h3 className="font-bold text-gray-900 border-b border-gray-100 pb-2">Datos Principales</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div><Label>Nombre</Label><Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
                                <div><Label>Rubro</Label><Input value={formData.industry} onChange={e => setFormData({...formData, industry: e.target.value})} /></div>
                                <div><Label>Fee Mensual</Label><Input type="number" value={formData.monthlyRevenue} onChange={e => setFormData({...formData, monthlyRevenue: parseFloat(e.target.value)})} /></div>
                                <div><Label>Día de Cobro</Label><Input type="number" value={formData.billingDay} onChange={e => setFormData({...formData, billingDay: parseInt(e.target.value)})} /></div>
                                <div>
                                    <Label>Estado</Label>
                                    <select className="w-full h-12 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})}>
                                        <option value="ONBOARDING">Onboarding</option><option value="ACTIVE">Activo</option><option value="PAUSED">Pausado</option><option value="COMPLETED">Completado</option>
                                        <optgroup label="Ventas"><option value="LEAD">Lead</option><option value="PROPOSAL">Propuesta</option></optgroup>
                                    </select>
                                </div>
                                <div>
                                    <Label>Salud</Label>
                                    <select className="w-full h-12 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm" value={formData.healthScore} onChange={e => setFormData({...formData, healthScore: e.target.value as any})}>
                                        <option value="GOOD">❤️ Sano</option><option value="RISK">⚠️ Riesgo</option><option value="CRITICAL">🔥 Crítico</option>
                                    </select>
                                </div>
                            </div>
                        </Card>

                        <Card className="p-6 space-y-4">
                            <h3 className="font-bold text-gray-900 border-b border-gray-100 pb-2">Contactos & Brand Kit</h3>
                            
                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-2">
                                <Label>Contactos Clave</Label>
                                {formData.contacts?.map((c, idx) => (
                                    <div key={idx} className="flex gap-2">
                                        <input className="flex-1 h-9 rounded-lg border px-2 text-xs" value={c.name} onChange={e => {const n = [...(formData.contacts||[])]; n[idx].name = e.target.value; setFormData({...formData, contacts: n})}} placeholder="Nombre" />
                                        <input className="w-24 h-9 rounded-lg border px-2 text-xs" value={c.role} onChange={e => {const n = [...(formData.contacts||[])]; n[idx].role = e.target.value; setFormData({...formData, contacts: n})}} placeholder="Rol" />
                                        <button onClick={() => {const n = [...(formData.contacts||[])]; n.splice(idx,1); setFormData({...formData, contacts: n})}} className="text-red-400"><Trash2 className="w-4 h-4"/></button>
                                    </div>
                                ))}
                                <Button size="sm" variant="secondary" onClick={() => setFormData({...formData, contacts: [...(formData.contacts||[]), {id: Date.now().toString(), name: '', role: ''}]})}><Plus className="w-3 h-3 mr-1"/> Agregar</Button>
                            </div>

                            <div>
                                <Label>Colores de Marca</Label>
                                <div className="flex gap-2 flex-wrap">
                                    {formData.brandColors?.map((c, i) => (
                                        <div key={i} className="w-8 h-8 rounded-full border shadow-sm cursor-pointer" style={{backgroundColor: c}} onClick={() => {if(confirm("Borrar color?")){const n=[...formData.brandColors!]; n.splice(i,1); setFormData({...formData, brandColors: n})}}}></div>
                                    ))}
                                    <input type="color" className="w-8 h-8 rounded-full overflow-hidden p-0 border-0" onChange={e => setFormData({...formData, brandColors: [...(formData.brandColors||[]), e.target.value]})} />
                                </div>
                            </div>
                        </Card>
                    </div>
                )}

                {/* MEETINGS TAB */}
                {activeTab === 'MEETINGS' && (
                    <div className="max-w-3xl mx-auto animate-in fade-in">
                        <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-2xl mb-6">
                            <h3 className="font-bold text-indigo-900 flex items-center gap-2 mb-2"><Mic2 className="w-5 h-5"/> Asistente de Reuniones</h3>
                            <p className="text-sm text-indigo-700 mb-4">Toma notas rápidas y desordenadas. La IA las limpiará y creará las tareas automáticamente.</p>
                            <Textarea 
                                className="bg-white min-h-[200px] font-mono text-sm border-indigo-100 focus:border-indigo-300"
                                placeholder="- Cliente quiere cambiar el logo... - Entregar el viernes... - Falta acceso a Facebook..."
                                value={meetingNotes}
                                onChange={e => setMeetingNotes(e.target.value)}
                            />
                            <div className="flex justify-end mt-4">
                                <Button onClick={processMeetingNotes} disabled={isProcessingMeeting || !meetingNotes} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                                    {isProcessingMeeting ? <Loader2 className="animate-spin mr-2"/> : <Sparkles className="mr-2 w-4 h-4"/>}
                                    Procesar Notas
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* HISTORY TAB */}
                {activeTab === 'HISTORY' && (
                    <div className="max-w-4xl mx-auto animate-in fade-in">
                        <div className="relative border-l-2 border-gray-200 ml-4 space-y-8 pl-8 py-4">
                            {clientTasks.filter(t => t.status === 'DONE').length === 0 && clientNotes.length === 0 && <p className="text-gray-400 italic">No hay historial aún.</p>}
                            
                            {/* Merge notes and done tasks */}
                            {[...clientNotes.map(n => ({type:'NOTE', data:n, date: n.createdAt})), ...clientTasks.filter(t => t.status === 'DONE').map(t => ({type:'TASK', data:t, date: t.created_at}))]
                                .sort((a,b) => new Date(b.date!).getTime() - new Date(a.date!).getTime())
                                .map((item, idx) => (
                                    <div key={idx} className="relative">
                                        <div className={`absolute -left-[41px] w-5 h-5 rounded-full border-4 border-white shadow-sm ${item.type === 'TASK' ? 'bg-green-500' : 'bg-blue-500'}`}></div>
                                        <p className="text-xs text-gray-400 font-mono mb-1">{new Date(item.date!).toLocaleString()}</p>
                                        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm text-sm text-gray-700 whitespace-pre-wrap">
                                            {item.type === 'TASK' ? (
                                                <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-600"/> <span className="line-through opacity-70">{(item.data as any).title}</span></div>
                                            ) : (
                                                (item.data as any).content
                                            )}
                                        </div>
                                    </div>
                                ))
                            }
                        </div>
                    </div>
                )}

                {/* RESOURCES TAB */}
                {activeTab === 'RESOURCES' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in">
                        {formData.resources?.map((r, idx) => (
                            <div key={idx} className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-gray-100 rounded-lg"><ExternalLink className="w-5 h-5 text-gray-500"/></div>
                                    <div>
                                        <p className="font-bold text-sm">{r.name}</p>
                                        <a href={r.url} target="_blank" className="text-xs text-blue-600 hover:underline truncate max-w-[200px] block">{r.url}</a>
                                    </div>
                                </div>
                                <button onClick={() => {const n=[...formData.resources!]; n.splice(idx,1); setFormData({...formData, resources:n})}} className="text-gray-300 hover:text-red-500"><Trash2 className="w-4 h-4"/></button>
                            </div>
                        ))}
                        <button 
                            onClick={() => setFormData({...formData, resources: [...(formData.resources||[]), {id: Date.now().toString(), name: 'Nuevo Recurso', url: '', type: 'OTHER'}]})}
                            className="flex items-center justify-center p-4 rounded-xl border-2 border-dashed border-gray-200 text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors"
                        >
                            <Plus className="w-5 h-5 mr-2"/> Agregar Link
                        </button>
                    </div>
                )}

                {/* FINANCE TAB */}
                {activeTab === 'FINANCE' && (
                    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in">
                        <Card className="p-6">
                            <h3 className="font-bold mb-4">Estructura de Costos</h3>
                            <div className="space-y-4">
                                <div><Label>Horas Internas (Mensuales)</Label><Input type="number" value={formData.internalHours} onChange={e => setFormData({...formData, internalHours: parseFloat(e.target.value)})} /></div>
                                <div><Label>Costo Hora Interna ($)</Label><Input type="number" value={formData.internalHourlyRate} onChange={e => setFormData({...formData, internalHourlyRate: parseFloat(e.target.value)})} /></div>
                                <div><Label>Costo Outsourcing (Socios)</Label><Input type="number" value={formData.outsourcingCost} onChange={e => setFormData({...formData, outsourcingCost: parseFloat(e.target.value)})} /></div>
                            </div>
                        </Card>
                        <div className="bg-black text-white p-6 rounded-2xl shadow-xl">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Margen Real</p>
                            <div className="text-4xl font-bold mt-2">
                                ${((formData.monthlyRevenue || 0) - (formData.outsourcingCost || 0) - ((formData.internalHours || 0) * (formData.internalHourlyRate || 0))).toLocaleString()}
                            </div>
                            <p className="text-sm text-gray-400 mt-1">Ganancia neta mensual</p>
                        </div>
                    </div>
                )}

                {/* PORTAL TAB */}
                {activeTab === 'PORTAL' && (
                    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in text-center">
                        <div className="p-8 bg-gradient-to-b from-white to-gray-50 rounded-3xl border border-gray-200 shadow-sm">
                            <Globe className="w-12 h-12 text-blue-500 mx-auto mb-4" />
                            <h3 className="text-xl font-bold text-gray-900">Portal de Cliente (Guest View)</h3>
                            <p className="text-gray-500 mb-6">Comparte este enlace para que el cliente vea su estado y entregables.</p>
                            
                            {formData.publicToken ? (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 bg-white p-3 rounded-xl border border-gray-200 shadow-inner">
                                        <input readOnly value={`${window.location.origin}/#/portal/${formData.publicToken}`} className="flex-1 text-xs text-gray-500 bg-transparent outline-none font-mono" />
                                        <button onClick={() => navigator.clipboard.writeText(`${window.location.origin}/#/portal/${formData.publicToken}`)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"><Copy className="w-4 h-4"/></button>
                                        <a href={`/#/portal/${formData.publicToken}`} target="_blank" className="p-2 hover:bg-gray-100 rounded-lg text-blue-600"><ExternalLink className="w-4 h-4"/></a>
                                    </div>
                                    <div className="text-left bg-white p-4 rounded-xl border border-gray-100">
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

            </div>
        </div>
    </div>
  );
}
