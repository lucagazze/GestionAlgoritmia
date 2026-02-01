
import React, { useEffect, useState } from 'react';
import { db } from '../services/db';
import { ai } from '../services/ai';
import { googleCalendarService } from '../services/googleCalendar';
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
  Book,
  Smartphone,
  Share2,
  Download,
  CalendarCheck,
  RefreshCw,
  Link
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
  const [isSyncing, setIsSyncing] = useState(false);
  const [googleAuthDone, setGoogleAuthDone] = useState(false);

  const [formData, setFormData] = useState<{
    id?: string;
    title: string;
    description: string;
    assigneeId: string;
    dueDate: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH';
    status: TaskStatus;
    sopId: string; // New
    googleEventId?: string; // New
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
    // Init Google Scripts
    googleCalendarService.loadScripts().catch(err => console.error("Could not load Google Scripts", err));
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

  // --- CALENDAR SYNC FUNCTIONS ---
  
  const handleGoogleAuth = async () => {
      try {
          await googleCalendarService.authenticate();
          setGoogleAuthDone(true);
          return true;
      } catch (e: any) {
          console.error("Auth error", e);
          if (e.error === 'access_denied') {
              alert("Acceso denegado. Asegúrate de añadir tu usuario en 'Test Users' en Google Cloud si la app está en modo prueba.");
          }
          return false;
      }
  };

  // --- SYNC CRUD LOGIC ---
  const syncTaskToGoogle = async (task: any, isUpdate: boolean = false) => {
      // Only sync if auth is done and date is present
      if (!googleCalendarService.getIsAuthenticated() || !task.dueDate) return null;

      const start = new Date(task.dueDate);
      const end = new Date(start.getTime() + 60 * 60 * 1000); // 1 hour default

      try {
          if (isUpdate && task.googleEventId) {
              await googleCalendarService.updateEvent(task.googleEventId, {
                  title: `[OS] ${task.title}`,
                  description: task.description || '',
                  startTime: start.toISOString(),
                  endTime: end.toISOString()
              });
              return task.googleEventId;
          } else {
              const result = await googleCalendarService.createEvent({
                  title: `[OS] ${task.title}`,
                  description: task.description || '',
                  startTime: start.toISOString(),
                  endTime: end.toISOString()
              });
              return result.id;
          }
      } catch (e) {
          console.error("Google Sync Failed", e);
          return null;
      }
  };

  const deleteFromGoogle = async (googleEventId: string) => {
      if (!googleCalendarService.getIsAuthenticated()) return;
      try {
          await googleCalendarService.deleteEvent(googleEventId);
      } catch (e) {
          console.error("Google Delete Failed", e);
      }
  };
  
  // --- FORM HANDLERS ---
  const handleCreateTask = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!formData.title) return;
      
      const payload: any = {
          title: formData.title,
          description: formData.description,
          priority: formData.priority,
          status: formData.status,
          dueDate: formData.dueDate || null,
          sopId: formData.sopId || null
      };
      
      if (formData.assigneeId) payload.assigneeId = formData.assigneeId;

      // Google Sync Logic
      let gEventId = formData.googleEventId;
      if (googleCalendarService.getIsAuthenticated() && formData.dueDate) {
          gEventId = await syncTaskToGoogle({ ...payload, googleEventId: formData.googleEventId }, !!formData.id);
      }
      if (gEventId) payload.googleEventId = gEventId;

      if (formData.id) {
          await db.tasks.update(formData.id, payload);
      } else {
          await db.tasks.create(payload);
      }
      setIsModalOpen(false);
      resetForm();
      loadData();
  };

  const resetForm = () => {
      setFormData({ title: '', description: '', assigneeId: '', dueDate: '', priority: 'MEDIUM', status: TaskStatus.TODO, sopId: '', googleEventId: undefined });
  };

  const handleEdit = (task: Task) => {
      setFormData({
          id: task.id,
          title: task.title,
          description: task.description || '',
          assigneeId: task.assigneeId || '',
          dueDate: task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 16) : '',
          priority: task.priority || 'MEDIUM',
          status: task.status,
          sopId: task.sopId || '',
          googleEventId: task.googleEventId
      });
      setIsModalOpen(true);
      handleCloseContextMenu();
  };

  const handleDelete = async (task: Task) => {
      if(confirm('¿Borrar tarea?')) {
          if (task.googleEventId) await deleteFromGoogle(task.googleEventId);
          await db.tasks.delete(task.id);
          loadData();
      }
      handleCloseContextMenu();
  };
  
  const handleDrop = async (e: React.DragEvent, slotDate: Date) => {
      e.preventDefault();
      const taskId = e.dataTransfer.getData('taskId');
      setDragOverSlot(null);
      if (taskId) {
          const task = tasks.find(t => t.id === taskId);
          if (task) {
              const newDate = new Date(slotDate);
              newDate.setHours(12, 0, 0, 0); 
              const newIso = newDate.toISOString();
              
              // Sync if linked
              if (task.googleEventId && googleCalendarService.getIsAuthenticated()) {
                  await syncTaskToGoogle({ ...task, dueDate: newIso }, true);
              }

              await db.tasks.update(taskId, { dueDate: newIso });
              loadData();
          }
      }
  };

  const manualSyncAll = async () => {
      if (!await handleGoogleAuth()) return;
      setIsSyncing(true);
      try {
          // Sync pending tasks that have dates but no google ID yet
          const pending = tasks.filter(t => t.status !== TaskStatus.DONE && t.dueDate && !t.googleEventId);
          let count = 0;
          for (const t of pending) {
              const gId = await syncTaskToGoogle(t, false);
              if (gId) {
                  await db.tasks.update(t.id, { googleEventId: gId });
                  count++;
              }
          }
          alert(`Sincronización completada. ${count} tareas enviadas a Google.`);
          loadData();
      } catch (e) {
          console.error(e);
      } finally {
          setIsSyncing(false);
      }
  };

  // --- RENDERING HELPERS ---
  const filteredTasks = tasks.filter(t => t.title.toLowerCase().includes(searchTerm.toLowerCase()));

  // Calendar Logic
  const renderCalendar = () => {
      const year = referenceDate.getFullYear();
      const month = referenceDate.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sunday
      
      const daysArray = Array.from({ length: 42 }, (_, i) => {
          const dayNumber = i - firstDayIndex + 1;
          if (dayNumber > 0 && dayNumber <= daysInMonth) return new Date(year, month, dayNumber);
          return null; 
      });

      return (
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm flex flex-col flex-1 min-h-0">
              {/* Calendar Header */}
              <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-slate-800">
                  <button onClick={() => {const d = new Date(referenceDate); d.setMonth(d.getMonth()-1); setReferenceDate(d)}} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg text-gray-500"><ChevronLeft className="w-5 h-5"/></button>
                  <h2 className="text-lg font-bold capitalize text-gray-900 dark:text-white">{referenceDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</h2>
                  <button onClick={() => {const d = new Date(referenceDate); d.setMonth(d.getMonth()+1); setReferenceDate(d)}} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg text-gray-500"><ChevronRight className="w-5 h-5"/></button>
              </div>
              
              {/* Days Header */}
              <div className="grid grid-cols-7 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50">
                  {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(d => (
                      <div key={d} className="py-3 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">{d}</div>
                  ))}
              </div>

              {/* Grid */}
              <div className="grid grid-cols-7 grid-rows-6 flex-1 bg-gray-200 dark:bg-slate-800 gap-px overflow-y-auto">
                  {daysArray.map((date, i) => {
                      if (!date) return <div key={i} className="bg-gray-50/50 dark:bg-slate-900/50"></div>;
                      
                      const dayTasks = filteredTasks.filter(t => {
                          if (!t.dueDate) return false;
                          const tDate = new Date(t.dueDate);
                          return tDate.getDate() === date.getDate() && tDate.getMonth() === date.getMonth() && tDate.getFullYear() === date.getFullYear();
                      });
                      
                      const isToday = new Date().toDateString() === date.toDateString();
                      const isDragOver = dragOverSlot === date.toISOString();

                      return (
                          <div 
                              key={i} 
                              className={`bg-white dark:bg-slate-900 p-2 flex flex-col gap-1 relative transition-colors ${isToday ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''} ${isDragOver ? 'bg-indigo-50 dark:bg-indigo-900/30' : ''}`}
                              onDragOver={(e) => { e.preventDefault(); setDragOverSlot(date.toISOString()); }}
                              onDragLeave={() => setDragOverSlot(null)}
                              onDrop={(e) => handleDrop(e, date)}
                          >
                              <span className={`text-xs font-bold mb-1 w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-black dark:bg-white text-white dark:text-black' : 'text-gray-400'}`}>
                                  {date.getDate()}
                              </span>
                              
                              <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar">
                                  {dayTasks.map(t => (
                                      <div 
                                          key={t.id} 
                                          draggable
                                          onDragStart={(e) => e.dataTransfer.setData('taskId', t.id)}
                                          onContextMenu={(e) => handleContextMenu(e, t)}
                                          onClick={() => handleEdit(t)}
                                          className={`
                                              text-[10px] px-2 py-1.5 rounded-md border truncate cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-all flex items-center gap-1
                                              ${t.status === TaskStatus.DONE 
                                                  ? 'bg-gray-100 dark:bg-slate-800 text-gray-400 border-gray-200 line-through' 
                                                  : t.priority === 'HIGH' 
                                                      ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-100 dark:border-red-900' 
                                                      : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-slate-700 hover:border-blue-300'
                                              }
                                          `}
                                      >
                                          {t.googleEventId && <Link className="w-2 h-2 text-blue-500" />}
                                          <span className="truncate">{t.title}</span>
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

  return (
    <div className="space-y-6 animate-in fade-in duration-500 h-[calc(100vh-100px)] flex flex-col pb-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 flex-shrink-0">
        <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Gestión de Tareas</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">Organiza el trabajo del equipo.</p>
        </div>
        
        <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
             <div className="bg-gray-100 dark:bg-slate-800 p-1 rounded-xl flex self-start md:self-auto">
                 <button onClick={() => setViewMode('CALENDAR')} className={`p-2 rounded-lg transition-all ${viewMode === 'CALENDAR' ? 'bg-white dark:bg-slate-700 shadow text-black dark:text-white' : 'text-gray-400'}`}><CalendarIcon className="w-4 h-4"/></button>
                 <button onClick={() => setViewMode('WEEK')} className={`p-2 rounded-lg transition-all ${viewMode === 'WEEK' ? 'bg-white dark:bg-slate-700 shadow text-black dark:text-white' : 'text-gray-400'}`}><Columns className="w-4 h-4"/></button>
             </div>
             <div className="relative flex-1 md:w-64"><Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" /><Input placeholder="Buscar tarea..." className="pl-9 h-10 bg-white dark:bg-slate-800" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
             <Button onClick={manualSyncAll} variant="secondary" className="bg-blue-50 text-blue-600 hover:bg-blue-100 border-blue-100">
                 {isSyncing ? <Loader2 className="w-4 h-4 animate-spin"/> : <CalendarCheck className="w-4 h-4 mr-2" />} Sync Calendar
             </Button>
             <Button onClick={() => { setIsModalOpen(true); resetForm(); }} className="shadow-lg"><Plus className="w-4 h-4 mr-2" /> Nueva Tarea</Button>
        </div>
      </div>

      {/* Content */}
      {viewMode === 'CALENDAR' ? renderCalendar() : (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6 shadow-sm overflow-auto flex-1 custom-scrollbar">
              <div className="space-y-2">
                   {filteredTasks.length === 0 && <p className="text-center text-gray-400 py-10">No hay tareas encontradas.</p>}
                   {filteredTasks.map(t => (
                       <div key={t.id} onContextMenu={(e) => handleContextMenu(e, t)} onClick={() => handleEdit(t)} className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-800 cursor-pointer group transition-all">
                           <div className="flex items-center gap-4">
                               <button 
                                onClick={(e) => { e.stopPropagation(); db.tasks.updateStatus(t.id, t.status === TaskStatus.DONE ? TaskStatus.TODO : TaskStatus.DONE).then(loadData); }}
                                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${t.status === TaskStatus.DONE ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 hover:border-green-500'}`}
                               >
                                   {t.status === TaskStatus.DONE && <CheckCircle2 className="w-4 h-4" />}
                               </button>
                               <div>
                                   <div className="flex items-center gap-2">
                                     <h4 className={`font-bold text-sm ${t.status === TaskStatus.DONE ? 'text-gray-400 line-through' : 'text-gray-900 dark:text-white'}`}>{t.title}</h4>
                                     {t.googleEventId && <Link className="w-3 h-3 text-blue-400" title="Sincronizada con Google" />}
                                   </div>
                                   <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                                       {t.dueDate && <span className={`flex items-center gap-1 ${new Date(t.dueDate) < new Date() && t.status !== TaskStatus.DONE ? 'text-red-500 font-bold' : ''}`}><Clock className="w-3 h-3"/> {new Date(t.dueDate).toLocaleDateString()}</span>}
                                       {t.assignee && <span className="flex items-center gap-1"><User className="w-3 h-3"/> {t.assignee.name}</span>}
                                       {t.sopId && <span className="flex items-center gap-1 text-purple-500"><Book className="w-3 h-3"/> Con SOP</span>}
                                   </div>
                               </div>
                           </div>
                           <div className="flex items-center gap-3">
                               <Badge variant={t.priority === 'HIGH' ? 'red' : t.priority === 'MEDIUM' ? 'yellow' : 'blue'}>{t.priority}</Badge>
                               <button onClick={(e) => {e.stopPropagation(); handleEdit(t)}} className="p-2 text-gray-300 hover:text-black dark:hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"><Edit2 className="w-4 h-4"/></button>
                           </div>
                       </div>
                   ))}
              </div>
          </div>
      )}

      {/* Edit/Create Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={formData.id ? 'Editar Tarea' : 'Nueva Tarea'}>
          <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                  <Label>Título</Label>
                  <div className="flex gap-2">
                      <Input value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="Ej: Enviar reporte mensual..." autoFocus />
                      <Button type="button" variant="outline" onClick={handleAiAssist} disabled={isAiGenerating} title="Sugerir descripción con IA">
                          {isAiGenerating ? <Loader2 className="w-4 h-4 animate-spin"/> : <Sparkles className="w-4 h-4 text-purple-600"/>}
                      </Button>
                  </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                  <div>
                      <Label>Prioridad</Label>
                      <select className="flex h-11 w-full rounded-xl border border-gray-200 bg-gray-50/50 px-3 py-2 text-sm outline-none focus:border-black" value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value as any})}>
                          <option value="HIGH">Alta</option>
                          <option value="MEDIUM">Media</option>
                          <option value="LOW">Baja</option>
                      </select>
                  </div>
                  <div>
                      <Label>Estado</Label>
                      <select className="flex h-11 w-full rounded-xl border border-gray-200 bg-gray-50/50 px-3 py-2 text-sm outline-none focus:border-black" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})}>
                          <option value={TaskStatus.TODO}>Pendiente</option>
                          <option value={TaskStatus.DONE}>Completada</option>
                      </select>
                  </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                  <div>
                      <Label>Asignar a</Label>
                      <select className="flex h-11 w-full rounded-xl border border-gray-200 bg-gray-50/50 px-3 py-2 text-sm outline-none focus:border-black" value={formData.assigneeId} onChange={e => setFormData({...formData, assigneeId: e.target.value})}>
                          <option value="">(Sin asignar)</option>
                          {contractors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                  </div>
                  <div>
                      <Label>Fecha Vencimiento</Label>
                      <Input type="datetime-local" value={formData.dueDate} onChange={e => setFormData({...formData, dueDate: e.target.value})} />
                      <p className="text-[10px] text-blue-500 mt-1 flex items-center gap-1"><Link className="w-3 h-3"/> Se sincronizará con Google Calendar</p>
                  </div>
              </div>

              <div>
                  <Label>Vincular SOP (Procedimiento)</Label>
                  <select className="flex h-11 w-full rounded-xl border border-gray-200 bg-gray-50/50 px-3 py-2 text-sm outline-none focus:border-black" value={formData.sopId} onChange={e => setFormData({...formData, sopId: e.target.value})}>
                      <option value="">(Ninguno)</option>
                      {sops.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                  </select>
              </div>

              <div>
                  <Label>Descripción</Label>
                  <Textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Detalles adicionales..." className="min-h-[100px]" />
              </div>
              
              <div className="flex gap-2 pt-4">
                  {formData.id && (
                      <Button type="button" variant="destructive" onClick={() => handleDelete({ id: formData.id!, title: formData.title, status: formData.status, googleEventId: formData.googleEventId } as Task)} className="mr-auto">
                          <Trash2 className="w-4 h-4"/>
                      </Button>
                  )}
                  <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                  <Button type="submit">{formData.id ? 'Guardar Cambios' : 'Crear Tarea'}</Button>
              </div>
          </form>
      </Modal>

      {/* SOP Viewer Modal */}
      <Modal isOpen={sopModalOpen} onClose={() => setSopModalOpen(false)} title={`SOP: ${selectedSop?.title}`}>
          <div className="space-y-4">
              <Badge>{selectedSop?.category}</Badge>
              <div className="bg-gray-50 p-4 rounded-xl text-sm whitespace-pre-wrap font-mono">
                  {selectedSop?.content}
              </div>
              <div className="flex justify-end">
                  <Button onClick={() => setSopModalOpen(false)}>Cerrar</Button>
              </div>
          </div>
      </Modal>

      {/* Context Menu */}
      <ContextMenu 
        x={contextMenu.x} y={contextMenu.y} isOpen={!!contextMenu.task} onClose={handleCloseContextMenu}
        items={[
            { label: contextMenu.task?.status === TaskStatus.DONE ? 'Marcar Pendiente' : 'Completar Tarea', icon: CheckCircle2, onClick: () => { if(contextMenu.task) db.tasks.updateStatus(contextMenu.task.id, contextMenu.task.status === TaskStatus.DONE ? TaskStatus.TODO : TaskStatus.DONE).then(loadData); handleCloseContextMenu(); } },
            { label: 'Editar', icon: Edit2, onClick: () => { if(contextMenu.task) handleEdit(contextMenu.task); } },
            { label: 'Ver SOP Asociado', icon: Book, onClick: () => { if(contextMenu.task?.sopId) handleViewSOP(contextMenu.task.sopId); else alert("Esta tarea no tiene SOP vinculado."); handleCloseContextMenu(); } },
            { label: 'Recordar por WhatsApp', icon: MessageCircle, onClick: () => { if(contextMenu.task) sendPartnerReminder(contextMenu.task); handleCloseContextMenu(); } },
            { label: 'Eliminar', icon: Trash2, variant: 'destructive', onClick: () => { if(contextMenu.task) handleDelete(contextMenu.task); } }
        ]}
      />
    </div>
  );
}
