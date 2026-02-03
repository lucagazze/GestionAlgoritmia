import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/db';
import { Proposal, Project, ProposalStatus, Contractor } from '../types';
import { Button, Input, Card, Badge, Modal, Label } from '../components/UIComponents';
import { 
  FileText, Plus, CheckCircle2, XCircle, Clock, 
  ArrowRight, DollarSign, Filter, Search, AlertCircle 
} from 'lucide-react';
import { useToast } from '../components/Toast';

export default function QuotationsPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Modal de Aprobación
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [assignments, setAssignments] = useState<Record<string, { contractorId: string, cost: number }>>({});

  useEffect(() => {
    loadProposals();
    loadContractors();
  }, []);

  const loadContractors = async () => {
      const data = await db.contractors.getAll();
      setContractors(data);
  };

  const loadProposals = async () => {
    setLoading(true);
    const data = await db.proposals.getAll();
    setProposals(data);
    setLoading(false);
  };

  const handleOpenApprove = async (proposal: Proposal) => {
    // Cargar items frescos para asegurar que tenemos todo
    const items = await db.proposals.getItems(proposal.id);
    const proposalWithItems = { ...proposal, items };
    
    setSelectedProposal(proposalWithItems);
    setSelectedItemIds(items.map(i => i.id)); // Por defecto seleccionar todo
    setIsApproveModalOpen(true);
  };

  const confirmApproval = async () => {
    if (!selectedProposal) return;
    try {
        await db.proposals.approve(selectedProposal.id, selectedItemIds, assignments);
        showToast("¡Propuesta aceptada y Cliente Activado! 🚀", "success");
        setIsApproveModalOpen(false);
        loadProposals();
    } catch (e) {
        console.error(e);
        showToast("Error al aprobar propuesta", "error");
    }
  };

  const getStatusBadge = (status: ProposalStatus) => {
      switch (status) {
          case ProposalStatus.ACCEPTED: return <Badge variant="green">Aceptada</Badge>;
          case ProposalStatus.PARTIALLY_ACCEPTED: return <Badge variant="blue">Parcial</Badge>;
          case ProposalStatus.REJECTED: return <Badge variant="red">Rechazada</Badge>;
          case ProposalStatus.SENT: return <Badge variant="yellow">Enviada</Badge>;
          default: return <Badge variant="outline">Borrador</Badge>;
      }
  };

  const filteredProposals = proposals.filter(p => {
      const matchesSearch = (p.client?.name || 'Cliente').toLowerCase().includes(searchTerm.toLowerCase()) || 
                            p.objective.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = filterStatus === 'ALL' || p.status === filterStatus;
      return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-3">
                    <FileText className="w-8 h-8 text-indigo-600" /> Cotizaciones
                </h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1">Gestiona presupuestos y cierra ventas.</p>
            </div>
            <Button onClick={() => navigate('/sales-copilot')} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg">
                <Plus className="w-4 h-4 mr-2" /> Nueva Cotización
            </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm">
             <div className="relative flex-1">
                 <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                 <Input 
                    placeholder="Buscar por cliente u objetivo..." 
                    className="pl-9 bg-gray-50 dark:bg-slate-800/50 border-transparent"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                 />
             </div>
             <div className="flex gap-2 overflow-x-auto pb-1 md:pb-0 no-scrollbar">
                {['ALL', 'DRAFT', 'SENT', 'ACCEPTED', 'PARTIALLY_ACCEPTED', 'REJECTED'].map(status => (
                    <button
                        key={status}
                        onClick={() => setFilterStatus(status)}
                        className={`px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                            filterStatus === status 
                            ? 'bg-black dark:bg-white text-white dark:text-black' 
                            : 'bg-gray-100 dark:bg-slate-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-slate-700'
                        }`}
                    >
                        {status === 'ALL' ? 'Todos' : status.replace('_', ' ')}
                    </button>
                ))}
             </div>
        </div>

        {/* List */}
        <div className="grid grid-cols-1 gap-4">
            {filteredProposals.length === 0 && (
                <div className="text-center py-20 text-gray-400">No se encontraron cotizaciones.</div>
            )}
            
            {filteredProposals.map((proposal) => (
                <Card key={proposal.id} className="group hover:shadow-md transition-all border-l-4 border-l-transparent hover:border-l-indigo-500">
                    <div className="p-5 flex flex-col md:flex-row justify-between gap-6">
                        
                        <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-3 mb-1">
                                {getStatusBadge(proposal.status)}
                                <span className="text-xs text-gray-400 font-mono">{new Date(proposal.createdAt).toLocaleDateString()}</span>
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                {proposal.client?.name || 'Cliente Potencial'}
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-1">
                                {proposal.objective}
                            </p>
                            <div className="flex items-center gap-4 text-sm font-medium pt-2">
                                <span className="flex items-center text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-md">
                                    <DollarSign className="w-3 h-3 mr-1"/> Recurrente: ${proposal.totalRecurringPrice.toLocaleString()}
                                </span>
                                {proposal.totalOneTimePrice > 0 && (
                                    <span className="flex items-center text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-md">
                                        <DollarSign className="w-3 h-3 mr-1"/> Único: ${proposal.totalOneTimePrice.toLocaleString()}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex md:flex-col items-center justify-center gap-2 border-t md:border-t-0 md:border-l border-gray-100 dark:border-slate-800 pt-4 md:pt-0 md:pl-6">
                             {(proposal.status === 'DRAFT' || proposal.status === 'SENT') && (
                                 <Button 
                                    onClick={() => handleOpenApprove(proposal)}
                                    size="sm" 
                                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                                 >
                                     <CheckCircle2 className="w-4 h-4 mr-2" /> Aprobar
                                 </Button>
                             )}
                             
                             <Button 
                                variant="outline" 
                                size="sm" 
                                className="w-full"
                                // Aquí podrías redirigir al detalle si tuvieras una página de detalle
                                onClick={() => showToast("Funcionalidad de ver detalle pendiente", "info")}
                             >
                                 Ver Detalle
                             </Button>
                        </div>

                    </div>
                </Card>
            ))}
        </div>

        {/* Modal de Aprobación Inteligente */}
        <Modal isOpen={isApproveModalOpen} onClose={() => setIsApproveModalOpen(false)} title="Confirmar & Asignar Equipo">
            <div className="space-y-6">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                    <div className="text-sm text-blue-800 dark:text-blue-200">
                        <p className="font-bold">Asignación de Recursos</p>
                        <p>Define quién se encargará de cada servicio aprobado.</p>
                    </div>
                </div>

                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {selectedProposal?.items?.map(item => {
                        const isSelected = selectedItemIds.includes(item.id);
                        if (!isSelected) return null;

                        const assignment = assignments[item.id] || { contractorId: '', cost: 0 };

                        return (
                            <div key={item.id} className="border border-gray-200 dark:border-slate-700 rounded-xl p-4 space-y-3 bg-white dark:bg-slate-800">
                                <div className="flex justify-between items-start">
                                    <div className="flex gap-2">
                                        <input 
                                            type="checkbox" 
                                            checked={selectedItemIds.includes(item.id)} 
                                            onChange={() => {
                                                if (selectedItemIds.includes(item.id)) {
                                                    setSelectedItemIds(selectedItemIds.filter(id => id !== item.id));
                                                } else {
                                                    setSelectedItemIds([...selectedItemIds, item.id]);
                                                }
                                            }}
                                            className="mt-1"
                                        />
                                        <div>
                                            <p className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                                {item.serviceSnapshotName}
                                            </p>
                                            <p className="text-xs text-gray-500">Precio Cliente: ${item.serviceSnapshotCost.toLocaleString()}</p>
                                        </div>
                                    </div>
                                    <Badge variant="blue">{item.serviceSnapshotType === 'RECURRING' ? 'Mensual' : 'Único'}</Badge>
                                </div>

                                {/* Asignación */}
                                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100 dark:border-slate-700">
                                    <div>
                                        <Label className="text-xs">Asignar a:</Label>
                                        <select 
                                            className="w-full text-sm bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg p-2"
                                            value={assignment.contractorId}
                                            onChange={(e) => setAssignments({
                                                ...assignments,
                                                [item.id]: { ...assignment, contractorId: e.target.value }
                                            })}
                                        >
                                            <option value="">(Yo / Interno)</option>
                                            {contractors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <Label className="text-xs">Pago al Socio ($):</Label>
                                        <Input 
                                            type="number" 
                                            className="h-[38px] text-sm"
                                            placeholder="0"
                                            value={assignment.cost}
                                            onChange={(e) => setAssignments({
                                                ...assignments,
                                                [item.id]: { ...assignment, cost: Number(e.target.value) }
                                            })}
                                        />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="flex gap-3 pt-2">
                    <Button variant="secondary" onClick={() => setIsApproveModalOpen(false)} className="flex-1">Cancelar</Button>
                    <Button onClick={confirmApproval} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white">
                        Confirmar y Activar
                    </Button>
                </div>
            </div>
        </Modal>

    </div>
  );
}
