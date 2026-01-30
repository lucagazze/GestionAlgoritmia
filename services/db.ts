import { Service, Proposal, Client, Project, Task, ServiceType, ProjectStatus, TaskStatus } from '../types';
import { initialServices } from '../seed';

const uuid = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

const SERVICES_KEY = 'algoritmia_services';
const PROPOSALS_KEY = 'algoritmia_proposals';
const CLIENTS_KEY = 'algoritmia_clients'; // Used for Projects as well
const TASKS_KEY = 'algoritmia_tasks';

const loadData = <T>(key: string, defaults: any[] = []): T[] => {
  const stored = localStorage.getItem(key);
  if (!stored) {
    if (defaults.length > 0) {
      const seeded = defaults.map(d => ({ ...d, id: uuid() }));
      localStorage.setItem(key, JSON.stringify(seeded));
      return seeded;
    }
    return [];
  }
  return JSON.parse(stored);
};

export const db = {
  services: {
    getAll: async (): Promise<Service[]> => {
      await new Promise(r => setTimeout(r, 200));
      return loadData<Service>(SERVICES_KEY, initialServices);
    },
    create: async (data: Omit<Service, 'id'>): Promise<Service> => {
      const services = loadData<Service>(SERVICES_KEY);
      const newService = { ...data, id: uuid() };
      services.push(newService);
      localStorage.setItem(SERVICES_KEY, JSON.stringify(services));
      return newService;
    },
    update: async (id: string, data: Partial<Service>): Promise<Service> => {
      let services = loadData<Service>(SERVICES_KEY);
      const index = services.findIndex(s => s.id === id);
      if (index === -1) throw new Error("Service not found");
      
      services[index] = { ...services[index], ...data };
      localStorage.setItem(SERVICES_KEY, JSON.stringify(services));
      return services[index];
    },
    delete: async (id: string): Promise<void> => {
      let services = loadData<Service>(SERVICES_KEY);
      services = services.filter(s => s.id !== id);
      localStorage.setItem(SERVICES_KEY, JSON.stringify(services));
    }
  },
  
  projects: {
    // Treat Clients as Projects for this simple OS
    getAll: async (): Promise<Project[]> => {
      const clients = loadData<any>(CLIENTS_KEY);
      // Ensure they have project fields if created via Proposal
      return clients.map((c: any) => ({
        ...c,
        status: c.status || ProjectStatus.ACTIVE,
        monthlyRevenue: c.monthlyRevenue || 0,
        notes: c.notes || ''
      }));
    },
    update: async (id: string, data: Partial<Project>): Promise<void> => {
      let projects = loadData<Project>(CLIENTS_KEY);
      const index = projects.findIndex(p => p.id === id);
      if (index !== -1) {
        projects[index] = { ...projects[index], ...data };
        localStorage.setItem(CLIENTS_KEY, JSON.stringify(projects));
      }
    },
    create: async (data: Omit<Project, 'id' | 'createdAt'>): Promise<Project> => {
       const projects = loadData<Project>(CLIENTS_KEY);
       const newProject = { ...data, id: uuid(), createdAt: new Date() };
       projects.push(newProject);
       localStorage.setItem(CLIENTS_KEY, JSON.stringify(projects));
       return newProject;
    }
  },

  tasks: {
    getAll: async (): Promise<Task[]> => {
      return loadData<Task>(TASKS_KEY);
    },
    create: async (data: Omit<Task, 'id'>): Promise<Task> => {
      const tasks = loadData<Task>(TASKS_KEY);
      const newTask = { ...data, id: uuid() };
      tasks.push(newTask);
      localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
      return newTask;
    },
    updateStatus: async (id: string, status: TaskStatus): Promise<void> => {
      let tasks = loadData<Task>(TASKS_KEY);
      const task = tasks.find(t => t.id === id);
      if (task) {
        task.status = status;
        localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
      }
    },
    delete: async (id: string): Promise<void> => {
      let tasks = loadData<Task>(TASKS_KEY);
      tasks = tasks.filter(t => t.id !== id);
      localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
    }
  },

  proposals: {
    create: async (data: Omit<Proposal, 'id' | 'createdAt' | 'clientId'>, clientName: string): Promise<Proposal> => {
        await new Promise(r => setTimeout(r, 600));

        let clients = loadData<Project>(CLIENTS_KEY);
        let client = clients.find(c => c.name.toLowerCase() === clientName.toLowerCase());
        
        if (!client) {
            client = { 
              id: uuid(), 
              name: clientName, 
              createdAt: new Date(),
              status: ProjectStatus.ONBOARDING,
              monthlyRevenue: data.totalRecurringPrice // Auto-set revenue
            };
            clients.push(client);
            localStorage.setItem(CLIENTS_KEY, JSON.stringify(clients));
        } else {
             // Update existing client revenue if proposal is accepted logic (simplified here)
             client.monthlyRevenue = data.totalRecurringPrice;
             localStorage.setItem(CLIENTS_KEY, JSON.stringify(clients));
        }

        const proposals = loadData<Proposal>(PROPOSALS_KEY);
        const newProposal: Proposal = {
            ...data,
            id: uuid(),
            clientId: client.id,
            createdAt: new Date(),
        };
        proposals.push(newProposal);
        localStorage.setItem(PROPOSALS_KEY, JSON.stringify(proposals));
        
        return newProposal;
    },
    getAll: async (): Promise<Proposal[]> => {
         const proposals = loadData<Proposal>(PROPOSALS_KEY);
         const clients = loadData<Client>(CLIENTS_KEY);
         return proposals.map(p => ({
             ...p,
             client: clients.find(c => c.id === p.clientId)
         })).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
  }
};
