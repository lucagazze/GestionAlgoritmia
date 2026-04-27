import React, { useState, useEffect, useRef } from 'react';
import {
  Target, RefreshCw, Zap, TrendingUp, ChevronDown, ChevronUp,
  Lightbulb, Plus, Trash2, Edit2, Package, CheckCircle2, AlertCircle,
  XCircle, Upload, Search, BarChart2, ShoppingBag, Users,
  Wifi, Loader2, ChevronRight, ArrowRight, Info, Download,
} from 'lucide-react';
import { Modal, Button } from '../components/UIComponents';
import { META_AD_ACCOUNT } from '../services/metaAds';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CrossSellItem { name: string; count: number; pct: number; }

interface Product {
  id: string;
  name: string;
  entryPointPct: number;
  secondPurchasePct: number;
  repurchaseDays: number;
  salePrice: number;
  productionCost: number;
  metaCPA: number;
  totalOrders?: number;
  fromCSV?: boolean;
  crossSell?: CrossSellItem[];
  firstPurchases?: number;
  combinedAOV?: number;
}

interface MetaCampaign {
  id: string; name: string; status: string;
  cpa: number; spend: number; purchases: number;
}

type MetaPeriod = 'last_7d' | 'last_14d' | 'last_30d';

// ─── CSV Parsing ──────────────────────────────────────────────────────────────

function parseCSVText(text: string): string[][] {
  const firstLine = text.split('\n')[0] || '';
  const separator = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], n = text[i + 1];
    if (c === '"') { if (inQ && n === '"') { field += '"'; i++; } else inQ = !inQ; }
    else if (c === separator && !inQ) { row.push(field); field = ''; }
    else if ((c === '\n' || c === '\r') && !inQ) {
      if (c === '\r' && n === '\n') i++;
      row.push(field); field = '';
      if (row.some(f => f !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field || row.length) { row.push(field); if (row.some(f => f !== '')) rows.push(row); }
  return rows;
}

interface RawOrder {
  name: string; email: string; date: Date; status: string;
  items: { productName: string; price: number; qty: number }[];
}

function buildOrders(rows: string[][]): RawOrder[] {
  if (rows.length < 2) return [];
  const h = rows[0];
  const findIdx = (tests: RegExp[]) => h.findIndex(col => tests.some(regex => regex.test(col)));

  const iN = findIdx([/^name$/i, /orden/i]);
  const iE = findIdx([/^email$/i]);
  const iSt = findIdx([/^financial status$/i, /estado del pago/i]);
  const iD = findIdx([/^created at$/i, /^fecha$/i]);
  const iQ = findIdx([/^lineitem quantity$/i, /cantidad del producto/i]);
  const iIN = findIdx([/^lineitem name$/i, /nombre del producto/i]);
  const iIP = findIdx([/^lineitem price$/i, /precio del producto/i]);

  const map = new Map<string, RawOrder>();
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const name = r[iN]?.trim(); if (!name) continue;
    const email = r[iE]?.trim().toLowerCase();
    
    let status = r[iSt]?.trim().toLowerCase() || '';
    if (status === 'recibido' || status === 'paid') status = 'paid';
    
    const dateStr = r[iD]?.trim();
    const itemName = r[iIN]?.trim();
    const price = parseFloat((r[iIP] || '0').replace(',', '.')) || 0;
    const qty = parseInt(r[iQ]) || 1;
    
    if (!map.has(name)) {
      let d = new Date(0);
      if (dateStr) {
        const tnMatch = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}):(\d{2}))?/);
        if (tnMatch) {
          d = new Date(parseInt(tnMatch[3]), parseInt(tnMatch[2]) - 1, parseInt(tnMatch[1]), parseInt(tnMatch[4]||'0'), parseInt(tnMatch[5]||'0'), parseInt(tnMatch[6]||'0'));
        } else {
          d = new Date(dateStr);
        }
      }
      map.set(name, { name, email: email || '', date: d, status, items: [] });
    } else if (status) {
      map.get(name)!.status = status;
    }
    
    if (itemName) map.get(name)!.items.push({ productName: itemName, price, qty });
  }
  return [...map.values()];
}

function getDateRangeDays(orders: RawOrder[]): number {
  const times = orders.filter(o => o.date.getTime() > 0).map(o => o.date.getTime());
  if (times.length < 2) return 0;
  return Math.round((Math.max(...times) - Math.min(...times)) / 86_400_000);
}

function analyzeFromOrders(orders: RawOrder[], existing: Product[]): Product[] {
  const paid = orders.filter(o => o.status === 'paid' && o.email && o.items.length > 0);
  const byCustomer = new Map<string, RawOrder[]>();
  for (const o of paid) {
    if (!byCustomer.has(o.email)) byCustomer.set(o.email, []);
    byCustomer.get(o.email)!.push(o);
  }
  for (const [, list] of byCustomer) list.sort((a, b) => a.date.getTime() - b.date.getTime());

  const productNames = new Set<string>();
  for (const o of paid) for (const it of o.items) productNames.add(it.productName);

  const results: Product[] = [];

  for (const pName of productNames) {
    const ordersWithP = paid.filter(o => o.items.some(it => it.productName === pName));
    if (ordersWithP.length === 0) continue;

    // F1 — Entry Point: orders containing P where it's that customer's FIRST order
    const firstOrdersWithP = ordersWithP.filter(o => byCustomer.get(o.email)?.[0]?.name === o.name);
    const entryPointPct = Math.round((firstOrdersWithP.length / ordersWithP.length) * 100);

    // F2 — Second Purchase Rate
    const customersFirstP = [...new Set(firstOrdersWithP.map(o => o.email))];
    const customersReturned = customersFirstP.filter(e => (byCustomer.get(e)?.length ?? 0) >= 2);
    const secondPurchasePct = customersFirstP.length > 0
      ? Math.round((customersReturned.length / customersFirstP.length) * 100) : 0;

    // F3 — Repurchase Days
    let repurchaseDays = 0;
    if (customersReturned.length > 0) {
      const gaps = customersReturned.map(e => {
        const list = byCustomer.get(e)!;
        return (list[1].date.getTime() - list[0].date.getTime()) / 86_400_000;
      }).filter(d => d >= 0);
      if (gaps.length > 0) repurchaseDays = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
    }

    // Cross-sell: what do customers buy in their 2nd+ orders after buying P first?
    const crossSellCounts = new Map<string, number>();
    for (const email of customersFirstP) {
      const allOrds = byCustomer.get(email) || [];
      for (let i = 1; i < allOrds.length; i++) {
        for (const it of allOrds[i].items) {
          if (it.productName !== pName)
            crossSellCounts.set(it.productName, (crossSellCounts.get(it.productName) || 0) + 1);
        }
      }
    }
    const crossSell: CrossSellItem[] = [...crossSellCounts.entries()]
      .sort((a, b) => b[1] - a[1]).slice(0, 2)
      .map(([name, count]) => ({ name, count, pct: Math.round(count / Math.max(customersFirstP.length, 1) * 100) }));

    // avgPrice: promedio real del precio unitario del producto en todas las órdenes donde aparece
    const allItemPrices = ordersWithP.flatMap(o => o.items.filter(it => it.productName === pName).map(it => it.price));
    const avgPrice = allItemPrices.length > 0 ? allItemPrices.reduce((a, b) => a + b, 0) / allItemPrices.length : 0;
    // combinedAOV: promedio del gasto TOTAL de las órdenes que incluyen este producto (incluye items companion)
    const combinedAOV = ordersWithP.reduce((s, o) => s + o.items.reduce((ss, it) => ss + it.price * it.qty, 0), 0) / Math.max(ordersWithP.length, 1);
    const ex = existing.find(p => p.name === pName);

    results.push({
      id: ex?.id ?? crypto.randomUUID(),
      name: pName,
      entryPointPct,
      secondPurchasePct,
      repurchaseDays,
      salePrice: avgPrice,
      productionCost: ex?.productionCost ?? 0,
      metaCPA: ex?.metaCPA ?? 0,
      totalOrders: ordersWithP.length,
      fromCSV: true,
      crossSell,
      firstPurchases: firstOrdersWithP.length,
      combinedAOV,
    });
  }

  results.sort((a, b) => (b.totalOrders ?? 0) - (a.totalOrders ?? 0));
  return results;
}

