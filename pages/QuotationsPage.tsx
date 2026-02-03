import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/db';
import { Proposal, Contractor, ProposalStatus, ProposalItem } from '../types';
import { Button, Input, Card, Badge, Modal, Label } from '../components/UIComponents';
import { 
  FileText, Plus, CheckCircle2, XCircle, Clock, 
  Search, MoreVertical, Send, AlertCircle, Loader2, 
  DollarSign, Briefcase, User, Wallet, Calendar 
} from 'lucide-react';
import { useToast } from '../components/Toast';

export default function QuotationsPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  
  // --- ESTADOS ---
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filtros
  const [activeTab, setActiveTab] = useState<'ALL' | 'WAITING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Menú Contextual (Clic Derecho)
  const [contextMenu, setContextMenu] = useState<{ visible: boolean, x: number, y: number, proposal: Proposal | null }>({
      visible: false, x: 0, y: 0, proposal: null
  });

  // Modales
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedDetailProposal, setSelectedDetailProposal] = useState<Proposal | null>(null);

  useEffect(() => {
    loadData();
    const handleClickOutside = () => setContextMenu({ ...contextMenu, visible: false });
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [propsData, contsData] = await Promise.all([
        db.proposals.getAll(),
        db.contractors.getAll()
    ]);
    setProposals(propsData);
    setContractors(contsData);
    setLoading(false);
  };

  // --- LÓGICA FINANCIERA ---
  const calculateFinancials = (proposal: Proposal) => {
      const duration = proposal.durationMonths || 1; // Por defecto 1 mes si no se especifica
      
      // 1. Ingresos (Lo que paga el cliente)
      const revenueRecurring = proposal.totalRecurringPrice || 0;
      const revenueOneTime = proposal.totalOneTimePrice || 0;
      const totalContractRevenue = (revenueRecurring * duration) + revenueOneTime;

      // 2. Egresos (Lo que pagas al equipo)
      let costRecurring = 0;
      let costOneTime = 0;

      if (proposal.items) {
          proposal.items.forEach(item => {
              if (item.serviceSnapshotType === 'RECURRING') {
                  costRecurring += (item.outsourcingCost || 0);
              } else {
                  costOneTime += (item.outsourcingCost || 0);
              }
          });
      }
      
      const totalContractCost = (costRecurring * duration) + costOneTime;

      // 3. Ganancia Neta
      const netProfit = totalContractRevenue - totalContractCost;
      const margin = totalContractRevenue > 0 ? (netProfit / totalContractRevenue) * 100 : 0;

      return {
          revenueRecurring,
          revenueOneTime,
          totalContractRevenue,
          costRecurring,
          costOneTime,
          totalContractCost,
          netProfit,
          margin: Math.round(margin),
          duration
      };
  };

  // --- ACCIONES ---

  // Abrir Detalle (Doble Clic)
  const handleOpenDetail = (proposal: Proposal) => {
      setSelectedDetailProposal(proposal);
      setIsDetailModalOpen(true);
  };

  // Aprobar Totalmente (Desde menú contextual)
  const handleQuickApprove = async () => {
      if (!contextMenu.proposal) return;
      try {
          const items = await db.proposals.getItems(contextMenu.proposal.id);
          const allItemIds = items.map(i => i.id);
          await db.proposals.approve(contextMenu.proposal.id, allItemIds, {});
          showToast("✅ Presupuesto Aprobado", "success");
          loadData();
      } catch (e) { showToast("Error al aprobar", "error"); }
  };

  const handleSetWaiting = async () => {
      if (!contextMenu.proposal) return;
      await db.proposals.updateStatus(contextMenu.proposal.id, ProposalStatus.SENT);
      showToast("⏳ En Espera", "info");
      loadData();
  };

  const handleReject = async () => {
      if (!contextMenu.proposal) return;
      if (!confirm("¿Rechazar presupuesto?")) return;
      await db.proposals.updateStatus(contextMenu.proposal.id, ProposalStatus.REJECTED);
      showToast("❌ Rechazado", "info");
      loadData();
  };

  // --- FILTROS ---
  const filteredProposals = proposals.filter(p => {
      const matchesSearch = (p.client?.name || 'Cliente').toLowerCase().includes(searchTerm.toLowerCase());
      let matchesTab = true;
      if (activeTab === 'WAITING') matchesTab = p.status === ProposalStatus.SENT || p.status === ProposalStatus.DRAFT;
      if (activeTab === 'APPROVED') matchesTab = p.status === ProposalStatus.ACCEPTED || p.status === ProposalStatus.PARTIALLY_ACCEPTED;
      if (activeTab === 'REJECTED') matchesTab = p.status === ProposalStatus.REJECTED;
      return matchesSearch && matchesTab;
  });

  const getStatusBadge = (status: ProposalStatus) => {
      switch (status) {
          case ProposalStatus.ACCEPTED: return <Badge variant="green">Aprobado</Badge>;
          case ProposalStatus.PARTIALLY_ACCEPTED: return <Badge variant="blue">Parcial</Badge>;
          case ProposalStatus.REJECTED: return <Badge variant="red">Rechazada</Badge>;
          case ProposalStatus.SENT: return <Badge variant="yellow">En Espera</Badge>;
          default: return <Badge variant="outline">Borrador</Badge>;
      }
  };

  // Helper para nombre de contractor
  const getContractorName = (id?: string) => {
      if (!id) return 'Agencia (Interno)';
      return contractors.find(c => c.id === id)?.name || 'Desconocido';
  };

  return (
    <div className="space-y-6 pb-20 relative min-h-screen">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-3">
                    <FileText className="w-8 h-8 text-indigo-600" /> Historial de Presupuestos
                </h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1">Doble clic para ver detalle financiero completo.</p>
            </div>
            <Button onClick={() => navigate('/sales-copilot')} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg">
                <Plus className="w-4 h-4 mr-2" /> Generar Nuevo
            </Button>
        </div>

        {/* Filtros */}
        <div className="bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-2">
             <div className="flex bg-gray-100 dark:bg-slate-800/50 p-1 rounded-xl flex-1 overflow-x-auto">
                {[
                    { id: 'ALL', label: 'Todos' },
                    { id: 'APPROVED', label: 'Aprobados' },
                    { id: 'WAITING', label: 'En Espera' },
                    { id: 'REJECTED', label: 'No Aprobados' }
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex-1 py-2 px-4 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${
                            activeTab === tab.id 
                            ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' 
                            : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
             </div>
             <div className="relative md:w-64">
                 <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                 <Input 
                    placeholder="Buscar cliente..." 
                    className="pl-9 bg-gray-50 dark:bg-slate-800/50 border-transparent h-full"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                 />
             </div>
        </div>

        {/* Lista */}
        <div className="grid grid-cols-1 gap-4">
            {loading && <div className="text-center py-10"><Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-600"/></div>}
            
            {!loading && filteredProposals.map((proposal) => {
                const finance = calculateFinancials(proposal);
                
                return (
                    <div 
                        key={proposal.id}
                        onContextMenu={(e) => {
                            e.preventDefault();
                            setContextMenu({ visible: true, x: e.pageX, y: e.pageY, proposal });
                        }}
                        onDoubleClick={() => handleOpenDetail(proposal)} // DOBLE CLIC AQUÍ
                    >
                        <Card className="group hover:shadow-md transition-all border-l-4 border-l-transparent hover:border-l-indigo-500 cursor-pointer select-none">
                            <div className="p-5 flex flex-col md:flex-row justify-between gap-6">
                                <div className="flex-1 space-y-2">
                                    <div className="flex items-center gap-3 mb-1">
                                        {getStatusBadge(proposal.status)}
                                        <span className="text-xs text-gray-400 font-mono flex items-center gap-1">
                                            <Clock className="w-3 h-3"/> {new Date(proposal.createdAt).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                        {proposal.client?.name || 'Cliente Potencial'}
                                    </h3>
                                    
                                    {/* Servicios (Tags) */}
                                    {proposal.items && proposal.items.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {proposal.items.map((item: any) => (
                                                <Badge key={item.id} variant="outline" className="text-[10px] opacity-70">
                                                    {item.serviceSnapshotName}
                                                </Badge>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Valor Total del Contrato (Visualización Principal) */}
                                <div className="flex flex-col items-end justify-center border-l pl-4 border-gray-100 dark:border-slate-800">
                                    <span className="text-xl font-black text-gray-900 dark:text-white">
                                        ${finance.totalContractRevenue.toLocaleString()}
                                    </span>
                                    <span className="text-xs text-gray-400 uppercase font-bold tracking-wider">Valor Contrato Total</span>
                                    {finance.duration > 1 && (
                                        <span className="text-[10px] text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 px-1.5 py-0.5 rounded mt-1">
                                            {finance.duration} meses
                                        </span>
                                    )}
                                </div>
                            </div>
                        </Card>
                    </div>
                );
            })}
        </div>

        {/* --- MENÚ CONTEXTUAL --- */}
        {contextMenu.visible && (
            <div 
                className="fixed bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-100 dark:border-slate-700 py-1 z-50 w-60 animate-in fade-in zoom-in-95 duration-100 overflow-hidden"
                style={{ top: contextMenu.y, left: contextMenu.x }}
            >
                <div className="px-4 py-2 border-b border-gray-100 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-900/50">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Acciones Rápidas</p>
                </div>
                <div className="p-1 space-y-0.5">
                    <button onClick={handleQuickApprove} className="w-full text-left px-3 py-2 text-sm text-emerald-600 hover:bg-emerald-50 rounded-lg flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4"/> Aprobar Totalmente
                    </button>
                    <button onClick={handleSetWaiting} className="w-full text-left px-3 py-2 text-sm text-amber-600 hover:bg-amber-50 rounded-lg flex items-center gap-2">
                        <Clock className="w-4 h-4"/> En Espera
                    </button>
                    <button onClick={handleReject} className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-2">
                        <XCircle className="w-4 h-4"/> Rechazar
                    </button>
                </div>
            </div>
        )}

        {/* --- MODAL DETALLE FINANCIERO (DOBLE CLIC) --- */}
        <Modal 
            isOpen={isDetailModalOpen} 
            onClose={() => setIsDetailModalOpen(false)} 
            title="Detalle Económico del Proyecto"
        >
            {selectedDetailProposal && (() => {
                const fin = calculateFinancials(selectedDetailProposal);
                
                return (
                    <div className="space-y-6">
                        {/* 1. Header del Modal */}
                        <div className="flex justify-between items-start">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                                    {selectedDetailProposal.client?.name}
                                </h2>
                                <div className="flex items-center gap-2 mt-1">
                                    {getStatusBadge(selectedDetailProposal.status)}
                                    <span className="text-sm text-gray-500">
                                        Duración: <b>{fin.duration} meses</b>
                                    </span>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-gray-500 uppercase font-bold">Valor Total Contrato</p>
                                <p className="text-3xl font-black text-indigo-600 dark:text-indigo-400">
                                    ${fin.totalContractRevenue.toLocaleString()}
                                </p>
                            </div>
                        </div>

                        {/* 2. Tarjetas de Finanzas (Tus Ganancias vs Gastos) */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-800">
                                <div className="flex items-center gap-2 mb-2 text-emerald-700 dark:text-emerald-300">
                                    <Wallet className="w-5 h-5"/>
                                    <span className="font-bold text-sm">Tu Ganancia Neta</span>
                                </div>
                                <p className="text-2xl font-bold text-emerald-800 dark:text-emerald-200">
                                    ${fin.netProfit.toLocaleString()}
                                </p>
                                <p className="text-xs text-emerald-600 mt-1">Margen: {fin.margin}%</p>
                            </div>

                            <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-xl border border-red-100 dark:border-red-800">
                                <div className="flex items-center gap-2 mb-2 text-red-700 dark:text-red-300">
                                    <User className="w-5 h-5"/>
                                    <span className="font-bold text-sm">Gastos de Equipo</span>
                                </div>
                                <p className="text-2xl font-bold text-red-800 dark:text-red-200">
                                    ${fin.totalContractCost.toLocaleString()}
                                </p>
                                <p className="text-xs text-red-600 mt-1">Pago a socios/terceros</p>
                            </div>

                            <div className="bg-gray-50 dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700">
                                <div className="flex items-center gap-2 mb-2 text-gray-700 dark:text-gray-300">
                                    <Calendar className="w-5 h-5"/>
                                    <span className="font-bold text-sm">Facturación Mensual</span>
                                </div>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                    ${fin.revenueRecurring.toLocaleString()}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">Pago recurrente del cliente</p>
                            </div>
                        </div>

                        {/* 3. Tabla de Servicios y Asignaciones */}
                        <div>
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                                <Briefcase className="w-4 h-4"/> Desglose de Servicios & Equipo
                            </h3>
                            <div className="border border-gray-200 dark:border-slate-800 rounded-xl overflow-hidden">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50 dark:bg-slate-900 text-gray-500 font-medium">
                                        <tr>
                                            <th className="p-3">Servicio</th>
                                            <th className="p-3">Responsable (Socio)</th>
                                            <th className="p-3 text-right">Cobro Cliente</th>
                                            <th className="p-3 text-right">Pago Socio</th>
                                            <th className="p-3 text-right">Tu Margen</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                                        {selectedDetailProposal.items?.map((item: any) => {
                                            const profit = item.serviceSnapshotCost - (item.outsourcingCost || 0);
                                            return (
                                                <tr key={item.id} className="bg-white dark:bg-slate-800">
                                                    <td className="p-3 font-medium text-gray-900 dark:text-white">
                                                        {item.serviceSnapshotName}
                                                        <div className="text-xs text-gray-400 font-normal">{item.serviceSnapshotType === 'RECURRING' ? 'Mensual' : 'Único'}</div>
                                                    </td>
                                                    <td className="p-3 text-indigo-600">
                                                        {getContractorName(item.assignedContractorId)}
                                                    </td>
                                                    <td className="p-3 text-right font-bold">
                                                        ${item.serviceSnapshotCost.toLocaleString()}
                                                    </td>
                                                    <td className="p-3 text-right text-red-500 font-medium">
                                                        - ${item.outsourcingCost?.toLocaleString() || 0}
                                                    </td>
                                                    <td className="p-3 text-right text-emerald-600 font-bold">
                                                        ${profit.toLocaleString()}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="flex justify-end pt-2">
                            <Button onClick={() => setIsDetailModalOpen(false)} variant="secondary">
                                Cerrar Detalle
                            </Button>
                        </div>
                    </div>
                );
            })()}
        </Modal>

    </div>
  );
}