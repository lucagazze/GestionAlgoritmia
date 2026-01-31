
import React, { useEffect, useState } from 'react';
import { db } from '../services/db';
import { Task, TaskStatus, Contractor } from '../types';
import { Button, Input, Label, Modal, Textarea, Badge } from '../components/UIComponents';
import { 
  CheckCircle2, 
  Circle, 
  Clock, 
  Plus, 
  Trash2, 
  User, 
  Loader2,
  LayoutList,
  KanbanSquare,
  Calendar as CalendarIcon,
  Search,
  ArrowUpDown,
  ListFilter,
  Check,
  ChevronLeft,
  ChevronRight,
  Filter,
  AlertCircle
} from 'lucide-react';

type ViewMode = 'BOARD' | 'LIST' | 'CALENDAR';
type SortKey = 'dueDate' | 'priority' | 'status' | 'title';
type TimeFilter = 'ALL' | 'TODAY' | 'WEEK';

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  
  // Views & Filters
  const [viewMode, setViewMode] = useState<ViewMode>('LIST');
  const [searchTerm, setSearchTerm] = useState('');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('ALL');
  
  // Sorting State
  const [sortKey, setSortKey] = useState<SortKey>('dueDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
  
  // Calendar State
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());

  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
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

  // Close dropdown on click outside
  useEffect(() => {
      const closeDropdown = () => setIsSortDropdownOpen(false);
      if(isSortDropdownOpen) document.addEventListener('click', closeDropdown);
      return () => document.removeEventListener('click', closeDropdown);
  }, [isSortDropdownOpen]);

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

  // --- Actions ---

  const handleToggleStatus = async (e: React.MouseEvent, task: Task) => {
      e.stopPropagation(); // Prevent opening modal
      const newStatus = task.status === TaskStatus.DONE ? TaskStatus.TODO : TaskStatus.DONE;
      
      // Optimistic Update
      const updatedTasks = tasks.map(t => t.id === task.id ? { ...t, status: newStatus } : t);
      setTasks(updatedTasks);

      await db.tasks.updateStatus(task.id, newStatus);
  };

  const openCreateModal = () => {
      setFormData({ title: '', description: '', assigneeId: '', dueDate: '', priority: 'MEDIUM', status: TaskStatus.TODO });
      setIsModalOpen(true);
  };

  const openEditModal = (task: Task) => {
      setFormData({
          id: task.id,
          title: task.title,
          description: task.description || '',
          assigneeId: task.assigneeId || '',
          dueDate: task.dueDate || '',
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
            dueDate: formData.dueDate || null,
            priority: formData.priority
        };

        if (formData.id) {
             await db.tasks.delete(formData.id); // Hack for mock update
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
    if(confirm('¿Eliminar esta tarea?')) {
        setTasks(prev => prev.filter(t => t.id !== id)); 
        await db.tasks.delete(id);
        setIsModalOpen(false);
    }
  };

  // --- Sorting & Filtering Logic ---
  
  const toggleSort = (key: SortKey) => {
      if (sortKey === key) {
          setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
      } else {
          setSortKey(key);
          setSortDirection('asc');
      }
  };

  const getProcessedTasks = () => {
      // 1. Filter by Search
      let result = tasks.filter(t => t.title.toLowerCase().includes(searchTerm.toLowerCase()));

      // 2. Filter by Time (Only applies to List/Board usually, but we apply global logic here)
      if (timeFilter !== 'ALL') {
          const now = new Date();
          now.setHours(0,0,0,0);
          
          result = result.filter(t => {
              if (!t.dueDate) return false;
              const d = new Date(t.dueDate);
              d.setHours(0,0,0,0);
              
              if (timeFilter === 'TODAY') {
                  return d.getTime() === now.getTime();
              }
              if (timeFilter === 'WEEK') {
                  const nextWeek = new Date(now);
                  nextWeek.setDate(now.getDate() + 7);
                  return d >= now && d <= nextWeek;
              }
              return true;
          });
      }

      // 3. Sort
      result.sort((a, b) => {
          let valA: any = a[sortKey];
          let valB: any = b[sortKey];

          // Special Handling for Priorities to make them numeric
          if (sortKey === 'priority') {
              const map = { HIGH: 3, MEDIUM: 2, LOW: 1 };
              valA = map[a.priority || 'MEDIUM'];
              valB = map[b.priority || 'MEDIUM'];
          }
          // Special Handling for Status
          if (sortKey === 'status') {
              const map = { TODO: 1, IN_PROGRESS: 2, DONE: 3 };
              valA = map[a.status];
              valB = map[b.status];
          }
          // Special Handling for Date (Nulls last)
          if (sortKey === 'dueDate') {
              if (!valA) return 1;
              if (!valB) return -1;
              valA = new Date(valA).getTime();
              valB = new Date(valB).getTime();
          }
          // Strings
          if (typeof valA === 'string') valA = valA.toLowerCase();
          if (typeof valB === 'string') valB = valB.toLowerCase();

          if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
          if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
          return 0;
      });

      return result;
  };

  const processedTasks = getProcessedTasks();

  // --- Board Logic ---
  const handleDragStart = (e: React.DragEvent, id: string) => { e.dataTransfer.setData('text/plain', id); e.dataTransfer.effectAllowed = 'move'; };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
  const handleDrop = async (e: React.DragEvent, targetStatus: TaskStatus) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    if (!id) return;
    const taskIndex = tasks.findIndex(t => t.id === id);
    if (taskIndex === -1 || tasks[taskIndex].status === targetStatus) return;
    const updatedTasks = [...tasks];
    updatedTasks[taskIndex] = { ...updatedTasks[taskIndex], status: targetStatus };
    setTasks(updatedTasks);
    await db.tasks.updateStatus(id, targetStatus);
  };

  // --- Helpers ---
  const getPriorityColor = (priority?: string) => {
    switch(priority) {
        case 'HIGH': return 'bg-red-50 text-red-700 border-red-200';
        case 'LOW': return 'bg-blue-50 text-blue-700 border-blue-200';
        default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const formatDateDisplay = (isoString: string) => {
      if(!isoString) return '-';
      const date = new Date(isoString);
      return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };
  
  const formatDateShort = (isoString: string) => {
      if(!isoString) return '';
      const date = new Date(isoString);
      return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  };

  // --- RENDERERS ---

  const CalendarView = () => {
      const year = currentCalendarDate.getFullYear();
      const month = currentCalendarDate.getMonth();
      
      const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 = Sunday
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      
      const daysArray = [];
      // Fill empty slots for previous month
      for (let i = 0; i < firstDayOfMonth; i++) {
          daysArray.push(null);
      }
      // Fill days
      for (let i = 1; i <= daysInMonth; i++) {
          daysArray.push(new Date(year, month, i));
      }

      const changeMonth = (delta: number) => {
          const newDate = new Date(currentCalendarDate);
          newDate.setMonth(newDate.getMonth() + delta);
          setCurrentCalendarDate(newDate);
      };

      return (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col h-full shadow-sm">
              <div className="flex justify-between items-center p-4 border-b border-gray-100">
                  <h2 className="font-bold text-lg capitalize">
                      {currentCalendarDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                  </h2>
                  <div className="flex gap-2">
                      <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-gray-100 rounded-lg"><ChevronLeft className="w-5 h-5"/></button>
                      <button onClick={() => setCurrentCalendarDate(new Date())} className="text-sm px-3 hover:bg-gray-100 rounded-lg font-medium">Hoy</button>
                      <button onClick={() => changeMonth(1)} className="p-2 hover:bg-gray-100 rounded-lg"><ChevronRight className="w-5 h-5"/></button>
                  </div>
              </div>
              <div className="grid grid-cols-7 text-center border-b border-gray-100 bg-gray-50">
                  {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(d => (
                      <div key={d} className="py-2 text-xs font-bold text-gray-400 uppercase">{d}</div>
                  ))}
              </div>
              <div className="grid grid-cols-7 flex-1 auto-rows-fr">
                  {daysArray.map((date, idx) => {
                      if (!date) return <div key={idx} className="bg-gray-50/30 border-b border-r border-gray-100"></div>;
                      
                      const dayTasks = tasks.filter(t => {
                          if (!t.dueDate) return false;
                          const tDate = new Date(t.dueDate);
                          return tDate.getDate() === date.getDate() && tDate.getMonth() === date.getMonth() && tDate.getFullYear() === date.getFullYear();
                      });
                      
                      const isToday = new Date().toDateString() === date.toDateString();

                      return (
                          <div key={idx} className={`border-b border-r border-gray-100 p-2 min-h-[100px] hover:bg-blue-50/10 transition-colors flex flex-col gap-1 ${isToday ? 'bg-blue-50/30' : ''}`}>
                              <div className={`text-xs font-medium mb-1 ${isToday ? 'text-blue-600 font-bold' : 'text-gray-400'}`}>
                                  {date.getDate()}
                              </div>
                              {dayTasks.map(t => (
                                  <div 
                                    key={t.id} 
                                    onClick={() => openEditModal(t)}
                                    className={`text-[10px] px-1.5 py-1 rounded border truncate cursor-pointer shadow-sm transition-transform hover:scale-105 ${t.status === TaskStatus.DONE ? 'bg-gray-100 text-gray-400 line-through border-gray-200' : 'bg-white text-gray-700 border-gray-200'}`}
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

  const ListView = () => (
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm flex-1 flex flex-col">
          <div className="overflow-x-auto flex-1">
              <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100 uppercase text-xs tracking-wider sticky top-0 bg-gray-50 z-10">
                      <tr>
                          <th className="px-6 py-3 w-12 text-center">
                              <CheckCircle2 className="w-4 h-4 mx-auto text-gray-400" />
                          </th>
                          <th className="px-6 py-3 w-[40%] cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => toggleSort('title')}>
                              <div className="flex items-center gap-2">Tarea {sortKey === 'title' && <ArrowUpDown className="w-3 h-3" />}</div>
                          </th>
                          <th className="px-6 py-3 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => toggleSort('status')}>
                               <div className="flex items-center gap-2">Estado {sortKey === 'status' && <ArrowUpDown className="w-3 h-3" />}</div>
                          </th>
                          <th className="px-6 py-3 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => toggleSort('priority')}>
                               <div className="flex items-center gap-2">Prioridad {sortKey === 'priority' && <ArrowUpDown className="w-3 h-3" />}</div>
                          </th>
                          <th className="px-6 py-3">Responsable</th>
                          <th className="px-6 py-3 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => toggleSort('dueDate')}>
                               <div className="flex items-center gap-2">Fecha Entrega {sortKey === 'dueDate' && <ArrowUpDown className="w-3 h-3" />}</div>
                          </th>
                          <th className="px-6 py-3 text-center"></th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                      {processedTasks.length === 0 ? (
                          <tr><td colSpan={7} className="text-center py-8 text-gray-400">No hay tareas para mostrar.</td></tr>
                      ) : (
                          processedTasks.map(t => {
                              const isOverdue = t.dueDate && new Date(t.dueDate) < new Date() && t.status !== TaskStatus.DONE;
                              const isDone = t.status === TaskStatus.DONE;
                              
                              return (
                                  <tr key={t.id} onClick={() => openEditModal(t)} className={`cursor-pointer group transition-all duration-200 ${isDone ? 'bg-gray-50/50 hover:bg-gray-50' : 'hover:bg-blue-50/30'}`}>
                                      <td className="px-6 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                                          <div 
                                            onClick={(e) => handleToggleStatus(e, t)}
                                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center cursor-pointer transition-all ${
                                                isDone 
                                                ? 'bg-green-500 border-green-500' 
                                                : 'border-gray-300 hover:border-black'
                                            }`}
                                          >
                                              {isDone && <Check className="w-3 h-3 text-white" />}
                                          </div>
                                      </td>
                                      <td className="px-6 py-3">
                                          <div className={`font-semibold text-gray-900 transition-all ${isDone ? 'line-through text-gray-400' : ''}`}>
                                              {t.title}
                                          </div>
                                          {t.description && <div className={`text-xs truncate max-w-xs ${isDone ? 'text-gray-300' : 'text-gray-400'}`}>{t.description}</div>}
                                      </td>
                                      <td className="px-6 py-3">
                                          <Badge variant={t.status === TaskStatus.DONE ? 'green' : t.status === TaskStatus.IN_PROGRESS ? 'blue' : 'outline'}>
                                              {t.status === TaskStatus.TODO ? 'PENDIENTE' : t.status === TaskStatus.IN_PROGRESS ? 'EN PROCESO' : 'LISTO'}
                                          </Badge>
                                      </td>
                                      <td className="px-6 py-3">
                                          <span className={`text-[10px] px-2 py-0.5 rounded border font-medium ${getPriorityColor(t.priority)}`}>
                                              {t.priority || 'NORMAL'}
                                          </span>
                                      </td>
                                      <td className="px-6 py-3">
                                          {t.assignee ? (
                                              <div className="flex items-center gap-2">
                                                  <div className="w-5 h-5 rounded-full bg-black text-white text-[9px] flex items-center justify-center font-bold">
                                                      {t.assignee.name.charAt(0)}
                                                  </div>
                                                  <span className="text-xs text-gray-600">{t.assignee.name}</span>
                                              </div>
                                          ) : <span className="text-xs text-gray-300 italic">Sin asignar</span>}
                                      </td>
                                      <td className="px-6 py-3">
                                          <span className={`text-xs ${isOverdue ? 'text-red-500 font-bold' : isDone ? 'text-gray-400' : 'text-gray-500'}`}>
                                              {formatDateDisplay(t.dueDate!)}
                                          </span>
                                      </td>
                                      <td className="px-6 py-3 text-center">
                                          <button 
                                            onClick={(e) => { e.stopPropagation(); deleteTask(t.id); }}
                                            className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                          >
                                              <Trash2 className="w-4 h-4"/>
                                          </button>
                                      </td>
                                  </tr>
                              )
                          })
                      )}
                  </tbody>
              </table>
          </div>
      </div>
  );

  const BoardView = () => (
      <div className="flex gap-4 md:gap-6 overflow-x-auto pb-4 h-full snap-x">
        <Column title="Por Hacer" status={TaskStatus.TODO} icon={Circle} color="text-gray-400" />
        <Column title="En Progreso" status={TaskStatus.IN_PROGRESS} icon={Clock} color="text-blue-500" />
        <Column title="Completado" status={TaskStatus.DONE} icon={CheckCircle2} color="text-green-500" />
      </div>
  );

  const Column = ({ title, status, icon: Icon, color }: any) => {
    // Also use filtered/sorted tasks for the board for consistency
    const columnTasks = processedTasks.filter(t => t.status === status);
    return (
      <div 
        className="flex-1 min-w-[320px] flex flex-col h-full rounded-2xl bg-gray-50/50 border border-gray-200/50"
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, status)}
      >
        <div className="p-4 flex items-center gap-2 border-b border-gray-100/50">
          <div className={`p-2 rounded-lg bg-white shadow-sm border border-gray-100 ${color}`}><Icon className="w-4 h-4" /></div>
          <h3 className="font-bold text-gray-700 text-sm uppercase tracking-wide">{title}</h3>
          <span className="ml-auto text-xs font-semibold text-gray-500 bg-white px-2 py-1 rounded-md border border-gray-200">{columnTasks.length}</span>
        </div>
        <div className="p-3 space-y-3 overflow-y-auto flex-1 custom-scrollbar">
          {columnTasks.map(task => {
             const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== TaskStatus.DONE;
             
             return (
               <div key={task.id} draggable onDragStart={(e) => handleDragStart(e, task.id)} onClick={() => openEditModal(task)}
                  className="group bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md cursor-grab active:cursor-grabbing flex flex-col gap-3">
                   
                   {/* HEADER */}
                   <div className="flex justify-between items-start">
                       <p className={`font-semibold text-sm leading-snug ${task.status === TaskStatus.DONE ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                           {task.title}
                       </p>
                   </div>
                   
                   {/* DESCRIPTION */}
                   {task.description && (
                       <p className={`text-xs line-clamp-2 leading-relaxed ${task.status === TaskStatus.DONE ? 'text-gray-300' : 'text-gray-500'}`}>
                           {task.description}
                       </p>
                   )}

                   {/* DIVIDER */}
                   <div className="h-px bg-gray-50 w-full" />

                   {/* FOOTER */}
                   <div className="flex items-center justify-between">
                       {/* Date */}
                       <div className={`flex items-center gap-1.5 text-xs ${isOverdue ? 'text-red-600 font-bold' : 'text-gray-400'}`}>
                          <CalendarIcon className="w-3.5 h-3.5" />
                          <span>{formatDateShort(task.dueDate!) || 'S/F'}</span>
                       </div>

                       {/* Meta */}
                       <div className="flex items-center gap-2">
                           <div className="flex -space-x-1">
                               {task.assignee ? (
                                   <div className="w-6 h-6 rounded-full bg-black text-white text-[9px] flex items-center justify-center border border-white font-bold" title={task.assignee.name}>
                                       {task.assignee.name.charAt(0)}
                                   </div>
                               ) : (
                                   <div className="w-6 h-6 rounded-full bg-gray-100 text-gray-300 flex items-center justify-center border border-white">
                                       <User className="w-3 h-3"/>
                                   </div>
                               )}
                           </div>
                           <span className={`text-[9px] px-1.5 py-0.5 rounded border font-medium ${getPriorityColor(task.priority)}`}>
                               {task.priority || 'MED'}
                           </span>
                       </div>
                   </div>
               </div>
             )
          })}
        </div>
      </div>
    );
  };

  if (loading) return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 h-[calc(100vh-100px)] flex flex-col">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 px-2">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Tareas</h1>
            
            {/* View Toggle */}
            <div className="bg-gray-100 p-1 rounded-lg flex gap-1">
                <button 
                    onClick={() => setViewMode('LIST')} 
                    className={`p-1.5 rounded-md transition-all ${viewMode === 'LIST' ? 'bg-white shadow text-black' : 'text-gray-400 hover:text-gray-600'}`}
                >
                    <LayoutList className="w-4 h-4" />
                </button>
                <button 
                    onClick={() => setViewMode('BOARD')} 
                    className={`p-1.5 rounded-md transition-all ${viewMode === 'BOARD' ? 'bg-white shadow text-black' : 'text-gray-400 hover:text-gray-600'}`}
                >
                    <KanbanSquare className="w-4 h-4" />
                </button>
                <button 
                    onClick={() => setViewMode('CALENDAR')} 
                    className={`p-1.5 rounded-md transition-all ${viewMode === 'CALENDAR' ? 'bg-white shadow text-black' : 'text-gray-400 hover:text-gray-600'}`}
                >
                    <CalendarIcon className="w-4 h-4" />
                </button>
            </div>

            {/* Time Filters (Only active if not in calendar mode usually, but useful globally) */}
            {viewMode !== 'CALENDAR' && (
                <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 p-1">
                    <button onClick={() => setTimeFilter('ALL')} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${timeFilter === 'ALL' ? 'bg-black text-white' : 'text-gray-500 hover:bg-gray-50'}`}>Todos</button>
                    <button onClick={() => setTimeFilter('TODAY')} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${timeFilter === 'TODAY' ? 'bg-black text-white' : 'text-gray-500 hover:bg-gray-50'}`}>Hoy</button>
                    <button onClick={() => setTimeFilter('WEEK')} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${timeFilter === 'WEEK' ? 'bg-black text-white' : 'text-gray-500 hover:bg-gray-50'}`}>Semana</button>
                </div>
            )}
        </div>

        <div className="flex gap-2 w-full md:w-auto">
             
             {/* SORT DROPDOWN (Click Based Fix) */}
             {viewMode !== 'CALENDAR' && (
                <div className="relative">
                    <button 
                        onClick={(e) => { e.stopPropagation(); setIsSortDropdownOpen(!isSortDropdownOpen); }}
                        className="h-10 px-3 bg-white border border-gray-200 rounded-xl flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-black hover:border-gray-300 transition-colors"
                    >
                        <ListFilter className="w-4 h-4" />
                        <span className="hidden sm:inline">
                            {sortKey === 'dueDate' ? 'Fecha' : sortKey === 'priority' ? 'Prioridad' : 'Estado'}
                        </span>
                    </button>
                    
                    {isSortDropdownOpen && (
                        <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-gray-200 shadow-xl rounded-xl overflow-hidden z-30 animate-in fade-in zoom-in-95 duration-200">
                            <div className="p-1 flex flex-col">
                                <span className="px-3 py-2 text-[10px] uppercase font-bold text-gray-400 tracking-wider">Ordenar por</span>
                                <button onClick={() => { setSortKey('dueDate'); setIsSortDropdownOpen(false); }} className={`text-left px-3 py-2 text-sm rounded-lg ${sortKey === 'dueDate' ? 'bg-gray-100 font-medium' : 'hover:bg-gray-50'}`}>Fecha de Entrega</button>
                                <button onClick={() => { setSortKey('priority'); setIsSortDropdownOpen(false); }} className={`text-left px-3 py-2 text-sm rounded-lg ${sortKey === 'priority' ? 'bg-gray-100 font-medium' : 'hover:bg-gray-50'}`}>Prioridad</button>
                                <button onClick={() => { setSortKey('status'); setIsSortDropdownOpen(false); }} className={`text-left px-3 py-2 text-sm rounded-lg ${sortKey === 'status' ? 'bg-gray-100 font-medium' : 'hover:bg-gray-50'}`}>Estado</button>
                            </div>
                        </div>
                    )}
                </div>
             )}

             <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <Input placeholder="Buscar tarea..." className="pl-9 h-10 bg-white" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
             </div>
            <Button onClick={openCreateModal} className="shadow-lg shadow-black/10">
                <Plus className="w-4 h-4 mr-2" /> Nueva
            </Button>
        </div>
      </div>

      {/* VIEW SWITCHER */}
      {viewMode === 'LIST' && <ListView />}
      {viewMode === 'BOARD' && <BoardView />}
      {viewMode === 'CALENDAR' && <CalendarView />}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={formData.id ? "Editar Tarea" : "Nueva Tarea"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><Label>Título</Label><Input value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} autoFocus /></div>
          <div><Label>Descripción</Label><Textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div>
                <Label>Responsable</Label>
                <select className="flex h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm outline-none focus:border-black"
                    value={formData.assigneeId} onChange={e => setFormData({...formData, assigneeId: e.target.value})}>
                    <option value="">Sin Asignar</option>
                    {contractors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
            </div>
            <div>
                <Label>Prioridad</Label>
                <select className="flex h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm outline-none focus:border-black"
                    value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value as any})}>
                    <option value="LOW">Baja</option>
                    <option value="MEDIUM">Media</option>
                    <option value="HIGH">Alta</option>
                </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
             <div><Label>Fecha Entrega</Label><Input type="datetime-local" value={formData.dueDate} onChange={e => setFormData({...formData, dueDate: e.target.value})} /></div>
             <div>
                <Label>Estado</Label>
                <select className="flex h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm outline-none focus:border-black"
                    value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})}>
                    <option value={TaskStatus.TODO}>Pendiente</option>
                    <option value={TaskStatus.IN_PROGRESS}>En Progreso</option>
                    <option value={TaskStatus.DONE}>Completada</option>
                </select>
             </div>
          </div>
          <div className="pt-4 flex gap-2">
            {formData.id && <Button type="button" variant="destructive" onClick={() => deleteTask(formData.id!)}><Trash2 className="w-4 h-4"/></Button>}
            <Button type="submit" className="flex-1">Guardar Tarea</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
