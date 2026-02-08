
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/db';
import { useProjects } from '../hooks/queries/useProjects';
import { Project, ProjectStatus, Contractor, ClientHealth } from '../types';
import { Badge, Button, Input, Modal, Label } from '../components/UIComponents';
import { ContextMenu } from '../components/ContextMenu';
import { 
  Plus, Edit2, User, Search, Trash2, Columns, Table as TableIcon, Heart, 
  AlertTriangle, ShieldAlert, Ghost, Info
} from 'lucide-react';
import confetti from 'canvas-confetti';

export default function ProjectsPage() {
  const navigate = useNavigate();
  const { projects, isLoading, createProject, updateStatus, archiveProject } = useProjects();
  const [searchTerm, setSearchTerm] = useState('');
  
  // View States
  const [viewMode, setViewMode] = useState<'LIST' | 'KANBAN'>('LIST');
  
  // Create Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  
  // ✅ New Client Fields
  const [newClientData, setNewClientData] = useState({
      industry: '',
      location: '',
      email: '',
      phone: ''
  });
  
  const [newClientContext, setNewClientContext] = useState({
      targetAudience: '',
      currentSituation: '', // problem
      objective: ''        // objectives
  });

  // Context Menu
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; project: Project | null }>({ x: 0, y: 0, project: null });

  const handleCreate = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newProjectName) return;
      try {
        // 1. Create Client
        const created = await createProject({
            name: newProjectName,
            status: ProjectStatus.ONBOARDING,
            monthlyRevenue: 0,
            industry: newClientData.industry,
            billingDay: 1,
            email: newClientData.email,
            phone: newClientData.phone,
            notes: newClientData.location ? `Ubicación: ${newClientData.location}` : '' // Fallback for location
        });

        // 2. Create Profile (Context)
        if (newClientContext.targetAudience || newClientContext.currentSituation || newClientContext.objective) {
            await db.clientProfiles.upsert(created.id, {
                targetAudience: newClientContext.targetAudience,
                problem: newClientContext.currentSituation,
                objectives: newClientContext.objective
            });
        }

        // Reset
        setNewProjectName('');
        setNewClientData({ industry: '', location: '', email: '', phone: '' });
        setNewClientContext({ targetAudience: '', currentSituation: '', objective: '' });
        
        setIsCreateModalOpen(false);
        navigate(`/projects/${created.id}`); // Jump straight to detail
      } catch (error) {
        console.error("Failed to create project", error);
      }
  };

  const handleContextMenu = (e: React.MouseEvent, project: Project) => {
      e.preventDefault();
      setContextMenu({ x: e.pageX, y: e.pageY, project });
  };

  const handleDragDropStatus = async (projectId: string, newStatus: ProjectStatus) => {
      // Optimistic-like UI: The hook will invalidate and refresh. 
      // For true optimistic UI, we would implement onMutate in the hook, 
      // but usually Supabase is fast enough that the flicker is minimal.
      // We keep the confetti for instant gratification.
      if (newStatus === ProjectStatus.ACTIVE) {
          confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#22c55e', '#16a34a', '#dcfce7'] });
      }
      try {
          await updateStatus({ id: projectId, status: newStatus });
      } catch (error) {
          console.error("Failed to update status", error);
      }
  };

  const handleDelete = async (id: string) => {
      // Cambiamos el mensaje para que sea claro que se archiva
      if(confirm('¿Archivar este proyecto? Desaparecerá de la lista activa.')) {
          // ✅ Soft Delete: Actualizamos estado en vez de borrar
          await archiveProject(id);
          // No need to manually update local state, Query will refetch
      }
  }

  // --- HELPERS ---
  const isPaymentCurrent = (p: Project) => {
      if (!p.lastPaymentDate) return false;
      const last = new Date(p.lastPaymentDate);
      const now = new Date();
      return last.getMonth() === now.getMonth() && last.getFullYear() === now.getFullYear();
  };

  const getGhostingStatus = (lastContactDate?: string) => {
      if (!lastContactDate) return 'UNKNOWN';
      const diffTime = Math.abs(new Date().getTime() - new Date(lastContactDate).getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
      if (diffDays > 7) return 'GHOSTING';
      return 'OK';
  };

  const filteredProjects = React.useMemo(() => {
    return projects.filter(p => {
      if (!p.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      // Filter out Sales statuses (Lead, Discovery, etc.) if they exist in DB
      const activeStages = [ProjectStatus.ONBOARDING, ProjectStatus.ACTIVE, ProjectStatus.PAUSED, ProjectStatus.COMPLETED];
      return activeStages.includes(p.status);
    });
  }, [projects, searchTerm]);

  const renderHealthBadge = (health: ClientHealth) => {
      switch(health) {
          case 'GOOD': return <span className="flex items-center text-green-600 gap-1 text-xs font-bold bg-green-50 px-2 py-1 rounded-full"><Heart className="w-3 h-3 fill-green-600"/> Sano</span>;
          case 'RISK': return <span className="flex items-center text-yellow-600 gap-1 text-xs font-bold bg-yellow-50 px-2 py-1 rounded-full"><AlertTriangle className="w-3 h-3"/> Riesgo</span>;
          case 'CRITICAL': return <span className="flex items-center text-red-600 gap-1 text-xs font-bold bg-red-50 px-2 py-1 rounded-full"><ShieldAlert className="w-3 h-3"/> Crítico</span>;
          default: return null;
      }
  };

  // --- KANBAN BOARD ---
  const KanbanBoard = () => {
      const columns = [
          { id: ProjectStatus.ONBOARDING, title: 'Onboarding', color: 'border-t-4 border-blue-500', tooltip: 'En proceso de setup inicial.' },
          { id: ProjectStatus.ACTIVE, title: 'Activos', color: 'border-t-4 border-green-500', tooltip: 'Clientes pagando fee mensual (Running).' },
          { id: ProjectStatus.PAUSED, title: 'Pausados', color: 'border-t-4 border-yellow-500', tooltip: 'Suspendidos temporalmente.' },
          { id: ProjectStatus.COMPLETED, title: 'Completados', color: 'border-t-4 border-gray-500', tooltip: 'Proyectos one-off finalizados.' }
      ];

      const handleDragStart = (e: React.DragEvent, id: string) => {
          e.dataTransfer.setData('projectId', id);
          e.dataTransfer.effectAllowed = 'move';
      };

      const handleDrop = (e: React.DragEvent, status: ProjectStatus) => {
          e.preventDefault();
          const id = e.dataTransfer.getData('projectId');
          if (id) handleDragDropStatus(id, status);
      };

      return (
          <div className="flex h-full gap-4 overflow-x-auto pb-4 px-2 snap-x snap-mandatory">
              {columns.map(col => {
                  const colProjects = filteredProjects.filter(p => p.status === col.id);
                  
                  return (
                      <div 
                        key={col.id} 
                        className={`flex-1 min-w-[280px] md:min-w-[320px] snap-center flex flex-col rounded-2xl bg-gray-50/50 backdrop-blur-sm border border-gray-200/60 ${col.color}`}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => handleDrop(e, col.id as ProjectStatus)}
                      >
                          <div className="p-3 flex justify-between items-center group/header">
                              <div className="flex items-center gap-1">
                                  <span className="font-bold text-gray-700 text-xs tracking-tight uppercase">{col.title} <span className="text-gray-400 font-normal ml-1">({colProjects.length})</span></span>
                                  <div className="relative group/tooltip">
                                      <Info className="w-3 h-3 text-gray-300 hover:text-gray-500 cursor-help" />
                                      <div className="absolute left-0 top-full mt-1 w-32 p-2 bg-black text-white text-[10px] rounded-lg opacity-0 group-hover/tooltip:opacity-100 transition-opacity z-10 pointer-events-none">{col.tooltip}</div>
                                  </div>
                              </div>
                          </div>

                          <div className="px-3 pb-3 space-y-3 flex-1 overflow-y-auto custom-scrollbar">
                              {colProjects.map(p => {
                                  const ghostStatus = getGhostingStatus(p.lastContactDate);
                                  return (
                                      <div 
                                        key={p.id} 
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, p.id)}
                                        onClick={() => navigate(`/projects/${p.id}`)}
                                        className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-lg hover:scale-[1.02] hover:border-gray-200 cursor-pointer transition-all duration-200 group relative active:cursor-grabbing"
                                      >
                                          {ghostStatus === 'GHOSTING' && (
                                              <div className="absolute top-3 right-3 text-red-500 animate-pulse" title="Cliente descuidado (+7 días sin contacto)">
                                                  <Ghost className="w-4 h-4"/>
                                              </div>
                                          )}
                                          <div className="flex justify-between items-start mb-3 pr-6">
                                              <span className="font-bold text-gray-900 text-sm">{p.name}</span>
                                          </div>
                                          <div className="flex justify-between items-end">
                                              <div className="flex flex-col">
                                                  <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider mb-0.5">{p.industry || 'General'}</span>
                                                  <span className="text-sm text-gray-700 font-mono font-bold">${p.monthlyRevenue.toLocaleString()}</span>
                                              </div>
                                              <div className={`w-2.5 h-2.5 rounded-full ${isPaymentCurrent(p) ? 'bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]' : 'bg-red-400 animate-pulse'}`}></div>
                                          </div>
                                      </div>
                                  )
                              })}
                          </div>
                      </div>
                  );
              })}
          </div>
      );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-4 h-[calc(100vh-100px)] flex flex-col">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 px-2 flex-shrink-0">
        <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Clientes & Operaciones</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Gestión de proyectos activos y entregables.</p>
        </div>
        
        <div className="flex flex-col md:flex-row gap-3 w-full xl:w-auto items-stretch md:items-center">
             <div className="bg-gray-100 dark:bg-slate-800 p-1 rounded-lg flex self-start md:self-auto">
                 <button onClick={() => setViewMode('LIST')} className={`p-1.5 rounded-md transition-all ${viewMode === 'LIST' ? 'bg-white dark:bg-slate-700 shadow text-black dark:text-white' : 'text-gray-400'}`}><TableIcon className="w-4 h-4"/></button>
                 <button onClick={() => setViewMode('KANBAN')} className={`p-1.5 rounded-md transition-all ${viewMode === 'KANBAN' ? 'bg-white dark:bg-slate-700 shadow text-black dark:text-white' : 'text-gray-400'}`}><Columns className="w-4 h-4"/></button>
             </div>
             <div className="relative flex-1 md:w-64"><Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" /><Input placeholder="Buscar cliente..." className="pl-9 h-10 bg-white dark:bg-slate-800" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
            <Button onClick={() => setIsCreateModalOpen(true)} className="shadow-lg shadow-black/10 dark:shadow-white/5"><Plus className="w-4 h-4 mr-2" /> Nuevo Cliente</Button>
        </div>
      </div>

      {/* --- CONTENT AREA --- */}
      {viewMode === 'KANBAN' ? <KanbanBoard /> : (
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm flex-1 flex flex-col min-h-0">
              <div className="overflow-auto flex-1 custom-scrollbar">
                  <table className="w-full text-sm text-left min-w-[800px]">
                      <thead className="bg-gray-50/50 dark:bg-slate-800/50 text-gray-500 dark:text-gray-400 font-medium border-b border-gray-100 dark:border-slate-800 uppercase text-[10px] tracking-wider sticky top-0 z-10 backdrop-blur-sm">
                          <tr><th className="px-4 py-2">Cliente</th><th className="px-4 py-2">Estado</th><th className="px-4 py-2 text-right">Fee (Mes)</th><th className="px-4 py-2 text-center">Salud</th><th className="px-4 py-2 text-center">Pago</th><th className="px-4 py-2 text-center"></th></tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 dark:divide-slate-800">
                          {isLoading ? (<tr><td colSpan={6} className="text-center py-20 text-gray-400"><div className="animate-pulse">Cargando...</div></td></tr>) : 
                              filteredProjects.map((p) => {
                                  const paid = isPaymentCurrent(p);
                                  const ghostStatus = getGhostingStatus(p.lastContactDate);
                                  return (
                                      <tr key={p.id} onClick={() => navigate(`/projects/${p.id}`)} onContextMenu={(e) => handleContextMenu(e, p)} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group">
                                          <td className="px-4 py-2">
                                              <div className="flex flex-col">
                                                  <div className="flex items-center gap-2">
                                                      <span className="font-bold text-gray-900 dark:text-white text-sm">{p.name}</span>
                                                      {ghostStatus === 'GHOSTING' && <span title="Ghosting Alert: +7 días sin contacto" className="text-red-500 bg-red-50 dark:bg-red-900/30 p-0.5 rounded"><Ghost className="w-3 h-3"/></span>}
                                                  </div>
                                                  <span className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5"><User className="w-3 h-3"/> {p.partnerName || 'In-house'}</span>
                                              </div>
                                          </td>
                                          <td className="px-4 py-2"><Badge variant={p.status === ProjectStatus.ACTIVE ? 'green' : 'outline'} className="text-[10px] px-1.5 py-0">{p.status}</Badge></td>
                                          <td className="px-4 py-2 text-right font-mono font-medium text-gray-700 dark:text-gray-300 text-xs">${p.monthlyRevenue.toLocaleString()}</td>
                                          <td className="px-4 py-2 text-center flex justify-center scale-90">{renderHealthBadge(p.healthScore || 'GOOD')}</td>
                                          <td className="px-4 py-2 text-center">
                                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${paid ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 border-red-100 dark:border-red-800'}`}>
                                                  {paid ? 'PAGADO' : 'PENDIENTE'}
                                              </span>
                                          </td>
                                          <td className="px-4 py-2 text-center"><button onClick={(e) => {e.stopPropagation(); navigate(`/projects/${p.id}`);}} className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400 hover:text-black dark:hover:text-white transition-all"><Edit2 className="w-3 h-3" /></button></td>
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
            { label: 'Abrir Expediente', icon: Edit2, onClick: () => contextMenu.project && navigate(`/projects/${contextMenu.project.id}`) },
            { label: 'Eliminar', icon: Trash2, variant: 'destructive', onClick: () => contextMenu.project && handleDelete(contextMenu.project.id) }
        ]}
      />

      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Nuevo Cliente">
          <form onSubmit={handleCreate} className="space-y-4 max-h-[80vh] overflow-y-auto px-1">
              
              <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                      <Label>Nombre de la Empresa *</Label>
                      <Input value={newProjectName} onChange={e => setNewProjectName(e.target.value)} placeholder="Ej: Acme Corp" autoFocus required />
                  </div>
                  
                  <div>
                      <Label>Rubro / Industria</Label>
                      <Input value={newClientData.industry} onChange={e => setNewClientData({...newClientData, industry: e.target.value})} placeholder="Ej: SaaS, Inmobiliaria" />
                  </div>
                  <div>
                      <Label>Ubicación</Label>
                      <Input value={newClientData.location} onChange={e => setNewClientData({...newClientData, location: e.target.value})} placeholder="Ej: Buenos Aires, AR" />
                  </div>
                  
                  <div>
                      <Label>Email de Contacto</Label>
                      <Input type="email" value={newClientData.email} onChange={e => setNewClientData({...newClientData, email: e.target.value})} placeholder="contacto@cliente.com" />
                  </div>
                  <div>
                      <Label>Teléfono</Label>
                      <Input type="tel" value={newClientData.phone} onChange={e => setNewClientData({...newClientData, phone: e.target.value})} placeholder="+54 9 11..." />
                  </div>
              </div>

              <div className="border-t border-gray-100 pt-4 mt-4">
                  <h3 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                      <ShieldAlert className="w-3 h-3 text-blue-500"/> Contexto Estratégico
                  </h3>
                  <div className="space-y-3">
                      <div>
                          <Label>Público Objetivo</Label>
                          <Input value={newClientContext.targetAudience} onChange={e => setNewClientContext({...newClientContext, targetAudience: e.target.value})} placeholder="¿A quién le venden? Ej: Dueños de PyMEs..." />
                      </div>
                      <div>
                          <Label>Situación Actual (Dolores)</Label>
                          <Input value={newClientContext.currentSituation} onChange={e => setNewClientContext({...newClientContext, currentSituation: e.target.value})} placeholder="¿Qué problemas tienen hoy?" />
                      </div>
                      <div>
                          <Label>Objetivo Principal</Label>
                          <Input value={newClientContext.objective} onChange={e => setNewClientContext({...newClientContext, objective: e.target.value})} placeholder="¿Qué quieren lograr?" />
                      </div>
                  </div>
              </div>

              <div className="flex justify-end pt-2">
                  <Button type="submit">Crear Cliente</Button>
              </div>
          </form>
      </Modal>
    </div>
  );
}
