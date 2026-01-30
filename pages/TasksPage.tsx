import React, { useEffect, useState } from 'react';
import { db } from '../services/db';
import { Task, TaskStatus } from '../types';
import { Button, Card, Input, Label, Badge, Modal } from '../components/UIComponents';
import { CheckCircle2, Circle, Clock, Plus, Trash2 } from 'lucide-react';

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');

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
    await db.tasks.create({
      title: newTaskTitle,
      status: TaskStatus.TODO
    });
    setNewTaskTitle('');
    setIsModalOpen(false);
    loadTasks();
  };

  const moveTask = async (task: Task, newStatus: TaskStatus) => {
    // Optimistic update
    setTasks(tasks.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
    await db.tasks.updateStatus(task.id, newStatus);
  };

  const deleteTask = async (id: string) => {
    if(confirm('¿Eliminar tarea?')) {
        await db.tasks.delete(id);
        loadTasks();
    }
  }

  const Column = ({ title, status, icon: Icon }: { title: string, status: TaskStatus, icon: any }) => {
    const columnTasks = tasks.filter(t => t.status === status);
    
    return (
      <div className="flex-1 min-w-[300px]">
        <div className="flex items-center gap-2 mb-4">
          <Icon className="w-5 h-5 text-gray-400" />
          <h3 className="font-bold text-gray-700">{title}</h3>
          <Badge variant="outline" className="ml-auto">{columnTasks.length}</Badge>
        </div>
        <div className="space-y-3">
          {columnTasks.map(task => (
            <Card key={task.id} className="p-4 hover:shadow-md transition-all cursor-default group border-l-4 border-l-transparent hover:border-l-black">
              <div className="flex justify-between items-start mb-2">
                 <p className="font-medium text-gray-900">{task.title}</p>
                 <button onClick={() => deleteTask(task.id)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
              </div>
              
              <div className="flex gap-2 mt-3 pt-3 border-t border-gray-50">
                {status !== TaskStatus.TODO && (
                  <button 
                    onClick={() => moveTask(task, TaskStatus.TODO)}
                    className="text-xs font-medium text-gray-400 hover:text-black bg-gray-50 px-2 py-1 rounded"
                  >
                    ← Pendiente
                  </button>
                )}
                {status !== TaskStatus.IN_PROGRESS && (
                  <button 
                    onClick={() => moveTask(task, TaskStatus.IN_PROGRESS)}
                    className="text-xs font-medium text-gray-400 hover:text-blue-600 bg-gray-50 px-2 py-1 rounded"
                  >
                   {status === TaskStatus.TODO ? 'Iniciar →' : '← Retomar'}
                  </button>
                )}
                {status !== TaskStatus.DONE && (
                  <button 
                    onClick={() => moveTask(task, TaskStatus.DONE)}
                    className="text-xs font-medium text-gray-400 hover:text-green-600 bg-gray-50 px-2 py-1 rounded ml-auto"
                  >
                    Terminar ✓
                  </button>
                )}
              </div>
            </Card>
          ))}
          {columnTasks.length === 0 && (
             <div className="h-24 border-2 border-dashed border-gray-100 rounded-xl flex items-center justify-center text-gray-300 text-sm">
                Vacío
             </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 h-[calc(100vh-100px)] flex flex-col">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Tablero de Tareas</h1>
          <p className="text-gray-500 mt-2">Organiza tu flujo de trabajo diario.</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> Nueva Tarea
        </Button>
      </div>

      <div className="flex gap-6 overflow-x-auto pb-4 h-full">
        <Column title="Pendientes" status={TaskStatus.TODO} icon={Circle} />
        <Column title="En Progreso" status={TaskStatus.IN_PROGRESS} icon={Clock} />
        <Column title="Completado" status={TaskStatus.DONE} icon={CheckCircle2} />
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Agregar Tarea">
        <form onSubmit={createTask}>
          <Label>Título de la Tarea</Label>
          <Input 
            value={newTaskTitle} 
            onChange={e => setNewTaskTitle(e.target.value)} 
            placeholder="Ej: Enviar reporte mensual a Cliente X" 
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
