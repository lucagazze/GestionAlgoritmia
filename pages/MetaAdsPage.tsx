
import React, { useEffect, useState, useCallback } from 'react';
import { metaAds, META_AD_ACCOUNT, INSTAGRAM_ACCOUNTS } from '../services/metaAds';
import { Card } from '../components/UIComponents';
import {
  TrendingUp, TrendingDown, Activity, DollarSign, Eye, MousePointer,
  Zap, RefreshCw, Play, Pause, CheckCircle2, AlertCircle, Instagram,
  BarChart3, Target, Users, Loader2, ChevronDown, ChevronUp
} from 'lucide-react';

// ── Helpers ────────────────────────────────────────────────────────────
const fmt = (v: any, prefix = '$') => {
  const n = parseFloat(v);
  if (isNaN(n)) return '—';
  return `${prefix}${n.toFixed(2)}`;
};
const fmtK = (v: any) => {
  const n = parseInt(v);
  if (isNaN(n)) return '—';
  return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);
};
const statusColor = (s: string) => {
  if (s === 'ACTIVE') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
  if (s === 'PAUSED') return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300';
  return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
};
const statusIcon = (s: string) =>
  s === 'ACTIVE' ? <Play className="w-3 h-3" /> : s === 'PAUSED' ? <Pause className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />;

// ── Metric Card ────────────────────────────────────────────────────────
const MetricCard = ({ label, value, sub, icon: Icon, color = 'indigo' }: any) => {
  const colors: Record<string, string> = {
    indigo: 'from-indigo-500 to-indigo-600',
    emerald: 'from-emerald-500 to-emerald-600',
    amber: 'from-amber-500 to-amber-600',
    rose: 'from-rose-500 to-rose-600',
    blue: 'from-blue-500 to-blue-600',
    purple: 'from-purple-500 to-purple-600',
  };
  return (
    <Card className="p-5 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${colors[color]} flex items-center justify-center flex-shrink-0 shadow-lg`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider truncate">{label}</p>
        <p className="text-xl font-black text-gray-900 dark:text-white leading-tight">{value}</p>
        {sub && <p className="text-xs text-gray-500 mt-0.5 truncate">{sub}</p>}
      </div>
    </Card>
  );
};

