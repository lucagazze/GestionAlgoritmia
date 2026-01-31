
import React, { useEffect, useState } from 'react';
import { db } from '../services/db';
import { ai } from '../services/ai';
import { Project, ProjectStatus, Contractor, ClientNote, Task, ProjectResource, ProjectContact, ClientHealth, TaskStatus } from '../types';
import { Badge, Button, Modal, Input, Label, Textarea, Card, Slider } from '../components/UIComponents';
import { ContextMenu } from '../components/ContextMenu';
import { 
  MoreHorizontal, Plus, Edit2, MessageCircle, FileText, User, ArrowRight, History, 
  StickyNote, CheckCircle2, Mic, Search, Filter, Phone, Wallet, Sparkles, Copy, 
  Loader2, Handshake, Trash2, Columns, Table as TableIcon, Heart, 
  Link as LinkIcon, ExternalLink, Calendar, TrendingUp, AlertTriangle, ShieldCheck, ShieldAlert,
  PieChart, Globe, Share2, RefreshCw, Ghost, Type, Palette, Mic2, ListTodo,
  Briefcase, Target, Trophy
} from 'lucide-react';
import confetti from 'canvas-confetti';

type ViewContext = 'DELIVERY' | 'SALES';

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // View States
  const [viewContext, setViewContext] = useState<ViewContext>('DELIVERY');
  const [viewMode, setViewMode] = useState<'LIST' | 'KANBAN'>('LIST');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'PROFILE' | 'RESOURCES' | 'FINANCE' | 'PORTAL' | 'STRATEGY' | 'PARTNER' | 'MEETINGS' | 'HISTORY'>('PROFILE');
  const [editingId, setEditingId] = useState<string | null>(null);

  // Context Menu
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; project: Project | null }>({ x: 0, y: 0, project: null });

  // Data for Tabs
  const [clientNotes, setClientNotes] = useState<ClientNote[]>([]);
  const [clientTasks, setClientTasks] = useState<Task[]>([]);
  const [newNote, setNewNote] = useState('');
  
  // AI States
  const [isGeneratingAgreement, setIsGeneratingAgreement] = useState(false);
  const [partnerAgreementText, setPartnerAgreementText] = useState('');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [aiReportText, setAiReportText] = useState('');
  const [isAnalyzingUpsell, setIsAnalyzingUpsell] = useState(false);
  const [upsellAnalysis, setUpsellAnalysis] = useState('');
  
  // Meeting Mode State
  const [meetingNotes, setMeetingNotes] = useState('');
  const [isProcessingMeeting, setIsProcessingMeeting] = useState(false);

  // Form State
  const [formData, setFormData] = useState<{
      name: string;
      industry: string;
      monthlyRevenue: string;
      billingDay: string;
      phone: string;
      assignedPartnerId: string;
      outsourcingCost: string;
      status: ProjectStatus;
      healthScore: ClientHealth;
      resources: ProjectResource[];
      contacts: ProjectContact[];
      internalHours: string;
      internalHourlyRate: string;
      publicToken: string;
      progress: number;
      brandColors: string[];
      brandFonts: string[];
      newColorInput: string;
      newFontInput: string;
  }>({
      name: '',
      industry: '',
      monthlyRevenue: '',
      billingDay: '1',
      phone: '',
      assignedPartnerId: '',
      outsourcingCost: '',
      status: ProjectStatus.ONBOARDING,
      healthScore: 'GOOD',
      resources: [],
      contacts: [],
      internalHours: '0',
      internalHourlyRate: '25',
      publicToken: '',
      progress: 0,
      brandColors: [],
      brandFonts: [],
      newColorInput: '#000000',
      newFontInput: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    const [projData, contData] = await Promise.all([
        db.projects.getAll(),
        db.contractors.getAll()
    ]);
    const mappedProjects = projData.map(p => {
        const partner = contData.find(c => c.id === p.assignedPartnerId);
        return { ...p, partnerName: partner ? partner.name : undefined };
    });
    setProjects(mappedProjects);
    setContractors(contData);
    setIsLoading(false);
  };

  const loadClientHistory = async (clientId: string) => {
      const notes = await db.clientNotes.getByClient(clientId);
      const allTasks = await db.tasks.getAll();
      const relevantTasks = allTasks.filter(t => t.projectId === clientId);
      setClientNotes(notes);
      setClientTasks(relevantTasks);
  };

  const openCreateModal = () => {
      setEditingId(null);
      setFormData({ 
          name: '', industry: '', monthlyRevenue: '', billingDay: '1', phone: '', assignedPartnerId: '', outsourcingCost: '', 
          status: viewContext === 'SALES' ? ProjectStatus.LEAD : ProjectStatus.ONBOARDING, 
          healthScore: 'GOOD', resources: [], contacts: [],
          internalHours: '0', internalHourlyRate: '25', publicToken: '', progress: 0,
          brandColors: [], brandFonts: [], newColorInput: '#000000', newFontInput: ''
      });
      setActiveTab('PROFILE');
      setIsModalOpen(true);
  };

  const openEditModal = async (p: Project) => {
      setEditingId(p.id);
      setFormData({
          name: p.name,
          industry: p.industry || '',
          monthlyRevenue: p.monthlyRevenue.toString(),
          billingDay: p.billingDay.toString(),
          phone: p.phone || '',
          assignedPartnerId: p.assignedPartnerId || '',
          outsourcingCost: p.outsourcingCost ? p.outsourcingCost.toString() : '',
          status: p.status,
          healthScore: p.healthScore || 'GOOD',
          resources: p.resources || [],
          contacts: p.contacts || [],
          internalHours: p.internalHours?.toString() || '0',
          internalHourlyRate: p.internalHourlyRate?.toString() || '25',
          publicToken: p.publicToken || '',
          progress: p.progress || 0,
          brandColors: p.brandColors || [],
          brandFonts: p.brandFonts || [],
          newColorInput: '#000000',
          newFontInput: ''
      });
      setMeetingNotes('');
      // Clear previous AI states
      setPartnerAgreementText(''); 
      setAiReportText('');
      setUpsellAnalysis('');
      
      setActiveTab('PROFILE');
      await loadClientHistory(p.id);
      setIsModalOpen(true);
  };

  const handleContextMenu = (e: React.MouseEvent, project: Project) => {
      e.preventDefault();
      setContextMenu({ x: e.pageX, y: e.pageY, project });
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
      e.preventDefault();
      if(!formData.name) return;
      const payload = {
          name: formData.name,
          industry: formData.industry,
          monthlyRevenue: parseFloat(formData.monthlyRevenue) || 0,
          billingDay: parseInt(formData.billingDay) || 1,
          phone: formData.phone,
          assignedPartnerId: formData.assignedPartnerId || null,
          outsourcingCost: parseFloat(formData.outsourcingCost) || 0,
          status: formData.status,
          healthScore: formData.healthScore,
          resources: formData.resources,
          contacts: formData.contacts,
          internalHours: parseFloat(formData.internalHours) || 0,
          internalHourlyRate: parseFloat(formData.internalHourlyRate) || 0,
          publicToken: formData.publicToken,
          progress: formData.progress,
          brandColors: formData.brandColors,
          brandFonts: formData.brandFonts
      };
      if (editingId) await db.projects.update(editingId, payload);
      else await db.projects.create(payload);
      
      setIsModalOpen(false); 
      loadData();
  }

  const handleDragDropStatus = async (projectId: string, newStatus: ProjectStatus) => {
      await db.projects.update(projectId, { status: newStatus });
      
      // Automation: If moved to WON (ONBOARDING) from a sales stage
      if (newStatus === ProjectStatus.ONBOARDING) {
          confetti({
              particleCount: 150,
              spread: 70,
              origin: { y: 0.6 },
              colors: ['#22c55e', '#16a34a', '#dcfce7']
          });
          // Optional: automatically switch view to delivery to start working
          // setViewContext('DELIVERY');
      }
      loadData();
  };

  const handleAddNote = async () => {
      if (!editingId || !newNote.trim()) return;
      await db.clientNotes.create({ clientId: editingId, content: newNote, type: 'NOTE' });
      setNewNote('');
      loadClientHistory(editingId); 
  }

  const handleDelete = async (id: string) => {
      if(confirm('¿Eliminar proyecto y cliente?')) {
          await db.projects.delete(id);
          setIsModalOpen(false);
          loadData();
      }
  }

  const markPaymentReceived = async (e: React.MouseEvent, p: Project) => {
      e.stopPropagation();
      if(confirm(`¿Registrar pago de ${p.name} para este mes?`)) {
          await db.projects.update(p.id, { lastPaymentDate: new Date().toISOString() });
          loadData();
      }
  }

  const generatePublicToken = () => {
      const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      setFormData({...formData, publicToken: token});
  };

  const addBrandColor = () => {
      if(!formData.brandColors.includes(formData.newColorInput)){
          setFormData({...formData, brandColors: [...formData.brandColors, formData.newColorInput]});
      }
  };

  const addBrandFont = () => {
      if(formData.newFontInput && !formData.brandFonts.includes(formData.newFontInput)){
          setFormData({...formData, brandFonts: [...formData.brandFonts, formData.newFontInput], newFontInput: ''});
      }
  };

  // --- AI GENERATORS ---

  const generatePartnerAgreement = async () => {
      if (!formData.assignedPartnerId) { alert("Asigna un socio primero."); return; }
      const partner = contractors.find(c => c.id === formData.assignedPartnerId);
      setIsGeneratingAgreement(true);
      try {
          const prompt = `Actúa como Project Manager. Redacta una orden de trabajo simple para el socio ${partner?.name}. Cliente: ${formData.name}. Tarea: Gestión mensual de ${formData.industry}. Pago: $${formData.outsourcingCost}. Fecha pago: Día 5.`;
          const response = await ai.chat([{ role: 'user', content: prompt }]);
          setPartnerAgreementText(response || "Error generando acuerdo.");
      } catch (error) { console.error(error); } finally { setIsGeneratingAgreement(false); }
  };

  const generateProgressReport = async () => {
      const completedTasks = clientTasks.filter(t => t.status === 'DONE').slice(0, 5);
      if (completedTasks.length === 0) { alert("No hay tareas completadas para reportar."); return; }
      setIsGeneratingReport(true);
      try {
          const taskList = completedTasks.map(t => `- ${t.title}`).join('\n');
          const prompt = `Redacta un mensaje de WhatsApp corto y profesional para el cliente ${formData.name}. Infórmale que esta semana completamos:\n${taskList}\nPregunta si tiene dudas.`;
          const response = await ai.chat([{ role: 'user', content: prompt }]);
          setAiReportText(response || "Error.");
      } catch (error) { console.error(error); } finally { setIsGeneratingReport(false); }
  };

  const analyzeUpsell = async () => {
      setIsAnalyzingUpsell(true);
      try {
          const prompt = `El cliente es una empresa de ${formData.industry || 'Servicios'}. Actualmente paga $${formData.monthlyRevenue}. Analiza qué otros servicios complementarios podría necesitar (Ej: si tiene Ads, ofrecer Email Marketing). Dame 3 ideas de Upsell concretas.`;
          const response = await ai.chat([{ role: 'user', content: prompt }]);
          setUpsellAnalysis(response || "Error.");
      } catch (error) { console.error(error); } finally { setIsAnalyzingUpsell(false); }
  };

  const processMeetingNotes = async () => {
      if (!meetingNotes.trim() || !editingId) return;
      setIsProcessingMeeting(true);
      try {
          const prompt = `
          Analiza estas notas crudas tomadas durante una reunión con el cliente "${formData.name}".
          
          NOTAS CRUDAS:
          "${meetingNotes}"
          
          INSTRUCCIONES:
          1. Genera un "Resumen Ejecutivo" limpio y profesional (max 3 lineas).
          2. Extrae una lista de "Action Items" (Tareas) concretas.
          
          Responde SOLO en formato JSON válido:
          {
            "summary": "...",
            "tasks": [
                { "title": "...", "priority": "HIGH" | "MEDIUM" | "LOW" }
            ]
          }
          `;

          const response = await ai.chat([{ role: 'user', content: prompt }]);
          const cleanJson = response.replace(/```json/g, '').replace(/```/g, '').trim();
          const data = JSON.parse(cleanJson);

          // 1. Save Note
          await db.clientNotes.create({
              clientId: editingId,
              type: 'MEETING',
              content: `📝 RESUMEN REUNIÓN:\n${data.summary}`
          });

          // 2. Create Tasks
          let tasksCreated = 0;
          for (const t of data.tasks) {
              await db.tasks.create({
                  projectId: editingId,
                  title: t.title,
                  priority: t.priority,
                  status: TaskStatus.TODO,
                  description: "Generado automáticamente desde Bitácora de Reunión."
              });
              tasksCreated++;
          }

          alert(`¡Listo! Se guardó la minuta y se crearon ${tasksCreated} tareas.`);
          setMeetingNotes('');
          await loadClientHistory(editingId); // Refresh history
          setActiveTab('HISTORY'); // Switch to history to see result

      } catch (error) {
          console.error(error);
          alert("Error procesando la reunión. Intenta de nuevo.");
      } finally {
          setIsProcessingMeeting(false);
      }
  };

  // --- HELPERS ---

  const getCombinedTimeline = () => {
      const notes = clientNotes.map(n => ({ type: 'NOTE', data: n, date: new Date(n.createdAt) }));
      const tasks = clientTasks.filter(t => t.status === 'DONE').map(t => ({ type: 'TASK', data: t, date: new Date(t.created_at || new Date()) }));
      return [...notes, ...tasks].sort((a, b) => b.date.getTime() - a.date.getTime());
  };

  const isPaymentCurrent = (p: Project) => {
      if (!p.lastPaymentDate) return false;
      const last = new Date(p.lastPaymentDate);
      const now = new Date();
      return last.getMonth() === now.getMonth() && last.getFullYear() === now.getFullYear();
  };

  // Ghosting Logic
  const getGhostingStatus = (lastContactDate?: string) => {
      if (!lastContactDate) return 'UNKNOWN';
      const diffTime = Math.abs(new Date().getTime() - new Date(lastContactDate).getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
      if (diffDays > 7) return 'GHOSTING';
      return 'OK';
  };

  // Profitability Calc
  const revenue = parseFloat(formData.monthlyRevenue) || 0;
  const outsourcing = parseFloat(formData.outsourcingCost) || 0;
  const internalCost = (parseFloat(formData.internalHours) || 0) * (parseFloat(formData.internalHourlyRate) || 0);
  const profit = revenue - outsourcing - internalCost;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

  // Filter based on Context and Search
  const filteredProjects = projects.filter(p => {
      if (!p.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      
      const salesStages = [ProjectStatus.LEAD, ProjectStatus.DISCOVERY, ProjectStatus.PROPOSAL, ProjectStatus.NEGOTIATION, ProjectStatus.LOST];
      const isSales = salesStages.includes(p.status);

      if (viewContext === 'SALES') return isSales;
      else return !isSales; // Delivery context shows Active, Onboarding, Paused, Completed
  });

  // --- RENDERERS ---

  const renderHealthBadge = (health: ClientHealth) => {
      switch(health) {
          case 'GOOD': return <span className="flex items-center text-green-600 gap-1 text-xs font-bold bg-green-50 px-2 py-1 rounded-full"><Heart className="w-3 h-3 fill-green-600"/> Sano</span>;
          case 'RISK': return <span className="flex items-center text-yellow-600 gap-1 text-xs font-bold bg-yellow-50 px-2 py-1 rounded-full"><AlertTriangle className="w-3 h-3"/> Riesgo</span>;
          case 'CRITICAL': return <span className="flex items-center text-red-600 gap-1 text-xs font-bold bg-red-50 px-2 py-1 rounded-full"><ShieldAlert className="w-3 h-3"/> Crítico</span>;
          default: return null;
      }
  };

  const KanbanBoard = () => {
      let columns: { id: ProjectStatus, title: string, color: string }[] = [];

      if (viewContext === 'SALES') {
          columns = [
              { id: ProjectStatus.LEAD, title: 'Lead (Interesado)', color: 'bg-gray-100 text-gray-700' },
              { id: ProjectStatus.DISCOVERY, title: 'Reunión / Discovery', color: 'bg-blue-50 text-blue-700' },
              { id: ProjectStatus.PROPOSAL, title: 'Propuesta Enviada', color: 'bg-indigo-50 text-indigo-700' },
              { id: ProjectStatus.NEGOTIATION, title: 'Negociación', color: 'bg-purple-50 text-purple-700' },
              { id: ProjectStatus.ONBOARDING, title: '¡Cierre Ganado!', color: 'bg-green-50 text-green-700 border-2 border-green-200' }, // Target for drop
          ];
      } else {
          columns = [
              { id: ProjectStatus.ONBOARDING, title: 'Onboarding', color: 'bg-blue-50 text-blue-700' },
              { id: ProjectStatus.ACTIVE, title: 'Activos', color: 'bg-green-50 text-green-700' },
              { id: ProjectStatus.PAUSED, title: 'Pausados', color: 'bg-yellow-50 text-yellow-700' },
              { id: ProjectStatus.COMPLETED, title: 'Completados', color: 'bg-gray-100 text-gray-600' }
          ];
      }

      const handleDragStart = (e: React.DragEvent, id: string) => {
          e.dataTransfer.setData('projectId', id);
      };

      const handleDrop = (e: React.DragEvent, status: ProjectStatus) => {
          const id = e.dataTransfer.getData('projectId');
          if (id) handleDragDropStatus(id, status);
      };

      return (
          <div className="flex h-full gap-4 overflow-x-auto pb-4">
              {columns.map(col => {
                  const colProjects = viewContext === 'SALES' && col.id === ProjectStatus.ONBOARDING 
                     ? [] // Don't show projects in "Won" col in Sales view (they move to delivery), just use as drop target
                     : filteredProjects.filter(p => p.status === col.id);
                  
                  const totalValue = colProjects.reduce((sum, p) => sum + (p.monthlyRevenue || 0), 0);

                  return (
                      <div 
                        key={col.id} 
                        className={`flex-1 min-w-[280px] flex flex-col rounded-xl border transition-colors ${col.id === ProjectStatus.ONBOARDING && viewContext === 'SALES' ? 'bg-green-50/30 border-dashed border-green-300' : 'bg-gray-50/50 border-gray-200'}`}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => handleDrop(e, col.id)}
                      >
                          <div className={`p-3 font-bold text-sm border-b border-gray-100 flex justify-between items-center ${col.color}`}>
                              <span>{col.title}</span>
                              <span className="bg-white/50 px-2 rounded-md text-xs">{colProjects.length}</span>
                          </div>
                          
                          {/* Pipeline Value */}
                          {viewContext === 'SALES' && col.id !== ProjectStatus.ONBOARDING && (
                              <div className="px-3 py-1 text-[10px] text-gray-400 font-medium text-right bg-white/30 border-b border-gray-100/50">
                                  Vol: ${totalValue.toLocaleString()}
                              </div>
                          )}

                          <div className="p-3 space-y-3 flex-1 overflow-y-auto">
                              {col.id === ProjectStatus.ONBOARDING && viewContext === 'SALES' ? (
                                  <div className="h-full flex items-center justify-center text-green-400 text-xs font-bold uppercase tracking-widest text-center opacity-50 border-2 border-dashed border-green-200 rounded-lg m-2">
                                      Arrastra aquí para<br/>cerrar venta 🎉
                                  </div>
                              ) : (
                                  colProjects.map(p => {
                                      const ghostStatus = getGhostingStatus(p.lastContactDate);
                                      return (
                                          <div 
                                            key={p.id} 
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, p.id)}
                                            onClick={() => openEditModal(p)} 
                                            className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm hover:shadow-md cursor-grab active:cursor-grabbing group relative"
                                          >
                                              {ghostStatus === 'GHOSTING' && viewContext === 'DELIVERY' && (
                                                  <div className="absolute top-2 right-2 text-red-500 animate-pulse" title="Cliente descuidado (+7 días sin contacto)">
                                                      <Ghost className="w-4 h-4"/>
                                                  </div>
                                              )}
                                              <div className="flex justify-between items-start mb-2 pr-4">
                                                  <span className="font-bold text-gray-800 text-sm">{p.name}</span>
                                                  {viewContext === 'DELIVERY' && renderHealthBadge(p.healthScore || 'GOOD')}
                                              </div>
                                              <div className="flex justify-between items-end">
                                                  <span className="text-xs text-gray-500 font-mono">${p.monthlyRevenue.toLocaleString()}</span>
                                                  {viewContext === 'DELIVERY' && <div className={`w-2 h-2 rounded-full ${isPaymentCurrent(p) ? 'bg-green-400' : 'bg-red-400 animate-pulse'}`}></div>}
                                                  {viewContext === 'SALES' && <div className="text-[10px] text-gray-400">{p.industry}</div>}
                                              </div>
                                          </div>
                                      )
                                  })
                              )}
                          </div>
                      </div>
                  );
              })}
          </div>
      );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20 h-[calc(100vh-100px)] flex flex-col">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 px-2">
        <div className="flex items-center gap-4">
             {/* Context Switcher */}
             <div className="bg-gray-100 p-1 rounded-xl flex">
                 <button 
                    onClick={() => { setViewContext('DELIVERY'); setViewMode('LIST'); }} 
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewContext === 'DELIVERY' ? 'bg-white shadow text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
                 >
                     <Briefcase className="w-4 h-4"/> Operaciones
                 </button>
                 <button 
                    onClick={() => { setViewContext('SALES'); setViewMode('KANBAN'); }} 
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewContext === 'SALES' ? 'bg-white shadow text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
                 >
                     <Target className="w-4 h-4"/> Ventas (CRM)
                 </button>
             </div>
        </div>
        
        <div className="flex gap-2 w-full md:w-auto items-center">
             {viewContext === 'DELIVERY' && (
                 <div className="bg-gray-100 p-1 rounded-lg flex mr-2">
                     <button onClick={() => setViewMode('LIST')} className={`p-1.5 rounded-md ${viewMode === 'LIST' ? 'bg-white shadow text-black' : 'text-gray-400'}`}><TableIcon className="w-4 h-4"/></button>
                     <button onClick={() => setViewMode('KANBAN')} className={`p-1.5 rounded-md ${viewMode === 'KANBAN' ? 'bg-white shadow text-black' : 'text-gray-400'}`}><Columns className="w-4 h-4"/></button>
                 </div>
             )}
             <div className="relative flex-1 md:w-64"><Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" /><Input placeholder={viewContext === 'SALES' ? "Buscar lead..." : "Buscar cliente..."} className="pl-9 h-10 bg-white" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
            <Button onClick={openCreateModal} className="shadow-lg shadow-black/10"><Plus className="w-4 h-4 mr-2" /> {viewContext === 'SALES' ? 'Nuevo Lead' : 'Nuevo Cliente'}</Button>
        </div>
      </div>

      {/* SALES VIEW always defaults to Kanban-ish, DELIVERY has List/Kanban toggles */}
      {viewMode === 'KANBAN' ? <KanbanBoard /> : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm flex-1 flex flex-col">
              <div className="overflow-x-auto flex-1">
                  <table className="w-full text-sm text-left">
                      <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100 uppercase text-xs tracking-wider sticky top-0 z-10">
                          <tr><th className="px-6 py-3">Cliente</th><th className="px-6 py-3">Estado</th><th className="px-6 py-3 text-right">Fee</th><th className="px-6 py-3 text-center">Salud</th><th className="px-6 py-3 text-center">Pago (Mes)</th><th className="px-6 py-3 text-center"></th></tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                          {isLoading ? (<tr><td colSpan={6} className="text-center py-10 text-gray-400">Cargando...</td></tr>) : 
                              filteredProjects.map((p) => {
                                  const paid = isPaymentCurrent(p);
                                  const ghostStatus = getGhostingStatus(p.lastContactDate);
                                  return (
                                      <tr key={p.id} onClick={() => openEditModal(p)} onContextMenu={(e) => handleContextMenu(e, p)} className="hover:bg-blue-50/30 transition-colors cursor-pointer group">
                                          <td className="px-6 py-3">
                                              <div className="flex flex-col">
                                                  <div className="flex items-center gap-2">
                                                      <span className="font-bold text-gray-900">{p.name}</span>
                                                      {ghostStatus === 'GHOSTING' && <span title="Ghosting Alert: +7 días sin contacto" className="text-red-500 bg-red-50 p-0.5 rounded"><Ghost className="w-3 h-3"/></span>}
                                                  </div>
                                                  <span className="text-[10px] text-gray-400 flex items-center gap-1"><User className="w-3 h-3"/> {p.partnerName || 'In-house'}</span>
                                              </div>
                                          </td>
                                          <td className="px-6 py-3"><Badge variant={p.status === ProjectStatus.ACTIVE ? 'green' : 'outline'}>{p.status}</Badge></td>
                                          <td className="px-6 py-3 text-right font-mono font-medium">${p.monthlyRevenue.toLocaleString()}</td>
                                          <td className="px-6 py-3 text-center flex justify-center">{renderHealthBadge(p.healthScore || 'GOOD')}</td>
                                          <td className="px-6 py-3 text-center">
                                              <button onClick={(e) => markPaymentReceived(e, p)} className={`w-24 px-2 py-1 rounded-md text-xs font-bold border transition-all ${paid ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-50 text-red-600 border-red-100 hover:bg-red-100'}`}>
                                                  {paid ? 'PAGADO' : 'PENDIENTE'}
                                              </button>
                                          </td>
                                          <td className="px-6 py-3 text-center"><button onClick={(e) => {e.stopPropagation(); openEditModal(p);}} className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500"><Edit2 className="w-4 h-4" /></button></td>
                                      </tr>
                                  );
                              })
                          }
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      <ContextMenu 
        x={contextMenu.x} y={contextMenu.y} isOpen={!!contextMenu.project} onClose={() => setContextMenu({ ...contextMenu, project: null })}
        items={[
            { label: 'Editar Cliente', icon: Edit2, onClick: () => contextMenu.project && openEditModal(contextMenu.project) },
            { label: 'Eliminar Cliente', icon: Trash2, variant: 'destructive', onClick: () => contextMenu.project && handleDelete(contextMenu.project.id) }
        ]}
      />

      {/* --- SUPER MODAL --- */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? `Expediente: ${formData.name}` : "Nuevo Proyecto"}>
          
          {/* Brand Kit Header Visual */}
          {formData.brandColors.length > 0 && (
              <div className="flex gap-2 mb-4 px-2 py-2 bg-gray-50/50 rounded-lg overflow-x-auto no-scrollbar">
                  {formData.brandColors.map((c, i) => (
                      <div key={i} onClick={() => navigator.clipboard.writeText(c)} title={`Click copiar: ${c}`} className="w-6 h-6 rounded-full border border-gray-200 shadow-sm cursor-pointer hover:scale-110 transition-transform" style={{ backgroundColor: c }}></div>
                  ))}
                  <div className="h-6 w-px bg-gray-200 mx-2"></div>
                  {formData.brandFonts.map((f, i) => (
                      <span key={i} className="text-xs text-gray-500 font-medium px-2 py-0.5 bg-white rounded border border-gray-200 truncate max-w-[100px]" title={f}>{f}</span>
                  ))}
              </div>
          )}

          <div className="flex border-b border-gray-100 mb-6 overflow-x-auto no-scrollbar">
              {['PROFILE', 'MEETINGS', 'RESOURCES', 'FINANCE', 'PORTAL', 'STRATEGY', 'PARTNER', 'HISTORY'].map(tab => (
                  <button 
                    key={tab}
                    onClick={() => setActiveTab(tab as any)} 
                    className={`px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 ${activeTab === tab ? 'border-black text-black' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                  >
                      {tab === 'PROFILE' ? 'Perfil' : tab === 'MEETINGS' ? 'Bitácora' : tab === 'RESOURCES' ? 'Vault' : tab === 'FINANCE' ? 'Rentabilidad' : tab === 'PORTAL' ? 'Guest Link' : tab === 'STRATEGY' ? 'Growth' : tab === 'PARTNER' ? 'Socio' : 'Historia'}
                  </button>
              ))}
          </div>
          
          <div className="h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              
              {/* TAB 1: PROFILE & CONTACTS */}
              {activeTab === 'PROFILE' && (
                  <form onSubmit={handleSaveProfile} className="space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                          <div className="col-span-2"><Label>Nombre Empresa</Label><Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} autoFocus /></div>
                          <div><Label>Rubro</Label><Input value={formData.industry} onChange={e => setFormData({...formData, industry: e.target.value})} /></div>
                          <div>
                              <Label>Etapa / Estado</Label>
                              <select 
                                className="w-full h-12 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm" 
                                value={formData.status} 
                                onChange={e => setFormData({...formData, status: e.target.value as any})}
                              >
                                  <optgroup label="Ventas (CRM)">
                                      <option value="LEAD">Lead</option>
                                      <option value="DISCOVERY">Discovery</option>
                                      <option value="PROPOSAL">Propuesta</option>
                                      <option value="NEGOTIATION">Negociación</option>
                                      <option value="LOST">Perdido</option>
                                  </optgroup>
                                  <optgroup label="Operaciones">
                                      <option value="ONBOARDING">Onboarding (Ganado)</option>
                                      <option value="ACTIVE">Activo</option>
                                      <option value="PAUSED">Pausado</option>
                                      <option value="COMPLETED">Completado</option>
                                  </optgroup>
                              </select>
                          </div>
                          <div><Label>Fee Mensual ($)</Label><Input type="number" value={formData.monthlyRevenue} onChange={e => setFormData({...formData, monthlyRevenue: e.target.value})} /></div>
                          <div><Label>Día Cobro</Label><Input type="number" value={formData.billingDay} onChange={e => setFormData({...formData, billingDay: e.target.value})} /></div>
                          <div><Label>Salud Cliente</Label><select className="w-full h-12 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm" value={formData.healthScore} onChange={e => setFormData({...formData, healthScore: e.target.value as any})}><option value="GOOD">❤️ Sano</option><option value="RISK">⚠️ Riesgo</option><option value="CRITICAL">🔥 Crítico</option></select></div>
                      </div>

                      {/* BRAND KIT SECTION */}
                      <div className="bg-white border border-gray-200 p-4 rounded-xl space-y-4">
                          <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2"><Palette className="w-4 h-4 text-purple-600"/> Identidad Visual (Brand Kit)</h3>
                          <div className="grid grid-cols-2 gap-6">
                              <div>
                                  <Label>Colores (Hex)</Label>
                                  <div className="flex gap-2 mb-2 flex-wrap">
                                      {formData.brandColors.map((c, i) => (
                                          <div key={i} className="group relative">
                                              <div className="w-8 h-8 rounded-full shadow-sm border border-gray-200" style={{backgroundColor: c}}></div>
                                              <button type="button" onClick={() => {const n=[...formData.brandColors]; n.splice(i,1); setFormData({...formData, brandColors: n})}} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100"><Trash2 className="w-2 h-2"/></button>
                                          </div>
                                      ))}
                                  </div>
                                  <div className="flex gap-2">
                                      <input type="color" className="w-10 h-10 rounded cursor-pointer border-0 p-0" value={formData.newColorInput} onChange={e => setFormData({...formData, newColorInput: e.target.value})} />
                                      <Button type="button" size="sm" variant="secondary" onClick={addBrandColor}>+</Button>
                                  </div>
                              </div>
                              <div>
                                  <Label>Tipografías</Label>
                                  <div className="flex flex-wrap gap-2 mb-2">
                                      {formData.brandFonts.map((f, i) => (
                                          <span key={i} className="text-xs bg-gray-100 px-2 py-1 rounded border border-gray-200 flex items-center gap-1">
                                              {f} <button type="button" onClick={() => {const n=[...formData.brandFonts]; n.splice(i,1); setFormData({...formData, brandFonts: n})}} className="text-gray-400 hover:text-red-500"><Trash2 className="w-3 h-3"/></button>
                                          </span>
                                      ))}
                                  </div>
                                  <div className="flex gap-2">
                                      <Input placeholder="Ej: Poppins" className="h-8 text-xs" value={formData.newFontInput} onChange={e => setFormData({...formData, newFontInput: e.target.value})} />
                                      <Button type="button" size="sm" variant="secondary" onClick={addBrandFont}>+</Button>
                                  </div>
                              </div>
                          </div>
                      </div>

                      {/* Multiple Contacts Section */}
                      <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                          <div className="flex justify-between items-center mb-2">
                              <Label className="mb-0">Contactos Clave</Label>
                              <button type="button" onClick={() => setFormData({...formData, contacts: [...formData.contacts, { id: Date.now().toString(), name: '', role: '' }]})} className="text-xs text-blue-600 font-bold flex items-center"><Plus className="w-3 h-3 mr-1"/> Agregar</button>
                          </div>
                          <div className="space-y-2">
                              {formData.contacts.length === 0 && <p className="text-xs text-gray-400 italic">Sin contactos registrados.</p>}
                              {formData.contacts.map((c, idx) => (
                                  <div key={idx} className="flex gap-2">
                                      <input placeholder="Nombre" className="flex-1 h-9 rounded-lg border border-gray-200 px-2 text-xs" value={c.name} onChange={e => {const n = [...formData.contacts]; n[idx].name = e.target.value; setFormData({...formData, contacts: n})}} />
                                      <input placeholder="Rol (CEO...)" className="w-24 h-9 rounded-lg border border-gray-200 px-2 text-xs" value={c.role} onChange={e => {const n = [...formData.contacts]; n[idx].role = e.target.value; setFormData({...formData, contacts: n})}} />
                                      <button type="button" onClick={() => {const n = [...formData.contacts]; n.splice(idx, 1); setFormData({...formData, contacts: n})}} className="text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4"/></button>
                                  </div>
                              ))}
                          </div>
                      </div>

                      <div className="pt-2"><Button type="submit" className="w-full">Guardar Perfil</Button></div>
                  </form>
              )}

              {/* FEATURE #5: AI MEETING ASSISTANT */}
              {activeTab === 'MEETINGS' && (
                  <div className="space-y-6 animate-in fade-in">
                      <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl">
                          <div className="flex items-center gap-3 mb-2">
                              <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600"><Mic2 className="w-5 h-5"/></div>
                              <div>
                                  <h3 className="font-bold text-indigo-900">Bitácora de Reuniones IA</h3>
                                  <p className="text-xs text-indigo-700">Toma notas rápidas y deja que la IA cree las tareas.</p>
                              </div>
                          </div>
                      </div>

                      <div className="space-y-3">
                          <Label>Notas Crudas de la Llamada</Label>
                          <Textarea 
                              value={meetingNotes} 
                              onChange={e => setMeetingNotes(e.target.value)} 
                              className="min-h-[200px] font-mono text-sm" 
                              placeholder="- Cliente quiere cambiar el logo&#10;- Entregar avances el viernes&#10;- Falta acceso a Google Ads..."
                          />
                          <Button 
                              onClick={processMeetingNotes} 
                              disabled={!meetingNotes || isProcessingMeeting}
                              className="w-full bg-black text-white hover:bg-gray-800"
                          >
                              {isProcessingMeeting ? <Loader2 className="animate-spin mr-2"/> : <ListTodo className="mr-2 w-4 h-4"/>}
                              {isProcessingMeeting ? "Procesando con IA..." : "Generar Minuta y Tareas"}
                          </Button>
                      </div>
                  </div>
              )}

              {/* TAB 2: THE VAULT (RESOURCES) */}
              {activeTab === 'RESOURCES' && (
                  <div className="space-y-4">
                      <div className="flex justify-between items-center">
                          <h3 className="text-sm font-bold text-gray-700">The Vault (Activos)</h3>
                          <button onClick={() => setFormData({...formData, resources: [...formData.resources, { id: Date.now().toString(), name: '', url: '', type: 'OTHER' }]})} className="text-xs bg-black text-white px-2 py-1 rounded-md flex items-center"><Plus className="w-3 h-3 mr-1"/> Link</button>
                      </div>
                      <div className="space-y-2">
                          {formData.resources.map((r, idx) => (
                              <div key={idx} className="flex gap-2 items-center bg-gray-50 p-2 rounded-lg border border-gray-100">
                                  <select className="h-8 bg-white border border-gray-200 rounded text-xs w-24" value={r.type} onChange={e => {const n = [...formData.resources]; n[idx].type = e.target.value as any; setFormData({...formData, resources: n})}}>
                                      <option value="DRIVE">Drive</option><option value="FIGMA">Figma</option><option value="ACCESS">Accesos</option><option value="CONTRACT">Contrato</option><option value="OTHER">Otro</option>
                                  </select>
                                  <input placeholder="Nombre (Ej: Logo)" className="flex-1 h-8 bg-transparent border-b border-gray-300 text-sm focus:border-black outline-none" value={r.name} onChange={e => {const n = [...formData.resources]; n[idx].name = e.target.value; setFormData({...formData, resources: n})}} />
                                  <input placeholder="URL..." className="flex-1 h-8 bg-transparent border-b border-gray-300 text-sm text-blue-600 focus:border-black outline-none" value={r.url} onChange={e => {const n = [...formData.resources]; n[idx].url = e.target.value; setFormData({...formData, resources: n})}} />
                                  {r.url && <a href={r.url} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-blue-600"><ExternalLink className="w-4 h-4"/></a>}
                                  <button onClick={() => {const n = [...formData.resources]; n.splice(idx, 1); setFormData({...formData, resources: n})}} className="text-gray-300 hover:text-red-500"><Trash2 className="w-4 h-4"/></button>
                              </div>
                          ))}
                      </div>
                      <Button onClick={handleSaveProfile} variant="secondary" className="w-full mt-4">Guardar Links</Button>
                  </div>
              )}

              {/* NEW TAB: FINANCE (PROFITABILITY) */}
              {activeTab === 'FINANCE' && (
                  <div className="space-y-6 animate-in fade-in">
                       <div className="grid grid-cols-2 gap-4">
                           <div><Label>Horas Internas (Mes)</Label><Input type="number" value={formData.internalHours} onChange={e => setFormData({...formData, internalHours: e.target.value})} placeholder="0" /></div>
                           <div><Label>Costo Interno ($/hr)</Label><Input type="number" value={formData.internalHourlyRate} onChange={e => setFormData({...formData, internalHourlyRate: e.target.value})} placeholder="25" /></div>
                       </div>
                       
                       <div className="p-4 bg-gray-50 rounded-xl space-y-4 border border-gray-100">
                            <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2"><PieChart className="w-4 h-4"/> Rentabilidad Real</h3>
                            
                            {/* Visual Bar */}
                            <div className="h-4 w-full bg-gray-200 rounded-full overflow-hidden flex">
                                {margin > 0 ? (
                                    <>
                                        <div className="bg-red-400 h-full" style={{ width: `${(outsourcing/revenue)*100}%` }} title="Outsourcing"></div>
                                        <div className="bg-orange-400 h-full" style={{ width: `${(internalCost/revenue)*100}%` }} title="Costo Interno"></div>
                                        <div className="bg-green-500 h-full flex-1" title="Ganancia"></div>
                                    </>
                                ) : (
                                    <div className="bg-gray-300 h-full w-full"></div>
                                )}
                            </div>

                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Ingresos (Fee):</span>
                                    <span className="font-bold text-gray-900">${revenue.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-red-600">
                                    <span>- Outsourcing (Socio):</span>
                                    <span>-${outsourcing.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-orange-600">
                                    <span>- Costo Interno ({formData.internalHours}h):</span>
                                    <span>-${internalCost.toLocaleString()}</span>
                                </div>
                                <div className="border-t border-gray-200 pt-2 flex justify-between items-center">
                                    <span className="font-bold">Ganancia Neta:</span>
                                    <span className={`text-lg font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>${profit.toLocaleString()}</span>
                                </div>
                                <div className="text-right text-xs font-bold text-gray-400 uppercase tracking-widest">Margen: {margin.toFixed(1)}%</div>
                            </div>
                       </div>

                       <Button onClick={handleSaveProfile} className="w-full">Guardar Datos Financieros</Button>
                  </div>
              )}

              {/* NEW TAB: PORTAL (MAGIC LINK) */}
              {activeTab === 'PORTAL' && (
                  <div className="space-y-6 animate-in fade-in">
                      <div className="bg-gradient-to-br from-indigo-50 to-white p-6 rounded-xl border border-indigo-100 text-center">
                          <Globe className="w-10 h-10 text-indigo-500 mx-auto mb-3" />
                          <h3 className="text-lg font-bold text-indigo-900">Portal de Cliente (Guest View)</h3>
                          <p className="text-sm text-indigo-700/80 mb-6">Comparte un enlace de solo lectura para que tu cliente vea el estado, sus links y pagos.</p>
                          
                          {!formData.publicToken ? (
                              <Button onClick={generatePublicToken} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200">
                                  <Sparkles className="w-4 h-4 mr-2"/> Generar Magic Link
                              </Button>
                          ) : (
                              <div className="space-y-3">
                                  <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-gray-200">
                                      <input readOnly value={`${window.location.origin}/#/portal/${formData.publicToken}`} className="flex-1 text-xs text-gray-500 bg-transparent outline-none" />
                                      <button onClick={() => navigator.clipboard.writeText(`${window.location.origin}/#/portal/${formData.publicToken}`)} className="p-1.5 hover:bg-gray-100 rounded text-gray-500"><Copy className="w-4 h-4"/></button>
                                      <a href={`/#/portal/${formData.publicToken}`} target="_blank" className="p-1.5 hover:bg-gray-100 rounded text-blue-600"><ExternalLink className="w-4 h-4"/></a>
                                  </div>
                                  <Button variant="outline" size="sm" onClick={() => { if(confirm("¿Revocar acceso? El link anterior dejará de funcionar.")) setFormData({...formData, publicToken: ''}); }} className="text-red-500 hover:text-red-600 border-red-100 hover:bg-red-50">Revocar Acceso</Button>
                              </div>
                          )}
                      </div>

                      {formData.publicToken && (
                          <div className="bg-white p-4 rounded-xl border border-gray-100 space-y-4">
                              <h3 className="font-bold text-sm text-gray-700">Control de Estado (Vista Cliente)</h3>
                              <div className="space-y-2">
                                  <div className="flex justify-between text-xs font-bold text-gray-500">
                                      <span>Progreso Visible</span>
                                      <span>{formData.progress}%</span>
                                  </div>
                                  <Slider value={formData.progress} min={0} max={100} onChange={e => setFormData({...formData, progress: parseInt(e.target.value)})} />
                                  <p className="text-[10px] text-gray-400">Esto actualiza la barra de progreso que ve el cliente en su portal.</p>
                              </div>
                              <Button onClick={handleSaveProfile} className="w-full">Actualizar Portal</Button>
                          </div>
                      )}
                  </div>
              )}

              {/* TAB 3: STRATEGY & UPSELL */}
              {activeTab === 'STRATEGY' && (
                  <div className="space-y-6">
                      <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl">
                          <h3 className="flex items-center gap-2 font-bold text-indigo-900 mb-2"><Sparkles className="w-4 h-4"/> Oportunidades de Upsell</h3>
                          <p className="text-xs text-indigo-700 mb-4">La IA analizará el rubro y servicios actuales para sugerir ventas cruzadas.</p>
                          {!upsellAnalysis ? (
                              <Button onClick={analyzeUpsell} disabled={isAnalyzingUpsell} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white">
                                  {isAnalyzingUpsell ? <Loader2 className="animate-spin w-4 h-4"/> : "Analizar Oportunidades"}
                              </Button>
                          ) : (
                              <div className="bg-white p-3 rounded-lg text-sm text-gray-700 whitespace-pre-wrap">{upsellAnalysis}</div>
                          )}
                      </div>
                      
                      <div className="bg-gray-50 border border-gray-100 p-4 rounded-xl">
                          <h3 className="flex items-center gap-2 font-bold text-gray-900 mb-2"><MessageCircle className="w-4 h-4"/> Generador de Reportes</h3>
                          <p className="text-xs text-gray-500 mb-4">Crea un mensaje de WhatsApp con las tareas completadas esta semana.</p>
                          {!aiReportText ? (
                              <Button onClick={generateProgressReport} disabled={isGeneratingReport} variant="outline" className="w-full">
                                  {isGeneratingReport ? <Loader2 className="animate-spin w-4 h-4"/> : "Redactar Reporte Semanal"}
                              </Button>
                          ) : (
                              <div className="space-y-2">
                                  <Textarea value={aiReportText} readOnly className="h-32 text-xs"/>
                                  <Button onClick={() => navigator.clipboard.writeText(aiReportText)} size="sm" className="w-full"><Copy className="w-3 h-3 mr-2"/> Copiar Texto</Button>
                              </div>
                          )}
                      </div>
                  </div>
              )}

              {/* TAB 4: PARTNER */}
              {activeTab === 'PARTNER' && (
                  <div className="space-y-6">
                       <div className="grid grid-cols-2 gap-4">
                           <div className="col-span-2"><Label>Socio Asignado</Label><select className="flex h-12 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm" value={formData.assignedPartnerId} onChange={e => setFormData({...formData, assignedPartnerId: e.target.value})}><option value="">-- Interno (Sin Socio) --</option>{contractors.map(c => <option key={c.id} value={c.id}>{c.name} ({c.role})</option>)}</select></div>
                           <div><Label>Costo Outsourcing ($)</Label><Input type="number" value={formData.outsourcingCost} onChange={e => setFormData({...formData, outsourcingCost: e.target.value})} /></div>
                           <div className="flex items-end"><Button onClick={handleSaveProfile} className="w-full">Actualizar Datos</Button></div>
                       </div>
                       
                       <div className="border-t border-gray-100 pt-4">
                           <Label>Contrato Back-to-Back (IA)</Label>
                           {!partnerAgreementText ? (
                               <Button variant="outline" onClick={generatePartnerAgreement} disabled={isGeneratingAgreement} className="w-full mt-2">
                                   {isGeneratingAgreement ? <Loader2 className="animate-spin w-4 h-4"/> : "Generar Orden de Trabajo"}
                               </Button>
                           ) : (
                               <div className="space-y-2 mt-2">
                                   <Textarea value={partnerAgreementText} onChange={e => setPartnerAgreementText(e.target.value)} className="min-h-[150px] text-xs font-mono" />
                                   <Button onClick={() => {}} variant="secondary" className="w-full">Descargar / Copiar</Button>
                               </div>
                           )}
                       </div>
                  </div>
              )}

              {/* TAB 5: HISTORY (TIMELINE) */}
              {activeTab === 'HISTORY' && (
                  <div className="space-y-4">
                      <div className="flex gap-2">
                          <Input value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Nueva nota, llamada o reunión..." className="h-10 text-sm" onKeyDown={e => e.key === 'Enter' && handleAddNote()} />
                          <Button onClick={handleAddNote} size="sm"><ArrowRight className="w-4 h-4" /></Button>
                      </div>
                      
                      <div className="relative border-l-2 border-gray-100 ml-3 space-y-6 pl-6 py-2">
                          {getCombinedTimeline().map((item, idx) => (
                              <div key={idx} className="relative group">
                                  <div className={`absolute -left-[31px] w-4 h-4 rounded-full border-2 border-white shadow-sm ${item.type === 'TASK' ? 'bg-green-500' : 'bg-blue-500'}`}></div>
                                  <p className="text-[10px] text-gray-400 font-mono mb-0.5">{item.date.toLocaleDateString()} {item.date.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>
                                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 text-sm text-gray-700 shadow-sm">
                                      {item.type === 'TASK' ? (
                                          <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-600"/> <span className="line-through opacity-70">{(item.data as any).title}</span></div>
                                      ) : (
                                          <p className="whitespace-pre-line">{(item.data as any).content}</p>
                                      )}
                                  </div>
                              </div>
                          ))}
                          {getCombinedTimeline().length === 0 && <p className="text-xs text-gray-400 italic">No hay actividad reciente.</p>}
                      </div>
                  </div>
              )}
          </div>
      </Modal>
    </div>
  );
}
