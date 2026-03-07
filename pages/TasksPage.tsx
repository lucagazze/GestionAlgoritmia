
import React, { useEffect, useState, useRef } from 'react';
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
type ViewMode = 'TODAY' | 'WEEK' | 'CALENDAR' | 'LIST';

// ✅ Helper para inputs de fecha (Datetime Local)
const toLocalISOString = (date: Date) => {
    const tzOffset = date.getTimezoneOffset() * 60000; // offset in milliseconds
    return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
};

export default function TasksPage() {
  // ✅ CONSTANTES PARA LA GRILLA (HORARIOS)
  const START_HOUR = 7;
  const ROW_HEIGHT = 35; 

  const [tasks, setTasks] = useState<Task[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [sops, setSops] = useState<SOP[]>([]); 
  const [googleEvents, setGoogleEvents] = useState<any[]>([]); // New state for external events
  
  const [viewMode, setViewMode] = useState<ViewMode>('CALENDAR'); 
  const [searchTerm, setSearchTerm] = useState('');
  
  const [referenceDate, setReferenceDate] = useState(new Date()); 
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dragPreview, setDragPreview] = useState<{ date: string, hour: number, minutes: number, top: number } | null>(null);

  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [sopModalOpen, setSopModalOpen] = useState(false);
  const [selectedSop, setSelectedSop] = useState<SOP | null>(null);
  
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; task: Task | null }>({ x: 0, y: 0, task: null });

  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [googleAuthDone, setGoogleAuthDone] = useState(false);

  // 1. Crear la referencia para el elemento del día de hoy
  const todayRef = useRef<HTMLDivElement>(null);

  // 2. Efecto para hacer scroll automático cuando cambias a vista CALENDAR
  useEffect(() => {
      if (viewMode === 'CALENDAR' && todayRef.current) {
          // Esperamos un milisegundo para que el render termine
          setTimeout(() => {
              todayRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 100);
      }
  }, [viewMode]);

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
    // Init Google Scripts and check session
    googleCalendarService.loadScripts().then(() => {
        if (googleCalendarService.restoreSession()) {
            setGoogleAuthDone(true);
        }
    }).catch(err => console.error("Could not load Google Scripts", err));
    
    return () => { window.removeEventListener('task-created', handleTaskCreated); };
  }, []);

  // Fetch Google Events when reference date changes or auth is done
  // Also poll every 60 seconds to keep it "live"
  useEffect(() => {
      let interval: NodeJS.Timeout;

      const runSync = () => {
        if (googleCalendarService.getIsAuthenticated()) {
            fetchGoogleEvents();
        }
      };

      runSync();

      interval = setInterval(runSync, 15000); // Poll every 15 seconds

      return () => clearInterval(interval);
  }, [referenceDate, googleAuthDone]);

  const fetchGoogleEvents = async () => {
      try {
          const year = referenceDate.getFullYear();
          const month = referenceDate.getMonth();
          // Get range including padding for the grid
          const start = new Date(year, month, 1);
          start.setDate(start.getDate() - 10);
          const end = new Date(year, month + 1, 0);
          end.setDate(end.getDate() + 10);

          const events = await googleCalendarService.listEvents(start.toISOString(), end.toISOString());
          setGoogleEvents(events || []);
      } catch (e: any) {
          console.error("Error fetching google events", e);
          if (e.result && (e.result.error.code === 401 || e.result.error.code === 403)) {
              console.warn("Token expired. Auto-logging out.");
              handleGoogleLogout();
          } else {
             console.log("Full Google Error:", JSON.stringify(e, null, 2));
          }
      }
  };

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
          fetchGoogleEvents(); 
          return true;
      } catch (e: any) {
          console.error("Auth error", e);
          if (e.error === 'access_denied') {
              alert("Acceso denegado. Debes autorizar la app.");
          } else {
              alert("Error de autenticación: " + JSON.stringify(e));
          }
          return false;
      }
  };

  const handleGoogleLogout = () => {
      googleCalendarService.logout();
      setGoogleAuthDone(false);
      setGoogleEvents([]); // Clear remote events
      alert("Desconectado de Google Calendar.");
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
      } catch (e: any) {
          console.error("Google Sync Failed", e);
          alert("Error de Sincronización Google: " + (e.message || JSON.stringify(e)));
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

      if (formData.id) {
          await db.tasks.update(formData.id, payload);
      } else {
          await db.tasks.create(payload);
      }
      setIsModalOpen(false);
      resetForm();
      await loadData(); 
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
          await loadData();
          fetchGoogleEvents();
      }
      handleCloseContextMenu();
  };
  
  const handleDrop = async (e: React.DragEvent, slotDate: Date) => {
      e.preventDefault();
      const taskId = e.dataTransfer.getData('taskId');
      setDragOverSlot(null);
      setDragPreview(null);
      setDraggingTaskId(null);

      if (taskId) {
          const task = tasks.find(t => t.id === taskId);
          if (task) {
              const newDate = new Date(slotDate);

              if (viewMode === 'WEEK' || viewMode === 'TODAY') {
                  // 🧠 CÁLCULO MATEMÁTICO DE LA HORA AL SOLTAR
                  const rect = e.currentTarget.getBoundingClientRect();
                  const y = e.clientY - rect.top;
                  
                  const hoursFromStart = Math.floor(y / ROW_HEIGHT);
                  const minutesFromStart = Math.floor(((y % ROW_HEIGHT) / ROW_HEIGHT) * 60); // Calcula minutos proporcionales
                  
                  const finalHour = START_HOUR + hoursFromStart;
                  
                  // Ajustamos la hora y minutos (redondeando minutos a múltiplos de 30)
                  const roundedMinutes = Math.round(minutesFromStart / 30) * 30;
                  
                  newDate.setHours(finalHour, roundedMinutes, 0, 0);

              } else if (viewMode === 'CALENDAR') {
                   // En vista mensual, mantenemos la hora que ya tenía la tarea
                   const originalDate = new Date(task.dueDate || new Date());
                   newDate.setHours(originalDate.getHours(), originalDate.getMinutes(), 0, 0);
              }

              await db.tasks.update(taskId, { dueDate: newDate.toISOString() });
              await loadData();
          }
      }
  };



  // --- RENDERING HELPERS ---
  const filteredTasks = tasks.filter(t => t.title.toLowerCase().includes(searchTerm.toLowerCase()));

  // Helpers
  const changeDate = (direction: number) => {
      const newDate = new Date(referenceDate);
      if (viewMode === 'TODAY') {
          newDate.setDate(newDate.getDate() + direction);
      } else if (viewMode === 'WEEK') {
          newDate.setDate(newDate.getDate() + (direction * 7));
      } else {
          newDate.setMonth(newDate.getMonth() + direction);
      }
      setReferenceDate(newDate);
  };

  const getWeekRange = (date: Date) => {
      const start = new Date(date);
      const day = start.getDay() || 7; // 1=Mon, 7=Sun
      if (day !== 1) start.setHours(-24 * (day - 1)); // Go to Monday
      
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      
      return `${start.getDate()} - ${end.getDate()} ${end.toLocaleDateString('es-ES', { month: 'short' })}`;
  };
  
  // Gets all events (local + google) for a specific date
  const getEventsForDate = (date: Date) => {
      const dayTasks = filteredTasks.filter(t => {
          if (!t.dueDate) return false;
          const tDate = new Date(t.dueDate);
          return tDate.getDate() === date.getDate() && tDate.getMonth() === date.getMonth() && tDate.getFullYear() === date.getFullYear();
      });

      const dayGoogle = googleEvents.filter(ev => {
          const evDate = new Date(ev.start.dateTime || ev.start.date);
          if (evDate.getDate() !== date.getDate() || evDate.getMonth() !== date.getMonth() || evDate.getFullYear() !== date.getFullYear()) return false;
          // De-duplicate
          if (dayTasks.some(t => t.googleEventId === ev.id)) return false;
          return true;
      });

      return { dayTasks, dayGoogle };
  };

  // --- LIST VIEW RENDERER ---
  const renderListView = () => {
      // Sort upcoming tasks
      const sorted = [...filteredTasks].sort((a, b) => {
          const dA = a.dueDate ? new Date(a.dueDate).getTime() : 0;
          const dB = b.dueDate ? new Date(b.dueDate).getTime() : 0;
          return dA - dB;
      });

      return (
          <div className="flex-1 overflow-y-auto bg-zinc-50/50 dark:bg-zinc-900/50 p-6 rounded-2xl">
              <div className="max-w-4xl mx-auto space-y-2">
                  {sorted.map(task => (
                      <div key={task.id} className="group flex items-center gap-4 p-4 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-all">
                          <div className="flex-shrink-0 w-14 text-center">
                              <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-[0.06em]">
                                  {task.dueDate ? new Date(task.dueDate).toLocaleDateString('es-ES', { month: 'short' }) : '-'}
                              </div>
                              <div className="text-[22px] font-bold text-zinc-900 dark:text-white tracking-[-0.03em]">
                                  {task.dueDate ? new Date(task.dueDate).getDate() : '-'}
                              </div>
                          </div>

                          <div className={`w-1 h-10 rounded-full flex-shrink-0 ${
                              task.status === TaskStatus.DONE ? 'bg-emerald-400' :
                              task.priority === 'HIGH' ? 'bg-red-400' :
                              'bg-zinc-300 dark:bg-zinc-600'
                          }`}></div>

                          <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                  <h3 className={`font-semibold text-[14px] truncate ${task.status === TaskStatus.DONE ? 'line-through text-zinc-400' : 'text-zinc-900 dark:text-white'}`}>
                                      {task.title}
                                  </h3>
                                  {task.googleEventId && <img src="https://www.google.com/favicon.ico" className="w-3 h-3 opacity-40" />}
                              </div>
                              <div className="flex items-center gap-3 text-[12px] text-zinc-400">
                                  <span className="flex items-center gap-1">
                                      <Clock className="w-3 h-3"/>
                                      {task.dueDate ? new Date(task.dueDate).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : 'Sin hora'}
                                  </span>
                                  {task.assignee && (
                                      <span className="flex items-center gap-1">
                                          <User className="w-3 h-3"/> {task.assignee.name}
                                      </span>
                                  )}
                              </div>
                          </div>

                          <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => handleEdit(task)} className="h-8 w-8 flex items-center justify-center rounded-[8px] hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                                  <Edit2 className="w-3.5 h-3.5 text-zinc-500"/>
                              </button>
                              <button onClick={() => handleDelete(task)} className="h-8 w-8 flex items-center justify-center rounded-[8px] hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                                  <Trash2 className="w-3.5 h-3.5 text-red-400"/>
                              </button>
                          </div>
                      </div>
                  ))}
                  {sorted.length === 0 && (
                      <div className="text-center py-20 text-zinc-400">
                          <p className="text-[13px]">No hay tareas pendientes.</p>
                      </div>
                  )}
              </div>
          </div>
      );
  };

  const renderTimeGrid = () => {
      const isWeek = viewMode === 'WEEK';
      const END_HOUR = 23; 
      const TOTAL_HOURS = END_HOUR - START_HOUR;
      const hours = Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => i + START_HOUR);
      
      let daysToShow: Date[] = [];
      if (isWeek) {
          const start = new Date(referenceDate);
          const day = start.getDay() || 7; 
          start.setDate(start.getDate() - (day - 1));
          daysToShow = Array.from({ length: 7 }, (_, i) => {
              const d = new Date(start);
              d.setDate(d.getDate() + i);
              return d;
          });
      } else {
          daysToShow = [new Date(referenceDate)];
      }

      return (
          <div className="flex flex-col flex-1 min-h-0 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
              {/* Header con Días */}
              <div className="flex border-b border-zinc-100 dark:border-zinc-800 ml-14">
                  {daysToShow.map((date, i) => {
                       const isToday = new Date().toDateString() === date.toDateString();
                       return (
                           <div key={i} className={`flex-1 text-center py-3 border-l border-zinc-100 dark:border-zinc-800 ${isToday ? 'bg-zinc-50 dark:bg-zinc-800/40' : ''}`}>
                               <div className={`text-[10px] uppercase font-semibold tracking-[0.06em] ${isToday ? 'text-zinc-900 dark:text-white' : 'text-zinc-400'}`}>
                                   {date.toLocaleDateString('es-ES', { weekday: 'short' })}
                               </div>
                               <div className={`text-[18px] font-bold mt-1 inline-flex w-8 h-8 items-center justify-center rounded-full ${isToday ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900' : 'text-zinc-700 dark:text-zinc-300'}`}>
                                   {date.getDate()}
                               </div>
                           </div>
                       );
                  })}
              </div>

              {/* Cuerpo del Calendario */}
              <div className="flex flex-1 overflow-y-auto relative bg-white dark:bg-zinc-900">
                  {/* Columna de Horas (Eje Y) */}
                  <div className="w-16 flex-shrink-0 relative bg-white dark:bg-zinc-900 border-r border-zinc-100 dark:border-zinc-800" style={{ height: `${(TOTAL_HOURS + 1) * ROW_HEIGHT}px` }}>
                      {hours.map((h, index) => (
                          <span key={h} className="absolute right-3 text-[10px] font-medium text-zinc-400 font-mono -translate-y-1/2" style={{ top: `${index * ROW_HEIGHT}px` }}>
                                {h}:00
                          </span>
                      ))}
                  </div>

                  {/* Columnas de Días */}
                  <div className="flex-1 flex relative min-w-[600px]" style={{ height: `${(TOTAL_HOURS + 1) * ROW_HEIGHT}px` }}>
                      <div className="absolute inset-0 z-0 pointer-events-none">
                          {hours.map((h, index) => (
                              <div key={h} className="absolute left-0 right-0 border-b border-zinc-100 dark:border-zinc-800" style={{ top: `${index * ROW_HEIGHT}px` }} />
                          ))}
                      </div>

                      {daysToShow.map((date, i) => {
                          const { dayTasks, dayGoogle } = getEventsForDate(date);
                          const isToday = new Date().toDateString() === date.toDateString();

                          // 🧠 CLICK PARA CREAR TAREA
                          const handleColumnClick = (e: React.MouseEvent) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              const y = e.clientY - rect.top;
                              
                              const relativeHour = Math.floor(y / ROW_HEIGHT);
                              const actualHour = START_HOUR + relativeHour;

                              if (actualHour > END_HOUR) return;

                              const newDate = new Date(date);
                              newDate.setHours(actualHour, 0, 0, 0); // Pone la hora exacta, minuto 00
                              
                              setFormData(prev => ({ ...prev, dueDate: toLocalISOString(newDate), title: '' }));
                              setIsModalOpen(true);
                          };

                          return (
                              <div
                                key={i}
                                className={`flex-1 relative border-l border-transparent hover:bg-zinc-50/30 dark:hover:bg-zinc-800/20 transition-colors group ${isToday ? 'bg-zinc-50/50 dark:bg-zinc-800/20' : ''}`}
                                onDragOver={(e) => { 
                                    e.preventDefault(); 
                                    setDragOverSlot(date.toISOString());
                                    
                                    // Calculate Preview Position
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    const y = e.clientY - rect.top;
                                    const hoursFromStart = Math.floor(y / ROW_HEIGHT);
                                    const minutesFromStart = Math.floor(((y % ROW_HEIGHT) / ROW_HEIGHT) * 60);
                                    
                                    const roundedMinutes = Math.round(minutesFromStart / 30) * 30;
                                    const finalHour = START_HOUR + hoursFromStart;
                                    
                                    // Visual snapping
                                    const top = (hoursFromStart * ROW_HEIGHT) + (roundedMinutes * (ROW_HEIGHT / 60));
                                    
                                    setDragPreview({
                                        date: date.toISOString(),
                                        hour: finalHour,
                                        minutes: roundedMinutes,
                                        top
                                    });
                                }} 
                                onDragLeave={() => {
                                    setDragOverSlot(null);
                                    setDragPreview(null);
                                }}
                                onDrop={(e) => handleDrop(e, date)} // ✅ Usa el nuevo handleDrop
                                onClick={handleColumnClick} // ✅ Usa el nuevo click handler
                              >
                                   <div className="absolute inset-y-0 -left-px w-px bg-zinc-100 dark:bg-zinc-800"></div>

                                   {/* Drag Preview Ghost */}
                                   {dragPreview && dragPreview.date === date.toISOString() && (
                                       <div 
                                            className="absolute left-1 right-2 rounded-lg px-2 border-2 border-dashed border-blue-400 bg-blue-50/50 z-20 pointer-events-none flex items-center justify-center animate-pulse"
                                            style={{ top: `${dragPreview.top}px`, height: `${ROW_HEIGHT}px` }}
                                       >
                                           <span className="text-xs font-bold text-blue-600 bg-white/80 px-1 rounded">
                                               {dragPreview.hour}:{dragPreview.minutes === 0 ? '00' : dragPreview.minutes}
                                           </span>
                                       </div>
                                   )}

                                  {[...dayTasks, ...dayGoogle].map((item: any) => {
                                      let start: Date, id: string, title: string, isGoogle = false;
                                      if (item.start) { 
                                          start = new Date(item.start.dateTime || item.start.date);
                                          id = item.id; title = item.summary; isGoogle = true;
                                      } else { 
                                          start = new Date(item.dueDate);
                                          id = item.id; title = item.title;
                                      }

                                      const taskHour = start.getHours();
                                      const taskMinutes = start.getMinutes();

                                      if (taskHour < START_HOUR || taskHour > END_HOUR) return null;

                                      const hoursFromStart = taskHour - START_HOUR;
                                      const top = (hoursFromStart * ROW_HEIGHT) + (taskMinutes * (ROW_HEIGHT / 60));

                                      return (
                                          <div
                                              key={id}
                                              onClick={(e) => { e.stopPropagation(); !isGoogle && handleEdit(item); }}
                                              onContextMenu={(e) => !isGoogle && handleContextMenu(e, item)}
                                              draggable={!isGoogle}
                                               onDragStart={(e) => {
                                                   if (!isGoogle) {
                                                       e.dataTransfer.setData('taskId', id);
                                                       setDraggingTaskId(id);
                                                   }
                                               }}
                                              className={`
                                                  absolute left-1 right-2 rounded-[8px] px-2 text-[10px] font-semibold shadow-sm border overflow-hidden cursor-pointer hover:shadow-md hover:scale-[1.01] transition-all z-10 flex flex-col justify-center leading-tight
                                                  ${isGoogle
                                                      ? 'bg-white border-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400'
                                                      : item.status === 'DONE'
                                                          ? 'bg-emerald-50 text-emerald-700 border-emerald-100 opacity-80 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-900/30'
                                                          : 'bg-zinc-900 dark:bg-white border-zinc-900 dark:border-zinc-200 text-white dark:text-zinc-900'
                                                  }
                                              `}
                                              style={{ top: `${top}px`, height: `${ROW_HEIGHT}px` }}
                                          >
                                              <div className="flex items-center gap-1">
                                                <span className="opacity-70 font-mono">{start.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                                <span className="truncate font-bold">{title}</span>
                                              </div>
                                          </div>
                                      );
                                  })}
                              </div>
                          );
                      })}
                      
                      {/* Línea de Hora Actual */}
                      {daysToShow.some(d => d.toDateString() === new Date().toDateString()) && (
                          (() => {
                              const now = new Date();
                              const currentHour = now.getHours();
                              if (currentHour >= START_HOUR && currentHour <= END_HOUR) {
                                  const hoursFromStart = currentHour - START_HOUR;
                                  const top = (hoursFromStart * ROW_HEIGHT) + (now.getMinutes() * (ROW_HEIGHT / 60));
                                  return (
                                      <div className="absolute w-full border-t-2 border-red-500 z-20 pointer-events-none flex items-center" style={{ top: `${top}px` }}>
                                          <div className="w-2 h-2 rounded-full bg-red-500 -ml-1 shadow-sm"></div>
                                      </div>
                                  );
                              }
                              return null;
                          })()
                      )}
                  </div>
              </div>
          </div>
      );
  };
    
  // --- MONTH GRID RENDERER (Optimized height & Auto-focus) ---
  const renderMonthGrid = () => {
      const start = new Date(referenceDate);
      start.setDate(1); // Primer día del mes
      const startDay = start.getDay() || 7; // Ajustar lunes
      const daysInMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0).getDate();
      
      // Días previos (padding)
      const blanks = Array.from({ length: startDay - 1 });
      // Días del mes
      const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

      // Nombres de días
      const weekDays = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

      return (
          <div className="flex flex-col flex-1 min-h-0 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
              {/* Header Semanal */}
              <div className="grid grid-cols-7 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900 z-10">
                  {weekDays.map(d => (
                      <div key={d} className="py-3 text-center text-[10px] font-semibold text-zinc-400 uppercase tracking-[0.06em]">
                          {d}
                      </div>
                  ))}
              </div>

              {/* Grid Scrollable */}
              <div className="overflow-y-auto flex-1">
                  <div className="grid grid-cols-7 auto-rows-fr">

                      {/* Espacios vacíos mes anterior */}
                      {blanks.map((_, i) => (
                          <div key={`blank-${i}`} className="bg-zinc-50/30 dark:bg-zinc-800/10 border-b border-r border-zinc-100 dark:border-zinc-800 min-h-[160px]" />
                      ))}

                      {/* Días del mes */}
                      {days.map(d => {
                          const date = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), d);
                          const { dayTasks, dayGoogle } = getEventsForDate(date);
                          
                          // Chequeo si es HOY
                          const isToday = new Date().toDateString() === date.toDateString();

                          return (
                              <div 
                                  key={d}
                                  // AQUÍ CONECTAMOS EL REF PARA EL SCROLL AUTOMÁTICO
                                  ref={isToday ? todayRef : null}
                                onDragOver={(e) => { e.preventDefault(); setDragOverSlot(date.toISOString()); }}
                                onDrop={(e) => handleDrop(e, date)}
                                onClick={() => {
                                      // Al hacer clic en el día, abre modal para ese día a las 9 AM por defecto
                                      const newDate = new Date(date);
                                      newDate.setHours(9, 0, 0, 0);
                                      setFormData(prev => ({ ...prev, dueDate: toLocalISOString(newDate), title: '' }));
                                      setIsModalOpen(true);
                                  }}
                                  className={`
                                      relative border-b border-r border-zinc-100 dark:border-zinc-800 p-2 transition-colors cursor-pointer group min-h-[160px]
                                      ${isToday
                                          ? 'bg-zinc-50 dark:bg-zinc-800/30 shadow-[inset_0_0_0_1.5px_rgba(0,0,0,0.08)]'
                                          : 'hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20'
                                      }
                                  `}
                              >
                                  {/* Número del día */}
                                  <div className="flex justify-between items-start mb-2">
                                      <span className={`
                                          text-[13px] font-bold w-7 h-7 flex items-center justify-center rounded-full
                                          ${isToday ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900' : 'text-zinc-600 dark:text-zinc-400'}
                                      `}>
                                          {d}
                                      </span>
                                      {/* Indicador sutil de agregar tarea (+) visible al hover */}
                                      <span className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-zinc-600">
                                          <i className="fa-solid fa-plus text-xs"></i>
                                      </span>
                                  </div>

                                  {/* Lista de Tareas */}
                                  <div className="space-y-1.5">
                                      {[...dayTasks, ...dayGoogle].map((task: any) => (
                                          <div 
                                            key={task.id}
                                            draggable={!task.summary}
                                            onContextMenu={(e) => !task.summary && handleContextMenu(e, task)}
                                            onDragStart={(e) => {
                                                if (!task.summary) {
                                                    e.dataTransfer.setData('taskId', task.id);
                                                    setDraggingTaskId(task.id);
                                                }
                                            }}
                                            onClick={(e) => { e.stopPropagation(); !task.summary && handleEdit(task); }}
                                            className={`
                                                cursor-grab active:cursor-grabbing
                                                text-[11px] px-2 py-1 rounded border truncate font-medium
                                                ${task.summary
                                                    ? 'bg-zinc-50 border-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400'
                                                    : task.status === 'DONE'
                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100 line-through opacity-70 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-900/30'
                                                        : 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 border-zinc-900 dark:border-zinc-200'
                                                }
                                            `}
                                            title={task.title || task.summary}
                                        >
                                              {task.title || task.summary}
                                          </div>
                                      ))}
                                  </div>
                              </div>
                          );
                      })}
                  </div>
              </div>
          </div>
      );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 h-[calc(100vh-100px)] flex flex-col pb-6">
      
      {/* Header */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 flex-shrink-0">

        {/* Left: Title & Date Nav */}
        <div className="flex flex-col gap-1.5">
            <h1 className="text-[26px] font-bold tracking-[-0.03em] text-zinc-900 dark:text-white flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-zinc-400"/> Agenda
            </h1>

            <div className="flex items-center gap-2">
                <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 rounded-[10px] p-0.5">
                    <button onClick={() => changeDate(-1)} className="p-1.5 hover:bg-white dark:hover:bg-zinc-700 rounded-[8px] text-zinc-500 transition-all shadow-none hover:shadow-[0_1px_3px_rgba(0,0,0,0.08)]"><ChevronLeft className="w-3.5 h-3.5"/></button>
                    <button onClick={() => setReferenceDate(new Date())} className="px-2.5 py-0.5 text-[12px] font-semibold text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white">Hoy</button>
                    <button onClick={() => changeDate(1)} className="p-1.5 hover:bg-white dark:hover:bg-zinc-700 rounded-[8px] text-zinc-500 transition-all shadow-none hover:shadow-[0_1px_3px_rgba(0,0,0,0.08)]"><ChevronRight className="w-3.5 h-3.5"/></button>
                </div>
                <h2 className="text-[15px] font-medium capitalize text-zinc-600 dark:text-zinc-400 min-w-[200px]">
                    {viewMode === 'TODAY'
                        ? referenceDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
                        : viewMode === 'WEEK'
                            ? `Semana del ${getWeekRange(referenceDate)}`
                            : referenceDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
                    }
                </h2>
            </div>
        </div>

        {/* Right: Controls */}
        <div className="flex flex-col md:flex-row gap-2 w-full xl:w-auto items-center">
            {/* View Switcher */}
            <div className="bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-[10px] flex w-full md:w-auto">
                {([['TODAY', 'Día'], ['WEEK', 'Semana'], ['CALENDAR', 'Mes'], ['LIST', 'Lista']] as const).map(([mode, label]) => (
                     <button
                        key={mode}
                        onClick={() => setViewMode(mode as ViewMode)}
                        className={`
                            flex-1 md:flex-none px-3.5 py-1.5 rounded-[8px] text-[13px] font-medium transition-all
                            ${viewMode === mode
                                ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-[0_1px_3px_rgba(0,0,0,0.1)]'
                                : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300'}
                        `}
                     >
                         {label}
                     </button>
                 ))}
             </div>

             <div className="h-5 w-px bg-zinc-200 dark:bg-zinc-700 hidden md:block mx-1"></div>

             <div className="relative flex-1 md:min-w-[200px] w-full">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                 <Input placeholder="Buscar..." className="pl-9 h-10 w-full" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
             </div>

             <button onClick={() => { setIsModalOpen(true); resetForm(); }} className="flex items-center gap-2 h-10 px-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-[13px] font-semibold rounded-[10px] shadow-[0_1px_3px_rgba(0,0,0,0.15)] hover:bg-black dark:hover:bg-zinc-100 active:scale-[0.97] transition-all w-full md:w-auto justify-center">
                 <Plus className="w-4 h-4" /> Crear
             </button>
        </div>
      </div>

      {/* Content */}
      {viewMode === 'CALENDAR' && renderMonthGrid()}
      {viewMode === 'LIST' && renderListView()}
      {(viewMode === 'WEEK' || viewMode === 'TODAY') && renderTimeGrid()}

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
                      <select className="flex h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 py-2 text-sm outline-none focus:border-black" value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value as any})}>
                          <option value="HIGH">Alta</option>
                          <option value="MEDIUM">Media</option>
                          <option value="LOW">Baja</option>
                      </select>
                  </div>
                  <div>
                      <Label>Estado</Label>
                      <select className="flex h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 py-2 text-sm outline-none focus:border-black" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})}>
                          <option value={TaskStatus.TODO}>Pendiente</option>
                          <option value={TaskStatus.DONE}>Completada</option>
                      </select>
                  </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                  <div>
                      <Label>Asignar a</Label>
                      <select className="flex h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 py-2 text-sm outline-none focus:border-black" value={formData.assigneeId} onChange={e => setFormData({...formData, assigneeId: e.target.value})}>
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
                  <select className="flex h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 py-2 text-sm outline-none focus:border-black" value={formData.sopId} onChange={e => setFormData({...formData, sopId: e.target.value})}>
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
              <div className="bg-zinc-50 p-4 rounded-xl text-sm whitespace-pre-wrap font-mono">
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
            { label: contextMenu.task?.status === TaskStatus.DONE ? 'Marcar Pendiente' : 'Completar Tarea', icon: CheckCircle2, onClick: () => { if(contextMenu.task) db.tasks.updateStatus(contextMenu.task.id, contextMenu.task.status === TaskStatus.DONE ? TaskStatus.TODO : TaskStatus.DONE).then(() => { loadData(); fetchGoogleEvents(); }); handleCloseContextMenu(); } },
            { label: 'Editar', icon: Edit2, onClick: () => { if(contextMenu.task) handleEdit(contextMenu.task); } },
            { label: 'Ver SOP Asociado', icon: Book, onClick: () => { if(contextMenu.task?.sopId) handleViewSOP(contextMenu.task.sopId); else alert("Esta tarea no tiene SOP vinculado."); handleCloseContextMenu(); } },
            { label: 'Recordar por WhatsApp', icon: MessageCircle, onClick: () => { if(contextMenu.task) sendPartnerReminder(contextMenu.task); handleCloseContextMenu(); } },
            { label: 'Eliminar', icon: Trash2, variant: 'destructive', onClick: () => { if(contextMenu.task) handleDelete(contextMenu.task); } }
        ]}
      />
    </div>
  );
}
