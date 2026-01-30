import React, { useEffect, useState } from 'react';
import { db } from '../services/db';
import { Project, Task, TaskStatus, ProjectStatus } from '../types';
import { Card, Button, Badge } from '../components/UIComponents';
import { 
  TrendingUp, 
  Calendar, 
  CheckCircle2, 
  ArrowUpRight, 
  Zap, 
  Facebook, 
  HardDrive,
  Layout,
  Plus,
  AlertCircle,
  Globe,
  Palette
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      const [p, t] = await Promise.all([db.projects.getAll(), db.tasks.getAll()]);
      setProjects(p);
      setTasks(t);
      setLoading(false);
    };
    loadData();
  }, []);

  // --- Metrics ---
  const activeProjects = projects.filter(p => p.status === ProjectStatus.ACTIVE);
  const mrr = activeProjects.reduce((sum, p) => sum + (p.monthlyRevenue || 0), 0);
  const pendingTasks = tasks.filter(t => t.status === TaskStatus.TODO).length;

  // --- Billing Logic ---
  const today = new Date();
  const currentDay = today.getDate();
  
  const billingAlerts = activeProjects.map(p => {
    const billDay = p.billingDay || 1;
    let status: 'upcoming' | 'today' | 'overdue' = 'upcoming';
    let daysDiff = billDay - currentDay;

    if (daysDiff === 0) status = 'today';
    else if (daysDiff < 0) status = 'overdue';

    return { ...p, billingStatus: status, daysDiff };
  }).sort((a, b) => a.daysDiff - b.daysDiff);

  const upcomingBilling = billingAlerts.filter(p => p.billingStatus === 'today' || (p.daysDiff > 0 && p.daysDiff <= 5));

  if (loading) return <div className="flex h-screen items-center justify-center">Cargando Algoritmia OS...</div>;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Hola, Luca 👋</h1>
          <p className="text-gray-500">Aquí está el estado de tu agencia hoy.</p>
        </div>
        <div className="flex gap-3">
          <Link to="/calculator">
            <Button className="shadow-lg shadow-black/10">
              <Plus className="w-4 h-4 mr-2" /> Nueva Propuesta
            </Button>
          </Link>
        </div>
      </div>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-6 auto-rows-fr">
        
        {/* MRR Card (Large) */}
        <Card className="md:col-span-2 bg-gradient-to-br from-gray-900 to-black text-white p-6 flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-500">
            <TrendingUp className="w-32 h-32 text-white" />
          </div>
          <div>
            <span className="text-gray-400 font-medium text-sm uppercase tracking-wider">MRR Actual</span>
            <div className="text-4xl md:text-5xl font-bold mt-2 tracking-tight">${mrr.toLocaleString()}</div>
            <div className="flex items-center gap-2 mt-2 text-green-400 text-sm">
              <span className="bg-green-400/20 px-2 py-0.5 rounded text-xs font-semibold">+{activeProjects.length} Clientes</span>
              <span>Activos Recurrentes</span>
            </div>
          </div>
          <div className="mt-8 flex gap-2">
             <Link to="/projects" className="w-full">
                <Button variant="secondary" size="sm" className="w-full bg-white/10 text-white hover:bg-white/20 border-0">Ver Clientes</Button>
             </Link>
          </div>
        </Card>

        {/* --- Quick Links Section --- */}
        
        {/* Meta Ads */}
        <a 
          href="https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=1015285380135120&business_id=1149946139536218&breakdown_regrouping=true&nav_source=no_referrer" 
          target="_blank" 
          rel="noreferrer"
          className="md:col-span-1"
        >
          <Card className="h-full p-6 hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10 transition-all cursor-pointer group flex flex-col justify-between">
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
              <Facebook className="w-6 h-6" />
            </div>
            <div>
              <div className="font-bold text-lg text-gray-900 group-hover:text-blue-600 transition-colors">Meta Ads</div>
              <p className="text-sm text-gray-400">Gestionar campañas</p>
            </div>
          </Card>
        </a>

        {/* Google Drive */}
        <a 
          href="https://drive.google.com/drive/u/0/my-drive" 
          target="_blank" 
          rel="noreferrer"
          className="md:col-span-1"
        >
          <Card className="h-full p-6 hover:border-green-500/50 hover:shadow-lg hover:shadow-green-500/10 transition-all cursor-pointer group flex flex-col justify-between">
            <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center text-green-600 group-hover:scale-110 transition-transform">
              <HardDrive className="w-6 h-6" />
            </div>
            <div>
              <div className="font-bold text-lg text-gray-900 group-hover:text-green-600 transition-colors">Drive</div>
              <p className="text-sm text-gray-400">Archivos</p>
            </div>
          </Card>
        </a>

        {/* Algoritmia Web */}
        <a 
          href="https://algoritmiadesarrollos.com.ar/" 
          target="_blank" 
          rel="noreferrer"
          className="md:col-span-1"
        >
          <Card className="h-full p-6 hover:border-indigo-500/50 hover:shadow-lg hover:shadow-indigo-500/10 transition-all cursor-pointer group flex flex-col justify-between">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
              <Globe className="w-6 h-6" />
            </div>
            <div>
              <div className="font-bold text-lg text-gray-900 group-hover:text-indigo-600 transition-colors">Mi Web</div>
              <p className="text-sm text-gray-400">Algoritmia</p>
            </div>
          </Card>
        </a>

         {/* Canva */}
         <a 
          href="https://www.canva.com/projects" 
          target="_blank" 
          rel="noreferrer"
          className="md:col-span-1"
        >
          <Card className="h-full p-6 hover:border-cyan-500/50 hover:shadow-lg hover:shadow-cyan-500/10 transition-all cursor-pointer group flex flex-col justify-between">
            <div className="w-12 h-12 rounded-xl bg-cyan-50 flex items-center justify-center text-cyan-600 group-hover:scale-110 transition-transform">
              <Palette className="w-6 h-6" />
            </div>
            <div>
              <div className="font-bold text-lg text-gray-900 group-hover:text-cyan-600 transition-colors">Canva</div>
              <p className="text-sm text-gray-400">Diseños</p>
            </div>
          </Card>
        </a>

        {/* Billing Alerts (Tall) */}
        <Card className="md:col-span-2 md:row-span-2 p-0 overflow-hidden flex flex-col">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gray-500" />
              <h3 className="font-bold text-gray-900">Próximos Cobros</h3>
            </div>
            <Badge variant="outline">{upcomingBilling.length} Alertas</Badge>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {upcomingBilling.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 p-8 text-center">
                <CheckCircle2 className="w-12 h-12 mb-3 opacity-20" />
                <p>Todo al día. No hay cobros próximos esta semana.</p>
              </div>
            ) : (
              <div className="space-y-1">
                {upcomingBilling.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl transition-colors border border-transparent hover:border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${p.billingStatus === 'overdue' ? 'bg-red-500 animate-pulse' : p.billingStatus === 'today' ? 'bg-green-500' : 'bg-yellow-400'}`}></div>
                      <div>
                        <div className="font-semibold text-sm text-gray-900">{p.name}</div>
                        <div className="text-xs text-gray-500">Día {p.billingDay} del mes</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold text-sm">${p.monthlyRevenue.toLocaleString()}</div>
                      <div className={`text-[10px] font-bold uppercase ${p.billingStatus === 'overdue' ? 'text-red-500' : p.billingStatus === 'today' ? 'text-green-600' : 'text-yellow-600'}`}>
                        {p.billingStatus === 'today' ? 'Cobrar Hoy' : p.billingStatus === 'overdue' ? 'Vencido' : 'Próximamente'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Task Quick View */}
        <Card className="md:col-span-2 md:row-span-2 p-0 overflow-hidden flex flex-col">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
            <div className="flex items-center gap-2">
              <Layout className="w-5 h-5 text-gray-500" />
              <h3 className="font-bold text-gray-900">Foco de Hoy</h3>
            </div>
            <Link to="/tasks" className="text-xs text-blue-600 hover:underline font-medium">Ver Tablero Completo</Link>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
             {tasks.filter(t => t.status === TaskStatus.IN_PROGRESS).map(t => (
               <div key={t.id} className="flex items-start gap-3 p-3 bg-blue-50/50 border border-blue-100 rounded-xl">
                 <div className="mt-1 w-2 h-2 rounded-full bg-blue-400 flex-shrink-0"></div>
                 <div>
                   <p className="text-sm font-medium text-gray-900">{t.title}</p>
                   <Badge variant="blue" className="mt-2 text-[10px] py-0">En Progreso</Badge>
                 </div>
               </div>
             ))}
             {tasks.filter(t => t.status === TaskStatus.TODO).slice(0, 3).map(t => (
               <div key={t.id} className="flex items-start gap-3 p-3 bg-white border border-gray-100 rounded-xl">
                 <div className="mt-1 w-2 h-2 rounded-full bg-gray-300 flex-shrink-0"></div>
                 <p className="text-sm font-medium text-gray-700">{t.title}</p>
               </div>
             ))}
             {tasks.length === 0 && (
                <div className="text-center text-gray-400 py-8 text-sm">
                   No tienes tareas activas.
                </div>
             )}
          </div>
        </Card>

      </div>
    </div>
  );
}
