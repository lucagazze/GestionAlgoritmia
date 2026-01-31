
import React, { useEffect, useState } from 'react';
import { db } from '../services/db';
import { Task, TaskStatus, Contractor } from '../types';
import { Button, Input, Label, Modal, Textarea } from '../components/UIComponents';
import { 
  CheckCircle2, 
  Circle, 
  Clock, 
  Plus, 
  Trash2, 
  Calendar as CalendarIcon, 
  User, 
  AlertCircle,
  Loader2,
  RefreshCw,
  MoreVertical
} from 'lucide-react';

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Create/Edit Form State
  const [formData, setFormData] = useState<{
    title: string;
    description: string;
    assigneeId: string;
    dueDate: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH';
  }>({
    title: '',
    description: '',
    assigneeId: '',
    dueDate: '',
    priority: 'MEDIUM'
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [tasksData, contractorsData] = await Promise.all([
        db.tasks.getAll(),
        db.contractors.getAll()
      ]);
      setTasks(tasksData);
      setContractors(contractorsData);
    } catch (err) {
      console.error("Failed to load tasks", err);
      setError("No se pudieron cargar las tareas.");
    } finally {
      setLoading(false);
    }
  };

  const createTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title) return;

    try {
        await db.tasks.create({
            title: formData.title,
            description: formData.description,
            status: TaskStatus.TODO,
            assigneeId: formData.assigneeId || null,
            dueDate: formData.dueDate || null,
            priority: formData.priority
        });
        setFormData({ title: '', description: '', assigneeId: '', dueDate: '', priority: 'MEDIUM' });
        setIsModalOpen(false);
        loadData(); 
    } catch (err) {
        alert("Error al crear la tarea");
    }
  };

  const deleteTask = async (id: string) => {
    if(confirm('¿Eliminar esta tarea?')) {
        setTasks(prev => prev.filter(t => t.id !== id)); // Optimistic UI
        await db.tasks.delete(id);
    }
  }

  // --- Optimized Drag & Drop Logic ---
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Essential to allow dropping
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: TaskStatus) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    if (!id) return;

    const taskIndex = tasks.findIndex(t => t.id === id);
    if (taskIndex === -1) return;
    
    if (tasks[taskIndex].status === targetStatus) return; // No change

    const updatedTasks = [...tasks];
    updatedTasks[taskIndex] = { ...updatedTasks[taskIndex], status: targetStatus };
    setTasks(updatedTasks);

    try {
        await db.tasks.updateStatus(id, targetStatus);
    } catch (err) {
        console.error("Failed to update task status", err);
        loadData();
    }
  };

  const getPriorityColor = (priority?: string) => {
    switch(priority) {
        case 'HIGH': return 'bg-red-50 text-red-700 border-red-200';
        case 'LOW': return 'bg-blue-50 text-blue-700 border-blue-200';
        default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  // Helper to format date nicely
  const formatDateDisplay = (isoString: string) => {
      const date = new Date(isoString);
      const today = new Date();
      const isToday = date.getDate() === today.getDate() && date.getMonth() === today.getMonth();
      const isTomorrow = date.getDate() === today.getDate() + 1 && date.getMonth() === today.getMonth();
      
      const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const dayStr = isToday ? 'Hoy' : isTomorrow ? 'Mañana' : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
      
      return `${dayStr} ${timeStr}`;
  };

  const Column = ({ title, status, icon: Icon, color }: { title: string, status: TaskStatus, icon: any, color: string }) => {
    const columnTasks = tasks.filter(t => t.status === status);
    
    return (
      <div 
        className="flex-1 min-w-[320px] flex flex-col h-full rounded-2xl bg-gray-50/50 border border-gray-200/50 transition-colors"
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, status)}
      >
        <div className="p-4 flex items-center gap-2 border-b border-gray-100/50">
          <div className={`p-2 rounded-lg bg-white shadow-sm border border-gray-100 ${color}`}>
            <Icon className="w-4 h-4" />
          </div>
          <h3 className="font-bold text-gray-700 text-sm uppercase tracking-wide">{title}</h3>
          <span className="ml-auto text-xs font-semibold text-gray-500 bg-white px-2 py-1 rounded-md border border-gray-200">{columnTasks.length}</span>
        </div>
        
        <div className="p-3 space-y-3 overflow-y-auto flex-1 custom-scrollbar">
          {columnTasks.map(task => {
              const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== TaskStatus.DONE;
              
              return (
                <div 
                key={task.id} 
                draggable="true"
                onDragStart={(e) => handleDragStart(e, task.id)}
                className="group bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-black/20 cursor-grab active:cursor-grabbing transition-all select-none relative flex flex-col gap-3"
                >
                    <div className="flex justify-between items-start">
                        <p className="font-semibold text-sm text-gray-900 leading-snug">{task.title}</p>
                        <button 
                            onClick={(e) => { e.stopPropagation(); deleteTask(task.id); }}
                            className="text-gray-300 hover:text-red-500 transition-colors -mr-1 -mt-1 p-1"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    </div>
                    
                    {task.description && (
                        <p className="text-xs text-gray-500 line-clamp-2">{task.description}</p>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-gray-50 mt-1">
                        <div className="flex items-center gap-2">
                            {/* Assignee Avatar */}
                            {task.assignee ? (
                                <div className="w-6 h-6 rounded-full bg-black text-white flex items-center justify-center text-[10px] font-bold border border-white shadow-sm" title={task.assignee.name}>
                                    {task.assignee.name.charAt(0)}
                                </div>
                            ) : (
                                <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center border border-dashed border-gray-300">
                                    <User className="w-3 h-3 text-gray-400" />
                                </div>
                            )}
                            
                            {/* Due Date */}
                            {task.dueDate && (
                                <div className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md ${isOverdue ? 'bg-red-50 text-red-600 font-medium' : 'bg-gray-50 text-gray-500'}`}>
                                    <CalendarIcon className="w-3 h-3" />
                                    {formatDateDisplay(task.dueDate)}
                                </div>
                            )}
                        </div>

                        {/* Priority Badge */}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${getPriorityColor(task.priority)}`}>
                            {task.priority === 'MEDIUM' ? 'Normal' : task.priority === 'HIGH' ? 'Alta' : 'Baja'}
                        </span>
                    </div>
                </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
        <div className="flex flex-col h-[calc(100vh-100px)] items-center justify-center text-gray-400 space-y-4">
            <Loader2 className="w-8 h-8 animate-spin text-black" />
            <p className="text-sm font-medium">Sincronizando tablero...</p>
        </div>
    );
  }

  if (error) {
      return (
        <div className="flex flex-col h-screen items-center justify-center gap-4">
            <div className="p-4 bg-red-50 text-red-600 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                {error}
            </div>
            <Button onClick={loadData} variant="outline"><RefreshCw className="w-4 h-4 mr-2"/> Reintentar</Button>
        </div>
      )
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 h-[calc(100vh-100px)] flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center px-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Tablero Kanban</h1>
          <p className="text-sm text-gray-500">Arrastra tarjetas para actualizar el estado.</p>
        </div>
        <div className="flex gap-2">
            <Button variant="ghost" onClick={loadData} title="Refrescar">
                <RefreshCw className="w-4 h-4" />
            </Button>
            <Button onClick={() => setIsModalOpen(true)} className="shadow-lg shadow-black/10">
                <Plus className="w-4 h-4 mr-2" /> Nueva Tarea
            </Button>
        </div>
      </div>

      {/* Board */}
      <div className="flex gap-4 md:gap-6 overflow-x-auto pb-4 h-full snap-x">
        <Column title="Por Hacer" status={TaskStatus.TODO} icon={Circle} color="text-gray-400" />
        <Column title="En Progreso" status={TaskStatus.IN_PROGRESS} icon={Clock} color="text-blue-500" />
        <Column title="Completado" status={TaskStatus.DONE} icon={CheckCircle2} color="text-green-500" />
      </div>

      {/* New Task Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Crear Tarea Manual">
        <form onSubmit={createTask} className="space-y-4">
          <div>
            <Label>Título de la Tarea</Label>
            <Input 
              value={formData.title} 
              onChange={e => setFormData({...formData, title: e.target.value})} 
              placeholder="Ej: Diseño de Creativos" 
              autoFocus 
            />
          </div>
          
          <div>
            <Label>Descripción</Label>
            <Textarea 
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
                placeholder="Detalles sobre lo que hay que hacer..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
                <Label>Responsable</Label>
                <select 
                    className="flex h-11 w-full rounded-xl border border-gray-200 bg-gray-50/50 px-3 py-2 text-sm outline-none focus:border-black transition-colors"
                    value={formData.assigneeId}
                    onChange={e => setFormData({...formData, assigneeId: e.target.value})}
                >
                    <option value="">Sin Asignar</option>
                    {contractors.map(c => (
                        <option key={c.id} value={c.id}>{c.name} ({c.role})</option>
                    ))}
                </select>
            </div>
            <div>
                <Label>Prioridad</Label>
                <select 
                    className="flex h-11 w-full rounded-xl border border-gray-200 bg-gray-50/50 px-3 py-2 text-sm outline-none focus:border-black transition-colors"
                    value={formData.priority}
                    onChange={e => setFormData({...formData, priority: e.target.value as any})}
                >
                    <option value="LOW">Baja</option>
                    <option value="MEDIUM">Media</option>
                    <option value="HIGH">Alta</option>
                </select>
            </div>
          </div>

          <div>
             <Label>Fecha de Entrega</Label>
             <Input 
                type="datetime-local" 
                value={formData.dueDate} 
                onChange={e => setFormData({...formData, dueDate: e.target.value})} 
             />
          </div>

          <div className="mt-6 flex gap-2">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)} className="flex-1">Cancelar</Button>
            <Button type="submit" className="flex-1">Crear Tarea</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
