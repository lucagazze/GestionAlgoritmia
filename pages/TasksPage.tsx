
import React, { useEffect, useState } from 'react';
import { db } from '../services/db';
import { ai } from '../services/ai';
import { Task, TaskStatus, Contractor, SOP } from '../types';
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
  MessageCircle,
  Book
} from 'lucide-react';

// View Modes
type ViewMode = 'TODAY' | 'WEEK' | 'CALENDAR';

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [sops, setSops] = useState<SOP[]>([]); // Load SOPs
  
  const [viewMode, setViewMode] = useState<ViewMode>('CALENDAR'); 
  const [searchTerm, setSearchTerm] = useState('');
  
  const [referenceDate, setReferenceDate] = useState(new Date()); 
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [sopModalOpen, setSopModalOpen] = useState(false);
  const [selectedSop, setSelectedSop] = useState<SOP | null>(null);
  
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
    sopId: string; // New
  }>({
    title: '',
    description: '',
    assigneeId: '',
    dueDate: '',
    priority: 'MEDIUM',
    status: TaskStatus.TODO,
    sopId: ''
  });

  useEffect(() => {
    loadData();
    const handleTaskCreated = () => { loadData(); };
    window.addEventListener('task-created', handleTaskCreated);
    return () => { window.removeEventListener('task-created', handleTaskCreated); };
  }, []);

  const loadData = async () => {
    try {
      const [tasksData, contractorsData, sopsData] = await Promise.all([
        db.tasks.getAll(),
        db.contractors.getAll(),
        db.sops.getAll()
      ]);
      setTasks(tasksData);
      setContractors(contractorsData);
      setSops(sopsData);
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

  const handleViewSOP = (sopId: string) => {
      const sop = sops.find(s => s.id === sopId);
      if(sop) {
          setSelectedSop(sop);
          setSopModalOpen(true);
      }
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
          status: TaskStatus.TODO,
          sopId: ''
      });
      setIsModalOpen(true);
  };

  const handleToggleStatus = async (task: Task) => {
      // Rotate: TODO -> DONE -> TODO (Removed IN_PROGRESS)
      let newStatus = TaskStatus.TODO;
      if (task.status === TaskStatus.TODO) newStatus = TaskStatus.DONE;
      
      const updatedTasks = tasks.map(t => t.id === task.id ? { ...t, status: newStatus } : t);
      setTasks(updatedTasks);
      try {
          await db.tasks.updateStatus(task.id, newStatus);
      } catch (err) {
          alert("Error de permisos: No se pudo actualizar el estado. Revisa los Ajustes.");
          loadData(); // Revert logic
      }
  };

  const openCreateModal = () => {
      const defaultDate = new Date(referenceDate);
      defaultDate.setHours(12, 0, 0, 0);
      const tzOffset = defaultDate.getTimezoneOffset() * 60000;
      const localISOTime = (new Date(defaultDate.getTime() - tzOffset)).toISOString().slice(0, 16);

      setFormData({ title: '', description: '', assigneeId: '', dueDate: localISOTime, priority: 'MEDIUM', status: TaskStatus.TODO, sopId: '' });
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
          status: task.status,
          sopId: task.sopId || ''
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
            priority: formData.priority,
            sopId: formData.sopId || null
        };

        if (formData.id) {
             await db.tasks.update(formData.id, payload);
        } else {
            await db.tasks.create(payload);
        }
        
        setIsModalOpen(false);
        loadData(); 
    } catch (err) {
        console.error(err);
        alert("ERROR CRÍTICO: No se pudo guardar. Es un problema de permisos en Supabase. Ve a 'Ajustes' y ejecuta el script de reparación.");
    }
  };

  const deleteTask = async (id: string) => {
    setContextMenu({ x: 0, y: 0, task: null });
    
    if(confirm('¿Estás seguro de eliminar esta tarea?')) {
        // Optimistic UI update
        const previousTasks = [...tasks];
        setTasks(prev => prev.filter(t => t.id !== id)); 
        setIsModalOpen(false);

        try {
            await db.tasks.delete(id);
        } catch (error) {
            console.error(error);
            setTasks(previousTasks); // Revert
            alert("NO SE PUDO BORRAR: Error de permisos. Ve a Ajustes > Copiar SQL y ejecútalo en Supabase.");
        }
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
      
      try {
          await db.tasks.update(id, { dueDate: newDate.toISOString() });
      } catch (err) {
          alert("Error de permisos al mover la tarea.");
          loadData();
      }
  };

  const getTaskStyles = (status: TaskStatus) => {
      switch(status) {
          case TaskStatus.DONE: 
              return 'bg-emerald-50 dark:bg-emerald-900/20 border-l-4 border-l-emerald-500 text-emerald-900 dark:text-emerald-300 opacity-60 line-through decoration-emerald-500/50';
          default: 
              return 'bg-white dark:bg-slate-800 border-l-4 border-l-blue-500 text-gray-900 dark:text-white shadow-sm';
      }
  };

  // --- Views ---

  const TodayView = () => {
      const today = new Date();
      // Reset hours to compare only dates reliably
      today.setHours(0,0,0,0);

      const todayTasks = tasks.filter(t => {
          if (!t.title.toLowerCase().includes(searchTerm.toLowerCase())) return false;
          if (!t.dueDate) return false;
          
          const tDate = new Date(t.dueDate);
          tDate.setHours(0,0,0,0);
          
          return tDate.getTime() === today.getTime();
      }).sort((a,b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());

      // Also get overdue
      const overdueTasks = tasks.filter(t => {
          if (!t.dueDate || t.status === TaskStatus.DONE) return false;
          const tDate = new Date(t.dueDate);
          tDate.setHours(0,0,0,0);
          return tDate.getTime() < today.getTime();
      });

      return (
          <div className="flex-1 overflow-y-auto px-1">
             <div className="max-w-2xl mx-auto space-y-8 pb-10">
                  {overdueTasks.length > 0 && (
                      <div className="space-y-3">
                          <h3 className="font-bold text-red-600 flex items-center gap-2"><AlertCircle className="w-4 h-4"/> Atrasadas ({overdueTasks.length})</h3>
                          {overdueTasks.map(t => (
                              <div key={t.id} onClick={() => openEditModal(t)} className={`p-4 rounded-xl border border-red-100 bg-red-50/50 dark:bg-red-900/10 cursor-pointer flex justify-between items-center group`}>
                                  <div>
                                      <div className="font-bold text-gray-800 dark:text-red-200">{t.title}</div>
                                      <div className="text-xs text-red-500 font-medium">Vencía: {new Date(t.dueDate!).toLocaleDateString()}</div>
                                  </div>
                                  <button onClick={(e) => { e.stopPropagation(); handleContextMenu(e, t); }} className="opacity-0 group-hover:opacity-100 p-2 hover:bg-red-100 rounded-full text-red-500"><Edit2 className="w-4 h-4"/></button>
                              </div>
                          ))}
                      </div>
                  )}

                  <div className="space-y-3">
                      <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2"><Sun className="w-4 h-4 text-orange-500"/> Para Hoy</h3>
                      {todayTasks.length === 0 ? (
                          <div className="text-center py-10 border-2 border-dashed border-gray-100 dark:border-slate-800 rounded-xl text-gray-400">
                              <p>¡Todo limpio! No hay tareas programadas para hoy.</p>
                              <Button variant="ghost" onClick={openCreateModal} className="mt-2 text-indigo-600">Crear una tarea</Button>
                          </div>
                      ) : (
                          todayTasks.map(t => (
                              <div key={t.id} onClick={() => openEditModal(t)} onContextMenu={(e)=>handleContextMenu(e,t)} className={`p-4 rounded-xl border ${getTaskStyles(t.status)} cursor-pointer flex justify-between items-center group transition-all hover:translate-x-1`}>
                                  <div className="flex items-center gap-3">
                                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${t.status === TaskStatus.DONE ? 'bg-green-500 border-green-500' : 'border-gray-300'}`}>
                                          {t.status === TaskStatus.DONE && <CheckCircle2 className="w-3 h-3 text-white" />}
                                      </div>
                                      <div>
                                          <div className="font-bold">{t.title}</div>
                                          <div className="text-xs opacity-70 flex items-center gap-2">
                                              <Clock className="w-3 h-3"/> {new Date(t.dueDate!).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                              {t.priority === 'HIGH' && <span className="text-red-500 font-bold">• Prioridad Alta</span>}
                                          </div>
                                      </div>
                                  </div>
                              </div>
                          ))
                      )}
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
        <div className="flex flex-col h-full animate-in fade-in overflow-hidden border border-gray-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 shadow-sm">
            <div className="flex items-center justify-between p-2 border-b border-gray-300 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/50 flex-shrink-0">
                <button onClick={() => {const d=new Date(referenceDate); d.setDate(d.getDate()-7); setReferenceDate(d)}} className="p-1 hover:bg-gray-200 dark:hover:bg-slate-700 rounded"><ChevronLeft className="w-5 h-5 text-gray-500 dark:text-gray-300"/></button>
                <div className="font-bold text-gray-900 dark:text-white text-sm">{startOfWeek.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</div>
                <button onClick={() => {const d=new Date(referenceDate); d.setDate(d.getDate()+7); setReferenceDate(d)}} className="p-1 hover:bg-gray-200 dark:hover:bg-slate-700 rounded"><ChevronRight className="w-5 h-5 text-gray-500 dark:text-gray-300"/></button>
            </div>
            <div className="flex-1 flex flex-col min-h-0 overflow-y-auto"> 
                <div className="flex min-h-[600px]">
                    <div className="w-12 flex-shrink-0 border-r border-gray-300 dark:border-slate-700 bg-gray-50/30 dark:bg-slate-800/30">
                         <div className="h-8 border-b border-gray-300 dark:border-slate-700"></div>
                        {hours.map(h => <div key={h} className="h-20 border-b border-gray-200 dark:border-slate-800 text-[10px] text-gray-400 flex justify-center pt-1">{h}:00</div>)}
                    </div>
                    {weekDays.map((date, idx) => (
                        <div key={idx} className="flex-1 flex flex-col border-r border-gray-300 dark:border-slate-700 last:border-r-0 min-w-[100px]">
                            <div className={`h-8 flex items-center justify-center border-b border-gray-300 dark:border-slate-700 text-xs font-bold ${date.toDateString() === new Date().toDateString() ? 'bg-black text-white' : 'bg-gray-50/30 dark:bg-slate-800/30 text-gray-600 dark:text-gray-300'}`}>
                                {date.getDate()} {date.toLocaleDateString('es-ES', { weekday: 'short' })}
                            </div>
                            <div className="flex-1 relative bg-white dark:bg-slate-900">
                                {hours.map(h => (
                                    <div key={h} className="h-20 border-b border-gray-100 dark:border-slate-800" onDrop={(e)=>handleDrop(e, date, h)} onDragOver={(e)=>handleDragOver(e, `${date.toISOString()}-${h}`)}></div>
                                ))}
                                {tasks.filter(t => t.dueDate && new Date(t.dueDate).toDateString() === date.toDateString()).map(t => {
                                    const d = new Date(t.dueDate!);
                                    let h = d.getHours();
                                    // Clamp hours to visible range (8-20) roughly for display
                                    if (h < 8) h = 8;
                                    const top = (h - 8) * 80; 
                                    
                                    return (
                                        <div key={t.id} onClick={()=>openEditModal(t)} onContextMenu={(e)=>handleContextMenu(e,t)} className={`absolute left-1 right-1 p-1.5 rounded-lg text-[10px] shadow-sm cursor-pointer hover:scale-105 transition-transform z-10 flex flex-col justify-center ${getTaskStyles(t.status)}`} style={{top: top + 5, height: '70px'}}>
                                            <div className="font-bold line-clamp-2">{t.title}</div>
                                            <div className="text-[9px] opacity-70 mt-auto">{d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
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
        <div className="bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-xl overflow-hidden flex flex-col h-full shadow-sm">
            <div className="flex justify-between items-center p-3 border-b border-gray-300 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/50">
                <div className="flex items-center gap-2">
                    <h2 className="font-bold text-lg capitalize text-gray-900 dark:text-white">
                        {referenceDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                    </h2>
                </div>
                <div className="flex gap-1">
                    <button onClick={() => { const d = new Date(referenceDate); d.setMonth(d.getMonth()-1); setReferenceDate(d); }} className="p-1.5 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg"><ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-300"/></button>
                    <button onClick={() => setReferenceDate(new Date())} className="text-xs px-3 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg font-bold border border-gray-300 dark:border-slate-600 dark:text-white">Hoy</button>
                    <button onClick={() => { const d = new Date(referenceDate); d.setMonth(d.getMonth()+1); setReferenceDate(d); }} className="p-1.5 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg"><ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-300"/></button>
                </div>
            </div>
            
            <div className="grid grid-cols-7 text-center border-b border-gray-300 dark:border-slate-700 bg-gray-100 dark:bg-slate-800">
                {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(d => <div key={d} className="py-2 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">{d}</div>)}
            </div>
            
            <div className="grid grid-cols-7 flex-1 bg-gray-200 dark:bg-slate-700 gap-px border-b border-gray-200 dark:border-slate-800">
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
                            ${isCurrentMonth ? 'bg-white dark:bg-slate-900' : 'bg-gray-50/60 dark:bg-slate-800/60'}
                            ${isToday ? 'bg-blue-50/40 dark:bg-blue-900/20' : ''}
                            ${isDragTarget ? '!bg-indigo-100 dark:!bg-indigo-900 ring-2 ring-inset ring-indigo-500 z-10' : 'hover:bg-gray-50 dark:hover:bg-slate-800'}
                          `}
                        >
                            <div className={`text-[10px] font-medium ml-1 mt-1 w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-blue-600 text-white shadow-md' : isCurrentMonth ? 'text-gray-700 dark:text-gray-400' : 'text-gray-400 dark:text-gray-600'}`}>
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
                                          t.status === TaskStatus.DONE ? 'bg-gray-100 dark:bg-slate-800 border-gray-400 dark:border-slate-600 text-gray-400 dark:text-gray-500 line-through' : 
                                          'bg-white dark:bg-slate-800 border-blue-400 text-gray-800 dark:text-gray-200'
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

  if (loading) return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-gray-400" /></div>;

  return (
    <div className="space-y-4 animate-in fade-in duration-500 h-[calc(100vh-2rem)] flex flex-col pt-2">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-3 px-1 flex-shrink-0">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
            <div><h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Tareas</h1></div>
            <div className="bg-gray-100 dark:bg-slate-800 p-1 rounded-lg flex gap-1">
                <button onClick={() => setViewMode('TODAY')} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold uppercase transition-all ${viewMode === 'TODAY' ? 'bg-white dark:bg-slate-700 shadow text-black dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white'}`}><Sun className="w-3 h-3" /> Hoy</button>
                <button onClick={() => setViewMode('WEEK')} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold uppercase transition-all ${viewMode === 'WEEK' ? 'bg-white dark:bg-slate-700 shadow text-black dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white'}`}><Columns className="w-3 h-3" /> Semana</button>
                <button onClick={() => setViewMode('CALENDAR')} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold uppercase transition-all ${viewMode === 'CALENDAR' ? 'bg-white dark:bg-slate-700 shadow text-black dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white'}`}><CalendarIcon className="w-3 h-3" /> Mes</button>
            </div>
        </div>
        <div className="flex gap-2 w-full xl:w-auto">
             <div className="relative flex-1 xl:w-64"><Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-gray-400 dark:text-gray-500" /><Input placeholder="Buscar..." className="pl-9 h-9 text-sm bg-white dark:bg-slate-800" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
            <Button onClick={openCreateModal} className="h-9 shadow-lg shadow-black/10 dark:shadow-white/5"><Plus className="w-3.5 h-3.5 mr-2" /> Nueva</Button>
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
            ...(contextMenu.task?.sopId ? [{ 
                label: 'Ver Guía (SOP)', icon: Book, onClick: () => contextMenu.task && handleViewSOP(contextMenu.task.sopId!)
            }] : []),
            ...(contextMenu.task?.assigneeId ? [{ 
                label: 'Reclamar a Socio (WhatsApp)', icon: MessageCircle, onClick: () => contextMenu.task && sendPartnerReminder(contextMenu.task), shortcut: "WA"
            }] : []),
            { label: 'Cambiar Estado', icon: CheckCircle2, onClick: () => contextMenu.task && handleToggleStatus(contextMenu.task) },
            { label: 'Editar Tarea', icon: Edit2, onClick: () => contextMenu.task && openEditModal(contextMenu.task) },
            { label: 'Eliminar', icon: Trash2, variant: 'destructive', onClick: () => contextMenu.task && deleteTask(contextMenu.task.id) }
        ]}
      />

      {/* Task Edit/Create Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Detalles de la Tarea">
        <form onSubmit={handleSubmit} className="space-y-0">
          <div className="bg-gray-50 dark:bg-slate-800 -mx-6 -mt-2 px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                  <select value={formData.status} onChange={e => setFormData({...formData,status: e.target.value as any})} className="text-xs font-bold px-3 py-1.5 rounded-full border bg-white dark:bg-slate-700 dark:text-white dark:border-slate-600 cursor-pointer outline-none">
                      <option value={TaskStatus.TODO}>PENDIENTE</option>
                      <option value={TaskStatus.DONE}>COMPLETADA</option>
                  </select>
                  {formData.dueDate && new Date(formData.dueDate) < new Date() && formData.status !== TaskStatus.DONE && <span className="flex items-center text-[10px] font-bold text-red-600 bg-red-50 dark:bg-red-900/30 px-2 py-1 rounded-md border border-red-100 dark:border-red-900"><AlertCircle className="w-3 h-3 mr-1" /> ATRASADA</span>}
              </div>
              {formData.id && <button type="button" onClick={() => deleteTask(formData.id!)} className="text-gray-400 hover:text-red-500 p-2 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"><Trash2 className="w-4 h-4" /></button>}
          </div>
          <div className="space-y-6">
              <input value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full text-xl font-bold border-none outline-none bg-transparent p-0 text-gray-900 dark:text-white placeholder:text-gray-400" placeholder="Título..." autoFocus />
              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1.5"><Label><User className="w-3 h-3"/> Responsable</Label><select className="flex h-10 w-full rounded-lg border bg-gray-50/50 dark:bg-slate-800 dark:border-slate-700 dark:text-white px-3 text-sm" value={formData.assigneeId} onChange={e => setFormData({...formData, assigneeId: e.target.value})}><option value="">Sin Asignar</option>{contractors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                 <div className="space-y-1.5"><Label><Flag className="w-3 h-3"/> Prioridad</Label><select className="flex h-10 w-full rounded-lg border bg-gray-50/50 dark:bg-slate-800 dark:border-slate-700 dark:text-white px-3 text-sm" value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value as any})}><option value="LOW">Baja</option><option value="MEDIUM">Media</option><option value="HIGH">Alta</option></select></div>
                 <div className="space-y-1.5"><Label><CalendarIcon className="w-3 h-3"/> Fecha</Label><Input type="datetime-local" className="bg-white dark:bg-slate-800" value={formData.dueDate} onChange={e => setFormData({...formData, dueDate: e.target.value})} /></div>
                 <div className="space-y-1.5"><Label><Book className="w-3 h-3"/> Vincular SOP</Label><select className="flex h-10 w-full rounded-lg border bg-gray-50/50 dark:bg-slate-800 dark:border-slate-700 dark:text-white px-3 text-sm" value={formData.sopId} onChange={e => setFormData({...formData, sopId: e.target.value})}><option value="">-- Ninguno --</option>{sops.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}</select></div>
              </div>
              
              {formData.sopId && (
                  <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-lg p-3 flex justify-between items-center">
                      <div className="flex items-center gap-2">
                          <Book className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                          <span className="text-sm text-indigo-900 dark:text-indigo-200 font-medium truncate max-w-[200px]">{sops.find(s=>s.id===formData.sopId)?.title}</span>
                      </div>
                      <button type="button" onClick={() => handleViewSOP(formData.sopId)} className="text-xs font-bold text-indigo-700 dark:text-indigo-300 hover:underline">Ver Guía</button>
                  </div>
              )}

              <div className="space-y-1.5 relative">
                  <div className="flex justify-between items-center"><Label>Descripción & Checklist</Label><button type="button" onClick={handleAiAssist} disabled={isAiGenerating} className="text-xs flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-bold hover:bg-indigo-50 dark:hover:bg-indigo-900/30 px-2 py-1 rounded-md transition-colors">{isAiGenerating ? <Loader2 className="w-3 h-3 animate-spin"/> : <Sparkles className="w-3 h-3"/>} Autocompletar con IA</button></div>
                  <Textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="min-h-[150px]" placeholder="Detalles o pasos a seguir..." />
              </div>
          </div>
          <div className="pt-6 mt-6 border-t border-gray-100 dark:border-slate-700 flex justify-end"><Button type="submit" className="w-full md:w-auto bg-black dark:bg-white text-white dark:text-black">Guardar Cambios</Button></div>
        </form>
      </Modal>

      {/* SOP Viewer Modal */}
      <Modal isOpen={sopModalOpen} onClose={() => setSopModalOpen(false)} title={selectedSop?.title || "SOP"}>
          <div className="space-y-4">
              <Badge variant="blue" className="mb-2">{selectedSop?.category}</Badge>
              <div className="prose prose-sm max-w-none dark:prose-invert">
                  <p className="whitespace-pre-wrap text-gray-600 dark:text-gray-300 leading-relaxed font-mono text-xs md:text-sm">
                      {selectedSop?.content || "Sin contenido."}
                  </p>
              </div>
              <div className="pt-4 flex justify-end">
                  <Button variant="secondary" onClick={() => setSopModalOpen(false)}>Cerrar</Button>
              </div>
          </div>
      </Modal>
    </div>
  );
}
