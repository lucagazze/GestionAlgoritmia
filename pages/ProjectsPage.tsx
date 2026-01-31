
import React, { useEffect, useState } from 'react';
import { db } from '../services/db';
import { Project, ProjectStatus, Contractor } from '../types';
import { Card, Badge, Button, Modal, Input, Label } from '../components/UIComponents';
import { MoreHorizontal, DollarSign, Calendar, TrendingUp, Plus, Trash2, Edit2, MessageCircle, FileText, User, ArrowRight, Link as LinkIcon, ExternalLink } from 'lucide-react';

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
      name: '',
      monthlyRevenue: '',
      billingDay: '1',
      phone: '',
      assignedPartnerId: '',
      outsourcingCost: '',
      proposalUrl: ''
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
    
    // Map partners to projects manually to ensure display names even if join fails
    const mappedProjects = projData.map(p => {
        const partner = contData.find(c => c.id === p.assignedPartnerId);
        return { ...p, partnerName: partner ? partner.name : undefined };
    });

    setProjects(mappedProjects);
    setContractors(contData);
    setIsLoading(false);
  };

  const openCreateModal = () => {
      setEditingId(null);
      setFormData({ name: '', monthlyRevenue: '', billingDay: '1', phone: '', assignedPartnerId: '', outsourcingCost: '', proposalUrl: '' });
      setIsModalOpen(true);
  };

  const openEditModal = (p: Project) => {
      setEditingId(p.id);
      setFormData({
          name: p.name,
          monthlyRevenue: p.monthlyRevenue.toString(),
          billingDay: p.billingDay.toString(),
          phone: p.phone || '',
          assignedPartnerId: p.assignedPartnerId || '',
          outsourcingCost: p.outsourcingCost ? p.outsourcingCost.toString() : '',
          proposalUrl: p.proposalUrl || ''
      });
      setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
      e.preventDefault();
      if(!formData.name) return;

      const payload = {
          name: formData.name,
          monthlyRevenue: parseFloat(formData.monthlyRevenue) || 0,
          billingDay: parseInt(formData.billingDay) || 1,
          phone: formData.phone,
          assignedPartnerId: formData.assignedPartnerId || null,
          outsourcingCost: parseFloat(formData.outsourcingCost) || 0,
          proposalUrl: formData.proposalUrl
      };

      if (editingId) {
          await db.projects.update(editingId, payload);
      } else {
          await db.projects.create({ ...payload, status: ProjectStatus.ACTIVE });
      }

      setIsModalOpen(false);
      loadData();
  }

  const handleDelete = async (id: string) => {
      if(confirm('¿Eliminar proyecto y cliente?')) {
          await db.projects.delete(id);
          loadData();
      }
  }

  const toggleStatus = async (project: Project) => {
    const newStatus = project.status === ProjectStatus.ACTIVE ? ProjectStatus.PAUSED : ProjectStatus.ACTIVE;
    await db.projects.update(project.id, { status: newStatus });
    loadData();
  };

  // WhatsApp Logic
  const getWhatsAppLink = (p: Project) => {
      if (!p.phone) return null;
      // Clean phone number
      const cleanPhone = p.phone.replace(/\D/g, '');
      const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
      const currentMonth = monthNames[new Date().getMonth()];
      
      const message = `Hola ${p.name.split(' ')[0]}! 👋 Te paso el total del mes de *${currentMonth}* por valor de *$${p.monthlyRevenue.toLocaleString()}*.\n\nAvísame cuando realices el pago así lo registro. Gracias!`;
      
      return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  };

  // Billing Logic Helper
  const getBillingStatus = (billingDay: number) => {
      const today = new Date().getDate();
      if (billingDay === today) return { label: 'Cobrar Hoy', color: 'text-green-600 font-bold' };
      if (billingDay < today) return { label: 'Vencido', color: 'text-red-500 font-bold' };
      return { label: `Día ${billingDay}`, color: 'text-gray-500' };
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Mis Proyectos</h1>
          <p className="text-gray-500 mt-2">Gestiona cobros, márgenes y relaciones con socios.</p>
        </div>
        <Button onClick={openCreateModal} className="shadow-lg">
            <Plus className="w-4 h-4 mr-2" /> Nuevo Proyecto
        </Button>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Editar Proyecto" : "Nuevo Proyecto"}>
          <form onSubmit={handleSave} className="space-y-4">
              <div>
                  <Label>Nombre del Cliente</Label>
                  <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Ej: Nike Argentina" autoFocus />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Fee Mensual ($)</Label>
                    <Input type="number" value={formData.monthlyRevenue} onChange={e => setFormData({...formData, monthlyRevenue: e.target.value})} placeholder="1500" />
                  </div>
                  <div>
                    <Label>Día de Cobro (1-31)</Label>
                    <Input type="number" min="1" max="31" value={formData.billingDay} onChange={e => setFormData({...formData, billingDay: e.target.value})} />
                  </div>
              </div>

              <div>
                  <Label>WhatsApp (Cobros Automáticos)</Label>
                  <Input type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="Ej: 54911..." />
                  <p className="text-[10px] text-gray-400 mt-1">Ingresa el código de país (ej: 549 para Arg) para que funcione el link.</p>
              </div>

              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-4">
                   <div className="flex items-center gap-2 mb-2">
                       <User className="w-4 h-4 text-gray-500"/>
                       <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Outsourcing & Socios</span>
                   </div>
                   
                   <div>
                       <Label>Socio Asignado (Quién lo hace)</Label>
                       <select 
                            className="flex h-11 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-black"
                            value={formData.assignedPartnerId}
                            onChange={e => setFormData({...formData, assignedPartnerId: e.target.value})}
                       >
                           <option value="">(Lo hago yo internamente)</option>
                           {contractors.map(c => <option key={c.id} value={c.id}>{c.name} ({c.role})</option>)}
                       </select>
                   </div>

                   {formData.assignedPartnerId && (
                       <div>
                            <Label>Costo del Socio ($)</Label>
                            <Input type="number" value={formData.outsourcingCost} onChange={e => setFormData({...formData, outsourcingCost: e.target.value})} placeholder="Monto que le pagas al socio" />
                       </div>
                   )}
              </div>

              <div>
                  <Label>Link de Propuesta (PDF)</Label>
                  <Input value={formData.proposalUrl} onChange={e => setFormData({...formData, proposalUrl: e.target.value})} placeholder="https://drive.google.com/..." />
              </div>

              <div className="pt-2 flex gap-2">
                   <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)} className="flex-1">Cancelar</Button>
                   <Button type="submit" className="flex-1">Guardar</Button>
              </div>
          </form>
      </Modal>

      {isLoading ? (
        <div className="text-center py-20 text-gray-400">Cargando clientes...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.length === 0 && (
             <div className="col-span-full text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
               <p className="text-gray-500">No hay proyectos activos.</p>
             </div>
          )}
          {projects.map((project) => {
            const billingInfo = getBillingStatus(project.billingDay || 1);
            const waLink = getWhatsAppLink(project);
            const margin = (project.monthlyRevenue || 0) - (project.outsourcingCost || 0);
            
            return (
            <Card key={project.id} className="hover:shadow-lg transition-all duration-300 group relative border-t-4 border-t-black">
              <div className="p-6">
                
                {/* Header Card */}
                <div className="flex justify-between items-start mb-3">
                  <div className="flex flex-col">
                      <h3 className="text-lg font-bold text-gray-900 truncate">{project.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant={project.status === ProjectStatus.ACTIVE ? 'green' : 'outline'}>
                            {project.status === ProjectStatus.ACTIVE ? 'Activo' : 'Pausado'}
                        </Badge>
                        {project.proposalUrl && (
                            <a href={project.proposalUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline flex items-center">
                                <FileText className="w-3 h-3 mr-1" /> Propuesta
                            </a>
                        )}
                      </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="text-gray-300 hover:text-blue-500 p-1" onClick={() => openEditModal(project)}>
                        <Edit2 className="w-4 h-4" />
                    </button>
                    <button className="text-gray-300 hover:text-black p-1" onClick={() => toggleStatus(project)}>
                        <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Financial Arbitrage Block */}
                <div className="bg-gray-50 rounded-xl p-4 my-4 border border-gray-100 space-y-2">
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500">Cobro Cliente</span>
                        <span className="font-bold text-gray-900">${project.monthlyRevenue.toLocaleString()}</span>
                    </div>
                    {project.assignedPartnerId && (
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-500 flex items-center gap-1">
                                <ArrowRight className="w-3 h-3"/> Pago Socio
                            </span>
                            <span className="font-medium text-red-500">-${(project.outsourcingCost || 0).toLocaleString()}</span>
                        </div>
                    )}
                    <div className="border-t border-gray-200 pt-2 flex justify-between items-center">
                        <span className="text-xs font-bold uppercase text-gray-400">Tu Margen</span>
                        <span className="font-bold text-green-600 text-lg">+${margin.toLocaleString()}</span>
                    </div>
                </div>
                
                {/* Partner Info */}
                {project.assignedPartnerId ? (
                    <div className="mb-4 flex items-center gap-2 text-xs text-gray-500 bg-white border border-gray-100 rounded-lg p-2">
                        <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
                            {project.partnerName?.charAt(0) || 'S'}
                        </div>
                        <span>Gestionado por <span className="font-medium text-gray-900">{project.partnerName}</span></span>
                    </div>
                ) : (
                    <div className="mb-4 text-xs text-gray-400 italic pl-1">Gestionado in-house</div>
                )}

                {/* Actions Footer */}
                <div className="border-t border-gray-50 pt-4 flex items-center justify-between">
                  <div className="flex flex-col">
                      <span className="text-[10px] uppercase text-gray-400 font-bold">Próximo Cobro</span>
                      <span className={`text-sm ${billingInfo.color}`}>{billingInfo.label}</span>
                  </div>
                  
                  {waLink ? (
                      <a href={waLink} target="_blank" rel="noreferrer">
                          <Button size="sm" className="bg-green-500 hover:bg-green-600 text-white border-none shadow-green-200">
                              <MessageCircle className="w-4 h-4 mr-2" /> Cobrar
                          </Button>
                      </a>
                  ) : (
                      <Button size="sm" variant="outline" disabled className="opacity-50">
                          <MessageCircle className="w-4 h-4 mr-2" /> Sin Tel
                      </Button>
                  )}
                </div>

              </div>
            </Card>
          )})}
        </div>
      )}
    </div>
  );
}