// ── Campaign Row ───────────────────────────────────────────────────────
const CampaignRow = ({ campaign }: { campaign: any }) => {
  const [insights, setInsights] = useState<any>(null);
  const [expanded, setExpanded] = useState(false);
  const [adsets, setAdsets] = useState<any[]>([]);
  const [loadingAdsets, setLoadingAdsets] = useState(false);

  useEffect(() => {
    metaAds.getInsights(campaign.id).then(setInsights);
  }, [campaign.id]);

  const loadAdsets = async () => {
    if (adsets.length > 0) { setExpanded(e => !e); return; }
    setLoadingAdsets(true);
    const res = await metaAds.getAdsets(campaign.id);
    const adsetsData = res.data || [];
    const adsetsWithInsights = await Promise.all(
      adsetsData.map(async (a: any) => ({ ...a, insights: await metaAds.getInsights(a.id) }))
    );
    setAdsets(adsetsWithInsights);
    setExpanded(true);
    setLoadingAdsets(false);
  };

  const db = campaign.daily_budget ? `$${(parseInt(campaign.daily_budget) / 100).toFixed(2)}/día` :
    campaign.lifetime_budget ? `$${(parseInt(campaign.lifetime_budget) / 100).toFixed(2)} total` : '—';

  return (
    <div className="border border-gray-100 dark:border-slate-800 rounded-xl overflow-hidden mb-3 bg-white dark:bg-slate-900">
      <div className="p-4 flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${statusColor(campaign.status)}`}>
            {statusIcon(campaign.status)} {campaign.status}
          </span>
          <div className="min-w-0">
            <p className="font-bold text-gray-900 dark:text-white text-sm truncate">{campaign.name}</p>
            <p className="text-xs text-gray-500">{campaign.objective} · {db}</p>
          </div>
        </div>
        {insights ? (
          <div className="flex gap-4 text-right flex-shrink-0">
            <div><p className="text-xs text-gray-400">Gasto</p><p className="font-bold text-gray-900 dark:text-white text-sm">{fmt(insights.spend)}</p></div>
            <div><p className="text-xs text-gray-400">Alcance</p><p className="font-bold text-gray-900 dark:text-white text-sm">{fmtK(insights.reach)}</p></div>
            <div><p className="text-xs text-gray-400">CPM</p><p className="font-bold text-gray-900 dark:text-white text-sm">{fmt(insights.cpm)}</p></div>
            <div><p className="text-xs text-gray-400">CTR</p><p className="font-bold text-gray-900 dark:text-white text-sm">{parseFloat(insights.ctr || 0).toFixed(2)}%</p></div>
            <div><p className="text-xs text-gray-400">CPC</p><p className="font-bold text-gray-900 dark:text-white text-sm">{fmt(insights.cpc)}</p></div>
          </div>
        ) : (
          <div className="flex-shrink-0"><Loader2 className="w-4 h-4 animate-spin text-gray-400" /></div>
        )}
        <button onClick={loadAdsets} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors flex-shrink-0">
          {loadingAdsets ? <Loader2 className="w-4 h-4 animate-spin text-gray-400" /> :
           expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>
      </div>

      {/* Adsets expandibles */}
      {expanded && adsets.length > 0 && (
        <div className="border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/30 divide-y divide-gray-100 dark:divide-slate-800">
          {adsets.map((a: any) => (
            <div key={a.id} className="px-6 py-3 flex flex-col md:flex-row md:items-center gap-2">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${statusColor(a.status)}`}>
                  {a.status}
                </span>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{a.name}</p>
                <p className="text-xs text-gray-400 flex-shrink-0">{a.optimization_goal}</p>
              </div>
              {a.insights && (
                <div className="flex gap-4 text-right text-xs flex-shrink-0">
                  <div><span className="text-gray-400">Gasto </span><span className="font-bold text-gray-700 dark:text-gray-300">{fmt(a.insights.spend)}</span></div>
                  <div><span className="text-gray-400">CPM </span><span className="font-bold text-gray-700 dark:text-gray-300">{fmt(a.insights.cpm)}</span></div>
                  <div><span className="text-gray-400">CTR </span><span className="font-bold text-gray-700 dark:text-gray-300">{parseFloat(a.insights?.ctr || 0).toFixed(2)}%</span></div>
                  <div><span className="text-gray-400">Clics </span><span className="font-bold text-gray-700 dark:text-gray-300">{fmtK(a.insights.clicks)}</span></div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Instagram Panel ────────────────────────────────────────────────────
const InstagramPanel = ({ igId, username }: { igId: string; username: string }) => {
  const [profile, setProfile] = useState<any>(null);
  const [media, setMedia] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      metaAds.getInstagramProfile(igId),
      metaAds.getInstagramMedia(igId, 9),
    ]).then(([p, m]) => {
      setProfile(p);
      setMedia(m.data || []);
    });
  }, [igId]);

  if (!profile) return <div className="flex justify-center py-8"><Loader2 className="animate-spin text-gray-400 w-6 h-6" /></div>;
  if (profile.error) return <div className="text-sm text-red-500 p-4">No se pudo cargar el perfil de @{username}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 p-4 bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-800">
        {profile.profile_picture_url && (
          <img src={profile.profile_picture_url} alt={username} className="w-14 h-14 rounded-full object-cover border-2 border-indigo-200" />
        )}
        <div className="flex-1">
          <p className="font-bold text-gray-900 dark:text-white">@{profile.username}</p>
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{profile.biography}</p>
        </div>
        <div className="flex gap-6 text-center flex-shrink-0">
          <div><p className="text-lg font-black text-gray-900 dark:text-white">{(profile.followers_count || 0).toLocaleString()}</p><p className="text-xs text-gray-500">seguidores</p></div>
          <div><p className="text-lg font-black text-gray-900 dark:text-white">{profile.media_count || 0}</p><p className="text-xs text-gray-500">posts</p></div>
          <div><p className="text-lg font-black text-gray-900 dark:text-white">{profile.follows_count || 0}</p><p className="text-xs text-gray-500">siguiendo</p></div>
        </div>
      </div>

      {media.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {media.map((m: any) => (
            <a key={m.id} href={m.permalink} target="_blank" rel="noreferrer"
              className="aspect-square bg-gray-100 dark:bg-slate-800 rounded-lg overflow-hidden relative group block">
              {(m.media_url || m.thumbnail_url) && (
                <img src={m.media_url || m.thumbnail_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
              )}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 text-white text-xs font-bold">
                {m.like_count > 0 && <span>❤️ {m.like_count}</span>}
                {m.comments_count > 0 && <span>💬 {m.comments_count}</span>}
              </div>
            </a>
          ))}
        </div>
      )}

      {media.length === 0 && (
        <div className="text-center py-6 text-gray-400 text-sm">Sin publicaciones recientes</div>
      )}
    </div>
  );
};

// ── Main Page ──────────────────────────────────────────────────────────
export default function MetaAdsPage() {
  const [account, setAccount] = useState<any>(null);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [accountInsights, setAccountInsights] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'CAMPAIGNS' | 'INSTAGRAM'>('CAMPAIGNS');
  const [campaignFilter, setCampaignFilter] = useState<'ALL' | 'ACTIVE' | 'PAUSED'>('ALL');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [acct, camps, ins] = await Promise.all([
      metaAds.getAccount(),
      metaAds.getCampaigns(),
      metaAds.getInsights(META_AD_ACCOUNT, 'spend,impressions,reach,clicks,cpm,cpc,ctr,frequency,actions'),
    ]);
    setAccount(acct);
    setCampaigns(camps.data || []);
    setAccountInsights(ins);
    setLastUpdated(new Date());
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filteredCampaigns = campaigns.filter(c =>
    campaignFilter === 'ALL' ? true :
    campaignFilter === 'ACTIVE' ? c.status === 'ACTIVE' :
    c.status === 'PAUSED'
  );

  const activeCampaigns = campaigns.filter(c => c.status === 'ACTIVE').length;
  const pausedCampaigns = campaigns.filter(c => c.status === 'PAUSED').length;

  // Extract link clicks from actions
  const linkClicks = accountInsights?.actions?.find((a: any) => a.action_type === 'link_click')?.value || '—';
  const leads = accountInsights?.actions?.find((a: any) => a.action_type === 'lead')?.value || '0';

  return (
    <div className="space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg">
              <Target className="w-5 h-5 text-white" />
            </div>
            Meta Ads
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {account?.name || '...'} · Solo lectura
            {lastUpdated && <span className="ml-2 text-xs">· Actualizado {lastUpdated.toLocaleTimeString()}</span>}
          </p>
        </div>
        <button onClick={loadData} className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors shadow-sm">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Actualizar
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-indigo-500 w-8 h-8" /></div>
      ) : (
        <>
          {/* Account Metrics (últimos 30 días) */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <MetricCard label="Gasto Total" value={fmt(accountInsights?.spend)} sub="Últimos 30 días" icon={DollarSign} color="rose" />
            <MetricCard label="Impresiones" value={fmtK(accountInsights?.impressions)} sub={`CPM: ${fmt(accountInsights?.cpm)}`} icon={Eye} color="indigo" />
            <MetricCard label="Alcance" value={fmtK(accountInsights?.reach)} sub={`Frecuencia: ${parseFloat(accountInsights?.frequency || 0).toFixed(2)}x`} icon={Users} color="blue" />
            <MetricCard label="CTR" value={`${parseFloat(accountInsights?.ctr || 0).toFixed(2)}%`} sub={`CPC: ${fmt(accountInsights?.cpc)}`} icon={MousePointer} color="emerald" />
            <MetricCard label="Leads" value={leads} sub={`Link Clicks: ${fmtK(linkClicks)}`} icon={Zap} color="amber" />
          </div>

          {/* Account Status Cards */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="p-4 text-center">
              <p className="text-3xl font-black text-emerald-600">{activeCampaigns}</p>
              <p className="text-xs font-bold text-gray-500 mt-1 uppercase tracking-wider">Campañas Activas</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-3xl font-black text-yellow-500">{pausedCampaigns}</p>
              <p className="text-xs font-bold text-gray-500 mt-1 uppercase tracking-wider">Campañas Pausadas</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-3xl font-black text-gray-700 dark:text-gray-200">{campaigns.length}</p>
              <p className="text-xs font-bold text-gray-500 mt-1 uppercase tracking-wider">Total Campañas</p>
            </Card>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 bg-gray-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
            {[
              { id: 'CAMPAIGNS', label: 'Campañas', icon: BarChart3 },
              { id: 'INSTAGRAM', label: 'Instagram Algoritmia', icon: Activity },
            ].map(t => {
              const Icon = t.icon;
              return (
                <button key={t.id} onClick={() => setTab(t.id as any)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                    tab === t.id ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}>
                  <Icon className="w-4 h-4" /> {t.label}
                </button>
              );
            })}
          </div>

          {/* CAMPAIGNS TAB */}
          {tab === 'CAMPAIGNS' && (
            <div className="space-y-4">
              {/* Filter */}
              <div className="flex gap-2">
                {(['ALL', 'ACTIVE', 'PAUSED'] as const).map(f => (
                  <button key={f} onClick={() => setCampaignFilter(f)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      campaignFilter === f ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50'
                    }`}>
                    {f === 'ALL' ? 'Todas' : f === 'ACTIVE' ? 'Activas' : 'Pausadas'}
                  </button>
                ))}
              </div>

              {filteredCampaigns.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  <Activity className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No hay campañas {campaignFilter !== 'ALL' ? `con estado "${campaignFilter}"` : ''}</p>
                </div>
              )}

              {filteredCampaigns.map(c => <CampaignRow key={c.id} campaign={c} />)}

              <p className="text-xs text-gray-400 text-center mt-4">
                Clic en una campaña para ver sus conjuntos de anuncios · Métricas últimos 30 días
              </p>
            </div>
          )}

          {/* INSTAGRAM TAB */}
          {tab === 'INSTAGRAM' && (
            <InstagramPanel
              igId={INSTAGRAM_ACCOUNTS.algoritmia.igId}
              username={INSTAGRAM_ACCOUNTS.algoritmia.username}
            />
          )}
        </>
      )}
    </div>
  );
}
