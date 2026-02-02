
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
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Equipo & Finanzas</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">Gestión de socios y costos fijos mensuales.</p>
        </div>
        <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64"><Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" /><Input placeholder="Buscar socio..." className="pl-9 h-10 bg-white dark:bg-slate-800" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
            <Button onClick={() => setIsModalOpen(true)} className="shadow-lg"><Plus className="w-4 h-4 mr-2" /> Agregar</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-gradient-to-br from-gray-900 to-gray-800 dark:from-slate-800 dark:to-slate-900 text-white border-0 shadow-xl">
              <div className="p-6">
                  <div className="flex items-center gap-2 text-gray-400 text-xs font-bold uppercase tracking-widest mb-2">
                      <Wallet className="w-4 h-4" /> Nómina Mensual Activa
                  </div>
                  <div className="text-4xl font-bold tracking-tight">${totalPayroll.toLocaleString()}</div>
                  <div className="mt-4 text-sm text-gray-400">Total a pagar a socios por proyectos activos.</div>
              </div>
          </Card>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm flex flex-col">
          <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-sm text-left min-w-[800px]">
                  <thead className="bg-gray-50 dark:bg-slate-800 text-gray-500 dark:text-gray-400 font-medium border-b border-gray-100 dark:border-slate-700 uppercase text-xs tracking-wider">
                      <tr>
                          <th className="px-6 py-4">Socio / Freelancer</th>
                          <th className="px-6 py-4">Carga de Trabajo (Tareas)</th>
                          <th className="px-6 py-4 text-right">Pago Mensual (Estimado)</th>
                          <th className="px-6 py-4 text-center">Estado</th>
                          <th className="px-6 py-4 text-center">Acciones</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-slate-800">
                      {filtered.length === 0 ? (<tr><td colSpan={5} className="text-center py-12 text-gray-400">No hay socios registrados.</td></tr>) : 
                          filtered.map(c => {
                              const partnerProjects = projects.filter(p => p.assignedPartnerId === c.id && p.status === ProjectStatus.ACTIVE);
                              const monthlyPayout = partnerProjects.reduce((sum, p) => sum + (p.outsourcingCost || 0), 0);
                              
                              // WORKLOAD LOGIC
                              const activeTasks = tasks.filter(t => t.assigneeId === c.id && t.status !== TaskStatus.DONE).length;
                              const loadPercentage = Math.min(100, (activeTasks / 10) * 100); // Assume 10 tasks is full cap
                              const loadColor = loadPercentage > 80 ? 'bg-red-500' : loadPercentage > 50 ? 'bg-yellow-500' : 'bg-green-500';

                              return (
                                  <tr key={c.id} onContextMenu={(e) => handleContextMenu(e, c)} onClick={() => navigate(`/partners/${c.id}`)} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 group cursor-pointer">
                                      <td className="px-6 py-4">
                                          <div className="flex items-center gap-3">
                                              <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 flex items-center justify-center font-bold text-sm">{c.name.charAt(0)}</div>
                                              <div>
                                                  <div className="font-bold text-gray-900 dark:text-white">{c.name}</div>
                                                  <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">{c.role} <span className="text-gray-300">|</span> {c.email || '-'}</div>
                                              </div>
                                          </div>
                                      </td>
                                      <td className="px-6 py-4 w-64">
                                          <div className="flex justify-between text-xs mb-1 text-gray-600 dark:text-gray-400">
                                              <span>{activeTasks} tareas activas</span>
                                              <span>{loadPercentage > 80 ? 'Saturado' : 'Disponible'}</span>
                                          </div>
                                          <div className="h-2 w-full bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                              <div className={`h-full rounded-full ${loadColor} transition-all duration-500`} style={{width: `${loadPercentage}%`}}></div>
                                          </div>
                                      </td>
                                      <td className="px-6 py-4 text-right">
                                          <span className={`font-mono font-bold ${monthlyPayout > 0 ? 'text-gray-900 dark:text-white' : 'text-gray-300 dark:text-gray-600'}`}>
                                              ${monthlyPayout.toLocaleString()}
                                          </span>
                                          <div className="text-[10px] text-gray-400 mt-0.5">Tarifa ref: ${c.hourlyRate}/mes</div>
                                      </td>
                                      <td className="px-6 py-4 text-center"><Badge variant={c.status === 'ACTIVE' ? 'green' : 'outline'}>{c.status}</Badge></td>
                                      <td className="px-6 py-4 text-center">
                                          <div className="flex items-center justify-center gap-2">
                                              <button 
                                                  onClick={(e) => { e.stopPropagation(); navigate(`/partners/${c.id}`); }} 
                                                  className="text-blue-600 hover:text-blue-800 transition-colors p-1 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                                                  title="Ver Perfil"
                                              >
                                                  <Eye className="w-4 h-4" />
                                              </button>
                                              <button 
                                                  onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }} 
                                                  className="text-gray-300 hover:text-red-500 transition-colors p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                                  title="Eliminar"
                                              >
                                                  <Trash2 className="w-4 h-4" />
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
