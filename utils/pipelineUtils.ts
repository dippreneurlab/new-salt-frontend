// Client-only helpers for pipeline data stored in browser/cloud storage.
'use client';

import { fetchPipelineMetadata } from '@/lib/metadataClient';
import { cloudStorage } from '@/lib/cloudStorage';

export const DEFAULT_CLIENT_LIST = [
  'ABI', 'Adidas CAN', 'Adidas USA', 'Bell', 'Coca-Cola Canada', 'Coca-Cola USA', 'Ethos', 'Flora Foods', 'Hershey', 'Holman',
  'Kraft CAN', 'Kraft USA', 'Labatt', 'Luxe', 'Mars', 'McCain',
  'Mercedes Benz', 'Microsoft CAN', 'Microsoft USA', 'NBD - Canada', 'NBD - US', 'Other - Canada', 'Other - US', 'Pointsbet',
  'RBC', 'Rona', 'Sephora', 'Shopify', 'The Kitchen', 'Toyota', 'Unilever'
];

export const DEFAULT_RATE_CARD_MAP: Record<string, string> = {
  'Labatt': 'Labatt',
  'RBC': 'RBC',
  'Toyota': 'Toyota Retainer',
  'Hershey': 'Hershey Retainer',
  'Coca-Cola Canada': 'ABI',
  'Coca-Cola USA': 'ABI',
  'Bell': 'Rogers',
  'Mars': 'ABI',
  'Kraft CAN': 'ABI',
  'Kraft USA': 'ABI',
  'McCain': 'Standard',
  'Microsoft CAN': 'Standard',
  'Microsoft USA': 'Standard',
  'Shopify': 'Standard',
  'Sephora': 'Standard',
  'Unilever': 'Standard',
  'Adidas CAN': 'Standard',
  'Adidas USA': 'Standard',
};

export const DEFAULT_CLIENT_CATEGORY_MAP: Record<string, string> = {
  'Adidas CAN': 'Category 3 - Prospective Growth',
  'Adidas USA': 'Category 3 - Prospective Growth',
  'Bell': 'Category 5 - Baseline Booster',
  'Coca-Cola Canada': 'Category 1 - Foundational',
  'Coca-Cola USA': 'Category 1 - Foundational',
  'Ethos': 'Category 5 - Baseline Booster',
  'Flora Foods': 'Category 5 - Baseline Booster',
  'Hershey': 'Category 3 - Prospective Growth',
  'Holman': 'Category 4 - Service Anchors',
  'Kraft CAN': 'Category 1 - Foundational',
  'Kraft USA': 'Category 1 - Foundational',
  'Labatt': 'Category 1 - Foundational',
  'Luxe': 'Category 3 - Prospective Growth',
  'Mars': 'Category 3 - Prospective Growth',
  'McCain': 'Category 2 - Core Partners',
  'Mercedes Benz': 'Category 5 - Baseline Booster',
  'Microsoft CAN': 'Category 2 - Core Partners',
  'Microsoft USA': 'Category 2 - Core Partners',
  'NBD - Canada': 'Category 5 - Baseline Booster',
  'NBD - US': 'Category 5 - Baseline Booster',
  'Other - Canada': 'Category 5 - Baseline Booster',
  'Other - US': 'Category 5 - Baseline Booster',
  'Pointsbet': 'Category 2 - Core Partners',
  'RBC': 'Category 1 - Foundational',
  'Rona': 'Category 4 - Service Anchors',
  'Sephora': 'Category 2 - Core Partners',
  'Shopify': 'Category 2 - Core Partners',
  'The Kitchen': 'Category 4 - Service Anchors',
  'Toyota': 'Category 2 - Core Partners',
  'Unilever': 'Category 3 - Prospective Growth'
};

let clientListCache = [...DEFAULT_CLIENT_LIST];
let clientRateCardMap = { ...DEFAULT_RATE_CARD_MAP };
let clientCategoryMap = { ...DEFAULT_CLIENT_CATEGORY_MAP };

export { clientListCache as CLIENT_LIST };

export const hydratePipelineMetadata = async () => {
  try {
    const metadata = await fetchPipelineMetadata();
    clientListCache = metadata.clients;
    clientRateCardMap = metadata.rateCardMap || clientRateCardMap;
    clientCategoryMap = metadata.clientCategoryMap || clientCategoryMap;
    return metadata;
  } catch (err) {
    console.error('Failed to hydrate pipeline metadata, using defaults', err);
    return {
      clients: clientListCache,
      rateCardMap: clientRateCardMap,
      clientCategoryMap
    };
  }
};

export const getClientList = () => clientListCache;
export const getRateCardMap = () => clientRateCardMap;
export const getClientCategoryMap = () => clientCategoryMap;

