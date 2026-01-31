
import React, { useEffect, useState } from 'react';
import { db } from '../services/db';
import { Project, Task, TaskStatus, ProjectStatus } from '../types';
import { Card, Button, Badge } from '../components/UIComponents';
import { AIActionCenter } from '../components/AIActionCenter';
import { 
  TrendingUp, 
  Calendar, 
  CheckCircle2, 
  Zap, 
  Facebook, 
  HardDrive,
  Globe,
  Palette,
  ArrowRight,
  Clock,
  Briefcase,
  Plus,
  MessageCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';

const QuickLink = ({ 
  href, 
  to, 
  internal, 
  icon: Icon, 
  label, 
  color, 
  bg 
}: { 
  href?: string, 
  to?: string, 
  internal?: boolean, 
  icon: any, 
  label: string, 
  color: string, 
  bg: string 
}) => {
  const content = (
    <div className="flex flex-col items-center gap-2 group cursor-pointer transition-transform hover:-translate-y-1">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm border border-black/5 transition-all group-hover:scale-110 group-hover:shadow-md ${bg} ${color}`}>
        <Icon className="w-6 h-6" />
      </div>
      <span className="text-xs font-medium text-gray-500 group-hover:text-black">{label}</span>
    </div>
  );

  if (internal && to) {
    return <Link to={to}>{content}</Link>;
  }
  
  return (
    <a href={href} target="_blank" rel="noreferrer" className="block">
      {content}
    </a>
  );
};

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [p, t] = await Promise.all([db.projects.getAll(), db.tasks.getAll()]);
        setProjects(p);
        setTasks(t);
      } catch (error) {
        console.error("Error loading dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // --- Metrics & Logic ---
  const activeProjects = projects.filter(p => p.status === ProjectStatus.ACTIVE);
  const mrr = activeProjects.reduce((sum, p) => sum + (p.monthlyRevenue || 0), 0);
  
  const todayDate = new Date();
  const currentDay = todayDate.getDate();

  // Urgent Items logic
  const overdueTasks = tasks.filter(t => t.status !== TaskStatus.DONE && t.dueDate && new Date(t.dueDate) < todayDate);
  const todaysTasks = tasks.filter(t => {
      if (t.status === TaskStatus.DONE) return false;
      if (!t.dueDate) return t.priority === 'HIGH'; // If no date, high priority counts as "focus"
      const d = new Date(t.dueDate);
      return d.getDate() === todayDate.getDate() && d.getMonth() === todayDate.getMonth();
  });

  const billingAlerts = activeProjects.map(p => {
    const billDay = p.billingDay || 1;
    let status: 'upcoming' | 'today' | 'overdue' | 'ok' = 'ok';
    let daysDiff = billDay - currentDay;

    if (daysDiff === 0) status = 'today';
    else if (daysDiff < 0 && daysDiff > -5) status = 'overdue'; // Only show overdue for 5 days
    else if (daysDiff > 0 && daysDiff <= 3) status = 'upcoming';

    return { ...p, billingStatus: status, daysDiff };
  }).filter(p => p.billingStatus !== 'ok').sort((a, b) => a.daysDiff - b.daysDiff);
  
  // WhatsApp Logic Helper
  const getWhatsAppLink = (p: Project) => {
      if (!p.phone) return null;
      const cleanPhone = p.phone.replace(/\D/g, '');
      const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
      const currentMonth = monthNames[new Date().getMonth()];
      const message = `Hola ${p.name.split(' ')[0]}! 👋 Te paso el total del mes de *${currentMonth}* por valor de *$${p.monthlyRevenue.toLocaleString()}*.\n\nAvísame cuando realices el pago así lo registro. Gracias!`;
      return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  };

  if (loading) return <div className="flex h-screen items-center justify-center text-gray-400 bg-[#FAFAFA]"><div className="animate-pulse">Cargando Sistema...</div></div>;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-10">
      
      {/* 1. AI HEADER & GREETING */}
      <div className="flex flex-col items-center justify-center pt-8 pb-4">
          <p className="text-gray-400 font-medium mb-4 text-sm tracking-wide uppercase">Algoritmia Intelligence</p>
          <AIActionCenter />
      </div>

      {/* 2. Action Center (Alerts) */}
      {(billingAlerts.length > 0 || overdueTasks.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {billingAlerts.map(p => (
                  <div key={p.id} className={`p-4 rounded-2xl flex items-center justify-between border ${p.billingStatus === 'overdue' ? 'bg-red-50 border-red-100 text-red-900' : p.billingStatus === 'today' ? 'bg-green-50 border-green-100 text-green-900' : 'bg-yellow-50 border-yellow-100 text-yellow-800'}`}>
                      <div className="flex items-center gap-3">
                          <div className="p-2 bg-white rounded-full shadow-sm bg-opacity-60">
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
                              <a href={getWhatsAppLink(p)!} target="_blank" rel="noreferrer" className="p-2 bg-white rounded-full shadow-sm hover:scale-110 transition-transform text-green-600">
                                  <MessageCircle className="w-4 h-4" />
                              </a>
                          )}
                      </div>
                  </div>
              ))}
              {overdueTasks.map(t => (
                  <div key={t.id} className="p-4 rounded-2xl flex items-center justify-between border bg-orange-50 border-orange-100 text-orange-900">
                      <div className="flex items-center gap-3">
                          <div className="p-2 bg-white rounded-full shadow-sm bg-opacity-60">
                              <Clock className="w-5 h-5" />
                          </div>
                          <div>
                              <p className="font-bold text-sm truncate max-w-[200px]">{t.title}</p>
                              <p className="text-xs opacity-80">Tarea atrasada</p>
                          </div>
                      </div>
                      <Link to="/tasks"><ArrowRight className="w-4 h-4" /></Link>
                  </div>
              ))}
          </div>
      )}

      {/* 3. Quick Launch Dock (Apple Style) */}
      <div className="flex items-center justify-center">
          <div className="glass-panel px-6 py-4 rounded-3xl flex items-center gap-6 shadow-2xl shadow-black/5 border border-white/50 overflow-x-auto max-w-full">
              <QuickLink href="https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=1015285380135120&business_id=1149946139536218&breakdown_regrouping=true&nav_source=no_referrer" icon={Facebook} label="Ads" color="text-blue-600" bg="bg-blue-50" />
              <QuickLink href="https://drive.google.com/drive/u/0/my-drive" icon={HardDrive} label="Drive" color="text-green-600" bg="bg-green-50" />
              <QuickLink href="https://algoritmiadesarrollos.com.ar/" icon={Globe} label="Web" color="text-indigo-600" bg="bg-indigo-50" />
              <QuickLink href="https://www.canva.com/projects" icon={Palette} label="Canva" color="text-cyan-600" bg="bg-cyan-50" />
              <div className="w-px h-8 bg-gray-200 mx-2"></div>
              <QuickLink internal to="/tasks" icon={CheckCircle2} label="Tareas" color="text-gray-700" bg="bg-gray-100" />
              <QuickLink internal to="/projects" icon={Briefcase} label="Clientes" color="text-gray-700" bg="bg-gray-100" />
          </div>
      </div>

      {/* 4. Main Widgets Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left: Focus of the Day */}
          <Card className="lg:col-span-2 flex flex-col min-h-[400px]">
              <div className="p-6 border-b border-gray-100/50 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                      <div className="p-2 bg-black text-white rounded-lg"><Zap className="w-4 h-4" /></div>
                      <div>
                          <h3 className="font-bold text-gray-900">Foco de Hoy</h3>
                          <p className="text-xs text-gray-400">Tareas prioritarias y entregas</p>
                      </div>
                  </div>
                  <Link to="/tasks" className="text-xs font-semibold text-gray-400 hover:text-black transition-colors">Ver Todo</Link>
              </div>
              <div className="p-4 flex-1 overflow-y-auto space-y-3 bg-gray-50/30">
                  {todaysTasks.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4 py-10">
                          <div className="w-16 h-16 rounded-full bg-green-50 text-green-500 flex items-center justify-center">
                              <CheckCircle2 className="w-8 h-8" />
                          </div>
                          <p>Estás al día con tus prioridades.</p>
                      </div>
                  ) : (
                      todaysTasks.map(t => (
                          <div key={t.id} className="group bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex items-start gap-4">
                              <button className="mt-1 w-5 h-5 rounded-full border-2 border-gray-300 hover:border-green-500 hover:bg-green-50 transition-colors"></button>
                              <div className="flex-1">
                                  <div className="flex justify-between">
                                      <p className="font-semibold text-gray-800 text-sm">{t.title}</p>
                                      {t.priority === 'HIGH' && <Badge variant="outline" className="text-[10px] text-red-600 bg-red-50 border-red-100">Alta</Badge>}
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
              <Card className="bg-gray-900 text-white p-6 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-6 opacity-20">
                      <TrendingUp className="w-24 h-24" />
                  </div>
                  <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-1">MRR Actual</p>
                  <h2 className="text-4xl font-bold tracking-tight">${mrr.toLocaleString()}</h2>
                  <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-2 text-sm text-gray-300">
                      <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                      {activeProjects.length} Clientes Activos
                  </div>
              </Card>

              <Card className="flex-1 flex flex-col">
                  <div className="p-5 border-b border-gray-100/50">
                      <h3 className="font-bold text-gray-900 text-sm">Próximos Cobros</h3>
                  </div>
                  <div className="p-2 space-y-1">
                      {activeProjects.sort((a,b) => (a.billingDay||1) - (b.billingDay||1)).slice(0, 3).map(p => (
                          <div key={p.id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors cursor-default">
                              <div className="flex items-center gap-3">
                                  <div className="font-bold text-gray-500 w-6 text-center text-xs">
                                      {p.billingDay}
                                  </div>
                                  <span className="text-sm font-medium text-gray-800">{p.name}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                  <span className="text-xs font-mono text-gray-500">${p.monthlyRevenue.toLocaleString()}</span>
                                  {p.phone && (
                                      <a href={getWhatsAppLink(p)!} target="_blank" rel="noreferrer" className="text-green-500 hover:text-green-600">
                                          <MessageCircle className="w-3 h-3" />
                                      </a>
                                  )}
                              </div>
                          </div>
                      ))}
                  </div>
                  <div className="mt-auto p-4 border-t border-gray-100/50">
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
