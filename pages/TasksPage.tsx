
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
  RefreshCw
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
  
  const formatDateForCalendar = (dateStr: string) => {
      const date = new Date(dateStr);
      return date.toISOString().replace(/-|:|\.\d\d\d/g, "");
  };

  const handleGoogleSync = async () => {
      // 1. Get Pending Tasks
      const pendingTasks = tasks.filter(t => t.status !== TaskStatus.DONE && t.dueDate);
      if (pendingTasks.length === 0) return alert("No hay tareas pendientes con fecha para sincronizar.");

      setIsSyncing(true);
      try {
          // 2. Auth with Google
          await googleCalendarService.authenticate();
          
          let count = 0;
          // 3. Loop and Create
          for (const t of pendingTasks) {
              if (!t.dueDate) continue;
              const start = new Date(t.dueDate);
              const end = new Date(start.getTime() + 60 * 60 * 1000); // 1 hour default

              await googleCalendarService.createEvent({
                  title: `[OS] ${t.title}`,
                  description: t.description || 'Tarea sincronizada desde Algoritmia OS',
                  startTime: start.toISOString(),
                  endTime: end.toISOString()
              });
              count++;
          }
          alert(`¡Éxito! Se han sincronizado ${count} tareas a tu Google Calendar.`);
      } catch (e: any) {
          console.error(e);
          if (e.error === 'access_denied') {
              alert("⚠️ Acceso denegado por Google.\n\nEs probable que tu proyecto esté en modo 'Testing' y tu email no esté en la lista de 'Test Users'.\n\nSolución: Ve a Google Cloud Console > OAuth Consent Screen > Test Users y agrega tu email.");
          } else if (e.message?.includes("client_id")) {
              alert("Falta configurar el 'OAuth Client ID' en la página de Ajustes.");
          } else {
              alert("Error al sincronizar. Revisa que las ventanas emergentes estén permitidas.");
          }
      } finally {
          setIsSyncing(false);
      }
  };