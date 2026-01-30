export enum ServiceType {
  ONE_TIME = 'ONE_TIME',
  RECURRING = 'RECURRING',
}

export enum ProposalStatus {
  DRAFT = 'DRAFT',
  SENT = 'SENT',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
}

export enum ProjectStatus {
  ACTIVE = 'ACTIVE', // Pagando mensualmente
  ONBOARDING = 'ONBOARDING', // En setup
  COMPLETED = 'COMPLETED', // Terminado (One-time)
  PAUSED = 'PAUSED', // Pausado
}

export enum TaskStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  DONE = 'DONE',
}

export interface Service {
  id: string;
  name: string;
  category: string;
  type: ServiceType;
  baseCost: number;
  description?: string;
}

export interface Client {
  id: string;
  name: string;
  industry?: string;
  email?: string;
  createdAt: Date;
}

// Extendemos Client para usarlo como Proyecto en la vista de gestión
export interface Project extends Client {
  status: ProjectStatus;
  monthlyRevenue: number; // Cuánto nos paga al mes
  nextBillingDate?: string;
  notes?: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  projectId?: string; // Vinculado a un cliente/proyecto
  dueDate?: string;
}

export interface ProposalItem {
  id: string;
  serviceId: string;
  serviceSnapshotName: string;
  serviceSnapshotCost: number;
}

export interface Proposal {
  id: string;
  clientId: string;
  client?: Client;
  status: ProposalStatus;
  objective: string;
  durationMonths: number;
  marginMultiplier: number;
  totalOneTimePrice: number;
  totalRecurringPrice: number;
  totalContractValue: number;
  aiPromptGenerated: string;
  items: ProposalItem[];
  createdAt: Date;
}

export type ServiceCategory = 'Web & Tech' | 'Branding' | 'Contenido' | 'Ads / Tráfico' | 'Automatización' | 'Consultoría';
