'use client';

import { Project, PhaseData, QuoteReviewData } from '../app/AppClient';
import { cloudStorage } from '@/lib/cloudStorage';

// Pipeline entry interface for creating quotes
export interface PipelineEntry {
  projectCode: string;
  status: string;
  owner: string;
  client: string;
  programName: string;
  region: string;
  programType: string;
  startMonth: string;
  endMonth: string;
  revenue: number;
  totalFees: number;
  accounts: number;
  creative: number;
  design: number;
  strategy: number;
  media: number;
  studio: number;
  creator: number;
  social: number;
  omni: number;
  finance: number;
  monthly?: { [month: string]: number };
}

export interface Quote {
  id: string;
  projectNumber?: string;
  clientName: string;
  brand: string;
  projectName: string;
  inMarketDate: string;
  projectCompletionDate: string;
  currency: string;
  totalRevenue: number;
  departmentBreakdown: { [department: string]: number };
  // Optional label to distinguish multiple budgets for the same project
  budgetLabel?: string;
  status: 'draft' | 'pending' | 'approved' | 'completed';
  createdDate: string;
  lastModified: string;
  createdBy: string;
  // Full quote data
  project: Project;
  phaseData: PhaseData;
  productionCostData: any;
  quoteReviewData: QuoteReviewData;
}

const QUOTES_STORAGE_KEY = 'saltxc-all-quotes';

// Calculate total revenue from project and production costs
export function calculateQuoteRevenue(phaseData: PhaseData, productionCostData: any): number {
  // Calculate project fees total
  let projectFeesTotal = 0;
  Object.values(phaseData).forEach(stages => {
    stages.forEach(stage => {
      stage.departments.forEach(dept => {
        dept.roles.forEach(role => {
          projectFeesTotal += role.totalDollars || 0;
        });
      });
    });
  });

  // Calculate creative and design resourcing fees with 1.5% charge each
  let creativeTotal = 0;
  let designTotal = 0;
  Object.values(phaseData).forEach(stages => {
    stages.forEach(stage => {
      stage.departments.forEach(dept => {
        if (dept.name === 'Creative') {
          dept.roles.forEach(role => {
            creativeTotal += role.totalDollars || 0;
          });
        } else if (dept.name === 'Design') {
          dept.roles.forEach(role => {
            designTotal += role.totalDollars || 0;
          });
        }
      });
    });
  });
  const creativeResourcingFee = creativeTotal * 0.015;
  const designResourcingFee = designTotal * 0.015;

  // Calculate production costs total
  let productionCostsTotal = 0;
  Object.values(productionCostData).forEach((phaseCategories: any) => {
    Object.values(phaseCategories).forEach((categoryData: any) => {
      // Standard items
      if (categoryData.standardItems) {
        categoryData.standardItems.forEach((item: any) => {
          productionCostsTotal += item.totalCost || 0;
        });
      }
      // Media items
      if (categoryData.mediaItems) {
        categoryData.mediaItems.forEach((item: any) => {
          productionCostsTotal += item.totalCost || 0;
        });
      }
      // Field staff items
      if (categoryData.fieldStaffItems) {
        categoryData.fieldStaffItems.forEach((item: any) => {
          productionCostsTotal += item.totalCost || 0;
        });
      }
    });
  });

  return projectFeesTotal + productionCostsTotal + creativeResourcingFee + designResourcingFee;
}

// Calculate department breakdown from phase data
export function calculateDepartmentBreakdown(phaseData: PhaseData): { [department: string]: number } {
  const breakdown: { [department: string]: number } = {};
  
  Object.values(phaseData).forEach(stages => {
    stages.forEach(stage => {
      stage.departments.forEach(dept => {
        if (!breakdown[dept.name]) {
          breakdown[dept.name] = 0;
        }
        dept.roles.forEach(role => {
          breakdown[dept.name] += role.totalDollars || 0;
        });
      });
    });
  });

  return breakdown;
}

