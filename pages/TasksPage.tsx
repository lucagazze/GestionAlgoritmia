
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
  Sun,
  MessageCircle
} from 'lucide-react';

// View Modes
type ViewMode = 'TODAY' | 'WEEK' | 'CALENDAR';

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  
  const [viewMode, setViewMode] = useState<ViewMode>('CALENDAR'); 
  const [searchTerm, setSearchTerm] = useState('');
  
  const [referenceDate, setReferenceDate] = useState(new Date()); 
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; task: Task | null }>({ x: 0, y: 0, task: null });

  const [isAiGenerating, setIsAiGenerating] = useState(false);

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

  const handleAiAssist = async () => {
      if (!formData.title) {
          alert("Escribe un título primero para que la IA sepa en qué ayudarte.");
          return;
      }
      setIsAiGenerating(true);
      try {
          const prompt = `Actúa como un Project Manager eficiente. Tengo una tarea titulada: "${formData.title}". Genera una descripción breve y 3-5 pasos accionables.`;
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

  const handleContextMenu = (e: React.MouseEvent, task: Task) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({ x: e.pageX, y: e.pageY, task });
  };

  const handleCloseContextMenu = () => {
      setContextMenu({ ...contextMenu, task: null });
  };

  const sendPartnerReminder = (task: Task) => {
      if (!task.assigneeId) return;
      const partner = contractors.find(c => c.id === task.assigneeId);
      if (!partner || !partner.phone) {
          alert("El socio asignado no tiene teléfono registrado. Ve a la pestaña Equipo para agregarlo.");
          return;
      }

      const message = `Hola ${partner.name.split(' ')[0]}, te recuerdo esta tarea pendiente: *${task.title}*.\n\n${task.description ? 'Detalles: ' + task.description : ''}\n\nAvísame cuando esté lista!`;
      const url = `https://wa.me/${partner.phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
      window.open(url, '_blank');
  };

  const handleDoubleClickDate = (date: Date, hour?: number) => {
      const newDate = new Date(date);
      if (hour !== undefined) {
          newDate.setHours(hour, 0, 0, 0);
      } else {
          newDate.setHours(12, 0, 0, 0); 
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
      // Rotate: TODO -> DONE -> TODO (Removed IN_PROGRESS)
      let newStatus = TaskStatus.TODO;
      if (task.status === TaskStatus.TODO) newStatus = TaskStatus.DONE;
      // else if done -> todo (default)
      
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
    setContextMenu({ x: 0, y: 0, task: null });
    
    if(confirm('¿Estás seguro de eliminar esta tarea?')) {
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

  const handleDragEnd = () => {
      setDragOverSlot(null);
  };

  const handleDrop = async (e: React.DragEvent, date: Date, hour?: number) => {
      e.preventDefault();
      setDragOverSlot(null); 

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

  const getTaskStyles = (status: TaskStatus) => {
      switch(status) {
          case TaskStatus.DONE: 
              return 'bg-emerald-50 border-l-4 border-l-emerald-500 text-emerald-900 opacity-60 line-through decoration-emerald-500/50';
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

      return (
          <div className="flex-1 overflow-y-auto">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full">
                  <div className="flex flex-col gap-4">
                      {todayTasks.length === 0 ? <p className="text-gray-400">Sin tareas para hoy.</p> : todayTasks.map(t => (
                          <div key={t.id} onClick={() => openEditModal(t)} className={`p-4 rounded-xl border ${getTaskStyles(t.status)} cursor-pointer`}>
                              <div className="font-bold">{t.title}</div>
                              <div className="text-xs">{new Date(t.dueDate!).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                          </div>
                      ))}
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
    const hours = Array.from({length: 13}, (_, i) => i + 8); 

    return (
        <div className="flex flex-col h-full animate-in fade-in overflow-hidden border border-gray-300 rounded-xl bg-white shadow-sm">
            <div className="flex items-center justify-between p-2 border-b border-gray-300 bg-gray-50/50 flex-shrink-0">
                <button onClick={() => {const d=new Date(referenceDate); d.setDate(d.getDate()-7); setReferenceDate(d)}} className="p-1 hover:bg-gray-200 rounded"><ChevronLeft className="w-5 h-5 text-gray-500"/></button>
                <div className="font-bold text-gray-900 text-sm">{startOfWeek.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</div>
                <button onClick={() => {const d=new Date(referenceDate); d.setDate(d.getDate()+7); setReferenceDate(d)}} className="p-1 hover:bg-gray-200 rounded"><ChevronRight className="w-5 h-5 text-gray-500"/></button>
            </div>
            <div className="flex-1 flex flex-col min-h-0 overflow-y-auto"> 
                <div className="flex min-h-[600px]">
                    <div className="w-12 flex-shrink-0 border-r border-gray-300 bg-gray-50/30">
                         <div className="h-8 border-b border-gray-300"></div>
                        {hours.map(h => <div key={h} className="h-20 border-b border-gray-200 text-[10px] text-gray-400 flex justify-center pt-1">{h}:00</div>)}
                    </div>
                    {weekDays.map((date, idx) => (
                        <div key={idx} className="flex-1 flex flex-col border-r border-gray-300 last:border-r-0 min-w-[100px]">
                            <div className="h-8 flex items-center justify-center border-b border-gray-300 bg-gray-50/30 text-xs font-bold text-gray-600">
                                {date.getDate()} {date.toLocaleDateString('es-ES', { weekday: 'short' })}
                            </div>
                            <div className="flex-1 relative bg-white">
                                {hours.map(h => (
                                    <div key={h} className="h-20 border-b border-gray-100" onDrop={(e)=>handleDrop(e, date, h)} onDragOver={(e)=>handleDragOver(e, `${date.toISOString()}-${h}`)}></div>
                                ))}
                                {tasks.filter(t => t.dueDate && new Date(t.dueDate).toDateString() === date.toDateString()).map(t => {
                                    const h = new Date(t.dueDate!).getHours();
                                    const top = (h - 8) * 80; 
                                    if(top < 0) return null;
                                    return (
                                        <div key={t.id} onClick={()=>openEditModal(t)} className={`absolute left-1 right-1 p-1 rounded text-[10px] shadow-sm cursor-pointer ${getTaskStyles(t.status)}`} style={{top: top + 5, height: '70px'}}>
                                            {t.title}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
  };

  const CalendarView = () => {
    const year = referenceDate.getFullYear();
    const month = referenceDate.getMonth();
    
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    
    const startDayOfWeek = firstDayOfMonth.getDay(); 
    
    const days = [];
    const prevMonthLastDate = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
        days.push(new Date(year, month - 1, prevMonthLastDate - i));
    }
    
    for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
        days.push(new Date(year, month, i));
    }
    
    const remainingCells = 42 - days.length;
    for (let i = 1; i <= remainingCells; i++) {
        days.push(new Date(year, month + 1, i));
    }

    return (
        <div className="bg-white border border-gray-300 rounded-xl overflow-hidden flex flex-col h-full shadow-sm">
            <div className="flex justify-between items-center p-3 border-b border-gray-300 bg-gray-50/50">
                <div className="flex items-center gap-2">
                    <h2 className="font-bold text-lg capitalize text-gray-900">
                        {referenceDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                    </h2>
                </div>
                <div className="flex gap-1">
                    <button onClick={() => { const d = new Date(referenceDate); d.setMonth(d.getMonth()-1); setReferenceDate(d); }} className="p-1.5 hover:bg-gray-200 rounded-lg"><ChevronLeft className="w-5 h-5 text-gray-600"/></button>
                    <button onClick={() => setReferenceDate(new Date())} className="text-xs px-3 hover:bg-gray-200 rounded-lg font-bold border border-gray-300">Hoy</button>
                    <button onClick={() => { const d = new Date(referenceDate); d.setMonth(d.getMonth()+1); setReferenceDate(d); }} className="p-1.5 hover:bg-gray-200 rounded-lg"><ChevronRight className="w-5 h-5 text-gray-600"/></button>
                </div>
            </div>
            
            <div className="grid grid-cols-7 text-center border-b border-gray-300 bg-gray-100">
                {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(d => <div key={d} className="py-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest">{d}</div>)}
            </div>
            
            <div className="grid grid-cols-7 flex-1 bg-gray-200 gap-px border-b border-gray-200">
                {days.map((date, idx) => {
                    const isCurrentMonth = date.getMonth() === month;
                    const slotId = date.toISOString();
                    const isDragTarget = dragOverSlot === slotId;
                    const isToday = new Date().toDateString() === date.toDateString();

                    const dayTasks = tasks.filter(t => {
                         if (!t.title.toLowerCase().includes(searchTerm.toLowerCase())) return false;
                         return t.dueDate && new Date(t.dueDate).toDateString() === date.toDateString();
                    });

                    return (
                        <div 
                          key={idx} 
                          onDragOver={(e) => handleDragOver(e, slotId)}
                          onDrop={(e) => handleDrop(e, date)}
                          onDoubleClick={() => handleDoubleClickDate(date)}
                          className={`
                            relative flex flex-col gap-1 p-1 transition-all group
                            ${isCurrentMonth ? 'bg-white' : 'bg-gray-50/60'}
                            ${isToday ? 'bg-blue-50/40' : ''}
                            ${isDragTarget ? '!bg-indigo-100 ring-2 ring-inset ring-indigo-500 z-10' : 'hover:bg-gray-50'}
                          `}
                        >
                            <div className={`text-[10px] font-medium ml-1 mt-1 w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-blue-600 text-white shadow-md' : isCurrentMonth ? 'text-gray-700' : 'text-gray-400'}`}>
                                {date.getDate()}
                            </div>
                            
                            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1 mt-1">
                                {dayTasks.map(t => (
                                    <div 
                                      key={t.id} 
                                      draggable
                                      onDragStart={(e) => handleDragStart(e, t.id)}
                                      onDragEnd={handleDragEnd}
                                      onClick={(e) => { e.stopPropagation(); openEditModal(t); }}
                                      onContextMenu={(e) => handleContextMenu(e, t)}
                                      className={`text-[10px] px-1.5 py-1 rounded border-l-2 truncate cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-all ${
                                          t.status === TaskStatus.DONE ? 'bg-gray-100 border-gray-400 text-gray-400 line-through' : 
                                          'bg-white border-blue-400 text-gray-800'
                                      }`}
                                    >
                                        {t.title}
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
  };

  if (loading) return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-4 animate-in fade-in duration-500 h-[calc(100vh-2rem)] flex flex-col pt-2">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-3 px-1 flex-shrink-0">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
            <div><h1 className="text-2xl font-bold tracking-tight text-gray-900">Tareas</h1></div>
            <div className="bg-gray-100 p-1 rounded-lg flex gap-1">
                <button onClick={() => setViewMode('TODAY')} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold uppercase transition-all ${viewMode === 'TODAY' ? 'bg-white shadow text-black' : 'text-gray-500 hover:text-black'}`}><Sun className="w-3 h-3" /> Hoy</button>
                <button onClick={() => setViewMode('WEEK')} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold uppercase transition-all ${viewMode === 'WEEK' ? 'bg-white shadow text-black' : 'text-gray-500 hover:text-black'}`}><Columns className="w-3 h-3" /> Semana</button>
                <button onClick={() => setViewMode('CALENDAR')} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold uppercase transition-all ${viewMode === 'CALENDAR' ? 'bg-white shadow text-black' : 'text-gray-500 hover:text-black'}`}><CalendarIcon className="w-3 h-3" /> Mes</button>
            </div>
        </div>
        <div className="flex gap-2 w-full xl:w-auto">
             <div className="relative flex-1 xl:w-64"><Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-gray-400" /><Input placeholder="Buscar..." className="pl-9 h-9 text-sm bg-white" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
            <Button onClick={openCreateModal} className="h-9 shadow-lg shadow-black/10"><Plus className="w-3.5 h-3.5 mr-2" /> Nueva</Button>
        </div>
      </div>

      <div className="flex-1 min-h-0">
          {viewMode === 'TODAY' && <TodayView />}
          {viewMode === 'WEEK' && <WeeklyView />}
          {viewMode === 'CALENDAR' && <CalendarView />}
      </div>
      
      <ContextMenu 
        x={contextMenu.x} y={contextMenu.y} isOpen={!!contextMenu.task} onClose={handleCloseContextMenu}
        items={[
            ...(contextMenu.task?.assigneeId ? [{ 
                label: 'Reclamar a Socio (WhatsApp)', icon: MessageCircle, onClick: () => contextMenu.task && sendPartnerReminder(contextMenu.task), shortcut: "WA"
            }] : []),
            { label: 'Cambiar Estado', icon: CheckCircle2, onClick: () => contextMenu.task && handleToggleStatus(contextMenu.task) },
            { label: 'Editar Tarea', icon: Edit2, onClick: () => contextMenu.task && openEditModal(contextMenu.task) },
            { label: 'Eliminar', icon: Trash2, variant: 'destructive', onClick: () => contextMenu.task && deleteTask(contextMenu.task.id) }
        ]}
      />

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Detalles de la Tarea">
        <form onSubmit={handleSubmit} className="space-y-0">
          <div className="bg-gray-50 -mx-6 -mt-2 px-6 py-4 border-b border-gray-100 flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                  <select value={formData.status} onChange={e => setFormData({...formData,status: e.target.value as any})} className="text-xs font-bold px-3 py-1.5 rounded-full border bg-white cursor-pointer outline-none">
                      <option value={TaskStatus.TODO}>PENDIENTE</option>
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
                  <div className="flex justify-between items-center"><Label>Descripción & Checklist</Label><button type="button" onClick={handleAiAssist} disabled={isAiGenerating} className="text-xs flex items-center gap-1.5 text-indigo-600 font-bold hover:bg-indigo-50 px-2 py-1 rounded-md transition-colors">{isAiGenerating ? <Loader2 className="w-3 h-3 animate-spin"/> : <Sparkles className="w-3 h-3"/>} Autocompletar con IA</button></div>
                  <Textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="min-h-[150px]" placeholder="Detalles o pasos a seguir..." />
              </div>
          </div>
          <div className="pt-6 mt-6 border-t border-gray-100 flex justify-end"><Button type="submit" className="w-full md:w-auto bg-black text-white">Guardar Cambios</Button></div>
        </form>
      </Modal>
    </div>
  );
}
