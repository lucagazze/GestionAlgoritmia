
import React, { useEffect, useState } from 'react';
import { db } from '../services/db';
import { ai } from '../services/ai';
import { sounds } from '../services/sounds';
import { Project, Task, TaskStatus, ProjectStatus } from '../types';
import { Card, Button, Badge, Modal } from '../components/UIComponents';
import { 
  TrendingUp, 
  Calendar, 
  CheckCircle2, 
  Zap, 
  ArrowRight,
  Clock,
  MessageCircle,
  Activity,
  AlertOctagon
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export default function DashboardPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Local Calculated Risks (For Instant UI)
  const [riskClients, setRiskClients] = useState<any[]>([]);
  const [overdueTasksList, setOverdueTasksList] = useState<Task[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [p, t] = await Promise.all([db.projects.getAll(), db.tasks.getAll()]);
      setProjects(p);
      setTasks(t);
      calculateRisks(p, t);
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateRisks = (projList: Project[], taskList: Task[]) => {
      const today = new Date();
      
      // 1. Ghosting Risks (> 7 days)
      const risks = projList.filter(p => {
          if (p.status !== ProjectStatus.ACTIVE && p.status !== ProjectStatus.ONBOARDING) return false;
          const lastContact = p.lastContactDate ? new Date(p.lastContactDate) : new Date(p.createdAt);
          const diffDays = Math.ceil(Math.abs(today.getTime() - lastContact.getTime()) / (1000 * 60 * 60 * 24));
          return diffDays > 7;
      }).map(p => ({...p, daysSinceContact: Math.ceil(Math.abs(today.getTime() - (p.lastContactDate ? new Date(p.lastContactDate).getTime() : new Date(p.createdAt).getTime())) / (1000 * 60 * 60 * 24))}));
      setRiskClients(risks);

      // 2. Overdue Tasks
      const overdue = taskList.filter(t => t.status !== TaskStatus.DONE && t.dueDate && new Date(t.dueDate) < today);
      setOverdueTasksList(overdue);
  };

  const handleScan = () => {
      navigate('/audit');
  };

  // --- Metrics & Logic ---
  const activeProjects = projects.filter(p => p.status === ProjectStatus.ACTIVE);
  const mrr = activeProjects.reduce((sum, p) => sum + (p.monthlyRevenue || 0), 0);
  
  const todayDate = new Date();
  const currentDay = todayDate.getDate();

  const todaysTasks = tasks.filter(t => {
      if (t.status === TaskStatus.DONE) return false;
      if (!t.dueDate) return t.priority === 'HIGH'; 
      const d = new Date(t.dueDate);
      return d.getDate() === todayDate.getDate() && d.getMonth() === todayDate.getMonth();
  });

  const billingAlerts = activeProjects.map(p => {
    const billDay = p.billingDay || 1;
    let status: 'upcoming' | 'today' | 'overdue' | 'ok' = 'ok';
    let daysDiff = billDay - currentDay;

    if (daysDiff === 0) status = 'today';
    else if (daysDiff < 0 && daysDiff > -5) status = 'overdue'; 
    else if (daysDiff > 0 && daysDiff <= 3) status = 'upcoming';

    return { ...p, billingStatus: status, daysDiff };
  }).filter(p => p.billingStatus !== 'ok').sort((a, b) => a.daysDiff - b.daysDiff);
  
  const getWhatsAppLink = (p: Project, customMsg?: string) => {
      if (!p.phone) return null;
      const cleanPhone = p.phone.replace(/\D/g, '');
      
      let message = customMsg;
      if (!message) {
          const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
          const currentMonth = monthNames[new Date().getMonth()];
          message = `Hola ${p.name.split(' ')[0]}! 👋 Te paso el total del mes de *${currentMonth}* por valor de *$${p.monthlyRevenue.toLocaleString()}*.\n\nAvísame cuando realices el pago así lo registro. Gracias!`;
      }
      return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  };

  if (loading) return <div className="flex h-screen items-center justify-center text-gray-400 bg-[#FAFAFA] dark:bg-[#020617]"><div className="animate-pulse">Cargando Sistema...</div></div>;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-24">
      
      {/* 1. Header with Scanner Button */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center pt-8 pb-4 gap-4">
          <div>
              <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Bienvenido, Luca.</h1>
              <p className="text-gray-500 dark:text-gray-400 mt-2">Resumen operativo de hoy.</p>
          </div>
          <div className="flex gap-3">
              {(riskClients.length > 0 || overdueTasksList.length > 0) && (
                  <div 
                    onClick={handleScan}
                    className="hidden md:flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900 rounded-xl text-xs font-bold text-red-700 dark:text-red-300 shadow-sm animate-pulse cursor-pointer hover:bg-red-100"
                  >
                      <AlertOctagon className="w-4 h-4" />
                      Atención Requerida
                  </div>
              )}
              <Button onClick={handleScan} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/30 border-none animate-pulse-slow">
                  <Activity className="w-4 h-4 mr-2" /> Scanner Operativo
              </Button>
          </div>
      </div>

      {/* 2. Action Center (Alerts) */}
      {(billingAlerts.length > 0 || overdueTasksList.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {billingAlerts.map(p => (
                  <div key={p.id} className={`p-4 rounded-2xl flex items-center justify-between border ${p.billingStatus === 'overdue' ? 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800 text-red-900 dark:text-red-300' : p.billingStatus === 'today' ? 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800 text-green-900 dark:text-green-300' : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-100 dark:border-yellow-800 text-yellow-800 dark:text-yellow-300'}`}>
                      <div className="flex items-center gap-3">
                          <div className="p-2 bg-white dark:bg-white/10 rounded-full shadow-sm">
                              <Calendar className="w-5 h-5" />
                          </div>
                          <div>
                              <p className="font-bold text-sm">{p.name}</p>
                              <p className="text-xs opacity-80">{p.billingStatus === 'today' ? 'Cobrar hoy' : p.billingStatus === 'overdue' ? 'Pago vencido' : 'Vence pronto'}</p>
                          </div>
                      </div>
                      <div className="flex items-center gap-2">
                          <span className="font-mono font-bold">${p.monthlyRevenue.toLocaleString()}</span>
                          {p.phone && (
                              <a href={getWhatsAppLink(p)!} target="_blank" rel="noreferrer" onClick={sounds.pop} className="p-2 bg-white dark:bg-white/10 rounded-full shadow-sm hover:scale-110 transition-transform text-green-600 dark:text-green-400">
                                  <MessageCircle className="w-4 h-4" />
                              </a>
                          )}
                      </div>
                  </div>
              ))}
              {overdueTasksList.slice(0, 2).map(t => (
                  <div key={t.id} className="p-4 rounded-2xl flex items-center justify-between border bg-orange-50 dark:bg-orange-900/20 border-orange-100 dark:border-orange-800 text-orange-900 dark:text-orange-300">
                      <div className="flex items-center gap-3">
                          <div className="p-2 bg-white dark:bg-white/10 rounded-full shadow-sm">
                              <Clock className="w-5 h-5" />
                          </div>
                          <div>
                              <p className="font-bold text-sm truncate max-w-[200px]">{t.title}</p>
                              <p className="text-xs opacity-80">Tarea atrasada</p>
                          </div>
                      </div>
                      <button onClick={handleScan} className="text-xs underline font-bold">Ver Todo</button>
                  </div>
              ))}
          </div>
      )}

      {/* 3. Main Widgets Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Focus of the Day */}
          <Card className="lg:col-span-2 flex flex-col min-h-[400px]">
              <div className="p-6 border-b border-gray-100/50 dark:border-gray-800 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                      <div className="p-2 bg-black dark:bg-white text-white dark:text-black rounded-lg"><Zap className="w-4 h-4" /></div>
                      <div>
                          <h3 className="font-bold text-gray-900 dark:text-white">Foco de Hoy</h3>
                          <p className="text-xs text-gray-400">Tareas prioritarias y entregas</p>
                      </div>
                  </div>
                  <Link to="/tasks" className="text-xs font-semibold text-gray-400 hover:text-black dark:hover:text-white transition-colors">Ver Todo</Link>
              </div>
              <div className="p-4 flex-1 overflow-y-auto space-y-3 bg-gray-50/30 dark:bg-slate-900/30">
                  {todaysTasks.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4 py-10">
                          <div className="w-16 h-16 rounded-full bg-green-50 dark:bg-green-900/20 text-green-500 flex items-center justify-center">
                              <CheckCircle2 className="w-8 h-8" />
                          </div>
                          <p>Estás al día con tus prioridades.</p>
                      </div>
                  ) : (
                      todaysTasks.map(t => (
                          <div key={t.id} className="group bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all flex items-start gap-4">
                              <button className="mt-1 w-5 h-5 rounded-full border-2 border-gray-300 dark:border-gray-500 hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/30 transition-colors"></button>
                              <div className="flex-1">
                                  <div className="flex justify-between">
                                      <p className="font-semibold text-gray-800 dark:text-white text-sm">{t.title}</p>
                                      {t.priority === 'HIGH' && <Badge variant="outline" className="text-[10px] text-red-600 bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900">Alta</Badge>}
                                  </div>
                                  <p className="text-xs text-gray-400 mt-1 line-clamp-1">{t.description || "Sin descripción"}</p>
                              </div>
                          </div>
                      ))
                  )}
              </div>
          </Card>

          {/* Right: Financial & Stats */}
          <div className="space-y-6">
              <Card className="bg-gray-900 dark:bg-white text-white dark:text-black p-6 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-6 opacity-20">
                      <TrendingUp className="w-24 h-24" />
                  </div>
                  <p className="text-gray-400 dark:text-gray-500 text-xs font-bold uppercase tracking-widest mb-1">MRR Actual</p>
                  <h2 className="text-4xl font-bold tracking-tight">${mrr.toLocaleString()}</h2>
                  <div className="mt-4 pt-4 border-t border-white/10 dark:border-black/10 flex items-center gap-2 text-sm text-gray-300 dark:text-gray-600">
                      <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                      {activeProjects.length} Clientes Activos
                  </div>
              </Card>

              <Card className="flex-1 flex flex-col">
                  <div className="p-5 border-b border-gray-100/50 dark:border-gray-800">
                      <h3 className="font-bold text-gray-900 dark:text-white text-sm">Próximos Cobros</h3>
                  </div>
                  <div className="p-2 space-y-1">
                      {activeProjects.sort((a,b) => (a.billingDay||1) - (b.billingDay||1)).slice(0, 3).map(p => (
                          <div key={p.id} className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-default">
                              <div className="flex items-center gap-3">
                                  <div className="font-bold text-gray-500 w-6 text-center text-xs">
                                      {p.billingDay}
                                  </div>
                                  <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{p.name}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                  <span className="text-xs font-mono text-gray-500">${p.monthlyRevenue.toLocaleString()}</span>
                                  {p.phone && (
                                      <a href={getWhatsAppLink(p)!} target="_blank" rel="noreferrer" onClick={sounds.pop} className="text-green-500 hover:text-green-600">
                                          <MessageCircle className="w-3 h-3" />
                                      </a>
                                  )}
                              </div>
                          </div>
                      ))}
                  </div>
                  <div className="mt-auto p-4 border-t border-gray-100/50 dark:border-gray-800">
                      <Link to="/projects">
                        <Button variant="ghost" size="sm" className="w-full text-xs">Ver todos los clientes</Button>
                      </Link>
                  </div>
              </Card>
          </div>
      </div>
    </div>
  );
}
