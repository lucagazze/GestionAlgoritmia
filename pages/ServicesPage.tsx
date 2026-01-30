import React, { useEffect, useState } from 'react';
import { db } from '../services/db';
import { Service, ServiceType } from '../types';
import { Button, Input, Label, Badge, Modal } from '../components/UIComponents';
import { Plus, Trash2, Package, Pencil, Search } from 'lucide-react';

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [filteredServices, setFilteredServices] = useState<Service[]>([]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    category: 'Web & Tech',
    type: ServiceType.ONE_TIME,
    baseCost: '',
    description: ''
  });

  useEffect(() => {
    loadServices();
  }, []);

  useEffect(() => {
    setFilteredServices(
      services.filter(s => 
        s.name.toLowerCase().includes(search.toLowerCase()) || 
        s.category.toLowerCase().includes(search.toLowerCase())
      )
    );
  }, [search, services]);

  const loadServices = async () => {
    const data = await db.services.getAll();
    setServices(data);
  };

  const openModal = (service?: Service) => {
    if (service) {
      setEditingService(service);
      setFormData({
        name: service.name,
        category: service.category,
        type: service.type,
        baseCost: service.baseCost.toString(),
        description: service.description || ''
      });
    } else {
      setEditingService(null);
      setFormData({
        name: '',
        category: 'Web & Tech',
        type: ServiceType.ONE_TIME,
        baseCost: '',
        description: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.baseCost) return;

    const payload = {
      name: formData.name,
      category: formData.category,
      type: formData.type,
      baseCost: parseFloat(formData.baseCost),
      description: formData.description
    };

    if (editingService) {
      await db.services.update(editingService.id, payload);
    } else {
      await db.services.create(payload);
    }

    setIsModalOpen(false);
    loadServices();
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Borrar servicio?')) {
      await db.services.delete(id);
      loadServices();
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-gray-900">Catálogo de Servicios</h1>
          <p className="text-xs text-gray-500">Total: {services.length} items</p>
        </div>
        
        <div className="flex w-full md:w-auto gap-3">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <Input 
              placeholder="Buscar servicio..." 
              className="pl-9 h-9 text-sm"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Button onClick={() => openModal()} size="sm" className="shadow-lg shadow-black/20">
            <Plus className="w-4 h-4 mr-2" /> Nuevo
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {filteredServices.map((service) => (
          <div 
            key={service.id} 
            className="group relative flex flex-col p-4 bg-white border border-gray-100 rounded-xl hover:border-gray-300 hover:shadow-md transition-all duration-200"
          >
            <div className="flex justify-between items-start mb-2">
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 bg-gray-50">{service.category}</Badge>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                 <button onClick={() => openModal(service)} className="text-gray-400 hover:text-blue-600"><Pencil className="w-3 h-3" /></button>
                 <button onClick={() => handleDelete(service.id)} className="text-gray-400 hover:text-red-600"><Trash2 className="w-3 h-3" /></button>
              </div>
            </div>
            
            <h3 className="font-bold text-gray-900 text-sm leading-tight mb-1 line-clamp-2 min-h-[2.5em]">{service.name}</h3>
            
            <div className="flex items-center gap-1.5 mb-3">
               <span className={`w-1.5 h-1.5 rounded-full ${service.type === ServiceType.ONE_TIME ? 'bg-blue-400' : 'bg-purple-400'}`}></span>
               <span className="text-xs text-gray-400">{service.type === ServiceType.ONE_TIME ? 'Único' : 'Mensual'}</span>
            </div>

            <div className="mt-auto pt-2 border-t border-gray-50 flex justify-between items-end">
              <span className="text-[10px] text-gray-400">Costo Base</span>
              <span className="font-mono font-bold text-gray-900">${service.baseCost}</span>
            </div>
          </div>
        ))}
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingService ? 'Editar' : 'Nuevo Servicio'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Nombre</Label>
            <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Categoría</Label>
              <select 
                className="flex h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-black"
                value={formData.category}
                onChange={e => setFormData({...formData, category: e.target.value})}
              >
                <option value="Web & Tech">Web & Tech</option>
                <option value="Branding">Branding</option>
                <option value="Contenido">Contenido</option>
                <option value="Ads / Tráfico">Ads / Tráfico</option>
                <option value="Automatización">Automatización</option>
                <option value="Consultoría">Consultoría</option>
              </select>
            </div>
            <div>
              <Label>Tipo</Label>
              <select 
                className="flex h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-black"
                value={formData.type}
                onChange={e => setFormData({...formData, type: e.target.value as ServiceType})}
              >
                <option value={ServiceType.ONE_TIME}>Único</option>
                <option value={ServiceType.RECURRING}>Mensual</option>
              </select>
            </div>
          </div>
          <div>
            <Label>Costo Base ($)</Label>
            <Input type="number" value={formData.baseCost} onChange={e => setFormData({...formData, baseCost: e.target.value})} />
          </div>
          <div>
            <Label>Descripción</Label>
            <Input value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)} className="flex-1">Cancelar</Button>
            <Button type="submit" className="flex-1">Guardar</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
