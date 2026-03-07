import React, { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, YAxis,
} from 'recharts';
import {
  TrendingUp, Zap, AlertTriangle, ArrowRight, Target,
  CheckSquare, DollarSign, Users, Activity,
} from 'lucide-react';
import { db } from '../services/db';
import { Project, Task, TaskStatus, ProjectStatus, Contractor } from '../types';
import { formatMoney } from '../utils/currency';

// ── Stat card ──────────────────────────────────────────────────────────
const Stat = ({ label, value, sub, accent, icon: Icon, to }: {
  label: string; value: string | number; sub?: string;
  accent?: string; icon?: any; to?: string;
}) => {
  const content = (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-black/[0.04] dark:border-white/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] transition-all duration-200">
      <div className="flex items-start justify-between mb-3">
        <p className="text-[12px] font-semibold text-zinc-400 dark:text-zinc-500 tracking-[-0.01em]">{label}</p>
        {Icon && (
          <div className="w-8 h-8 rounded-[8px] bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center">
            <Icon className="w-4 h-4 text-zinc-400 dark:text-zinc-500" />
          </div>
        )}
      </div>
      <p className={`text-[28px] font-bold tracking-[-0.03em] leading-none ${accent || 'text-zinc-900 dark:text-white'}`}>{value}</p>
      {sub && <p className="text-[12px] text-zinc-400 mt-1.5 font-medium">{sub}</p>}
    </div>
  );
  if (to) return <Link to={to} className="block hover:-translate-y-0.5 transition-transform duration-200">{content}</Link>;
  return content;
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [riskClients, setRiskClients] = useState<any[]>([]);
  const [overdueTasksList, setOverdueTasksList] = useState<Task[]>([]);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [p, t, c] = await Promise.all([
        db.projects.getAll(),
        db.tasks.getAll(),
        db.contractors.getAll(),
      ]);
      setProjects(p);
      setTasks(t);
      setContractors(c);
      calculateRisks(p, t);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const calculateRisks = (projList: Project[], taskList: Task[]) => {
    const today = new Date();
    const risks = projList
      .filter(p => p.status === ProjectStatus.ACTIVE || p.status === ProjectStatus.ONBOARDING)
      .filter(p => {
        const last = p.lastContactDate ? new Date(p.lastContactDate) : new Date(p.createdAt);
        return Math.ceil(Math.abs(today.getTime() - last.getTime()) / 86_400_000) > 7;
      })
      .map(p => {
        const last = p.lastContactDate ? new Date(p.lastContactDate) : new Date(p.createdAt);
        return { ...p, daysSinceContact: Math.ceil(Math.abs(today.getTime() - last.getTime()) / 86_400_000) };
      });
    setRiskClients(risks);
    setOverdueTasksList(taskList.filter(t =>
      t.status !== TaskStatus.DONE && t.dueDate && new Date(t.dueDate) < today
    ));
  };

  const activeProjects = useMemo(() => projects.filter(p => p.status === ProjectStatus.ACTIVE), [projects]);
  const mrrUSD = useMemo(() => activeProjects.filter(p => !p.currency || p.currency === 'USD').reduce((s, p) => s + (p.monthlyRevenue || 0), 0), [activeProjects]);
  const mrrARS = useMemo(() => activeProjects.filter(p => p.currency === 'ARS').reduce((s, p) => s + (p.monthlyRevenue || 0), 0), [activeProjects]);
  const pendingTasks = useMemo(() => tasks.filter(t => t.status !== TaskStatus.DONE), [tasks]);

  // MRR trend last 6 months
  const mrrData = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(today.getFullYear(), today.getMonth() - (5 - i), 1);
      const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      const active = projects.filter(p => {
        const created = new Date(p.createdAt);
        return created <= endOfMonth && (p.status === ProjectStatus.ACTIVE || p.status === ProjectStatus.ONBOARDING);
      });
      return {
        name: d.toLocaleDateString('es-ES', { month: 'short' }),
        usd: active.filter(p => !p.currency || p.currency === 'USD').reduce((s, p) => s + (p.monthlyRevenue || 0), 0),
        ars: active.filter(p => p.currency === 'ARS').reduce((s, p) => s + (p.monthlyRevenue || 0), 0),
      };
    });
  }, [projects]);

  // Funnel
  const funnelData = useMemo(() => [
    { name: 'Leads',      value: projects.filter(p => p.status === ProjectStatus.LEAD || p.status === ProjectStatus.DISCOVERY).length,     color: '#94a3b8' },
    { name: 'Propuestas', value: projects.filter(p => p.status === ProjectStatus.PROPOSAL || p.status === ProjectStatus.NEGOTIATION).length, color: '#60a5fa' },
    { name: 'Activos',    value: projects.filter(p => p.status === ProjectStatus.ACTIVE || p.status === ProjectStatus.ONBOARDING).length,    color: '#34d399' },
  ], [projects]);

  const ChartTip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white dark:bg-zinc-800 px-3 py-2 rounded-[10px] border border-zinc-100 dark:border-zinc-700 shadow-[0_4px_16px_rgba(0,0,0,0.1)]">
        <p className="text-[11px] font-semibold text-zinc-400 mb-1">{label}</p>
        {payload.map((p: any) => (
          <p key={p.dataKey} className="text-[13px] font-bold" style={{ color: p.color }}>
            {p.dataKey === 'usd' ? formatMoney(p.value, 'USD') : p.dataKey === 'ars' ? formatMoney(p.value, 'ARS') : p.value}
          </p>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-zinc-100 dark:bg-zinc-800 rounded-full" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-zinc-100 dark:bg-zinc-800 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-[26px] font-bold tracking-[-0.03em] text-zinc-900 dark:text-white">
            Bienvenido, Luca.
          </h1>
          <p className="text-[14px] text-zinc-400 dark:text-zinc-500 mt-0.5 font-medium">
            {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(riskClients.length > 0 || overdueTasksList.length > 0) && (
            <button
              onClick={() => navigate('/audit')}
              className="flex items-center gap-2 px-3.5 py-2 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-[10px] text-[12px] font-semibold text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-all"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              {riskClients.length + overdueTasksList.length} alertas
            </button>
          )}
          <button
            onClick={() => navigate('/audit')}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-[10px] text-[13px] font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.15)] hover:bg-black dark:hover:bg-zinc-100 active:scale-[0.97] transition-all"
          >
            <Activity className="w-3.5 h-3.5" /> Scanner Operativo
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="MRR (USD)" value={formatMoney(mrrUSD, 'USD')} sub={`${activeProjects.length} clientes activos`} accent="text-emerald-600 dark:text-emerald-400" icon={DollarSign} to="/projects" />
        <Stat label="MRR (ARS)" value={formatMoney(mrrARS, 'ARS')} sub="facturación mensual ARS" icon={TrendingUp} to="/payments" />
        <Stat label="Tareas Pendientes" value={pendingTasks.length} sub={`${overdueTasksList.length} vencidas`} accent={overdueTasksList.length > 0 ? 'text-red-500' : 'text-zinc-900 dark:text-white'} icon={CheckSquare} to="/tasks" />
        <Stat label="Equipo" value={contractors.length} sub="colaboradores activos" icon={Users} to="/partners" />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* MRR Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 rounded-2xl border border-black/[0.04] dark:border-white/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden">
          <div className="px-5 pt-5 pb-4">
            <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-[0.06em]">MRR — Últimos 6 meses</p>
            <p className="text-[22px] font-bold tracking-[-0.03em] text-zinc-900 dark:text-white mt-1">
              {formatMoney(mrrUSD, 'USD')}
              {mrrARS > 0 && <span className="text-emerald-500 ml-3 text-[18px]">{formatMoney(mrrARS, 'ARS')}</span>}
            </p>
          </div>
          <div className="h-52 px-2 pb-3">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mrrData} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="gUSD" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#a1a1aa' }} />
                <Tooltip content={<ChartTip />} />
                <Area type="monotone" dataKey="usd" stroke="#6366f1" strokeWidth={2} fill="url(#gUSD)" dot={false} />
                {mrrARS > 0 && <Area type="monotone" dataKey="ars" stroke="#34d399" strokeWidth={2} fillOpacity={0} dot={false} />}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Funnel */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-black/[0.04] dark:border-white/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-5">
          <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-[0.06em] mb-4">Pipeline de Ventas</p>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnelData} layout="vertical" margin={{ top: 0, right: 24, left: 0, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={72} tick={{ fontSize: 12, fill: '#71717a' }} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: 'rgba(0,0,0,0.03)' }} content={<ChartTip />} />
                <Bar dataKey="value" barSize={12} radius={[0, 6, 6, 0]}>
                  {funnelData.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 pt-4 border-t border-zinc-50 dark:border-zinc-800">
            <Link to="/projects" className="flex items-center justify-between text-[12px] font-semibold text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
              Ver todos los clientes <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Bottom grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Próximos cobros */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-black/[0.04] dark:border-white/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-50 dark:border-zinc-800/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-[7px] bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center">
                <DollarSign className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="text-[13px] font-semibold text-zinc-900 dark:text-white tracking-[-0.01em]">Próximos Cobros</p>
            </div>
            <Link to="/payments" className="text-[12px] font-medium text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors flex items-center gap-1">
              Ver todos <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-zinc-50 dark:divide-zinc-800/50">
            {(() => {
              const today = new Date();
              return activeProjects
                .map(p => {
                  const day = p.billingDay || 1;
                  let next = new Date(today.getFullYear(), today.getMonth(), day);
                  if (next <= today) next = new Date(today.getFullYear(), today.getMonth() + 1, day);
                  return { ...p, nextDate: next, diffDays: Math.ceil((next.getTime() - today.getTime()) / 86_400_000) };
                })
                .sort((a, b) => a.nextDate.getTime() - b.nextDate.getTime())
                .slice(0, 5)
                .map(p => (
                  <div key={p.id} className="flex items-center justify-between px-5 py-3 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`text-[11px] font-bold px-2 py-0.5 rounded-[6px] min-w-[40px] text-center ${
                        p.diffDays <= 3 ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400' :
                        p.diffDays <= 7 ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400' :
                        'bg-zinc-50 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
                      }`}>
                        {p.diffDays === 0 ? 'HOY' : `${p.diffDays}d`}
                      </div>
                      <div>
                        <p className="text-[13px] font-medium text-zinc-800 dark:text-zinc-200">{p.name}</p>
                        <p className="text-[11px] text-zinc-400">{p.nextDate.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</p>
                      </div>
                    </div>
                    <span className="text-[12px] font-semibold text-zinc-600 dark:text-zinc-400">{formatMoney(p.monthlyRevenue, p.currency)}</span>
                  </div>
                ));
            })()}
          </div>
        </div>

        {/* Foco de hoy */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-black/[0.04] dark:border-white/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-50 dark:border-zinc-800/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-[7px] bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center">
                <Zap className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <p className="text-[13px] font-semibold text-zinc-900 dark:text-white tracking-[-0.01em]">Foco de Hoy</p>
            </div>
            <Link to="/tasks" className="text-[12px] font-medium text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors flex items-center gap-1">
              Ver todos <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-zinc-50 dark:divide-zinc-800/50">
            {(() => {
              const todayStr = new Date().toISOString().split('T')[0];
              const overdue  = pendingTasks.filter(t => t.dueDate && t.dueDate < todayStr);
              const today    = pendingTasks.filter(t => t.dueDate?.startsWith(todayStr));
              const upcoming = pendingTasks.filter(t => !t.dueDate || t.dueDate > todayStr);
              const sorted   = [...overdue, ...today, ...upcoming].slice(0, 5);

              if (sorted.length === 0) {
                return (
                  <div className="flex flex-col items-center py-10 gap-2">
                    <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center">
                      <CheckSquare className="w-5 h-5 text-emerald-500" />
                    </div>
                    <p className="text-[13px] text-zinc-400 font-medium">Todo al día</p>
                  </div>
                );
              }

              return sorted.map(t => {
                const isOverdue = t.dueDate && t.dueDate < todayStr;
                const isToday   = t.dueDate?.startsWith(todayStr);
                return (
                  <div key={t.id} className="flex items-center gap-3 px-5 py-3 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/30 transition-colors">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      t.priority === 'HIGH' ? 'bg-red-500' :
                      t.priority === 'MEDIUM' ? 'bg-amber-400' : 'bg-zinc-300 dark:bg-zinc-600'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-zinc-800 dark:text-zinc-200 truncate">{t.title}</p>
                      {t.dueDate && (
                        <p className={`text-[11px] font-semibold mt-0.5 ${
                          isOverdue ? 'text-red-500' : isToday ? 'text-indigo-500' : 'text-zinc-400'
                        }`}>
                          {isOverdue ? 'Vencida' : isToday ? 'Hoy' : new Date(t.dueDate + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                        </p>
                      )}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      </div>

      {/* Risk Clients */}
      {riskClients.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-black/[0.04] dark:border-white/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-50 dark:border-zinc-800/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-[7px] bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              </div>
              <p className="text-[13px] font-semibold text-zinc-900 dark:text-white tracking-[-0.01em]">
                Clientes sin contacto reciente
              </p>
            </div>
            <span className="text-[11px] font-bold px-2.5 py-1 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-full">
              {riskClients.length}
            </span>
          </div>
          <div className="divide-y divide-zinc-50 dark:divide-zinc-800/50">
            {riskClients.slice(0, 5).map(p => (
              <Link key={p.id} to={`/projects/${p.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/30 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-[11px] font-bold text-zinc-500 dark:text-zinc-400 flex-shrink-0">
                    {p.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-[13px] font-medium text-zinc-800 dark:text-zinc-200">{p.name}</p>
                    <p className="text-[11px] text-zinc-400">{p.industry || 'Sin industria'}</p>
                  </div>
                </div>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-[6px] ${
                  p.daysSinceContact > 14 ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400' : 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400'
                }`}>
                  {p.daysSinceContact}d
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { to: '/meta-ads',  icon: Target,      label: 'Meta Ads',  sub: 'Campañas y métricas',   color: 'text-blue-500',   bg: 'bg-blue-50 dark:bg-blue-500/10' },
          { to: '/tasks',     icon: CheckSquare, label: 'Tareas',    sub: `${pendingTasks.length} pendientes`,  color: 'text-violet-500', bg: 'bg-violet-50 dark:bg-violet-500/10' },
          { to: '/payments',  icon: DollarSign,  label: 'Pagos',     sub: 'Calendario de cobros',   color: 'text-emerald-500',bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
          { to: '/ai-studio', icon: Zap,         label: 'AI Studio', sub: 'Asistente de agencia',   color: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-500/10' },
        ].map(({ to, icon: Icon, label, sub, color, bg }) => (
          <Link key={to} to={to}
            className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-black/[0.04] dark:border-white/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 flex flex-col gap-2.5">
            <div className={`w-9 h-9 rounded-[10px] ${bg} flex items-center justify-center`}>
              <Icon className={`w-[18px] h-[18px] ${color}`} />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-zinc-900 dark:text-white tracking-[-0.01em]">{label}</p>
              <p className="text-[11px] text-zinc-400 mt-0.5">{sub}</p>
            </div>
          </Link>
        ))}
      </div>

    </div>
  );
}
