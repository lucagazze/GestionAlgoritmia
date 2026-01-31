
import React, { useEffect, useState } from 'react';
import { db } from '../services/db';
import { Contractor } from '../types';
import { Button, Input, Label, Badge, Modal } from '../components/UIComponents';
import { ContextMenu } from '../components/ContextMenu';
import { Users, Plus, Trash2, Mail, DollarSign, Search, Edit2 } from 'lucide-react';

export default function PartnersPage() {
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Context Menu
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; contractor: Contractor | null }>({ x: 0, y: 0, contractor: null });

  const [formData, setFormData] = useState({ name: '', role: '', hourlyRate: '', email: '' });

  useEffect(() => { loadContractors(); }, []);

  const loadContractors = async () => {
    setLoading(true);
    const data = await db.contractors.getAll();
    setContractors(data);
    setLoading(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;
    await db.contractors.create({ name: formData.name, role: formData.role, hourlyRate: parseFloat(formData.hourlyRate) || 0, email: formData.email, status: 'ACTIVE' });
    setIsModalOpen(false);
    setFormData({ name: '', role: '', hourlyRate: '', email: '' });
    loadContractors();
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Eliminar socio?')) {
      await db.contractors.delete(id);
      loadContractors();
    }
  };

  const handleContextMenu = (e: React.MouseEvent, contractor: Contractor) => {
      e.preventDefault();
      setContextMenu({ x: e.pageX, y: e.pageY, contractor });
  };

  const filtered = contractors.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div><h1 className="text-3xl font-bold tracking-tight text-gray-900">Equipo & Socios</h1></div>
        <div className="flex gap-2"><div className="relative w-64"><Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" /><Input placeholder="Buscar..." className="pl-9 h-10 bg-white" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div><Button onClick={() => setIsModalOpen(true)} className="shadow-lg"><Plus className="w-4 h-4 mr-2" /> Agregar</Button></div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100 uppercase text-xs tracking-wider">
                  <tr><th className="px-6 py-4">Nombre / Rol</th><th className="px-6 py-4">Estado</th><th className="px-6 py-4">Email</th><th className="px-6 py-4 text-right">Tarifa (Ref)</th><th className="px-6 py-4 text-center">Acciones</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                  {filtered.length === 0 ? (<tr><td colSpan={5} className="text-center py-12 text-gray-400">No hay socios registrados.</td></tr>) : 
                      filtered.map(c => (
                          <tr key={c.id} onContextMenu={(e) => handleContextMenu(e, c)} className="hover:bg-gray-50 group cursor-pointer">
                              <td className="px-6 py-4"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-gray-900 text-white flex items-center justify-center font-bold text-xs">{c.name.charAt(0)}</div><div><div className="font-bold text-gray-900">{c.name}</div><div className="text-xs text-gray-500">{c.role}</div></div></div></td>
                              <td className="px-6 py-4"><Badge variant={c.status === 'ACTIVE' ? 'green' : 'outline'}>{c.status}</Badge></td>
                              <td className="px-6 py-4 text-gray-600">{c.email || '-'}</td>
                              <td className="px-6 py-4 text-right font-mono font-medium">${c.hourlyRate}/hr</td>
                              <td className="px-6 py-4 text-center"><button onClick={() => handleDelete(c.id)} className="text-gray-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button></td>
                          </tr>
                      ))
                  }
              </tbody>
          </table>
      </div>

      <ContextMenu 
        x={contextMenu.x} y={contextMenu.y} isOpen={!!contextMenu.contractor} onClose={() => setContextMenu({ ...contextMenu, contractor: null })}
        items={[
            { label: 'Enviar Email', icon: Mail, onClick: () => contextMenu.contractor && window.location.assign(`mailto:${contextMenu.contractor.email}`) },
            { label: 'Eliminar Socio', icon: Trash2, variant: 'destructive', onClick: () => contextMenu.contractor && handleDelete(contextMenu.contractor.id) }
        ]}
      />

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Registrar Socio / Freelancer">
        <form onSubmit={handleCreate} className="space-y-4">
          <div><Label>Nombre Completo</Label><Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Ej: Juan Pérez" autoFocus /></div>
          <div className="grid grid-cols-2 gap-4"><div><Label>Rol</Label><Input value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} /></div><div><Label>Tarifa ($/hr)</Label><Input type="number" value={formData.hourlyRate} onChange={e => setFormData({...formData, hourlyRate: e.target.value})} /></div></div>
          <div><Label>Email</Label><Input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} /></div>
          <div className="flex gap-2 pt-4"><Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)} className="flex-1">Cancelar</Button><Button type="submit" className="flex-1">Guardar</Button></div>
        </form>
      </Modal>
    </div>
  );
}
