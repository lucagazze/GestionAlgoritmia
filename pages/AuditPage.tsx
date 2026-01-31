
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/db';
import { ai } from '../services/ai';
import { Project, Task, ProjectStatus, TaskStatus } from '../types';
import { Card, Button, Badge } from '../components/UIComponents';
import { ContextMenu } from '../components/ContextMenu';
import { 
  Activity, 
  TrendingUp, 
  AlertOctagon, 
  CheckCircle2, 
  Clock, 
  MessageCircle, 
  ArrowRight,
  ShieldAlert,
  BarChart3,
  RefreshCw,
  Ghost,
  DollarSign,
  Briefcase,
  CheckSquare,
  Calendar,
  Trash2,
  Zap
} from 'lucide-react';

export default function AuditPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  
  // Analysis Data
  const [riskClients, setRiskClients] = useState<any[]>([]);
  const [overdueTasks, setOverdueTasks] = useState<Task[]>([]);
  const [weeklyStats, setWeeklyStats] = useState<any[]>([]);
  const [healthScore, setHealthScore] = useState(100);
  
  // AI Strategy State
  const [aiInsight, setAiInsight] = useState<{ text: string, actions: { label: string, route: string }[] } | null>(null);
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);

  // Interaction State
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; task: Task | null }>({ x: 0, y: 0, task: null });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [p, t] = await Promise.all([db.projects.getAll(), db.tasks.getAll()]);
    setProjects(p);
    setTasks(t);
    analyzeData(p, t);
    setLoading(false);
  };

  const analyzeData = (projList: Project[], taskList: Task[]) => {
      const today = new Date();
      
      // 1. RISK CLIENTS (GHOSTING)
      // Logic: Active or Onboarding clients with > 7 days since last contact (or creation if no contact)
      const risks = projList.filter(p => {
          const isActive = p.status === ProjectStatus.ACTIVE || p.status === ProjectStatus.ONBOARDING;
          if (!isActive) return false;

          const lastDateStr = p.lastContactDate || p.createdAt;
          const lastDate = new Date(lastDateStr);
          const diffTime = Math.abs(today.getTime() - lastDate.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          // Debug check
          // console.log(`Client: ${p.name}, Days: ${diffDays}`);
          
          return diffDays > 7;
      }).map(p => {
          const lastDateStr = p.lastContactDate || p.createdAt;
          return {
            ...p, 
            daysSinceContact: Math.ceil(Math.abs(today.getTime() - new Date(lastDateStr).getTime()) / (1000 * 60 * 60 * 24)),
            riskLevel: 'HIGH'
          };
      });
      setRiskClients(risks);

      // 2. OVERDUE TASKS
      const overdue = taskList.filter(t => t.status !== TaskStatus.DONE && t.dueDate && new Date(t.dueDate) < today);
      setOverdueTasks(overdue);

      // 3. WEEKLY STATS (Last 7 days)
      const stats = [];
      for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const dateStr = d.toISOString().split('T')[0];
          
          const completed = taskList.filter(t => t.status === TaskStatus.DONE && t.created_at?.startsWith(dateStr)).length;
          const created = taskList.filter(t => t.created_at?.startsWith(dateStr)).length;
          
          stats.push({ day: d.toLocaleDateString('es-ES', { weekday: 'short' }), completed, created });
      }
      setWeeklyStats(stats);

      // 4. HEALTH SCORE CALC
      let score = 100;
      score -= (risks.length * 15); // Heavily penalize ghosting
      score -= (overdue.length * 5); // Penalize overdue tasks
      setHealthScore(Math.max(0, score));
  };

  const runAiAnalysis = async () => {
      setIsAiAnalyzing(true);
      try {
          const prompt = `
          Eres un Consultor de Operaciones Senior. Analiza estos datos:
          - Score Salud: ${healthScore}/100
          - Clientes Riesgo (Ghosting): ${riskClients.length} (${riskClients.map(c=>c.name).join(', ')})
          - Tareas Vencidas: ${overdueTasks.length}
          
          Genera una respuesta en JSON VÁLIDO con este formato:
          {
            "text": "Un párrafo MUY breve (max 2 lineas) y directo al grano con la estrategia de hoy.",
            "actions": [
                { "label": "Nombre Botón 1", "route": "/projects" }, 
                { "label": "Nombre Botón 2", "route": "/tasks" }
            ]
          }
          Dame acciones lógicas (ej: si hay ghosting, botón ir a clientes. Si hay tareas, ir a tareas). Max 2 botones.
          `;
          
          const res = await ai.chat([{role: 'user', content: prompt}]);
          
          try {
              // Extract JSON if AI wraps it in markdown blocks
              const jsonStr = res.replace(/```json/g, '').replace(/```/g, '').trim();
              const parsed = JSON.parse(jsonStr);
              setAiInsight(parsed);
          } catch (e) {
              // Fallback if AI fails to return JSON
              setAiInsight({
                  text: res,
                  actions: [{ label: "Ir al Dashboard", route: "/" }]
              });
          }

      } catch(e) { console.error(e); } finally { setIsAiAnalyzing(false); }
  };

  const getWhatsAppLink = (p: Project) => {
      if (!p.phone) return null;
      const cleanPhone = p.phone.replace(/\D/g, '');
      const msg = `Hola ${p.name.split(' ')[0]}, ¿cómo va todo? Quería hacer un check-in rápido para ver cómo vienen con los avances.`;
      return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
  };

  // --- Task Context Menu Actions ---
  const handleContextMenu = (e: React.MouseEvent, task: Task) => {
      e.preventDefault();
      setContextMenu({ x: e.pageX, y: e.pageY, task });
  };

  const handleCompleteTask = async () => {
      if (!contextMenu.task) return;
      await db.tasks.updateStatus(contextMenu.task.id, TaskStatus.DONE);
      setOverdueTasks(prev => prev.filter(t => t.id !== contextMenu.task!.id));
      setContextMenu({ ...contextMenu, task: null });
  };

  const handleRescheduleTask = async () => {
      if (!contextMenu.task) return;
      const today = new Date().toISOString();
      await db.tasks.delete(contextMenu.task.id);
      await db.tasks.create({ ...contextMenu.task, dueDate: today, id: undefined });
      setOverdueTasks(prev => prev.filter(t => t.id !== contextMenu.task!.id));
      setContextMenu({ ...contextMenu, task: null });
  };

  const handleDeleteTask = async () => {
      if (!contextMenu.task) return;
      if (confirm("¿Borrar tarea definitivamente?")) {
          await db.tasks.delete(contextMenu.task.id);
          setOverdueTasks(prev => prev.filter(t => t.id !== contextMenu.task!.id));
      }
      setContextMenu({ ...contextMenu, task: null });
  };

  if (loading) return <div className="flex h-screen items-center justify-center text-gray-400 bg-[#FAFAFA] dark:bg-[#020617]"><div className="animate-pulse">Cargando Auditoría...</div></div>;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-24 max-w-7xl mx-auto">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center pt-8 pb-4 gap-4">
          <div>
              <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-3">
                  <Activity className="w-8 h-8 text-indigo-600" /> Auditoría Operativa
              </h1>
              <p className="text-gray-500 dark:text-gray-400 mt-2">Diagnóstico profundo de clientes, tareas y finanzas.</p>
          </div>
          <div className="flex gap-3">
              <Button onClick={() => {loadData(); runAiAnalysis();}} className="bg-black text-white shadow-lg border-none">
                  <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Actualizar Datos
              </Button>
          </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="p-6 flex flex-col justify-between border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-900/10">
              <div className="flex justify-between items-start">
                  <div>
                      <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Score de Salud</p>
                      <h2 className={`text-4xl font-bold mt-2 ${healthScore > 80 ? 'text-green-600' : healthScore > 50 ? 'text-yellow-600' : 'text-red-600'}`}>{healthScore}/100</h2>
                  </div>
                  <div className={`p-3 rounded-full ${healthScore > 80 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                      <Activity className="w-6 h-6" />
                  </div>
              </div>
              <div className="mt-4 h-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className={`h-full transition-all duration-1000 ${healthScore > 80 ? 'bg-green-500' : 'bg-red-500'}`} style={{width: `${healthScore}%`}}></div>
              </div>
          </Card>

          <Card className="p-6 border-red-100 dark:border-red-900/50 bg-red-50/50 dark:bg-red-900/10">
              <div className="flex justify-between items-start">
                  <div>
                      <p className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-widest">Riesgo Ghosting</p>
                      <h2 className="text-4xl font-bold mt-2 text-gray-900 dark:text-white">{riskClients.length}</h2>
                  </div>
                  <AlertOctagon className="w-8 h-8 text-red-500 opacity-50" />
              </div>
              <p className="text-xs text-red-600 dark:text-red-400 mt-2 font-medium">Clientes sin contacto (+7 días)</p>
          </Card>

          <Card className="p-6 md:col-span-2 bg-white dark:bg-slate-900">
             <div className="flex justify-between items-center mb-4">
                 <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Productividad Semanal</p>
                 <BarChart3 className="w-4 h-4 text-gray-400"/>
             </div>
             <div className="flex items-end gap-2 h-24 w-full">
                 {weeklyStats.map((stat, idx) => (
                     <div key={idx} className="flex-1 flex flex-col justify-end items-center gap-1 group">
                         <div className="w-full bg-indigo-100 dark:bg-indigo-900/30 rounded-t-sm relative group-hover:bg-indigo-200 transition-colors" style={{height: `${Math.min(100, stat.created * 10)}%`}}>
                            <div className="absolute bottom-0 left-0 w-full bg-indigo-600 rounded-t-sm transition-all duration-500" style={{height: `${Math.min(100, (stat.completed / (stat.created || 1)) * 100)}%`}}></div>
                         </div>
                         <span className="text-[10px] text-gray-400 uppercase">{stat.day}</span>
                     </div>
                 ))}
             </div>
             <div className="flex items-center justify-center gap-4 mt-2">
                 <div className="flex items-center gap-1 text-[10px] text-gray-500"><div className="w-2 h-2 bg-indigo-100 rounded-full"></div> Creadas</div>
                 <div className="flex items-center gap-1 text-[10px] text-gray-500"><div className="w-2 h-2 bg-indigo-600 rounded-full"></div> Completadas</div>
             </div>
          </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* LEFT COLUMN: RISK LIST */}
          <div className="lg:col-span-2 space-y-6">
              <div className="flex items-center gap-2 mb-2">
                  <ShieldAlert className="w-5 h-5 text-red-500" />
                  <h3 className="font-bold text-gray-900 dark:text-white">Clientes en Riesgo (Acción Requerida)</h3>
              </div>

              {riskClients.length === 0 ? (
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-900 p-8 rounded-2xl text-center">
                      <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
                      <h3 className="font-bold text-green-800 dark:text-green-300">¡Todo bajo control!</h3>
                      <p className="text-sm text-green-600 dark:text-green-400">Has mantenido contacto reciente con todos tus clientes activos.</p>
                  </div>
              ) : (
                  <div className="space-y-4">
                      {riskClients.map(client => (
                          <div key={client.id} className="bg-white dark:bg-slate-900 border border-red-100 dark:border-red-900/30 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4 group">
                              <div>
                                  <div className="flex items-center gap-2">
                                      <h4 className="font-bold text-lg text-gray-900 dark:text-white">{client.name}</h4>
                                      <Badge variant="outline" className="text-red-600 bg-red-50 border-red-100"><Ghost className="w-3 h-3 mr-1"/> Ghosting</Badge>
                                  </div>
                                  <p className="text-sm text-gray-500 mt-1">
                                      Último contacto: <span className="font-bold text-red-600">{client.daysSinceContact} días</span> atrás.
                                  </p>
                                  <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                                      <DollarSign className="w-3 h-3" /> MRR en riesgo: <span className="font-mono font-bold text-gray-600 dark:text-gray-300">${client.monthlyRevenue?.toLocaleString()}</span>
                                  </div>
                              </div>

                              <div className="flex gap-2 w-full md:w-auto">
                                  <Button 
                                    size="sm" 
                                    onClick={() => {if(client.phone) window.open(getWhatsAppLink(client)!, '_blank')}}
                                    className="flex-1 bg-green-500 hover:bg-green-600 text-white border-none"
                                  >
                                      <MessageCircle className="w-4 h-4 mr-2" /> Reactivar
                                  </Button>
                                  <Button size="sm" variant="secondary" onClick={() => navigate(`/projects/${client.id}`)}>
                                      Ver Perfil
                                  </Button>
                              </div>
                          </div>
                      ))}
                  </div>
              )}

              {/* OVERDUE TASKS SUMMARY */}
              <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-gray-900 dark:text-white">Tareas Vencidas Críticas</h3>
                      <span className="text-[10px] text-gray-400 font-medium">Click Derecho para opciones</span>
                  </div>
                  
                  {overdueTasks.length === 0 ? (
                      <p className="text-sm text-gray-400 italic">No hay tareas vencidas.</p>
                  ) : (
                      <div className="space-y-2">
                          {overdueTasks.slice(0, 5).map(t => (
                              <div 
                                key={t.id} 
                                onContextMenu={(e) => handleContextMenu(e, t)}
                                className="flex justify-between items-center p-3 bg-gray-50 dark:bg-slate-800/50 rounded-lg border border-gray-100 dark:border-slate-800 cursor-context-menu hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                              >
                                  <div className="flex items-center gap-3">
                                      <Clock className="w-4 h-4 text-red-500" />
                                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate max-w-[200px]">{t.title}</span>
                                  </div>
                                  <span className="text-xs text-red-500 font-bold whitespace-nowrap">{new Date(t.dueDate!).toLocaleDateString()}</span>
                              </div>
                          ))}
                          {overdueTasks.length > 5 && (
                              <Button variant="ghost" onClick={() => navigate('/tasks')} className="w-full text-xs mt-2">Ver {overdueTasks.length - 5} más...</Button>
                          )}
                      </div>
                  )}
              </div>
          </div>

          {/* RIGHT COLUMN: AI INSIGHTS (ACTIONABLE) */}
          <div className="space-y-6">
              <div className="bg-gradient-to-br from-indigo-900 to-black text-white p-6 rounded-2xl shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-8 opacity-10">
                      <Activity className="w-40 h-40" />
                  </div>
                  <h3 className="font-bold text-lg mb-4 flex items-center gap-2 relative z-10"><TrendingUp className="w-5 h-5 text-indigo-400" /> Estrategia del Día</h3>
                  
                  {!aiInsight && !isAiAnalyzing && (
                      <div className="text-center py-8">
                          <p className="text-sm text-gray-400 mb-4">Genera un plan de acción basado en los datos actuales.</p>
                          <Button onClick={runAiAnalysis} className="bg-white text-black hover:bg-gray-200 border-none w-full shadow-lg">Generar Plan</Button>
                      </div>
                  )}

                  {isAiAnalyzing && (
                      <div className="py-8 text-center text-indigo-300 animate-pulse flex flex-col items-center">
                          <RefreshCw className="w-6 h-6 animate-spin mb-2" />
                          Analizando prioridades...
                      </div>
                  )}

                  {aiInsight && (
                      <div className="relative z-10">
                          <p className="text-sm leading-relaxed text-indigo-100 mb-6 font-medium">
                              {aiInsight.text}
                          </p>
                          
                          <div className="flex flex-col gap-2">
                              {aiInsight.actions?.map((action, idx) => (
                                  <button 
                                    key={idx}
                                    onClick={() => navigate(action.route)}
                                    className="w-full bg-white/10 hover:bg-white/20 border border-white/20 backdrop-blur-sm text-white text-xs font-bold py-3 px-4 rounded-xl flex items-center justify-between transition-all group"
                                  >
                                      {action.label}
                                      <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                                  </button>
                              ))}
                          </div>
                          
                          <button onClick={runAiAnalysis} className="mt-4 text-[10px] text-indigo-400 hover:text-white underline w-full text-center">
                              Regenerar Estrategia
                          </button>
                      </div>
                  )}
              </div>
          </div>

      </div>

      <ContextMenu 
        x={contextMenu.x} y={contextMenu.y} isOpen={!!contextMenu.task} onClose={() => setContextMenu({ ...contextMenu, task: null })}
        items={[
            { label: 'Marcar Completada', icon: CheckCircle2, onClick: handleCompleteTask },
            { label: 'Reprogramar para Hoy', icon: Calendar, onClick: handleRescheduleTask },
            { label: 'Eliminar Tarea', icon: Trash2, variant: 'destructive', onClick: handleDeleteTask }
        ]}
      />
    </div>
  );
}
