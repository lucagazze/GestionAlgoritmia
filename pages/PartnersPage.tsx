
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/db';
import { Contractor, Project, ProjectStatus, Task, TaskStatus } from '../types';
import { Button, Input, Label, Badge, Modal, Card } from '../components/UIComponents';
import { ContextMenu } from '../components/ContextMenu';
import { Users, Plus, Trash2, Mail, DollarSign, Search, Edit2, Phone, Briefcase, ChevronRight, Wallet, Eye } from 'lucide-react';

export default function PartnersPage() {
  const navigate = useNavigate();
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Context Menu
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; contractor: Contractor | null }>({ x: 0, y: 0, contractor: null });

  const [formData, setFormData] = useState({ name: '', role: '', hourlyRate: '', email: '', phone: '' });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [cData, pData, tData] = await Promise.all([
        db.contractors.getAll(),
        db.projects.getAll(),
        db.tasks.getAll()
    ]);
    setContractors(cData);
    setProjects(pData);
    setTasks(tData);
    setLoading(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;
    await db.contractors.create({ 
        name: formData.name, 
        role: formData.role, 
        hourlyRate: parseFloat(formData.hourlyRate) || 0, 
        email: formData.email, 
        phone: formData.phone,
        status: 'ACTIVE' 
    });
    setIsModalOpen(false);
    setFormData({ name: '', role: '', hourlyRate: '', email: '', phone: '' });
    loadData();
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Eliminar socio?')) {
      await db.contractors.delete(id);
      loadData();
    }
  };

  const handleContextMenu = (e: React.MouseEvent, contractor: Contractor) => {
      e.preventDefault();
      setContextMenu({ x: e.pageX, y: e.pageY, contractor });
  };

  const filtered = contractors.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));

  // Calculate Finances
  const totalPayroll = filtered.reduce((acc, c) => {
      const activeProjects = projects.filter(p => p.assignedPartnerId === c.id && p.status === ProjectStatus.ACTIVE);
      const monthlyPayout = activeProjects.reduce((sum, p) => sum + (p.outsourcingCost || 0), 0);
      return acc + monthlyPayout;
  }, 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      
      {/* Header & Financial Stats */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h1 className="text-[26px] font-bold tracking-[-0.03em] text-zinc-900 dark:text-white">Equipo</h1>
            <p className="text-[14px] text-zinc-400 dark:text-zinc-500 mt-0.5 font-medium">Socios, costos y carga de trabajo.</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                <Input placeholder="Buscar socio..." className="pl-9 h-10" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 h-10 px-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-[13px] font-semibold rounded-[10px] shadow-[0_1px_3px_rgba(0,0,0,0.15)] hover:bg-black dark:hover:bg-zinc-100 active:scale-[0.97] transition-all whitespace-nowrap">
                <Plus className="w-4 h-4" /> Agregar
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-zinc-900 dark:bg-white border border-zinc-900 dark:border-zinc-200 rounded-2xl p-5 shadow-[0_2px_8px_rgba(0,0,0,0.12)]">
              <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-500 text-[10px] font-semibold uppercase tracking-[0.08em] mb-2">
                  <Wallet className="w-3.5 h-3.5" /> Nómina Mensual
              </div>
              <div className="text-[32px] font-bold tracking-[-0.03em] text-white dark:text-zinc-900">${totalPayroll.toLocaleString()}</div>
              <div className="mt-2 text-[12px] text-zinc-500 dark:text-zinc-500">Total a pagar por proyectos activos.</div>
          </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="overflow-x-auto">
              <table className="w-full text-sm text-left min-w-[800px]">
                  <thead className="bg-zinc-50/80 dark:bg-zinc-800/60 text-zinc-400 font-medium border-b border-zinc-100 dark:border-zinc-800 uppercase text-[10px] tracking-[0.06em]">
                      <tr>
                          <th className="px-5 py-3">Socio / Freelancer</th>
                          <th className="px-5 py-3">Carga de Trabajo</th>
                          <th className="px-5 py-3 text-right">Pago Mensual</th>
                          <th className="px-5 py-3 text-center">Estado</th>
                          <th className="px-5 py-3 text-center">Acciones</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800">
                      {filtered.length === 0 ? (<tr><td colSpan={5} className="text-center py-12 text-[13px] text-zinc-400">No hay socios registrados.</td></tr>) :
                          filtered.map(c => {
                              const partnerProjects = projects.filter(p => p.assignedPartnerId === c.id && p.status === ProjectStatus.ACTIVE);
                              const monthlyPayout = partnerProjects.reduce((sum, p) => sum + (p.outsourcingCost || 0), 0);

                              // WORKLOAD LOGIC
                              const activeTasks = tasks.filter(t => t.assigneeId === c.id && t.status !== TaskStatus.DONE).length;
                              const loadPercentage = Math.min(100, (activeTasks / 10) * 100);
                              const loadColor = loadPercentage > 80 ? 'bg-red-400' : loadPercentage > 50 ? 'bg-amber-400' : 'bg-emerald-400';

                              return (
                                  <tr key={c.id} onContextMenu={(e) => handleContextMenu(e, c)} onClick={() => navigate(`/partners/${c.id}`)} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/30 group cursor-pointer transition-colors">
                                      <td className="px-5 py-3">
                                          <div className="flex items-center gap-3">
                                              <div className="w-9 h-9 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center font-bold text-[13px]">{c.name.charAt(0)}</div>
                                              <div>
                                                  <div className="font-semibold text-[13px] text-zinc-900 dark:text-white">{c.name}</div>
                                                  <div className="text-[11px] text-zinc-400 flex items-center gap-1">{c.role} {c.email && <><span className="text-zinc-200 dark:text-zinc-700">·</span> {c.email}</>}</div>
                                              </div>
                                          </div>
                                      </td>
                                      <td className="px-5 py-3 w-56">
                                          <div className="flex justify-between text-[11px] mb-1.5 text-zinc-500">
                                              <span>{activeTasks} tareas activas</span>
                                              <span className={loadPercentage > 80 ? 'text-red-500 font-semibold' : ''}>{loadPercentage > 80 ? 'Saturado' : 'Disponible'}</span>
                                          </div>
                                          <div className="h-1.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                              <div className={`h-full rounded-full ${loadColor} transition-all duration-500`} style={{width: `${loadPercentage}%`}}></div>
                                          </div>
                                      </td>
                                      <td className="px-5 py-3 text-right">
                                          <span className={`font-mono font-bold text-[13px] ${monthlyPayout > 0 ? 'text-zinc-900 dark:text-white' : 'text-zinc-300 dark:text-zinc-600'}`}>
                                              ${monthlyPayout.toLocaleString()}
                                          </span>
                                          <div className="text-[10px] text-zinc-400 mt-0.5">ref: ${c.hourlyRate}/mes</div>
                                      </td>
                                      <td className="px-5 py-3 text-center"><Badge variant={c.status === 'ACTIVE' ? 'green' : 'outline'}>{c.status}</Badge></td>
                                      <td className="px-5 py-3 text-center">
                                          <div className="flex items-center justify-center gap-1.5">
                                              <button
                                                  onClick={(e) => { e.stopPropagation(); navigate(`/partners/${c.id}`); }}
                                                  className="w-8 h-8 flex items-center justify-center rounded-[8px] text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                                                  title="Ver Perfil"
                                              >
                                                  <Eye className="w-3.5 h-3.5" />
                                              </button>
                                              <button
                                                  onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }}
                                                  className="w-8 h-8 flex items-center justify-center rounded-[8px] text-zinc-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                                  title="Eliminar"
                                              >
                                                  <Trash2 className="w-3.5 h-3.5" />
                                              </button>
                                          </div>
                                      </td>
                                  </tr>
                              )
                          })
                      }
                  </tbody>
              </table>
          </div>
      </div>

      <ContextMenu 
        x={contextMenu.x} y={contextMenu.y} isOpen={!!contextMenu.contractor} onClose={() => setContextMenu({ ...contextMenu, contractor: null })}
        items={[
            { label: 'Enviar Email', icon: Mail, onClick: () => contextMenu.contractor && window.location.assign(`mailto:${contextMenu.contractor.email}`) },
            { label: 'Eliminar Socio', icon: Trash2, variant: 'destructive', onClick: () => contextMenu.contractor && handleDelete(contextMenu.contractor.id) }
        ]}
      />

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Registrar Socio">
        <form onSubmit={handleCreate} className="space-y-4">
          <div><Label>Nombre Completo</Label><Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Ej: Juan Pérez" autoFocus /></div>
          <div className="grid grid-cols-2 gap-4"><div><Label>Rol</Label><Input value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} /></div><div><Label>Tarifa Mensual</Label><Input type="number" value={formData.hourlyRate} onChange={e => setFormData({...formData, hourlyRate: e.target.value})} placeholder="$ Mensual" /></div></div>
          
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Email</Label><Input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} /></div>
            <div><Label>WhatsApp / Tel</Label><Input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="+54 9..." /></div>
          </div>
          
          <div className="flex gap-2 pt-4"><Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)} className="flex-1">Cancelar</Button><Button type="submit" className="flex-1">Guardar</Button></div>
        </form>
      </Modal>
    </div>
  );
}
