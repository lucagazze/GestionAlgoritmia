
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/db';
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
  const [projects, setProjects] = useState<Project[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // View States
  const [viewMode, setViewMode] = useState<'LIST' | 'KANBAN'>('LIST');
  
  // Create Modal State
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
          status: ProjectStatus.ONBOARDING,
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
      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, status: newStatus } : p));
      if (newStatus === ProjectStatus.ACTIVE) {
          confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#22c55e', '#16a34a', '#dcfce7'] });
      }
      try {
          await db.projects.update(projectId, { status: newStatus });
      } catch (error) {
          console.error("Failed to update status, reverting", error);
          loadData();
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
      // Filter out Sales statuses (Lead, Discovery, etc.) if they exist in DB
      const activeStages = [ProjectStatus.ONBOARDING, ProjectStatus.ACTIVE, ProjectStatus.PAUSED, ProjectStatus.COMPLETED];
      return activeStages.includes(p.status);
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
          <div className="flex h-full gap-4 overflow-x-auto pb-4 px-2">
              {columns.map(col => {
                  const colProjects = filteredProjects.filter(p => p.status === col.id);
                  
                  return (
                      <div 
                        key={col.id} 
                        className={`flex-1 min-w-[280px] flex flex-col rounded-2xl bg-gray-50/50 backdrop-blur-sm border border-gray-200/60 ${col.color}`}
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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 px-2 flex-shrink-0">
        <div>
            <h1 className="text-2xl font-bold text-gray-900">Clientes & Operaciones</h1>
            <p className="text-sm text-gray-500">Gestión de proyectos activos y entregables.</p>
        </div>
        
        <div className="flex gap-2 w-full md:w-auto items-center">
             <div className="bg-gray-100 p-1 rounded-lg flex mr-2">
                 <button onClick={() => setViewMode('LIST')} className={`p-1.5 rounded-md transition-all ${viewMode === 'LIST' ? 'bg-white shadow text-black' : 'text-gray-400'}`}><TableIcon className="w-4 h-4"/></button>
                 <button onClick={() => setViewMode('KANBAN')} className={`p-1.5 rounded-md transition-all ${viewMode === 'KANBAN' ? 'bg-white shadow text-black' : 'text-gray-400'}`}><Columns className="w-4 h-4"/></button>
             </div>
             <div className="relative flex-1 md:w-64"><Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" /><Input placeholder="Buscar cliente..." className="pl-9 h-10 bg-white" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
            <Button onClick={() => setIsCreateModalOpen(true)} className="shadow-lg shadow-black/10"><Plus className="w-4 h-4 mr-2" /> Nuevo Cliente</Button>
        </div>
      </div>

      {/* --- CONTENT AREA --- */}
      {viewMode === 'KANBAN' ? <KanbanBoard /> : (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm flex-1 flex flex-col min-h-0">
              <div className="overflow-auto flex-1">
                  <table className="w-full text-sm text-left">
                      <thead className="bg-gray-50/50 text-gray-500 font-medium border-b border-gray-100 uppercase text-xs tracking-wider sticky top-0 z-10 backdrop-blur-sm">
                          <tr><th className="px-6 py-4">Cliente</th><th className="px-6 py-4">Estado</th><th className="px-6 py-4 text-right">Fee (Mes)</th><th className="px-6 py-4 text-center">Salud</th><th className="px-6 py-4 text-center">Pago</th><th className="px-6 py-4 text-center"></th></tr>
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

      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Nuevo Cliente">
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