// Save a quote to Cloud SQL via the storage API
export function saveQuote(
  project: Project,
  phaseData: PhaseData,
  productionCostData: any,
  quoteReviewData: QuoteReviewData,
  userEmail: string,
  quoteId?: string
): string {
  const quotes = getAllQuotes();
  const id = quoteId || generateQuoteId();
  const now = new Date().toISOString();
  
  const totalRevenue = calculateQuoteRevenue(phaseData, productionCostData);
  const departmentBreakdown = calculateDepartmentBreakdown(phaseData);

  console.log('💾 QuoteManager saveQuote called with phaseData:', {
    phaseDataKeys: Object.keys(phaseData),
    phaseDataEntries: Object.keys(phaseData).length,
    projectName: project.projectName,
    quoteId
  });

  const existing = quotes.find(q => q.id === id);
  const quote: Quote = {
    id,
    projectNumber: project.projectNumber,
    clientName: project.clientName,
    brand: project.brand,
    projectName: project.projectName,
    inMarketDate: project.startDate || project.inMarketDate || '',
    projectCompletionDate: project.endDate || project.projectCompletionDate || '',
    currency: project.currency,
    totalRevenue,
    departmentBreakdown,
    budgetLabel: project.budgetLabel || existing?.budgetLabel || 'General',
    status: 'draft',
    createdDate: quoteId ? quotes.find(q => q.id === quoteId)?.createdDate || now : now,
    lastModified: now,
    createdBy: userEmail,
    project,
    phaseData,
    productionCostData,
    quoteReviewData
  };

  // Update or add quote
  const quoteIndex = quotes.findIndex(q => q.id === id);
  if (quoteIndex >= 0) {
    quotes[quoteIndex] = quote;
  } else {
    quotes.push(quote);
  }

  console.log('💾 Saving to Cloud SQL storage:', {
    quotesCount: quotes.length,
    currentQuotePhaseData: quote.phaseData,
    currentQuotePhaseDataKeys: Object.keys(quote.phaseData || {})
  });
  cloudStorage.setItem(QUOTES_STORAGE_KEY, JSON.stringify(quotes));
  
  // Dispatch a custom event so in-tab listeners (like PM Dashboard) can refresh immediately
  try {
    window.dispatchEvent(new Event('saltxc-quotes-updated'));
  } catch (_) {
    // ignore if window is not available (SSR)
  }
  
  return id;
}

// Load a specific quote by ID
export function loadQuote(quoteId: string): Quote | null {
  const quotes = getAllQuotes();
  const quote = quotes.find(q => q.id === quoteId) || null;
  
  if (quote) {
    console.log('📂 QuoteManager loadQuote found quote:', {
      quoteId,
      projectNumber: quote.projectNumber,
      phaseDataKeys: Object.keys(quote.phaseData || {}),
      phaseDataEntries: Object.keys(quote.phaseData || {}).length,
      projectName: quote.projectName
    });
  } else {
    console.log('❌ QuoteManager loadQuote - quote not found:', quoteId);
  }
  
  return quote;
}

// Get all quotes from Cloud SQL
export function getAllQuotes(): Quote[] {
  const saved = cloudStorage.getItem(QUOTES_STORAGE_KEY);
  if (!saved) return [];
  if (Array.isArray(saved)) return saved as Quote[];
  if (typeof saved === 'string') {
    try {
      return JSON.parse(saved);
    } catch (error) {
      console.error('Failed to parse saved quotes', error);
      return [];
    }
  }
  return [];
}

// Delete a quote
export function deleteQuote(quoteId: string): boolean {
  try {
    const quotes = getAllQuotes();
    const filtered = quotes.filter(q => q.id !== quoteId);
    cloudStorage.setItem(QUOTES_STORAGE_KEY, JSON.stringify(filtered));
    try { window.dispatchEvent(new Event('saltxc-quotes-updated')); } catch(_) {}
    return true;
  } catch (error) {
    console.error('Failed to delete quote:', error);
    return false;
  }
}

// Delete all quotes
export function deleteAllQuotes(): boolean {
  try {
    cloudStorage.removeItem(QUOTES_STORAGE_KEY);
    return true;
  } catch (error) {
    console.error('Failed to delete all quotes:', error);
    return false;
  }
}

// Update quote status
export function updateQuoteStatus(quoteId: string, status: Quote['status']): boolean {
  try {
    const quotes = getAllQuotes();
    const quote = quotes.find(q => q.id === quoteId);
    if (quote) {
      quote.status = status;
      quote.lastModified = new Date().toISOString();
      cloudStorage.setItem(QUOTES_STORAGE_KEY, JSON.stringify(quotes));
      try { window.dispatchEvent(new Event('saltxc-quotes-updated')); } catch(_) {}
      return true;
    }
    return false;
  } catch (error) {
    console.error('Failed to update quote status:', error);
    return false;
  }
}

