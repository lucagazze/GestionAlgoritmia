
import React, { useEffect, useState } from 'react';
import { db } from '../services/db';
import { ai } from '../services/ai';
import { Task, TaskStatus, Contractor } from '../types';
import { Button, Input, Label, Modal, Textarea, Badge } from '../components/UIComponents';
import { ContextMenu, ContextMenuItem } from '../components/ContextMenu';
import { 
  CheckCircle2, 
  Clock, 
  Plus, 
  Trash2, 
  User, 
  Loader2,
  Calendar as CalendarIcon,
  Search,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Flag,
  Columns,
  Edit2,
  Sparkles,
  LayoutGrid,
  Sun
} from 'lucide-react';

// View Modes
type ViewMode = 'TODAY' | 'WEEK' | 'CALENDAR';
type SortKey = 'dueDate' | 'priority' | 'status' | 'title';

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  
  const [viewMode, setViewMode] = useState<ViewMode>('WEEK');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Date Navigation State
  const [referenceDate, setReferenceDate] = useState(new Date()); 
  
  // Drag Visual State
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; task: Task | null }>({ x: 0, y: 0, task: null });

  // AI State
  const [isAiGenerating, setIsAiGenerating] = useState(false);

  // Create/Edit Form State
  const [formData, setFormData] = useState<{
    id?: string;
    title: string;
    description: string;
    assigneeId: string;
    dueDate: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH';
    status: TaskStatus;
  }>({
    title: '',
    description: '',
    assigneeId: '',
    dueDate: '',
    priority: 'MEDIUM',
    status: TaskStatus.TODO
  });

  useEffect(() => {
    loadData();
    const handleTaskCreated = () => { loadData(); };
    window.addEventListener('task-created', handleTaskCreated);
    return () => { window.removeEventListener('task-created', handleTaskCreated); };
  }, []);

  const loadData = async () => {
    try {
      const [tasksData, contractorsData] = await Promise.all([
        db.tasks.getAll(),
        db.contractors.getAll()
      ]);
      setTasks(tasksData);
      setContractors(contractorsData);
    } catch (err) {
      console.error("Failed to load tasks", err);
    } finally {
      setLoading(false);
    }
  };

  // --- AI Handler ---
  const handleAiAssist = async () => {
      if (!formData.title) {
          alert("Escribe un título primero para que la IA sepa en qué ayudarte.");
          return;
      }
      setIsAiGenerating(true);
      try {
          const prompt = `
          Actúa como un Project Manager eficiente.
          Tengo una tarea titulada: "${formData.title}".
          
          Genera una descripción breve y profesional, seguida de una lista de 3 a 5 pasos accionables (checklist) para completarla.
          Formato: Texto plano, directo al grano.
          `;
          
          const response = await ai.chat([{ role: 'user', content: prompt }]);
          
          setFormData(prev => ({
              ...prev,
              description: prev.description ? prev.description + "\n\n--- Sugerencia IA ---\n" + response : response
          }));
      } catch (error) {
          console.error(error);
          alert("La IA no pudo responder en este momento.");
      } finally {
          setIsAiGenerating(false);
      }
  };

  // --- Handlers ---

  const handleContextMenu = (e: React.MouseEvent, task: Task) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({ x: e.pageX, y: e.pageY, task });
  };

  const handleCloseContextMenu = () => {
      setContextMenu({ ...contextMenu, task: null });
  };

  const handleDoubleClickDate = (date: Date, hour?: number) => {
      const newDate = new Date(date);
      if (hour !== undefined) {
          newDate.setHours(hour, 0, 0, 0);
      } else {
          newDate.setHours(12, 0, 0, 0); // Default noon
      }
      
      const tzOffset = newDate.getTimezoneOffset() * 60000;
      const localISOTime = (new Date(newDate.getTime() - tzOffset)).toISOString().slice(0, 16);

      setFormData({ 
          title: '', 
          description: '', 
          assigneeId: '', 
          dueDate: localISOTime, 
          priority: 'MEDIUM', 
          status: TaskStatus.TODO 
      });
      setIsModalOpen(true);
  };

  const handleToggleStatus = async (task: Task) => {
      // Rotate: TODO -> IN_PROGRESS -> DONE -> TODO
      let newStatus = TaskStatus.TODO;
      if (task.status === TaskStatus.TODO) newStatus = TaskStatus.IN_PROGRESS;
      else if (task.status === TaskStatus.IN_PROGRESS) newStatus = TaskStatus.DONE;
      
      const updatedTasks = tasks.map(t => t.id === task.id ? { ...t, status: newStatus } : t);
      setTasks(updatedTasks);
      await db.tasks.updateStatus(task.id, newStatus);
  };

  const openCreateModal = () => {
      const defaultDate = new Date(referenceDate);
      defaultDate.setHours(12, 0, 0, 0);
      const tzOffset = defaultDate.getTimezoneOffset() * 60000;
      const localISOTime = (new Date(defaultDate.getTime() - tzOffset)).toISOString().slice(0, 16);

      setFormData({ title: '', description: '', assigneeId: '', dueDate: localISOTime, priority: 'MEDIUM', status: TaskStatus.TODO });
      setIsModalOpen(true);
  };

  const openEditModal = (task: Task) => {
      let dueIso = '';
      if (task.dueDate) {
         const d = new Date(task.dueDate);
         const tzOffset = d.getTimezoneOffset() * 60000;
         dueIso = (new Date(d.getTime() - tzOffset)).toISOString().slice(0, 16);
      }

      setFormData({
          id: task.id,
          title: task.title,
          description: task.description || '',
          assigneeId: task.assigneeId || '',
          dueDate: dueIso,
          priority: task.priority || 'MEDIUM',
          status: task.status
      });
      setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title) return;

    try {
        const payload = {
            title: formData.title,
            description: formData.description,
            status: formData.status,
            assigneeId: formData.assigneeId || null,
            dueDate: formData.dueDate ? new Date(formData.dueDate).toISOString() : null,
            priority: formData.priority
        };

        if (formData.id) {
             await db.tasks.delete(formData.id);
             await db.tasks.create(payload);
        } else {
            await db.tasks.create(payload);
        }
        
        setIsModalOpen(false);
        loadData(); 
    } catch (err) {
        alert("Error al guardar la tarea");
    }
  };

  const deleteTask = async (id: string) => {
    // Force close menu to ensure clean state
    setContextMenu({ x: 0, y: 0, task: null });
    
    if(confirm('¿Estás seguro de eliminar esta tarea?')) {
        // Optimistic update
        setTasks(prev => prev.filter(t => t.id !== id)); 
        await db.tasks.delete(id);
        setIsModalOpen(false);
    }
  };

  // --- Helpers ---
  const getStartOfWeek = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay(); 
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const handleDragStart = (e: React.DragEvent, id: string) => { 
      e.dataTransfer.setData('text/plain', id); 
      e.dataTransfer.effectAllowed = 'move'; 
  };
  
  const handleDragOver = (e: React.DragEvent, slotId: string) => { 
      e.preventDefault(); 
      e.dataTransfer.dropEffect = 'move';
      if (dragOverSlot !== slotId) {
          setDragOverSlot(slotId);
      }
  };

  const handleDragLeave = () => {
      // Optional: Logic to clear, but often tricky with child elements
      // We rely on Drop or DragEnd to clear mainly
  };

  const handleDrop = async (e: React.DragEvent, date: Date, hour?: number) => {
      e.preventDefault();
      setDragOverSlot(null); // Clear highlight

      const id = e.dataTransfer.getData('text/plain');
      if (!id) return;

      const task = tasks.find(t => t.id === id);
      if (!task) return;

      const newDate = new Date(date);
      if (hour !== undefined) {
          newDate.setHours(hour, 0, 0, 0);
      } else if (task.dueDate) {
          const old = new Date(task.dueDate);
          newDate.setHours(old.getHours(), old.getMinutes());
      } else {
          newDate.setHours(12, 0, 0, 0);
      }

      const updatedTasks = tasks.map(t => t.id === id ? { ...t, dueDate: newDate.toISOString() } : t);
      setTasks(updatedTasks);
      
      await db.tasks.delete(id);
      await db.tasks.create({ ...task, dueDate: newDate.toISOString(), status: task.status }); 
      loadData();
  };

  const handleDragEnd = () => {
      setDragOverSlot(null);
  };

  // --- Styling Helper ---
  const getTaskStyles = (status: TaskStatus) => {
      switch(status) {
          case TaskStatus.DONE: 
              return 'bg-emerald-50 border-l-4 border-l-emerald-500 text-emerald-900 opacity-60 line-through decoration-emerald-500/50';
          case TaskStatus.IN_PROGRESS: 
              return 'bg-amber-50 border-l-4 border-l-amber-500 text-amber-900 shadow-sm';
          default: 
              return 'bg-white border-l-4 border-l-blue-500 text-gray-900 shadow-sm';
      }
  };

  // --- Views ---

  const TodayView = () => {
      const today = new Date();
      const todayTasks = tasks.filter(t => {
          if (!t.title.toLowerCase().includes(searchTerm.toLowerCase())) return false;
          if (!t.dueDate) return false;
          const d = new Date(t.dueDate);
          return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
      }).sort((a,b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());

      const pendingTasks = tasks.filter(t => {
          if (!t.title.toLowerCase().includes(searchTerm.toLowerCase())) return false;
          return t.status !== TaskStatus.DONE && (!t.dueDate || new Date(t.dueDate) < new Date(today.setHours(0,0,0,0)));
      });

      return (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full min-h-0">
              {/* Today's Agenda */}
              <div className="md:col-span-2 flex flex-col gap-4 bg-white border border-gray-200 rounded-xl p-6 shadow-sm overflow-hidden">
                  <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                          <Sun className="w-6 h-6 text-orange-500" />
                          <h2 className="text-xl font-bold text-gray-900">Agenda de Hoy</h2>
                      </div>
                      <span className="text-sm text-gray-500 font-medium capitalize">{new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                      {todayTasks.length === 0 ? (
                          <div className="h-full flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-100 rounded-xl">
                              <CalendarIcon className="w-10 h-10 mb-2 opacity-20" />
                              <p>No hay tareas programadas para hoy.</p>
                              <Button variant="ghost" size="sm" onClick={openCreateModal} className="mt-2 text-blue-600">Crear una tarea</Button>
                          </div>
                      ) : (
                          todayTasks.map(t => {
                              const hour = new Date(t.dueDate!).toLocaleTimeString('es-ES', {hour: '2-digit', minute:'2-digit'});
                              return (
                                  <div 
                                    key={t.id} 
                                    onContextMenu={(e) => handleContextMenu(e, t)}
                                    onClick={() => openEditModal(t)}
                                    className={`group flex items-start gap-4 p-4 rounded-xl border transition-all hover:shadow-md cursor-pointer ${getTaskStyles(t.status)}`}
                                  >
                                      <div className="w-16 pt-1 text-center border-r border-black/5 pr-4 flex-shrink-0">
                                          <span className="text-lg font-bold text-gray-700 block leading-none">{hour}</span>
                                      </div>
                                      <div className="flex-1 min-w-0">
                                          <div className="flex justify-between items-start">
                                               <h3 className={`font-bold text-sm truncate ${t.status === TaskStatus.DONE ? 'line-through text-gray-500' : 'text-gray-900'}`}>{t.title}</h3>
                                               {t.priority === 'HIGH' && <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0 mt-1"></div>}
                                          </div>
                                          {t.description && <p className="text-xs text-gray-500 mt-1 line-clamp-1">{t.description}</p>}
                                          <div className="mt-2 flex items-center gap-2">
                                              {t.assignee && <Badge variant="outline" className="text-[10px] bg-white/50">{t.assignee.name}</Badge>}
                                              <Badge className={`text-[10px] ${t.status === TaskStatus.DONE ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>{t.status === 'IN_PROGRESS' ? 'EN PROCESO' : t.status}</Badge>
                                          </div>
                                      </div>
                                  </div>
                              );
                          })
                      )}
                  </div>
              </div>

              {/* Backlog / Overdue */}
              <div className="flex flex-col gap-4 bg-gray-50 border border-gray-200 rounded-xl p-6 shadow-inner overflow-hidden">
                   <h3 className="font-bold text-gray-600 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> Pendientes / Atrasados</h3>
                   <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                       {pendingTasks.map(t => (
                           <div key={t.id} onClick={() => openEditModal(t)} onContextMenu={(e) => handleContextMenu(e, t)} className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm hover:border-black/20 cursor-pointer transition-all">
                               <div className="flex justify-between items-start">
                                   <p className="text-xs font-bold text-gray-800 line-clamp-2">{t.title}</p>
                                   {t.priority === 'HIGH' && <Flag className="w-3 h-3 text-red-500 flex-shrink-0" />}
                               </div>
                               {t.dueDate && <p className="text-[10px] text-red-400 mt-1 flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(t.dueDate).toLocaleDateString()}</p>}
                           </div>
                       ))}
                       {pendingTasks.length === 0 && <p className="text-xs text-gray-400 text-center py-4">¡Todo al día!</p>}
                   </div>
              </div>
          </div>
      );
  };

  const WeeklyView = () => {
    const startOfWeek = getStartOfWeek(referenceDate);
    const weekDays = [];
    for (let i = 0; i < 7; i++) {
        const day = new Date(startOfWeek);
        day.setDate(startOfWeek.getDate() + i);
        weekDays.push(day);
    }
    
    // Time Slots (08:00 to 20:00) - 13 Slots
    const hours = Array.from({length: 13}, (_, i) => i + 8); 

    const nextWeek = () => {
        const d = new Date(referenceDate);
        d.setDate(d.getDate() + 7);
        setReferenceDate(d);
    };
    const prevWeek = () => {
        const d = new Date(referenceDate);
        d.setDate(d.getDate() - 7);
        setReferenceDate(d);
    };

    return (
        <div className="flex flex-col h-full animate-in fade-in overflow-hidden border border-gray-300 rounded-xl bg-white shadow-sm">
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-gray-300 bg-gray-50/50 flex-shrink-0">
                <button onClick={prevWeek} className="p-1.5 hover:bg-gray-200 rounded-full"><ChevronLeft className="w-5 h-5 text-gray-500"/></button>
                <div className="font-bold text-gray-900 capitalize text-base">{startOfWeek.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</div>
                <button onClick={nextWeek} className="p-1.5 hover:bg-gray-200 rounded-full"><ChevronRight className="w-5 h-5 text-gray-500"/></button>
            </div>

            {/* Grid Container - FLEX COLUMN to force fit height */}
            <div className="flex-1 flex flex-col min-h-0"> 
                {/* Columns Wrapper */}
                <div className="flex flex-1 min-h-0">
                    
                    {/* Time Column */}
                    <div className="w-14 flex-shrink-0 border-r border-gray-300 bg-gray-50/30 flex flex-col z-20">
                        <div className="h-10 border-b border-gray-300 flex-shrink-0 bg-gray-50/50"></div> {/* Spacer for header */}
                        {hours.map(h => (
                            <div key={h} className="flex-1 border-b border-gray-200 text-[10px] text-gray-500 font-semibold font-mono flex justify-center items-center">
                                {h}:00
                            </div>
                        ))}
                    </div>

                    {/* Day Columns */}
                    {weekDays.map((date, idx) => {
                        const isToday = new Date().toDateString() === date.toDateString();
                        
                        return (
                            <div key={idx} className="flex-1 flex flex-col border-r border-gray-300 last:border-r-0 min-w-[100px]">
                                {/* Day Header */}
                                <div className={`h-10 flex-shrink-0 flex flex-col items-center justify-center border-b border-gray-300 ${isToday ? 'bg-blue-50 text-blue-700' : 'bg-gray-50/30'}`}>
                                    <div className="flex items-center gap-1">
                                        <span className={`text-[10px] uppercase font-bold tracking-wider ${isToday ? 'text-blue-700' : 'text-gray-400'}`}>{date.toLocaleDateString('es-ES', { weekday: 'short' })}</span>
                                        <span className={`text-xs font-bold ${isToday ? 'bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center shadow-md shadow-blue-200' : 'text-gray-700'}`}>
                                            {date.getDate()}
                                        </span>
                                    </div>
                                </div>

                                {/* Hourly Slots - FLEX GROW to fill remaining space equally */}
                                <div className="flex-1 flex flex-col min-h-0 bg-white">
                                    {hours.map(h => {
                                        const slotId = `${date.toISOString()}-${h}`;
                                        const isDragTarget = dragOverSlot === slotId;

                                        const slotTasks = tasks.filter(t => {
                                            if (!t.title.toLowerCase().includes(searchTerm.toLowerCase())) return false;
                                            if (!t.dueDate) return false;
                                            const d = new Date(t.dueDate);
                                            return d.getDate() === date.getDate() && 
                                                   d.getMonth() === date.getMonth() && 
                                                   d.getHours() === h;
                                        });

                                        return (
                                            <div 
                                                key={h} 
                                                className={`flex-1 border-b border-gray-200 transition-all duration-200 relative group min-h-[40px] flex flex-col justify-center 
                                                    ${isDragTarget ? 'bg-indigo-100 ring-2 ring-indigo-500 ring-inset z-10' : 'hover:bg-gray-50'}`}
                                                onDragOver={(e) => handleDragOver(e, slotId)}
                                                onDrop={(e) => handleDrop(e, date, h)}
                                                onDoubleClick={() => handleDoubleClickDate(date, h)}
                                            >
                                                {/* Hover Action Indicator */}
                                                {!isDragTarget && (
                                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none z-0 transition-opacity duration-200">
                                                        <div className="bg-white/90 rounded-full p-1.5 shadow-sm border border-gray-200">
                                                            <Plus className="w-4 h-4 text-blue-500" />
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Tasks in this slot */}
                                                <div className="flex flex-col gap-1 px-1 py-0.5 w-full relative z-10 h-full justify-center">
                                                    {slotTasks.map(t => (
                                                        <div 
                                                            key={t.id} 
                                                            draggable
                                                            onDragStart={(e) => handleDragStart(e, t.id)}
                                                            onDragEnd={handleDragEnd}
                                                            onClick={() => openEditModal(t)}
                                                            onContextMenu={(e) => handleContextMenu(e, t)}
                                                            className={`px-2 py-1.5 rounded-md text-[11px] cursor-grab active:cursor-grabbing hover:scale-[1.02] hover:shadow-md transition-all flex items-center gap-1.5 leading-tight shadow-sm ${getTaskStyles(t.status)}`}
                                                        >
                                                            {t.priority === 'HIGH' && t.status !== TaskStatus.DONE && <div className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0 animate-pulse" />}
                                                            <div className="truncate font-semibold flex-1">{t.title}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    );
  };

  const CalendarView = () => {
    const year = referenceDate.getFullYear();
    const month = referenceDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));

    return (
        <div className="bg-white border border-gray-300 rounded-xl overflow-hidden flex flex-col h-full shadow-sm">
            <div className="flex justify-between items-center p-4 border-b border-gray-300">
                <h2 className="font-bold text-lg capitalize flex items-center gap-2">
                    <CalendarIcon className="w-5 h-5 text-gray-400" />
                    {referenceDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                </h2>
                <div className="flex gap-2">
                    <button onClick={() => { const d = new Date(referenceDate); d.setMonth(d.getMonth()-1); setReferenceDate(d); }} className="p-2 hover:bg-gray-100 rounded-lg"><ChevronLeft className="w-5 h-5"/></button>
                    <button onClick={() => setReferenceDate(new Date())} className="text-sm px-3 hover:bg-gray-100 rounded-lg font-medium">Hoy</button>
                    <button onClick={() => { const d = new Date(referenceDate); d.setMonth(d.getMonth()+1); setReferenceDate(d); }} className="p-2 hover:bg-gray-100 rounded-lg"><ChevronRight className="w-5 h-5"/></button>
                </div>
            </div>
            <div className="grid grid-cols-7 text-center border-b border-gray-300 bg-gray-50">
                {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(d => <div key={d} className="py-2 text-xs font-bold text-gray-400 uppercase">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 flex-1 auto-rows-fr bg-gray-200 gap-px border-b border-gray-200">
                {days.map((date, idx) => {
                    if (!date) return <div key={idx} className="bg-gray-50/50 min-h-[100px]"></div>;
                    
                    const slotId = date.toISOString();
                    const isDragTarget = dragOverSlot === slotId;

                    const dayTasks = tasks.filter(t => {
                         if (!t.title.toLowerCase().includes(searchTerm.toLowerCase())) return false;
                         return t.dueDate && new Date(t.dueDate).toDateString() === date.toDateString();
                    });
                    const isToday = new Date().toDateString() === date.toDateString();

                    return (
                        <div 
                          key={idx} 
                          onDragOver={(e) => handleDragOver(e, slotId)}
                          onDrop={(e) => handleDrop(e, date)}
                          onDoubleClick={() => handleDoubleClickDate(date)}
                          className={`bg-white p-2 min-h-[100px] transition-all flex flex-col gap-1 group 
                            ${isToday ? 'bg-blue-50/30' : ''} 
                            ${isDragTarget ? '!bg-indigo-100 ring-2 ring-inset ring-indigo-500 z-10' : 'hover:bg-gray-50'}
                          `}
                        >
                            <div className={`text-xs font-medium mb-1 ${isToday ? 'text-blue-600 font-bold' : 'text-gray-400'}`}>{date.getDate()}</div>
                            {dayTasks.map(t => (
                                <div 
                                  key={t.id} 
                                  draggable
                                  onDragStart={(e) => handleDragStart(e, t.id)}
                                  onDragEnd={handleDragEnd}
                                  onClick={() => openEditModal(t)}
                                  onContextMenu={(e) => handleContextMenu(e, t)}
                                  className={`text-[10px] px-1.5 py-1 rounded border-0 truncate cursor-grab active:cursor-grabbing shadow-sm hover:scale-105 transition-all ${getTaskStyles(t.status)}`}
                                >
                                    {t.title}
                                </div>
                            ))}
                        </div>
                    );
                })}
            </div>
        </div>
    );
  };

  if (loading) return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 h-[calc(100vh-100px)] flex flex-col">
      {/* 1. Header & Filters Bar */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 px-2">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-gray-900">Tareas</h1>
            </div>
            
            <div className="bg-gray-100 p-1 rounded-lg flex gap-1">
                <button onClick={() => setViewMode('TODAY')} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'TODAY' ? 'bg-white shadow text-black' : 'text-gray-500 hover:text-black'}`}><Sun className="w-4 h-4" /> Hoy</button>
                <button onClick={() => setViewMode('WEEK')} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'WEEK' ? 'bg-white shadow text-black' : 'text-gray-500 hover:text-black'}`}><Columns className="w-4 h-4" /> Semana</button>
                <button onClick={() => setViewMode('CALENDAR')} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'CALENDAR' ? 'bg-white shadow text-black' : 'text-gray-500 hover:text-black'}`}><CalendarIcon className="w-4 h-4" /> Mes</button>
            </div>
        </div>

        <div className="flex gap-2 w-full xl:w-auto">
             <div className="relative flex-1 xl:w-64">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <Input placeholder="Buscar..." className="pl-9 h-10 bg-white" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
             </div>
            <Button onClick={openCreateModal} className="shadow-lg shadow-black/10"><Plus className="w-4 h-4 mr-2" /> Nueva</Button>
        </div>
      </div>

      {viewMode === 'TODAY' && <TodayView />}
      {viewMode === 'WEEK' && <WeeklyView />}
      {viewMode === 'CALENDAR' && <CalendarView />}
      
      {/* --- CONTEXT MENU --- */}
      <ContextMenu 
        x={contextMenu.x} 
        y={contextMenu.y} 
        isOpen={!!contextMenu.task} 
        onClose={handleCloseContextMenu}
        items={[
            { label: 'Cambiar Estado', icon: CheckCircle2, onClick: () => contextMenu.task && handleToggleStatus(contextMenu.task) },
            { label: 'Editar Tarea', icon: Edit2, onClick: () => contextMenu.task && openEditModal(contextMenu.task) },
            { label: 'Eliminar', icon: Trash2, variant: 'destructive', onClick: () => contextMenu.task && deleteTask(contextMenu.task.id) }
        ]}
      />

      {/* --- MODAL --- */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Detalles de la Tarea">
        <form onSubmit={handleSubmit} className="space-y-0">
          <div className="bg-gray-50 -mx-6 -mt-2 px-6 py-4 border-b border-gray-100 flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                  <select value={formData.status} onChange={e => setFormData({...formData,status: e.target.value as any})} className="text-xs font-bold px-3 py-1.5 rounded-full border bg-white cursor-pointer outline-none">
                      <option value={TaskStatus.TODO}>PENDIENTE</option>
                      <option value={TaskStatus.IN_PROGRESS}>EN PROCESO</option>
                      <option value={TaskStatus.DONE}>COMPLETADA</option>
                  </select>
                  {formData.dueDate && new Date(formData.dueDate) < new Date() && formData.status !== TaskStatus.DONE && <span className="flex items-center text-[10px] font-bold text-red-600 bg-red-50 px-2 py-1 rounded-md border border-red-100"><AlertCircle className="w-3 h-3 mr-1" /> ATRASADA</span>}
              </div>
              {formData.id && <button type="button" onClick={() => deleteTask(formData.id!)} className="text-gray-400 hover:text-red-500 p-2 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>}
          </div>
          <div className="space-y-6">
              <input value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full text-xl font-bold border-none outline-none bg-transparent p-0" placeholder="Título..." autoFocus />
              
              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1.5"><Label><User className="w-3 h-3"/> Responsable</Label><select className="flex h-10 w-full rounded-lg border bg-gray-50/50 px-3 text-sm" value={formData.assigneeId} onChange={e => setFormData({...formData, assigneeId: e.target.value})}><option value="">Sin Asignar</option>{contractors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                 <div className="space-y-1.5"><Label><Flag className="w-3 h-3"/> Prioridad</Label><select className="flex h-10 w-full rounded-lg border bg-gray-50/50 px-3 text-sm" value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value as any})}><option value="LOW">Baja</option><option value="MEDIUM">Media</option><option value="HIGH">Alta</option></select></div>
                 <div className="space-y-1.5 col-span-2"><Label><CalendarIcon className="w-3 h-3"/> Fecha</Label><Input type="datetime-local" className="bg-white" value={formData.dueDate} onChange={e => setFormData({...formData, dueDate: e.target.value})} /></div>
              </div>
              
              <div className="space-y-1.5 relative">
                  <div className="flex justify-between items-center">
                    <Label>Descripción & Checklist</Label>
                    <button 
                        type="button" 
                        onClick={handleAiAssist} 
                        disabled={isAiGenerating} 
                        className="text-xs flex items-center gap-1.5 text-indigo-600 font-bold hover:bg-indigo-50 px-2 py-1 rounded-md transition-colors"
                    >
                        {isAiGenerating ? <Loader2 className="w-3 h-3 animate-spin"/> : <Sparkles className="w-3 h-3"/>}
                        Autocompletar con IA
                    </button>
                  </div>
                  <Textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="min-h-[150px]" placeholder="Detalles o pasos a seguir..." />
              </div>
          </div>
          <div className="pt-6 mt-6 border-t border-gray-100 flex justify-end"><Button type="submit" className="w-full md:w-auto bg-black text-white">Guardar Cambios</Button></div>
        </form>
      </Modal>
    </div>
  );
}
