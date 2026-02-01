import React, { useEffect, useState } from 'react';
import { db } from '../services/db';
import { ai } from '../services/ai';
import { supabase } from '../services/supabase';
import { googleCalendarService } from '../services/googleCalendar';
import { Task, TaskStatus, Contractor, SOP } from '../types';
import { Button, Input, Label, Modal, Textarea, Badge } from '../components/UIComponents';
import { ContextMenu } from '../components/ContextMenu';
import { 
  CheckCircle2, 
  Plus, 
  Trash2, 
  Calendar as CalendarIcon,
  Search,
  Book,
  MessageCircle,
  Edit2,
  Sparkles,
  ExternalLink
} from 'lucide-react';

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [sops, setSops] = useState<SOP[]>([]); 
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [sopModalOpen, setSopModalOpen] = useState(false);
  const [selectedSop, setSelectedSop] = useState<SOP | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; task: Task | null }>({ x: 0, y: 0, task: null });
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [googleAuthDone, setGoogleAuthDone] = useState(false);

  // ESTADO DEL FORMULARIO
  const [formData, setFormData] = useState<{
    id?: string;
    title: string;
    description: string;
    assigneeId: string;
    dueDate: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH';
    status: TaskStatus;
    sopId: string;
    googleEventId?: string;
  }>({
    title: '',
    description: '',
    assigneeId: '',
    dueDate: '',
    priority: 'MEDIUM',
    status: TaskStatus.TODO,
    sopId: ''
  });

  // CARGAR DATOS + AUTENTICACIÓN
  useEffect(() => {
    loadData();
    const handleTaskCreated = () => { loadData(); };
    window.addEventListener('task-created', handleTaskCreated);

    // Initial Auth Check
    googleCalendarService.loadScripts().then(async () => {
        try {
            const isAuth = await googleCalendarService.getIsAuthenticated();
            if (isAuth) {
                await googleCalendarService.initializeSession();
                setGoogleAuthDone(true);
            }
        } catch (e) {
            console.error("GAPI Init Error", e);
        }
    });

    // Auth Listener
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
            await googleCalendarService.initializeSession();
            setGoogleAuthDone(true);
        } else if (event === 'SIGNED_OUT') {
            setGoogleAuthDone(false);
        }
    });
    
    return () => { 
        window.removeEventListener('task-created', handleTaskCreated); 
        authListener.subscription.unsubscribe();
    };
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
      console.error("Error cargando datos locales:", err);
    }
  };

  // --- CONFIGURACIÓN DEL CALENDARIO (IFRAME) ---
  // Reemplaza 'lucagazze1%40gmail.com' con tu email si es diferente (el %40 es el @)
  const calendarEmbedUrl = "https://calendar.google.com/calendar/embed?src=lucagazze1%40gmail.com&ctz=America%2FArgentina%2FBuenos_Aires&showTitle=0&showPrint=0&showTabs=1&showCalendars=0&mode=WEEK";

  // --- HANDLERS ---

  const handleAiAssist = async () => {
      if (!formData.title) {
          alert("Escribe un título primero.");
          return;
      }
      setIsAiGenerating(true);
      try {
          const now = new Date();
          const prompt = `Actúa como asistente para una agencia. Contexto: ${now.toLocaleString()}. Input: "${formData.title}". Retorna JSON: { "cleanTitle": "...", "description": "...", "dueDate": "ISO..." }`;
          const responseText = await ai.chat([{ role: 'user', content: prompt }]);
          const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
          const data = JSON.parse(cleanJson);
          
          setFormData(prev => ({
              ...prev,
              title: data.cleanTitle || prev.title,
              description: prev.description ? prev.description + "\n\n" + data.description : data.description,
              dueDate: data.dueDate ? data.dueDate.slice(0, 16) : prev.dueDate
          }));
      } catch (error) {
          console.error(error);
      } finally {
          setIsAiGenerating(false);
      }
  };

  // --- GOOGLE SYNC HELPERS ---
  
  const handleGoogleAuth = async () => {
      try {
          await googleCalendarService.authenticate();
          setGoogleAuthDone(true);
          return true;
      } catch (e: any) {
          console.error("Auth error", e);
          alert("Error de autenticación: " + JSON.stringify(e));
          return false;
      }
  };

  const handleGoogleLogout = () => {
      googleCalendarService.logout();
      setGoogleAuthDone(false);
      alert("Desconectado de Google Calendar.");
  };

  const syncTaskToGoogle = async (task: any, isUpdate: boolean = false) => {
      const isAuth = await googleCalendarService.getIsAuthenticated();
      if (!isAuth || !task.dueDate) return null;

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
          return null;
      }
  };

  const deleteFromGoogle = async (googleEventId: string) => {
      const isAuth = await googleCalendarService.getIsAuthenticated();
      if (!isAuth) return;
      try {
          await googleCalendarService.deleteEvent(googleEventId);
      } catch (e) {
          console.error("Google Delete Failed", e);
      }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!formData.title) return;
      
      const payload: any = {
          title: formData.title,
          description: formData.description,
          priority: formData.priority,
          status: formData.status,
          dueDate: formData.dueDate || null,
          sopId: formData.sopId || null,
          googleEventId: formData.googleEventId // Mantener ID si existe
      };
      
      if (formData.assigneeId) payload.assigneeId = formData.assigneeId;

      // START SYNC
      const isAuth = await googleCalendarService.getIsAuthenticated();
      if (isAuth && formData.dueDate) {
          const gEventId = await syncTaskToGoogle({ ...payload, googleEventId: formData.googleEventId }, !!formData.id);
          if (gEventId) payload.googleEventId = gEventId;
      }

      if (formData.id) {
          await db.tasks.update(formData.id, payload);
      } else {
          await db.tasks.create(payload);
      }
      
      setIsModalOpen(false);
      resetForm();
      await loadData();
      
      // Auto-refresh iframe (hacky but works)
      const iframe = document.getElementById('google-cal-iframe') as HTMLIFrameElement;
      if(iframe) iframe.src = iframe.src;
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
          // Iframe refresh
          const iframe = document.getElementById('google-cal-iframe') as HTMLIFrameElement;
          if(iframe) iframe.src = iframe.src;
      }
      handleCloseContextMenu();
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
          alert("El socio no tiene teléfono.");
          return;
      }
      const message = `Hola ${partner.name.split(' ')[0]}, recordatorio: *${task.title}*.\n${task.description || ''}`;
      window.open(`https://wa.me/${partner.phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const filteredTasks = tasks.filter(t => t.title.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-6 animate-in fade-in duration-500 min-h-screen flex flex-col pb-12">
      
      {/* HEADER */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 flex-shrink-0 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm">
        <div className="flex flex-col gap-1">
            <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-blue-600"/> Agenda & Tareas
            </h1>
            <div className="flex items-center gap-2">
                <p className="text-xs text-gray-500">Gestión de Algoritmia</p>
                {/* Google Auth Button */}
                <Button 
                    variant="outline" 
                    size="sm"
                    onClick={googleAuthDone ? handleGoogleLogout : handleGoogleAuth}
                    className={`ml-2 text-[10px] h-6 px-2 border gap-1 rounded-md ${googleAuthDone ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}
                >
                    <img src="https://www.google.com/favicon.ico" className="w-3 h-3 opacity-70" alt="G" />
                    {googleAuthDone ? "Conectado" : "Conectar Google"}
                </Button>
            </div>
        </div>
        
        <div className="flex flex-col md:flex-row gap-3 w-full xl:w-auto items-center">
             <div className="relative flex-1 md:min-w-[200px] w-full">
                 <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                 <Input placeholder="Buscar tareas..." className="pl-9 h-10 w-full bg-gray-50 dark:bg-slate-800/50 border-transparent focus:bg-white transition-all" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
             </div>
             
             <Button onClick={() => { setIsModalOpen(true); resetForm(); }} className="w-full md:w-auto shadow-lg bg-blue-600 hover:bg-blue-700 text-white rounded-xl">
                 <Plus className="w-4 h-4 mr-2" /> Nueva Tarea Local
             </Button>
        </div>
      </div>

      {/* CONTENIDO PRINCIPAL: CALENDARIO + LISTA */}
      <div className="flex flex-col lg:flex-row gap-6 h-[750px]">
          
          {/* IZQUIERDA: GOOGLE CALENDAR EMBED */}
          <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
              <div className="p-3 border-b border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 flex justify-between items-center">
                  <h3 className="font-semibold text-gray-700 dark:text-gray-300 text-sm flex items-center gap-2">
                      <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="G" />
                      Google Calendar
                  </h3>
                  <a href="https://calendar.google.com" target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline flex items-center gap-1">
                      Abrir completo <ExternalLink className="w-3 h-3"/>
                  </a>
              </div>
              <div className="flex-1 relative">
                  {/* IFRAME: Aquí es donde se carga el calendario de Google directamente */}
                  <iframe 
                    id="google-cal-iframe"
                    src={calendarEmbedUrl} 
                    style={{border: 0}} 
                    width="100%" 
                    height="100%" 
                    frameBorder="0" 
                    scrolling="no"
                    title="Google Calendar"
                  ></iframe>
              </div>
          </div>

          {/* DERECHA: LISTA DE TAREAS LOCALES */}
          <div className="w-full lg:w-96 bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm flex flex-col">
              <div className="p-4 border-b border-gray-100 dark:border-slate-800">
                  <h3 className="font-bold text-lg">Pendientes (Interno)</h3>
                  <p className="text-xs text-gray-500">Base de datos Algoritmia</p>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                  {filteredTasks.length === 0 && (
                      <div className="text-center py-10 text-gray-400 text-sm">No hay tareas pendientes</div>
                  )}
                  {filteredTasks.map(task => (
                      <div 
                        key={task.id}
                        onContextMenu={(e) => handleContextMenu(e, task)}
                        className="p-3 rounded-xl border border-gray-100 dark:border-slate-800 hover:border-blue-200 dark:hover:border-blue-900 bg-gray-50/50 dark:bg-slate-800/20 transition-all cursor-pointer group"
                        onClick={() => handleEdit(task)}
                      >
                          <div className="flex justify-between items-start mb-1">
                              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${task.priority === 'HIGH' ? 'bg-red-100 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
                                  {task.priority === 'HIGH' ? 'Alta' : 'Normal'}
                              </span>
                              {task.dueDate && (
                                  <span className="text-[10px] text-gray-400 font-mono">
                                      {new Date(task.dueDate).toLocaleDateString()}
                                  </span>
                              )}
                          </div>
                          <h4 className="font-medium text-sm text-gray-800 dark:text-gray-200 leading-tight mb-1">{task.title}</h4>
                          
                          {/* Footer de la tarjeta */}
                          <div className="flex justify-between items-center mt-2">
                              {task.assigneeId && (
                                  <div className="flex items-center gap-1">
                                      <div className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[8px] font-bold">
                                          {contractors.find(c => c.id === task.assigneeId)?.name.charAt(0) || 'U'}
                                      </div>
                                      <span className="text-[10px] text-gray-500">Asignado</span>
                                  </div>
                              )}
                              {task.sopId && <Book className="w-3 h-3 text-emerald-500" title="Tiene SOP"/>}
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      </div>

      {/* MODAL EDITAR/CREAR */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={formData.id ? 'Editar Tarea' : 'Nueva Tarea'}>
          <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                  <Label>Título</Label>
                  <div className="flex gap-2">
                      <Input value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="Ej: Llamar a cliente..." autoFocus />
                      <Button type="button" variant="outline" onClick={handleAiAssist} disabled={isAiGenerating}>
                          {isAiGenerating ? <Sparkles className="w-4 h-4 animate-spin"/> : <Sparkles className="w-4 h-4 text-purple-600"/>}
                      </Button>
                  </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                  <div>
                      <Label>Prioridad</Label>
                      <select className="flex h-11 w-full rounded-xl border border-gray-200 bg-gray-50/50 px-3 py-2 text-sm outline-none" value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value as any})}>
                          <option value="HIGH">Alta</option>
                          <option value="MEDIUM">Media</option>
                          <option value="LOW">Baja</option>
                      </select>
                  </div>
                  <div>
                      <Label>Estado</Label>
                      <select className="flex h-11 w-full rounded-xl border border-gray-200 bg-gray-50/50 px-3 py-2 text-sm outline-none" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})}>
                          <option value={TaskStatus.TODO}>Pendiente</option>
                          <option value={TaskStatus.DONE}>Completada</option>
                      </select>
                  </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                  <div>
                      <Label>Asignar a</Label>
                      <select className="flex h-11 w-full rounded-xl border border-gray-200 bg-gray-50/50 px-3 py-2 text-sm outline-none" value={formData.assigneeId} onChange={e => setFormData({...formData, assigneeId: e.target.value})}>
                          <option value="">(Sin asignar)</option>
                          {contractors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                  </div>
                  <div>
                      <Label>Vencimiento (Interno)</Label>
                      <Input type="datetime-local" value={formData.dueDate} onChange={e => setFormData({...formData, dueDate: e.target.value})} />
                  </div>
              </div>
              <div>
                  <Label>Vincular SOP</Label>
                  <select className="flex h-11 w-full rounded-xl border border-gray-200 bg-gray-50/50 px-3 py-2 text-sm outline-none" value={formData.sopId} onChange={e => setFormData({...formData, sopId: e.target.value})}>
                      <option value="">(Ninguno)</option>
                      {sops.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                  </select>
              </div>
              <div>
                  <Label>Descripción</Label>
                  <Textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Detalles..." className="min-h-[100px]" />
              </div>
              <div className="flex gap-2 pt-4">
                  {formData.id && (
                      <Button type="button" variant="destructive" onClick={() => handleDelete({ id: formData.id! } as Task)} className="mr-auto"><Trash2 className="w-4 h-4"/></Button>
                  )}
                  <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                  <Button type="submit">{formData.id ? 'Guardar' : 'Crear'}</Button>
              </div>
          </form>
      </Modal>

      <Modal isOpen={sopModalOpen} onClose={() => setSopModalOpen(false)} title={`SOP: ${selectedSop?.title}`}>
          <div className="space-y-4">
              <Badge>{selectedSop?.category}</Badge>
              <div className="bg-gray-50 p-4 rounded-xl text-sm whitespace-pre-wrap font-mono">{selectedSop?.content}</div>
              <div className="flex justify-end"><Button onClick={() => setSopModalOpen(false)}>Cerrar</Button></div>
          </div>
      </Modal>

      <ContextMenu 
        x={contextMenu.x} y={contextMenu.y} isOpen={!!contextMenu.task} onClose={handleCloseContextMenu}
        items={[
            { label: contextMenu.task?.status === TaskStatus.DONE ? 'Marcar Pendiente' : 'Completar Tarea', icon: CheckCircle2, onClick: () => { if(contextMenu.task) db.tasks.updateStatus(contextMenu.task.id, contextMenu.task.status === TaskStatus.DONE ? TaskStatus.TODO : TaskStatus.DONE).then(() => loadData()); handleCloseContextMenu(); } },
            { label: 'Editar', icon: Edit2, onClick: () => { if(contextMenu.task) handleEdit(contextMenu.task); } },
            { label: 'Ver SOP', icon: Book, onClick: () => { if(contextMenu.task?.sopId) handleViewSOP(contextMenu.task.sopId); else alert("Sin SOP vinculado."); handleCloseContextMenu(); } },
            { label: 'WhatsApp', icon: MessageCircle, onClick: () => { if(contextMenu.task) sendPartnerReminder(contextMenu.task); handleCloseContextMenu(); } },
            { label: 'Eliminar', icon: Trash2, variant: 'destructive', onClick: () => { if(contextMenu.task) handleDelete(contextMenu.task); } }
        ]}
      />
    </div>
  );
}