// Create a quote from pipeline entry
export function createQuoteFromPipeline(pipelineEntry: PipelineEntry, userEmail: string): string {
  // Create basic project data from pipeline entry
  const project: Project = {
    projectNumber: pipelineEntry.projectCode,
    clientName: pipelineEntry.client,
    clientCategory: '', // Will be filled in when building detailed budget
    brand: pipelineEntry.client, // Use client as brand for now
    projectName: pipelineEntry.programName,
    // Dates (use start/end for Project type; keep inMarket/projectCompletion for quote fields)
    startDate: pipelineEntry.startMonth || '',
    endDate: pipelineEntry.endMonth || '',
    totalProgramBudget: pipelineEntry.totalFees,
    rateCard: 'Blended', // Default rate card
    currency: 'CAD', // Default currency
    phases: ['Planning', 'Production/Execution', 'Post Production/Wrap'], // Default phases
    phaseSettings: {
      'Planning': { includeProjectFees: true, includeProductionCosts: true },
      'Production/Execution': { includeProjectFees: true, includeProductionCosts: true },
      'Post Production/Wrap': { includeProjectFees: true, includeProductionCosts: true }
    }
  };

  // Create empty phase data structure - will be filled when building detailed budget
  const phaseData: PhaseData = {
    'Planning': [],
    'Production/Execution': [],
    'Post Production/Wrap': []
  };

  // Create empty production cost data
  const productionCostData = {
    'Planning': {},
    'Production/Execution': {},
    'Post Production/Wrap': {}
  };

  // Create empty quote review data
  const quoteReviewData: QuoteReviewData = {
    projectScope: '', // Will be filled in when building detailed budget
    descriptions: {},
    invoiceItems: []
  };

  // Save the quote
  const quoteId = saveQuote(project, phaseData, productionCostData, quoteReviewData, userEmail);

  // Ensure initial budget label
  const quotes = getAllQuotes();
  const idx = quotes.findIndex(q => q.id === quoteId);
  if (idx >= 0 && !quotes[idx].budgetLabel) {
    quotes[idx].budgetLabel = 'General';
    cloudStorage.setItem(QUOTES_STORAGE_KEY, JSON.stringify(quotes));
  }
  
  console.log(`📋 Created quote ${quoteId} from pipeline entry ${pipelineEntry.projectCode}`);
  
  return quoteId;
}

// Create a new empty budget for an existing project (same projectNumber)
export function createBudgetForProject(base: Quote, budgetLabel: string, userEmail: string): string {
  const quotes = getAllQuotes();
  const id = generateQuoteId();
  const now = new Date().toISOString();

  const emptyPhaseData: PhaseData = {
    'Planning': [],
    'Production/Execution': [],
    'Post Production/Wrap': []
  };
  const emptyProduction: any = {
    'Planning': {},
    'Production/Execution': {},
    'Post Production/Wrap': {}
  };
  const emptyReview: QuoteReviewData = {
    projectScope: '',
    descriptions: {},
    invoiceItems: []
  };

  const newQuote: Quote = {
    id,
    projectNumber: base.projectNumber,
    clientName: base.clientName,
    brand: base.brand,
    projectName: base.projectName,
    inMarketDate: base.inMarketDate,
    projectCompletionDate: base.projectCompletionDate,
    currency: base.currency || 'CAD',
    totalRevenue: 0,
    departmentBreakdown: {},
    budgetLabel: budgetLabel || 'Budget',
    status: 'draft',
    createdDate: now,
    lastModified: now,
    createdBy: userEmail,
    project: {
      ...base.project,
      totalProgramBudget: 0
    },
    phaseData: emptyPhaseData,
    productionCostData: emptyProduction,
    quoteReviewData: emptyReview
  };

  // Do not persist empty $0 budgets by default; caller will save explicitly after editing
  // Keep it available only in memory if needed by caller
  // quotes.push(newQuote);
  // Quotes are persisted via Cloud SQL storage
  
  // Instead, return the id so caller can decide when to save
  return id;
}

// Generate a unique quote ID
function generateQuoteId(): string {
  return 'quote-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}
