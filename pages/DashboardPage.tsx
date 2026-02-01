
import React, { useEffect, useState, useMemo } from 'react';
import { db } from '../services/db';
import { ai } from '../services/ai';
import { sounds } from '../services/sounds';
import { Project, Task, TaskStatus, ProjectStatus, Contractor } from '../types';
import { Card, Button, Badge } from '../components/UIComponents';
import { 
  TrendingUp, 
  Calendar, 
  CheckCircle2, 
  Zap, 
  ArrowRight,
  Clock,
  MessageCircle,
  Activity,
  AlertOctagon,
  PieChart,
  BarChart as BarChartIcon,
  DollarSign
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, PieChart as RePieChart, Pie, Legend } from 'recharts';

export default function DashboardPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Local Calculated Risks (For Instant UI)
  const [riskClients, setRiskClients] = useState<any[]>([]);
  const [overdueTasksList, setOverdueTasksList] = useState<Task[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [p, t, c] = await Promise.all([db.projects.getAll(), db.tasks.getAll(), db.contractors.getAll()]);
      setProjects(p);
      setTasks(t);
      setContractors(c);
      calculateRisks(p, t);
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateRisks = (projList: Project[], taskList: Task[]) => {
      const today = new Date();
      const risks = projList.filter(p => {
          if (p.status !== ProjectStatus.ACTIVE && p.status !== ProjectStatus.ONBOARDING) return false;
          const lastContact = p.lastContactDate ? new Date(p.lastContactDate) : new Date(p.createdAt);
          const diffDays = Math.ceil(Math.abs(today.getTime() - lastContact.getTime()) / (1000 * 60 * 60 * 24));
          return diffDays > 7;
      }).map(p => ({...p, daysSinceContact: Math.ceil(Math.abs(today.getTime() - (p.lastContactDate ? new Date(p.lastContactDate).getTime() : new Date(p.createdAt).getTime())) / (1000 * 60 * 60 * 24))}));
      setRiskClients(risks);

      const overdue = taskList.filter(t => t.status !== TaskStatus.DONE && t.dueDate && new Date(t.dueDate) < today);
      setOverdueTasksList(overdue);
  };

  const handleScan = () => navigate('/audit');

  // --- CHART DATA PREPARATION ---
  
  // 1. MRR Trend (Last 6 Months)
  const mrrData = useMemo(() => {
      const data = [];
      const today = new Date();
      for (let i = 5; i >= 0; i--) {
          const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
          const monthName = d.toLocaleDateString('es-ES', { month: 'short' });
          
          const activeAtTime = projects.filter(p => {
              const created = new Date(p.createdAt);
              const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0);
              return created <= endOfMonth && (p.status === ProjectStatus.ACTIVE || p.status === ProjectStatus.ONBOARDING);
          });
          
          const totalMrr = activeAtTime.reduce((sum, p) => sum + (p.monthlyRevenue || 0), 0);
          data.push({ name: monthName, mrr: totalMrr });
      }
      return data;
  }, [projects]);

  // 2. Funnel Data
  const funnelData = useMemo(() => {
      const leads = projects.filter(p => p.status === ProjectStatus.LEAD || p.status === ProjectStatus.DISCOVERY).length;
      const proposals = projects.filter(p => p.status === ProjectStatus.PROPOSAL || p.status === ProjectStatus.NEGOTIATION).length;
      const closed = projects.filter(p => p.status === ProjectStatus.ACTIVE || p.status === ProjectStatus.ONBOARDING).length;
      return [
          { name: 'Leads', value: leads, color: '#94a3b8' },
          { name: 'Propuestas', value: proposals, color: '#60a5fa' },
          { name: 'Cierres', value: closed, color: '#22c55e' }
      ];
  }, [projects]);

  // 3. Workload (Tasks by Partner)
  const workloadData = useMemo(() => {
      const activeTasks = tasks.filter(t => t.status !== TaskStatus.DONE);
      const counts: Record<string, number> = {};
      
      activeTasks.forEach(t => {
          const name = t.assigneeId ? contractors.find(c => c.id === t.assigneeId)?.name || 'Desconocido' : 'Sin Asignar';
          counts[name] = (counts[name] || 0) + 1;
      });

      return Object.entries(counts).map(([name, value], index) => ({
          name, value, fill: ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#a4de6c'][index % 5]
      }));
  }, [tasks, contractors]);


  const activeProjects = projects.filter(p => p.status === ProjectStatus.ACTIVE);
  const mrr = activeProjects.reduce((sum, p) => sum + (p.monthlyRevenue || 0), 0);
  
  const CustomTooltip = ({ active, payload, label }: any) => {
      if (active && payload && payload.length) {
          return (
              <div className="bg-white dark:bg-slate-800 p-3 border border-gray-100 dark:border-slate-700 rounded-xl shadow-xl">
                  <p className="font-bold text-xs mb-1">{label}</p>
                  <p className="text-sm font-mono text-indigo-600 dark:text-indigo-400">
                      {payload[0].name === 'mrr' ? `$${payload[0].value.toLocaleString()}` : payload[0].value}
                  </p>
              </div>
          );
      }
      return null;
  };

  if (loading) return <div className="flex h-screen items-center justify-center text-gray-400 bg-[#FAFAFA] dark:bg-[#020617]"><div className="animate-pulse">Cargando Sistema...</div></div>;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-24">
      
      {/* 1. Header with Scanner Button */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center pt-8 pb-4 gap-4">
          <div>
              <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Bienvenido, Luca.</h1>
              <p className="text-gray-500 dark:text-gray-400 mt-2">Tablero de Control Ejecutivo.</p>
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

      {/* 2. OPERATIONAL WIDGETS (MOVED TO TOP) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Billing Alerts Widget */}
          <Card className="flex-1 flex flex-col border-emerald-100 dark:border-emerald-900/30">
              <div className="p-5 border-b border-gray-100/50 dark:border-gray-800 bg-emerald-50/50 dark:bg-emerald-900/10">
                  <h3 className="font-bold text-emerald-900 dark:text-emerald-200 text-sm flex items-center gap-2">
                      <DollarSign className="w-4 h-4" /> Próximos Cobros
                  </h3>
              </div>
              <div className="p-2 space-y-1">
                  {activeProjects.sort((a,b) => (a.billingDay||1) - (b.billingDay||1)).slice(0, 3).map(p => (
                      <div key={p.id} className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-default">
                          <div className="flex items-center gap-3">
                              <div className="font-bold text-gray-500 w-6 text-center text-xs bg-gray-100 dark:bg-slate-700 rounded px-1">
                                  {p.billingDay}
                              </div>
                              <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{p.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                              <span className="text-xs font-mono text-gray-500 font-bold">${p.monthlyRevenue.toLocaleString()}</span>
                          </div>
                      </div>
                  ))}
              </div>
              <div className="mt-auto p-4 border-t border-gray-100/50 dark:border-gray-800">
                  <Link to="/payments">
                    <Button variant="ghost" size="sm" className="w-full text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50">Ver Calendario de Pagos</Button>
                  </Link>
              </div>
          </Card>

          {/* Recent Activity / Focus */}
          <Card className="flex flex-col border-indigo-100 dark:border-indigo-900/30">
              <div className="p-6 border-b border-gray-100/50 dark:border-gray-800 flex justify-between items-center bg-indigo-50/50 dark:bg-indigo-900/10">
                  <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-600 text-white rounded-lg"><Zap className="w-4 h-4" /></div>
                      <div>
                          <h3 className="font-bold text-indigo-900 dark:text-indigo-200">Foco de Hoy</h3>
                          <p className="text-xs text-indigo-600 dark:text-indigo-400">Tareas prioritarias</p>
                      </div>
                  </div>
                  <Link to="/tasks" className="text-xs font-semibold text-gray-400 hover:text-black dark:hover:text-white transition-colors">Ver Todo</Link>
              </div>
              <div className="p-4 flex-1 overflow-y-auto space-y-3 bg-gray-50/30 dark:bg-slate-900/30">
                  {tasks.filter(t => t.status !== TaskStatus.DONE).slice(0,3).map(t => (
                      <div key={t.id} className="group bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all flex items-start gap-4">
                          <div className="flex-1">
                              <div className="flex justify-between">
                                  <p className="font-semibold text-gray-800 dark:text-white text-sm">{t.title}</p>
                                  {t.priority === 'HIGH' && <Badge variant="outline" className="text-[10px] text-red-600 bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900">Alta</Badge>}
                              </div>
                          </div>
                      </div>
                  ))}
                  {tasks.filter(t => t.status !== TaskStatus.DONE).length === 0 && <p className="text-center text-gray-400 text-xs py-4">Todo al día.</p>}
              </div>
          </Card>
      </div>

      {/* 3. BI CHARTS (STRATEGIC) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* MRR Trend */}
          <Card className="lg:col-span-2 p-6 flex flex-col justify-between">
              <div className="flex justify-between items-start mb-6">
                  <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Crecimiento MRR (6 Meses)</p>
                      <h2 className="text-2xl font-bold tracking-tight mt-1">${mrr.toLocaleString()} <span className="text-sm font-normal text-gray-400">/ mes actual</span></h2>
                  </div>
                  <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg text-green-600"><TrendingUp className="w-5 h-5"/></div>
              </div>
              <div className="h-64 w-full min-w-0 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={mrrData}>
                          <defs>
                              <linearGradient id="colorMrr" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3}/>
                                  <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                              </linearGradient>
                          </defs>
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#9ca3af'}} />
                          <Tooltip content={<CustomTooltip />} />
                          <Area type="monotone" dataKey="mrr" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorMrr)" />
                      </AreaChart>
                  </ResponsiveContainer>
              </div>
          </Card>

          {/* Side Charts Column */}
          <div className="space-y-6">
              
              {/* Funnel */}
              <Card className="p-6 h-[200px] flex flex-col">
                  <div className="flex justify-between items-center mb-2">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Funnel de Ventas</p>
                      <BarChartIcon className="w-4 h-4 text-gray-400" />
                  </div>
                  <div className="flex-1 w-full text-xs min-h-0 min-w-0">
                      <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={funnelData} layout="vertical" margin={{top: 0, right: 30, left: 0, bottom: 0}}>
                              <XAxis type="number" hide />
                              <YAxis dataKey="name" type="category" width={70} tick={{fontSize: 10, fill: '#6b7280'}} tickLine={false} axisLine={false} />
                              <Tooltip cursor={{fill: 'transparent'}} content={<CustomTooltip />} />
                              <Bar dataKey="value" barSize={15} radius={[0, 4, 4, 0]}>
                                  {funnelData.map((entry, index) => (
                                      <Cell key={`cell-${index}`} fill={entry.color} />
                                  ))}
                              </Bar>
                          </BarChart>
                      </ResponsiveContainer>
                  </div>
              </Card>

              {/* Workload */}
              <Card className="p-6 h-[200px] flex flex-col">
                  <div className="flex justify-between items-center mb-2">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Carga de Equipo</p>
                      <PieChart className="w-4 h-4 text-gray-400" />
                  </div>
                  <div className="flex-1 w-full text-xs flex items-center justify-center min-h-0 min-w-0">
                      <ResponsiveContainer width="100%" height="100%">
                          <RePieChart>
                              <Pie 
                                data={workloadData} 
                                innerRadius={40} 
                                outerRadius={60} 
                                paddingAngle={5} 
                                dataKey="value"
                              >
                                  {workloadData.map((entry, index) => (
                                      <Cell key={`cell-${index}`} fill={entry.fill} />
                                  ))}
                              </Pie>
                              <Tooltip content={<CustomTooltip />} />
                          </RePieChart>
                      </ResponsiveContainer>
                  </div>
              </Card>

          </div>
      </div>
    </div>
  );
}
