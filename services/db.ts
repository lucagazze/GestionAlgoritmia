import { supabase } from './supabase';
import { Service, Proposal, Project, Task, ProjectStatus, ProposalStatus, TaskStatus } from '../types';

// Utility to handle Supabase responses
const handleResponse = async <T>(query: any): Promise<T[]> => {
  const { data, error } = await query;
  if (error) {
    console.error('Supabase Error:', error);
    // Return empty array on error to prevent UI crash, but log it
    return [];
  }
  return data || [];
};

export const db = {
  services: {
    getAll: async (): Promise<Service[]> => {
      return handleResponse<Service>(supabase.from('Service').select('*'));
    },
    create: async (data: Omit<Service, 'id'>): Promise<Service> => {
      const { data: created, error } = await supabase.from('Service').insert(data).select().single();
      if (error) throw error;
      return created;
    },
    update: async (id: string, data: Partial<Service>): Promise<Service> => {
      const { data: updated, error } = await supabase.from('Service').update(data).eq('id', id).select().single();
      if (error) throw error;
      return updated;
    },
    delete: async (id: string): Promise<void> => {
      const { error } = await supabase.from('Service').delete().eq('id', id);
      if (error) throw error;
    }
  },
  
  projects: {
    // Mapping "Projects" in UI to "Client" table in DB as per schema logic
    getAll: async (): Promise<Project[]> => {
      const { data, error } = await supabase.from('Client').select('*');
      if (error) {
        console.error('Supabase Error (Client):', error);
        return [];
      }
      
      // Adapt DB fields to UI types if necessary (assuming DB has these columns)
      // If columns are missing in DB, we provide defaults to prevent crashes
      return (data || []).map((c: any) => ({
        ...c,
        status: c.status || ProjectStatus.ACTIVE,
        monthlyRevenue: c.monthlyRevenue || 0,
        billingDay: c.billingDay || 1,
        notes: c.notes || ''
      }));
    },
    create: async (data: Omit<Project, 'id' | 'createdAt'>): Promise<Project> => {
      // We manually add createdAt for consistency if DB doesn't default it
       const payload = { ...data, createdAt: new Date().toISOString() };
       const { data: created, error } = await supabase.from('Client').insert(payload).select().single();
       if (error) throw error;
       return created;
    },
    update: async (id: string, data: Partial<Project>): Promise<void> => {
      const { error } = await supabase.from('Client').update(data).eq('id', id);
      if (error) throw error;
    },
    delete: async (id: string): Promise<void> => {
        const { error } = await supabase.from('Client').delete().eq('id', id);
        if (error) throw error;
    }
  },

  tasks: {
    // Assuming a 'Task' table exists
    getAll: async (): Promise<Task[]> => {
      return handleResponse<Task>(supabase.from('Task').select('*'));
    },
    create: async (data: Omit<Task, 'id'>): Promise<Task> => {
      const { data: created, error } = await supabase.from('Task').insert(data).select().single();
      if (error) throw error;
      return created;
    },
    updateStatus: async (id: string, status: TaskStatus): Promise<void> => {
      const { error } = await supabase.from('Task').update({ status }).eq('id', id);
      if (error) throw error;
    },
    delete: async (id: string): Promise<void> => {
      const { error } = await supabase.from('Task').delete().eq('id', id);
      if (error) throw error;
    }
  },

  proposals: {
    create: async (data: Omit<Proposal, 'id' | 'createdAt' | 'clientId'>, clientName: string): Promise<Proposal> => {
        
        // 1. Check if client exists, otherwise create it
        let clientId = '';
        const { data: existingClient } = await supabase.from('Client').select('id, monthlyRevenue').ilike('name', clientName).maybeSingle();
        
        if (existingClient) {
            clientId = existingClient.id;
            // Update MRR if changed
            await supabase.from('Client').update({ monthlyRevenue: data.totalRecurringPrice }).eq('id', clientId);
        } else {
            const { data: newClient, error: clientError } = await supabase.from('Client').insert({
                name: clientName,
                createdAt: new Date().toISOString(),
                status: ProjectStatus.ONBOARDING,
                monthlyRevenue: data.totalRecurringPrice,
                billingDay: 1
            }).select().single();
            
            if (clientError) throw clientError;
            clientId = newClient.id;
        }

        // 2. Create Proposal
        const proposalPayload = {
            clientId,
            status: data.status,
            objective: data.objective,
            durationMonths: data.durationMonths,
            marginMultiplier: data.marginMultiplier,
            totalOneTimePrice: data.totalOneTimePrice,
            totalRecurringPrice: data.totalRecurringPrice,
            totalContractValue: data.totalContractValue,
            aiPromptGenerated: data.aiPromptGenerated,
            createdAt: new Date().toISOString()
        };

        const { data: newProposal, error: proposalError } = await supabase.from('Proposal').insert(proposalPayload).select().single();
        if (proposalError) throw proposalError;

        // 3. Create Proposal Items
        if (data.items && data.items.length > 0) {
            const itemsPayload = data.items.map(item => ({
                proposalId: newProposal.id,
                serviceId: item.serviceId,
                serviceSnapshotName: item.serviceSnapshotName,
                serviceSnapshotCost: item.serviceSnapshotCost
            }));
            
            const { error: itemsError } = await supabase.from('ProposalItem').insert(itemsPayload);
            if (itemsError) console.error("Error creating items", itemsError);
        }

        return newProposal;
    },
    getAll: async (): Promise<Proposal[]> => {
         const { data, error } = await supabase
            .from('Proposal')
            .select(`
                *,
                client:Client(*)
            `)
            .order('createdAt', { ascending: false });
            
         if (error) throw error;
         return data as Proposal[];
    }
  }
};