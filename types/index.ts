// Shared type definitions

export interface User {
  email: string;
  name: string;
  role?: string;
  department?: string;
}

export interface Employee {
  name: string;
  title: string;
  rate: number;
}

export interface Role {
  id: string;
  name: string;
  weeks: number;
  allocation: number;
  hours: number;
  rate: number;
  totalDollars: number;
}

export interface Department {
  id: string;
  name: string;
  output: string;
  assignedTo?: string; // email of assigned user
  assignedName?: string; // display name of assigned user
  status: 'unassigned' | 'assigned' | 'in_progress' | 'completed';
  roles: Role[];
}

// Quote/Project types
export interface PhaseSettings {
  [phaseName: string]: {
    includeProjectFees: boolean;
    includeProductionCosts: boolean;
  };
}

export interface Stage {
  id: string;
  phase: string;
  name: string;
  duration: number;
  departments: Department[];
}

export interface PhaseData {
  [phaseName: string]: Stage[];
}

export interface Project {
  projectNumber: string;
  clientName: string;
  clientCategory: string;
  brand: string;
  projectName: string;
  startDate: string;
  endDate: string;
  totalProgramBudget: number;
  rateCard: string;
  currency: string;
  phases: string[];
  phaseSettings: PhaseSettings;
  budgetLabel?: string;
  briefDate?: string;
  inMarketDate?: string;
  projectCompletionDate?: string;
}

export interface QuoteReviewData {
  projectScope: string;
  descriptions: { [key: string]: string };
  invoiceItems: Array<{
    id: string;
    invoiceNumber: string;
    amount: number;
    percentage?: number;
    paymentDue: string;
    paymentTerms: string;
    customTerms?: string;
  }>;
}
