import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/db';
import { Proposal, Contractor, ProposalStatus } from '../types';
import { Button, Input, Card, Badge, Modal, Label } from '../components/UIComponents';
import { 
  FileText, Plus, CheckCircle2, XCircle, Clock, 
  Search, MoreVertical, Send, AlertCircle, Loader2, 
  Wallet, User, Calendar, Briefcase, Edit, ArrowRight, Eye, Trash2 // Importamos Trash2
} from 'lucide-react';
import { useToast } from '../components/Toast';

export default function QuotationsPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  
  // --- ESTADOS ---
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [clients, setClients] = useState<any[]>([]); // Added clients state
  const [loading, setLoading] = useState(true);
  
  // Filtros
  const [activeTab, setActiveTab] = useState<'ALL' | 'WAITING' | 'APPROVED' | 'REJECTED' | 'EXPIRED'>('ALL');
  const [selectedClientId, setSelectedClientId] = useState<string>('ALL'); // Changed from searchTerm
  const [filterMonth, setFilterMonth] = useState('');

  // Menú Contextual
  const [contextMenu, setContextMenu] = useState<{ visible: boolean, x: number, y: number, proposal: Proposal | null }>({
      visible: false, x: 0, y: 0, proposal: null
  });

  // Modales
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedDetailProposal, setSelectedDetailProposal] = useState<Proposal | null>(null);

  // Modal Aprobación Parcial
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [assignments, setAssignments] = useState<Record<string, { contractorId: string, cost: number }>>({});
  const [approvedDuration, setApprovedDuration] = useState<number>(1);
  const [approvedStartDate, setApprovedStartDate] = useState<string>(''); // NEW

  useEffect(() => {
    loadData();
    const handleClickOutside = () => setContextMenu({ ...contextMenu, visible: false });
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [propsData, contsData, clientsData] = await Promise.all([
        db.proposals.getAll(),
        db.contractors.getAll(),
        db.clients.getAll()
    ]);
    setProposals(propsData);
    setContractors(contsData);
    setClients(clientsData);
    setLoading(false);
  };

  // --- CÁLCULOS FINANCIEROS ---
  const calculateFinancials = (proposal: Proposal, overrideDuration?: number, overrideItems?: string[]) => {
      const duration = overrideDuration !== undefined ? overrideDuration : (proposal.durationMonths || 1);
      
      let revenueRecurring = 0;
      let revenueOneTime = 0;
      let costRecurring = 0;
      let costOneTime = 0;

      const itemsToCalc = overrideItems 
          ? (proposal.items || []).filter(i => overrideItems.includes(i.id))
          : (proposal.items || []);

      itemsToCalc.forEach(item => {
          if (item.serviceSnapshotType === 'RECURRING') {
              revenueRecurring += item.serviceSnapshotCost;
              costRecurring += (item.outsourcingCost || 0);
          } else {
              revenueOneTime += item.serviceSnapshotCost;
              costOneTime += (item.outsourcingCost || 0);
          }
      });

      const totalContractRevenue = (revenueRecurring * duration) + revenueOneTime;
      const totalContractCost = (costRecurring * duration) + costOneTime;
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
  const handleOpenDetail = (proposal: Proposal) => {
      setSelectedDetailProposal(proposal);
      setIsDetailModalOpen(true);
  };

  // ✅ ACCIÓN PRINCIPAL: IR AL COTIZADOR (CALCULATOR)
  const handleViewInCopilot = (proposal: Proposal) => {
      navigate(`/calculator?proposalId=${proposal.id}`);
  };

  const handleQuickApprove = async () => {
      if (!contextMenu.proposal) return;
      try {
          const items = await db.proposals.getItems(contextMenu.proposal.id);
          const allItemIds = items.map(i => i.id);
          await db.proposals.approve(contextMenu.proposal.id, allItemIds, {}, contextMenu.proposal.durationMonths);
          showToast("✅ Presupuesto Aprobado", "success");
          loadData();
      } catch (e) { showToast("Error al aprobar", "error"); }
  };

  const handleApprovePartial = async () => {
      if (!contextMenu.proposal) return;
      const items = await db.proposals.getItems(contextMenu.proposal.id);
      const propWithItems = { ...contextMenu.proposal, items };
      
      setSelectedProposal(propWithItems);
      setSelectedItemIds(items.map(i => i.id));
      setAssignments({});
      setApprovedDuration(propWithItems.durationMonths || 1);
      setApprovedStartDate(new Date().toISOString().split('T')[0]); // Default today
      setIsApproveModalOpen(true);
      setContextMenu({ ...contextMenu, visible: false });
  };

  const confirmApprovalModal = async () => {
      if (!selectedProposal) return;
      try {
          await db.proposals.approve(selectedProposal.id, selectedItemIds, assignments, approvedDuration, approvedStartDate);
          showToast("Gestión completada con éxito", "success");
          setIsApproveModalOpen(false);
          loadData();
      } catch (e) {
          console.error(e);
          showToast("Error al procesar", "error");
      }
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

  const handleDeleteProposal = async (id: string, e?: React.MouseEvent) => {
      if (e) e.stopPropagation();
      // First confirmation
      if (confirm("¿Estás seguro de que quieres eliminar este presupuesto?")) {
          // Second confirmation (double check as requested)
          if (confirm("Esta acción no se puede deshacer. ¿Confirmas la eliminación definitiva?")) {
              try {
                  await db.proposals.delete(id);
                  showToast("🗑️ Presupuesto eliminado", "success");
                  loadData();
                  setContextMenu({ ...contextMenu, visible: false });
              } catch (error) {
                  console.error(error);
                  showToast("Error al eliminar", "error");
              }
          }
      }
  };

  // --- HELPERS VISUALES ---
  const getStatusBadge = (status: ProposalStatus) => {
      switch (status) {
          case ProposalStatus.ACCEPTED: return <Badge variant="green">Aprobado</Badge>;
          case ProposalStatus.PARTIALLY_ACCEPTED: return <Badge variant="blue">Parcial</Badge>;
          case ProposalStatus.REJECTED: return <Badge variant="red">Rechazada</Badge>;
          case ProposalStatus.SENT: return <Badge variant="yellow">En Espera</Badge>;
          default: return <Badge variant="outline">Borrador</Badge>;
      }
  };

      const matchesClient = selectedClientId === 'ALL' || p.clientId === selectedClientId;
      
      let matchesTab = true;
      if (activeTab === 'WAITING') matchesTab = p.status === ProposalStatus.SENT || p.status === ProposalStatus.DRAFT;
      if (activeTab === 'APPROVED') matchesTab = p.status === ProposalStatus.ACCEPTED || p.status === ProposalStatus.PARTIALLY_ACCEPTED;
      if (activeTab === 'REJECTED') matchesTab = p.status === ProposalStatus.REJECTED;
      if (activeTab === 'EXPIRED') {
          const daysOld = (new Date().getTime() - new Date(p.createdAt).getTime()) / (1000 * 3600 * 24);
          matchesTab = daysOld > 15 && p.status !== ProposalStatus.ACCEPTED && p.status !== ProposalStatus.PARTIALLY_ACCEPTED && p.status !== ProposalStatus.REJECTED;
      }

      let matchesMonth = true;
      if (filterMonth) {
          const date = new Date(p.createdAt);
          const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          matchesMonth = monthStr === filterMonth;
      }

      return matchesClient && matchesTab && matchesMonth;
  });

  return (
    <div className="space-y-6 pb-20 relative min-h-screen">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-3">
                    <FileText className="w-8 h-8 text-indigo-600" /> Historial de Presupuestos
                </h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1">Gestión financiera y estados.</p>
            </div>
            <Button onClick={() => navigate('/calculator')} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg">
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
                    { id: 'REJECTED', label: 'No Aprobados' },
                    { id: 'EXPIRED', label: 'Vencidos' }
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
             <div className="flex gap-2 w-full md:w-auto">
                 <div className="relative flex-1 md:w-64">
                     <select
                        className="w-full bg-gray-50 dark:bg-slate-800/50 border-transparent rounded-lg h-full px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-indigo-500"
                        value={selectedClientId}
                        onChange={e => setSelectedClientId(e.target.value)}
                     >
                        <option value="ALL">Todos los Clientes</option>
                        {clients.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                     </select>
                 </div>
                 <div className="w-40">
                    <Input 
                        type="month" 
                        value={filterMonth}
                        onChange={e => setFilterMonth(e.target.value)}
                        className="bg-gray-50 dark:bg-slate-800/50 border-transparent h-full"
                    />
                 </div>
             </div>
        </div>

        {/* Lista en Tabla */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 overflow-hidden shadow-sm">
            {loading && <div className="text-center py-10"><Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-600"/></div>}
            
            {!loading && (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 dark:bg-slate-950 text-gray-500 uppercase font-bold text-xs">
                            <tr>
                                <th className="px-6 py-4">Fecha</th>
                                <th className="px-6 py-4">Cliente</th>
                                <th className="px-6 py-4">Estado</th>
                                <th className="px-6 py-4 hidden md:table-cell">Servicios</th>
                                <th className="px-6 py-4 text-right">Valor Total</th>
                                <th className="px-6 py-4 text-right">Profit</th>
                                <th className="px-6 py-4 text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                            {filteredProposals.map((proposal) => {
                                const finance = calculateFinancials(proposal);
                                return (
                                    <tr 
                                        key={proposal.id}
                                        className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors group cursor-pointer"
                                        onContextMenu={(e) => {
                                            e.preventDefault();
                                            setContextMenu({ visible: true, x: e.pageX, y: e.pageY, proposal });
                                        }}
                                        onDoubleClick={() => handleOpenDetail(proposal)}
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                                            {new Date(proposal.createdAt).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-gray-900 dark:text-white">{proposal.client?.name || 'Cliente Potencial'}</div>
                                            {proposal.client?.industry && <div className="text-xs text-gray-400">{proposal.client.industry}</div>}
                                        </td>
                                        <td className="px-6 py-4">
                                            {getStatusBadge(proposal.status)}
                                        </td>
                                        <td className="px-6 py-4 hidden md:table-cell">
                                            <div className="flex -space-x-2">
                                                {(proposal.items || []).slice(0, 3).map((item, idx) => (
                                                    <div key={idx} className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900 border-2 border-white dark:border-slate-800 flex items-center justify-center text-[10px] font-bold text-indigo-600" title={item.serviceSnapshotName}>
                                                        {item.serviceSnapshotName.charAt(0)}
                                                    </div>
                                                ))}
                                                {(proposal.items || []).length > 3 && (
                                                    <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-slate-800 border-2 border-white dark:border-slate-800 flex items-center justify-center text-[8px] font-bold text-gray-500">
                                                        +{proposal.items.length - 3}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="font-black text-gray-900 dark:text-white text-base">
                                                ${finance.totalContractRevenue.toLocaleString()}
                                            </div>
                                            <div className="text-xs text-indigo-500 font-medium">
                                                {finance.duration} meses
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="font-bold text-emerald-600 dark:text-emerald-400">
                                                ${finance.netProfit.toLocaleString()}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 flex justify-center gap-2">
                                            <Button 
                                                size="sm" 
                                                variant="ghost" 
                                                className="h-8 w-8 p-0"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleOpenDetail(proposal);
                                                }}
                                            >
                                                <Eye className="w-4 h-4 text-gray-400 hover:text-indigo-600" />
                                            </Button>
                                            <Button 
                                                size="sm" 
                                                variant="ghost" 
                                                className="h-8 w-8 p-0"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleViewInCopilot(proposal);
                                                }}
                                            >
                                                <Edit className="w-4 h-4 text-gray-400 hover:text-blue-600" />
                                            </Button>
                                            <Button 
                                                size="sm" 
                                                variant="ghost" 
                                                className="h-8 w-8 p-0"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setContextMenu({ visible: true, x: e.pageX, y: e.pageY, proposal });
                                                }}
                                            >
                                                <MoreVertical className="w-4 h-4 text-gray-400" />
                                            </Button>
                                            <Button 
                                                size="sm" 
                                                variant="ghost" 
                                                className="h-8 w-8 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50"
                                                onClick={(e) => handleDeleteProposal(proposal.id, e)}
                                                title="Eliminar"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>

        {/* ... (Menú Contextual y Modales se mantienen igual) ... */}
        {contextMenu.visible && (
            <div className="fixed bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-100 dark:border-slate-700 py-1 z-50 w-60 animate-in fade-in zoom-in-95 duration-100 overflow-hidden" style={{ top: contextMenu.y, left: contextMenu.x }}>
                <div className="px-4 py-2 border-b border-gray-100 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-900/50">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Acciones</p>
                </div>
                <div className="p-1 space-y-0.5">
                    <button onClick={handleApprovePartial} className="w-full text-left px-3 py-2 text-sm text-emerald-600 hover:bg-emerald-50 rounded-lg flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4"/> Aprobar / Configurar
                    </button>
                    <button onClick={handleSetWaiting} className="w-full text-left px-3 py-2 text-sm text-amber-600 hover:bg-amber-50 rounded-lg flex items-center gap-2">
                        <Clock className="w-4 h-4"/> En Espera
                    </button>
                    <button onClick={handleReject} className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-2">
                        <XCircle className="w-4 h-4"/> Rechazar
                    </button>
                    <div className="my-1 border-t border-gray-100 dark:border-slate-700"></div>
                    <button onClick={() => contextMenu.proposal && handleDeleteProposal(contextMenu.proposal.id)} className="w-full text-left px-3 py-2 text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-2">
                        <Trash2 className="w-4 h-4"/> Eliminar Definitivamente
                    </button>
                </div>
            </div>
        )}

        {/* Modal Detalle (Modificado para usar el nuevo botón también) */}
        <Modal isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} title="Detalle Económico del Proyecto">
            {selectedDetailProposal && (() => {
                const fin = calculateFinancials(selectedDetailProposal);
                return (
                    <div className="space-y-6">
                        <div className="flex justify-between items-start">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{selectedDetailProposal.client?.name}</h2>
                                <div className="flex items-center gap-2 mt-1">
                                    {getStatusBadge(selectedDetailProposal.status)}
                                    <span className="text-sm text-gray-500">Duración: <b>{fin.duration} meses</b></span>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-gray-500 uppercase font-bold">Valor Total Contrato</p>
                                <p className="text-3xl font-black text-indigo-600 dark:text-indigo-400">${fin.totalContractRevenue.toLocaleString()}</p>
                            </div>
                        </div>
                        {/* ... Grids de finanzas ... */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-800">
                                <p className="text-sm font-bold text-emerald-700">Tu Ganancia Neta</p>
                                <p className="text-2xl font-bold text-emerald-800 dark:text-emerald-200">${fin.netProfit.toLocaleString()}</p>
                            </div>
                            <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-xl border border-red-100 dark:border-red-800">
                                <p className="text-sm font-bold text-red-700">Gastos de Equipo</p>
                                <p className="text-2xl font-bold text-red-800 dark:text-red-200">${fin.totalContractCost.toLocaleString()}</p>
                            </div>
                            <div className="bg-gray-50 dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700">
                                <p className="text-sm font-bold text-gray-700 dark:text-gray-300">Mensualidad</p>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">${fin.revenueRecurring.toLocaleString()}</p>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-2">
                             <Button 
                                variant="outline"
                                onClick={() => {
                                    setIsDetailModalOpen(false);
                                    handleViewInCopilot(selectedDetailProposal);
                                }}
                            >
                                <Eye className="w-4 h-4 mr-2"/> Ver Detalle Completo
                            </Button>
                            <Button onClick={() => setIsDetailModalOpen(false)} variant="secondary">Cerrar</Button>
                        </div>
                    </div>
                );
            })()}
        </Modal>

        {/* Modal de Aprobación (Mismo código que tenías) */}
        <Modal isOpen={isApproveModalOpen} onClose={() => setIsApproveModalOpen(false)} title="Confirmar Contrato & Fecha de Inicio">
             {selectedProposal && (() => {
                 const previewFin = calculateFinancials(selectedProposal, approvedDuration, selectedItemIds);
                 return (
                    <div className="space-y-6">
                        {/* ... contenido del modal ... */}
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                            <div className="text-sm text-blue-800 dark:text-blue-200">
                                <p className="font-bold">Ajuste de Propuesta</p>
                                <p>Modifica la duración o selecciona solo los servicios que el cliente aceptó.</p>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700">
                            <Label className="mb-2 block font-bold">Duración del Contrato (Meses)</Label>
                            <div className="flex items-center gap-4">
                                <Input type="number" min={1} max={60} value={approvedDuration} onChange={(e) => setApprovedDuration(Number(e.target.value))} className="w-24 text-center font-bold text-lg" />
                                <div className="text-sm text-gray-500">
                                    <p>Nuevo Total Estimado:</p>
                                    <p className="font-bold text-indigo-600 text-lg">${previewFin.totalContractRevenue.toLocaleString()}</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700">
                             <Label className="mb-2 block font-bold">Fecha de Inicio (Cobro)</Label>
                             <div className="flex items-center gap-2">
                                <Calendar className="w-5 h-5 text-gray-500"/>
                                <Input type="date" value={approvedStartDate} onChange={e => setApprovedStartDate(e.target.value)} />
                             </div>
                             <p className="text-xs text-gray-400 mt-2">Esta fecha determinará el día de cobro mensual.</p>
                        </div>

                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                            <Label className="font-bold">Servicios Incluidos</Label>
                            {selectedProposal.items?.map(item => {
                                const isSelected = selectedItemIds.includes(item.id);
                                return (
                                    <div key={item.id} className={`border rounded-xl p-3 transition-all ${isSelected ? 'bg-white dark:bg-slate-800 border-indigo-200 shadow-sm' : 'bg-gray-50 dark:bg-slate-900 opacity-60'}`}>
                                        <div className="flex justify-between items-center cursor-pointer" onClick={() => { if (isSelected) setSelectedItemIds(selectedItemIds.filter(id => id !== item.id)); else setSelectedItemIds([...selectedItemIds, item.id]); }}>
                                            <div className="flex items-center gap-3">
                                                <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'}`}>
                                                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-gray-900 dark:text-white text-sm">{item.serviceSnapshotName}</p>
                                                    <p className="text-xs text-gray-500">${item.serviceSnapshotCost.toLocaleString()}</p>
                                                </div>
                                            </div>
                                            <Badge variant={item.serviceSnapshotType === 'RECURRING' ? 'blue' : 'yellow'}>{item.serviceSnapshotType === 'RECURRING' ? 'Mensual' : 'Único'}</Badge>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="flex gap-3 pt-2 border-t border-gray-100 dark:border-slate-700">
                            <Button variant="secondary" onClick={() => setIsApproveModalOpen(false)} className="flex-1">Cancelar</Button>
                            <Button onClick={confirmApprovalModal} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white" disabled={selectedItemIds.length === 0}>Confirmar y Activar Contrato</Button>
                        </div>
                    </div>
                 );
             })()}
        </Modal>

    </div>
  );
}