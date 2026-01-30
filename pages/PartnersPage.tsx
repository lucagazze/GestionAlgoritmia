
import React, { useEffect, useState } from 'react';
import { db } from '../services/db';
import { Contractor } from '../types';
import { Button, Card, Input, Label, Badge, Modal } from '../components/UIComponents';
import { Users, Plus, Trash2, Mail, DollarSign, Briefcase } from 'lucide-react';

export default function PartnersPage() {
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    role: '',
    hourlyRate: '',
    email: ''
  });

  useEffect(() => {
    loadContractors();
  }, []);

  const loadContractors = async () => {
    setLoading(true);
    const data = await db.contractors.getAll();
    setContractors(data);
    setLoading(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;

    await db.contractors.create({
      name: formData.name,
      role: formData.role,
      hourlyRate: parseFloat(formData.hourlyRate) || 0,
      email: formData.email,
      status: 'ACTIVE'
    });

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

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Socios & Outsourcing</h1>
          <p className="text-gray-500 mt-2">Gestiona tu equipo externo y costos de subcontratación.</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="shadow-lg">
          <Plus className="w-4 h-4 mr-2" /> Nuevo Socio
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {contractors.map((contractor) => (
          <Card key={contractor.id} className="hover:border-black/20 transition-all group">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-xl font-bold text-gray-600">
                  {contractor.name.charAt(0)}
                </div>
                <button onClick={() => handleDelete(contractor.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              
              <h3 className="text-lg font-bold text-gray-900">{contractor.name}</h3>
              <div className="flex items-center gap-2 mt-1 mb-4">
                <Badge variant="outline" className="text-[10px] uppercase tracking-wider">{contractor.role || 'Partner'}</Badge>
                <span className={`w-2 h-2 rounded-full ${contractor.status === 'ACTIVE' ? 'bg-green-500' : 'bg-gray-300'}`}></span>
              </div>

              <div className="space-y-3 pt-4 border-t border-gray-50">
                <div className="flex items-center text-sm text-gray-600">
                  <DollarSign className="w-4 h-4 mr-2 text-gray-400" />
                  <span className="font-mono font-medium">${contractor.hourlyRate}/hr</span>
                  <span className="text-xs text-gray-400 ml-1">(Ref)</span>
                </div>
                {contractor.email && (
                  <div className="flex items-center text-sm text-gray-600">
                    <Mail className="w-4 h-4 mr-2 text-gray-400" />
                    <span className="truncate">{contractor.email}</span>
                  </div>
                )}
              </div>
            </div>
          </Card>
        ))}
        
        {contractors.length === 0 && !loading && (
          <div className="col-span-full py-16 text-center bg-white border border-dashed border-gray-200 rounded-xl text-gray-400">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>No tienes socios registrados.</p>
            <p className="text-xs">Agrega freelancers para calcular márgenes de outsourcing.</p>
          </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Registrar Socio / Freelancer">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <Label>Nombre Completo</Label>
            <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Ej: Juan Pérez" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-4">
             <div>
                <Label>Rol / Especialidad</Label>
                <Input value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} placeholder="Dev, Diseño..." />
             </div>
             <div>
                <Label>Tarifa Ref. ($/hr)</Label>
                <Input type="number" value={formData.hourlyRate} onChange={e => setFormData({...formData, hourlyRate: e.target.value})} placeholder="25" />
             </div>
          </div>
          <div>
            <Label>Email de Contacto</Label>
            <Input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="juan@email.com" />
          </div>
          
          <div className="flex gap-2 pt-4">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)} className="flex-1">Cancelar</Button>
            <Button type="submit" className="flex-1">Guardar Socio</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
