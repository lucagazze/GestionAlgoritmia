import React, { useEffect, useState } from 'react';
import { db } from '../services/db';
import { Service, ServiceType } from '../types';
import { Button, Input, Label, Badge, Modal } from '../components/UIComponents';
import { Plus, Trash2, Package, Pencil, Search, Filter, X } from 'lucide-react';

const CATEGORIES = ['Todas', 'Web & Tech', 'Branding', 'Contenido', 'Ads / Tráfico', 'Automatización', 'Consultoría'];

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [filteredServices, setFilteredServices] = useState<Service[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [selectedType, setSelectedType] = useState<'ALL' | ServiceType>('ALL');
  
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
    let result = services;

    // Filter by Search
    if (search) {
      const lowerSearch = search.toLowerCase();
      result = result.filter(s => 
        s.name.toLowerCase().includes(lowerSearch) || 
        s.description?.toLowerCase().includes(lowerSearch)
      );
    }

    // Filter by Category
    if (selectedCategory !== 'Todas') {
      result = result.filter(s => s.category === selectedCategory);
    }

    // Filter by Type
    if (selectedType !== 'ALL') {
      result = result.filter(s => s.type === selectedType);
    }

    setFilteredServices(result);
  }, [search, services, selectedCategory, selectedType]);

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
        category: selectedCategory !== 'Todas' ? selectedCategory : 'Web & Tech',
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

  const clearFilters = () => {
    setSearch('');
    setSelectedCategory('Todas');
    setSelectedType('ALL');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Header & Controls */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
            <h1 className="text-xl font-bold tracking-tight text-gray-900">Catálogo de Servicios</h1>
            <p className="text-xs text-gray-500">Administra tus servicios y precios base.</p>
            </div>
            <Button onClick={() => openModal()} size="sm" className="shadow-lg shadow-black/20">
            <Plus className="w-4 h-4 mr-2" /> Nuevo Servicio
            </Button>
        </div>

        {/* Filters Bar */}
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between border-t border-gray-50 pt-4">
            
            {/* Category Tabs */}
            <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(cat => (
                    <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                            selectedCategory === cat 
                            ? 'bg-black text-white shadow-md' 
                            : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                        }`}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            {/* Search & Type Filter */}
            <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                <div className="relative flex-1 sm:w-64">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                    <Input 
                        placeholder="Buscar..." 
                        className="pl-9 h-9 text-sm bg-gray-50 border-transparent focus:bg-white focus:border-gray-200"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                    {search && (
                        <button onClick={() => setSearch('')} className="absolute right-3 top-2.5 text-gray-400 hover:text-black">
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
                
                <select 
                    className="h-9 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm outline-none focus:border-black"
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value as any)}
                >
                    <option value="ALL">Todos los Tipos</option>
                    <option value={ServiceType.ONE_TIME}>Único (One-time)</option>
                    <option value={ServiceType.RECURRING}>Mensual (Recurrente)</option>
                </select>
            </div>
        </div>
      </div>

      {/* Results Stats */}
      <div className="flex justify-between items-center px-1">
         <span className="text-xs font-semibold text-gray-400">
            {filteredServices.length} servicios encontrados
         </span>
         {(selectedCategory !== 'Todas' || selectedType !== 'ALL' || search) && (
             <button onClick={clearFilters} className="text-xs text-red-500 hover:underline flex items-center">
                 <X className="w-3 h-3 mr-1" /> Limpiar filtros
             </button>
         )}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredServices.map((service) => (
          <div 
            key={service.id} 
            className="group relative flex flex-col p-5 bg-white border border-gray-100 rounded-xl hover:border-black/10 hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
          >
            <div className="flex justify-between items-start mb-3">
              <Badge variant="outline" className="text-[10px] px-2 py-0.5 bg-gray-50 font-medium tracking-wide uppercase text-gray-500 border-gray-100">
                  {service.category}
              </Badge>
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                 <button onClick={() => openModal(service)} className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-blue-600 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                 <button onClick={() => handleDelete(service.id)} className="p-1.5 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
            
            <h3 className="font-bold text-gray-900 text-sm leading-snug mb-2 line-clamp-2 h-10">{service.name}</h3>
            <p className="text-xs text-gray-400 mb-4 line-clamp-2 h-8 leading-relaxed">
                {service.description || 'Sin descripción disponible.'}
            </p>
            
            <div className="mt-auto pt-4 border-t border-dashed border-gray-100 flex justify-between items-center">
               <div className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${service.type === ServiceType.ONE_TIME ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]' : 'bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]'}`}></div>
                    <span className="text-[10px] font-semibold text-gray-500 uppercase">{service.type === ServiceType.ONE_TIME ? 'Único' : 'Mensual'}</span>
               </div>
              <span className="font-mono font-bold text-lg text-gray-900 tracking-tight">${service.baseCost}</span>
            </div>
          </div>
        ))}
        
        {filteredServices.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-dashed border-gray-200 text-gray-400">
                <Package className="w-10 h-10 mb-3 opacity-20" />
                <p>No se encontraron servicios con estos filtros.</p>
                <button onClick={clearFilters} className="mt-2 text-sm text-blue-600 hover:underline">Limpiar filtros</button>
            </div>
        )}
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingService ? 'Editar Servicio' : 'Nuevo Servicio'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Nombre del Servicio</Label>
            <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} autoFocus placeholder="Ej: Landing Page..." />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Categoría</Label>
              <select 
                className="flex h-11 w-full rounded-xl border border-gray-200 bg-gray-50/50 px-3 py-2 text-sm outline-none focus:border-black transition-colors cursor-pointer"
                value={formData.category}
                onChange={e => setFormData({...formData, category: e.target.value})}
              >
                {CATEGORIES.filter(c => c !== 'Todas').map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Tipo de Cobro</Label>
              <select 
                className="flex h-11 w-full rounded-xl border border-gray-200 bg-gray-50/50 px-3 py-2 text-sm outline-none focus:border-black transition-colors cursor-pointer"
                value={formData.type}
                onChange={e => setFormData({...formData, type: e.target.value as ServiceType})}
              >
                <option value={ServiceType.ONE_TIME}>Pago Único (Setup)</option>
                <option value={ServiceType.RECURRING}>Mensual (Fee)</option>
              </select>
            </div>
          </div>
          
          <div>
            <Label>Costo Base Interno ($)</Label>
            <div className="relative">
                <span className="absolute left-3 top-2.5 text-gray-400">$</span>
                <Input type="number" className="pl-6" value={formData.baseCost} onChange={e => setFormData({...formData, baseCost: e.target.value})} placeholder="0.00" />
            </div>
            <p className="text-[10px] text-gray-400 mt-1 ml-1">Este es el costo para la agencia, no el precio de venta.</p>
          </div>
          
          <div>
            <Label>Descripción Corta</Label>
            <Input value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Incluye diseño, desarrollo..." />
          </div>
          
          <div className="flex gap-2 pt-4">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)} className="flex-1">Cancelar</Button>
            <Button type="submit" className="flex-1 bg-black hover:bg-gray-800 text-white">
                {editingService ? 'Guardar Cambios' : 'Crear Servicio'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}