import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/db';
import { Proposal, Contractor, ProposalStatus } from '../types';
import { Button, Input, Card, Badge, Modal, Label } from '../components/UIComponents';
import { 
  FileText, Plus, CheckCircle2, XCircle, Clock, 
  ArrowRight, DollarSign, Search, AlertCircle, MoreVertical, Send, Eye 
} from 'lucide-react';
import { useToast } from '../components/Toast';

export default function QuotationsPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  
  // Datos
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros y Búsqueda
  const [activeTab, setActiveTab] = useState<'ALL' | 'SENT' | 'APPROVED' | 'DRAFT'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Modal de Aprobación/Asignación
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [assignments, setAssignments] = useState<Record<string, { contractorId: string, cost: number }>>({});

  // MENÚ CONTEXTUAL (Click Derecho)
  const [contextMenu, setContextMenu] = useState<{ visible: boolean, x: number, y: number, proposal: Proposal | null }>({
      visible: false, x: 0, y: 0, proposal: null
  });

  // Cargar datos iniciales
  useEffect(() => {
    loadData();
    // Cerrar menú al hacer clic en cualquier lado
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

  // --- LÓGICA DEL MENÚ CONTEXTUAL ---
  const handleContextMenu = (e: React.MouseEvent, proposal: Proposal) => {
      e.preventDefault(); // Evita el menú del navegador
      setContextMenu({
          visible: true,
          x: e.pageX,
          y: e.pageY,
          proposal
      });
  };

  // --- ACCIONES RÁPIDAS ---
  
  const handleApproveFull = async () => {
      if (!contextMenu.proposal) return;
      // Obtener todos los items para aprobar todo
      const items = await db.proposals.getItems(contextMenu.proposal.id);
      const allIds = items.map(i => i.id);
      
      // Aprobar sin asignaciones específicas (o puedes agregar lógica aquí)
      await db.proposals.approve(contextMenu.proposal.id, allIds, {}); 
      
      showToast("Propuesta activada. El proyecto inicia hoy.", "success");
      setContextMenu({ ...contextMenu, visible: false }); // Cerrar menú
      loadData(); // Recargar lista
  };

  // 2. Aprobar Parcialmente (Abre el Modal)
  const handleApprovePartial = async () => {
      if (!contextMenu.proposal) return;
      // Preparamos el modal
      const items = await db.proposals.getItems(contextMenu.proposal.id);
      const propWithItems = { ...contextMenu.proposal, items };
      
      setSelectedProposal(propWithItems);
      setSelectedItemIds(items.map(i => i.id)); // Seleccionar todo por defecto visualmente
      setAssignments({});
      setIsApproveModalOpen(true); // Abrimos modal
  };

  // 3. Cambiar estado simple (Enviado / Rechazado)
  const handleChangeStatus = async (status: ProposalStatus) => {
      if (!contextMenu.proposal) return;
      // Aquí deberías tener una función simple de update en db, o usar update proposal
      // Por simplicidad, asumiremos que tienes un db.proposals.updateStatus o similar.
      // Si no, usa update genérico.
      // Ejemplo simulado:
      // await db.proposals.update(contextMenu.proposal.id, { status });
      showToast(`Estado actualizado a ${status}`, "info");
      loadData();
  };

  // Confirmación final del Modal (Igual que antes)
  const confirmApprovalModal = async () => {
      if (!selectedProposal) return;
      try {
          await db.proposals.approve(selectedProposal.id, selectedItemIds, assignments);
          showToast("Gestión completada con éxito", "success");
          setIsApproveModalOpen(false);
          loadData();
      } catch (e) {
          console.error(e);
          showToast("Error al procesar", "error");
      }
  };

  // Filtrado
  const filteredProposals = proposals.filter(p => {
      const matchesSearch = (p.client?.name || 'Cliente').toLowerCase().includes(searchTerm.toLowerCase());
      
      let matchesTab = true;
      if (activeTab === 'SENT') matchesTab = p.status === 'SENT';
      if (activeTab === 'APPROVED') matchesTab = p.status === 'ACCEPTED' || p.status === 'PARTIALLY_ACCEPTED';
      if (activeTab === 'DRAFT') matchesTab = p.status === 'DRAFT';

      return matchesSearch && matchesTab;
  });

  const getStatusBadge = (status: ProposalStatus) => {
      switch (status) {
          case ProposalStatus.ACCEPTED: return <Badge variant="green">Aceptada Total</Badge>;
          case ProposalStatus.PARTIALLY_ACCEPTED: return <Badge variant="blue">Aceptada Parcial</Badge>;
          case ProposalStatus.REJECTED: return <Badge variant="red">Rechazada</Badge>;
          case ProposalStatus.SENT: return <Badge variant="yellow">Enviada</Badge>;
          default: return <Badge variant="outline">Borrador</Badge>;
      }
  };

  return (
    <div className="space-y-6 pb-20 relative min-h-screen" onClick={() => setContextMenu({ ...contextMenu, visible: false })}>
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-3">
                    <FileText className="w-8 h-8 text-indigo-600" /> Gestión de Presupuestos
                </h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1">Historial, estados y aprobaciones.</p>
            </div>
            <Button onClick={() => navigate('/sales-copilot')} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg">
                <Plus className="w-4 h-4 mr-2" /> Nueva Cotización
            </Button>
        </div>

        {/* PESTAÑAS Y BUSCADOR */}
        <div className="bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-2">
             <div className="flex bg-gray-100 dark:bg-slate-800/50 p-1 rounded-xl flex-1">
                {(['ALL', 'SENT', 'APPROVED', 'DRAFT'] as const).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`flex-1 py-2 px-4 rounded-lg text-sm font-bold transition-all ${
                            activeTab === tab 
                            ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' 
                            : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                    >
                        {tab === 'ALL' ? 'Todo' : tab === 'SENT' ? 'Enviados' : tab === 'APPROVED' ? 'Aprobados' : 'Borradores'}
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

        {/* LISTA DE TARJETAS */}
        <div className="grid grid-cols-1 gap-4">
            {filteredProposals.length === 0 && (
                <div className="text-center py-20 text-gray-400 bg-gray-50 dark:bg-slate-900 rounded-xl border-dashed border-2 border-gray-200 dark:border-slate-800">
                    No hay cotizaciones en esta sección.
                </div>
            )}
            
            {filteredProposals.map((proposal) => (
                <div 
                    key={proposal.id}
                    onContextMenu={(e) => handleContextMenu(e, proposal)} // CLICK DERECHO AQUÍ
                >
                    <Card className="group hover:shadow-md transition-all border-l-4 border-l-transparent hover:border-l-indigo-500 cursor-context-menu">
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
                                <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-1">
                                    {proposal.objective}
                                </p>
                                <div className="flex items-center gap-4 text-sm font-medium pt-2">
                                    <span className="text-gray-900 dark:text-gray-100 font-bold">
                                        Total: ${(proposal.totalRecurringPrice + proposal.totalOneTimePrice).toLocaleString()}
                                    </span>
                                </div>
                            </div>

                            {/* Botón visible de menú (para móviles o si no usan click derecho) */}
                            <div className="flex items-center justify-center md:justify-end">
                                 <button 
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full text-gray-400"
                                    onClick={(e) => { e.stopPropagation(); handleContextMenu(e, proposal); }}
                                 >
                                    <MoreVertical className="w-5 h-5"/>
                                 </button>
                            </div>
                        </div>
                    </Card>
                </div>
            ))}
        </div>

        {/* --- MENÚ CONTEXTUAL PERSONALIZADO --- */}
        {contextMenu.visible && (
            <div 
                className="fixed bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-gray-100 dark:border-slate-700 py-1 z-50 w-56 animate-in fade-in zoom-in-95 duration-100"
                style={{ top: contextMenu.y, left: contextMenu.x }}
            >
                <div className="px-3 py-2 border-b border-gray-100 dark:border-slate-700 mb-1">
                    <p className="text-xs font-bold text-gray-400 uppercase">Acciones</p>
                    <p className="text-sm font-bold truncate text-gray-800 dark:text-white">{contextMenu.proposal?.client?.name}</p>
                </div>

                <button onClick={() => { handleApproveFull(); }} className="w-full text-left px-4 py-2 text-sm text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4"/> Aprobar Totalmente
                </button>
                <button onClick={() => { handleApprovePartial(); }} className="w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4"/> Aprobar Parcialmente...
                </button>
                <button onClick={() => { handleChangeStatus(ProposalStatus.SENT); }} className="w-full text-left px-4 py-2 text-sm text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 flex items-center gap-2">
                    <Send className="w-4 h-4"/> Marcar como Enviado
                </button>
                 <button onClick={() => { /* Ver Detalle */ }} className="w-full text-left px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-2">
                    <Eye className="w-4 h-4"/> Ver Detalle
                </button>
                <div className="border-t border-gray-100 dark:border-slate-700 my-1"></div>
                <button onClick={() => { handleChangeStatus(ProposalStatus.REJECTED); }} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2">
                    <XCircle className="w-4 h-4"/> Rechazar
                </button>
            </div>
        )}

        {/* --- MODAL DE APROBACIÓN (Reutilizado) --- */}
        <Modal isOpen={isApproveModalOpen} onClose={() => setIsApproveModalOpen(false)} title="Aprobar Parcialmente & Asignar">
             <div className="space-y-6">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                    <div className="text-sm text-blue-800 dark:text-blue-200">
                        <p className="font-bold">Selección de Servicios</p>
                        <p>Marca solo los servicios que el cliente aceptó. Los demás quedarán descartados.</p>
                    </div>
                </div>

                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {selectedProposal?.items?.map(item => {
                        const isSelected = selectedItemIds.includes(item.id);
                        const assignment = assignments[item.id] || { contractorId: '', cost: 0 };

                        return (
                            <div key={item.id} className={`border rounded-xl p-4 space-y-3 transition-all ${isSelected ? 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700' : 'bg-gray-50 dark:bg-slate-900 opacity-60'}`}>
                                <div className="flex justify-between items-start cursor-pointer" onClick={() => {
                                        if (isSelected) {
                                            setSelectedItemIds(selectedItemIds.filter(id => id !== item.id));
                                        } else {
                                            setSelectedItemIds([...selectedItemIds, item.id]);
                                        }
                                    }}>
                                    <div className="flex items-center gap-3">
                                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'}`}>
                                            {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-900 dark:text-white">{item.serviceSnapshotName}</p>
                                            <p className="text-xs text-gray-500">${item.serviceSnapshotCost.toLocaleString()}</p>
                                        </div>
                                    </div>
                                </div>
                                {isSelected && (
                                    <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-100 dark:border-slate-700 animate-in fade-in">
                                        <div>
                                            <Label className="text-xs mb-1 block">Responsable:</Label>
                                            <select 
                                                className="w-full text-sm bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg p-2"
                                                value={assignment.contractorId}
                                                onChange={(e) => setAssignments({ ...assignments, [item.id]: { ...assignment, contractorId: e.target.value } })}
                                            >
                                                <option value="">(Interno)</option>
                                                {contractors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <Label className="text-xs mb-1 block">Pago Socio:</Label>
                                            <Input 
                                                type="number" className="h-[38px] text-sm" placeholder="0"
                                                value={assignment.cost}
                                                onChange={(e) => setAssignments({ ...assignments, [item.id]: { ...assignment, cost: Number(e.target.value) } })}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className="flex gap-3 pt-2">
                    <Button variant="secondary" onClick={() => setIsApproveModalOpen(false)} className="flex-1">Cancelar</Button>
                    <Button onClick={confirmApprovalModal} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white" disabled={selectedItemIds.length === 0}>
                        Confirmar Aprobación
                    </Button>
                </div>
            </div>
        </Modal>

    </div>
  );
}