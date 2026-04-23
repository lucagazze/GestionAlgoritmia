import React, { useState, useEffect, useRef } from 'react';
import {
  Target, RefreshCw, Zap, TrendingUp, ChevronDown, ChevronUp,
  Lightbulb, Plus, Trash2, Edit2, Package, CheckCircle2, AlertCircle,
  XCircle, Upload, Search, BarChart2, ShoppingBag, Users, RotateCcw,
} from 'lucide-react';
import { Modal, Button } from '../components/UIComponents';

// ─── Types ────────────────────────────────────────────────────────────────────

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
}

// ─── CSV Parsing ──────────────────────────────────────────────────────────────

function parseCSVText(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], n = text[i + 1];
    if (c === '"') {
      if (inQ && n === '"') { field += '"'; i++; }
      else inQ = !inQ;
    } else if (c === ',' && !inQ) {
      row.push(field); field = '';
    } else if ((c === '\n' || c === '\r') && !inQ) {
      if (c === '\r' && n === '\n') i++;
      row.push(field); field = '';
      if (row.some(f => f !== '')) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field || row.length) { row.push(field); if (row.some(f => f !== '')) rows.push(row); }
  return rows;
}

interface RawOrder {
  name: string;
  email: string;
  date: Date;
  status: string;
  items: { productName: string; price: number; qty: number }[];
}

function buildOrders(rows: string[][]): RawOrder[] {
  if (rows.length < 2) return [];
  const header = rows[0];
  const idx = (col: string) => header.indexOf(col);
  const iName = idx('Name'), iEmail = idx('Email'), iStatus = idx('Financial Status');
  const iDate = idx('Created at'), iQty = idx('Lineitem quantity');
  const iItemName = idx('Lineitem name'), iPrice = idx('Lineitem price');

  const orderMap = new Map<string, RawOrder>();

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const name = r[iName]?.trim();
    const email = r[iEmail]?.trim().toLowerCase();
    const status = r[iStatus]?.trim();
    const dateStr = r[iDate]?.trim();
    const itemName = r[iItemName]?.trim();
    const price = parseFloat(r[iPrice]) || 0;
    const qty = parseInt(r[iQty]) || 1;

    if (!name) continue;

    if (!orderMap.has(name)) {
      orderMap.set(name, {
        name,
        email: email || '',
        date: dateStr ? new Date(dateStr) : new Date(0),
        status: status || '',
        items: [],
      });
    } else if (status) {
      orderMap.get(name)!.status = status;
    }

    if (itemName) {
      orderMap.get(name)!.items.push({ productName: itemName, price, qty });
    }
  }

  return [...orderMap.values()];
}

