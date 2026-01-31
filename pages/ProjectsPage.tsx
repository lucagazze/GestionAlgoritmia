
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/db';
import { Project, ProjectStatus, Contractor, ClientHealth } from '../types';
import { Badge, Button, Input, Modal, Label } from '../components/UIComponents';
import { ContextMenu } from '../components/ContextMenu';
import { 
  Plus, Edit2, User, Search, Filter, Trash2, Columns, Table as TableIcon, Heart, 
  AlertTriangle, ShieldAlert, Ghost, Briefcase, Target
} from 'lucide-react';
import confetti from 'canvas-confetti';

type ViewContext = 'DELIVERY' | 'SALES';

export default function ProjectsPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // View States
  const [viewContext, setViewContext] = useState<ViewContext>('DELIVERY');
  const [viewMode, setViewMode] = useState<'LIST' | 'KANBAN'>('LIST');
  
  // Create Modal State (Only for creation now, editing is full page)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  // Context Menu
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; project: Project | null }>({ x: 0, y: 0, project: null });

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

  const handleCreate = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newProjectName) return;
      const created = await db.projects.create({
          name: newProjectName,
          status: viewContext === 'SALES' ? ProjectStatus.LEAD : ProjectStatus.ONBOARDING,
          monthlyRevenue: 0,
          industry: '',
          billingDay: 1
      });
      setNewProjectName('');
      setIsCreateModalOpen(false);
      navigate(`/projects/${created.id}`); // Jump straight to detail
  };

  const handleContextMenu = (e: React.MouseEvent, project: Project) => {
      e.preventDefault();
      setContextMenu({ x: e.pageX, y: e.pageY, project });
  };

  const handleDragDropStatus = async (projectId: string, newStatus: ProjectStatus) => {
      // 1. Optimistic Update (Immediate UI Change)
      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, status: newStatus } : p));

      // 2. Celebration for Wins
      if (newStatus === ProjectStatus.ONBOARDING) {
          confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#22c55e', '#16a34a', '#dcfce7'] });
      }

      // 3. DB Sync in background
      try {
          await db.projects.update(projectId, { status: newStatus });
      } catch (error) {
          console.error("Failed to update status, reverting", error);
          loadData(); // Revert on error
      }
  };

  const handleDelete = async (id: string) => {
      if(confirm('¿Eliminar proyecto y cliente?')) {
          await db.projects.delete(id);
          setProjects(prev => prev.filter(p => p.id !== id));
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

  const filteredProjects = projects.filter(p => {
      if (!p.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      const salesStages = [ProjectStatus.LEAD, ProjectStatus.DISCOVERY, ProjectStatus.PROPOSAL, ProjectStatus.NEGOTIATION, ProjectStatus.LOST];
      const isSales = salesStages.includes(p.status);
      if (viewContext === 'SALES') return isSales;
      else return !isSales;
  });

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
      let columns: { id: ProjectStatus, title: string, color: string }[] = [];

      if (viewContext === 'SALES') {
          columns = [
              { id: ProjectStatus.LEAD, title: 'Lead', color: 'border-t-4 border-gray-400' },
              { id: ProjectStatus.DISCOVERY, title: 'Discovery', color: 'border-t-4 border-blue-400' },
              { id: ProjectStatus.PROPOSAL, title: 'Propuesta', color: 'border-t-4 border-indigo-400' },
              { id: ProjectStatus.NEGOTIATION, title: 'Negociación', color: 'border-t-4 border-purple-400' },
              { id: ProjectStatus.ONBOARDING, title: 'Ganado', color: 'border-t-4 border-green-400 bg-green-50/30' }, 
          ];
      } else {
          columns = [
              { id: ProjectStatus.ONBOARDING, title: 'Onboarding', color: 'border-t-4 border-blue-500' },
              { id: ProjectStatus.ACTIVE, title: 'Activos', color: 'border-t-4 border-green-500' },
              { id: ProjectStatus.PAUSED, title: 'Pausados', color: 'border-t-4 border-yellow-500' },
              { id: ProjectStatus.COMPLETED, title: 'Completados', color: 'border-t-4 border-gray-500' }
          ];
      }

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
          <div className="flex h-full gap-4 overflow-x-auto pb-4 px-2">
              {columns.map(col => {
                  const colProjects = viewContext === 'SALES' && col.id === ProjectStatus.ONBOARDING 
                     ? [] // Drop target mainly
                     : filteredProjects.filter(p => p.status === col.id);
                  
                  const totalValue = colProjects.reduce((sum, p) => sum + (p.monthlyRevenue || 0), 0);

                  return (
                      <div 
                        key={col.id} 
                        className={`flex-1 min-w-[280px] flex flex-col rounded-2xl bg-gray-50/50 backdrop-blur-sm border border-gray-200/60 ${col.color}`}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => handleDrop(e, col.id)}
                      >
                          <div className="p-4 flex justify-between items-center">
                              <span className="font-bold text-gray-700 text-sm tracking-tight">{col.title} <span className="text-gray-400 font-normal">({colProjects.length})</span></span>
                              {viewContext === 'SALES' && totalValue > 0 && <span className="text-[10px] font-mono text-gray-500 bg-white px-2 py-1 rounded-md border shadow-sm">${totalValue.toLocaleString()}</span>}
                          </div>

                          <div className="px-3 pb-3 space-y-3 flex-1 overflow-y-auto custom-scrollbar">
                              {col.id === ProjectStatus.ONBOARDING && viewContext === 'SALES' ? (
                                  <div className="h-full flex flex-col items-center justify-center text-green-600/50 border-2 border-dashed border-green-200 rounded-xl m-2 bg-green-50/20">
                                      <p className="text-xs font-bold uppercase tracking-widest text-center">Soltar para<br/>Cerrar Venta</p>
                                  </div>
                              ) : (
                                  colProjects.map(p => {
                                      const ghostStatus = getGhostingStatus(p.lastContactDate);
                                      return (
                                          <div 
                                            key={p.id} 
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, p.id)}
                                            onClick={() => navigate(`/projects/${p.id}`)}
                                            className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-lg hover:scale-[1.02] hover:border-gray-200 cursor-pointer transition-all duration-200 group relative active:cursor-grabbing"
                                          >
                                              {ghostStatus === 'GHOSTING' && viewContext === 'DELIVERY' && (
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
                                                  {viewContext === 'DELIVERY' && (
                                                      <div className={`w-2.5 h-2.5 rounded-full ${isPaymentCurrent(p) ? 'bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]' : 'bg-red-400 animate-pulse'}`}></div>
                                                  )}
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
             <div className="bg-gray-100 p-1 rounded-xl flex shadow-inner">
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
                     <button onClick={() => setViewMode('LIST')} className={`p-1.5 rounded-md transition-all ${viewMode === 'LIST' ? 'bg-white shadow text-black' : 'text-gray-400'}`}><TableIcon className="w-4 h-4"/></button>
                     <button onClick={() => setViewMode('KANBAN')} className={`p-1.5 rounded-md transition-all ${viewMode === 'KANBAN' ? 'bg-white shadow text-black' : 'text-gray-400'}`}><Columns className="w-4 h-4"/></button>
                 </div>
             )}
             <div className="relative flex-1 md:w-64"><Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" /><Input placeholder={viewContext === 'SALES' ? "Buscar lead..." : "Buscar cliente..."} className="pl-9 h-10 bg-white" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
            <Button onClick={() => setIsCreateModalOpen(true)} className="shadow-lg shadow-black/10"><Plus className="w-4 h-4 mr-2" /> {viewContext === 'SALES' ? 'Nuevo Lead' : 'Nuevo Cliente'}</Button>
        </div>
      </div>

      {/* --- CONTENT AREA --- */}
      {viewMode === 'KANBAN' ? <KanbanBoard /> : (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm flex-1 flex flex-col">
              <div className="overflow-x-auto flex-1">
                  <table className="w-full text-sm text-left">
                      <thead className="bg-gray-50/50 text-gray-500 font-medium border-b border-gray-100 uppercase text-xs tracking-wider sticky top-0 z-10 backdrop-blur-sm">
                          <tr><th className="px-6 py-4">Cliente</th><th className="px-6 py-4">Estado</th><th className="px-6 py-4 text-right">Fee</th><th className="px-6 py-4 text-center">Salud</th><th className="px-6 py-4 text-center">Pago (Mes)</th><th className="px-6 py-4 text-center"></th></tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                          {isLoading ? (<tr><td colSpan={6} className="text-center py-20 text-gray-400"><div className="animate-pulse">Cargando...</div></td></tr>) : 
                              filteredProjects.map((p) => {
                                  const paid = isPaymentCurrent(p);
                                  const ghostStatus = getGhostingStatus(p.lastContactDate);
                                  return (
                                      <tr key={p.id} onClick={() => navigate(`/projects/${p.id}`)} onContextMenu={(e) => handleContextMenu(e, p)} className="hover:bg-gray-50 transition-colors cursor-pointer group">
                                          <td className="px-6 py-4">
                                              <div className="flex flex-col">
                                                  <div className="flex items-center gap-2">
                                                      <span className="font-bold text-gray-900 text-base">{p.name}</span>
                                                      {ghostStatus === 'GHOSTING' && <span title="Ghosting Alert: +7 días sin contacto" className="text-red-500 bg-red-50 p-0.5 rounded"><Ghost className="w-3 h-3"/></span>}
                                                  </div>
                                                  <span className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5"><User className="w-3 h-3"/> {p.partnerName || 'In-house'}</span>
                                              </div>
                                          </td>
                                          <td className="px-6 py-4"><Badge variant={p.status === ProjectStatus.ACTIVE ? 'green' : 'outline'}>{p.status}</Badge></td>
                                          <td className="px-6 py-4 text-right font-mono font-medium text-gray-700">${p.monthlyRevenue.toLocaleString()}</td>
                                          <td className="px-6 py-4 text-center flex justify-center">{renderHealthBadge(p.healthScore || 'GOOD')}</td>
                                          <td className="px-6 py-4 text-center">
                                              <span className={`px-3 py-1 rounded-full text-xs font-bold border ${paid ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-600 border-red-100'}`}>
                                                  {paid ? 'PAGADO' : 'PENDIENTE'}
                                              </span>
                                          </td>
                                          <td className="px-6 py-4 text-center"><button onClick={(e) => {e.stopPropagation(); navigate(`/projects/${p.id}`);}} className="p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-black transition-all"><Edit2 className="w-4 h-4" /></button></td>
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

      {/* Simple Creation Modal */}
      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title={viewContext === 'SALES' ? 'Nuevo Lead' : 'Nuevo Cliente'}>
          <form onSubmit={handleCreate} className="space-y-4">
              <div>
                  <Label>Nombre de la Empresa</Label>
                  <Input value={newProjectName} onChange={e => setNewProjectName(e.target.value)} placeholder="Ej: Acme Corp" autoFocus />
              </div>
              <div className="flex justify-end pt-2">
                  <Button type="submit">Crear y Abrir</Button>
              </div>
          </form>
      </Modal>
    </div>
  );
}
