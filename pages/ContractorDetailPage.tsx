import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../services/db';
import { Contractor, Project, Task, ProjectStatus, TaskStatus } from '../types';
import { Card, Button, Input, Label, Badge } from '../components/UIComponents';
import { ArrowLeft, Edit2, Trash2, Save, X, Briefcase, CheckCircle2, Clock, DollarSign, Mail, Phone, ExternalLink } from 'lucide-react';

export default function ContractorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [contractor, setContractor] = useState<Contractor | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [assignedItems, setAssignedItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    role: '',
    hourlyRate: 0,
    email: '',
    phone: '',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE'
  });

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    
    const [contractorData, allProjects, allTasks, assignedData] = await Promise.all([
      db.contractors.getById(id),
      db.projects.getAll(),
      db.tasks.getAll(),
      db.contractors.getAssignedItems(id)
    ]);
    
    if (contractorData) {
      setContractor(contractorData);
      setFormData({
        name: contractorData.name,
        role: contractorData.role,
        hourlyRate: contractorData.hourlyRate,
        email: contractorData.email || '',
        phone: contractorData.phone || '',
        status: contractorData.status
      });
    }
    
    setProjects(allProjects.filter(p => p.assignedPartnerId === id));
    setTasks(allTasks.filter(t => t.assigneeId === id));
    setAssignedItems(assignedData || []);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!id) return;
    await db.contractors.update(id, formData);
    setIsEditing(false);
    loadData();
  };

  const handleDelete = async () => {
    if (!id) return;
    if (confirm('¿Estás seguro de eliminar este socio? Esta acción no se puede deshacer.')) {
      await db.contractors.delete(id);
      navigate('/partners');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen"><div className="animate-pulse text-gray-400">Cargando...</div></div>;
  }

  if (!contractor) {
    return <div className="p-8 text-center text-gray-400">Socio no encontrado</div>;
  }

  const activeProjects = projects.filter(p => p.status === ProjectStatus.ACTIVE);
  const activeTasks = tasks.filter(t => t.status !== TaskStatus.DONE);
  const monthlyPayout = activeProjects.reduce((sum, p) => sum + (p.outsourcingCost || 0), 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/partners')} className="p-2">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">{contractor.name}</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">{contractor.role}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Button variant="secondary" onClick={() => setIsEditing(false)}>
                <X className="w-4 h-4 mr-2" /> Cancelar
              </Button>
              <Button onClick={handleSave}>
                <Save className="w-4 h-4 mr-2" /> Guardar
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setIsEditing(true)}>
                <Edit2 className="w-4 h-4 mr-2" /> Editar
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                <Trash2 className="w-4 h-4 mr-2" /> Eliminar
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 border-l-4 border-l-blue-500">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <Briefcase className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase">Proyectos Activos</p>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{activeProjects.length}</h3>
            </div>
          </div>
        </Card>

        <Card className="p-6 border-l-4 border-l-yellow-500">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase">Tareas Pendientes</p>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{activeTasks.length}</h3>
            </div>
          </div>
        </Card>

        <Card className="p-6 border-l-4 border-l-green-500">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase">Pago Mensual</p>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">${monthlyPayout.toLocaleString()}</h3>
            </div>
          </div>
        </Card>
      </div>

      {/* Information Card */}
      <Card className="p-6">
        <h2 className="text-xl font-bold mb-6 text-gray-900 dark:text-white">Información del Socio</h2>
        
        {isEditing ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label>Nombre Completo</Label>
              <Input 
                value={formData.name} 
                onChange={e => setFormData({...formData, name: e.target.value})}
              />
            </div>
            <div>
              <Label>Rol</Label>
              <Input 
                value={formData.role} 
                onChange={e => setFormData({...formData, role: e.target.value})}
              />
            </div>
            <div>
              <Label>Tarifa Mensual</Label>
              <Input 
                type="number"
                value={formData.hourlyRate} 
                onChange={e => setFormData({...formData, hourlyRate: parseFloat(e.target.value)})}
              />
            </div>
            <div>
              <Label>Estado</Label>
              <select 
                className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                value={formData.status}
                onChange={e => setFormData({...formData, status: e.target.value as 'ACTIVE' | 'INACTIVE'})}
              >
                <option value="ACTIVE">Activo</option>
                <option value="INACTIVE">Inactivo</option>
              </select>
            </div>
            <div>
              <Label>Email</Label>
              <Input 
                type="email"
                value={formData.email} 
                onChange={e => setFormData({...formData, email: e.target.value})}
              />
            </div>
            <div>
              <Label>Teléfono</Label>
              <Input 
                value={formData.phone} 
                onChange={e => setFormData({...formData, phone: e.target.value})}
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-xs text-gray-400">Email</p>
                <p className="font-medium text-gray-900 dark:text-white">{contractor.email || '-'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-xs text-gray-400">Teléfono</p>
                <p className="font-medium text-gray-900 dark:text-white">{contractor.phone || '-'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <DollarSign className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-xs text-gray-400">Tarifa Mensual</p>
                <p className="font-medium text-gray-900 dark:text-white">${contractor.hourlyRate.toLocaleString()}/mes</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-xs text-gray-400">Estado</p>
                <Badge variant={contractor.status === 'ACTIVE' ? 'green' : 'outline'}>{contractor.status}</Badge>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Projects Section */}
      <Card className="p-6">
        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Proyectos Asignados ({activeProjects.length})</h2>
        {activeProjects.length === 0 ? (
          <p className="text-gray-400 text-sm">No hay proyectos asignados actualmente.</p>
        ) : (
          <div className="space-y-3">
            {activeProjects.map(p => (
              <div 
                key={p.id} 
                onClick={() => navigate(`/projects/${p.id}`)}
                className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-800 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 cursor-pointer transition-colors"
              >
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white">{p.name}</h3>
                  <p className="text-xs text-gray-500">{p.industry}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono font-bold text-gray-900 dark:text-white">${(p.outsourcingCost || 0).toLocaleString()}/mes</p>
                  <Badge variant="blue" className="mt-1">{p.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Tasks Section */}
      <Card className="p-6">
        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Tareas Activas ({activeTasks.length})</h2>
        {activeTasks.length === 0 ? (
          <p className="text-gray-400 text-sm">No hay tareas pendientes.</p>
        ) : (
          <div className="space-y-2">
            {activeTasks.slice(0, 5).map(t => (
              <div key={t.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${t.priority === 'HIGH' ? 'bg-red-500' : t.priority === 'MEDIUM' ? 'bg-yellow-500' : 'bg-green-500'}`}></div>
                  <span className="font-medium text-gray-900 dark:text-white">{t.title}</span>
                </div>
                {t.dueDate && (
                  <span className="text-xs text-gray-500">{new Date(t.dueDate).toLocaleDateString()}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Work Order / Assigned Items Section */}
      <div className="mt-8">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-indigo-500"/> Carga de Trabajo Activa
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {assignedItems.length === 0 && <p className="text-gray-500 italic">No tiene servicios asignados actualmente.</p>}
              
              {assignedItems.map((item, idx) => (
                  <Card key={idx} className="p-4 flex flex-col gap-3 border-l-4 border-l-indigo-500">
                      <div className="flex justify-between items-start">
                          <div>
                              <h4 className="font-bold text-gray-900 dark:text-white">{item.serviceSnapshotName}</h4>
                              <p className="text-sm text-gray-500">Cliente: <span className="font-semibold text-indigo-600">{item.proposal?.client?.name}</span></p>
                          </div>
                          <Badge variant={item.serviceSnapshotType === 'RECURRING' ? 'blue' : 'yellow'}>
                              {item.serviceSnapshotType === 'RECURRING' ? 'Recurrente' : 'One-Time'}
                          </Badge>
                      </div>
                      
                      <div className="flex justify-between items-center pt-3 border-t border-gray-100 dark:border-slate-800 text-sm">
                          <span className="text-gray-500">Pago acordado:</span>
                          <span className="font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded">
                              ${item.outsourcingCost?.toLocaleString()}
                          </span>
                      </div>
                      
                      {/* Enlace directo al proyecto */}
                      <Button 
                          size="sm" 
                          variant="ghost" 
                          className="w-full mt-1 text-xs text-gray-400 hover:text-indigo-600"
                          onClick={() => navigate(`/projects/${item.proposal?.clientId}?tab=PROFILE`)}
                      >
                          Ver Proyecto <ExternalLink className="w-3 h-3 ml-1"/>
                      </Button>
                  </Card>
              ))}
          </div>
      </div>

    </div>
  );
}
