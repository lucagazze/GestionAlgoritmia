import React, { useEffect, useState } from 'react';
import { db } from '../services/db';
import { Project, ProjectStatus } from '../types';
import { Card, Badge, Button, Modal, Input, Label } from '../components/UIComponents';
import { MoreHorizontal, DollarSign, Calendar, TrendingUp, Plus, Trash2, Edit2 } from 'lucide-react';

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Create Project State
  const [newProject, setNewProject] = useState({
      name: '',
      monthlyRevenue: '',
      billingDay: '1'
  });

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    setIsLoading(true);
    const data = await db.projects.getAll();
    setProjects(data);
    setIsLoading(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
      e.preventDefault();
      if(!newProject.name) return;
      await db.projects.create({
          name: newProject.name,
          monthlyRevenue: parseFloat(newProject.monthlyRevenue) || 0,
          billingDay: parseInt(newProject.billingDay) || 1,
          status: ProjectStatus.ACTIVE
      });
      setIsModalOpen(false);
      setNewProject({ name: '', monthlyRevenue: '', billingDay: '1' });
      loadProjects();
  }

  const handleDelete = async (id: string) => {
      if(confirm('¿Eliminar proyecto y cliente?')) {
          await db.projects.delete(id);
          loadProjects();
      }
  }

  const toggleStatus = async (project: Project) => {
    const newStatus = project.status === ProjectStatus.ACTIVE ? ProjectStatus.PAUSED : ProjectStatus.ACTIVE;
    await db.projects.update(project.id, { status: newStatus });
    loadProjects();
  };

  // Billing Logic Helper
  const getBillingStatus = (billingDay: number) => {
      const today = new Date().getDate();
      if (billingDay === today) return { label: 'Hoy', color: 'text-green-600 font-bold' };
      if (billingDay < today) return { label: 'Vencido', color: 'text-red-500 font-bold' };
      return { label: `Día ${billingDay}`, color: 'text-gray-500' };
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Mis Proyectos</h1>
          <p className="text-gray-500 mt-2">Gestión de facturación y estado de clientes.</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="shadow-lg">
            <Plus className="w-4 h-4 mr-2" /> Nuevo Proyecto
        </Button>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Nuevo Proyecto Manual">
          <form onSubmit={handleCreate} className="space-y-4">
              <div>
                  <Label>Nombre del Cliente</Label>
                  <Input value={newProject.name} onChange={e => setNewProject({...newProject, name: e.target.value})} placeholder="Ej: Nike Argentina" autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Fee Mensual ($)</Label>
                    <Input type="number" value={newProject.monthlyRevenue} onChange={e => setNewProject({...newProject, monthlyRevenue: e.target.value})} placeholder="1500" />
                  </div>
                  <div>
                    <Label>Día de Cobro (1-31)</Label>
                    <Input type="number" min="1" max="31" value={newProject.billingDay} onChange={e => setNewProject({...newProject, billingDay: e.target.value})} />
                  </div>
              </div>
              <div className="pt-2 flex gap-2">
                   <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)} className="flex-1">Cancelar</Button>
                   <Button type="submit" className="flex-1">Crear Proyecto</Button>
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
            return (
            <Card key={project.id} className="hover:shadow-lg transition-shadow duration-300 group relative">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 rounded-xl bg-gray-900 text-white flex items-center justify-center text-lg font-bold">
                    {project.name.charAt(0)}
                  </div>
                  <div className="flex gap-1">
                    <button className="text-gray-300 hover:text-red-500 p-1" onClick={() => handleDelete(project.id)}>
                        <Trash2 className="w-4 h-4" />
                    </button>
                    <button className="text-gray-300 hover:text-black p-1" onClick={() => toggleStatus(project)}>
                        <MoreHorizontal className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                
                <h3 className="text-lg font-bold text-gray-900 mb-1 truncate">{project.name}</h3>
                <div className="flex items-center gap-2 mb-4">
                  <Badge variant={project.status === ProjectStatus.ACTIVE ? 'green' : 'outline'}>
                      {project.status === ProjectStatus.ACTIVE ? 'Activo' : 'Pausado'}
                  </Badge>
                  <span className="text-xs text-gray-400">Desde {new Date(project.createdAt).toLocaleDateString()}</span>
                </div>

                <div className="border-t border-gray-50 pt-4 mt-4 space-y-3 bg-gray-50/50 -mx-6 -mb-6 p-6">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500 flex items-center gap-2"><DollarSign className="w-4 h-4"/> Mensualidad</span>
                    <span className="font-bold font-mono">${project.monthlyRevenue.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500 flex items-center gap-2"><Calendar className="w-4 h-4"/> Próximo Cobro</span>
                    <span className={billingInfo.color}>{billingInfo.label}</span>
                  </div>
                </div>
              </div>
            </Card>
          )})}
        </div>
      )}
    </div>
  );
}
