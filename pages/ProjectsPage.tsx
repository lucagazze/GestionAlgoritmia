
import React, { useEffect, useState } from 'react';
import { db } from '../services/db';
import { ai } from '../services/ai';
import { Project, ProjectStatus, Contractor, ClientNote, Task } from '../types';
import { Badge, Button, Modal, Input, Label, Textarea } from '../components/UIComponents';
import { MoreHorizontal, Plus, Edit2, MessageCircle, FileText, User, ArrowRight, History, StickyNote, CheckCircle2, Mic, Search, Filter, Phone, Wallet, Sparkles, Copy, Loader2, Handshake } from 'lucide-react';

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'PROFILE' | 'PARTNER' | 'HISTORY'>('PROFILE');
  const [editingId, setEditingId] = useState<string | null>(null);

  // Data for History Tab
  const [clientNotes, setClientNotes] = useState<ClientNote[]>([]);
  const [clientTasks, setClientTasks] = useState<Task[]>([]);
  const [newNote, setNewNote] = useState('');
  const [noteType, setNoteType] = useState<'MEETING' | 'NOTE' | 'CALL'>('NOTE');

  // Partner Agreement AI State
  const [isGeneratingAgreement, setIsGeneratingAgreement] = useState(false);
  const [partnerAgreementText, setPartnerAgreementText] = useState('');

  // Form State
  const [formData, setFormData] = useState({
      name: '',
      monthlyRevenue: '',
      billingDay: '1',
      phone: '',
      assignedPartnerId: '',
      outsourcingCost: '',
      proposalUrl: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    const [projData, contData] = await Promise.all([
        db.projects.getAll(),
        db.contractors.getAll()
    ]);
    
    // Map partners to projects manually to ensure display names
    const mappedProjects = projData.map(p => {
        const partner = contData.find(c => c.id === p.assignedPartnerId);
        return { ...p, partnerName: partner ? partner.name : undefined };
    });

    setProjects(mappedProjects);
    setContractors(contData);
    setIsLoading(false);
  };

  const loadClientHistory = async (clientId: string) => {
      const notes = await db.clientNotes.getByClient(clientId);
      const allTasks = await db.tasks.getAll();
      const relevantTasks = allTasks.filter(t => t.projectId === clientId);
      
      setClientNotes(notes);
      setClientTasks(relevantTasks);
  };

  const openCreateModal = () => {
      setEditingId(null);
      setFormData({ name: '', monthlyRevenue: '', billingDay: '1', phone: '', assignedPartnerId: '', outsourcingCost: '', proposalUrl: '' });
      setPartnerAgreementText('');
      setActiveTab('PROFILE');
      setIsModalOpen(true);
  };

  const openEditModal = async (p: Project, e?: React.MouseEvent) => {
      if(e) e.stopPropagation();
      setEditingId(p.id);
      setFormData({
          name: p.name,
          monthlyRevenue: p.monthlyRevenue.toString(),
          billingDay: p.billingDay.toString(),
          phone: p.phone || '',
          assignedPartnerId: p.assignedPartnerId || '',
          outsourcingCost: p.outsourcingCost ? p.outsourcingCost.toString() : '',
          proposalUrl: p.proposalUrl || ''
      });
      setPartnerAgreementText(''); // Reset or load from DB if field existed
      setActiveTab('PROFILE');
      await loadClientHistory(p.id);
      setIsModalOpen(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
      e.preventDefault();
      if(!formData.name) return;

      const payload = {
          name: formData.name,
          monthlyRevenue: parseFloat(formData.monthlyRevenue) || 0,
          billingDay: parseInt(formData.billingDay) || 1,
          phone: formData.phone,
          assignedPartnerId: formData.assignedPartnerId || null,
          outsourcingCost: parseFloat(formData.outsourcingCost) || 0,
          proposalUrl: formData.proposalUrl
      };

      if (editingId) {
          await db.projects.update(editingId, payload);
      } else {
          await db.projects.create({ ...payload, status: ProjectStatus.ACTIVE });
          setIsModalOpen(false); 
      }
      loadData();
      if(editingId && activeTab === 'PROFILE') alert('Datos actualizados correctamente');
  }

  const handleAddNote = async () => {
      if (!editingId || !newNote.trim()) return;
      await db.clientNotes.create({
          clientId: editingId,
          content: newNote,
          type: noteType
      });
      setNewNote('');
      loadClientHistory(editingId); 
  }

  const handleDelete = async (id: string) => {
      if(confirm('¿Eliminar proyecto y cliente?')) {
          await db.projects.delete(id);
          setIsModalOpen(false);
          loadData();
      }
  }

  // --- AI PARTNER AGREEMENT LOGIC ---
  const generatePartnerAgreement = async () => {
      if (!formData.assignedPartnerId) {
          alert("Primero asigna un socio en la pestaña Perfil.");
          return;
      }
      
      const partner = contractors.find(c => c.id === formData.assignedPartnerId);
      const clientRevenue = parseFloat(formData.monthlyRevenue) || 0;
      const partnerCost = parseFloat(formData.outsourcingCost) || 0;
      
      setIsGeneratingAgreement(true);
      try {
          const prompt = `
          Actúa como Project Manager. Redacta una "Orden de Trabajo" (Acuerdo simple) para mi socio/freelancer.
          
          Datos:
          - Mi Agencia: Algoritmia
          - Socio: ${partner?.name || 'Freelancer'}
          - Cliente Final: ${formData.name}
          - Pago al Socio: $${partnerCost} (El cliente paga $${clientRevenue}, pero esto NO se le dice al socio, solo su pago).
          
          Instrucciones:
          1. Redacta un mensaje formal pero directo para enviarle por Email o WhatsApp.
          2. Detalla que el pago es de $${partnerCost} por el servicio mensual.
          3. Deja placeholders claros como [DETALLE DE TAREAS] o [FECHA DE ENTREGA] si faltan datos.
          4. El tono debe ser de "Confirmación de asignación de proyecto".
          `;
          
          const response = await ai.chat([{ role: 'user', content: prompt }]);
          setPartnerAgreementText(response || "Error generando acuerdo.");
      } catch (error) {
          console.error(error);
          alert("Error conectando con la IA");
      } finally {
          setIsGeneratingAgreement(false);
      }
  };

  const getWhatsAppLink = (p: Project) => {
      if (!p.phone) return null;
      const cleanPhone = p.phone.replace(/\D/g, '');
      const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
      const currentMonth = monthNames[new Date().getMonth()];
      const message = `Hola ${p.name.split(' ')[0]}! 👋 Te paso el total del mes de *${currentMonth}* por valor de *$${p.monthlyRevenue.toLocaleString()}*.\n\nAvísame cuando realices el pago así lo registro. Gracias!`;
      return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  };

  const getCombinedTimeline = () => {
      const notes = clientNotes.map(n => ({ type: 'NOTE', data: n, date: new Date(n.createdAt) }));
      const tasks = clientTasks.filter(t => t.status === 'DONE').map(t => ({ type: 'TASK', data: t, date: new Date(t.created_at || new Date()) }));
      return [...notes, ...tasks].sort((a, b) => b.date.getTime() - a.date.getTime());
  };

  // Filter projects
  const filteredProjects = projects.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20 h-[calc(100vh-100px)] flex flex-col">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 px-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Cartera de Clientes</h1>
          <p className="text-sm text-gray-500">Vista consolidada de facturación y estado.</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
             <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <Input 
                    placeholder="Buscar cliente..." 
                    className="pl-9 h-10 bg-white" 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
             </div>
            <Button onClick={openCreateModal} className="shadow-lg shadow-black/10">
                <Plus className="w-4 h-4 mr-2" /> Nuevo
            </Button>
        </div>
      </div>

      {/* DATA TABLE */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm flex-1 flex flex-col">
          <div className="overflow-x-auto flex-1">
              <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100 uppercase text-xs tracking-wider sticky top-0 z-10">
                      <tr>
                          <th className="px-6 py-3">Cliente / Proyecto</th>
                          <th className="px-6 py-3">Estado</th>
                          <th className="px-6 py-3 text-right">Fee Cliente</th>
                          <th className="px-6 py-3 text-right">Pago Socio</th>
                          <th className="px-6 py-3 text-right">Tu Margen</th>
                          <th className="px-6 py-3">Día Cobro</th>
                          <th className="px-6 py-3 text-center">Acciones</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                      {isLoading ? (
                          <tr><td colSpan={7} className="text-center py-10 text-gray-400">Cargando datos...</td></tr>
                      ) : filteredProjects.length === 0 ? (
                           <tr><td colSpan={7} className="text-center py-10 text-gray-400">No se encontraron clientes.</td></tr>
                      ) : (
                          filteredProjects.map((p) => {
                              const margin = (p.monthlyRevenue || 0) - (p.outsourcingCost || 0);
                              const waLink = getWhatsAppLink(p);
                              return (
                                  <tr 
                                    key={p.id} 
                                    onClick={() => openEditModal(p)}
                                    className="hover:bg-blue-50/30 transition-colors cursor-pointer group"
                                  >
                                      <td className="px-6 py-3">
                                          <div className="flex flex-col">
                                              <span className="font-bold text-gray-900">{p.name}</span>
                                              {p.partnerName ? (
                                                  <span className="text-[10px] text-gray-400 flex items-center gap-1"><User className="w-3 h-3"/> {p.partnerName}</span>
                                              ) : (
                                                  <span className="text-[10px] text-gray-400 italic">In-house</span>
                                              )}
                                          </div>
                                      </td>
                                      <td className="px-6 py-3">
                                          <Badge variant={p.status === ProjectStatus.ACTIVE ? 'green' : 'outline'}>
                                              {p.status === ProjectStatus.ACTIVE ? 'ACTIVO' : 'PAUSADO'}
                                          </Badge>
                                      </td>
                                      <td className="px-6 py-3 text-right font-mono font-medium">
                                          ${p.monthlyRevenue.toLocaleString()}
                                      </td>
                                      <td className="px-6 py-3 text-right font-mono text-gray-500">
                                          {p.outsourcingCost ? `$${p.outsourcingCost.toLocaleString()}` : '-'}
                                      </td>
                                      <td className="px-6 py-3 text-right font-mono font-bold text-green-600">
                                          +${margin.toLocaleString()}
                                      </td>
                                      <td className="px-6 py-3">
                                          <div className="flex items-center gap-2">
                                              <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs font-bold">{p.billingDay}</span>
                                              {p.billingDay === new Date().getDate() && <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>}
                                          </div>
                                      </td>
                                      <td className="px-6 py-3 text-center">
                                          <div className="flex items-center justify-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                                              {waLink && (
                                                  <a href={waLink} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="p-1.5 rounded-md hover:bg-green-50 text-green-600">
                                                      <MessageCircle className="w-4 h-4" />
                                                  </a>
                                              )}
                                              {p.proposalUrl && (
                                                  <a href={p.proposalUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="p-1.5 rounded-md hover:bg-blue-50 text-blue-600">
                                                      <FileText className="w-4 h-4" />
                                                  </a>
                                              )}
                                              <button onClick={(e) => openEditModal(p, e)} className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500">
                                                  <Edit2 className="w-4 h-4" />
                                              </button>
                                          </div>
                                      </td>
                                  </tr>
                              );
                          })
                      )}
                  </tbody>
              </table>
          </div>
          {/* Footer Summary */}
          <div className="bg-gray-50 border-t border-gray-200 p-4 flex gap-6 text-xs text-gray-500">
              <div>Total Clientes: <span className="font-bold text-gray-900">{filteredProjects.length}</span></div>
              <div>MRR Total: <span className="font-bold text-gray-900">${filteredProjects.reduce((acc, p) => acc + (p.monthlyRevenue || 0), 0).toLocaleString()}</span></div>
          </div>
      </div>

      {/* EDIT MODAL */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? `Expediente: ${formData.name}` : "Nuevo Proyecto"}>
          {/* TABS */}
          {editingId && (
              <div className="flex border-b border-gray-100 mb-6">
                  <button onClick={() => setActiveTab('PROFILE')} className={`flex-1 pb-3 text-sm font-bold text-center border-b-2 transition-colors ${activeTab === 'PROFILE' ? 'border-black text-black' : 'border-transparent text-gray-400'}`}>
                      Perfil & Config
                  </button>
                  <button onClick={() => setActiveTab('PARTNER')} className={`flex-1 pb-3 text-sm font-bold text-center border-b-2 transition-colors ${activeTab === 'PARTNER' ? 'border-black text-black' : 'border-transparent text-gray-400'}`}>
                      Gestión Socio
                  </button>
                  <button onClick={() => setActiveTab('HISTORY')} className={`flex-1 pb-3 text-sm font-bold text-center border-b-2 transition-colors ${activeTab === 'HISTORY' ? 'border-black text-black' : 'border-transparent text-gray-400'}`}>
                      Bitácora
                  </button>
              </div>
          )}

          {activeTab === 'PROFILE' && (
              <form onSubmit={handleSaveProfile} className="space-y-4">
                  <div>
                      <Label>Nombre del Cliente</Label>
                      <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Ej: Nike Argentina" autoFocus />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Fee Mensual ($)</Label>
                        <Input type="number" value={formData.monthlyRevenue} onChange={e => setFormData({...formData, monthlyRevenue: e.target.value})} placeholder="1500" />
                        <p className="text-[10px] text-gray-400 mt-1">Lo que el cliente te paga a ti.</p>
                      </div>
                      <div>
                        <Label>Día de Cobro (1-31)</Label>
                        <Input type="number" min="1" max="31" value={formData.billingDay} onChange={e => setFormData({...formData, billingDay: e.target.value})} />
                      </div>
                  </div>
                  
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-4">
                      <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-gray-500"/>
                              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Asignación de Socio</span>
                          </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Socio Responsable</Label>
                            <select 
                                    className="flex h-11 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-black"
                                    value={formData.assignedPartnerId}
                                    onChange={e => setFormData({...formData, assignedPartnerId: e.target.value})}
                            >
                                <option value="">(Interno / Yo)</option>
                                {contractors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <Label>Costo Socio ($)</Label>
                            <Input type="number" value={formData.outsourcingCost} onChange={e => setFormData({...formData, outsourcingCost: e.target.value})} placeholder="0" />
                            <p className="text-[10px] text-gray-400 mt-1">Lo que tú le pagas a él.</p>
                        </div>
                      </div>
                  </div>

                  <div>
                      <Label>WhatsApp (Cobros Automáticos)</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-3 w-4 h-4 text-gray-400"/>
                        <Input type="tel" className="pl-9" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="Ej: 54911..." />
                      </div>
                  </div>
                  <div>
                      <Label>Link de Propuesta (PDF)</Label>
                      <Input value={formData.proposalUrl} onChange={e => setFormData({...formData, proposalUrl: e.target.value})} placeholder="https://..." />
                  </div>
                  <div className="pt-2 flex gap-2">
                      {editingId && (
                          <Button type="button" variant="destructive" onClick={() => handleDelete(editingId)} className="w-auto px-3"><Filter className="w-4 h-4"/></Button>
                      )}
                      <Button type="submit" className="flex-1">Guardar Cambios</Button>
                  </div>
              </form>
          )}

          {activeTab === 'PARTNER' && (
              <div className="space-y-6">
                  {/* Financial Breakdown */}
                  <div className="grid grid-cols-3 gap-3">
                      <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 text-center">
                          <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Cliente Paga</p>
                          <p className="text-lg font-bold text-gray-900">${formData.monthlyRevenue}</p>
                      </div>
                      <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 text-center">
                          <p className="text-[10px] text-blue-400 font-bold uppercase mb-1">Pagas al Socio</p>
                          <p className="text-lg font-bold text-blue-700">${formData.outsourcingCost}</p>
                      </div>
                      <div className="p-3 bg-green-50 rounded-xl border border-green-100 text-center">
                          <p className="text-[10px] text-green-600 font-bold uppercase mb-1">Tu Ganancia</p>
                          <p className="text-lg font-bold text-green-700">
                              ${(parseFloat(formData.monthlyRevenue) || 0) - (parseFloat(formData.outsourcingCost) || 0)}
                          </p>
                      </div>
                  </div>

                  {/* Agreement Generator */}
                  <div className="space-y-3">
                      <div className="flex justify-between items-center">
                          <Label className="mb-0">Orden de Trabajo (Acuerdo)</Label>
                          <Button size="sm" variant="ghost" className="h-8 text-xs text-indigo-600 bg-indigo-50 hover:bg-indigo-100" onClick={generatePartnerAgreement} disabled={isGeneratingAgreement}>
                                {isGeneratingAgreement ? <Loader2 className="w-3 h-3 animate-spin mr-1"/> : <Sparkles className="w-3 h-3 mr-1"/>}
                                {partnerAgreementText ? 'Regenerar con IA' : 'Redactar con IA'}
                          </Button>
                      </div>
                      
                      <div className="relative">
                        <Textarea 
                            className="min-h-[200px] font-mono text-xs leading-relaxed p-4"
                            value={partnerAgreementText}
                            onChange={e => setPartnerAgreementText(e.target.value)}
                            placeholder="Presiona 'Redactar con IA' para generar el acuerdo formal basado en los montos asignados..."
                        />
                        {partnerAgreementText && (
                            <button onClick={() => navigator.clipboard.writeText(partnerAgreementText)} className="absolute bottom-3 right-3 p-2 bg-white rounded-lg border shadow hover:bg-gray-50">
                                <Copy className="w-4 h-4 text-gray-500" />
                            </button>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-400">
                          Este texto es generado automáticamente usando los valores del perfil. Úsalo para formalizar la tarea con tu socio.
                      </p>
                  </div>
              </div>
          )}

          {activeTab === 'HISTORY' && (
              <div className="space-y-6 h-[400px] flex flex-col">
                  <div className="flex gap-2 items-start">
                      <div className="flex-1">
                          <Textarea 
                             value={newNote} 
                             onChange={e => setNewNote(e.target.value)} 
                             placeholder="Escribe una nota, reunión o hito..." 
                             className="min-h-[60px] text-xs"
                          />
                          <div className="flex gap-2 mt-2">
                              {['NOTE', 'MEETING', 'CALL'].map(t => (
                                  <button key={t} onClick={() => setNoteType(t as any)} className={`text-[10px] px-2 py-1 rounded-full border transition-all ${noteType === t ? 'bg-black text-white border-black' : 'border-gray-200 hover:bg-gray-50'}`}>{t === 'NOTE' ? 'Nota' : t === 'MEETING' ? 'Reunión' : 'Llamada'}</button>
                              ))}
                          </div>
                      </div>
                      <Button onClick={handleAddNote} size="sm" disabled={!newNote.trim()}>Agregar</Button>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar bg-gray-50/50 p-4 rounded-xl border border-gray-100">
                      {getCombinedTimeline().length === 0 && <p className="text-center text-xs text-gray-400 py-4">No hay historial registrado.</p>}
                      {getCombinedTimeline().map((item: any, idx) => (
                          <div key={idx} className="flex gap-3">
                              <div className="flex flex-col items-center">
                                  <div className={`w-2 h-2 rounded-full mt-1.5 ${item.type === 'TASK' ? 'bg-green-400' : 'bg-blue-400'}`}></div>
                                  <div className="w-px h-full bg-gray-200 my-1"></div>
                              </div>
                              <div className="pb-4">
                                  <p className="text-[10px] text-gray-400 font-mono mb-0.5">{item.date.toLocaleDateString()}</p>
                                  <div className="bg-white border border-gray-100 p-2 rounded-lg shadow-sm">
                                      <p className="text-xs text-gray-600 whitespace-pre-wrap">
                                          {item.type === 'TASK' ? `✅ Completado: ${item.data.title}` : item.data.content}
                                      </p>
                                  </div>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          )}
      </Modal>
    </div>
  );
}
