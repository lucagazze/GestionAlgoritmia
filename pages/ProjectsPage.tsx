import React, { useEffect, useState } from 'react';
import { db } from '../services/db';
import { Project, ProjectStatus } from '../types';
import { Card, Badge, Button } from '../components/UIComponents';
import { Briefcase, MoreHorizontal, DollarSign, Calendar, TrendingUp } from 'lucide-react';

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    setIsLoading(true);
    const data = await db.projects.getAll();
    setProjects(data);
    setIsLoading(false);
  };

  const totalMRR = projects
    .filter(p => p.status === ProjectStatus.ACTIVE || p.status === ProjectStatus.ONBOARDING)
    .reduce((acc, p) => acc + (p.monthlyRevenue || 0), 0);

  const getStatusBadge = (status: ProjectStatus) => {
    switch (status) {
      case ProjectStatus.ACTIVE: return <Badge variant="green">Activo</Badge>;
      case ProjectStatus.ONBOARDING: return <Badge variant="blue">Setup</Badge>;
      case ProjectStatus.PAUSED: return <Badge variant="yellow">Pausado</Badge>;
      default: return <Badge variant="outline">Finalizado</Badge>;
    }
  };

  const toggleStatus = async (project: Project) => {
    const newStatus = project.status === ProjectStatus.ACTIVE ? ProjectStatus.PAUSED : ProjectStatus.ACTIVE;
    await db.projects.update(project.id, { status: newStatus });
    loadProjects();
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Mis Proyectos</h1>
          <p className="text-gray-500 mt-2">Gestión de clientes activos y facturación recurrente.</p>
        </div>
        
        <Card className="bg-black text-white px-6 py-4 flex items-center gap-4 min-w-[200px]">
          <div className="p-3 bg-white/10 rounded-full">
            <TrendingUp className="w-6 h-6 text-green-400" />
          </div>
          <div>
            <span className="text-white/60 text-xs uppercase font-bold tracking-wider">MRR Actual</span>
            <div className="text-2xl font-bold tracking-tight">${totalMRR.toLocaleString()}</div>
          </div>
        </Card>
      </div>

      {isLoading ? (
        <div className="text-center py-20 text-gray-400">Cargando clientes...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.length === 0 && (
             <div className="col-span-full text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
               <p className="text-gray-500">Aún no hay proyectos. Crea una propuesta y guárdala para empezar.</p>
             </div>
          )}
          {projects.map((project) => (
            <Card key={project.id} className="hover:shadow-lg transition-shadow duration-300 group">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center text-lg font-bold text-gray-900">
                    {project.name.charAt(0)}
                  </div>
                  <button className="text-gray-300 hover:text-black transition-colors" onClick={() => toggleStatus(project)}>
                    <MoreHorizontal className="w-5 h-5" />
                  </button>
                </div>
                
                <h3 className="text-lg font-bold text-gray-900 mb-1 truncate">{project.name}</h3>
                <div className="flex items-center gap-2 mb-4">
                  {getStatusBadge(project.status)}
                  <span className="text-xs text-gray-400">Desde {new Date(project.createdAt).toLocaleDateString()}</span>
                </div>

                <div className="border-t border-gray-50 pt-4 mt-4 space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500 flex items-center gap-2"><DollarSign className="w-4 h-4"/> Fee Mensual</span>
                    <span className="font-semibold">${project.monthlyRevenue.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500 flex items-center gap-2"><Calendar className="w-4 h-4"/> Próximo Cobro</span>
                    <span className="text-gray-900">01 / Mes</span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
