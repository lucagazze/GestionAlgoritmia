
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
  const [sops, setSops] = useState<SOP[]>([]); 
  const [googleEvents, setGoogleEvents] = useState<any[]>([]); // New state for external events
  
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
          alert("Escribe un título primero (ej: 'Reunión con Juan el viernes a las 15').");
          return;
      }
      setIsAiGenerating(true);
      try {
          const now = new Date();
          const localTime = now.toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });
          
          const prompt = `
            Actúa como un Asistente Personal Inteligente.
            Contexto Temporal (Ahora): ${localTime}.
            Input del Usuario: "${formData.title}".
            
            Tu misión:
            1. Analizar el input para entender la intención, el título real y si hay fecha/hora.
            2. Si hay fecha/hora (ej: "mañana", "el jueves", "a las 5pm", "en 2 horas"), calcula la fecha ISO exacta.
            3. Genera una descripción breve profesional.
            
            Retorna SOLO un JSON (sin markdown):
            {
              "cleanTitle": "Título limpio y profesional (ej: 'Reunión con Juan')",
              "description": "Descripción breve y accionable...",
              "dueDate": "ISO_DATE_STRING_WITH_OFFSET (ej: 2024-02-10T15:00:00-03:00) o null si no se detecta fecha"
            }
          `;

          const responseText = await ai.chat([{ role: 'user', content: prompt }]);
          
          // Clean response (remove markdown code blocks if present)
          const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
          const data = JSON.parse(cleanJson);
          
          setFormData(prev => ({
              ...prev,
              title: data.cleanTitle || prev.title,
              description: prev.description ? prev.description + "\n\n" + data.description : data.description,
              dueDate: data.dueDate ? data.dueDate.slice(0, 16) : prev.dueDate // Slice format for datetime-local
          }));
      } catch (error) {
          console.error(error);
          alert("La IA no pudo procesar la solicitud. Intenta ser más claro con la fecha.");
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
      // Debug Alert
      // alert(`Intentando sincronizar: Auth=${googleCalendarService.getIsAuthenticated()}, Date=${task.dueDate}`);

      // Only sync if auth is done and date is present
      if (!googleCalendarService.getIsAuthenticated() || !task.dueDate) return null;

      const start = new Date(task.dueDate);
      const end = new Date(start.getTime() + 30 * 60 * 1000); // 30 mins default

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

      // Google Sync Logic
      let gEventId = formData.googleEventId;
      if (googleCalendarService.getIsAuthenticated() && formData.dueDate) {
          gEventId = await syncTaskToGoogle({ ...payload, googleEventId: formData.googleEventId }, !!formData.id);
      } else {
          console.warn("Skipping Google Sync. Auth:", googleCalendarService.getIsAuthenticated(), "Date:", formData.dueDate);
          if (!googleCalendarService.getIsAuthenticated()) {
              alert("⚠️ NO SE SINCRONIZÓ: No estás autenticado en Google. Haz click en 'Conectar' arriba.");
          } else if (!formData.dueDate) {
              alert("⚠️ NO SE SINCRONIZÓ: La tarea no tiene fecha/hora.");
          }
      }
      if (gEventId) payload.googleEventId = gEventId;

      if (formData.id) {
          await db.tasks.update(formData.id, payload);
      } else {
          // If we have a google ID, we must save it with the task so duplication is avoided
          await db.tasks.create(payload);
      }
      setIsModalOpen(false);
      resetForm();
      await loadData(); // Reload local tasks first
      fetchGoogleEvents(); // Then refresh google view
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
              await loadData();
              fetchGoogleEvents();
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

  // --- TIME GRID RENDERER (Day/Week) ---
  const renderTimeGrid = () => {
      const isWeek = viewMode === 'WEEK';
      const hours = Array.from({ length: 24 }, (_, i) => i);
      
      // Determine columns
      let daysToShow: Date[] = [];
      if (isWeek) {
          const start = new Date(referenceDate);
          const day = start.getDay() || 7; 
          start.setDate(start.getDate() - (day - 1)); // Monday
          daysToShow = Array.from({ length: 7 }, (_, i) => {
              const d = new Date(start);
              d.setDate(d.getDate() + i);
              return d;
          });
      } else {
          daysToShow = [new Date(referenceDate)];
      }

      return (
          <div className="flex flex-col flex-1 min-h-0 bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden">
              {/* Header Row */}
              <div className="flex border-b border-gray-200 dark:border-slate-800 ml-14">
                  {daysToShow.map((date, i) => {
                       const isToday = new Date().toDateString() === date.toDateString();
                       return (
                           <div key={i} className={`flex-1 text-center py-3 border-l border-gray-100 dark:border-slate-800 ${isToday ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
                               <div className={`text-xs uppercase font-semibold ${isToday ? 'text-blue-600' : 'text-gray-500'}`}>
                                   {date.toLocaleDateString('es-ES', { weekday: 'short' })}
                               </div>
                               <div className={`text-xl font-bold mt-1 inline-flex w-8 h-8 items-center justify-center rounded-full ${isToday ? 'bg-blue-600 text-white shadow-md' : 'text-gray-900 dark:text-white'}`}>
                                   {date.getDate()}
                               </div>
                           </div>
                       );
                  })}
              </div>

              {/* Scrollable Grid */}
              <div className="flex flex-1 overflow-y-auto relative custom-scrollbar bg-white dark:bg-slate-900">
                  {/* Time Axis */}
                  <div className="w-16 flex-shrink-0 relative h-[672px] bg-white dark:bg-slate-900 border-r border-gray-100 dark:border-slate-800 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
                      {hours.map(h => (
                          <span 
                            key={h} 
                            className="absolute right-3 text-xs font-medium text-gray-400 dark:text-gray-500 font-mono -translate-y-1/2"
                            style={{ top: `${h * 28}px` }}
                          >
                                {h}:00
                          </span>
                      ))}
                  </div>

                  {/* Columns */}
                  <div className="flex-1 flex relative min-w-[600px] h-[672px]"> 
                      {/* Horizontal Lines */}
                      <div className="absolute inset-0 z-0 pointer-events-none">
                          {hours.map(h => (
                              <div 
                                key={h} 
                                className="absolute left-0 right-0 border-b border-gray-100 dark:border-slate-800 dashed"
                                style={{ top: `${h * 28}px` }}
                              />
                          ))}
                      </div>

                      {daysToShow.map((date, i) => {
                          const { dayTasks, dayGoogle } = getEventsForDate(date);
                          const isToday = new Date().toDateString() === date.toDateString();

                          const handleColumnClick = (e: React.MouseEvent) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              const y = e.clientY - rect.top; // Relative Y
                              const scrollY = e.currentTarget.scrollTop; // If individual scroll (unlikely here since parent scrolls)
                              
                              // Logic: 28px = 60 mins
                              const totalMinutes = (y / 28) * 60;
                              const hour = Math.floor(totalMinutes / 60);
                              const minute = Math.floor(totalMinutes % 60);
                              
                              const newDate = new Date(date);
                              newDate.setHours(hour, minute, 0, 0);
                              
                              // Local ISO format for input
                              const iso = newDate.toLocaleString('sv').replace(' ', 'T').slice(0, 16);
                              
                              setFormData(prev => ({ ...prev, dueDate: iso, title: '' }));
                              setIsModalOpen(true);
                          };

                          return (
                              <div 
                                key={i} 
                                className={`flex-1 relative border-l border-transparent hover:bg-gray-50/30 dark:hover:bg-slate-800/30 transition-colors h-[672px] group ${isToday ? 'bg-blue-50/10' : ''}`}
                                onDragOver={(e) => { e.preventDefault(); setDragOverSlot(date.toISOString()); }} 
                                onDrop={(e) => handleDrop(e, date)}
                                onDoubleClick={handleColumnClick}
                              >
                                  {/* Vertical Hour Lines (Subtle) */}
                                   <div className="absolute inset-y-0 -left-px w-px bg-gray-100 dark:bg-slate-800"></div>

                                  {/* Render Tasks */}
                                  {[...dayTasks, ...dayGoogle].map((item: any) => {
                                      let start: Date, id: string, title: string, isGoogle = false;
                                      
                                      if (item.start) { 
                                          start = new Date(item.start.dateTime || item.start.date);
                                          id = item.id;
                                          title = item.summary;
                                          isGoogle = true;
                                      } else { 
                                          start = new Date(item.dueDate);
                                          id = item.id;
                                          title = item.title;
                                      }

                                      const minutesTotal = start.getHours() * 60 + start.getMinutes();
                                      const top = minutesTotal * (28 / 60); 
                                      const height = 28; 

                                      return (
                                          <div
                                              key={id}
                                              onClick={(e) => { e.stopPropagation(); !isGoogle && handleEdit(item); }}
                                              onContextMenu={(e) => !isGoogle && handleContextMenu(e, item)}
                                              draggable={!isGoogle}
                                              onDragStart={(e) => !isGoogle && e.dataTransfer.setData('taskId', id)}
                                              className={`
                                                  absolute left-1 right-2 rounded-lg px-3 py-1 text-[10px] font-semibold shadow-sm border overflow-hidden cursor-pointer hover:shadow-md hover:scale-[1.01] transition-all z-10 flex flex-col justify-center
                                                  ${isGoogle 
                                                      ? 'bg-white border-blue-200 text-blue-700 shadow-[0_2px_8px_rgba(59,130,246,0.15)] dark:bg-slate-800 dark:border-blue-900 dark:text-blue-300' 
                                                      : item.status === 'DONE' 
                                                          ? 'bg-green-100 text-green-700 border-green-200 opacity-90' 
                                                          : 'bg-gradient-to-br from-indigo-50 to-white border-indigo-200 text-indigo-800 dark:from-indigo-900 dark:to-slate-900 dark:border-indigo-700 dark:text-indigo-200'
                                                  }
                                              `}
                                              style={{ top: `${top}px`, height: `${height}px` }}
                                          >
                                              <div className="flex items-center gap-1.5">
                                                {isGoogle && <img src="https://www.google.com/favicon.ico" className="w-3 h-3 opacity-70" alt="G" />}
                                                <span className="truncate leading-tight">{title}</span>
                                              </div>
                                          </div>
                                      );
                                  })}
                              </div>
                          );
                      })}
                      
                      {/* Current Time Line */}
                      {daysToShow.some(d => d.toDateString() === new Date().toDateString()) && (
                          <div 
                              className="absolute w-full border-t-2 border-red-500 z-20 pointer-events-none flex items-center"
                              style={{ top: `${(new Date().getHours() * 60 + new Date().getMinutes()) * (28/60)}px` }}
                          >
                              <div className="w-2 h-2 rounded-full bg-red-500 -ml-1 shadow-sm"></div>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      );
  };
    
  // Calendar Logic (Month)
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
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm flex flex-col min-h-[900px]">
              {/* Calendar Header */}
              {/* Days Header */}
              <div className="grid grid-cols-7 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50">
                  {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(d => (
                      <div key={d} className="py-2 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">{d}</div>
                  ))}
              </div>

              <div className="grid grid-cols-7 grid-rows-6 flex-1 bg-gray-200 dark:bg-slate-800 gap-px overflow-y-auto min-h-0">
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
                              <span className={`text-xs font-bold mb-0.5 w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-black dark:bg-white text-white dark:text-black' : 'text-gray-400'}`}>
                                  {date.getDate()}
                              </span>
                              
                              <div className="flex-1 overflow-y-auto space-y-0.5 custom-scrollbar">
                                  {/* APP TASKS */}
                                  {dayTasks
                                      .sort((a, b) => new Date(a.dueDate || 0).getTime() - new Date(b.dueDate || 0).getTime())
                                      .map(t => {
                                          const timeStr = t.dueDate ? new Date(t.dueDate).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '';
                                          return (
                                          <div 
                                              key={t.id} 
                                              draggable
                                              onDragStart={(e) => e.dataTransfer.setData('taskId', t.id)}
                                              onContextMenu={(e) => handleContextMenu(e, t)}
                                              onClick={() => handleEdit(t)}
                                              className={`
                                                  text-[10px] px-1.5 py-0.5 rounded-sm border truncate cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-all flex items-center gap-1 font-medium leading-none
                                                  ${t.status === TaskStatus.DONE 
                                                      ? 'bg-green-100 text-green-800 border-green-200' 
                                                      : t.priority === 'HIGH' 
                                                          ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-100 dark:border-red-900' 
                                                          : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-slate-700 hover:border-blue-300'
                                                  }
                                              `}
                                          >
                                              <span className="text-[9px] font-bold opacity-75 tabular-nums text-gray-600 dark:text-gray-400">{timeStr}</span>
                                              {t.googleEventId && <Link className="w-2 h-2 text-blue-500 flex-shrink-0" />}
                                              <span className="truncate">{t.title}</span>
                                          </div>
                                      )})}

                                  {/* EXTERNAL GOOGLE EVENTS */}
                                  {googleEvents
                                    .filter(ev => {
                                        const evDate = new Date(ev.start.dateTime || ev.start.date);
                                        // Match date
                                        if (evDate.getDate() !== date.getDate() || evDate.getMonth() !== date.getMonth() || evDate.getFullYear() !== date.getFullYear()) return false;
                                        // De-duplicate: Don't show if this google ID is already linked to a local task
                                        if (dayTasks.some(t => t.googleEventId === ev.id)) return false;
                                        return true;
                                    })
                                    .map(ev => (
                                        <div 
                                            key={ev.id}
                                            title="Evento de Google Calendar (Externo)"
                                            className="text-[10px] px-1.5 py-0.5 rounded-sm border border-blue-100 bg-blue-50/50 text-blue-700 dark:bg-blue-900/20 dark:border-blue-900 dark:text-blue-300 truncate flex items-center gap-1 opacity-90 hover:opacity-100 font-medium leading-none"
                                        >
                                           <img src="https://www.google.com/favicon.ico" className="w-2 h-2 opacity-50" alt="G" />
                                           <span className="truncate">{ev.summary}</span>
                                        </div>
                                    ))
                                  }
                              </div>
                          </div>
                      );
                  })}
              </div>
          </div>
      );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 min-h-screen flex flex-col pb-12">
      
      {/* Header */}
      {/* Header */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 flex-shrink-0 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm">
        
        {/* Left: Title & Date Nav */}
        <div className="flex flex-col gap-1">
            <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-blue-600"/> Agenda
            </h1>
            
            <div className="flex items-center gap-2 mt-1">
                <div className="flex items-center bg-gray-100 dark:bg-slate-800 rounded-lg p-0.5">
                    <button onClick={() => changeDate(-1)} className="p-1 hover:bg-white dark:hover:bg-slate-700 rounded-md text-gray-500 transition-all"><ChevronLeft className="w-4 h-4"/></button>
                    <button onClick={() => setReferenceDate(new Date())} className="px-2 py-0.5 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:text-black">Hoy</button>
                    <button onClick={() => changeDate(1)} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-md text-gray-500 transition-all"><ChevronRight className="w-5 h-5"/></button>
                </div>
                <h2 className="text-xl font-medium capitalize text-gray-900 dark:text-white min-w-[200px]">
                    {viewMode === 'TODAY' 
                        ? referenceDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }) 
                        : viewMode === 'WEEK'
                            ? `Semana del ${getWeekRange(referenceDate)}`
                            : referenceDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
                    }
                </h2>
                
                {/* Google Status/Reconnect */}
                <Button 
                    variant="outline" 
                    size="sm"
                    onClick={googleAuthDone ? handleGoogleLogout : handleGoogleAuth}
                    className={`ml-2 text-xs border gap-1 rounded-lg h-7 px-2 ${googleAuthDone ? 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100' : 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'}`}
                    title={googleAuthDone ? "Conectado (Click para desconectar)" : "Desconectado (Click para conectar)"}
                >
                    <img src="https://www.google.com/favicon.ico" className="w-3 h-3 opacity-70" alt="G" />
                    {googleAuthDone ? "Conectado" : "Conectar"}
                </Button>

            </div>
        </div>
        
        {/* Right: Controls */}
        <div className="flex flex-col md:flex-row gap-3 w-full xl:w-auto items-center">
             {/* View Switcher */}
             <div className="bg-gray-100 dark:bg-slate-800 p-1 rounded-lg flex w-full md:w-auto">
                 {([['TODAY', 'Día'], ['WEEK', 'Semana'], ['CALENDAR', 'Mes']] as const).map(([mode, label]) => (
                     <button 
                        key={mode}
                        onClick={() => setViewMode(mode as ViewMode)} 
                        className={`
                            flex-1 md:flex-none px-4 py-1.5 rounded-md text-sm font-medium transition-all
                            ${viewMode === mode 
                                ? 'bg-white dark:bg-slate-700 text-black dark:text-white shadow-sm' 
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}
                        `}
                     >
                         {label}
                     </button>
                 ))}
             </div>

             <div className="h-6 w-px bg-gray-300 dark:bg-slate-700 hidden md:block mx-2"></div>

             <div className="relative flex-1 md:min-w-[200px] w-full">
                 <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                 <Input placeholder="Buscar..." className="pl-9 h-10 w-full bg-gray-50 dark:bg-slate-800/50 border-transparent focus:bg-white transition-all" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
             </div>
             
             <Button onClick={() => { setIsModalOpen(true); resetForm(); }} className="w-full md:w-auto shadow-lg bg-blue-600 hover:bg-blue-700 text-white rounded-xl">
                 <Plus className="w-4 h-4 mr-2" /> Crear
             </Button>
        </div>
      </div>

      {/* Content */}
      {viewMode === 'CALENDAR' ? renderCalendar() : renderTimeGrid()}

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