function analyzeFromOrders(orders: RawOrder[], existing: Product[]): Product[] {
  const paidOrders = orders.filter(o => o.status === 'paid' && o.email && o.items.length > 0);

  // Group by customer email, sort by date
  const byCustomer = new Map<string, RawOrder[]>();
  for (const o of paidOrders) {
    if (!byCustomer.has(o.email)) byCustomer.set(o.email, []);
    byCustomer.get(o.email)!.push(o);
  }
  for (const [, list] of byCustomer) {
    list.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  // Unique products
  const productNames = new Set<string>();
  for (const o of paidOrders) {
    for (const it of o.items) productNames.add(it.productName);
  }

  const results: Product[] = [];

  for (const pName of productNames) {
    const ordersWithP = paidOrders.filter(o => o.items.some(it => it.productName === pName));
    if (ordersWithP.length === 0) continue;

    // Filter 1 — Entry Point
    const firstOrdersWithP = ordersWithP.filter(o => {
      const customerOrders = byCustomer.get(o.email) || [];
      return customerOrders[0]?.name === o.name;
    });
    const entryPointPct = Math.round((firstOrdersWithP.length / ordersWithP.length) * 100);

    // Filter 2 — Second Purchase Rate
    const customersFirstP = firstOrdersWithP.map(o => o.email);
    const customersReturned = customersFirstP.filter(email => (byCustomer.get(email)?.length ?? 0) >= 2);
    const secondPurchasePct = customersFirstP.length > 0
      ? Math.round((customersReturned.length / customersFirstP.length) * 100)
      : 0;

    // Filter 3 — Repurchase Days
    let repurchaseDays = 0;
    if (customersReturned.length > 0) {
      const gaps = customersReturned.map(email => {
        const list = byCustomer.get(email)!;
        return (list[1].date.getTime() - list[0].date.getTime()) / 86_400_000;
      }).filter(d => d >= 0);
      if (gaps.length > 0) {
        repurchaseDays = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
      }
    }

    // Average price
    const prices = ordersWithP.flatMap(o => o.items.filter(it => it.productName === pName).map(it => it.price));
    const avgPrice = prices.length > 0 ? prices[0] : 0;

    // Preserve manual fields if product was already saved
    const existingP = existing.find(p => p.name === pName);

    results.push({
      id: existingP?.id ?? crypto.randomUUID(),
      name: pName,
      entryPointPct,
      secondPurchasePct,
      repurchaseDays,
      salePrice: avgPrice,
      productionCost: existingP?.productionCost ?? 0,
      metaCPA: existingP?.metaCPA ?? 0,
      totalOrders: ordersWithP.length,
      fromCSV: true,
    });
  }

  // Sort by total orders desc
  results.sort((a, b) => (b.totalOrders ?? 0) - (a.totalOrders ?? 0));
  return results;
}

// ─── Scoring ─────────────────────────────────────────────────────────────────

type Score = 'pass' | 'warn' | 'fail';

const scoreEntryPoint = (v: number): Score => v >= 50 ? 'pass' : v >= 25 ? 'warn' : 'fail';
const scoreSecondPurchase = (v: number): Score => v >= 40 ? 'pass' : v >= 20 ? 'warn' : 'fail';
const scoreRepurchaseDays = (v: number): Score => v === 0 ? 'fail' : v <= 15 ? 'pass' : v <= 45 ? 'warn' : 'fail';
const scoreGPT = (gpt: number): Score => gpt > 0 ? 'pass' : 'fail';
const gptValue = (p: Product) => p.salePrice - p.productionCost - p.metaCPA;
const totalScore = (p: Product) =>
  [scoreEntryPoint(p.entryPointPct), scoreSecondPurchase(p.secondPurchasePct),
   scoreRepurchaseDays(p.repurchaseDays), scoreGPT(gptValue(p))].filter(s => s === 'pass').length;

// ─── UI helpers ───────────────────────────────────────────────────────────────

const ScoreBadge: React.FC<{ score: Score; label: string }> = ({ score, label }) => {
  const cls = { pass: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300', warn: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300', fail: 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400' }[score];
  const Icon = score === 'pass' ? CheckCircle2 : score === 'warn' ? AlertCircle : XCircle;
  return <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${cls}`}><Icon className="w-3 h-3" />{label}</span>;
};

const TotalBadge: React.FC<{ score: number }> = ({ score }) => {
  const map: Record<number, { label: string; cls: string }> = {
    4: { label: 'Héroe', cls: 'bg-emerald-500 text-white shadow-[0_2px_8px_rgba(16,185,129,0.35)]' },
    3: { label: 'Candidato', cls: 'bg-blue-500 text-white shadow-[0_2px_8px_rgba(59,130,246,0.35)]' },
    2: { label: 'Potencial', cls: 'bg-amber-500 text-white' },
    1: { label: 'Débil', cls: 'bg-zinc-400 dark:bg-zinc-600 text-white' },
    0: { label: 'Descartar', cls: 'bg-red-500 text-white' },
  };
  const { label, cls } = map[score] ?? map[0];
  return <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${cls}`}>{score}/4 · {label}</span>;
};

const NumInput: React.FC<{ value: number; onChange: (v: number) => void; suffix?: string; placeholder?: string }> = ({ value, onChange, suffix, placeholder }) => (
  <div className="relative">
    <input type="number" value={value === 0 ? '' : value} placeholder={placeholder ?? '0'} onChange={e => onChange(parseFloat(e.target.value) || 0)}
      className="w-full h-9 px-3 pr-7 rounded-[8px] border border-zinc-200 dark:border-white/[0.08] bg-zinc-50 dark:bg-white/[0.04] text-[13px] text-zinc-900 dark:text-white outline-none focus:border-zinc-400 dark:focus:border-white/20 transition-colors" />
    {suffix && <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-medium text-zinc-400 dark:text-zinc-600 pointer-events-none">{suffix}</span>}
  </div>
);

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'hero-products-v2';
const EMPTY_FORM: Omit<Product, 'id'> = { name: '', entryPointPct: 0, secondPurchasePct: 0, repurchaseDays: 0, salePrice: 0, productionCost: 0, metaCPA: 0 };

const colorMap: Record<string, { bg: string; text: string; border: string; badge: string; icon: string; dot: string }> = {
  amber:  { bg: 'bg-amber-50 dark:bg-amber-950/30',   text: 'text-amber-700 dark:text-amber-400',  border: 'border-amber-200 dark:border-amber-800/50',  badge: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',  icon: 'text-amber-500',  dot: 'bg-amber-500' },
  emerald:{ bg: 'bg-emerald-50 dark:bg-emerald-950/30',text: 'text-emerald-700 dark:text-emerald-400',border:'border-emerald-200 dark:border-emerald-800/50',badge:'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',icon:'text-emerald-500', dot:'bg-emerald-500' },
  blue:   { bg: 'bg-blue-50 dark:bg-blue-950/30',     text: 'text-blue-700 dark:text-blue-400',    border: 'border-blue-200 dark:border-blue-800/50',    badge: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',    icon: 'text-blue-500',   dot: 'bg-blue-500' },
  violet: { bg: 'bg-violet-50 dark:bg-violet-950/30', text: 'text-violet-700 dark:text-violet-400',border: 'border-violet-200 dark:border-violet-800/50', badge: 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300',icon: 'text-violet-500', dot: 'bg-violet-500' },
};

const pillars = [
  { number: '01', icon: Target, color: 'amber', title: 'El Filtro del Entry Point', subtitle: 'Punto de Entrada', tag: 'Adquisición', body: `El error número uno es promocionar un producto que solo compran los clientes recurrentes. Si hacés eso, el ROAS se va a ver increíble, pero no vas a hacer crecer la base de clientes del negocio.`, highlight: `Encontrá cuál es el producto más comprado exclusivamente por clientes nuevos en su primer pedido. Ese es tu anzuelo de adquisición.` },
  { number: '02', icon: RefreshCw, color: 'emerald', title: 'Tasa de Segunda Compra', subtitle: 'LTV — Lifetime Value', tag: 'Retención', body: `De nada sirve un producto héroe que se vende una vez y el cliente desaparece. Hay que buscar productos que inicien una reacción en cadena de compras.`, highlight: `De las personas que compraron el producto X como primer pedido, ¿qué porcentaje volvió a comprar? Si tiene 40–50% de recompra, es un ganador absoluto. Podés pagar un CPA más alto en Meta porque el cliente va a dejar más dinero en el futuro.` },
  { number: '03', icon: Zap, color: 'blue', title: 'Velocidad de Recompra', subtitle: 'Cash Flow', tag: 'Liquidez', body: `Caso real: marca de suplementos con Magnesio (50 días de recompra) vs Péptidos (3 días). El segundo es infinitamente más valioso para escalar Meta Ads.`, highlight: `El producto héroe ideal hace que el cliente regrese rápido. Mientras más rápido vuelve el dinero al negocio, más rápido podés subir el presupuesto en Meta sin quebrar la caja del cliente.` },
  { number: '04', icon: TrendingUp, color: 'violet', title: 'El Margen Real', subtitle: 'GPT — Ganancia Bruta por Transacción', tag: 'Rentabilidad', body: `El producto tiene que tener el "colchón" financiero para sobrevivir a la subasta de Meta. Sin margen, escalar mata el negocio.`, highlight: `Calculá la GPT: Precio de venta − Costo de producción − CPA en Meta = Ganancia limpia. El Producto Héroe es el que te deja la mayor GPT absoluta para tener margen de maniobra cuando escales.` },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function HeroProductPage() {
  const [tab, setTab] = useState<'analyzer' | 'guide'>('analyzer');
  const [products, setProducts] = useState<Product[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
  });
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<Omit<Product, 'id'>>(EMPTY_FORM);
  const [guideExpanded, setGuideExpanded] = useState<number | null>(null);
  const [csvStats, setCsvStats] = useState<{ orders: number; customers: number } | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(products)); }, [products]);

  const handleFileUpload = (file: File) => {
    if (!file) return;
    setImporting(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const rows = parseCSVText(text);
        const orders = buildOrders(rows);
        const paidOrders = orders.filter(o => o.status === 'paid');
        const uniqueCustomers = new Set(paidOrders.map(o => o.email)).size;
        const analyzed = analyzeFromOrders(orders, products);
        setProducts(analyzed);
        setCsvStats({ orders: paidOrders.length, customers: uniqueCustomers });
      } catch (err) {
        console.error('CSV parse error:', err);
        alert('Error al procesar el CSV. Asegurate de que sea un export de Shopify.');
      } finally {
        setImporting(false);
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  const openAdd = () => { setEditing(null); setForm(EMPTY_FORM); setModalOpen(true); };
  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({ name: p.name, entryPointPct: p.entryPointPct, secondPurchasePct: p.secondPurchasePct, repurchaseDays: p.repurchaseDays, salePrice: p.salePrice, productionCost: p.productionCost, metaCPA: p.metaCPA, totalOrders: p.totalOrders, fromCSV: p.fromCSV });
    setModalOpen(true);
  };
  const handleSave = () => {
    if (!form.name.trim()) return;
    if (editing) {
      setProducts(ps => ps.map(p => p.id === editing.id ? { ...form, id: editing.id } : p));
    } else {
      setProducts(ps => [...ps, { ...form, id: crypto.randomUUID() }]);
    }
    setModalOpen(false);
  };
  const handleDelete = (id: string) => setProducts(ps => ps.filter(p => p.id !== id));

  const sorted = [...products]
    .filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => totalScore(b) - totalScore(a));

  const liveGPT = form.salePrice - form.productionCost - form.metaCPA;
  const needsCosts = (p: Product) => p.productionCost === 0 && p.metaCPA === 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl mx-auto pb-20">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end gap-4 justify-between">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 text-[11px] font-semibold text-zinc-400 dark:text-zinc-600 uppercase tracking-[0.08em]">
            <TrendingUp className="w-3.5 h-3.5" />Estrategia de Producto
          </div>
          <h1 className="text-[28px] font-bold tracking-[-0.03em] text-zinc-900 dark:text-white leading-tight">Producto Héroe</h1>
          <p className="text-[14px] text-zinc-500 dark:text-zinc-400">Los 4 filtros para elegir el producto correcto para escalar en Meta Ads.</p>
        </div>
        {tab === 'analyzer' && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={() => fileRef.current?.click()} className="flex items-center gap-2 h-10 px-4 rounded-[10px] text-[13px] font-medium border border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-white/[0.08] transition-all">
              <Upload className="w-4 h-4" />
              {products.length > 0 ? 'Re-importar CSV' : 'Importar CSV'}
            </button>
            <Button onClick={openAdd} className="flex items-center gap-2">
              <Plus className="w-4 h-4" />Manual
            </Button>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); e.target.value = ''; }} />
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-zinc-100 dark:bg-white/[0.06] p-1 rounded-[10px] w-fit">
        {(['analyzer', 'guide'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-1.5 rounded-[7px] text-[13px] font-medium transition-all ${tab === t ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-[0_1px_3px_rgba(0,0,0,0.1)]' : 'text-zinc-500 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}>
            {t === 'analyzer' ? 'Analizador' : 'Guía de Filtros'}
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
            <div
              className="rounded-2xl border-2 border-dashed border-zinc-200 dark:border-white/[0.07] py-16 flex flex-col items-center gap-4 text-center cursor-pointer hover:border-zinc-300 dark:hover:border-white/[0.12] transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <div className="w-16 h-16 rounded-2xl bg-zinc-100 dark:bg-white/[0.06] flex items-center justify-center">
                <Upload className="w-7 h-7 text-zinc-400 dark:text-zinc-600" />
              </div>
              <div>
                <p className="text-[15px] font-semibold text-zinc-700 dark:text-zinc-300">Subí el CSV de órdenes de Shopify</p>
                <p className="text-[13px] text-zinc-400 dark:text-zinc-600 mt-1">Se calculan automáticamente los 3 primeros filtros.<br />Solo necesitás completar costo de producción y CPA.</p>
              </div>
              <button className="flex items-center gap-2 h-10 px-5 rounded-[10px] text-[13px] font-semibold bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-sm">
                <Upload className="w-4 h-4" />Seleccionar archivo CSV
              </button>
            </div>
          )}

          {!importing && products.length > 0 && (
            <>
              {/* Stats bar */}
              {csvStats && (
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { icon: ShoppingBag, label: 'Órdenes pagadas', value: csvStats.orders.toLocaleString() },
                    { icon: Users, label: 'Clientes únicos', value: csvStats.customers.toLocaleString() },
                    { icon: BarChart2, label: 'Productos analizados', value: products.filter(p => p.fromCSV).length.toString() },
                  ].map(({ icon: Icon, label, value }) => (
                    <div key={label} className="bg-white dark:bg-[#1a1a1c] rounded-xl border border-zinc-200 dark:border-white/[0.07] p-4 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-[10px] bg-zinc-100 dark:bg-white/[0.07] flex items-center justify-center flex-shrink-0">
                        <Icon className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                      </div>
                      <div>
                        <p className="text-[18px] font-bold text-zinc-900 dark:text-white tracking-[-0.02em] leading-none">{value}</p>
                        <p className="text-[11px] text-zinc-400 dark:text-zinc-600 font-medium mt-0.5">{label}</p>
                      </div>
                    </div>
                  ))}
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

              {/* Product list */}
              <div className="space-y-3">
                {sorted.map(p => {
                  const gpt = gptValue(p);
                  const s1 = scoreEntryPoint(p.entryPointPct);
                  const s2 = scoreSecondPurchase(p.secondPurchasePct);
                  const s3 = scoreRepurchaseDays(p.repurchaseDays);
                  const s4 = scoreGPT(gpt);
                  const total = [s1, s2, s3, s4].filter(s => s === 'pass').length;
                  const missingCosts = needsCosts(p);

                  return (
                    <div key={p.id} className="bg-white dark:bg-[#1a1a1c] rounded-2xl border border-zinc-200 dark:border-white/[0.07] p-5 space-y-4">
                      {/* Name row */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-white/[0.07] flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Package className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[14px] font-semibold text-zinc-900 dark:text-white tracking-[-0.02em] leading-snug">{p.name}</p>
                            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                              {p.totalOrders !== undefined && (
                                <span className="text-[11px] text-zinc-400 dark:text-zinc-600">{p.totalOrders} órdenes · ${p.salePrice.toFixed(2)}</span>
                              )}
                              {missingCosts && (
                                <button onClick={() => openEdit(p)} className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1 hover:underline">
                                  <AlertCircle className="w-3 h-3" />Completar costo + CPA
                                </button>
                              )}
                              {!missingCosts && (
                                <span className={`text-[12px] font-bold ${gpt > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                  GPT: {gpt >= 0 ? '+' : ''}${gpt.toFixed(2)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <TotalBadge score={total} />
                          <button onClick={() => openEdit(p)} className="p-1.5 rounded-[7px] text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/[0.08] transition-all">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded-[7px] text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* 4 filter scores */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                          { score: s1, label: 'Entry Point', value: `${p.entryPointPct}%`, threshold: '≥50%', icon: Target },
                          { score: s2, label: '2ª Compra', value: `${p.secondPurchasePct}%`, threshold: '≥40%', icon: RefreshCw },
                          { score: s3, label: 'Vel. Recompra', value: p.repurchaseDays > 0 ? `${p.repurchaseDays}d` : 'Sin datos', threshold: '≤15d', icon: Zap },
                          { score: s4, label: 'GPT', value: missingCosts ? 'Pendiente' : (gpt >= 0 ? `+$${gpt.toFixed(0)}` : `-$${Math.abs(gpt).toFixed(0)}`), threshold: '>0', icon: TrendingUp },
                        ].map((item, i) => {
                          const bgCls = { pass: 'border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/60 dark:bg-emerald-950/20', warn: 'border-amber-200 dark:border-amber-800/50 bg-amber-50/60 dark:bg-amber-950/20', fail: 'border-red-200 dark:border-red-800/50 bg-red-50/60 dark:bg-red-950/20' }[item.score];
                          const valCls = { pass: 'text-emerald-700 dark:text-emerald-400', warn: 'text-amber-700 dark:text-amber-400', fail: 'text-red-600 dark:text-red-400' }[item.score];
                          const ItemIcon = item.icon;
                          return (
                            <div key={i} className={`rounded-xl border p-3 ${bgCls}`}>
                              <div className="flex items-center gap-1 mb-1">
                                <ItemIcon className={`w-3 h-3 ${valCls}`} />
                                <p className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-500 uppercase tracking-[0.05em]">{item.label}</p>
                              </div>
                              <p className={`text-[16px] font-bold tracking-[-0.02em] ${valCls}`}>{item.value}</p>
                              <div className="flex items-center gap-1 mt-1">
                                <ScoreBadge score={item.score} label={item.score === 'pass' ? 'OK' : item.score === 'warn' ? 'Parcial' : 'No pasa'} />
                                <span className="text-[10px] text-zinc-400 dark:text-zinc-600">meta: {item.threshold}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {sorted.length === 0 && products.length > 0 && (
                  <div className="py-10 text-center text-zinc-400 dark:text-zinc-600 text-[13px]">
                    No se encontraron productos con ese nombre.
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* ── GUÍA ─────────────────────────────────────────────────────────────── */}
      {tab === 'guide' && (
        <div className="space-y-6">
          <div className="flex gap-3 p-4 rounded-2xl bg-zinc-900 dark:bg-white/[0.06] border border-zinc-800 dark:border-white/[0.08]">
            <Lightbulb className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-[13px] text-zinc-300 leading-relaxed">
              <span className="font-semibold text-white">El objetivo no es elegir el producto que más vende</span> — sino el que convierte a extraños en clientes fieles con el mejor retorno posible para el negocio.
            </p>
          </div>
          <div className="space-y-3">
            {pillars.map((pillar, i) => {
              const c = colorMap[pillar.color]; const Icon = pillar.icon; const isOpen = guideExpanded === i;
              return (
                <div key={i} className={`rounded-2xl border transition-all duration-200 overflow-hidden ${isOpen ? `${c.bg} ${c.border}` : 'bg-white dark:bg-[#1a1a1c] border-zinc-200 dark:border-white/[0.07]'}`}>
                  <button onClick={() => setGuideExpanded(isOpen ? null : i)} className="w-full flex items-center gap-4 p-5 text-left">
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
                          <div>
                            <p className={`text-[11px] font-bold uppercase tracking-[0.08em] mb-1.5 ${c.text}`}>Qué buscar</p>
                            <p className="text-[13px] text-zinc-700 dark:text-zinc-300 leading-relaxed">{pillar.highlight}</p>
                          </div>
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

      {/* ── MODAL ─────────────────────────────────────────────────────────────── */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? (editing.fromCSV ? 'Completar datos del producto' : 'Editar producto') : 'Agregar producto'}>
        <div className="space-y-5">

          {/* Nombre */}
          <div>
            <label className="text-[12px] font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">Nombre del producto</label>
            {editing?.fromCSV ? (
              <div className="h-9 px-3 rounded-[8px] border border-zinc-200 dark:border-white/[0.08] bg-zinc-100 dark:bg-white/[0.03] text-[13px] text-zinc-500 dark:text-zinc-500 flex items-center">{form.name}</div>
            ) : (
              <input autoFocus type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej: Magnesio 500mg" className="w-full h-9 px-3 rounded-[8px] border border-zinc-200 dark:border-white/[0.08] bg-zinc-50 dark:bg-white/[0.04] text-[13px] text-zinc-900 dark:text-white outline-none focus:border-zinc-400 dark:focus:border-white/20 transition-colors" />
            )}
          </div>

          {/* Filtros 1–3: solo si es manual */}
          {!editing?.fromCSV && (
            <div className="space-y-3">
              <p className="text-[11px] font-bold text-zinc-400 dark:text-zinc-600 uppercase tracking-[0.08em]">Filtros automáticos (manual)</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 block mb-1">% 1er pedido clientes nuevos <span className="text-zinc-400">≥50%</span></label>
                  <NumInput value={form.entryPointPct} onChange={v => setForm(f => ({ ...f, entryPointPct: v }))} suffix="%" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 block mb-1">% tasa 2ª compra <span className="text-zinc-400">≥40%</span></label>
                  <NumInput value={form.secondPurchasePct} onChange={v => setForm(f => ({ ...f, secondPurchasePct: v }))} suffix="%" />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 block mb-1">Días entre 1ª y 2ª compra <span className="text-zinc-400">≤15d</span></label>
                <NumInput value={form.repurchaseDays} onChange={v => setForm(f => ({ ...f, repurchaseDays: v }))} suffix="días" />
              </div>
            </div>
          )}

          {/* Filtros automáticos readonly si es CSV */}
          {editing?.fromCSV && (
            <div className="space-y-2">
              <p className="text-[11px] font-bold text-zinc-400 dark:text-zinc-600 uppercase tracking-[0.08em]">Calculado del CSV</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Entry Point', value: `${form.entryPointPct}%`, threshold: 'meta ≥50%', score: scoreEntryPoint(form.entryPointPct) },
                  { label: '2ª Compra', value: `${form.secondPurchasePct}%`, threshold: 'meta ≥40%', score: scoreSecondPurchase(form.secondPurchasePct) },
                  { label: 'Recompra', value: form.repurchaseDays > 0 ? `${form.repurchaseDays}d` : 'Sin datos', threshold: 'meta ≤15d', score: scoreRepurchaseDays(form.repurchaseDays) },
                ].map(item => {
                  const cls = { pass: 'border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-950/20', warn: 'border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/20', fail: 'border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-950/20' }[item.score];
                  const valCls = { pass: 'text-emerald-700 dark:text-emerald-400', warn: 'text-amber-700 dark:text-amber-400', fail: 'text-red-600 dark:text-red-400' }[item.score];
                  return (
                    <div key={item.label} className={`rounded-xl border p-3 ${cls}`}>
                      <p className="text-[10px] text-zinc-500 mb-1 font-medium">{item.label}</p>
                      <p className={`text-[15px] font-bold ${valCls}`}>{item.value}</p>
                      <p className="text-[10px] text-zinc-400 mt-0.5">{item.threshold}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* GPT inputs — always editable */}
          <div className="space-y-2">
            <p className="text-[11px] font-bold text-zinc-400 dark:text-zinc-600 uppercase tracking-[0.08em]">Filtro 4 — GPT</p>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <p className="text-[10px] text-zinc-500 mb-1">Precio de venta</p>
                <NumInput value={form.salePrice} onChange={v => setForm(f => ({ ...f, salePrice: v }))} suffix="$" />
              </div>
              <div>
                <p className="text-[10px] text-zinc-500 mb-1">Costo producción</p>
                <NumInput value={form.productionCost} onChange={v => setForm(f => ({ ...f, productionCost: v }))} suffix="$" />
              </div>
              <div>
                <p className="text-[10px] text-zinc-500 mb-1">CPA en Meta</p>
                <NumInput value={form.metaCPA} onChange={v => setForm(f => ({ ...f, metaCPA: v }))} suffix="$" />
              </div>
            </div>
            <div className={`flex items-center justify-between rounded-xl px-4 py-2.5 border ${liveGPT > 0 ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/50' : liveGPT < 0 ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800/50' : 'bg-zinc-50 dark:bg-white/[0.03] border-zinc-200 dark:border-white/[0.06]'}`}>
              <span className="text-[12px] font-semibold text-zinc-600 dark:text-zinc-400">GPT calculada</span>
              <span className={`text-[15px] font-bold ${liveGPT > 0 ? 'text-emerald-700 dark:text-emerald-400' : liveGPT < 0 ? 'text-red-600 dark:text-red-400' : 'text-zinc-500'}`}>
                {liveGPT >= 0 ? '+' : ''}${liveGPT.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.name.trim()}>{editing ? 'Guardar' : 'Agregar'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
