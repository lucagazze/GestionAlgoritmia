
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/db';
import { ai } from '../services/ai';
import { useProjects } from '../hooks/queries/useProjects';
import { Project, ProjectStatus, Contractor, ClientHealth } from '../types';
import { Badge, Button, Input, Label, Textarea } from '../components/UIComponents';
import { ContextMenu } from '../components/ContextMenu';
import { 
  Plus, Edit2, User, Search, Trash2, Columns, Table as TableIcon, Heart, 
  AlertTriangle, ShieldAlert, Ghost, Info, Sparkles, Loader2
} from 'lucide-react';
import confetti from 'canvas-confetti';

export default function ProjectsPage() {
  const navigate = useNavigate();
  const { projects, isLoading, createProject, updateStatus, archiveProject } = useProjects();
  const [searchTerm, setSearchTerm] = useState('');
  
  // View States
  const [viewMode, setViewMode] = useState<'LIST' | 'KANBAN'>('LIST');

  // Context Menu
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; project: Project | null }>({ x: 0, y: 0, project: null });

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
          case 'GOOD':     return <span className="flex items-center text-emerald-600 dark:text-emerald-400 gap-1 text-[10px] font-bold bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-[6px]"><Heart className="w-3 h-3 fill-emerald-600 dark:fill-emerald-400"/> Sano</span>;
          case 'RISK':     return <span className="flex items-center text-amber-600 dark:text-amber-400 gap-1 text-[10px] font-bold bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 rounded-[6px]"><AlertTriangle className="w-3 h-3"/> Riesgo</span>;
          case 'CRITICAL': return <span className="flex items-center text-red-600 dark:text-red-400 gap-1 text-[10px] font-bold bg-red-50 dark:bg-red-500/10 px-2 py-0.5 rounded-[6px]"><ShieldAlert className="w-3 h-3"/> Crítico</span>;
          default: return null;
      }
  };

  // --- KANBAN BOARD ---
  const KanbanBoard = () => {
      const columns = [
          { id: ProjectStatus.ONBOARDING, title: 'Onboarding', accent: 'bg-blue-500', tooltip: 'En proceso de setup inicial.' },
          { id: ProjectStatus.ACTIVE, title: 'Activos', accent: 'bg-emerald-500', tooltip: 'Clientes pagando fee mensual.' },
          { id: ProjectStatus.PAUSED, title: 'Pausados', accent: 'bg-amber-400', tooltip: 'Suspendidos temporalmente.' },
          { id: ProjectStatus.COMPLETED, title: 'Completados', accent: 'bg-zinc-400', tooltip: 'Proyectos one-off finalizados.' }
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
                        className="flex-1 min-w-[260px] md:min-w-[300px] snap-center flex flex-col rounded-2xl bg-zinc-50/80 dark:bg-zinc-800/30 border border-zinc-200/60 dark:border-zinc-700/40 overflow-hidden"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => handleDrop(e, col.id as ProjectStatus)}
                      >
                          <div className={`h-[3px] ${col.accent}`} />
                          <div className="px-3 py-2.5 flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-[0.06em]">{col.title}</span>
                            <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500">{colProjects.length}</span>
                          </div>

                          <div className="px-2 pb-3 space-y-2 flex-1 overflow-y-auto">
                              {colProjects.map(p => {
                                  const ghostStatus = getGhostingStatus(p.lastContactDate);
                                  return (
                                      <div
                                        key={p.id}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, p.id)}
                                        onClick={() => navigate(`/projects/${p.id}`)}
                                        className="bg-white dark:bg-zinc-900 p-3.5 rounded-[12px] border border-black/[0.04] dark:border-white/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.1)] hover:-translate-y-0.5 cursor-pointer transition-all duration-200 relative active:cursor-grabbing"
                                      >
                                          {ghostStatus === 'GHOSTING' && (
                                              <div className="absolute top-3 right-3 text-amber-500" title="+7 días sin contacto">
                                                  <Ghost className="w-3.5 h-3.5"/>
                                              </div>
                                          )}
                                          <div className="mb-2 pr-5">
                                              <span className="font-semibold text-zinc-900 dark:text-white text-[13px] tracking-[-0.01em]">{p.name}</span>
                                          </div>
                                          <div className="flex justify-between items-end">
                                              <div>
                                                  <span className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider block">{p.industry || 'General'}</span>
                                                  <span className="text-[13px] text-zinc-700 dark:text-zinc-300 font-semibold">${p.monthlyRevenue.toLocaleString()}</span>
                                              </div>
                                              <div className={`w-2 h-2 rounded-full ${isPaymentCurrent(p) ? 'bg-emerald-400' : 'bg-red-400'}`}/>
                                          </div>
                                      </div>
                                  );
                              })}
                          </div>
                      </div>
                  );
              })}
          </div>
      );
  };

  return (
    <div className="space-y-5 pb-4 h-[calc(100vh-100px)] flex flex-col">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 flex-shrink-0">
        <div>
          <h1 className="text-[26px] font-bold tracking-[-0.03em] text-zinc-900 dark:text-white">Clientes</h1>
          <p className="text-[14px] text-zinc-400 dark:text-zinc-500 mt-0.5 font-medium">Gestión de proyectos activos y entregables.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2.5 w-full xl:w-auto items-stretch sm:items-center">
          <div className="bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-[10px] flex gap-0.5 self-start">
            <button onClick={() => setViewMode('LIST')} className={`p-2 rounded-[8px] transition-all ${viewMode === 'LIST' ? 'bg-white dark:bg-zinc-700 shadow-[0_1px_3px_rgba(0,0,0,0.1)] text-zinc-900 dark:text-white' : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'}`}><TableIcon className="w-4 h-4"/></button>
            <button onClick={() => setViewMode('KANBAN')} className={`p-2 rounded-[8px] transition-all ${viewMode === 'KANBAN' ? 'bg-white dark:bg-zinc-700 shadow-[0_1px_3px_rgba(0,0,0,0.1)] text-zinc-900 dark:text-white' : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'}`}><Columns className="w-4 h-4"/></button>
          </div>
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
            <input placeholder="Buscar cliente..." className="w-full pl-9 pr-4 h-10 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-[10px] text-[13px] text-zinc-700 dark:text-zinc-300 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-black/[0.08] dark:focus:ring-white/[0.08] transition-all" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
          <button onClick={() => navigate('/projects/new')} className="flex items-center justify-center gap-2 h-10 px-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-[13px] font-semibold rounded-[10px] shadow-[0_1px_3px_rgba(0,0,0,0.15)] hover:bg-black dark:hover:bg-zinc-100 active:scale-[0.97] transition-all">
            <Plus className="w-4 h-4" /> Nuevo Cliente
          </button>
        </div>
      </div>

      {/* --- CONTENT AREA --- */}
      {viewMode === 'KANBAN' ? <KanbanBoard /> : (
          <div className="bg-white dark:bg-zinc-900 border border-black/[0.04] dark:border-white/[0.06] rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.06)] flex-1 flex flex-col min-h-0">
              <div className="overflow-auto flex-1">
                  <table className="w-full text-sm text-left min-w-[800px]">
                      <thead className="bg-zinc-50/80 dark:bg-zinc-800/60 text-zinc-500 dark:text-zinc-500 border-b border-zinc-100 dark:border-zinc-800 uppercase text-[10px] tracking-[0.06em] font-semibold sticky top-0 z-10 backdrop-blur-sm">
                          <tr><th className="px-5 py-3">Cliente</th><th className="px-5 py-3">Estado</th><th className="px-5 py-3 text-right">Fee / mes</th><th className="px-5 py-3 text-center">Salud</th><th className="px-5 py-3 text-center">Pago</th><th className="px-5 py-3"></th></tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/50">
                          {isLoading ? (<tr><td colSpan={6} className="text-center py-20 text-zinc-400"><div className="animate-pulse">Cargando...</div></td></tr>) : 
                              filteredProjects.map((p) => {
                                  const getPaymentInfo = (proj: Project) => {
                                      // 1. Check if paid this month
                                      if (proj.lastPaymentDate) {
                                          const last = new Date(proj.lastPaymentDate);
                                          const now = new Date();
                                          if (last.getMonth() === now.getMonth() && last.getFullYear() === now.getFullYear()) {
                                              return { label: 'PAGADO', className: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800' };
                                          }
                                      }
                                      
                                      // 2. Check if Overdue
                                      const today = new Date().getDate();
                                      const billingDay = proj.billingDay || 1;
                                      
                                      if (today > billingDay) {
                                          return { label: 'VENCIDO', className: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800 animate-pulse' };
                                      } else if (today === billingDay) {
                                           return { label: 'VENCE HOY', className: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800' };
                                      } else {
                                          return { label: 'PENDIENTE', className: 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700' };
                                      }
                                  };

                                  const paymentStatus = getPaymentInfo(p);
                                  const ghostStatus = getGhostingStatus(p.lastContactDate);
                                  return (
                                      <tr key={p.id} onClick={() => navigate(`/projects/${p.id}`)} onContextMenu={(e) => handleContextMenu(e, p)} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/30 transition-colors cursor-pointer group">
                                          <td className="px-5 py-3">
                                              <div className="flex flex-col">
                                                  <div className="flex items-center gap-2">
                                                      <span className="font-semibold text-zinc-900 dark:text-white text-[13px] tracking-[-0.01em]">{p.name}</span>
                                                      {ghostStatus === 'GHOSTING' && <span title="+7 días sin contacto" className="text-amber-500 bg-amber-50 dark:bg-amber-500/10 p-0.5 rounded-[4px]"><Ghost className="w-3 h-3"/></span>}
                                                  </div>
                                                  <span className="text-[11px] text-zinc-400 flex items-center gap-1 mt-0.5"><User className="w-3 h-3"/> {p.partnerName || 'In-house'}</span>
                                              </div>
                                          </td>
                                          <td className="px-5 py-3"><Badge variant={p.status === ProjectStatus.ACTIVE ? 'green' : 'outline'} className="text-[10px] px-1.5 py-0">{p.status}</Badge></td>
                                          <td className="px-5 py-3 text-right font-medium text-zinc-700 dark:text-zinc-300 text-[13px]">${p.monthlyRevenue.toLocaleString()}</td>
                                          <td className="px-5 py-3 text-center"><div className="flex justify-center">{renderHealthBadge(p.healthScore || 'GOOD')}</div></td>
                                          <td className="px-5 py-3 text-center">
                                              <div className="flex flex-col items-center">
                                                  <span className={`px-2 py-0.5 rounded-[6px] text-[10px] font-bold ${paymentStatus.className}`}>
                                                      {paymentStatus.label}
                                                  </span>
                                                  {paymentStatus.label !== 'PAGADO' && (
                                                      <span className="text-[10px] text-zinc-400 mt-0.5">Día {p.billingDay || 1}</span>
                                                  )}
                                              </div>
                                          </td>
                                          <td className="px-5 py-3 text-center"><button onClick={(e) => {e.stopPropagation(); navigate(`/projects/${p.id}`);}} className="p-1.5 rounded-[7px] hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-800 dark:hover:text-white transition-all"><Edit2 className="w-3.5 h-3.5" /></button></td>
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
    </div>
  );
}