// ─── Meta API ─────────────────────────────────────────────────────────────────

async function fetchMetaCampaignCPAs(period: MetaPeriod): Promise<MetaCampaign[]> {
  const token = localStorage.getItem('meta_ads_token') || '';
  if (!token) throw new Error('Token de Meta no encontrado. Configuralo en Ajustes.');
  const url = new URL(`https://graph.facebook.com/v21.0/${META_AD_ACCOUNT}/campaigns`);
  url.searchParams.set('fields', `name,status,insights.date_preset(${period}){spend,cost_per_action_type,actions}`);
  url.searchParams.set('limit', '200');
  url.searchParams.set('access_token', token);
  const res = await fetch(url.toString());
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  const PTYPES = ['purchase', 'offsite_conversion.fb_pixel_purchase'];
  return (json.data || []).map((c: any) => {
    const ins = c.insights?.data?.[0];
    const cpaEntry = ins?.cost_per_action_type?.find((a: any) => PTYPES.includes(a.action_type));
    const pEntry = ins?.actions?.find((a: any) => PTYPES.includes(a.action_type));
    return { id: c.id, name: c.name, status: c.status, cpa: cpaEntry ? parseFloat(cpaEntry.value) : 0, spend: ins ? parseFloat(ins.spend || '0') : 0, purchases: pEntry ? parseInt(pEntry.value) : 0 };
  }).sort((a: MetaCampaign, b: MetaCampaign) => b.purchases - a.purchases);
}

