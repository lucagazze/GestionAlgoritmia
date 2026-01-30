import React, { useEffect, useState } from 'react';
import { db } from '../services/db';
import { Service, ServiceType } from '../types';
import { Button, Card, Input, Label, Badge, Modal } from '../components/UIComponents';
import { Plus, Trash2, Package, Pencil } from 'lucide-react';

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Modal State
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

  const loadServices = async () => {
    setIsLoading(true);
    const data = await db.services.getAll();
    setServices(data);
    setIsLoading(false);
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
    if (confirm('¿Estás seguro de eliminar este servicio? No se podrá recuperar.')) {
      await db.services.delete(id);
      loadServices();
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Catálogo de Servicios</h1>
          <p className="text-gray-500 mt-2">Tus bloques de construcción. Edita precios y definiciones aquí.</p>
        </div>
        <Button onClick={() => openModal()} className="shadow-lg shadow-black/20">
          <Plus className="w-4 h-4 mr-2" /> Nuevo Servicio
        </Button>
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingService ? 'Editar Servicio' : 'Crear Nuevo Servicio'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Nombre del Servicio</Label>
            <Input 
              value={formData.name} 
              onChange={e => setFormData({...formData, name: e.target.value})} 
              placeholder="Ej: Auditoría SEO" 
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Categoría</Label>
              <select 
                className="flex h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-black transition-all"
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
              <Label>Modalidad</Label>
              <select 
                className="flex h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-black transition-all"
                value={formData.type}
                onChange={e => setFormData({...formData, type: e.target.value as ServiceType})}
              >
                <option value={ServiceType.ONE_TIME}>Pago Único</option>
                <option value={ServiceType.RECURRING}>Mensual (Recurrente)</option>
              </select>
            </div>
          </div>
          <div>
            <Label>Costo Base Interno (USD)</Label>
            <Input 
              type="number" 
              value={formData.baseCost} 
              onChange={e => setFormData({...formData, baseCost: e.target.value})} 
              placeholder="0.00" 
            />
            <p className="text-xs text-gray-400 mt-1 ml-1">Este es el costo para la agencia, no el precio final.</p>
          </div>
          <div>
            <Label>Descripción Corta</Label>
            <Input 
              value={formData.description} 
              onChange={e => setFormData({...formData, description: e.target.value})} 
              placeholder="Entregables principales..." 
            />
          </div>
          <div className="pt-4 flex gap-3">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)} className="w-full">Cancelar</Button>
            <Button type="submit" className="w-full">{editingService ? 'Guardar Cambios' : 'Crear Servicio'}</Button>
          </div>
        </form>
      </Modal>

      {isLoading ? (
        <div className="text-center py-20 text-gray-400">Cargando catálogo...</div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {services.map((service) => (
            <div key={service.id} className="group flex flex-col md:flex-row items-start md:items-center justify-between p-5 bg-white border border-gray-100/80 rounded-2xl hover:border-gray-300 hover:shadow-md transition-all duration-300">
              <div className="flex items-center space-x-4 mb-4 md:mb-0">
                <div className="p-3 bg-gray-50 rounded-xl text-gray-400 group-hover:text-black transition-colors">
                  <Package className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-lg">{service.name}</h3>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <Badge variant="outline">{service.category}</Badge>
                    <span className="text-xs font-medium text-gray-400 uppercase tracking-wider flex items-center gap-1">
                      {service.type === ServiceType.ONE_TIME ? '⚡ Pago Único' : '🔄 Mensual'}
                    </span>
                  </div>
                  {service.description && <p className="text-sm text-gray-400 mt-1 max-w-lg">{service.description}</p>}
                </div>
              </div>
              <div className="flex items-center space-x-6 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 border-gray-100 pt-4 md:pt-0">
                <div className="text-right mr-4">
                  <span className="block text-xs text-gray-400 uppercase font-semibold">Costo Base</span>
                  <span className="font-mono text-xl font-bold tracking-tight">${service.baseCost}</span>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => openModal(service)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(service.id)} className="text-gray-300 hover:text-red-600 hover:bg-red-50">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