// Utility functions for pipeline integration

export interface PipelineEntry {
  projectCode: string;
  owner: string;
  client: string;
  programName: string;
  region: string;
  programType: string;
  startMonth: string;
  endMonth: string;
  revenue: number;
  totalFees: number;
  status: string;
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
}

export const PIPELINE_ENTRIES_KEY = 'pipeline-entries';

// Load pipeline entries from Cloud SQL
export const loadPipelineEntries = (): PipelineEntry[] => {
  const saved = cloudStorage.getItem(PIPELINE_ENTRIES_KEY);
  if (!saved) return [];
  if (Array.isArray(saved)) return saved;
  if (typeof saved === 'string') {
    try {
      return JSON.parse(saved);
    } catch (error) {
      console.error('Failed to parse pipeline entries', error);
      return [];
    }
  }
  return [];
};

// Get available pipeline projects for quote creation
export const getAvailablePipelineProjects = (): Array<{
  projectCode: string;
  displayName: string;
  client: string;
  programName: string;
  totalFees: number;
  status: string;
}> => {
  const entries = loadPipelineEntries();
  
  return entries
    .filter(entry => 
      // Only show projects that are not cancelled or completed
      !['cancelled', 'completed'].includes(entry.status.toLowerCase())
    )
    .map(entry => ({
      projectCode: entry.projectCode,
      displayName: `${entry.projectCode} - ${entry.client} - ${entry.programName}`,
      client: entry.client,
      programName: entry.programName,
      totalFees: entry.totalFees,
      status: entry.status
    }))
    .sort((a, b) => a.projectCode.localeCompare(b.projectCode));
};

// Get pipeline entry by project code
export const getPipelineEntryByCode = (projectCode: string): PipelineEntry | null => {
  const entries = loadPipelineEntries();
  return entries.find(entry => entry.projectCode === projectCode) || null;
};

// Convert pipeline entry to project data for quote creation
export const convertPipelineToProject = (pipelineEntry: PipelineEntry) => {
  // Auto-select rate card based on client name, default to 'Standard'
  const rateCard = clientRateCardMap[pipelineEntry.client] || 'Standard';
  
  // Auto-select client category based on client name
  const clientCategory = clientCategoryMap[pipelineEntry.client] || '';

  // Auto-select currency based on client billing entity from Cloud SQL
  let currency = 'CAD'; // Default to CAD
  const savedClientSettings = cloudStorage.getItem('pipeline-client-settings');
  if (Array.isArray(savedClientSettings)) {
    const clientSetting = savedClientSettings.find((c: any) => c.name === pipelineEntry.client);
    if (clientSetting) {
      currency = clientSetting.billingEntity === 'Salt XC US' ? 'USD' : 'CAD';
    }
  }

  return {
    projectNumber: pipelineEntry.projectCode,
    clientName: pipelineEntry.client,
    clientCategory, // Auto-populated based on client
    brand: pipelineEntry.client, // Use client as default brand
    projectName: pipelineEntry.programName,
    briefDate: '', // To be filled in by user
    inMarketDate: '', // To be filled in by user
    projectCompletionDate: '', // To be filled in by user
    totalProgramBudget: pipelineEntry.totalFees,
    rateCard, // Auto-selected based on client, defaults to 'Standard'
    currency, // Auto-selected based on billing entity
    phases: ['Planning', 'Production/Execution', 'Post Production/Wrap'], // Default phases
    phaseSettings: {
      'Planning': { includeProjectFees: true, includeProductionCosts: true },
      'Production/Execution': { includeProjectFees: true, includeProductionCosts: true },
      'Post Production/Wrap': { includeProjectFees: true, includeProductionCosts: true }
    }
  };
};

// Check if a project number is from pipeline
export const isPipelineProjectNumber = (projectNumber: string): boolean => {
  // Pipeline project numbers follow pattern like "P0001-25", "P0002-25", etc.
  return /^P\d{4}-\d{2}$/.test(projectNumber);
};

// Generate next available project number (for manual entry)
export const generateNextProjectNumber = (): string => {
  const entries = loadPipelineEntries();
  const currentYear = new Date().getFullYear();
  
  // Find the highest number for current year
  const currentYearEntries = entries
    .filter(entry => entry.projectCode.startsWith(`${currentYear}-`))
    .map(entry => {
      const match = entry.projectCode.match(/(\d{4})-(\d{3})/);
      return match ? parseInt(match[2], 10) : 0;
    })
    .sort((a, b) => b - a);
  
  const nextNumber = currentYearEntries.length > 0 ? currentYearEntries[0] + 1 : 1;
  return `${currentYear}-${nextNumber.toString().padStart(3, '0')}`;
};