function bestMatchCampaign(productName: string, campaigns: MetaCampaign[]): string {
  const pWords = productName.toLowerCase().split(/[\s\-\/,()#]+/).filter(w => w.length > 3);
  let best = { id: '', score: 0 };
  for (const c of campaigns) {
    const cWords = c.name.toLowerCase().split(/[\s\-\/,()#]+/);
    const score = pWords.filter(pw => cWords.some(cw => cw.includes(pw) || pw.includes(cw))).length;
    if (score > best.score) best = { id: c.id, score };
  }
  return best.id;
}

// ─── Scoring ─────────────────────────────────────────────────────────────────

type Score = 'pass' | 'warn' | 'fail' | 'pending';
const scoreEP  = (v: number): Score => v >= 50 ? 'pass' : v >= 25 ? 'warn' : 'fail';
const scoreSP  = (v: number): Score => v >= 40 ? 'pass' : v >= 20 ? 'warn' : 'fail';
const scoreRD  = (v: number): Score => v === 0 ? 'fail' : v <= 15 ? 'pass' : v <= 45 ? 'warn' : 'fail';
const scoreGPT = (p: Product): Score => {
  if (p.productionCost === 0 && p.metaCPA === 0) return 'pending';
  return gptVal(p) > 0 ? 'pass' : 'fail';
};
const gptVal   = (p: Product) => p.salePrice - p.productionCost - p.metaCPA;
const totalScore = (p: Product) =>
  [scoreEP(p.entryPointPct), scoreSP(p.secondPurchasePct), scoreRD(p.repurchaseDays), scoreGPT(p)].filter(s => s === 'pass').length;

// ─── UI Helpers ───────────────────────────────────────────────────────────────

const ScoreBadge: React.FC<{ score: Score; label: string }> = ({ score, label }) => {
  const cls = { pass: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300', warn: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300', fail: 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400' }[score];
  const Icon = score === 'pass' ? CheckCircle2 : score === 'warn' ? AlertCircle : XCircle;
  return <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${cls}`}><Icon className="w-3 h-3" />{label}</span>;
};

const TotalBadge: React.FC<{ score: number }> = ({ score }) => {
  const map: Record<number, { label: string; cls: string }> = {
    4: { label: 'Héroe',     cls: 'bg-emerald-500 text-white shadow-[0_2px_8px_rgba(16,185,129,0.35)]' },
    3: { label: 'Candidato', cls: 'bg-blue-500 text-white shadow-[0_2px_8px_rgba(59,130,246,0.35)]' },
    2: { label: 'Potencial', cls: 'bg-amber-500 text-white' },
    1: { label: 'Débil',     cls: 'bg-zinc-400 dark:bg-zinc-600 text-white' },
    0: { label: 'Descartar', cls: 'bg-red-500 text-white' },
  };
  const { label, cls } = map[score] ?? map[0];
  return <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${cls}`}>{score}/4 · {label}</span>;
};

const NumInput: React.FC<{ value: number; onChange: (v: number) => void; suffix?: string }> = ({ value, onChange, suffix }) => (
  <div className="relative">
    <input type="number" value={value === 0 ? '' : value} placeholder="0" onChange={e => onChange(parseFloat(e.target.value) || 0)}
      className="w-full h-9 px-3 pr-7 rounded-[8px] border border-zinc-200 dark:border-white/[0.08] bg-zinc-50 dark:bg-white/[0.04] text-[13px] text-zinc-900 dark:text-white outline-none focus:border-zinc-400 dark:focus:border-white/20 transition-colors" />
    {suffix && <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-medium text-zinc-400 dark:text-zinc-600 pointer-events-none">{suffix}</span>}
  </div>
);

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'hero-products-v3';
const EMPTY_FORM: Omit<Product, 'id'> = { name: '', entryPointPct: 0, secondPurchasePct: 0, repurchaseDays: 0, salePrice: 0, productionCost: 0, metaCPA: 0 };

const colorMap: Record<string, { bg: string; text: string; border: string; badge: string; icon: string; dot: string }> = {
  amber:  { bg: 'bg-amber-50 dark:bg-amber-950/30',    text: 'text-amber-700 dark:text-amber-400',   border: 'border-amber-200 dark:border-amber-800/50',   badge: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',   icon: 'text-amber-500',  dot: 'bg-amber-500'  },
  emerald:{ bg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-700 dark:text-emerald-400',border: 'border-emerald-200 dark:border-emerald-800/50',badge: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',icon: 'text-emerald-500',dot: 'bg-emerald-500' },
  blue:   { bg: 'bg-blue-50 dark:bg-blue-950/30',      text: 'text-blue-700 dark:text-blue-400',     border: 'border-blue-200 dark:border-blue-800/50',     badge: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',     icon: 'text-blue-500',   dot: 'bg-blue-500'   },
  violet: { bg: 'bg-violet-50 dark:bg-violet-950/30',  text: 'text-violet-700 dark:text-violet-400', border: 'border-violet-200 dark:border-violet-800/50', badge: 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300',icon: 'text-violet-500', dot: 'bg-violet-500' },
};

const pillars = [
  { number: '01', icon: Target,     color: 'amber',   title: 'El Filtro del Entry Point', subtitle: 'Punto de Entrada',                   tag: 'Adquisición', body: `El error número uno es promocionar un producto que solo compran los clientes recurrentes. Si hacés eso, el ROAS se va a ver increíble, pero no vas a hacer crecer la base de clientes del negocio.`, highlight: `Encontrá cuál es el producto más comprado exclusivamente por clientes nuevos en su primer pedido. Ese es tu anzuelo de adquisición.` },
  { number: '02', icon: RefreshCw,  color: 'emerald', title: 'Tasa de Segunda Compra',    subtitle: 'LTV — Lifetime Value',               tag: 'Retención',   body: `De nada sirve un producto héroe que se vende una vez y el cliente desaparece. Hay que buscar productos que inicien una reacción en cadena de compras.`, highlight: `De las personas que compraron el producto X como primer pedido, ¿qué porcentaje volvió a comprar? Si tiene 40–50%, es un ganador absoluto.` },
  { number: '03', icon: Zap,        color: 'blue',    title: 'Velocidad de Recompra',     subtitle: 'Cash Flow',                          tag: 'Liquidez',    body: `Caso real: marca de suplementos con Magnesio (50 días de recompra) vs Péptidos (3 días). El segundo es infinitamente más valioso para escalar Meta Ads.`, highlight: `El producto héroe ideal hace que el cliente regrese rápido. Mientras más rápido vuelve el dinero al negocio, más rápido podés subir el presupuesto en Meta.` },
  { number: '04', icon: TrendingUp, color: 'violet',  title: 'El Margen Real',            subtitle: 'GPT — Ganancia Bruta por Transacción', tag: 'Rentabilidad', body: `El producto tiene que tener el "colchón" financiero para sobrevivir a la subasta de Meta. Sin margen, escalar mata el negocio.`, highlight: `GPT: Precio de venta − Costo de producción − CPA en Meta = Ganancia limpia. El Producto Héroe es el que te deja la mayor GPT absoluta.` },
];

// ─── Component ────────────────────────────────────────────────────────────────

function AllProductsView({ products }: { products: Product[] }) {
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<'product' | 'firstPurchases' | 'avgDays' | 'aov' | 'next'>('firstPurchases');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const handleSort = (field: 'product' | 'firstPurchases' | 'avgDays' | 'aov' | 'next') => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const sorted = [...products].filter(p => p.name.toLowerCase().includes(search.toLowerCase())).sort((a, b) => {
    let v1: any, v2: any;
    if (sortField === 'product') { v1 = a.name; v2 = b.name; }
    else if (sortField === 'firstPurchases') { 
      v1 = a.firstPurchases ?? Math.round((a.totalOrders || 0) * (a.entryPointPct || 0) / 100); 
      v2 = b.firstPurchases ?? Math.round((b.totalOrders || 0) * (b.entryPointPct || 0) / 100); 
    }
    else if (sortField === 'avgDays') { v1 = a.repurchaseDays || 0; v2 = b.repurchaseDays || 0; }
    else if (sortField === 'aov') { v1 = a.combinedAOV || 0; v2 = b.combinedAOV || 0; }
    else if (sortField === 'next') { v1 = a.crossSell?.[0]?.name || ''; v2 = b.crossSell?.[0]?.name || ''; }
    
    if (v1 < v2) return sortDir === 'asc' ? -1 : 1;
    if (v1 > v2) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const exportCSV = () => {
    const headers = ['Producto', 'Precio', '1eras Compras', 'Días hasta 2da Compra', 'AOV Combinado', 'Próxima Compra Más Común', '% Clientes'];
    const rows = sorted.map(p => [
      `"${p.name.replace(/"/g, '""')}"`,
      p.salePrice > 0 ? `$${p.salePrice.toFixed(2)}` : '',
      p.firstPurchases ?? Math.round((p.totalOrders || 0) * (p.entryPointPct || 0) / 100),
      p.repurchaseDays > 0 ? p.repurchaseDays.toFixed(1) : '0',
      p.combinedAOV != null && p.combinedAOV > 0 ? `$${p.combinedAOV.toFixed(2)}` : p.salePrice > 0 ? `$${p.salePrice.toFixed(2)}` : '',
      p.crossSell?.[0] ? `"${p.crossSell[0].name.replace(/"/g, '""')}"` : '',
      p.crossSell?.[0] ? `${p.crossSell[0].pct}%` : '',
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analisis-productos-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white dark:bg-[#1a1a1c] border border-zinc-200 dark:border-white/[0.07] rounded-[16px] shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2">
      <div className="p-5 border-b border-zinc-100 dark:border-white/[0.04] bg-white dark:bg-[#1a1a1c]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[18px] font-bold text-zinc-900 dark:text-white">Análisis de Todos los Productos</h2>
            <p className="text-[13px] text-zinc-500 mt-1">Vista completa de todos los productos con sus métricas de rendimiento</p>
          </div>
          <button
            onClick={exportCSV}
            className="flex-shrink-0 flex items-center gap-2 h-9 px-4 rounded-[10px] text-[12px] font-semibold border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-all"
          >
            <Download className="w-3.5 h-3.5" />Exportar CSV
          </button>
        </div>
        <div className="mt-4 relative max-w-sm">
           <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
           <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar producto..." className="w-full h-[38px] pl-9 pr-3 rounded-[8px] border border-zinc-200 dark:border-white/[0.08] bg-zinc-50 dark:bg-white/[0.02] text-[13px] text-zinc-900 dark:text-white outline-none focus:border-zinc-400 dark:focus:border-white/20 transition-colors" />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[13px] border-collapse">
          <thead className="bg-zinc-50/50 dark:bg-white/[0.02] text-zinc-500 dark:text-zinc-400 border-b border-zinc-100 dark:border-white/[0.04]">
            <tr>
              <th className="px-5 py-3.5 font-semibold cursor-pointer hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors whitespace-nowrap" onClick={() => handleSort('product')}>Producto <span className="opacity-50 ml-1">⇅</span></th>
              <th className="px-5 py-3.5 font-semibold cursor-pointer hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors text-right whitespace-nowrap" onClick={() => handleSort('firstPurchases')}>1eras Compras <span className="opacity-50 ml-1">⇅</span></th>
              <th className="px-5 py-3.5 font-semibold cursor-pointer hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors text-right whitespace-nowrap" onClick={() => handleSort('avgDays')}>Días hasta 2da <span className="opacity-50 ml-1">⇅</span></th>
              <th className="px-5 py-3.5 font-semibold cursor-pointer hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors text-right whitespace-nowrap" onClick={() => handleSort('aov')}>AOV Combinado <span className="opacity-50 ml-1">⇅</span></th>
              <th className="px-5 py-3.5 font-semibold cursor-pointer hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors whitespace-nowrap" onClick={() => handleSort('next')}>Próxima Compra Más Común <span className="opacity-50 ml-1">⇅</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-white/[0.04]">
            {sorted.map((p, i) => (
              <tr key={p.id} className={`hover:bg-zinc-50/80 dark:hover:bg-white/[0.02] transition-colors ${i % 2 === 0 ? '' : 'bg-zinc-50/30 dark:bg-white/[0.01]'}`}>
                <td className="px-4 py-3 min-w-[140px] max-w-[220px]">
                  <p className="text-[11px] font-medium text-zinc-800 dark:text-zinc-200 leading-snug">{p.name}</p>
                  {p.salePrice > 0 && (
                    <span className="inline-block mt-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">${p.salePrice.toFixed(2)}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-[12px] font-medium text-zinc-700 dark:text-zinc-300">
                  {p.firstPurchases ?? Math.round((p.totalOrders || 0) * (p.entryPointPct || 0) / 100)}
                </td>
                <td className="px-4 py-3 text-right text-[12px] font-medium text-zinc-700 dark:text-zinc-300">{p.repurchaseDays > 0 ? p.repurchaseDays.toFixed(1) : '0'}</td>
                <td className="px-4 py-3 text-right text-[12px] text-emerald-600 dark:text-emerald-400 font-bold">
                  {p.combinedAOV != null && p.combinedAOV > 0
                    ? `$${p.combinedAOV.toFixed(2)}`
                    : p.salePrice > 0 ? `$${p.salePrice.toFixed(2)}` : '—'}
                </td>
                <td className="px-4 py-3 min-w-[160px] max-w-[280px]">
                  {p.crossSell?.[0] ? (
                    <>
                      <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-snug">{p.crossSell[0].name}</p>
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500">{p.crossSell[0].pct}% de clientes</span>
                    </>
                  ) : <span className="text-[11px] text-zinc-400">—</span>}
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-zinc-400">No hay productos que coincidan.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function HeroProductPage() {
  const [tab, setTab] = useState<'analyzer' | 'all_products' | 'guide'>('analyzer');
  const [products, setProducts] = useState<Product[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
  });
  const [search, setSearch] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<Omit<Product, 'id'>>(EMPTY_FORM);
  const [guideExp, setGuideExp] = useState<number | null>(null);
  const [csvStats, setCsvStats] = useState<{ orders: number; customers: number; days: number } | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Meta sync modal state
  const [syncOpen, setSyncOpen] = useState(false);
  const [syncCampaigns, setSyncCampaigns] = useState<MetaCampaign[]>([]);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncError, setSyncError] = useState('');
  const [syncPeriod, setSyncPeriod] = useState<MetaPeriod>('last_30d');
  const [syncSearch, setSyncSearch] = useState('');
  const [assignments, setAssignments] = useState<Record<string, string>>({}); // productId → campaignId
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Bulk margin modal state
  const [marginOpen, setMarginOpen] = useState(false);
  const [marginPct, setMarginPct] = useState(30);

  // Edit modal meta picker state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerCampaigns, setPickerCampaigns] = useState<MetaCampaign[]>([]);
  const [pickerPeriod, setPickerPeriod] = useState<MetaPeriod>('last_30d');
  const [pickerError, setPickerError] = useState('');

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(products)); }, [products]);

  // ── CSV import ──────────────────────────────────────────────────────────────

  const handleFile = (file: File) => {
    setImporting(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const rows = parseCSVText(text);
        const orders = buildOrders(rows);
        const paid = orders.filter(o => o.status === 'paid');
        const analyzed = analyzeFromOrders(orders, products);
        setProducts(analyzed);
        setCsvStats({ orders: paid.length, customers: new Set(paid.map(o => o.email)).size, days: getDateRangeDays(orders) });
      } catch { alert('Error al procesar el CSV. Asegurate de que sea un export de Shopify.'); }
      finally { setImporting(false); }
    };
    reader.readAsText(file, 'utf-8');
  };

  // ── Edit product ────────────────────────────────────────────────────────────

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({ name: p.name, entryPointPct: p.entryPointPct, secondPurchasePct: p.secondPurchasePct, repurchaseDays: p.repurchaseDays, salePrice: p.salePrice, productionCost: p.productionCost, metaCPA: p.metaCPA, totalOrders: p.totalOrders, fromCSV: p.fromCSV, crossSell: p.crossSell });
    setPickerOpen(false);
    setEditOpen(true);
  };
  const openAdd = () => { setEditing(null); setForm(EMPTY_FORM); setPickerOpen(false); setEditOpen(true); };
  const saveEdit = () => {
    if (!form.name.trim()) return;
    if (editing) setProducts(ps => ps.map(p => p.id === editing.id ? { ...form, id: editing.id } : p));
    else setProducts(ps => [...ps, { ...form, id: crypto.randomUUID() }]);
    setEditOpen(false);
  };

  // ── Meta sync ───────────────────────────────────────────────────────────────

  const openSync = async () => {
    setSyncOpen(true);
    setSyncError('');
    if (syncCampaigns.length > 0) {
      // Re-run auto-match with current campaigns
      const auto: Record<string, string> = {};
      for (const p of products) auto[p.id] = bestMatchCampaign(p.name, syncCampaigns);
      setAssignments(prev => { const merged = { ...auto }; for (const k in prev) if (prev[k]) merged[k] = prev[k]; return merged; });
      return;
    }
    setSyncLoading(true);
    try {
      const data = await fetchMetaCampaignCPAs(syncPeriod);
      setSyncCampaigns(data);
      const auto: Record<string, string> = {};
      for (const p of products) auto[p.id] = bestMatchCampaign(p.name, data);
      setAssignments(auto);
    } catch (e: any) { setSyncError(e.message); }
    finally { setSyncLoading(false); }
  };

  const reloadSync = async () => {
    setSyncLoading(true); setSyncError('');
    try {
      const data = await fetchMetaCampaignCPAs(syncPeriod);
      setSyncCampaigns(data);
      const auto: Record<string, string> = {};
      for (const p of products) auto[p.id] = bestMatchCampaign(p.name, data);
      setAssignments(auto);
    } catch (e: any) { setSyncError(e.message); }
    finally { setSyncLoading(false); }
  };

  const applySync = () => {
    setProducts(ps => ps.map(p => {
      const cId = assignments[p.id];
      const c = syncCampaigns.find(c => c.id === cId);
      return c && c.cpa > 0 ? { ...p, metaCPA: parseFloat(c.cpa.toFixed(2)) } : p;
    }));
    setSyncOpen(false);
  };

  const applyBulkMargin = () => {
    setProducts(ps => ps.map(p => ({
      ...p,
      productionCost: p.salePrice ? parseFloat((p.salePrice * (1 - marginPct / 100)).toFixed(2)) : p.productionCost
    })));
    setMarginOpen(false);
  };

  const loadPickerCampaigns = async (period: MetaPeriod) => {
    setPickerLoading(true); setPickerError('');
    try { const data = await fetchMetaCampaignCPAs(period); setPickerCampaigns(data); setPickerOpen(true); }
    catch (e: any) { setPickerError(e.message); }
    finally { setPickerLoading(false); }
  };

  // ── Derived ─────────────────────────────────────────────────────────────────

  const sorted = [...products].filter(p => p.name.toLowerCase().includes(search.toLowerCase())).sort((a, b) => totalScore(b) - totalScore(a));
  const liveGPT = form.salePrice - form.productionCost - form.metaCPA;
  const PERIOD_LABELS: Record<MetaPeriod, string> = { last_7d: '7d', last_14d: '14d', last_30d: '30d' };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto pb-20 w-full px-4 md:px-8">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end gap-4 justify-between">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 text-[11px] font-semibold text-zinc-400 dark:text-zinc-600 uppercase tracking-[0.08em]"><TrendingUp className="w-3.5 h-3.5" />Estrategia de Producto</div>
          <h1 className="text-[28px] font-bold tracking-[-0.03em] text-zinc-900 dark:text-white leading-tight">Analizador de Producto Algor</h1>
          <p className="text-[14px] text-zinc-500 dark:text-zinc-400">Los 4 filtros para elegir el producto correcto para escalar en Meta Ads.</p>
        </div>
        {tab === 'analyzer' && (
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
            <button onClick={() => fileRef.current?.click()} className="flex items-center gap-2 h-10 px-4 rounded-[10px] text-[13px] font-medium border border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-white/[0.08] transition-all">
              <Upload className="w-4 h-4" />{products.length > 0 ? 'Re-importar CSV' : 'Importar CSV'}
            </button>
            {products.length > 0 && (
              <>
                <button onClick={() => setMarginOpen(true)} className="flex items-center gap-2 h-10 px-4 rounded-[10px] text-[13px] font-semibold border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-all">
                  <Target className="w-4 h-4" />Margen %
                </button>
                <button onClick={openSync} className="flex items-center gap-2 h-10 px-4 rounded-[10px] text-[13px] font-semibold border border-blue-200 dark:border-blue-800/50 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-all">
                  <Wifi className="w-4 h-4" />Conectar Meta Ads
                </button>
              </>
            )}
            <Button onClick={openAdd} className="flex items-center gap-2"><Plus className="w-4 h-4" />Manual</Button>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-zinc-100 dark:bg-white/[0.06] p-1 rounded-[10px] w-fit">
        {(['analyzer', 'all_products', 'guide'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-1.5 rounded-[7px] text-[13px] font-medium transition-all ${tab === t ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-[0_1px_3px_rgba(0,0,0,0.1)]' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}>
            {t === 'analyzer' ? 'Analizador' : t === 'all_products' ? 'Todos los Productos' : 'Guía de Filtros'}
          </button>
        ))}
      </div>

      {/* ── ANALIZADOR ────────────────────────────────────────────────────────── */}
      {tab === 'analyzer' && (
        <>
          {importing && (
            <div className="rounded-2xl border border-zinc-200 dark:border-white/[0.07] bg-white dark:bg-[#1a1a1c] p-8 flex items-center justify-center gap-3">
              <div className="w-5 h-5 border-2 border-zinc-300 dark:border-zinc-600 border-t-zinc-900 dark:border-t-white rounded-full animate-spin" />
              <span className="text-[14px] text-zinc-600 dark:text-zinc-400">Analizando órdenes...</span>
            </div>
          )}

          {!importing && products.length === 0 && (
            <div className="rounded-2xl border-2 border-dashed border-zinc-200 dark:border-white/[0.07] py-16 flex flex-col items-center gap-4 text-center cursor-pointer hover:border-zinc-300 dark:hover:border-white/[0.12] transition-colors" onClick={() => fileRef.current?.click()}>
              <div className="w-16 h-16 rounded-2xl bg-zinc-100 dark:bg-white/[0.06] flex items-center justify-center">
                <Upload className="w-7 h-7 text-zinc-400 dark:text-zinc-600" />
              </div>
              <div>
                <p className="text-[15px] font-semibold text-zinc-700 dark:text-zinc-300">Subí el CSV de órdenes de Shopify</p>
                <p className="text-[13px] text-zinc-400 dark:text-zinc-600 mt-1">Se calculan automáticamente los 3 primeros filtros.<br />Para el GPT conectá Meta Ads o completá los costos manualmente.</p>
              </div>
              <button className="flex items-center gap-2 h-10 px-5 rounded-[10px] text-[13px] font-semibold bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-sm">
                <Upload className="w-4 h-4" />Seleccionar archivo CSV
              </button>
            </div>
          )}

          {!importing && products.length > 0 && (
            <>
              {/* Stats */}
              {csvStats && (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { icon: ShoppingBag, label: 'Órdenes pagadas', value: csvStats.orders.toLocaleString() },
                      { icon: Users,       label: 'Clientes únicos',  value: csvStats.customers.toLocaleString() },
                      { icon: BarChart2,   label: 'Productos',         value: products.filter(p => p.fromCSV).length.toString() },
                    ].map(({ icon: Icon, label, value }) => (
                      <div key={label} className="bg-white dark:bg-[#1a1a1c] rounded-xl border border-zinc-200 dark:border-white/[0.07] p-4 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-[10px] bg-zinc-100 dark:bg-white/[0.07] flex items-center justify-center flex-shrink-0"><Icon className="w-4 h-4 text-zinc-500 dark:text-zinc-400" /></div>
                        <div>
                          <p className="text-[18px] font-bold text-zinc-900 dark:text-white tracking-[-0.02em] leading-none">{value}</p>
                          <p className="text-[11px] text-zinc-400 dark:text-zinc-600 font-medium mt-0.5">{label}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Data quality warning */}
                  {csvStats.days < 90 && (
                    <div className="flex gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50">
                      <Info className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                      <p className="text-[12px] text-amber-700 dark:text-amber-300 leading-relaxed">
                        <span className="font-bold">El CSV cubre solo {csvStats.days} días.</span> El Entry Point y la Tasa de 2ª Compra requieren al menos 90 días de historial para ser confiables. Con pocos días, casi todos los clientes aparecen por primera vez → Entry Point ≈ 100% aunque no sea real. <span className="font-semibold">Exportá todo el historial de Shopify para resultados precisos.</span>
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Search */}
              <div className="flex gap-3 items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar producto..." className="w-full h-9 pl-9 pr-3 rounded-[8px] border border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] text-[13px] text-zinc-900 dark:text-white outline-none focus:border-zinc-400 dark:focus:border-white/20 transition-colors" />
                </div>
                <div className="flex items-center gap-3 text-[11px] text-zinc-400 dark:text-zinc-600 flex-shrink-0">
                  <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-500" />OK</span>
                  <span className="flex items-center gap-1"><AlertCircle className="w-3 h-3 text-amber-500" />Parcial</span>
                  <span className="flex items-center gap-1"><XCircle className="w-3 h-3 text-red-500" />No pasa</span>
                </div>
              </div>

              {/* Product list — compact rows */}
              <div className="rounded-xl border border-zinc-200 dark:border-white/[0.07] overflow-hidden divide-y divide-zinc-100 dark:divide-white/[0.04]">
                {sorted.map(p => {
                  const gpt = gptVal(p);
                  const s1 = scoreEP(p.entryPointPct), s2 = scoreSP(p.secondPurchasePct);
                  const s3 = scoreRD(p.repurchaseDays), s4 = scoreGPT(p);
                  const total = [s1, s2, s3, s4].filter(s => s === 'pass').length;
                  const noCosts = p.productionCost === 0 && p.metaCPA === 0;
                  const isExpanded = expandedRow === p.id;
                  const hasCrossSell = p.crossSell && p.crossSell.length > 0;

                  const dotCls = (s: Score) => ({ pass: 'bg-emerald-500', warn: 'bg-amber-500', fail: 'bg-red-500', pending: 'bg-zinc-300 dark:bg-zinc-600' }[s] || 'bg-zinc-300');
                  const valCls = (s: Score) => ({ pass: 'text-emerald-700 dark:text-emerald-400', warn: 'text-amber-600 dark:text-amber-400', fail: 'text-red-600 dark:text-red-400', pending: 'text-zinc-400 dark:text-zinc-500' }[s] || 'text-zinc-500');

                  const chips = [
                    { label: 'EP',  score: s1, value: `${p.entryPointPct}%` },
                    { label: '2ª',  score: s2, value: `${p.secondPurchasePct}%` },
                    { label: 'Vel', score: s3, value: p.repurchaseDays > 0 ? `${p.repurchaseDays}d` : '—' },
                    { label: 'GPT', score: s4, value: noCosts ? '?' : (gpt >= 0 ? `+$${gpt.toFixed(0)}` : `-$${Math.abs(gpt).toFixed(0)}`) },
                  ];

                  return (
                    <div key={p.id} className="bg-white dark:bg-[#1a1a1c]">
                      {/* Main row */}
                      <div
                        className="flex items-center gap-3 px-3 py-2.5 hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition-colors cursor-pointer group"
                        onClick={() => hasCrossSell && setExpandedRow(isExpanded ? null : p.id)}
                      >
                        {/* Name + meta */}
                        <div className="flex-1 min-w-0 flex items-center gap-2">
                          {hasCrossSell && (
                            <span className={`text-zinc-300 dark:text-zinc-700 flex-shrink-0 transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`}>
                              <ArrowRight className="w-3 h-3" />
                            </span>
                          )}
                          <p className="text-[13px] font-medium text-zinc-800 dark:text-zinc-200 truncate leading-none">{p.name}</p>
                          {p.totalOrders !== undefined && (
                            <span className="text-[10px] text-zinc-400 dark:text-zinc-600 flex-shrink-0 bg-zinc-100 dark:bg-white/[0.05] px-1.5 py-0.5 rounded-full">{p.totalOrders}</span>
                          )}
                          {noCosts && (
                            <button onClick={e => { e.stopPropagation(); openEdit(p); }} className="text-[10px] font-semibold text-amber-500 flex-shrink-0 flex items-center gap-0.5 hover:underline">
                              <AlertCircle className="w-2.5 h-2.5" />costos
                            </button>
                          )}
                        </div>

                        {/* 4 chips */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {chips.map((c, i) => (
                            <span key={i} className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-zinc-100 dark:bg-white/[0.05]">
                              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotCls(c.score)}`} />
                              <span className="text-[9px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase">{c.label}</span>
                              <span className={`text-[10px] font-bold ${valCls(c.score)}`}>{c.value}</span>
                            </span>
                          ))}
                        </div>

                        {/* Total badge + actions */}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <TotalBadge score={total} />
                          <button onClick={e => { e.stopPropagation(); openEdit(p); }} className="opacity-0 group-hover:opacity-100 p-1 rounded-[6px] text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/[0.08] transition-all"><Edit2 className="w-3 h-3" /></button>
                          <button onClick={e => { e.stopPropagation(); setProducts(ps => ps.filter(x => x.id !== p.id)); }} className="opacity-0 group-hover:opacity-100 p-1 rounded-[6px] text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"><Trash2 className="w-3 h-3" /></button>
                        </div>
                      </div>

                      {/* Expandable cross-sell */}
                      {isExpanded && hasCrossSell && (
                        <div className="px-8 pb-2.5 pt-1 bg-zinc-50/70 dark:bg-white/[0.02] border-t border-zinc-100 dark:border-white/[0.04]">
                          <p className="text-[9px] font-bold text-zinc-400 dark:text-zinc-600 uppercase tracking-[0.08em] mb-1.5">También compraron después:</p>
                          <div className="space-y-1">
                            {p.crossSell!.map((cs, i) => (
                              <div key={i} className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-zinc-300 dark:text-zinc-700 w-3">{i + 1}.</span>
                                <p className="text-[11px] text-zinc-600 dark:text-zinc-400 font-medium flex-1 min-w-0 truncate">{cs.name}</p>
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  <div className="w-12 h-1 rounded-full bg-zinc-200 dark:bg-white/[0.08] overflow-hidden">
                                    <div className="h-full bg-blue-400 dark:bg-blue-500 rounded-full" style={{ width: `${Math.min(cs.pct, 100)}%` }} />
                                  </div>
                                  <span className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 w-6 text-right">{cs.pct}%</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {sorted.length === 0 && products.length > 0 && (
                  <div className="py-8 text-center text-zinc-400 text-[13px] bg-white dark:bg-[#1a1a1c]">No se encontraron productos con ese nombre.</div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* ── ALL PRODUCTS ──────────────────────────────────────────────────────── */}
      {tab === 'all_products' && (
        <AllProductsView products={products} />
      )}

      {/* ── GUÍA ─────────────────────────────────────────────────────────────── */}
      {tab === 'guide' && (
        <div className="space-y-6">
          <div className="flex gap-3 p-4 rounded-2xl bg-zinc-900 dark:bg-white/[0.06] border border-zinc-800 dark:border-white/[0.08]">
            <Lightbulb className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-[13px] text-zinc-300 leading-relaxed"><span className="font-semibold text-white">El objetivo no es elegir el producto que más vende</span> — sino el que convierte a extraños en clientes fieles con el mejor retorno posible para el negocio.</p>
          </div>
          <div className="space-y-3">
            {pillars.map((pillar, i) => {
              const c = colorMap[pillar.color]; const Icon = pillar.icon; const isOpen = guideExp === i;
              return (
                <div key={i} className={`rounded-2xl border transition-all duration-200 overflow-hidden ${isOpen ? `${c.bg} ${c.border}` : 'bg-white dark:bg-[#1a1a1c] border-zinc-200 dark:border-white/[0.07]'}`}>
                  <button onClick={() => setGuideExp(isOpen ? null : i)} className="w-full flex items-center gap-4 p-5 text-left">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-[13px] ${isOpen ? `${c.bg} ${c.text} border ${c.border}` : 'bg-zinc-100 dark:bg-white/[0.08] text-zinc-500 dark:text-zinc-400'}`}>{pillar.number}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[15px] font-semibold tracking-[-0.02em] ${isOpen ? 'text-zinc-900 dark:text-white' : 'text-zinc-800 dark:text-zinc-200'}`}>{pillar.title}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isOpen ? c.badge : 'bg-zinc-100 dark:bg-white/[0.07] text-zinc-500'}`}>{pillar.tag}</span>
                      </div>
                      <p className="text-[12px] text-zinc-400 dark:text-zinc-600 mt-0.5 font-medium">{pillar.subtitle}</p>
                    </div>
                    <Icon className={`w-5 h-5 flex-shrink-0 ${isOpen ? c.icon : 'text-zinc-300 dark:text-zinc-700'}`} />
                    <div className={`w-5 h-5 flex-shrink-0 ${isOpen ? c.text : 'text-zinc-300 dark:text-zinc-700'}`}>{isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}</div>
                  </button>
                  {isOpen && (
                    <div className={`px-5 pb-5 border-t ${c.border} space-y-4 pt-4`}>
                      <p className="text-[14px] text-zinc-600 dark:text-zinc-400 leading-relaxed">{pillar.body}</p>
                      <div className={`rounded-xl p-4 ${c.bg} border ${c.border}`}>
                        <div className="flex items-start gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0 ${c.dot}`} />
                          <div><p className={`text-[11px] font-bold uppercase tracking-[0.08em] mb-1.5 ${c.text}`}>Qué buscar</p><p className="text-[13px] text-zinc-700 dark:text-zinc-300 leading-relaxed">{pillar.highlight}</p></div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── META SYNC MODAL ───────────────────────────────────────────────────── */}
      <Modal isOpen={syncOpen} onClose={() => setSyncOpen(false)} title="Conectar Meta Ads — Asignar CPAs">
        <div className="space-y-4">
          {/* Period + reload */}
          <div className="flex items-center justify-between">
            <div className="flex gap-1">
              {(['last_7d', 'last_14d', 'last_30d'] as MetaPeriod[]).map(pp => (
                <button key={pp} onClick={() => { setSyncPeriod(pp); }} className={`text-[11px] font-bold px-2.5 py-1 rounded-full transition-all ${syncPeriod === pp ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900' : 'bg-zinc-100 dark:bg-white/[0.07] text-zinc-500 hover:bg-zinc-200'}`}>{PERIOD_LABELS[pp]}</button>
              ))}
            </div>
            <button onClick={reloadSync} disabled={syncLoading} className="flex items-center gap-1.5 text-[12px] font-semibold text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50">
              {syncLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              {syncLoading ? 'Cargando...' : 'Recargar campañas'}
            </button>
          </div>

          {syncError && <div className="text-[12px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-xl p-3">{syncError}</div>}

          {syncLoading && <div className="py-8 flex items-center justify-center gap-3"><Loader2 className="w-5 h-5 animate-spin text-zinc-400" /><span className="text-[13px] text-zinc-400">Cargando campañas de Meta Ads...</span></div>}

          {!syncLoading && syncCampaigns.length > 0 && (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                <input value={syncSearch} onChange={e => setSyncSearch(e.target.value)} placeholder="Filtrar productos..." className="w-full h-8 pl-9 pr-3 rounded-[8px] border border-zinc-200 dark:border-white/[0.08] bg-zinc-50 dark:bg-white/[0.04] text-[12px] text-zinc-900 dark:text-white outline-none focus:border-zinc-400 dark:focus:border-white/20 transition-colors" />
              </div>

              <div className="max-h-80 overflow-y-auto space-y-1 -mx-1 px-1">
                {products.filter(p => p.name.toLowerCase().includes(syncSearch.toLowerCase())).map(p => {
                  const assignedId = assignments[p.id] || '';
                  const assignedC = syncCampaigns.find(c => c.id === assignedId);
                  const isAutoMatch = !!assignedId && assignedId === bestMatchCampaign(p.name, syncCampaigns);
                  return (
                    <div key={p.id} className="rounded-xl border border-zinc-100 dark:border-white/[0.05] bg-zinc-50 dark:bg-white/[0.02] p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[12px] font-semibold text-zinc-800 dark:text-zinc-200 leading-snug min-w-0 flex-1 truncate">{p.name}</p>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {p.metaCPA > 0 && <span className="text-[10px] text-zinc-400">actual: ${p.metaCPA}</span>}
                          {assignedC && assignedC.cpa > 0 && <span className="text-[12px] font-bold text-blue-600 dark:text-blue-400">→ ${assignedC.cpa.toFixed(2)}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isAutoMatch && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex-shrink-0">auto</span>}
                        <select
                          value={assignedId}
                          onChange={e => setAssignments(prev => ({ ...prev, [p.id]: e.target.value }))}
                          className="flex-1 h-7 px-2 rounded-[6px] border border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-zinc-900 text-[11px] text-zinc-700 dark:text-zinc-300 outline-none"
                        >
                          <option value="">— Sin asignar —</option>
                          {syncCampaigns.map(c => (
                            <option key={c.id} value={c.id}>
                              {c.name}{c.cpa > 0 ? ` · $${c.cpa.toFixed(2)} CPA` : ' · sin CPA'}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-white/[0.05]">
                <p className="text-[11px] text-zinc-400">
                  {Object.values(assignments).filter(v => v && syncCampaigns.find(c => c.id === v)?.cpa > 0).length} de {products.length} productos con CPA asignado
                </p>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setSyncOpen(false)}>Cancelar</Button>
                  <Button onClick={applySync}>Aplicar CPAs</Button>
                </div>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* ── EDIT PRODUCT MODAL ────────────────────────────────────────────────── */}
      <Modal isOpen={editOpen} onClose={() => setEditOpen(false)} title={editing ? (editing.fromCSV ? 'Completar datos del producto' : 'Editar producto') : 'Agregar producto'}>
        <div className="space-y-5">
          {/* Nombre */}
          <div>
            <label className="text-[12px] font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">Nombre del producto</label>
            {editing?.fromCSV
              ? <div className="h-9 px-3 rounded-[8px] border border-zinc-200 dark:border-white/[0.08] bg-zinc-100 dark:bg-white/[0.03] text-[13px] text-zinc-500 flex items-center">{form.name}</div>
              : <input autoFocus type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej: Magnesio 500mg" className="w-full h-9 px-3 rounded-[8px] border border-zinc-200 dark:border-white/[0.08] bg-zinc-50 dark:bg-white/[0.04] text-[13px] text-zinc-900 dark:text-white outline-none focus:border-zinc-400 dark:focus:border-white/20 transition-colors" />
            }
          </div>

          {/* Manual filters (only for non-CSV products) */}
          {!editing?.fromCSV && (
            <div className="space-y-3">
              <p className="text-[11px] font-bold text-zinc-400 dark:text-zinc-600 uppercase tracking-[0.08em]">Filtros de análisis</p>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[11px] text-zinc-500 block mb-1">% 1er pedido clientes nuevos <span className="text-zinc-400">≥50%</span></label><NumInput value={form.entryPointPct} onChange={v => setForm(f => ({ ...f, entryPointPct: v }))} suffix="%" /></div>
                <div><label className="text-[11px] text-zinc-500 block mb-1">% tasa 2ª compra <span className="text-zinc-400">≥40%</span></label><NumInput value={form.secondPurchasePct} onChange={v => setForm(f => ({ ...f, secondPurchasePct: v }))} suffix="%" /></div>
              </div>
              <div><label className="text-[11px] text-zinc-500 block mb-1">Días entre 1ª y 2ª compra <span className="text-zinc-400">≤15d</span></label><NumInput value={form.repurchaseDays} onChange={v => setForm(f => ({ ...f, repurchaseDays: v }))} suffix="días" /></div>
            </div>
          )}

          {/* CSV read-only scores */}
          {editing?.fromCSV && (
            <div className="space-y-2">
              <p className="text-[11px] font-bold text-zinc-400 dark:text-zinc-600 uppercase tracking-[0.08em]">Calculado del CSV</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Entry Point', value: `${form.entryPointPct}%`,                                       score: scoreEP(form.entryPointPct) },
                  { label: '2ª Compra',   value: `${form.secondPurchasePct}%`,                                   score: scoreSP(form.secondPurchasePct) },
                  { label: 'Recompra',    value: (form.repurchaseDays as number) > 0 ? `${form.repurchaseDays}d` : 'Sin datos', score: scoreRD(form.repurchaseDays as number) },
                ].map(item => {
                  const bg = { pass: 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/50', warn: 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/50', fail: 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800/50' }[item.score];
                  const vc = { pass: 'text-emerald-700 dark:text-emerald-400', warn: 'text-amber-700 dark:text-amber-400', fail: 'text-red-600 dark:text-red-400' }[item.score];
                  return <div key={item.label} className={`rounded-xl border p-3 ${bg}`}><p className="text-[10px] text-zinc-500 mb-1 font-medium">{item.label}</p><p className={`text-[15px] font-bold ${vc}`}>{item.value}</p></div>;
                })}
              </div>
            </div>
          )}

          {/* GPT */}
          <div className="space-y-2">
            <p className="text-[11px] font-bold text-zinc-400 dark:text-zinc-600 uppercase tracking-[0.08em]">Filtro 4 — GPT</p>
            <div className="grid grid-cols-2 gap-2">
              <div><p className="text-[10px] text-zinc-500 mb-1">Precio de venta</p><NumInput value={form.salePrice} onChange={v => setForm(f => ({ ...f, salePrice: v }))} suffix="$" /></div>
              <div><p className="text-[10px] text-zinc-500 mb-1">Costo producción</p><NumInput value={form.productionCost} onChange={v => setForm(f => ({ ...f, productionCost: v }))} suffix="$" /></div>
            </div>
            {/* CPA with Meta picker */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] text-zinc-500">CPA en Meta</p>
                <div className="flex items-center gap-1">
                  {(['last_7d', 'last_14d', 'last_30d'] as MetaPeriod[]).map(pp => (
                    <button key={pp} onClick={() => setPickerPeriod(pp)} className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full transition-all ${pickerPeriod === pp ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900' : 'bg-zinc-100 dark:bg-white/[0.07] text-zinc-500'}`}>{PERIOD_LABELS[pp]}</button>
                  ))}
                  <button onClick={() => pickerOpen ? setPickerOpen(false) : loadPickerCampaigns(pickerPeriod)} disabled={pickerLoading} className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 transition-all ml-1">
                    {pickerLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wifi className="w-3 h-3" />}
                    {pickerLoading ? 'Cargando...' : 'Desde Meta'}
                  </button>
                </div>
              </div>
              <NumInput value={form.metaCPA} onChange={v => setForm(f => ({ ...f, metaCPA: v }))} suffix="$" />
            </div>
            {pickerError && <p className="text-[11px] text-red-500">{pickerError}</p>}
            {pickerOpen && pickerCampaigns.length > 0 && (
              <div className="rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-[#1a1a1c] overflow-hidden">
                <div className="px-3 py-2 border-b border-zinc-100 dark:border-white/[0.05] flex items-center gap-2">
                  <Search className="w-3.5 h-3.5 text-zinc-400" />
                  <input autoFocus value={pickerSearch} onChange={e => setPickerSearch(e.target.value)} placeholder="Buscar campaña..." className="flex-1 text-[12px] bg-transparent outline-none text-zinc-900 dark:text-white placeholder-zinc-400" />
                </div>
                <div className="max-h-44 overflow-y-auto">
                  {pickerCampaigns.filter(c => c.name.toLowerCase().includes(pickerSearch.toLowerCase())).map(c => (
                    <button key={c.id} onClick={() => { setForm(f => ({ ...f, metaCPA: parseFloat(c.cpa.toFixed(2)) })); setPickerOpen(false); }} className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-zinc-50 dark:hover:bg-white/[0.04] text-left transition-colors border-b border-zinc-50 dark:border-white/[0.03] last:border-0">
                      <div className="min-w-0 flex-1 mr-3">
                        <p className="text-[12px] font-medium text-zinc-800 dark:text-zinc-200 truncate">{c.name}</p>
                        <p className="text-[10px] text-zinc-400 mt-0.5">{c.purchases > 0 ? `${c.purchases} compras · $${c.spend.toFixed(0)} spend` : `$${c.spend.toFixed(0)} spend · sin conversiones`}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {c.cpa > 0 ? <span className="text-[13px] font-bold text-zinc-900 dark:text-white">${c.cpa.toFixed(2)}</span> : <span className="text-[11px] text-zinc-400">Sin CPA</span>}
                        <ChevronRight className="w-3.5 h-3.5 text-zinc-300 dark:text-zinc-700" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className={`flex items-center justify-between rounded-xl px-4 py-2.5 border ${liveGPT > 0 ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/50' : liveGPT < 0 ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800/50' : 'bg-zinc-50 dark:bg-white/[0.03] border-zinc-200 dark:border-white/[0.06]'}`}>
              <span className="text-[12px] font-semibold text-zinc-600 dark:text-zinc-400">GPT calculada</span>
              <span className={`text-[15px] font-bold ${liveGPT > 0 ? 'text-emerald-700 dark:text-emerald-400' : liveGPT < 0 ? 'text-red-600 dark:text-red-400' : 'text-zinc-500'}`}>{liveGPT >= 0 ? '+' : ''}${liveGPT.toFixed(2)}</span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={saveEdit} disabled={!form.name.toString().trim()}>{editing ? 'Guardar' : 'Agregar'}</Button>
          </div>
        </div>
      </Modal>

      {/* ── BULK MARGIN MODAL ─────────────────────────────────────────────────── */}
      <Modal isOpen={marginOpen} onClose={() => setMarginOpen(false)} title="Margen de Rentabilidad Global">
        <div className="space-y-4">
          <p className="text-[13px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Aplicá un margen estimado de ganancia a todos los productos. Se calculará el costo de producción automáticamente en base a su precio de venta.
          </p>
          <div>
            <label className="text-[12px] font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">Margen Estimado (%)</label>
            <NumInput value={marginPct} onChange={setMarginPct} suffix="%" />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-white/[0.05]">
            <Button variant="secondary" onClick={() => setMarginOpen(false)}>Cancelar</Button>
            <Button onClick={applyBulkMargin}>Aplicar a Todos</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
