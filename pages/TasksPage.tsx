import React, { useEffect, useState } from 'react';
import { db } from '../services/db';
import { Task, TaskStatus } from '../types';
import { Button, Card, Input, Label, Badge, Modal } from '../components/UIComponents';
import { CheckCircle2, Circle, Clock, Plus, Trash2, GripVertical } from 'lucide-react';

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    const data = await db.tasks.getAll();
    setTasks(data);
  };

  const createTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle) return;
    await db.tasks.create({ title: newTaskTitle, status: TaskStatus.TODO });
    setNewTaskTitle('');
    setIsModalOpen(false);
    loadTasks();
  };

  const deleteTask = async (id: string) => {
    if(confirm('¿Eliminar?')) {
        await db.tasks.delete(id);
        loadTasks();
    }
  }

  // --- Drag & Drop Logic ---
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedTaskId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Necessary to allow dropping
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: TaskStatus) => {
    e.preventDefault();
    if (!draggedTaskId) return;

    // Optimistic UI Update
    const updatedTasks = tasks.map(t => 
        t.id === draggedTaskId ? { ...t, status: targetStatus } : t
    );
    setTasks(updatedTasks);
    setDraggedTaskId(null);

    // DB Update
    await db.tasks.updateStatus(draggedTaskId, targetStatus);
  };

  const Column = ({ title, status, icon: Icon, color }: { title: string, status: TaskStatus, icon: any, color: string }) => {
    const columnTasks = tasks.filter(t => t.status === status);
    
    return (
      <div 
        className={`flex-1 min-w-[300px] flex flex-col h-full rounded-2xl bg-gray-50/50 border border-dashed ${draggedTaskId ? 'border-gray-300' : 'border-transparent'} transition-colors`}
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, status)}
      >
        <div className="p-4 flex items-center gap-2 border-b border-gray-100">
          <Icon className={`w-5 h-5 ${color}`} />
          <h3 className="font-bold text-gray-700">{title}</h3>
          <Badge variant="outline" className="ml-auto bg-white">{columnTasks.length}</Badge>
        </div>
        
        <div className="p-3 space-y-3 overflow-y-auto flex-1">
          {columnTasks.map(task => (
            <div 
              key={task.id} 
              draggable 
              onDragStart={(e) => handleDragStart(e, task.id)}
              className="group bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md cursor-grab active:cursor-grabbing transition-all select-none relative"
            >
              <div className="flex justify-between items-start">
                 <div className="flex gap-2">
                    <GripVertical className="w-4 h-4 text-gray-300 mt-0.5" />
                    <p className="font-medium text-sm text-gray-900 leading-snug">{task.title}</p>
                 </div>
              </div>
              <button 
                onClick={() => deleteTask(task.id)} 
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-opacity p-1"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
          {columnTasks.length === 0 && (
             <div className="h-24 flex items-center justify-center text-gray-300 text-sm italic">
                Arrastra tareas aquí
             </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 h-[calc(100vh-100px)] flex flex-col">
      <div className="flex justify-between items-center px-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Tablero Kanban</h1>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="shadow-lg">
          <Plus className="w-4 h-4 mr-2" /> Nueva Tarea
        </Button>
      </div>

      <div className="flex gap-4 md:gap-6 overflow-x-auto pb-4 h-full">
        <Column title="Por Hacer" status={TaskStatus.TODO} icon={Circle} color="text-gray-400" />
        <Column title="En Progreso" status={TaskStatus.IN_PROGRESS} icon={Clock} color="text-blue-500" />
        <Column title="Completado" status={TaskStatus.DONE} icon={CheckCircle2} color="text-green-500" />
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Agregar Tarea Rápida">
        <form onSubmit={createTask}>
          <Label>¿Qué hay que hacer?</Label>
          <Input 
            value={newTaskTitle} 
            onChange={e => setNewTaskTitle(e.target.value)} 
            placeholder="Ej: Revisar campaña de Rocio" 
            autoFocus 
          />
          <div className="mt-4 flex gap-2">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)} className="flex-1">Cancelar</Button>
            <Button type="submit" className="flex-1">Crear</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
