import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';
import { Target, TrendingDown, TrendingUp, Layers, Loader2, RefreshCw, AlertCircle, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { metaAds, daysAgo, today } from '../../services/metaAds';
import { analyzeGPTEcosystem } from '../../services/ai-new';

// ── Types ─────────────────────────────────────────────────────────────────────
interface AdPoint {
  ad_id:    string;
  ad_name:  string;
  adset_id: string;
  adset:    string;
  campaign: string;
  cpa:      number;  // spend / conversions
  gpt:      number;  // (revenue - spend) / conversions  ← gross profit PER TRANSACTION
  spend:    number;
  revenue:  number;
  results:  number;
  roas:     number;
  hasRevenue: boolean;
}

type Period = '7d' | '14d' | '28d';
const PERIODS: { label: string; value: Period; days: number }[] = [
  { label: 'Últimos 7 días',  value: '7d',  days: 7  },
  { label: 'Últimos 14 días', value: '14d', days: 14 },
  { label: 'Últimos 28 días', value: '28d', days: 28 },
];

interface Campaign { id: string; name: string; status: string; }
interface Adset    { id: string; name: string; campaign_id: string; }

interface GPTOptimizerTabProps {
  accountId?: string;
  clientId?:  string;
}

// ── KPI Card ─────────────────────────────────────────────────────────────────
function KpiChip({ label, value, sub, icon: Icon, colorClass }: {
  label: string; value: string; sub?: string; icon: any; colorClass: string;
}) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-[14px] border bg-white dark:bg-zinc-900 shadow-sm flex-1 min-w-[155px] ${colorClass}`}>
      <div className={`w-9 h-9 rounded-[10px] flex items-center justify-center flex-shrink-0 opacity-80 ${colorClass.replace('border-', 'bg-').split(' ')[0]}/10`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 leading-tight">{label}</p>
        <p className="text-[19px] font-black text-zinc-900 dark:text-white leading-tight">{value}</p>
        {sub && <p className="text-[10px] text-zinc-400 mt-0.5 truncate">{sub}</p>}
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const getMetaVal = (arr: any[], ...types: string[]): number => {
  for (const t of types) {
    const v = arr?.find((a: any) => a.action_type === t)?.value;
    if (v != null && parseFloat(v) > 0) return parseFloat(v);
  }
  return 0;
};

// Purchase revenue from action_values
const getPurchaseRevenue = (actionValues: any[]): number =>
  getMetaVal(actionValues,
    'offsite_conversion.fb_pixel_purchase',
    'omni_purchase',
    'purchase',
    'onsite_conversion.purchase');

// Purchase count directly from actions (independent of revenue tracking)
const getPurchaseCount = (actions: any[]): number =>
  getMetaVal(actions,
    'offsite_conversion.fb_pixel_purchase',
    'omni_purchase',
    'purchase',
    'onsite_conversion.purchase');

// Lead count for non-ecommerce accounts (NEVER uses link_click — it inflates count 10-100x)
const getLeadCount = (actions: any[]): number =>
  getMetaVal(actions,
    'lead',
    'offsite_conversion.fb_pixel_lead',
    'onsite_conversion.lead_grouped',
    'onsite_conversion.messaging_conversation_started_7d');

// Format currency: commas, always 2 decimals, no rounding/abbreviation
const fmt = (n: number): string => {
  if (!isFinite(n) || isNaN(n)) return '$0.00';
  return (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// ── Main Component ────────────────────────────────────────────────────────────
export function GPTOptimizerTab({ accountId, clientId }: GPTOptimizerTabProps) {

  // ── State ──
  const [campaigns,  setCampaigns]  = useState<Campaign[]>([]);
  const [adsets,     setAdsets]     = useState<Adset[]>([]);
  const [adPoints,   setAdPoints]   = useState<AdPoint[]>([]);
  const [period,     setPeriod]     = useState<Period>('7d');

  const [selCampaign, setSelCampaign] = useState('All');
  const [selAdset,    setSelAdset]    = useState('All');

  const [loading,     setLoading]     = useState(false);
  const [loadMsg,     setLoadMsg]     = useState('');
  const [error,       setError]       = useState<string | null>(null);
  const [aiAnalysis,  setAiAnalysis]  = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiExpanded,  setAiExpanded]  = useState(true);


  // Determine which account to query
  const accountToUse = accountId || '';

  // ── Load all data — period passed as explicit param (no stale closure) ────────
  const loadData = useCallback(async (activePeriod: Period) => {
    if (!accountToUse) { setError('No hay cuenta seleccionada.'); return; }
    setLoading(true);
    setError(null);
    setAdPoints([]);
    setCampaigns([]);
    setAdsets([]);
    setAiAnalysis(null);
    setSelCampaign('All');
    setSelAdset('All');

    try {
      setLoadMsg('Cargando campañas y conjuntos…');
      const [campsRes, adsetsRes] = await Promise.all([
        metaAds.getCampaigns(accountToUse).catch(() => ({ data: [] })),
        metaAds.getAccountAdsets(accountToUse).catch(() => ({ data: [] })),
      ]);
      const allCamps: Campaign[] = (campsRes.data || []).filter(
        (c: any) => c.status === 'ACTIVE' || c.status === 'PAUSED'
      );
      const allAdsets: Adset[] = adsetsRes.data || [];
      setCampaigns(allCamps);
      setAdsets(allAdsets);
      if (allCamps.length === 0) { setLoading(false); setLoadMsg(''); return; }

      const campMap: Record<string, string> = {};
      allCamps.forEach(c => { campMap[c.id] = c.name; });
      const adsetNameMap: Record<string, string> = {};
      allAdsets.forEach(a => { adsetNameMap[a.id] = a.name; });

      // activePeriod passed explicitly — no closure ambiguity
      const days = PERIODS.find(p => p.value === activePeriod)?.days ?? 7;
      const datePreset = `last_${days}d`;

      setLoadMsg('Cargando insights de anuncios…');
      const insFields = [
        'ad_id', 'ad_name', 'adset_id', 'adset_name',
        'campaign_id', 'campaign_name',
        'spend', 'actions', 'action_values', 'purchase_roas',
      ].join(',');

      const insRes = await fetch(
        `https://graph.facebook.com/v21.0/${accountToUse}/insights?` +
        `access_token=${localStorage.getItem('meta_ads_token') || ''}` +
        `&fields=${insFields}&level=ad&limit=500` +
        `&date_preset=${datePreset}`
      ).then(r => r.json()).catch(e => { console.error('[GPT]', e); return { data: [] }; });

      const adInsights: any[] = insRes.data || [];

      const adPointsArr: AdPoint[] = adInsights
        .filter((ins: any) => parseFloat(ins.spend || '0') >= 0.5)
        .map((ins: any) => {
          const spend        = parseFloat(ins.spend || '0');
          const actions:      any[] = ins.actions       || [];
          const actionValues: any[] = ins.action_values || [];

          const revenue    = getPurchaseRevenue(actionValues);
          const hasRevenue = revenue > 0;
          const purchases  = getPurchaseCount(actions);
          const conversions = purchases > 0 ? purchases : getLeadCount(actions);
          const cpa = conversions > 0 ? spend / conversions : spend;
          const gpt = hasRevenue && conversions > 0
            ? (revenue - spend) / conversions
            : -cpa;

          const campName  = ins.campaign_name  || campMap[ins.campaign_id]   || 'Sin campaña';
          const adsetName = ins.adset_name     || adsetNameMap[ins.adset_id] || 'Sin conjunto';

          return {
            ad_id: ins.ad_id, ad_name: ins.ad_name,
            adset_id: ins.adset_id, adset: adsetName,
            campaign: campName,
            cpa, gpt, spend, revenue,
            results: conversions,
            roas: ins.purchase_roas?.[0]?.value ? parseFloat(ins.purchase_roas[0].value) : 0,
            hasRevenue,
          } as AdPoint;
        })
        .reduce((acc: AdPoint[], cur: AdPoint) => {
          const ex = acc.find(d => d.ad_id === cur.ad_id);
          if (!ex || cur.spend > ex.spend)
            return [...acc.filter(d => d.ad_id !== cur.ad_id), cur];
          return acc;
        }, []);

      setAdPoints(adPointsArr);
    } catch (e: any) {
      setError(e?.message || 'Error cargando datos de Meta Ads');
    } finally {
      setLoading(false);
      setLoadMsg('');
    }
  }, [accountToUse]);   // period removed from deps — passed as param instead

  // Re-fetch whenever account or period changes
  useEffect(() => {
    if (accountToUse) loadData(period);
  }, [accountToUse, period]);

  // ── Filtered options ───────────────────────────────────────────────────────
  const campaignOptions = useMemo(() =>
    ['All', ...Array.from(new Set(adPoints.map(d => d.campaign)))].sort(),
  [adPoints]);

  const adsetOptions = useMemo(() => {
    const base = selCampaign === 'All' ? adPoints : adPoints.filter(d => d.campaign === selCampaign);
    return ['All', ...Array.from(new Set(base.map(d => d.adset)))].sort();
  }, [adPoints, selCampaign]);

  const handleCampaignChange = (val: string) => {
    setSelCampaign(val);
    setSelAdset('All');
  };

  // ── Filtered data for chart ────────────────────────────────────────────────
  const filteredData = useMemo(() => {
    let data = adPoints;
    if (selCampaign !== 'All') data = data.filter(d => d.campaign === selCampaign);
    if (selAdset    !== 'All') data = data.filter(d => d.adset    === selAdset);
    return data;
  }, [adPoints, selCampaign, selAdset]);

  // ── Averages — match Meta's calculation exactly ──
  // CPA = total spend ALL ads / total results (only from converting ads)
  // GPT = (total revenue - total spend ALL ads) / total results
  // This mirrors Meta's weighted average shown in the totals row.
  const { avgCpa, avgGpt } = useMemo(() => {
    if (!adPoints.length) return { avgCpa: 0, avgGpt: 0 };
    const totalResults = adPoints.reduce((sum, ad) => sum + ad.results, 0);
    if (totalResults === 0) return { avgCpa: 0, avgGpt: 0 };
    const totalSpend   = adPoints.reduce((sum, ad) => sum + ad.spend, 0);
    const totalRevenue = adPoints.reduce((sum, ad) => sum + ad.revenue, 0);
    return {
      avgCpa: totalSpend / totalResults,
      avgGpt: (totalRevenue - totalSpend) / totalResults,
    };
  }, [adPoints]);

  // ── Stats for KPI cards ────────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!filteredData.length) return { cpa: 0, gpt: 0, scalers: 0, liabilities: 0 };

    // Match Meta: spend = ALL ads, results/revenue = only from converting ads
    const totalResults = filteredData.reduce((sum, c) => sum + c.results, 0);
    const totalSpend   = filteredData.reduce((sum, c) => sum + c.spend, 0);
    const totalRevenue = filteredData.reduce((sum, c) => sum + c.revenue, 0);

    const cpa = totalResults > 0 ? totalSpend / totalResults : 0;
    const gpt = totalResults > 0 ? (totalRevenue - totalSpend) / totalResults : 0;

    return {
      cpa,
      gpt,
      scalers:     filteredData.filter(d => d.cpa <= avgCpa && d.gpt >= avgGpt).length,
      liabilities: filteredData.filter(d => d.cpa >  avgCpa && d.gpt <  avgGpt).length,
    };
  }, [filteredData, avgCpa, avgGpt]);

  const getColor = (cpa: number, gpt: number) => {
    if (cpa <= avgCpa && gpt >= avgGpt) return '#22c55e';
    if (cpa >  avgCpa && gpt >= avgGpt) return '#3b82f6';
    if (cpa <= avgCpa && gpt <  avgGpt) return '#eab308';
    return '#ef4444';
  };

  // No useCallback — reads period/filteredData/avgCpa/avgGpt at click time (always fresh)
  const handleAnalyze = async () => {
    if (!filteredData.length) return;
    setIsAnalyzing(true);
    setAiAnalysis(null);
    setAiExpanded(true);
    const currentPeriod = PERIODS.find(p => p.value === period)?.label ?? period;
    try {
      const result = await analyzeGPTEcosystem(filteredData, currentPeriod, avgCpa, avgGpt);
      setAiAnalysis(result);
    } catch (e: any) {
      setAiAnalysis(`Error al analizar: ${e?.message || 'Intenta de nuevo.'}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="animate-in fade-in space-y-5 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-[12px] bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white shadow-sm flex-shrink-0">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-[17px] font-bold text-zinc-900 dark:text-white leading-tight">GPT Optimizer (4PI)</h2>
            <p className="text-[12px] text-zinc-500">
              Metodología de cuartiles · {adPoints.length} anuncios con gasto
              {selCampaign !== 'All' || selAdset !== 'All'
                ? ` · mostrando ${filteredData.length}`
                : ''}
            </p>
          </div>
        </div>
        <button
          onClick={() => loadData(period)}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 text-[12px] font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40 transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Cargando…' : 'Actualizar'}
        </button>

        {/* Period selector */}
        <div className="flex items-center gap-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-[8px] p-0.5">
          {PERIODS.map(p => (
            <button
              key={p.value}
              onClick={() => { setPeriod(p.value as Period); }}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-[6px] transition-all ${
                period === p.value
                  ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
              }`}
            >
              {p.value.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-zinc-400">
          <Loader2 className="w-7 h-7 animate-spin text-indigo-500" />
          <p className="text-[13px] font-medium">{loadMsg || 'Cargando datos de Meta Ads…'}</p>
          <p className="text-[11px] text-zinc-300 dark:text-zinc-600">Esto puede tardar unos segundos</p>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="flex items-center gap-3 p-4 rounded-[12px] bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/40 text-red-600 dark:text-red-400">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <div>
            <p className="text-[13px] font-semibold">Error al cargar datos</p>
            <p className="text-[11px] mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && adPoints.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-2 text-zinc-400">
          <Target className="w-8 h-8 opacity-30" />
          <p className="text-[13px] font-medium">No hay anuncios con gasto en los últimos {PERIODS.find(p => p.value === period)?.days || 7} días</p>
          <p className="text-[11px]">Cambiá el período o seleccioná otra cuenta</p>
        </div>
      )}

      {/* Main content */}
      {!loading && !error && adPoints.length > 0 && (
        <>
          {/* KPI Cards */}
          <div className="flex flex-wrap gap-3">
            <KpiChip
              label="CPA Promedio (selección)"
              value={fmt(stats.cpa)}
              sub={`Línea roja · Global: ${fmt(avgCpa)}`}
              colorClass="border-red-200/60 dark:border-red-800/40 text-red-500"
              icon={TrendingDown}
            />
            <KpiChip
              label="GPT Promedio (selección)"
              value={fmt(stats.gpt)}
              sub={`Línea verde · Global: ${fmt(avgGpt)}`}
              colorClass="border-emerald-200/60 dark:border-emerald-800/40 text-emerald-500"
              icon={TrendingUp}
            />
            <KpiChip
              label="Scalers"
              value={String(stats.scalers)}
              sub="CPA bajo + GPT alto → escalar"
              colorClass="border-emerald-200/60 dark:border-emerald-800/40 text-emerald-500"
              icon={Target}
            />
            <KpiChip
              label="Liabilities"
              value={String(stats.liabilities)}
              sub="CPA alto + GPT bajo → pausar"
              colorClass="border-red-200/60 dark:border-red-800/40 text-red-500"
              icon={Layers}
            />
          </div>

          {/* Filters + Legend */}
          <div className="flex flex-wrap items-end gap-4 bg-white/70 dark:bg-[#161618]/70 backdrop-blur-md p-4 rounded-[16px] border border-black/[0.04] dark:border-white/[0.04] shadow-sm">

            {/* Campaign selector */}
            <div className="flex-1 min-w-[180px] max-w-[260px]">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                Campaña · {campaigns.length} total
              </label>
              <select
                className="w-full bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-white/10 rounded-[10px] text-[13px] text-zinc-900 dark:text-white px-3 py-2.5 outline-none focus:border-indigo-500 transition-colors cursor-pointer"
                value={selCampaign}
                onChange={e => handleCampaignChange(e.target.value)}
              >
                <option value="All">Todas las campañas</option>
                {campaignOptions.filter(c => c !== 'All').map(c => (
                  <option key={c} value={c}>{c.length > 36 ? c.slice(0, 34) + '…' : c}</option>
                ))}
              </select>
            </div>

            {/* Adset selector */}
            <div className="flex-1 min-w-[180px] max-w-[260px]">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                Conjunto de Anuncios · {adsetOptions.length - 1} disponibles
              </label>
              <select
                className="w-full bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-white/10 rounded-[10px] text-[13px] text-zinc-900 dark:text-white px-3 py-2.5 outline-none focus:border-indigo-500 transition-colors cursor-pointer"
                value={selAdset}
                onChange={e => setSelAdset(e.target.value)}
              >
                <option value="All">Todos los conjuntos</option>
                {adsetOptions.filter(a => a !== 'All').map(a => (
                  <option key={a} value={a}>{a.length > 36 ? a.slice(0, 34) + '…' : a}</option>
                ))}
              </select>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center ml-auto gap-2 text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
              {[
                { label: 'Scalers',     color: 'bg-emerald-500' },
                { label: 'Reliable',    color: 'bg-blue-500' },
                { label: 'Fake Wins',   color: 'bg-yellow-500' },
                { label: 'Liabilities', color: 'bg-red-500' },
              ].map(({ label, color }) => (
                <div key={label} className="flex items-center gap-1.5 bg-white dark:bg-black/30 border border-black/[0.04] dark:border-white/[0.05] px-2.5 py-1.5 rounded-full">
                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${color}`} />
                  {label}
                </div>
              ))}
            </div>
          </div>

          {/* Chart */}
          <div
            className="bg-white/70 dark:bg-[#161618]/70 backdrop-blur-md rounded-[20px] p-5 border border-black/[0.04] dark:border-white/[0.04] shadow-sm"
            style={{ height: 440 }}
          >
            {filteredData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-zinc-400 gap-2">
                <Target className="w-8 h-8 opacity-30" />
                <p className="text-sm">No hay anuncios con gasto en esta selección</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 28, right: 48, bottom: 32, left: 56 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} vertical={false} />

                  <XAxis
                    type="number" dataKey="cpa" name="CPA"
                    axisLine={{ strokeOpacity: 0.08 }} tickLine={false}
                    tick={{ fill: '#71717a', fontSize: 11 }}
                    tickFormatter={v => fmt(v)}
                    label={{ value: '← MEJOR   CPA   PEOR →', position: 'insideBottom', offset: -18, fill: '#71717a', fontSize: 11, fontWeight: 600 }}
                  />
                  <YAxis
                    type="number" dataKey="gpt" name="GPT"
                    axisLine={{ strokeOpacity: 0.08 }} tickLine={false}
                    tick={{ fill: '#71717a', fontSize: 11 }}
                    tickFormatter={v => fmt(v)}
                    label={{ value: 'GPT (Ganancia Bruta)', angle: -90, position: 'insideLeft', offset: -40, fill: '#71717a', fontSize: 11, fontWeight: 600 }}
                  />

                  <Tooltip
                    cursor={{ strokeDasharray: '3 3', stroke: '#71717a', strokeOpacity: 0.4 }}
                    content={({ active, payload }) => {
                      if (active && payload?.length) {
                        const d = payload[0].payload as AdPoint;
                        const color = getColor(d.cpa, d.gpt);
                        const quad =
                          d.cpa <= avgCpa && d.gpt >= avgGpt ? 'Scaler 🚀' :
                          d.cpa >  avgCpa && d.gpt >= avgGpt ? 'Reliable 💙' :
                          d.cpa <= avgCpa && d.gpt <  avgGpt ? 'Fake Win ⚠️' : 'Liability 🔴';
                        return (
                          <div className="bg-white dark:bg-zinc-900 p-4 border border-zinc-100 dark:border-zinc-800 rounded-[12px] shadow-xl min-w-[220px] text-[12px] z-50">
                            <p className="font-bold text-zinc-900 dark:text-white mb-1 text-[13px] leading-snug">{d.ad_name}</p>
                            <p className="text-[11px] font-semibold mb-2" style={{ color }}>{quad}</p>
                            <div className="space-y-1 text-zinc-500 dark:text-zinc-400">
                              <div className="flex justify-between gap-4"><span>Campaña</span><span className="font-medium text-zinc-700 dark:text-zinc-300 text-right max-w-[130px] truncate">{d.campaign}</span></div>
                              <div className="flex justify-between gap-4"><span>Conjunto</span><span className="font-medium text-zinc-700 dark:text-zinc-300 text-right max-w-[130px] truncate">{d.adset}</span></div>
                              <div className="border-t border-zinc-100 dark:border-zinc-800 pt-1 mt-1 space-y-1">
                                <div className="flex justify-between"><span>CPA</span><span className="font-bold text-red-500">{fmt(d.cpa)}</span></div>
                                <div className="flex justify-between"><span>GPT</span><span className="font-bold text-emerald-500">{fmt(d.gpt)}</span></div>
                                <div className="flex justify-between"><span>Gasto</span><span className="font-semibold text-zinc-800 dark:text-zinc-200">{fmt(d.spend)}</span></div>
                                {d.results > 0 && <div className="flex justify-between"><span>Conversiones</span><span className="font-semibold text-zinc-800 dark:text-zinc-200">{d.results}</span></div>}
                                {d.roas > 0 && <div className="flex justify-between"><span>ROAS</span><span className="font-semibold text-blue-500">{d.roas.toFixed(2)}x</span></div>}
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />

                  <ReferenceLine
                    x={avgCpa}
                    stroke="#ef4444" strokeWidth={1.5} strokeDasharray="5 4" strokeOpacity={0.7}
                    label={{ position: 'top', value: `CPA Prom. ${fmt(avgCpa)}`, fill: '#ef4444', fontSize: 10, fontWeight: 700 }}
                  />
                  <ReferenceLine
                    y={avgGpt}
                    stroke="#10b981" strokeWidth={1.5} strokeDasharray="5 4" strokeOpacity={0.7}
                    label={{ position: 'right', value: `GPT Prom. ${fmt(avgGpt)}`, fill: '#10b981', fontSize: 10, fontWeight: 700 }}
                  />

                  <Scatter name="Anuncios" data={filteredData} r={9}>
                    {filteredData.map((entry, i) => (
                      <Cell
                        key={`cell-${i}`}
                        fill={getColor(entry.cpa, entry.gpt)}
                        stroke={getColor(entry.cpa, entry.gpt)}
                        strokeWidth={2}
                        fillOpacity={0.85}
                      />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Quadrant summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Scalers',     desc: 'CPA bajo · GPT alto',  action: 'Escalar presupuesto', bg: 'bg-emerald-50 dark:bg-emerald-900/10', border: 'border-emerald-200/60', text: 'text-emerald-700 dark:text-emerald-400', count: filteredData.filter(d => d.cpa <= avgCpa && d.gpt >= avgGpt).length },
              { label: 'Reliable',    desc: 'CPA alto · GPT alto',  action: 'Optimizar CPA',       bg: 'bg-blue-50 dark:bg-blue-900/10',     border: 'border-blue-200/60',     text: 'text-blue-700 dark:text-blue-400',     count: filteredData.filter(d => d.cpa >  avgCpa && d.gpt >= avgGpt).length },
              { label: 'Fake Wins',   desc: 'CPA bajo · GPT bajo',  action: 'Revisar oferta',      bg: 'bg-yellow-50 dark:bg-yellow-900/10', border: 'border-yellow-200/60',   text: 'text-yellow-700 dark:text-yellow-400', count: filteredData.filter(d => d.cpa <= avgCpa && d.gpt <  avgGpt).length },
              { label: 'Liabilities', desc: 'CPA alto · GPT bajo',  action: 'Pausar / cortar',     bg: 'bg-red-50 dark:bg-red-900/10',       border: 'border-red-200/60',       text: 'text-red-700 dark:text-red-400',       count: filteredData.filter(d => d.cpa >  avgCpa && d.gpt <  avgGpt).length },
            ].map(q => (
              <div key={q.label} className={`${q.bg} ${q.border} border rounded-[14px] p-4`}>
                <div className="flex items-baseline justify-between mb-1">
                  <p className={`text-[12px] font-bold ${q.text}`}>{q.label}</p>
                  <span className={`text-[22px] font-black ${q.text}`}>{q.count}</span>
                </div>
                <p className="text-[10px] text-zinc-500">{q.desc}</p>
                <p className={`text-[10px] font-semibold mt-1.5 ${q.text}`}>{q.action}</p>
              </div>
            ))}
          </div>

          {/* Ads table */}
          {filteredData.length > 0 && (
            <div className="bg-white/70 dark:bg-[#161618]/70 backdrop-blur-md rounded-[16px] border border-black/[0.04] dark:border-white/[0.04] shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-zinc-100 dark:border-zinc-800">
                <p className="text-[12px] font-bold text-zinc-700 dark:text-zinc-300">Detalle de Anuncios</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-400">
                      <th className="text-left px-5 py-2.5 font-semibold">Anuncio</th>
                      <th className="text-left px-3 py-2.5 font-semibold hidden md:table-cell">Conjunto</th>
                      <th className="text-right px-3 py-2.5 font-semibold">Gasto</th>
                      <th className="text-right px-3 py-2.5 font-semibold">CPA</th>
                      <th className="text-right px-3 py-2.5 font-semibold">GPT</th>
                      <th className="text-right px-3 py-2.5 font-semibold hidden md:table-cell">Conv.</th>
                      <th className="text-center px-3 py-2.5 font-semibold">Cuadrante</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...filteredData]
                      .sort((a, b) => b.gpt - a.gpt)
                      .map((d, i) => {
                        const color = getColor(d.cpa, d.gpt);
                        const quad =
                          d.cpa <= avgCpa && d.gpt >= avgGpt ? 'Scaler' :
                          d.cpa >  avgCpa && d.gpt >= avgGpt ? 'Reliable' :
                          d.cpa <= avgCpa && d.gpt <  avgGpt ? 'Fake Win' : 'Liability';
                        return (
                          <tr key={d.ad_id} className={`border-b border-zinc-50 dark:border-zinc-800/50 hover:bg-zinc-50/50 dark:hover:bg-white/[0.02] transition-colors ${i % 2 === 0 ? '' : 'bg-zinc-50/30 dark:bg-white/[0.01]'}`}>
                            <td className="px-5 py-2.5 font-medium text-zinc-800 dark:text-zinc-200 max-w-[200px]">
                              <p className="truncate">{d.ad_name}</p>
                              <p className="text-[10px] text-zinc-400 truncate md:hidden">{d.adset}</p>
                            </td>
                            <td className="px-3 py-2.5 hidden md:table-cell text-zinc-500 dark:text-zinc-400 max-w-[150px]">
                              <p className="truncate">{d.adset}</p>
                            </td>
                            <td className="px-3 py-2.5 text-right text-zinc-700 dark:text-zinc-300 font-medium">{fmt(d.spend)}</td>
                            <td className="px-3 py-2.5 text-right font-bold text-red-500">{fmt(d.cpa)}</td>
                            <td className="px-3 py-2.5 text-right font-bold text-emerald-500">{fmt(d.gpt)}</td>
                            <td className="px-3 py-2.5 text-right text-zinc-600 dark:text-zinc-400 hidden md:table-cell">{d.results || '—'}</td>
                            <td className="px-3 py-2.5 text-center">
                              <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: color + '20', color }}>
                                {quad}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {/* DisconIA Analysis Button */}
          <div className="flex justify-center pt-1">
            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing || filteredData.length === 0}
              className="flex items-center gap-2 px-5 py-2.5 rounded-[12px] bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white text-[13px] font-bold shadow-md disabled:opacity-40 transition-all active:scale-[0.98]"
            >
              <Sparkles className={`w-4 h-4 ${isAnalyzing ? 'animate-pulse' : ''}`} />
              {isAnalyzing ? 'Analizando ecosistema…' : 'DisconIA: Auditoría Profunda'}
            </button>
          </div>

          {/* AI Analysis Panel */}
          {(isAnalyzing || aiAnalysis) && (
            <div className="rounded-[16px] border border-violet-200/60 dark:border-violet-800/40 bg-gradient-to-br from-violet-50/80 to-purple-50/50 dark:from-violet-950/30 dark:to-purple-950/20 overflow-hidden">
              {/* Panel header */}
              <button
                onClick={() => setAiExpanded(v => !v)}
                className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-violet-100/40 dark:hover:bg-violet-900/20 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-[8px] bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center">
                    <Sparkles className="w-3.5 h-3.5 text-white" />
                  </div>
                  <span className="text-[13px] font-bold text-violet-800 dark:text-violet-300">DisconIA — Auditoría del Ecosistema</span>
                  {isAnalyzing && <span className="text-[11px] text-violet-500 font-medium animate-pulse">pensando…</span>}
                </div>
                {aiExpanded
                  ? <ChevronUp className="w-4 h-4 text-violet-400" />
                  : <ChevronDown className="w-4 h-4 text-violet-400" />}
              </button>

              {/* Panel body */}
              {aiExpanded && (
                <div className="px-5 pb-5">
                  {isAnalyzing ? (
                    <div className="flex items-center gap-2 text-violet-500 py-4">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-[12px]">Aplicando metodología Andromeda…</span>
                    </div>
                  ) : aiAnalysis ? (
                    <div className="text-[13px] text-zinc-700 dark:text-zinc-300 leading-relaxed space-y-1">
                      {aiAnalysis.split('\n').map((line, i) => {
                        if (line.startsWith('## ')) {
                          return <h3 key={i} className="text-[14px] font-bold text-violet-800 dark:text-violet-300 mt-4 mb-1 first:mt-0">{line.replace('## ', '')}</h3>;
                        }
                        if (line.trim() === '') return <div key={i} className="h-1" />;
                        // Render **bold**
                        const parts = line.split(/\*\*(.+?)\*\*/g);
                        return (
                          <p key={i}>
                            {parts.map((part, j) =>
                              j % 2 === 1
                                ? <strong key={j} className="font-semibold text-zinc-900 dark:text-white">{part}</strong>
                                : part
                            )}
                          </p>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
