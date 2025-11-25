import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { RATE_MAPPING_2025 } from '../utils/rateMapping2025';
import BrandedHeader from './BrandedHeader';
import { createQuoteFromPipeline } from '@/utils/quoteManager';
import { useOverheadEmployees } from '../hooks/useOverheadEmployees';
import { cloudStorage } from '@/lib/cloudStorage';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface User {
  email: string;
  name: string;
}

interface PipelineProps {
  user: User;
  onLogout: () => void;
  onBack: () => void;
  userView?: 'Admin' | 'Business Owner' | 'Team Member';
  isEmbedded?: boolean; // When true, hide sidebar and use simplified layout
  initialView?: string; // Control the initial/forced view from parent component
  triggerAddNew?: boolean; // When true, automatically open the add new dialog
  onAddNewComplete?: () => void; // Callback when add new dialog is closed
}

const OWNER_OPTIONS = [
  'Kait D', 'Bianca M', 'Marcin B', 'Zak C', 'Mike M',
  'Steve B', 'Dane H', 'Carol P', 'Rob C', 'Sandra R'
];

import { CLIENT_LIST } from '../utils/pipelineUtils';

const MONTH_OPTIONS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sept','Oct','Nov','Dec'];

const STATUS_OPTIONS = ['Confirmed', 'Open', 'High Pitch', 'Medium Pitch', 'Low Pitch', 'Whitespace', 'Finance Review', 'Pending Deletion'];

const REGION_OPTIONS = ['Canada', 'US'];

const PROGRAM_TYPE_OPTIONS = ['Integrated', 'Media', 'XM'];

const DEPARTMENT_OPTIONS = ['Accounts', 'Creative', 'Design', 'Strategy', 'Media', 'Creator', 'Social', 'Studio', 'Sponsorship', 'Omni Shopper', 'SG&A'];

const DEPT_FEE_FIELD_MAP: { [label: string]: keyof PipelineEntry | null } = {
  'Accounts': 'accounts',
  'Creative': 'creative',
  'Design': 'design',
  'Strategy': 'strategy',
  'Media': 'media',
  'Creator': 'creator',
  'Social': 'social',
  'Studio': 'studio',
  'Sponsorship': null,
  'Omni Shopper': 'omni',
  'Digital': null,
};

type PipelineEntry = {
  projectCode: string;
  entryType?: 'In Plan' | 'New to Plan';
  owner: string;
  client: string;
  programName: string;
  startMonth: string; // Now stores full date (YYYY-MM-DD) but displays as month name
  endMonth: string;   // Now stores full date (YYYY-MM-DD) but displays as month name
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
  status: string;
  region: string;
  programType: string;
  parentProjectCode?: string;
};

// Helper function to format date as "Mon YYYY" (e.g., "Jan 2025")
const formatMonthYear = (dateString: string): string => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]} ${date.getFullYear()}`;
};

// Helper function to check if a project spans multiple calendar years
const spansMultipleYears = (startDate: string, endDate: string): boolean => {
  if (!startDate || !endDate) return false;
  const start = new Date(startDate);
  const end = new Date(endDate);
  return start.getFullYear() !== end.getFullYear();
};

type OverheadRow = {
  department: string;
  employee: string;
  role: string;
  annualSalary: number;
  allocationPercent: number;
  startDate?: string;
  endDate?: string;
  monthly: { [month: string]: number };
};

const formatCurrencyInput = (value: string): string => {
  const numeric = value.replace(/[^\d]/g, '');
  if (!numeric) return '';
  return '$' + Number(numeric).toLocaleString('en-US', { maximumFractionDigits: 0 });
};

const parseCurrencyInput = (value: string): number => {
  if (!value) return 0;
  const numeric = value.replace(/[^\d]/g, '');
  const parsed = parseInt(numeric || '0', 10);
  return isNaN(parsed) ? 0 : parsed;
};

const generateProjectCode = (counter: number): string => {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const paddedCounter = String(counter).padStart(4, '0'); // 4 digits with leading zeros
  return `P${paddedCounter}-${yy}`;
};

// Generate unique project code that doesn't conflict with existing entries
const generateUniqueProjectCode = (existingEntries: PipelineEntry[], currentCounter: number): { code: string; newCounter: number } => {
  const existingCodes = new Set(existingEntries.map(entry => entry.projectCode));
  
  let counter = currentCounter;
  let projectCode = generateProjectCode(counter);
  
  // Keep incrementing until we find a unique code
  while (existingCodes.has(projectCode)) {
    counter++;
    projectCode = generateProjectCode(counter);
  }
  
  return { code: projectCode, newCounter: counter };
};

const formatDateInput = (d: Date): string => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const calculateMonthlyForecast = (entry: PipelineEntry, overrides: { [month: string]: number } = {}): { [key: string]: number } => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
  const monthlyFees: { [key: string]: number } = {};

  // Initialize all months to 0
  months.forEach(month => {
    monthlyFees[month] = 0;
  });

  if (!entry.startMonth || !entry.endMonth) {
    return monthlyFees;
  }

  const currentYear = new Date().getFullYear();
  const startDate = new Date(entry.startMonth);
  const endDate = new Date(entry.endMonth);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || endDate < startDate) {
    return monthlyFees;
  }

  // Count total project duration in months across all years
  let totalProjectMonths = 0;
  const walkerAll = new Date(startDate);
  while (walkerAll <= endDate) {
    totalProjectMonths++;
    walkerAll.setMonth(walkerAll.getMonth() + 1);
  }
  if (totalProjectMonths === 0) return monthlyFees;

  // Determine which project months fall within the current calendar year
  const monthsInCurrentYear: string[] = [];
  const walkerYear = new Date(startDate);
  while (walkerYear <= endDate) {
    if (walkerYear.getFullYear() === currentYear) {
      const idx = walkerYear.getMonth();
      const monthName = idx === 8 ? 'Sept' : months[idx];
      monthsInCurrentYear.push(monthName);
    }
    walkerYear.setMonth(walkerYear.getMonth() + 1);
  }

  if (monthsInCurrentYear.length === 0) {
    // Nothing to allocate in the current year
    return monthlyFees;
  }

  // Distribute fees evenly across ALL project months, then only apply to current-year months
  const perMonth = entry.totalFees / totalProjectMonths;

  // Start by assigning per-month to each month in the current year portion
  monthsInCurrentYear.forEach(m => {
    monthlyFees[m] = perMonth;
  });

  // Apply overrides for current-year months, if provided
  Object.keys(overrides || {}).forEach(m => {
    if (monthsInCurrentYear.includes(m) && typeof overrides[m] === 'number') {
      monthlyFees[m] = overrides[m];
    }
  });

  return monthlyFees;
};

export default function Pipeline({ user, onLogout, onBack, userView = 'Admin', isEmbedded = false, initialView, triggerAddNew = false, onAddNewComplete }: PipelineProps) {
  const [mounted, setMounted] = useState(false);
  const [entries, setEntries] = useState<PipelineEntry[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [addToCurrentDialogOpen, setAddToCurrentDialogOpen] = useState(false);
  const [selectedParentProject, setSelectedParentProject] = useState<string>('');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [originalEditEntry, setOriginalEditEntry] = useState<PipelineEntry | null>(null);
  const [projectCounter, setProjectCounter] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  // Initialize admin mode based on userView prop, but with a simpler approach
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [changeRequests, setChangeRequests] = useState<any[]>([]);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewingEntry, setReviewingEntry] = useState<PipelineEntry | null>(null);
  const [reviewingChanges, setReviewingChanges] = useState<any>(null);
  const [monthlyOverrides, setMonthlyOverrides] = useState<{[projectCode: string]: {[month: string]: number}}>({});
  const [hasLoadedFromStorage, setHasLoadedFromStorage] = useState(false);
  const [adminView, setAdminView] = useState<'executiveSummary' | 'overview' | 'annualPlan' | 'weighted' | 'overheads' | 'financeReporting' | 'settings'>('executiveSummary');
  const [selectedUserView, setSelectedUserView] = useState<'executive' | 'pipeline' | 'settings'>('executive');

  // Team member access management state
  type TeamMember = {
    id: string;
    name: string;
    role: string;
    permission: 'View' | 'Edit';
  };
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('');
  const [newMemberPermission, setNewMemberPermission] = useState<'View' | 'Edit'>('View');

  // Available roles (Director and above + employees only)
  const availableRoles = [
    'Director',
    'Senior Director',
    'VP',
    'SVP',
    'EVP',
    'Managing Director',
    'Employee'
  ];

  // Load team members from cloudStorage on mount
  useEffect(() => {
    const savedTeamMembers = cloudStorage.getItem('pipelineTeamMembers');
    if (savedTeamMembers) {
      try {
        setTeamMembers(JSON.parse(savedTeamMembers));
      } catch (e) {
        console.error('Error loading team members:', e);
      }
    }
  }, []);

  // Save team members to cloudStorage whenever they change
  useEffect(() => {
    if (teamMembers.length > 0 || cloudStorage.getItem('pipelineTeamMembers')) {
      cloudStorage.setItem('pipelineTeamMembers', JSON.stringify(teamMembers));
    }
  }, [teamMembers]);


  // Automatically set admin mode when userView changes OR on mount
  useEffect(() => {
    setIsAdminMode(userView === 'Admin');
  }, [userView]);

  // Sync with initialView prop when embedded
  useEffect(() => {
    if (isEmbedded && initialView) {
      if (userView === 'Admin') {
        // Map submenu view names to admin view state
        const viewMap: { [key: string]: 'executiveSummary' | 'overview' | 'annualPlan' | 'weighted' | 'overheads' | 'financeReporting' | 'settings' } = {
          executive: 'executiveSummary',
          pipeline: 'overview',
          annualPlan: 'annualPlan',
          weighted: 'weighted',
          overheads: 'overheads',
          reporting: 'financeReporting',
          settings: 'settings'
        };
        const mappedView = viewMap[initialView] || 'executiveSummary';
        setAdminView(mappedView);
      } else {
        // Map submenu view names to user view state
        const viewMap: { [key: string]: 'executive' | 'pipeline' | 'settings' } = {
          'executive': 'executive',
          'pipeline': 'pipeline',
          'reporting': 'pipeline',
          'settings': 'settings'
        };
        const mappedView = viewMap[initialView] || 'executive';
        setSelectedUserView(mappedView);
      }
    }
  }, [isEmbedded, initialView, userView]);

  // Handle triggerAddNew prop - automatically open add new dialog
  useEffect(() => {
    if (triggerAddNew) {
      setDialogOpen(true);
      // Call the callback to reset the trigger
      if (onAddNewComplete) {
        onAddNewComplete();
      }
    }
  }, [triggerAddNew, onAddNewComplete]);
  const [overheadsSearchTerm, setOverheadsSearchTerm] = useState('');
  const [freelancerCosts, setFreelancerCosts] = useState<{[dept: string]: {[month: string]: number}}>({});
  const [annualPlanEntries, setAnnualPlanEntries] = useState<{[client: string]: {planFees: number; planRevenue: number}}>({});
  const [annualPlanSaveStatus, setAnnualPlanSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [showAnnualPlanChart, setShowAnnualPlanChart] = useState(true);
  const [showPlanVsYear, setShowPlanVsYear] = useState(true);
  const [showAnnualPlanTable1, setShowAnnualPlanTable1] = useState(false);
  const [showAnnualPlanTable2, setShowAnnualPlanTable2] = useState(false);
  // Settings tab state
  const [fxRate, setFxRate] = useState<number>(1.43);
  const [fxMeta, setFxMeta] = useState<{ date: string; user: string } | null>(null);
  const [fxLog, setFxLog] = useState<Array<{ from: number; to: number; date: string; user: string }>>([]);
  const [clientSettings, setClientSettings] = useState<Array<{ name: string; billingEntity: 'Salt XC Canada' | 'Salt XC US' }>>([]);
  const [settingsSaveStatus, setSettingsSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [settingsChangeLog, setSettingsChangeLog] = useState<Array<{ type: 'fx' | 'billing'; description: string; date: string; user: string }>>([]);
  const [pipelineChangeLog, setPipelineChangeLog] = useState<Array<{ type: 'addition' | 'change' | 'deletion'; projectCode: string; projectName: string; client: string; description: string; date: string; user: string }>>([]);
  const [showAnnualPlanTable3, setShowAnnualPlanTable3] = useState(false);
  const [financeReportType, setFinanceReportType] = useState<'projectByMonth' | 'clientSummary' | 'departmentBreakdown'>('projectByMonth');
  const [financeClientFilter, setFinanceClientFilter] = useState('');
  const [financeStatusFilter, setFinanceStatusFilter] = useState('');
  const [financeYearFilter, setFinanceYearFilter] = useState('');
  const [financeMonthFilter, setFinanceMonthFilter] = useState('');
  // Executive Summary – percent tiles
  
  // Month End state
  const [monthLocks, setMonthLocks] = useState<Record<number, boolean>>({});
  const [monthNotes, setMonthNotes] = useState<Record<number, string>>({});

  // Hydrate cloudStorage before rendering so we load existing pipeline data from the backend
  useEffect(() => {
    let active = true;
    const hydrate = async () => {
      try {
        await cloudStorage.hydrate();
      } catch (err) {
        console.error('Failed to hydrate cloud storage', err);
      } finally {
        if (active) {
          setMounted(true);
        }
      }
    };
    hydrate();
    return () => {
      active = false;
    };
  }, []);

  // Load/save Annual Plan entries in cloudStorage
  useEffect(() => {
    if (!mounted) return; // Wait for hydration
    if (typeof window === 'undefined') return;
    try {
      const saved = cloudStorage.getItem('annual-plan-entries');
      if (saved) {
        const parsed = JSON.parse(saved);
        console.log('Loaded annual plan entries:', parsed);
        setAnnualPlanEntries(parsed);
      }
    } catch (e) {
      console.error('Failed to load annual plan entries', e);
    }
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return; // Wait for hydration
    if (typeof window === 'undefined') return;
    if (Object.keys(annualPlanEntries).length === 0) return; // Don't save empty state on initial load
    
    try {
      setAnnualPlanSaveStatus('saving');
      console.log('Saving annual plan entries:', annualPlanEntries);
      cloudStorage.setItem('annual-plan-entries', JSON.stringify(annualPlanEntries));
      setAnnualPlanSaveStatus('saved');
      
      // Reset to idle after 2 seconds
      const timer = setTimeout(() => {
        setAnnualPlanSaveStatus('idle');
      }, 2000);
      
      return () => clearTimeout(timer);
    } catch (e) {
      console.error('Failed to save annual plan entries', e);
      setAnnualPlanSaveStatus('idle');
    }
  }, [annualPlanEntries, mounted]);
  
  // Use the overhead employees hook for database integration
  const {
    overheads,
    loading: overheadsLoading,
    error: overheadsError,
    lastSaved: overheadsLastSaved,
    saveStatus: overheadsSaveStatus,
    addOverhead: handleAddOverhead,
    updateOverheadField,
    updateOverheadMonth,
    deleteOverhead,
    saveOverheads,
    syncWithDatabase: syncOverheadsWithDatabase
  } = useOverheadEmployees();

  const ALL_ROLES: string[] = useMemo(() => {
    const cards = Object.values(RATE_MAPPING_2025 || {});
    const roleSet = new Set<string>();
    for (const card of cards) {
      Object.keys(card || {}).forEach(role => roleSet.add(role));
    }
    return Array.from(roleSet).sort();
  }, []);

  // Weighted Forecast aggregated monthly data (Revenue-based)
  const weightedViewData = useMemo(() => {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
    const initMap = () => monthNames.reduce((acc: {[m: string]: number}, m) => { acc[m] = 0; return acc; }, {} as {[m: string]: number});
    
    console.log('🔍 Current Year for Forecast:', new Date().getFullYear());
    console.log('🔍 Total entries to process:', entries.length);
    if (entries.length > 0) {
      console.log('🔍 Sample entry dates:', entries[0]?.startMonth, 'to', entries[0]?.endMonth);
    }

    const potentialByMonth: {[m: string]: number} = initMap();
    const weightedByMonth: {[m: string]: number} = initMap();
    const confirmedByMonth: {[m: string]: number} = initMap();

    const statusMultiplierMap: {[k: string]: number} = {
      'Confirmed': 1.0,
      'Open': 0.9,
      'High Pitch': 0.75,
      'Medium Pitch': 0.5,
      'Low Pitch': 0.1,
      'Whitespace': 0.0,
      'Finance Review': 0.9
    };

    const getActiveMonths = (start?: string, end?: string): string[] => {
      if (!start || !end) return [];
      const currentYear = new Date().getFullYear();
      const startDate = new Date(start);
      const endDate = new Date(end);
      
      const active: string[] = [];
      
      // Iterate through each month of the project
      const current = new Date(startDate);
      while (current <= endDate) {
        const year = current.getFullYear();
        // Only include months in the current calendar year
        if (year === currentYear) {
          const monthIndex = current.getMonth();
          const monthName = monthIndex === 8 ? 'Sept' : monthNames[monthIndex];
          if (!active.includes(monthName)) {
            active.push(monthName);
          }
        } else {
          console.log(`❌ Excluding ${current.toISOString().substring(0, 7)} - not in ${currentYear}`);
        }
        // Move to next month
        current.setMonth(current.getMonth() + 1);
      }
      
      if (active.length > 0) {
        console.log(`✅ ${start} to ${end}: Months in ${currentYear}:`, active);
      }
      
      return active;
    };

    for (const entry of entries) {
      if (!entry.startMonth || !entry.endMonth) continue;
      
      // Calculate total project duration in months
      const startDate = new Date(entry.startMonth);
      const endDate = new Date(entry.endMonth);
      let totalProjectMonths = 0;
      const temp = new Date(startDate);
      while (temp <= endDate) {
        totalProjectMonths++;
        temp.setMonth(temp.getMonth() + 1);
      }
      
      // Get only the months in current year
      const activeMonths = getActiveMonths(entry.startMonth, entry.endMonth);
      if (activeMonths.length === 0 || totalProjectMonths === 0) continue;
      
      // Distribute total fees across ALL project months, but only sum for current year months
      const perMonthFees = entry.totalFees / totalProjectMonths;
      const weightedPerMonthFees = perMonthFees * (statusMultiplierMap[entry.status] ?? 0.9);

      for (const m of activeMonths) {
        // Potential = 100% of fees regardless of status
        potentialByMonth[m] += perMonthFees;
        // Weighted = fees × multiplier
        weightedByMonth[m] += weightedPerMonthFees;
        // Confirmed = only confirmed at 100%
        if (entry.status === 'Confirmed') confirmedByMonth[m] += perMonthFees;
      }
    }

    return { monthNames, potentialByMonth, weightedByMonth, confirmedByMonth };
  }, [entries]);

  const salariesByMonth = useMemo(() => {
    const map: { [m: string]: number } = {};
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
    months.forEach(m => {
      // Employee salaries
      const employeeCosts = overheads.reduce((sum, r) => sum + (r.monthly?.[m] || 0), 0);
      // Freelancer costs for all departments
      const freelancerTotal = DEPARTMENT_OPTIONS.reduce((sum, dept) => {
        return sum + ((freelancerCosts[dept] || {})[m] || 0);
      }, 0);
      map[m] = employeeCosts + freelancerTotal;
    });
    return map;
  }, [overheads, freelancerCosts]);

  // Department-specific (Accounts) weighted view data
  const buildDeptWeightedData = (feeField: keyof PipelineEntry | null) => {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
    const initMap = () => monthNames.reduce((acc: {[m: string]: number}, m) => { acc[m] = 0; return acc; }, {} as {[m: string]: number});

    const potentialByMonth: {[m: string]: number} = initMap();
    const weightedByMonth: {[m: string]: number} = initMap();
    const confirmedByMonth: {[m: string]: number} = initMap();

    const statusMultiplierMap: {[k: string]: number} = {
      'Confirmed': 1.0,
      'Open': 0.9,
      'High Pitch': 0.75,
      'Medium Pitch': 0.5,
      'Low Pitch': 0.1,
      'Whitespace': 0.0,
      'Finance Review': 0.9
    };

    const getActiveMonths = (start?: string, end?: string): string[] => {
      if (!start || !end) return [];
      const currentYear = new Date().getFullYear();
      const startDate = new Date(start);
      const endDate = new Date(end);
      
      const active: string[] = [];
      
      // Iterate through each month of the project
      const current = new Date(startDate);
      while (current <= endDate) {
        // Only include months in the current calendar year
        if (current.getFullYear() === currentYear) {
          const monthIndex = current.getMonth();
          const monthName = monthIndex === 8 ? 'Sept' : monthNames[monthIndex];
          if (!active.includes(monthName)) {
            active.push(monthName);
          }
        }
        // Move to next month
        current.setMonth(current.getMonth() + 1);
      }
      
      return active;
    };

    for (const entry of entries) {
      const deptAmount = feeField ? (entry[feeField] as number) || 0 : 0;
      if (deptAmount <= 0 || !entry.startMonth || !entry.endMonth) continue;
      
      // Calculate total project duration in months
      const startDate = new Date(entry.startMonth);
      const endDate = new Date(entry.endMonth);
      let totalProjectMonths = 0;
      const temp = new Date(startDate);
      while (temp <= endDate) {
        totalProjectMonths++;
        temp.setMonth(temp.getMonth() + 1);
      }
      
      // Get only the months in current year
      const activeMonths = getActiveMonths(entry.startMonth, entry.endMonth);
      if (activeMonths.length === 0 || totalProjectMonths === 0) continue;
      
      // Distribute department fees across ALL project months, but only sum for current year months
      const perMonth = deptAmount / totalProjectMonths;
      const weightedPerMonth = perMonth * (statusMultiplierMap[entry.status] ?? 0.9);

      for (const m of activeMonths) {
        potentialByMonth[m] += perMonth;
        weightedByMonth[m] += weightedPerMonth;
        if (entry.status === 'Confirmed') confirmedByMonth[m] += perMonth;
      }
    }

    return { monthNames, potentialByMonth, weightedByMonth, confirmedByMonth };
  };

  const deptWeightedViewData = useMemo(() => buildDeptWeightedData('accounts'), [entries]);

  const buildDeptSalariesByMonth = (deptLabel: string) => {
    const map: { [m: string]: number } = {};
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
    months.forEach(m => {
      // Employee salaries for this department
      const employeeCosts = overheads.filter(r => (r.department || '').toLowerCase() === deptLabel.toLowerCase()).reduce((sum, r) => sum + (r.monthly?.[m] || 0), 0);
      // Freelancer costs for this department
      const freelancerCost = (freelancerCosts[deptLabel] || {})[m] || 0;
      map[m] = employeeCosts + freelancerCost;
    });
    return map;
  };
  const deptSalariesByMonth = useMemo(() => buildDeptSalariesByMonth('Accounts'), [overheads, freelancerCosts]);
  // Load entries from cloudStorage on component mount
  useEffect(() => {
    // Ensure we're in the browser environment
    if (typeof window === 'undefined' || !mounted) return;
    
    console.log('Loading pipeline data from cloudStorage...');
    
    const savedEntries = cloudStorage.getItem('pipeline-entries');
    const savedCounter = cloudStorage.getItem('pipeline-project-counter');
    const savedChangeRequests = cloudStorage.getItem('pipeline-change-requests');
    const savedMonthlyOverrides = cloudStorage.getItem('pipeline-monthly-overrides');
    
    console.log('Saved entries:', savedEntries);
    console.log('Saved counter:', savedCounter);
    
    if (savedEntries) {
      try {
        const parsedEntries = JSON.parse(savedEntries);
        console.log('Parsed entries:', parsedEntries);
        setEntries(parsedEntries);
      } catch (error) {
        console.error('Failed to load pipeline entries:', error);
      }
    }
    
    if (savedCounter) {
      try {
        const parsedCounter = parseInt(savedCounter, 10);
        if (!isNaN(parsedCounter)) {
          console.log('Setting project counter to:', parsedCounter);
          setProjectCounter(parsedCounter);
        }
      } catch (error) {
        console.error('Failed to load project counter:', error);
      }
    }

    if (savedChangeRequests) {
      try {
        const parsedChangeRequests = JSON.parse(savedChangeRequests);
        setChangeRequests(parsedChangeRequests);
      } catch (error) {
        console.error('Failed to load change requests:', error);
      }
    }

    if (savedMonthlyOverrides) {
      try {
        const parsedMonthlyOverrides = JSON.parse(savedMonthlyOverrides);
        setMonthlyOverrides(parsedMonthlyOverrides);
      } catch (error) {
        console.error('Failed to load monthly overrides:', error);
      }
    }
    // Overheads are now loaded by the useOverheadEmployees hook
    // Mark as loaded so subsequent saves can proceed without wiping storage
    setHasLoadedFromStorage(true);
  }, [mounted]);
  // Verify and fix project counter after entries are loaded to ensure no duplicates
  useEffect(() => {
    if (!hasLoadedFromStorage || entries.length === 0) return;
    
    // Check for duplicate project codes and fix them
    const seenCodes = new Set<string>();
    const duplicates: number[] = [];
    
    entries.forEach((entry, index) => {
      if (seenCodes.has(entry.projectCode)) {
        duplicates.push(index);
        console.log(`⚠️ Found duplicate project code: ${entry.projectCode} at index ${index}`);
      }
      seenCodes.add(entry.projectCode);
    });
    
    // If duplicates found, reassign unique codes
    if (duplicates.length > 0) {
      console.log(`Fixing ${duplicates.length} duplicate project codes...`);
      const updatedEntries = [...entries];
      let currentCounter = projectCounter;
      
      duplicates.forEach(index => {
        const { code, newCounter } = generateUniqueProjectCode(updatedEntries, currentCounter);
        console.log(`Reassigning ${updatedEntries[index].projectCode} → ${code}`);
        updatedEntries[index] = { ...updatedEntries[index], projectCode: code };
        currentCounter = newCounter + 1;
      });
      
      setEntries(updatedEntries);
      setProjectCounter(currentCounter);
      return; // Exit early since we're updating entries
    }
    
    // Extract all numeric counters from existing project codes (format: P####-YY)
    const existingCounters: number[] = [];
    entries.forEach(entry => {
      const match = entry.projectCode.match(/^P(\d+)-\d{2}$/);
      if (match) {
        const counter = parseInt(match[1], 10);
        if (!isNaN(counter)) {
          existingCounters.push(counter);
        }
      }
    });
    
    if (existingCounters.length > 0) {
      const maxCounter = Math.max(...existingCounters);
      const nextCounter = maxCounter + 1;
      
      // Only update if the saved counter is less than what it should be
      // This prevents going backwards if counter is already ahead
      if (projectCounter < nextCounter) {
        console.log(`⚠️ Adjusting project counter from ${projectCounter} to ${nextCounter} based on existing entries`);
        setProjectCounter(nextCounter);
      }
    }
  }, [hasLoadedFromStorage, entries, projectCounter]);

  // Save entries to cloudStorage whenever entries change
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!hasLoadedFromStorage) return; // avoid overwriting before initial load
    console.log('Saving entries to cloudStorage:', entries);
    cloudStorage.setItem('pipeline-entries', JSON.stringify(entries));
  }, [entries, hasLoadedFromStorage]);

  // Save project counter to cloudStorage whenever it changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!hasLoadedFromStorage) return;
    console.log('Saving project counter to cloudStorage:', projectCounter);
    cloudStorage.setItem('pipeline-project-counter', projectCounter.toString());
  }, [projectCounter, hasLoadedFromStorage]);

  // Save change requests to cloudStorage whenever they change
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!hasLoadedFromStorage) return;
    cloudStorage.setItem('pipeline-change-requests', JSON.stringify(changeRequests));
  }, [changeRequests, hasLoadedFromStorage]);

  // Save monthly overrides to cloudStorage whenever they change
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!hasLoadedFromStorage) return;
    cloudStorage.setItem('pipeline-monthly-overrides', JSON.stringify(monthlyOverrides));
  }, [monthlyOverrides, hasLoadedFromStorage]);

  // Load and save freelancer costs from cloudStorage
  useEffect(() => {
    if (typeof window === 'undefined' || !mounted) return;
    const saved = cloudStorage.getItem('pipeline-freelancer-costs');
    if (saved) {
      try {
        setFreelancerCosts(JSON.parse(saved));
      } catch (error) {
        console.error('Failed to load freelancer costs:', error);
      }
    }
  }, [mounted]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!hasLoadedFromStorage) return;
    cloudStorage.setItem('pipeline-freelancer-costs', JSON.stringify(freelancerCosts));
  }, [freelancerCosts, hasLoadedFromStorage]);

  // Load Settings data from cloudStorage
  useEffect(() => {
    if (typeof window === 'undefined' || !mounted) return;
    try {
      const savedFxRate = cloudStorage.getItem('pipeline-fx-rate');
      if (savedFxRate) setFxRate(parseFloat(savedFxRate));
      
      const savedFxMeta = cloudStorage.getItem('pipeline-fx-meta');
      if (savedFxMeta) setFxMeta(JSON.parse(savedFxMeta));
      
      const savedFxLog = cloudStorage.getItem('pipeline-fx-log');
      if (savedFxLog) setFxLog(JSON.parse(savedFxLog));
      
      const savedClientSettings = cloudStorage.getItem('pipeline-client-settings');
      if (savedClientSettings) {
        setClientSettings(JSON.parse(savedClientSettings));
      } else {
        // Initialize with CLIENT_LIST if not found
        const initialSettings = CLIENT_LIST.map(name => ({
          name,
          billingEntity: 'Salt XC Canada' as 'Salt XC Canada' | 'Salt XC US'
        }));
        setClientSettings(initialSettings);
      }
      
      const savedSettingsChangeLog = cloudStorage.getItem('pipeline-settings-changelog');
      if (savedSettingsChangeLog) setSettingsChangeLog(JSON.parse(savedSettingsChangeLog));
      
      const savedPipelineChangeLog = cloudStorage.getItem('pipeline-changelog');
      if (savedPipelineChangeLog) {
        const parsedLog = JSON.parse(savedPipelineChangeLog);
        // Migrate old logs that don't have client field
        const migratedLog = parsedLog.map((log: any) => ({
          ...log,
          client: log.client || 'N/A'
        }));
        setPipelineChangeLog(migratedLog);
      }
      
      const savedMonthLocks = cloudStorage.getItem('pipeline-month-locks');
      if (savedMonthLocks) setMonthLocks(JSON.parse(savedMonthLocks));
      
      const savedMonthNotes = cloudStorage.getItem('pipeline-month-notes');
      if (savedMonthNotes) setMonthNotes(JSON.parse(savedMonthNotes));
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  }, [mounted]);

  // Sync clientSettings with CLIENT_LIST (add new clients if they don't exist)
  useEffect(() => {
    if (clientSettings.length === 0) return;
    const existingClients = new Set(clientSettings.map(c => c.name));
    const newClients = CLIENT_LIST.filter(name => !existingClients.has(name));
    if (newClients.length > 0) {
      setClientSettings(prev => [
        ...prev,
        ...newClients.map(name => ({
          name,
          billingEntity: 'Salt XC Canada' as 'Salt XC Canada' | 'Salt XC US'
        }))
      ]);
    }
  }, []);

  // Note: Auto-save disabled for overheads to prevent interrupting user entry
  // Users will click the "Save Now" button to persist changes

  const handleFreelancerCostChange = (dept: string, month: string, input: string) => {
    const value = parseCurrencyInput(input);
    setFreelancerCosts(prev => ({
      ...prev,
      [dept]: {
        ...(prev[dept] || {}),
        [month]: value
      }
    }));
  };

  const filteredOverheads = useMemo(() => {
    const q = (overheadsSearchTerm || '').trim().toLowerCase();
    if (!q) return overheads;
    return overheads.filter(r =>
      (r.department || '').toLowerCase().includes(q) ||
      (r.employee || '').toLowerCase().includes(q) ||
      (r.role || '').toLowerCase().includes(q)
    );
  }, [overheads, overheadsSearchTerm]);

  const overheadsTotalsByMonth = useMemo(() => {
    const totals: { [key: string]: number } = {};
    weightedViewData.monthNames.forEach((m) => {
      totals[m] = filteredOverheads.reduce((sum, r) => sum + (r.monthly?.[m] || 0), 0);
    });
    return totals;
  }, [filteredOverheads, weightedViewData.monthNames]);

  // Overhead management functions are now provided by the useOverheadEmployees hook

  // Compute monthly salary allocation based on start/end dates and allocation percent
  const computeOverheadMonthly = (row: OverheadRow): { [m: string]: number } => {
    const months: string[] = MONTH_OPTIONS;
    const result: { [m: string]: number } = {};
    months.forEach(m => { result[m] = 0; });
    if (!row.startDate || !row.endDate || !row.annualSalary || !row.allocationPercent) {
      return result;
    }
    const start = new Date(row.startDate);
    const end = new Date(row.endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return result;

    const msPerWeek = 7 * 24 * 60 * 60 * 1000;
    const allocationFactor = (row.allocationPercent || 0) / 100;
    const allocatedAnnual = row.annualSalary * allocationFactor;
    const weeklyCost = allocatedAnnual / 52;

    // Iterate each day to accumulate weeks per month (approx by days/7)
    // For performance, step by 1 day; acceptable for UI usage
    const dayMs = 24 * 60 * 60 * 1000;
    for (let t = start.getTime(); t <= end.getTime(); t += dayMs) {
      const d = new Date(t);
      const monthIdx = d.getMonth(); // 0..11
      const label = months[monthIdx === 8 ? 8 : monthIdx];
      // Note: months array is Jan..Dec with 'Sept' for September
      const key = monthIdx === 8 ? 'Sept' : months[monthIdx];
      result[key] = (result[key] || 0) + (weeklyCost / 7); // daily portion of weekly cost
    }
    // Convert daily sums to weekly-equivalent sums by multiplying by 7? Already divided above
    // Now round per month to nearest dollar
    months.forEach(m => {
      result[m] = Math.round(result[m]);
    });
    return result;
  };

  const [form, setForm] = useState({
    projectCode: generateProjectCode(1),
    entryType: 'In Plan',
    status: 'Open',
    owner: '',
    client: '',
    programName: '',
    region: '',
    programType: '',
    startMonth: '',
    endMonth: '',
    revenue: '',
    accounts: '',
    creative: '',
    design: '',
    strategy: '',
    media: '',
    studio: '',
    creator: '',
    social: '',
    omni: '',
    finance: '',
    parentProjectCode: '',
  });

  // Update form project code to ensure uniqueness whenever entries or counter changes
  useEffect(() => {
    const { code, newCounter } = generateUniqueProjectCode(entries, projectCounter);
    if (code !== form.projectCode) {
      setForm(prev => ({ ...prev, projectCode: code }));
      if (newCounter !== projectCounter) {
        setProjectCounter(newCounter);
      }
    }
  }, [entries, projectCounter]);

  const [editForm, setEditForm] = useState({
    projectCode: '',
    entryType: 'In Plan',
    status: '',
    owner: '',
    client: '',
    programName: '',
    region: '',
    programType: '',
    startMonth: '',
    endMonth: '',
    revenue: '',
    accounts: '',
    creative: '',
    design: '',
    strategy: '',
    media: '',
    studio: '',
    creator: '',
    social: '',
    omni: '',
    finance: '',
    comments: '',
  });

  const computedTotalFees = useMemo(() => {
    const fields = ['accounts','creative','design','strategy','media','studio','creator','social','omni','finance'] as const;
    return fields.reduce((sum, key) => sum + parseCurrencyInput((form as any)[key]), 0);
  }, [form]);

  const computedEditTotalFees = useMemo(() => {
    const fields = ['accounts','creative','design','strategy','media','studio','creator','social','omni','finance'] as const;
    return fields.reduce((sum, key) => sum + parseCurrencyInput((editForm as any)[key]), 0);
  }, [editForm]);

  const persistPipelineEntries = useCallback((updatedEntries: PipelineEntry[]) => {
    if (typeof window === 'undefined') return;
    try {
      cloudStorage.setItem('pipeline-entries', JSON.stringify(updatedEntries));
    } catch (err) {
      console.error('Failed to persist pipeline entries:', err);
    }
  }, []);

  const appendPipelineLog = useCallback(
    (logEntry: { type: 'addition' | 'change' | 'deletion'; projectCode: string; projectName: string; client: string; description: string; date: string; user: string }) => {
      setPipelineChangeLog(prev => [logEntry, ...prev]);
      try {
        const currentLog = typeof window !== 'undefined' ? cloudStorage.getItem('pipeline-changelog') : null;
        const parsedLog = currentLog ? JSON.parse(currentLog) : [];
        if (typeof window !== 'undefined') {
          cloudStorage.setItem('pipeline-changelog', JSON.stringify([logEntry, ...parsedLog]));
        }
      } catch (err) {
        console.error('Failed to save change log:', err);
      }
    },
    []
  );

  const filteredEntries = useMemo(() => {
    let result = entries;

    // Filter by business owner if in Business Owner view
    if (userView === 'Business Owner') {
      // Map user name to owner option (simplified matching)
      const userName = user?.name || '';
      result = result.filter(entry => {
        // Match if the entry owner contains the user's name or vice versa
        return entry.owner.toLowerCase().includes(userName.toLowerCase()) ||
               userName.toLowerCase().includes(entry.owner.toLowerCase());
      });
    }

    // Apply search filter
    if (!searchTerm) return result;
    
    return result.filter(entry => {
      const searchLower = searchTerm.toLowerCase();
      return (
        entry.projectCode.toLowerCase().includes(searchLower) ||
        entry.owner.toLowerCase().includes(searchLower) ||
        entry.client.toLowerCase().includes(searchLower) ||
        entry.programName.toLowerCase().includes(searchLower) ||
        entry.status.toLowerCase().includes(searchLower) ||
        entry.region.toLowerCase().includes(searchLower) ||
        entry.programType.toLowerCase().includes(searchLower)
      );
    });
  }, [entries, searchTerm, userView, user]);

  const handleCurrencyChange = (key: string, value: string) => {
    setForm(prev => ({ ...prev, [key]: formatCurrencyInput(value) }));
  };

  const handleEditCurrencyChange = (key: string, value: string) => {
    setEditForm(prev => ({ ...prev, [key]: formatCurrencyInput(value) }));
  };
  const handleEditEntry = (index: number) => {
    const entry = entries[index];
    
    // Check if the month is locked
    if (entry.startMonth) {
      const [year, month] = entry.startMonth.split('-').map(Number);
      const monthIndex = month - 1; // Convert to 0-based index
      if (monthLocks[monthIndex]) {
        alert(`Cannot edit entries for this month. ${new Date(2000, monthIndex).toLocaleString('default', { month: 'long' })} is locked.`);
        return;
      }
    }
    
    setEditingIndex(index);
    setOriginalEditEntry(entry); // Store original entry for comparison
    setEditForm({
      projectCode: entry.projectCode,
      entryType: entry.entryType || 'In Plan',
      status: entry.status,
      owner: entry.owner,
      client: entry.client,
      programName: entry.programName,
      region: entry.region,
      programType: entry.programType,
      startMonth: entry.startMonth,
      endMonth: entry.endMonth,
      revenue: entry.revenue > 0 ? `$${entry.revenue.toLocaleString()}` : '',
      accounts: entry.accounts > 0 ? `$${entry.accounts.toLocaleString()}` : '',
      creative: entry.creative > 0 ? `$${entry.creative.toLocaleString()}` : '',
      design: entry.design > 0 ? `$${entry.design.toLocaleString()}` : '',
      strategy: entry.strategy > 0 ? `$${entry.strategy.toLocaleString()}` : '',
      media: entry.media > 0 ? `$${entry.media.toLocaleString()}` : '',
      studio: entry.studio > 0 ? `$${entry.studio.toLocaleString()}` : '',
      creator: entry.creator > 0 ? `$${entry.creator.toLocaleString()}` : '',
      social: entry.social > 0 ? `$${entry.social.toLocaleString()}` : '',
      omni: entry.omni > 0 ? `$${entry.omni.toLocaleString()}` : '',
      finance: entry.finance > 0 ? `$${entry.finance.toLocaleString()}` : '',
      comments: '',
    });
    setEditDialogOpen(true);
  };

  // Auto-generate comments based on changes - recalculate on every render
  const generateAutoComments = () => {
    if (!originalEditEntry) return '';
    
    const changes: string[] = [];
    
    // Check status change
    if (editForm.status !== originalEditEntry.status) {
      changes.push(`Status: ${originalEditEntry.status} → ${editForm.status}`);
    }
    
    // Check owner change
    if (editForm.owner !== originalEditEntry.owner) {
      changes.push(`Owner: ${originalEditEntry.owner} → ${editForm.owner}`);
    }
    
    // Check client change
    if (editForm.client !== originalEditEntry.client) {
      changes.push(`Client: ${originalEditEntry.client} → ${editForm.client}`);
    }
    
    // Check program name change
    if (editForm.programName !== originalEditEntry.programName) {
      changes.push(`Project: ${originalEditEntry.programName} → ${editForm.programName}`);
    }
    
    // Check region change
    if (editForm.region !== originalEditEntry.region) {
      changes.push(`Region: ${originalEditEntry.region} → ${editForm.region}`);
    }
    
    // Check program type change
    if (editForm.programType !== originalEditEntry.programType) {
      changes.push(`Type: ${originalEditEntry.programType} → ${editForm.programType}`);
    }
    
    // Check date changes
    if (editForm.startMonth !== originalEditEntry.startMonth) {
      changes.push(`Start: ${originalEditEntry.startMonth} → ${editForm.startMonth}`);
    }
    if (editForm.endMonth !== originalEditEntry.endMonth) {
      changes.push(`End: ${originalEditEntry.endMonth} → ${editForm.endMonth}`);
    }
    
    // Check financial changes - use full values for display
    const revenueNew = parseCurrencyInput(editForm.revenue);
    if (revenueNew !== originalEditEntry.revenue) {
      changes.push(`Revenue: $${originalEditEntry.revenue?.toLocaleString() || 0} → $${revenueNew.toLocaleString()}`);
    }
    
    const accountsNew = parseCurrencyInput(editForm.accounts);
    if (accountsNew !== originalEditEntry.accounts) {
      changes.push(`Accounts: $${originalEditEntry.accounts?.toLocaleString() || 0} → $${accountsNew.toLocaleString()}`);
    }
    
    const creativeNew = parseCurrencyInput(editForm.creative);
    if (creativeNew !== originalEditEntry.creative) {
      changes.push(`Creative: $${originalEditEntry.creative?.toLocaleString() || 0} → $${creativeNew.toLocaleString()}`);
    }
    
    const designNew = parseCurrencyInput(editForm.design);
    if (designNew !== originalEditEntry.design) {
      changes.push(`Design: $${originalEditEntry.design?.toLocaleString() || 0} → $${designNew.toLocaleString()}`);
    }
    
    const strategyNew = parseCurrencyInput(editForm.strategy);
    if (strategyNew !== originalEditEntry.strategy) {
      changes.push(`Strategy: $${originalEditEntry.strategy?.toLocaleString() || 0} → $${strategyNew.toLocaleString()}`);
    }
    
    const mediaNew = parseCurrencyInput(editForm.media);
    if (mediaNew !== originalEditEntry.media) {
      changes.push(`Media: $${originalEditEntry.media?.toLocaleString() || 0} → $${mediaNew.toLocaleString()}`);
    }
    
    const studioNew = parseCurrencyInput(editForm.studio);
    if (studioNew !== originalEditEntry.studio) {
      changes.push(`Studio: $${originalEditEntry.studio?.toLocaleString() || 0} → $${studioNew.toLocaleString()}`);
    }
    
    const creatorNew = parseCurrencyInput(editForm.creator);
    if (creatorNew !== originalEditEntry.creator) {
      changes.push(`Creator: $${originalEditEntry.creator?.toLocaleString() || 0} → $${creatorNew.toLocaleString()}`);
    }
    
    const socialNew = parseCurrencyInput(editForm.social);
    if (socialNew !== originalEditEntry.social) {
      changes.push(`Social: $${originalEditEntry.social?.toLocaleString() || 0} → $${socialNew.toLocaleString()}`);
    }
    
    const omniNew = parseCurrencyInput(editForm.omni);
    if (omniNew !== originalEditEntry.omni) {
      changes.push(`Omni: $${originalEditEntry.omni?.toLocaleString() || 0} → $${omniNew.toLocaleString()}`);
    }
    
    const financeNew = parseCurrencyInput(editForm.finance);
    if (financeNew !== originalEditEntry.finance) {
      changes.push(`Finance: $${originalEditEntry.finance?.toLocaleString() || 0} → $${financeNew.toLocaleString()}`);
    }
    
    if (changes.length === 0) return '';
    
    return 'Changes made:\n' + changes.join('\n');
  };

  // Auto-update comments when form changes
  useEffect(() => {
    if (originalEditEntry && editDialogOpen) {
      const autoComments = generateAutoComments();
      // Only update if there are changes and the generated comments are different
      if (autoComments && autoComments !== editForm.comments) {
        setEditForm(prev => ({ ...prev, comments: autoComments }));
      }
    }
  }, [originalEditEntry, editDialogOpen, editForm]);


  const handleUpdateEntry = () => {
    if (editingIndex === null) return;
    
    if (!editForm.owner || !editForm.client || !editForm.programName || !editForm.startMonth || !editForm.endMonth) {
      alert('Please complete Owner, Client, Project, Start Month, and End Month.');
      return;
    }

    if (!editForm.comments.trim()) {
      alert('Please provide comments explaining what changes were made.');
      return;
    }

    const updatedEntry: PipelineEntry = {
      projectCode: editForm.projectCode,
      status: editForm.status,
      owner: editForm.owner,
      client: editForm.client,
      programName: editForm.programName,
      region: editForm.region,
      programType: editForm.programType,
      startMonth: editForm.startMonth,
      endMonth: editForm.endMonth,
      revenue: parseCurrencyInput(editForm.revenue),
      totalFees: computedEditTotalFees,
      accounts: parseCurrencyInput(editForm.accounts),
      creative: parseCurrencyInput(editForm.creative),
      design: parseCurrencyInput(editForm.design),
      strategy: parseCurrencyInput(editForm.strategy),
      media: parseCurrencyInput(editForm.media),
      studio: parseCurrencyInput(editForm.studio),
      creator: parseCurrencyInput(editForm.creator),
      social: parseCurrencyInput(editForm.social),
      omni: parseCurrencyInput(editForm.omni),
      finance: parseCurrencyInput(editForm.finance),
    };

    if (isAdminMode) {
      // Admin can directly update entries
      setEntries(prev => prev.map((entry, idx) => 
        idx === editingIndex ? updatedEntry : entry
      ));
      alert('Entry updated successfully');
    } else {
      // Regular users create change requests
      const changeRequest = {
        id: Date.now().toString(),
        projectCode: editForm.projectCode,
        originalEntry: entries[editingIndex],
        requestedChanges: updatedEntry,
        requestedBy: user?.name || 'Unknown User',
        requestedAt: new Date().toISOString(),
        status: 'Pending',
        comments: editForm.comments.trim()
      };
      
      setChangeRequests(prev => [...prev, changeRequest]);
      alert('Change request submitted for admin review');
    }
    
    setEditDialogOpen(false);
    setEditingIndex(null);
  };
  const handleSaveEditedEntry = () => {
    if (editingIndex === null) return;
    
    if (!editForm.owner || !editForm.client || !editForm.programName || !editForm.startMonth || !editForm.endMonth) {
      alert('Please complete Owner, Client, Project, Start Month, and End Month.');
      return;
    }

    const originalEntry = entries[editingIndex];
    
    const updatedEntry: PipelineEntry = {
      ...originalEntry,
      entryType: editForm.entryType as any,
      status: editForm.status,
      owner: editForm.owner,
      client: editForm.client,
      programName: editForm.programName,
      region: editForm.region,
      programType: editForm.programType,
      startMonth: editForm.startMonth,
      endMonth: editForm.endMonth,
      revenue: parseCurrencyInput(editForm.revenue),
      accounts: parseCurrencyInput(editForm.accounts),
      creative: parseCurrencyInput(editForm.creative),
      design: parseCurrencyInput(editForm.design),
      strategy: parseCurrencyInput(editForm.strategy),
      media: parseCurrencyInput(editForm.media),
      studio: parseCurrencyInput(editForm.studio),
      creator: parseCurrencyInput(editForm.creator),
      social: parseCurrencyInput(editForm.social),
      omni: parseCurrencyInput(editForm.omni),
      finance: parseCurrencyInput(editForm.finance),
    };

    // Calculate total fees
    updatedEntry.totalFees = 
      (updatedEntry.accounts || 0) +
      (updatedEntry.creative || 0) +
      (updatedEntry.design || 0) +
      (updatedEntry.strategy || 0) +
      (updatedEntry.media || 0) +
      (updatedEntry.studio || 0) +
      (updatedEntry.creator || 0) +
      (updatedEntry.social || 0) +
      (updatedEntry.omni || 0) +
      (updatedEntry.finance || 0);

    const updatedEntries = entries.map((entry, idx) => 
      idx === editingIndex ? updatedEntry : entry
    );
    setEntries(updatedEntries);
    persistPipelineEntries(updatedEntries);

    const changeDescription = editForm.comments || 'Project details updated';
    const changeLog = {
      type: 'change' as const,
      projectCode: updatedEntry.projectCode,
      projectName: updatedEntry.programName,
      client: updatedEntry.client,
      description: changeDescription,
      date: new Date().toISOString(),
      user: user.name
    };
    appendPipelineLog(changeLog);

    setEditDialogOpen(false);
    setEditingIndex(null);
  };
  const handleSubmitForFinanceReview = () => {
    if (editingIndex === null) return;
    
    if (!editForm.owner || !editForm.client || !editForm.programName || !editForm.startMonth || !editForm.endMonth) {
      alert('Please complete Owner, Client, Project, Start Month, and End Month.');
      return;
    }

    if (!editForm.comments.trim()) {
      alert('Please provide comments explaining what changes were made for finance review.');
      return;
    }

    const originalEntry = entries[editingIndex];
    const updatedEntry: PipelineEntry = {
      projectCode: editForm.projectCode,
      status: 'Finance Review',
      owner: editForm.owner,
      client: editForm.client,
      programName: editForm.programName,
      region: editForm.region,
      programType: editForm.programType,
      startMonth: editForm.startMonth,
      endMonth: editForm.endMonth,
      revenue: parseCurrencyInput(editForm.revenue),
      totalFees: computedEditTotalFees,
      accounts: parseCurrencyInput(editForm.accounts),
      creative: parseCurrencyInput(editForm.creative),
      design: parseCurrencyInput(editForm.design),
      strategy: parseCurrencyInput(editForm.strategy),
      media: parseCurrencyInput(editForm.media),
      studio: parseCurrencyInput(editForm.studio),
      creator: parseCurrencyInput(editForm.creator),
      social: parseCurrencyInput(editForm.social),
      omni: parseCurrencyInput(editForm.omni),
      finance: parseCurrencyInput(editForm.finance),
    };

    // Store the change history for finance review
    const financeReviewRecord = {
      id: Date.now().toString(),
      projectCode: editForm.projectCode,
      originalEntry: originalEntry,
      submittedChanges: updatedEntry,
      submittedBy: user?.name || 'Unknown User',
      submittedAt: new Date().toISOString(),
      type: 'Finance Review',
      comments: editForm.comments.trim()
    };
    
    setChangeRequests(prev => [...prev, financeReviewRecord]);

    setEntries(prev => prev.map((entry, idx) => 
      idx === editingIndex ? updatedEntry : entry
    ));
    setEditDialogOpen(false);
    setEditingIndex(null);
    alert('Entry submitted for Finance Review');
  };

  const handleDeleteEntry = () => {
    if (editingIndex === null) return;
    
    const entry = entries[editingIndex];
    
    // Check if the month is locked
    if (entry.startMonth) {
      const [year, month] = entry.startMonth.split('-').map(Number);
      const monthIndex = month - 1; // Convert to 0-based index
      if (monthLocks[monthIndex]) {
        alert(`Cannot delete entries for this month. ${new Date(2000, monthIndex).toLocaleString('default', { month: 'long' })} is locked.`);
        return;
      }
    }
    
    const confirmDelete = window.confirm(
      `Delete this project from the pipeline?\n\n` +
      `Project: ${entry.projectCode}\n` +
      `Client: ${entry.client}\n` +
      `Program: ${entry.programName}\n\n` +
      `This will remove it from the forecast and log the deletion.`
    );
    
    if (!confirmDelete) return;

    const updatedEntries = entries.filter((_, idx) => idx !== editingIndex);
    setEntries(updatedEntries);
    persistPipelineEntries(updatedEntries);
    setChangeRequests(prev => prev.filter(r => r.projectCode !== entry.projectCode));

    const deletionLog = {
      type: 'deletion' as const,
      projectCode: entry.projectCode,
      projectName: entry.programName,
      client: entry.client,
      description: editForm.comments.trim() || `Project deleted: ${entry.programName}`,
      date: new Date().toISOString(),
      user: user.name
    };
    appendPipelineLog(deletionLog);

    // Remove from Quote Hub (Dashboard cloudStorage)
    try {
      const quotesData = cloudStorage.getItem('saltxc-quotes');
      if (quotesData) {
        const quotes = JSON.parse(quotesData);
        const updatedQuotes = quotes.filter((q: any) => q.projectNumber !== entry.projectCode && q.id !== entry.projectCode);
        cloudStorage.setItem('saltxc-quotes', JSON.stringify(updatedQuotes));
      }
    } catch (error) {
      console.error('Failed to remove from Quote Hub:', error);
    }
    
    // Remove from Project Management Hub cloudStorage
    try {
      const pmData = cloudStorage.getItem('saltxc-all-quotes');
      if (pmData) {
        const pmQuotes = JSON.parse(pmData);
        const updatedPMQuotes = pmQuotes.filter((q: any) => q.projectNumber !== entry.projectCode && q.id !== entry.projectCode);
        cloudStorage.setItem('saltxc-all-quotes', JSON.stringify(updatedPMQuotes));
      }
    } catch (error) {
      console.error('Failed to remove from PM Hub:', error);
    }

    setEditDialogOpen(false);
    setEditingIndex(null);
  };

  const handleApproveChangeRequest = (requestId: string) => {
    const request = changeRequests.find(r => r.id === requestId);
    if (!request) return;

    // Find the entry to update
    const entryIndex = entries.findIndex(e => e.projectCode === request.projectCode);
    if (entryIndex === -1) return;

    // Check if this is a deletion request
    if (request.type === 'Deletion Request' && request.submittedChanges === null) {
      const projectCode = request.projectCode;
      const entryToDelete = entries[entryIndex];
      
      // Remove the entry from the pipeline
      setEntries(prev => prev.filter((_, idx) => idx !== entryIndex));
      
      // Log the project deletion to change log
      const deletionLog = {
        type: 'deletion' as const,
        projectCode: entryToDelete.projectCode,
        projectName: entryToDelete.programName,
        client: entryToDelete.client,
        description: `Project deleted: ${entryToDelete.programName} for ${entryToDelete.client}`,
        date: new Date().toISOString(),
        user: user.name
      };
      setPipelineChangeLog(prev => [deletionLog, ...prev]);
      
      // Save change log to cloudStorage immediately
      try {
        const currentLog = typeof window !== 'undefined' ? cloudStorage.getItem('pipeline-changelog') : null;
        const parsedLog = currentLog ? JSON.parse(currentLog) : [];
        const updatedLog = [deletionLog, ...parsedLog];
        if (typeof window !== 'undefined') {
          cloudStorage.setItem('pipeline-changelog', JSON.stringify(updatedLog));
        }
      } catch (err) {
        console.error('Failed to save change log:', err);
      }
      
      // Remove from Quote Hub (Dashboard cloudStorage)
      try {
        const quotesData = cloudStorage.getItem('saltxc-quotes');
        if (quotesData) {
          const quotes = JSON.parse(quotesData);
          const updatedQuotes = quotes.filter((q: any) => q.projectNumber !== projectCode && q.id !== projectCode);
          cloudStorage.setItem('saltxc-quotes', JSON.stringify(updatedQuotes));
        }
      } catch (error) {
        console.error('Failed to remove from Quote Hub:', error);
      }
      
      // Remove from Project Management Hub cloudStorage
      try {
        const pmData = cloudStorage.getItem('saltxc-all-quotes');
        if (pmData) {
          const pmQuotes = JSON.parse(pmData);
          const updatedPMQuotes = pmQuotes.filter((q: any) => q.projectNumber !== projectCode && q.id !== projectCode);
          cloudStorage.setItem('saltxc-all-quotes', JSON.stringify(updatedPMQuotes));
        }
      } catch (error) {
        console.error('Failed to remove from PM Hub:', error);
      }
      
      // Mark change request as approved
      setChangeRequests(prev => prev.map(r => 
        r.id === requestId ? { ...r, status: 'Approved' } : r
      ));
      
      alert('Deletion request approved - entry removed from forecast and all hubs');
    } else {
      // Update the entry with requested changes
      setEntries(prev => prev.map((entry, idx) => 
        idx === entryIndex ? request.requestedChanges : entry
      ));

      // Mark change request as approved
      setChangeRequests(prev => prev.map(r => 
        r.id === requestId ? { ...r, status: 'Approved' } : r
      ));

      alert('Change request approved and applied');
    }
  };

  const handleRejectChangeRequest = (requestId: string) => {
    const request = changeRequests.find(r => r.id === requestId);
    if (!request) return;

    // If rejecting a deletion request, restore the status to 'Open'
    if (request.type === 'Deletion Request') {
      const entryIndex = entries.findIndex(e => e.projectCode === request.projectCode);
      if (entryIndex !== -1) {
        setEntries(prev => prev.map((entry, idx) => 
          idx === entryIndex ? { ...entry, status: 'Open' } : entry
        ));
      }
    }

    setChangeRequests(prev => prev.map(r => 
      r.id === requestId ? { ...r, status: 'Rejected' } : r
    ));
    alert('Change request rejected');
  };

  const handleApproveFinanceReview = (entryIndex: number) => {
    setEntries(prev => prev.map((entry, idx) => 
      idx === entryIndex ? { ...entry, status: 'Confirmed' } : entry
    ));
    alert('Finance review approved - status changed to Confirmed');
  };

  const handleRejectFinanceReview = (entryIndex: number) => {
    setEntries(prev => prev.map((entry, idx) => 
      idx === entryIndex ? { ...entry, status: 'Open' } : entry
    ));
    alert('Finance review rejected - status changed back to Open');
  };

  const handleReviewFinanceEntry = (entry: PipelineEntry) => {
    setReviewingEntry(entry);
    
    // Find the change record for this finance review
    const changeRecord = changeRequests.find(r => 
      r.projectCode === entry.projectCode && 
      r.type === 'Finance Review' && 
      r.submittedChanges.status === 'Finance Review'
    );
    
    setReviewingChanges(changeRecord);
    setReviewDialogOpen(true);
  };

  const handleMonthlyForecastEdit = (projectCode: string, month: string, value: string) => {
    const numericValue = parseCurrencyInput(value);
    
    setMonthlyOverrides(prev => ({
      ...prev,
      [projectCode]: {
        ...prev[projectCode],
        [month]: numericValue
      }
    }));
  };

  const handleExportToExcel = () => {
    // Filter entries based on current filters
    const filteredEntries = entries.filter(entry => {
      if (financeClientFilter && entry.client !== financeClientFilter) return false;
      if (financeStatusFilter && entry.status !== financeStatusFilter) return false;
      if (financeYearFilter) {
        const startYear = new Date(entry.startMonth).getFullYear().toString();
        if (startYear !== financeYearFilter) return false;
      }
      if (financeMonthFilter) {
        const startMonth = formatMonthYear(entry.startMonth);
        const endMonth = formatMonthYear(entry.endMonth);
        // Check if the selected month falls within the project's date range
        if (startMonth !== financeMonthFilter && endMonth !== financeMonthFilter) {
          // Check if it's in between
          const filterDate = new Date(financeMonthFilter);
          const startDate = new Date(entry.startMonth);
          const endDate = new Date(entry.endMonth);
          if (filterDate < startDate || filterDate > endDate) return false;
        }
      }
      return true;
    });

    let csvContent = '';
    let filename = '';

    if (financeReportType === 'projectByMonth') {
      // Project by Department by Month Report
      filename = 'project_fees_by_department_by_month.csv';
      csvContent = 'Project Code,Client,Program Name,Start Month,End Month,Status,Total Fees,Accounts,Creative,Design,Strategy,Media,Studio,Creator,Social,Omni,Finance\n';
      
      filteredEntries.forEach(entry => {
        const row = [
          entry.projectCode,
          entry.client,
          `"${entry.programName}"`, // Quote to handle commas in program names
          formatMonthYear(entry.startMonth),
          formatMonthYear(entry.endMonth),
          entry.status,
          entry.totalFees ?? 0,
          entry.accounts ?? 0,
          entry.creative ?? 0,
          entry.design ?? 0,
          entry.strategy ?? 0,
          entry.media ?? 0,
          entry.studio ?? 0,
          entry.creator ?? 0,
          entry.social ?? 0,
          entry.omni ?? 0,
          entry.finance ?? 0
        ];
        csvContent += row.join(',') + '\n';
      });
    } else if (financeReportType === 'clientSummary') {
      // Client Summary Report
      filename = 'client_summary_report.csv';
      csvContent = 'Client,Total Projects,Total Fees,Total Revenue\n';
      
      const clientSummary: { [client: string]: { count: number; fees: number; revenue: number } } = {};
      filteredEntries.forEach(entry => {
        if (!clientSummary[entry.client]) {
          clientSummary[entry.client] = { count: 0, fees: 0, revenue: 0 };
        }
        clientSummary[entry.client].count++;
        clientSummary[entry.client].fees += entry.totalFees ?? 0;
        clientSummary[entry.client].revenue += entry.revenue ?? 0;
      });

      Object.keys(clientSummary).sort().forEach(client => {
        const row = [
          client,
          clientSummary[client].count,
          clientSummary[client].fees,
          clientSummary[client].revenue
        ];
        csvContent += row.join(',') + '\n';
      });
    } else if (financeReportType === 'departmentBreakdown') {
      // Department Breakdown Report
      filename = 'department_breakdown_report.csv';
      csvContent = 'Department,Total Fees,% of Total\n';
      
      const deptTotals = {
        'Accounts': 0,
        'Creative': 0,
        'Design': 0,
        'Strategy': 0,
        'Media': 0,
        'Studio': 0,
        'Creator': 0,
        'Social': 0,
        'Omni': 0,
        'Finance': 0
      };

      filteredEntries.forEach(entry => {
        deptTotals['Accounts'] += entry.accounts ?? 0;
        deptTotals['Creative'] += entry.creative ?? 0;
        deptTotals['Design'] += entry.design ?? 0;
        deptTotals['Strategy'] += entry.strategy ?? 0;
        deptTotals['Media'] += entry.media ?? 0;
        deptTotals['Studio'] += entry.studio ?? 0;
        deptTotals['Creator'] += entry.creator ?? 0;
        deptTotals['Social'] += entry.social ?? 0;
        deptTotals['Omni'] += entry.omni ?? 0;
        deptTotals['Finance'] += entry.finance ?? 0;
      });

      const totalFees = Object.values(deptTotals).reduce((sum, val) => sum + val, 0);

      Object.entries(deptTotals).forEach(([dept, total]) => {
        const percentage = totalFees > 0 ? ((total / totalFees) * 100).toFixed(1) : '0.0';
        const row = [dept, total, percentage + '%'];
        csvContent += row.join(',') + '\n';
      });
    }

    // Create and download the CSV file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAddToCurrentSubmit = () => {
    if (!selectedParentProject) {
      alert('Please select a parent project');
      return;
    }

    // Find the parent entry
    const parentEntry = entries.find(e => e.projectCode === selectedParentProject);
    if (!parentEntry) {
      alert('Parent project not found');
      return;
    }

    // Pre-fill the form with parent project data
    setForm({
      projectCode: form.projectCode, // Keep the generated code
      entryType: 'In Plan',
      status: 'Open',
      owner: parentEntry.owner,
      client: parentEntry.client,
      programName: `${parentEntry.programName} - Subline`,
      region: parentEntry.region,
      programType: parentEntry.programType,
      startMonth: parentEntry.startMonth,
      endMonth: parentEntry.endMonth,
      revenue: '',
      accounts: '',
      creative: '',
      design: '',
      strategy: '',
      media: '',
      studio: '',
      creator: '',
      social: '',
      omni: '',
      finance: '',
      parentProjectCode: selectedParentProject // Add parent reference
    });

    // Close the selection dialog and open the add entry dialog
    setAddToCurrentDialogOpen(false);
    setDialogOpen(true);
  };

  const handleSaveEntry = () => {
    console.log('handleSaveEntry called with form:', form);
    
    if (!form.owner || !form.client || !form.programName || !form.startMonth || !form.endMonth) {
      alert('Please complete Owner, Client, Project, Start Month, and End Month.');
      return;
    }
    
    // Ensure project code is unique before saving
    const existingCodes = new Set(entries.map(entry => entry.projectCode));
    let finalProjectCode = form.projectCode;
    
    if (existingCodes.has(form.projectCode)) {
      // Generate a new unique project code
      const { code, newCounter } = generateUniqueProjectCode(entries, projectCounter);
      finalProjectCode = code;
      setProjectCounter(newCounter);
      console.log(`⚠️ Duplicate project code detected. Generated new unique code: ${finalProjectCode}`);
    }
    
    const newEntry: PipelineEntry = {
      projectCode: finalProjectCode,
      entryType: form.entryType as any,
      status: form.status,
      owner: form.owner,
      client: form.client,
      programName: form.programName,
      region: form.region,
      programType: form.programType,
      startMonth: form.startMonth,
      endMonth: form.endMonth,
      revenue: parseCurrencyInput(form.revenue),
      totalFees: computedTotalFees,
      accounts: parseCurrencyInput(form.accounts),
      creative: parseCurrencyInput(form.creative),
      design: parseCurrencyInput(form.design),
      strategy: parseCurrencyInput(form.strategy),
      media: parseCurrencyInput(form.media),
      studio: parseCurrencyInput(form.studio),
      creator: parseCurrencyInput(form.creator),
      social: parseCurrencyInput(form.social),
      omni: parseCurrencyInput(form.omni),
      finance: parseCurrencyInput(form.finance),
      parentProjectCode: (form as any).parentProjectCode || undefined,
    };
    
    console.log('Creating new entry:', newEntry);
    console.log('Current entries before adding:', entries);
    
    const updatedEntries = [newEntry, ...entries];
    setEntries(updatedEntries);
    persistPipelineEntries(updatedEntries);

    const additionLog = {
      type: 'addition' as const,
      projectCode: finalProjectCode,
      projectName: form.programName,
      client: form.client,
      description: `New project added: ${form.programName} for ${form.client}`,
      date: new Date().toISOString(),
      user: user.name
    };
    appendPipelineLog(additionLog);

    const { code: nextProjectCode, newCounter: nextCounter } = generateUniqueProjectCode(updatedEntries, projectCounter + 1);
    setProjectCounter(nextCounter);
    setForm({
      projectCode: nextProjectCode,
      entryType: 'In Plan',
      status: 'Open',
      owner: '', client: '', programName: '', region: '', programType: '', startMonth: '', endMonth: '', revenue: '',
      accounts: '', creative: '', design: '', strategy: '', media: '', studio: '', creator: '', social: '', omni: '', finance: '', parentProjectCode: ''
    });
    setDialogOpen(false);
    
    console.log('Entry saved successfully');
  };
  // Prevent hydration mismatch by not rendering until client-side
  if (!mounted) {
    return null;
  }
  // Team member management functions
  const handleAddTeamMember = () => {
    if (!newMemberName.trim() || !newMemberRole) {
      alert('Please enter a name and select a role.');
      return;
    }

    if (teamMembers.length >= 10) {
      alert('You can only add up to 10 team members.');
      return;
    }

    const newMember: TeamMember = {
      id: Date.now().toString(),
      name: newMemberName.trim(),
      role: newMemberRole,
      permission: newMemberPermission
    };

    setTeamMembers([...teamMembers, newMember]);
    setNewMemberName('');
    setNewMemberRole('');
    setNewMemberPermission('View');
    setShowAddMemberDialog(false);
  };

  const handleRemoveTeamMember = (id: string) => {
    if (window.confirm('Are you sure you want to remove this team member?')) {
      setTeamMembers(teamMembers.filter(m => m.id !== id));
    }
  };

  const handleUpdatePermission = (id: string, permission: 'View' | 'Edit') => {
    setTeamMembers(teamMembers.map(m => 
      m.id === id ? { ...m, permission } : m
    ));
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* User Sidebar Navigation - shown when NOT in admin mode AND not embedded */}
      {!isAdminMode && !isEmbedded && (
        <div className="fixed left-0 top-0 w-64 bg-blue-50 border-r border-blue-200 h-screen p-4 flex-shrink-0 overflow-y-auto">
          <div className="pt-8 space-y-2">
            {/* Logo and Title */}
            <div className="mb-4 flex flex-col items-center gap-1">
              <img src="/salt-logo.png" alt="Salt Logo" className="h-12 w-auto" />
              <h1 className="text-lg font-semibold text-gray-800">Business Pipeline</h1>
            </div>
            
            {/* Dashboard Button */}
            <button
              onClick={onBack}
              className="w-full mb-4 px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-blue-100 rounded-lg transition-colors text-center"
            >
              ← Salt XC Hub
            </button>
            
            {/* Separator */}
            <div className="mb-6 border-t border-blue-200"></div>

            {/* Navigation Buttons */}
            <div className="space-y-2">
              <button
                onClick={() => setSelectedUserView('executive')}
                className={`w-full px-4 py-3 rounded-lg font-medium text-sm transition-colors text-left ${
                  selectedUserView === 'executive'
                    ? 'bg-white text-black shadow-sm'
                    : 'text-blue-800 hover:bg-blue-100'
                }`}
              >
                Financial Health
              </button>
              
              <button
                onClick={() => setSelectedUserView('pipeline')}
                className={`w-full px-4 py-3 rounded-lg font-medium text-sm transition-colors text-left ${
                  selectedUserView === 'pipeline'
                    ? 'bg-white text-black shadow-sm'
                    : 'text-blue-800 hover:bg-blue-100'
                }`}
              >
                Pipeline
              </button>
              
              <button
                onClick={() => setSelectedUserView('settings')}
                className={`w-full px-4 py-3 rounded-lg font-medium text-sm transition-colors text-left ${
                  selectedUserView === 'settings'
                    ? 'bg-white text-black shadow-sm'
                    : 'text-blue-800 hover:bg-blue-100'
                }`}
              >
                Reporting
              </button>
            </div>

            {/* Sign Out at Bottom */}
            <div className="mt-6 pt-6 border-t border-blue-200">
              <button
                onClick={onLogout}
                className="w-full px-4 py-3 rounded-lg font-medium text-sm transition-colors text-left text-gray-600 hover:text-gray-800 hover:bg-blue-100"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Admin Sidebar Navigation - shown when in admin mode AND not embedded */}
      {isAdminMode && !isEmbedded && (
        <div className="fixed left-0 top-0 w-64 bg-blue-50 border-r border-blue-200 h-screen p-4 flex-shrink-0 overflow-y-auto">
          <div className="pt-8 space-y-2">
            {/* Logo and Title */}
            <div className="mb-4 flex flex-col items-center gap-1">
              <img src="/salt-logo.png" alt="Salt Logo" className="h-12 w-auto" />
              <h1 className="text-lg font-semibold text-gray-800">Business Pipeline</h1>
            </div>

            {/* Dashboard Button */}
            <button
              onClick={onBack}
              className="w-full mb-4 px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-blue-100 rounded-lg transition-colors text-center"
            >
              ← Dashboard
            </button>

            {/* Separator */}
            <div className="mb-6 border-t border-blue-200"></div>

            {/* Admin Navigation Buttons */}
            <div className="space-y-2">
              <button
                onClick={() => setAdminView('executiveSummary')}
                className={`w-full px-4 py-3 rounded-lg font-medium text-sm transition-colors text-left ${
                  adminView === 'executiveSummary' ? 'bg-white text-black shadow-sm' : 'text-blue-800 hover:bg-blue-100'
                }`}
              >
                Financial Health
              </button>
              <button
                onClick={() => setAdminView('overview')}
                className={`w-full px-4 py-3 rounded-lg font-medium text-sm transition-colors text-left ${
                  adminView === 'overview' ? 'bg-white text-black shadow-sm' : 'text-blue-800 hover:bg-blue-100'
                }`}
              >
                Pipeline Overview
              </button>
              <button
                onClick={() => setAdminView('annualPlan')}
                className={`w-full px-4 py-3 rounded-lg font-medium text-sm transition-colors text-left ${
                  adminView === 'annualPlan' ? 'bg-white text-black shadow-sm' : 'text-blue-800 hover:bg-blue-100'
                }`}
              >
                Annual Plan
              </button>
              <button
                onClick={() => setAdminView('weighted')}
                className={`w-full px-4 py-3 rounded-lg font-medium text-sm transition-colors text-left ${
                  adminView === 'weighted' ? 'bg-white text-black shadow-sm' : 'text-blue-800 hover:bg-blue-100'
                }`}
              >
                Weighted ROIs
              </button>
              <button
                onClick={() => setAdminView('overheads')}
                className={`w-full px-4 py-3 rounded-lg font-medium text-sm transition-colors text-left ${
                  adminView === 'overheads' ? 'bg-white text-black shadow-sm' : 'text-blue-800 hover:bg-blue-100'
                }`}
              >
                Overheads
              </button>
              <button
                onClick={() => setAdminView('financeReporting')}
                className={`w-full px-4 py-3 rounded-lg font-medium text-sm transition-colors text-left ${
                  adminView === 'financeReporting' ? 'bg-white text-black shadow-sm' : 'text-blue-800 hover:bg-blue-100'
                }`}
              >
                Downloads
              </button>
              <button
                onClick={() => setAdminView('settings')}
                className={`w-full px-4 py-3 rounded-lg font-medium text-sm transition-colors text-left ${
                  adminView === 'settings' ? 'bg-white text-black shadow-sm' : 'text-blue-800 hover:bg-blue-100'
                }`}
              >
                Settings
              </button>
            </div>
            {/* Bottom actions */}
            <div className="mt-6 pt-6 border-t border-blue-200">
              <button
                onClick={onLogout}
                className="w-full px-4 py-3 rounded-lg font-medium text-sm transition-colors text-left text-gray-600 hover:text-gray-800 hover:bg-blue-100"
              >
                Sign Out
              </button>
            </div>
            </div>
          </div>
        )}

      <main className={`${isEmbedded ? 'bg-white w-full' : 'ml-64 bg-white'} py-8 px-8 flex-1`}>

        {/* Admin Executive Summary - shows only tiles */}
        {isAdminMode && adminView === 'executiveSummary' && (
        <>
        {/* Executive Summary Tiles */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Financial Health</h2>
          
          {/* % of Year Complete and % of Plan Confirmed Tiles */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* % of Year Complete */}
            <div className="bg-white p-6 border border-gray-200 rounded-lg shadow-sm">
              <dt className="text-sm font-medium text-gray-500 mb-2">% of Year Complete</dt>
              <dd className="metric-value text-blue-600 mb-4">
                {(() => {
                  const now = new Date();
                  const start = new Date(now.getFullYear(), 0, 1);
                  const diffDays = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                  const yearPct = Math.max(0, Math.min(100, (diffDays / 365) * 100));
                  return Math.round(yearPct);
                })()}%
              </dd>
              <div className="h-2 w-full bg-gray-200 rounded">
                <div 
                  className="h-2 bg-blue-600 rounded" 
                  style={{ 
                    width: `${(() => {
                      const now = new Date();
                      const start = new Date(now.getFullYear(), 0, 1);
                      const diffDays = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                      return Math.max(0, Math.min(100, (diffDays / 365) * 100));
                    })()}%` 
                  }}
                ></div>
              </div>
            </div>

            {/* % of Plan Confirmed */}
            <div className="bg-white p-6 border border-gray-200 rounded-lg shadow-sm">
              <dt className="text-sm font-medium text-gray-500 mb-2">% of Plan Confirmed</dt>
              <dd className="metric-value text-green-600 mb-4">
                {(() => {
                  const totalPlanFees = Object.values(annualPlanEntries).reduce((sum, v: any) => sum + (v?.planFees || 0), 0);
                  const confirmedTotal = entries.filter(e => e.status === 'Confirmed').reduce((sum, e) => sum + (e.totalFees || 0), 0);
                  const planPct = totalPlanFees > 0 ? Math.max(0, Math.min(100, (confirmedTotal / totalPlanFees) * 100)) : 0;
                  return Math.round(planPct);
                })()}%
              </dd>
              <div className="h-2 w-full bg-gray-200 rounded">
                <div 
                  className="h-2 bg-green-600 rounded" 
                  style={{ 
                    width: `${(() => {
                      const totalPlanFees = Object.values(annualPlanEntries).reduce((sum, v: any) => sum + (v?.planFees || 0), 0);
                      const confirmedTotal = entries.filter(e => e.status === 'Confirmed').reduce((sum, e) => sum + (e.totalFees || 0), 0);
                      return totalPlanFees > 0 ? Math.max(0, Math.min(100, (confirmedTotal / totalPlanFees) * 100)) : 0;
                    })()}%` 
                  }}
                ></div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Total Potential Fees */}
          <div className="bg-white p-6 border border-gray-200 rounded-lg shadow-sm">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Potential Fees</dt>
                  <dd className="text-[24px] font-semibold text-blue-600">
                    ${entries.reduce((sum, entry) => sum + entry.totalFees, 0).toLocaleString()}
                  </dd>
                </dl>
              </div>
            </div>
          </div>

          {/* Total Weighted Fees */}
          <div className="bg-white p-6 border border-gray-200 rounded-lg shadow-sm">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Weighted Fees</dt>
                  <dd className="text-[24px] font-semibold text-green-600">
                    ${entries.reduce((sum, entry) => {
                      const statusMultiplier = {
                        'Confirmed': 1.0,
                        'Open': 0.9,
                        'High Pitch': 0.75,
                        'Medium Pitch': 0.5,
                        'Low Pitch': 0.1,
                        'Whitespace': 0.0,
                        'Finance Review': 0.9 // Treat as Open for weighting
                      }[entry.status] || 0.9;
                      return sum + (entry.totalFees * statusMultiplier);
                    }, 0).toLocaleString()}
                  </dd>
                </dl>
              </div>
            </div>
          </div>

          {/* Monthly Projects to Close */}
          <div className="bg-white p-6 border border-gray-200 rounded-lg shadow-sm">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Current Month - Fees to Close</dt>
                  <dd className="text-[24px] font-semibold text-purple-600">
                    ${(() => {
                      const now = new Date();
                      const currentYear = now.getFullYear();
                      const currentMonth = now.getMonth(); // 0-11
                      
                      return entries
                        .filter(e => {
                          // Exclude confirmed projects
                          if (e.status === 'Confirmed') return false;
                          
                          // Check if start date is in current month/year
                          if (e.startMonth) {
                            const startDate = new Date(e.startMonth);
                            return startDate.getFullYear() === currentYear && 
                                   startDate.getMonth() === currentMonth;
                          }
                          return false;
                        })
                        .reduce((sum, entry) => sum + entry.totalFees, 0)
                        .toLocaleString();
                    })()}
                  </dd>
                </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Status Breakdown Tiles */}
        <div className="mb-8 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {/* Confirmed */}
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-emerald-500">
            <div className="text-center">
              <div className="text-sm font-medium text-gray-500">Confirmed</div>
              <div className="text-[24px] font-medium text-gray-900">
                ${entries.filter(e => e.status === 'Confirmed').reduce((sum, entry) => sum + entry.totalFees, 0).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Open */}
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
            <div className="text-center">
              <div className="text-sm font-medium text-gray-500">Open</div>
              <div className="text-[24px] font-medium text-gray-900">
                ${entries.filter(e => e.status === 'Open').reduce((sum, entry) => sum + entry.totalFees, 0).toLocaleString()}
              </div>
            </div>
          </div>

          {/* High Pitch */}
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-500">
            <div className="text-center">
              <div className="text-sm font-medium text-gray-500">High Pitch</div>
              <div className="text-[24px] font-medium text-gray-900">
                ${entries.filter(e => e.status === 'High Pitch').reduce((sum, entry) => sum + entry.totalFees, 0).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Medium Pitch */}
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-orange-500">
            <div className="text-center">
              <div className="text-sm font-medium text-gray-500">Medium Pitch</div>
              <div className="text-[24px] font-medium text-gray-900">
                ${entries.filter(e => e.status === 'Medium Pitch').reduce((sum, entry) => sum + entry.totalFees, 0).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Low Pitch */}
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-500">
            <div className="text-center">
              <div className="text-sm font-medium text-gray-500">Low Pitch</div>
              <div className="text-[24px] font-medium text-gray-900">
                ${entries.filter(e => e.status === 'Low Pitch').reduce((sum, entry) => sum + entry.totalFees, 0).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Whitespace */}
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-gray-500">
            <div className="text-center">
              <div className="text-sm font-medium text-gray-500">Whitespace</div>
              <div className="text-[24px] font-medium text-gray-900">
                ${entries.filter(e => e.status === 'Whitespace').reduce((sum, entry) => sum + entry.totalFees, 0).toLocaleString()}
              </div>
            </div>
          </div>
        </div>
        {/* Newsfeed */}
        <div className="mt-8">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Newsfeed</h3>
          <div className="space-y-4">
            {/* Project Additions */}
            <div className="bg-white border rounded-lg shadow overflow-hidden">
              <div className="bg-green-100 px-6 py-3 border-b border-green-200">
                <h4 className="text-lg font-semibold text-green-700 flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                  </svg>
                  Project Additions
                </h4>
              </div>
              <div className="p-6">
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {pipelineChangeLog.filter(log => log.type === 'addition').length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">No additions yet</p>
                  ) : (
                    pipelineChangeLog.filter(log => log.type === 'addition').map((log, idx) => (
                      <div key={idx} className="p-3 bg-green-50 rounded border border-green-200 text-sm">
                        <div className="flex items-center justify-between gap-4">
                          <span className="font-medium text-gray-900">{log.projectCode}</span>
                          <span className="text-gray-600">{log.client || 'N/A'}</span>
                          <span className="text-gray-700 flex-1">{log.projectName}</span>
                          <span className="text-xs text-gray-600 whitespace-nowrap">
                            {new Date(log.date).toLocaleDateString()} at {new Date(log.date).toLocaleTimeString()}
                          </span>
                          <span className="text-xs text-blue-600 font-medium">{log.user}</span>
                        </div>
                      </div>
                    ))
                  )}
            </div>
          </div>
        </div>

            {/* Status Changes */}
            <div className="bg-white border rounded-lg shadow overflow-hidden">
              <div className="bg-blue-100 px-6 py-3 border-b border-blue-200">
                <h4 className="text-lg font-semibold text-blue-700 flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                  </svg>
                  Project Changes
                </h4>
              </div>
              <div className="p-6">
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {pipelineChangeLog.filter(log => log.type === 'change').length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">No changes yet</p>
                  ) : (
                    pipelineChangeLog.filter(log => log.type === 'change').map((log, idx) => (
                      <div key={idx} className="p-3 bg-blue-50 rounded border border-blue-200 text-sm">
                        <div className="flex items-center justify-between gap-4">
                          <span className="font-medium text-gray-900">{log.projectCode}</span>
                          <span className="text-gray-600">{log.client || 'N/A'}</span>
                          <span className="text-gray-700">{log.description}</span>
                          <span className="text-xs text-gray-600 whitespace-nowrap">
                            {new Date(log.date).toLocaleDateString()} at {new Date(log.date).toLocaleTimeString()}
                          </span>
                          <span className="text-xs text-blue-600 font-medium">{log.user}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Project Deletions */}
            <div className="bg-white border rounded-lg shadow overflow-hidden">
              <div className="bg-red-100 px-6 py-3 border-b border-red-200">
                <h4 className="text-lg font-semibold text-red-700 flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  Project Deletions
                </h4>
              </div>
              <div className="p-6">
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {pipelineChangeLog.filter(log => log.type === 'deletion').length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">No deletions yet</p>
                  ) : (
                    pipelineChangeLog.filter(log => log.type === 'deletion').map((log, idx) => (
                      <div key={idx} className="p-3 bg-red-50 rounded border border-red-200 text-sm">
                        <div className="flex items-center justify-between gap-4">
                          <span className="font-medium text-gray-900">{log.projectCode}</span>
                          <span className="text-gray-600">{log.client || 'N/A'}</span>
                          <span className="text-gray-700 flex-1">{log.projectName}</span>
                          <span className="text-xs text-gray-600 whitespace-nowrap">
                            {new Date(log.date).toLocaleDateString()} at {new Date(log.date).toLocaleTimeString()}
                          </span>
                          <span className="text-xs text-blue-600 font-medium">{log.user}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        </>
        )}

        {/* Admin Navigation Menu removed in favor of left sidebar */}
        {isAdminMode && adminView === 'overview' && (
        <>
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Pipeline Overview</h2>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Input
                type="text"
                placeholder="Search by project, client, region, program type..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-80 pl-10"
              />
              <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="bg-black text-white hover:bg-gray-800">
              Add Entry
                  <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
            </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setDialogOpen(true)}>
                  Add New
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setAddToCurrentDialogOpen(true)}>
                  Add to Current
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left border-b border-gray-200">
                  <th className="px-2 py-3 w-12 text-center"></th>
                  <th className="px-4 py-3 text-center w-32">Status</th>
                  <th className="px-4 py-3 w-[8.05rem] min-w-[8.05rem]">Project #</th>
                  <th className="px-4 py-3 w-[8.28rem] min-w-[8.28rem]">Owner</th>
                  <th className="px-4 py-3 w-[9.9rem] min-w-[9.9rem]">Client</th>
                  <th className="px-4 py-3 w-[10rem] min-w-[10rem]">Program</th>
                  <th className="px-4 py-3 w-28">Start Month</th>
                  <th className="px-4 py-3 w-28">End Month</th>
                  <th className="px-4 py-3 text-right w-32 bg-[#e4edf9] text-[#223bb2]">Revenue</th>
                  <th className="px-4 py-3 text-right w-32 bg-[#e4edf9] text-[#223bb2]">Total Fees</th>
                  <th className="px-4 py-3 text-right w-28">Accounts</th>
                  <th className="px-4 py-3 text-right w-28">Creative</th>
                  <th className="px-4 py-3 text-right w-28">Design</th>
                  <th className="px-4 py-3 text-right w-36">Strategy</th>
                  <th className="px-4 py-3 text-right w-24">Media</th>
                  <th className="px-4 py-3 text-right w-24">Studio</th>
                  <th className="px-4 py-3 text-right w-24">Creator</th>
                  <th className="px-4 py-3 text-right w-24">Social</th>
                  <th className="px-4 py-3 text-right w-32">Omni Shopper</th>
                  <th className="px-4 py-3 text-right w-24">Finance</th>
                  {/* Monthly Forecast Headers - Only in Admin Mode */}
                  {isAdminMode && (
                    <>
                      <th className="px-4 py-3 text-center text-xs font-medium text-blue-700 uppercase tracking-wider w-44 min-w-[11rem] whitespace-nowrap bg-[#e4edf9]">Jan</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-blue-700 uppercase tracking-wider w-44 min-w-[11rem] whitespace-nowrap bg-[#e4edf9]">Feb</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-blue-700 uppercase tracking-wider w-44 min-w-[11rem] whitespace-nowrap bg-[#e4edf9]">Mar</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-blue-700 uppercase tracking-wider w-44 min-w-[11rem] whitespace-nowrap bg-[#e4edf9]">Apr</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-blue-700 uppercase tracking-wider w-44 min-w-[11rem] whitespace-nowrap bg-[#e4edf9]">May</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-blue-700 uppercase tracking-wider w-44 min-w-[11rem] whitespace-nowrap bg-[#e4edf9]">Jun</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-blue-700 uppercase tracking-wider w-44 min-w-[11rem] whitespace-nowrap bg-[#e4edf9]">Jul</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-blue-700 uppercase tracking-wider w-44 min-w-[11rem] whitespace-nowrap bg-[#e4edf9]">Aug</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-blue-700 uppercase tracking-wider w-44 min-w-[11rem] whitespace-nowrap bg-[#e4edf9]">Sep</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-blue-700 uppercase tracking-wider w-44 min-w-[11rem] whitespace-nowrap bg-[#e4edf9]">Oct</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-blue-700 uppercase tracking-wider w-44 min-w-[11rem] whitespace-nowrap bg-[#e4edf9]">Nov</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-blue-700 uppercase tracking-wider w-44 min-w-[11rem] whitespace-nowrap bg-[#e4edf9]">Dec</th>
                    </>
                  )}
                    </tr>
                  </thead>
                  <tbody>
                {filteredEntries.length === 0 && entries.length === 0 && [1,2,3,4,5].map((i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="px-2 py-3 text-center w-12">
                      <span className="text-gray-400">—</span>
                    </td>
                    <td className="px-4 py-3 text-center w-32">
                      <span className="inline-block px-2 py-1 text-xs rounded bg-gray-100 text-gray-700">—</span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 w-[8.05rem]">—</td>
                    <td className="px-4 py-3 text-gray-400 w-[8.28rem]">—</td>
                    <td className="px-4 py-3 text-gray-400 w-[9.9rem]">—</td>
                    <td className="px-4 py-3 text-gray-400 w-[10rem] min-w-[10rem]">—</td>
                    <td className="px-4 py-3 text-gray-400 w-28">—</td>
                    <td className="px-4 py-3 text-gray-400 w-28">—</td>
                    <td className="px-4 py-3 text-right text-gray-400 bg-[#f6f9ff] w-32">—</td>
                    <td className="px-4 py-3 text-right text-gray-400 bg-[#f6f9ff] w-32">—</td>
                    <td className="px-4 py-3 text-right text-gray-400 w-28">—</td>
                    <td className="px-4 py-3 text-right text-gray-400 w-28">—</td>
                    <td className="px-4 py-3 text-right text-gray-400 w-28">—</td>
                    <td className="px-4 py-3 text-right text-gray-400 w-36">—</td>
                    <td className="px-4 py-3 text-right text-gray-400 w-24">—</td>
                    <td className="px-4 py-3 text-right text-gray-400 w-24">—</td>
                    <td className="px-4 py-3 text-right text-gray-400 w-24">—</td>
                    <td className="px-4 py-3 text-right text-gray-400 w-24">—</td>
                    <td className="px-4 py-3 text-right text-gray-400 w-32">—</td>
                    <td className="px-4 py-3 text-right text-gray-400 w-24">—</td>
                    {/* Monthly Forecast Cells - Only in Admin Mode */}
                    {isAdminMode && (
                      <>
                        <td className="px-2 py-3 text-center text-gray-400 w-44 min-w-[11rem] whitespace-nowrap bg-[#f6f9ff]">—</td>
                        <td className="px-2 py-3 text-center text-gray-400 w-44 min-w-[11rem] whitespace-nowrap bg-[#f6f9ff]">—</td>
                        <td className="px-2 py-3 text-center text-gray-400 w-44 min-w-[11rem] whitespace-nowrap bg-[#f6f9ff]">—</td>
                        <td className="px-2 py-3 text-center text-gray-400 w-44 min-w-[11rem] whitespace-nowrap bg-[#f6f9ff]">—</td>
                        <td className="px-2 py-3 text-center text-gray-400 w-44 min-w-[11rem] whitespace-nowrap bg-[#f6f9ff]">—</td>
                        <td className="px-2 py-3 text-center text-gray-400 w-44 min-w-[11rem] whitespace-nowrap bg-[#f6f9ff]">—</td>
                        <td className="px-2 py-3 text-center text-gray-400 w-44 min-w-[11rem] whitespace-nowrap bg-[#f6f9ff]">—</td>
                        <td className="px-2 py-3 text-center text-gray-400 w-44 min-w-[11rem] whitespace-nowrap bg-[#f6f9ff]">—</td>
                        <td className="px-2 py-3 text-center text-gray-400 w-44 min-w-[11rem] whitespace-nowrap bg-[#f6f9ff]">—</td>
                        <td className="px-2 py-3 text-center text-gray-400 w-44 min-w-[11rem] whitespace-nowrap bg-[#f6f9ff]">—</td>
                        <td className="px-2 py-3 text-center text-gray-400 w-44 min-w-[11rem] whitespace-nowrap bg-[#f6f9ff]">—</td>
                        <td className="px-2 py-3 text-center text-gray-400 w-44 min-w-[11rem] whitespace-nowrap bg-[#f6f9ff]">—</td>
                      </>
                    )}
                        </tr>
                ))}
                {filteredEntries.length === 0 && entries.length > 0 && (
                  <tr>
                    <td colSpan={isAdminMode ? 32 : 20} className="px-4 py-8 text-center text-gray-500">
                      No entries found matching "{searchTerm}"
                    </td>
                  </tr>
                )}
                {filteredEntries.map((e, idx) => {
                  const originalIndex = entries.findIndex(entry => entry.projectCode === e.projectCode);
                  return (
                  <tr key={idx} className="border-b border-gray-100">
                    <td className="px-2 py-3 text-center w-12">
                      {e.status === 'Confirmed' ? (
                        <button 
                          className="text-gray-300 cursor-not-allowed"
                          title="Confirmed entries cannot be edited"
                          disabled
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      ) : (
                      <button 
                        className="text-gray-600 hover:text-blue-600 transition-colors"
                          title="Edit entry"
                        onClick={() => handleEditEntry(originalIndex)}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center w-32">
                      <span className={`inline-block px-2 py-1 text-xs rounded font-medium ${
                        e.status === 'Confirmed' ? 'bg-green-100 text-green-800' :
                        e.status === 'Open' ? 'bg-blue-100 text-blue-800' :
                        e.status === 'High Pitch' ? 'bg-yellow-100 text-yellow-800' :
                        e.status === 'Medium Pitch' ? 'bg-orange-100 text-orange-800' :
                        e.status === 'Low Pitch' ? 'bg-red-100 text-red-800' :
                        e.status === 'Whitespace' ? 'bg-gray-100 text-gray-800' :
                        e.status === 'Finance Review' ? 'bg-purple-100 text-purple-800' :
                        e.status === 'Pending Deletion' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-700'
                      }`}>{e.status}</span>
                    </td>
                    <td className="px-4 py-3 w-[8.05rem] min-w-[8.05rem]">{e.projectCode}</td>
                    <td className="px-4 py-3 w-[8.28rem] min-w-[8.28rem]">{e.owner}</td>
                    <td className="px-4 py-3 w-[9.9rem] min-w-[9.9rem]">{e.client}</td>
                    <td className="px-4 py-3 w-[10rem] min-w-[10rem]">
                      <div className="flex items-center gap-2 min-w-[10rem]">
                        {e.programName}
                        {spansMultipleYears(e.startMonth, e.endMonth) && (
                          <span className="inline-flex items-center" title="Project spans multiple calendar years - fee deferral required">
                            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <circle cx="12" cy="12" r="9" strokeWidth="2" />
                              <path d="M10 8l6 4-6 4V8z" strokeWidth="2" fill="currentColor" />
                            </svg>
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 w-28">{formatMonthYear(e.startMonth)}</td>
                    <td className="px-4 py-3 w-28">{formatMonthYear(e.endMonth)}</td>
                    <td className={`px-4 py-3 text-right bg-[#f6f9ff] w-32 ${(e.revenue ?? 0) === 0 ? 'opacity-40 text-gray-400' : ''}`}>${(e.revenue ?? 0).toLocaleString()}</td>
                    <td className={`px-4 py-3 text-right bg-[#f6f9ff] w-32 ${(e.totalFees ?? 0) === 0 ? 'opacity-40 text-gray-400' : ''}`}>${(e.totalFees ?? 0).toLocaleString()}</td>
                    <td className={`px-4 py-3 text-right w-28 ${(e.accounts ?? 0) === 0 ? 'opacity-40 text-gray-400' : ''}`}>${(e.accounts ?? 0).toLocaleString()}</td>
                    <td className={`px-4 py-3 text-right w-28 ${(e.creative ?? 0) === 0 ? 'opacity-40 text-gray-400' : ''}`}>${(e.creative ?? 0).toLocaleString()}</td>
                    <td className={`px-4 py-3 text-right w-28 ${(e.design ?? 0) === 0 ? 'opacity-40 text-gray-400' : ''}`}>${(e.design ?? 0).toLocaleString()}</td>
                    <td className={`px-4 py-3 text-right w-36 ${(e.strategy ?? 0) === 0 ? 'opacity-40 text-gray-400' : ''}`}>${(e.strategy ?? 0).toLocaleString()}</td>
                    <td className={`px-4 py-3 text-right w-24 ${(e.media ?? 0) === 0 ? 'opacity-40 text-gray-400' : ''}`}>${(e.media ?? 0).toLocaleString()}</td>
                    <td className={`px-4 py-3 text-right w-24 ${(e.studio ?? 0) === 0 ? 'opacity-40 text-gray-400' : ''}`}>${(e.studio ?? 0).toLocaleString()}</td>
                    <td className={`px-4 py-3 text-right w-24 ${(e.creator ?? 0) === 0 ? 'opacity-40 text-gray-400' : ''}`}>${(e.creator ?? 0).toLocaleString()}</td>
                    <td className={`px-4 py-3 text-right w-24 ${(e.social ?? 0) === 0 ? 'opacity-40 text-gray-400' : ''}`}>${(e.social ?? 0).toLocaleString()}</td>
                    <td className={`px-4 py-3 text-right w-32 ${(e.omni ?? 0) === 0 ? 'opacity-40 text-gray-400' : ''}`}>${(e.omni ?? 0).toLocaleString()}</td>
                    <td className={`px-4 py-3 text-right w-24 ${(e.finance ?? 0) === 0 ? 'opacity-40 text-gray-400' : ''}`}>${(e.finance ?? 0).toLocaleString()}</td>
                    {/* Monthly Forecast Cells - Only in Admin Mode */}
                    {isAdminMode && (() => {
                      const projectOverrides = monthlyOverrides[e.projectCode] || {};
                      const monthlyForecast = calculateMonthlyForecast(e, projectOverrides);
                      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
                      return months.map(month => (
                        <td key={month} className={`px-2 py-2 text-center text-xs w-44 min-w-[11rem] whitespace-nowrap bg-[#f6f9ff]`}>
                          {monthlyForecast[month] > 0 ? (
                            <input
                              type="text"
                              value={`$${Math.round(monthlyForecast[month]).toLocaleString()}`}
                              onChange={(event) => handleMonthlyForecastEdit(e.projectCode, month, event.target.value)}
                              className="w-full text-center text-xs bg-transparent border-none outline-none text-blue-700 font-medium hover:bg-blue-50 focus:bg-white focus:border focus:border-blue-300 focus:rounded px-1"
                              onFocus={(event) => {
                                // Select all text when focused for easy editing
                                event.target.select();
                              }}
                            />
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                      ));
                    })()}
                  </tr>
                  );
                })}
                </tbody>
                </table>
              </div>
            </div>
            {/* Admin Pending Items Section - Only visible in Admin Mode */}
            {isAdminMode && (entries.filter(e => e.status === 'Finance Review').length > 0 || changeRequests.filter(r => r.status === 'Pending').length > 0) && (
              <div className="mt-8">
                <h3 className="text-xl font-bold text-red-700 mb-4 flex items-center">
                  <svg className="w-6 h-6 mr-2 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  Pending Items Requiring Review
                </h3>
                <div className="bg-red-50 border-2 border-red-200 rounded-lg shadow overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-red-200">
                      <thead className="bg-red-100">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-red-700 uppercase tracking-wider">Project #</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-red-700 uppercase tracking-wider">Type</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-red-700 uppercase tracking-wider">Requested By</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-red-700 uppercase tracking-wider">Date</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-red-700 uppercase tracking-wider">Program</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-red-700 uppercase tracking-wider">Revenue</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-red-700 uppercase tracking-wider">Total Fees</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-red-700 uppercase tracking-wider">Comments</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-red-700 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-red-100">
                        {/* Finance Review Items */}
                        {entries.filter(e => e.status === 'Finance Review').map((entry, idx) => {
                          const originalIndex = entries.findIndex(e => e.projectCode === entry.projectCode);
                          const financeRecord = changeRequests.find(r => 
                            r.projectCode === entry.projectCode && 
                            r.type === 'Finance Review'
                          );
                          return (
                            <tr key={`finance-${entry.projectCode}`} className="hover:bg-red-50">
                              <td className="px-4 py-3 text-sm font-medium text-gray-900">{entry.projectCode}</td>
                              <td className="px-4 py-3 text-sm">
                                <span className="inline-block px-2 py-1 text-xs rounded bg-red-100 text-red-700">Finance Review</span>
                              </td>
                          <td className="px-4 py-3 text-sm text-gray-600 min-w-[12rem]">{financeRecord?.submittedBy || 'Unknown'}</td>
                              <td className="px-4 py-3 text-sm text-gray-600">
                                {financeRecord ? new Date(financeRecord.submittedAt).toLocaleDateString() : '—'}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600 min-w-[24rem]">{entry.programName}</td>
                              <td className="px-4 py-3 text-sm text-right font-medium">${entry.revenue.toLocaleString()}</td>
                              <td className="px-4 py-3 text-sm text-right font-medium">${entry.totalFees.toLocaleString()}</td>
                              <td className="px-4 py-3 text-sm text-gray-600">
                                <div className="max-w-xs">
                                  {financeRecord?.comments ? (
                                    <p className="text-xs text-gray-700 truncate" title={financeRecord.comments}>
                                      {financeRecord.comments}
                                    </p>
                                  ) : (
                                    <span className="text-gray-400 italic">No comments</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <div className="flex justify-center gap-1">
                                  <Button 
                                    size="sm" 
                                    className="bg-purple-600 text-white hover:bg-purple-700"
                                    onClick={() => handleReviewFinanceEntry(entry)}
                                  >
                                    Review
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    className="bg-green-600 text-white hover:bg-green-700"
                                    onClick={() => handleApproveFinanceReview(originalIndex)}
                                  >
                                    Approve
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => handleRejectFinanceReview(originalIndex)}
                                  >
                                    Reject
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {/* Change Request Items */}
                        {changeRequests.filter(r => r.status === 'Pending' && r.type !== 'Finance Review').map((request) => {
                          const isDeletion = request.type === 'Deletion Request' && request.submittedChanges === null;
                          const displayData = isDeletion ? request.originalEntry : request.requestedChanges;
                          
                          return (
                            <tr key={`change-${request.id}`} className="hover:bg-red-50">
                              <td className="px-4 py-3 text-sm font-medium text-gray-900">{request.projectCode}</td>
                              <td className="px-4 py-3 text-sm">
                                {isDeletion ? (
                                  <span className="inline-block px-2 py-1 text-xs rounded bg-red-100 text-red-700">Deletion Request</span>
                                ) : (
                                  <span className="inline-block px-2 py-1 text-xs rounded bg-orange-100 text-orange-700">Change Request</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">{request.requestedBy || request.submittedBy}</td>
                              <td className="px-4 py-3 text-sm text-gray-600">
                                {new Date(request.requestedAt || request.submittedAt).toLocaleDateString()}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">{displayData.programName}</td>
                              <td className="px-4 py-3 text-sm text-right font-medium">${displayData.revenue.toLocaleString()}</td>
                              <td className="px-4 py-3 text-sm text-right font-medium">${displayData.totalFees.toLocaleString()}</td>
                              <td className="px-4 py-3 text-sm text-gray-600">
                                <div className="max-w-xs">
                                  {request.comments ? (
                                    <p className="text-xs text-gray-700 truncate" title={request.comments}>
                                      {request.comments}
                                    </p>
                                  ) : (
                                    <span className="text-gray-400 italic">No comments</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <div className="flex justify-center gap-2">
                                  <Button 
                                    size="sm" 
                                    className="bg-green-600 text-white hover:bg-green-700"
                                    onClick={() => handleApproveChangeRequest(request.id)}
                                  >
                                    Approve
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => handleRejectChangeRequest(request.id)}
                                  >
                                    Reject
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Newsfeed Section - Visible in both Main and Admin Views */}
            <div className="mt-8">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Newsfeed</h3>
              <div className="space-y-4">
                {/* Project Additions */}
                <div className="bg-white border rounded-lg shadow overflow-hidden">
                  <div className="bg-green-100 px-6 py-3 border-b border-green-200">
                    <h4 className="text-lg font-semibold text-green-700 flex items-center">
                      <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                      </svg>
                      Project Additions
                    </h4>
                  </div>
                  <div className="p-6">
                    <div className="max-h-64 overflow-y-auto space-y-2">
                      {pipelineChangeLog.filter(log => log.type === 'addition').length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-4">No additions yet</p>
                      ) : (
                        pipelineChangeLog.filter(log => log.type === 'addition').map((log, idx) => (
                          <div key={idx} className="p-3 bg-green-50 rounded border border-green-200 text-sm">
                            <div className="flex items-center justify-between gap-4">
                              <span className="font-medium text-gray-900">{log.projectCode}</span>
                              <span className="text-gray-600">{log.client || 'N/A'}</span>
                              <span className="text-gray-700 flex-1">{log.projectName}</span>
                              <span className="text-xs text-gray-600 whitespace-nowrap">
                                {new Date(log.date).toLocaleDateString()} at {new Date(log.date).toLocaleTimeString()}
                              </span>
                              <span className="text-xs text-blue-600 font-medium">{log.user}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Project Changes */}
                <div className="bg-white border rounded-lg shadow overflow-hidden">
                  <div className="bg-blue-100 px-6 py-3 border-b border-blue-200">
                    <h4 className="text-lg font-semibold text-blue-700 flex items-center">
                      <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                      </svg>
                      Project Changes
                    </h4>
                  </div>
                  <div className="p-6">
                    <div className="max-h-64 overflow-y-auto space-y-2">
                      {pipelineChangeLog.filter(log => log.type === 'change').length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-4">No changes yet</p>
                      ) : (
                        pipelineChangeLog.filter(log => log.type === 'change').map((log, idx) => (
                          <div key={idx} className="p-3 bg-blue-50 rounded border border-blue-200 text-sm">
                            <div className="flex items-center justify-between gap-4">
                              <span className="font-medium text-gray-900">{log.projectCode}</span>
                              <span className="text-gray-600">{log.client || 'N/A'}</span>
                              <span className="text-gray-700">{log.projectName}</span>
                              <span className="text-gray-600 text-xs flex-1">{log.description}</span>
                              <span className="text-xs text-gray-600 whitespace-nowrap">
                                {new Date(log.date).toLocaleDateString()} at {new Date(log.date).toLocaleTimeString()}
                              </span>
                              <span className="text-xs text-blue-600 font-medium">{log.user}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Project Deletions */}
                <div className="bg-white border rounded-lg shadow overflow-hidden">
                  <div className="bg-red-100 px-6 py-3 border-b border-red-200">
                    <h4 className="text-lg font-semibold text-red-700 flex items-center">
                      <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      Project Deletions
                    </h4>
                  </div>
                  <div className="p-6">
                    <div className="max-h-64 overflow-y-auto space-y-2">
                      {pipelineChangeLog.filter(log => log.type === 'deletion').length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-4">No deletions yet</p>
                      ) : (
                        pipelineChangeLog.filter(log => log.type === 'deletion').map((log, idx) => (
                          <div key={idx} className="p-3 bg-red-50 rounded border border-red-200 text-sm">
                            <div className="flex items-center justify-between gap-4">
                              <span className="font-medium text-gray-900">{log.projectCode}</span>
                              <span className="text-gray-600">{log.client || 'N/A'}</span>
                              <span className="text-gray-700 flex-1">{log.projectName}</span>
                              <span className="text-xs text-gray-600 whitespace-nowrap">
                                {new Date(log.date).toLocaleDateString()} at {new Date(log.date).toLocaleTimeString()}
                              </span>
                              <span className="text-xs text-blue-600 font-medium">{log.user}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

        </>
        )}
        {/* Inject former Weighted Forecast chart at top of deptWeighted (now Weighted ROIs) */}
        {isAdminMode && adminView === 'weighted' && (
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 space-y-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Weighted ROIs</h2>
            <div className="overflow-x-auto mb-8">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="px-4 py-3 text-left w-48">Forecast</th>
                    {weightedViewData.monthNames.map(m => (
                      <th key={m} className="px-3 py-3 text-right w-24 bg-[#e4edf9] text-[#223bb2]">{m}</th>
                    ))}
                    <th className="px-3 py-3 text-right w-28 bg-[#e4edf9] text-[#223bb2] border-l-2 border-gray-300">Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-gray-800 text-white">
                    <td className="px-4 py-2 font-medium">Total Salaries</td>
                    {weightedViewData.monthNames.map(m => (
                      <td key={`ts-${m}`} className="px-3 py-2 text-right">${salariesByMonth[m].toLocaleString()}</td>
                    ))}
                    <td className="px-3 py-2 text-right">${weightedViewData.monthNames.reduce((sum, m) => sum + salariesByMonth[m], 0).toLocaleString()}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="px-4 py-2 font-medium">Potential Fees</td>
                    {weightedViewData.monthNames.map(m => (
                      <td key={`pot-${m}`} className="px-3 py-2 text-right">${Math.round(weightedViewData.potentialByMonth[m]).toLocaleString()}</td>
                    ))}
                    <td className="px-3 py-2 text-right font-semibold border-l-2 border-gray-300">${Math.round(weightedViewData.monthNames.reduce((sum, m) => sum + weightedViewData.potentialByMonth[m], 0)).toLocaleString()}</td>
                  </tr>
                  
                  <tr className="bg-gray-800 text-white">
                    <td className="px-4 py-2 font-medium">P-ROI</td>
                    {weightedViewData.monthNames.map(m => {
                      const sal = salariesByMonth[m] || 0;
                      const rev = weightedViewData.potentialByMonth[m] || 0;
                      const roi = sal > 0 ? rev / sal : 0;
                      const hot = sal > 0 && roi > 2.0;
                      return (
                        <td key={`proi-${m}`} className={`px-3 py-2 text-right ${hot ? 'bg-green-100 text-green-800 font-semibold' : ''}`}>{sal > 0 ? roi.toFixed(2) : '—'}</td>
                      );
                    })}
                    <td className="px-3 py-2 text-right border-l-2 border-gray-300">{(() => {
                      const totalSal = weightedViewData.monthNames.reduce((s, m) => s + (salariesByMonth[m] || 0), 0);
                      const totalRev = weightedViewData.monthNames.reduce((s, m) => s + (weightedViewData.potentialByMonth[m] || 0), 0);
                      const roi = totalSal > 0 ? (totalRev / totalSal) : 0;
                      const hot = roi > 2.0;
                      return totalSal > 0 ? (<span className={`${hot ? 'bg-green-100 text-green-800 font-semibold px-2 py-1 rounded' : ''}`}>{roi.toFixed(2)}</span>) : '—';
                    })()}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="px-4 py-2 font-medium">Weighted Fees</td>
                    {weightedViewData.monthNames.map(m => (
                      <td key={`wgt-${m}`} className="px-3 py-2 text-right font-medium">${Math.round(weightedViewData.weightedByMonth[m]).toLocaleString()}</td>
                    ))}
                    <td className="px-3 py-2 text-right font-semibold border-l-2 border-gray-300">${Math.round(weightedViewData.monthNames.reduce((sum, m) => sum + weightedViewData.weightedByMonth[m], 0)).toLocaleString()}</td>
                  </tr>
                  
                  <tr className="bg-gray-800 text-white">
                    <td className="px-4 py-2 font-medium">W-ROI</td>
                    {weightedViewData.monthNames.map(m => {
                      const sal = salariesByMonth[m] || 0;
                      const rev = weightedViewData.weightedByMonth[m] || 0;
                      const roi = sal > 0 ? rev / sal : 0;
                      const hot = sal > 0 && roi > 2.0;
                      return (
                        <td key={`wroi-${m}`} className={`px-3 py-2 text-right ${hot ? 'bg-green-100 text-green-800 font-semibold' : ''}`}>{sal > 0 ? roi.toFixed(2) : '—'}</td>
                      );
                    })}
                    <td className="px-3 py-2 text-right border-l-2 border-gray-300">{(() => {
                      const totalSal = weightedViewData.monthNames.reduce((s, m) => s + (salariesByMonth[m] || 0), 0);
                      const totalRev = weightedViewData.monthNames.reduce((s, m) => s + (weightedViewData.weightedByMonth[m] || 0), 0);
                      const roi = totalSal > 0 ? (totalRev / totalSal) : 0;
                      const hot = roi > 2.0;
                      return totalSal > 0 ? (<span className={`${hot ? 'bg-green-100 text-green-800 font-semibold px-2 py-1 rounded' : ''}`}>{roi.toFixed(2)}</span>) : '—';
                    })()}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-medium">Confirmed Fees</td>
                    {weightedViewData.monthNames.map(m => (
                      <td key={`cnf-${m}`} className="px-3 py-2 text-right">${Math.round(weightedViewData.confirmedByMonth[m]).toLocaleString()}</td>
                    ))}
                    <td className="px-3 py-2 text-right font-semibold border-l-2 border-gray-300">${Math.round(weightedViewData.monthNames.reduce((sum, m) => sum + weightedViewData.confirmedByMonth[m], 0)).toLocaleString()}</td>
                  </tr>
                  <tr className="bg-gray-800 text-white">
                    <td className="px-4 py-2 font-medium">C-ROI</td>
                    {weightedViewData.monthNames.map(m => {
                      const sal = salariesByMonth[m] || 0;
                      const rev = weightedViewData.confirmedByMonth[m] || 0;
                      const roi = sal > 0 ? rev / sal : 0;
                      const hot = sal > 0 && roi > 2.0;
                      return (
                        <td key={`croi-${m}`} className={`px-3 py-2 text-right ${hot ? 'bg-green-100 text-green-800 font-semibold' : ''}`}>{sal > 0 ? roi.toFixed(2) : '—'}</td>
                      );
                    })}
                    <td className="px-3 py-2 text-right border-l-2 border-gray-300">{(() => {
                      const totalSal = weightedViewData.monthNames.reduce((s, m) => s + (salariesByMonth[m] || 0), 0);
                      const totalRev = weightedViewData.monthNames.reduce((s, m) => s + (weightedViewData.confirmedByMonth[m] || 0), 0);
                      const roi = totalSal > 0 ? (totalRev / totalSal) : 0;
                      const hot = roi > 2.0;
                      return totalSal > 0 ? (<span className={`${hot ? 'bg-green-100 text-green-800 font-semibold px-2 py-1 rounded' : ''}`}>{roi.toFixed(2)}</span>) : '—';
                    })()}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-4">By Department</h3>
            {['Accounts','Creative','Design','Strategy','Media','Creator','Social','Studio','Sponsorship','Omni Shopper','Digital'].map((dept) => {
              const feeField = DEPT_FEE_FIELD_MAP[dept] || null;
              const data = feeField ? buildDeptWeightedData(feeField) : buildDeptWeightedData(null);
              const salByMonth = buildDeptSalariesByMonth(dept);
              return (
                <div key={dept} className="mb-8">
                  <div className="mb-2 text-lg font-semibold text-gray-900">{dept}</div>
                  <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="px-4 py-3 text-left w-48">Forecast</th>
                    {data.monthNames.map(m => (
                      <th key={`dept-h-${m}`} className="px-3 py-3 text-right w-24 bg-[#e4edf9] text-[#223bb2]">{m}</th>
                    ))}
                    <th className="px-3 py-3 text-right w-28 bg-[#e4edf9] text-[#223bb2] border-l-2 border-gray-300">Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-gray-800 text-white">
                    <td className="px-4 py-2 font-medium">Total Salaries</td>
                    {data.monthNames.map(m => (
                      <td key={`dept-ts-${dept}-${m}`} className="px-3 py-2 text-right">${salByMonth[m].toLocaleString()}</td>
                    ))}
                    <td className="px-3 py-2 text-right">${data.monthNames.reduce((sum, mm) => sum + (salByMonth[mm] || 0), 0).toLocaleString()}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="px-4 py-2 font-medium">Potential Fees</td>
                    {data.monthNames.map(m => (
                      <td key={`dept-pot-${dept}-${m}`} className="px-3 py-2 text-right">${Math.round(data.potentialByMonth[m]).toLocaleString()}</td>
                    ))}
                    <td className="px-3 py-2 text-right font-semibold border-l-2 border-gray-300">${Math.round(data.monthNames.reduce((sum, m) => sum + data.potentialByMonth[m], 0)).toLocaleString()}</td>
                  </tr>
                  <tr className="bg-gray-800 text-white">
                    <td className="px-4 py-2 font-medium">P-ROI</td>
                    {data.monthNames.map(m => {
                      const sal = salByMonth[m] || 0;
                      const rev = data.potentialByMonth[m] || 0;
                      const roi = sal > 0 ? rev / sal : 0;
                      const hot = sal > 0 && roi > 2.0;
                      return <td key={`dept-proi-${dept}-${m}`} className={`px-3 py-2 text-right ${hot ? 'bg-green-100 text-green-800 font-semibold' : ''}`}>{sal > 0 ? roi.toFixed(2) : '—'}</td>;
                    })}
                    <td className="px-3 py-2 text-right border-l-2 border-gray-300">{(() => {
                      const totalSal = data.monthNames.reduce((s, m) => s + (salByMonth[m] || 0), 0);
                      const totalRev = data.monthNames.reduce((s, m) => s + (data.potentialByMonth[m] || 0), 0);
                      const roi = totalSal > 0 ? (totalRev / totalSal) : 0;
                      const hot = roi > 2.0;
                      return totalSal > 0 ? (<span className={`${hot ? 'bg-green-100 text-green-800 font-semibold px-2 py-1 rounded' : ''}`}>{roi.toFixed(2)}</span>) : '—';
                    })()}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="px-4 py-2 font-medium">Weighted Fees</td>
                    {data.monthNames.map(m => (
                      <td key={`dept-wgt-${dept}-${m}`} className="px-3 py-2 text-right font-medium">${Math.round(data.weightedByMonth[m]).toLocaleString()}</td>
                    ))}
                    <td className="px-3 py-2 text-right font-semibold border-l-2 border-gray-300">${Math.round(data.monthNames.reduce((sum, m) => sum + data.weightedByMonth[m], 0)).toLocaleString()}</td>
                  </tr>
                  <tr className="bg-gray-800 text-white">
                    <td className="px-4 py-2 font-medium">W-ROI</td>
                    {data.monthNames.map(m => {
                      const sal = salByMonth[m] || 0;
                      const rev = data.weightedByMonth[m] || 0;
                      const roi = sal > 0 ? rev / sal : 0;
                      const hot = sal > 0 && roi > 2.0;
                      return <td key={`dept-wroi-${dept}-${m}`} className={`px-3 py-2 text-right ${hot ? 'bg-green-100 text-green-800 font-semibold' : ''}`}>{sal > 0 ? roi.toFixed(2) : '—'}</td>;
                    })}
                    <td className="px-3 py-2 text-right border-l-2 border-gray-300">{(() => {
                      const totalSal = data.monthNames.reduce((s, m) => s + (salByMonth[m] || 0), 0);
                      const totalRev = data.monthNames.reduce((s, m) => s + (data.weightedByMonth[m] || 0), 0);
                      const roi = totalSal > 0 ? (totalRev / totalSal) : 0;
                      const hot = roi > 2.0;
                      return totalSal > 0 ? (<span className={`${hot ? 'bg-green-100 text-green-800 font-semibold px-2 py-1 rounded' : ''}`}>{roi.toFixed(2)}</span>) : '—';
                    })()}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-medium">Confirmed Fees</td>
                    {data.monthNames.map(m => (
                      <td key={`dept-cnf-${dept}-${m}`} className="px-3 py-2 text-right">${Math.round(data.confirmedByMonth[m]).toLocaleString()}</td>
                    ))}
                    <td className="px-3 py-2 text-right font-semibold border-l-2 border-gray-300">${Math.round(data.monthNames.reduce((sum, m) => sum + data.confirmedByMonth[m], 0)).toLocaleString()}</td>
                  </tr>
                  <tr className="bg-gray-800 text-white">
                    <td className="px-4 py-2 font-medium">C-ROI</td>
                    {data.monthNames.map(m => {
                      const sal = salByMonth[m] || 0;
                      const rev = data.confirmedByMonth[m] || 0;
                      const roi = sal > 0 ? rev / sal : 0;
                      const hot = sal > 0 && roi > 2.0;
                      return <td key={`dept-croi-${dept}-${m}`} className={`px-3 py-2 text-right ${hot ? 'bg-green-100 text-green-800 font-semibold' : ''}`}>{sal > 0 ? roi.toFixed(2) : '—'}</td>;
                    })}
                    <td className="px-3 py-2 text-right border-l-2 border-gray-300">{(() => {
                      const totalSal = data.monthNames.reduce((s, m) => s + (salByMonth[m] || 0), 0);
                      const totalRev = data.monthNames.reduce((s, m) => s + (data.confirmedByMonth[m] || 0), 0);
                      const roi = totalSal > 0 ? (totalRev / totalSal) : 0;
                      const hot = roi > 2.0;
                      return totalSal > 0 ? (<span className={`${hot ? 'bg-green-100 text-green-800 font-semibold px-2 py-1 rounded' : ''}`}>{roi.toFixed(2)}</span>) : '—';
                    })()}</td>
                  </tr>
                </tbody>
              </table>
                </div>
              </div>
            )})}
          </div>
        )}

        {isAdminMode && adminView === 'overheads' && (
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 space-y-6">
              <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Overheads</h2>
              <div className="flex items-center gap-3">
                {/* Save Status Indicator */}
                <div className="flex items-center gap-2">
                  {overheadsSaveStatus === 'saving' && (
                    <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-700">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                      <span className="font-medium">Saving to database...</span>
                    </div>
                  )}
                  {overheadsSaveStatus === 'saved' && (
                    <div className="flex items-center gap-2 px-3 py-1 bg-green-50 border border-green-200 rounded-md text-sm text-green-700">
                      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="font-medium">Saved to master database</span>
                    </div>
                  )}
                  {overheadsSaveStatus === 'error' && (
                    <div className="flex items-center gap-2 px-3 py-1 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
                      <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="font-medium">Save failed</span>
                    </div>
                  )}
                  {overheadsSaveStatus === 'idle' && overheadsLastSaved && (
                    <div className="text-xs text-gray-500">
                      Last saved: {overheadsLastSaved}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button 
                    className="bg-black text-white hover:bg-gray-800" 
                    onClick={handleAddOverhead}
                    disabled={overheadsLoading}
                  >
                    Add Employee
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => saveOverheads()}
                    disabled={overheadsLoading || overheadsSaveStatus === 'saving'}
                    className="flex items-center gap-2"
                  >
                    {overheadsSaveStatus === 'saving' ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Saving...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                        </svg>
                        Save Now
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
            {overheadsError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm text-red-800">{overheadsError}</span>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => syncOverheadsWithDatabase()}
                    className="ml-auto text-xs"
                  >
                    Retry
                  </Button>
                </div>
              </div>
            )}
            <div className="mb-4 flex items-center gap-3">
              <div className="relative w-80">
                <Input
                  type="text"
                  placeholder="Search department, employee, role..."
                  value={overheadsSearchTerm}
                  onChange={(e) => setOverheadsSearchTerm(e.target.value)}
                  className="pl-9"
                />
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="px-4 py-3 text-left w-32">Department</th>
                    <th className="px-4 py-3 text-left w-64 min-w-[16rem]">Employee</th>
                    <th className="px-4 py-3 text-left w-64 min-w-[16rem]">Role</th>
                    <th className="px-4 py-3 text-center w-24">Location</th>
                    <th className="px-4 py-3 text-right w-40 min-w-[10rem]">Annual Salary</th>
                    <th className="px-4 py-3 text-center w-28">% Allocation</th>
                    <th className="px-4 py-3 text-center w-36">Start Date</th>
                    <th className="px-4 py-3 text-center w-36">End Date</th>
                    {weightedViewData.monthNames.map(m => (
                      <th key={`oh-${m}`} className="px-3 py-3 text-center w-32 min-w-[8rem] bg-[#e4edf9] text-[#223bb2]">{m}</th>
                    ))}
                    <th className="px-4 py-3 text-right w-28 bg-[#e4edf9] text-[#223bb2]">Total</th>
                    <th className="px-4 py-3 text-center w-20">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOverheads.length === 0 && (
                    <tr className="border-b">
                      <td className="px-4 py-2 text-gray-400" colSpan={weightedViewData.monthNames.length + 10}>No overheads added yet</td>
                    </tr>
                  )}
                  {filteredOverheads.map((row, idx) => (
                    <tr key={idx} className={`border-b ${overheadsSaveStatus === 'saving' ? 'bg-blue-50' : ''}`}>
                      <td className="px-4 py-2 relative">
                        <Select value={row.department} onValueChange={(v) => updateOverheadField(idx, 'department', v)}>
                          <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                          <SelectContent>
                            {DEPARTMENT_OPTIONS.map(d => (<SelectItem key={d} value={d}>{d}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-4 py-2 w-64 min-w-[16rem]">
                        <Input value={row.employee} onChange={(e) => updateOverheadField(idx, 'employee', e.target.value)} placeholder="Employee name" className="w-full" />
                      </td>
                      <td className="px-4 py-2 w-64 min-w-[16rem]">
                        <Input list={`roles-list-${idx}`} value={row.role} onChange={(e) => updateOverheadField(idx, 'role', e.target.value)} placeholder="Role" className="w-full" />
                        <datalist id={`roles-list-${idx}`}>
                          {ALL_ROLES.map(r => (<option key={r} value={r} />))}
                        </datalist>
                      </td>
                      <td className="px-4 py-2 text-center w-24">
                        <Select value={row.location || 'Canada'} onValueChange={(v: 'Canada' | 'US') => updateOverheadField(idx, 'location', v)}>
                          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Canada">CAN</SelectItem>
                            <SelectItem value="US">US</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-4 py-2 text-right w-40 min-w-[10rem]">
                        <Input value={row.annualSalary ? `$${row.annualSalary.toLocaleString()}` : ''} onChange={(e) => updateOverheadField(idx, 'annualSalary', parseCurrencyInput(e.target.value))} className="text-right w-full" placeholder="$0" />
                      </td>
                      <td className="px-4 py-2 text-center w-28">
                        <div className="flex items-center justify-center gap-1">
                          <Input value={(row.allocationPercent ?? 0).toString()} onChange={(e) => updateOverheadField(idx, 'allocationPercent', Math.max(0, Math.min(100, parseInt((e.target.value || '').replace(/[^\d]/g, '') || '0', 10))))} className="text-center w-20" placeholder="0" />
                          <span>%</span>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-center w-36">
                        <Input type="date" value={row.startDate || ''} onChange={(e) => updateOverheadField(idx, 'startDate', e.target.value)} className="text-center w-full" />
                      </td>
                      <td className="px-4 py-2 text-center w-36">
                        <Input type="date" value={row.endDate || ''} onChange={(e) => updateOverheadField(idx, 'endDate', e.target.value)} className="text-center w-full" />
                      </td>
                      {weightedViewData.monthNames.map(m => (
                        <td key={`oh-cell-${idx}-${m}`} className="px-2 py-2 text-center w-32 min-w-[8rem]">
                          <Input value={row.monthly[m] ? `$${row.monthly[m].toLocaleString()}` : ''} onChange={(e) => updateOverheadMonth(idx, m, e.target.value)} className="text-center w-full" placeholder="$0" />
                        </td>
                      ))}
                      <td className="px-4 py-2 text-right font-semibold">
                        {(() => {
                          const total = weightedViewData.monthNames.reduce((sum, m) => sum + (row.monthly[m] || 0), 0);
                          return `$${total.toLocaleString()}`;
                        })()}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteOverhead(idx)}
                          className="text-red-600 hover:text-red-800 hover:bg-red-50"
                          disabled={overheadsLoading}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </Button>
                      </td>
                    </tr>
                  ))}
                {filteredOverheads.length > 0 && (
                  <tr className="bg-gray-50 border-t-2">
                    <td className="px-4 py-2 font-semibold" colSpan={7}>Total</td>
                    {weightedViewData.monthNames.map(m => (
                      <td key={`oh-total-${m}`} className="px-3 py-2 text-right font-semibold bg-[#f6f9ff]">
                        ${Math.round(overheadsTotalsByMonth[m] || 0).toLocaleString()}
                      </td>
                    ))}
                    <td className="px-4 py-2 text-right font-bold bg-[#e4edf9] text-[#223bb2]">
                      ${Math.round(weightedViewData.monthNames.reduce((s, m) => s + (overheadsTotalsByMonth[m] || 0), 0)).toLocaleString()}
                    </td>
                  </tr>
                )}
                </tbody>
              </table>
            </div>
            {/* Freelancer Costs Section */}
            <div className="mt-8 bg-white p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Freelancers</h3>
              <p className="text-sm text-gray-600 mb-4">Track monthly freelancer costs by department</p>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      <th className="px-4 py-3 text-left w-48">Department</th>
                      {weightedViewData.monthNames.map(m => (
                        <th key={`fl-h-${m}`} className="px-3 py-3 text-center w-32 min-w-[8rem] bg-[#e4edf9] text-[#223bb2]">{m}</th>
                      ))}
                      <th className="px-4 py-3 text-right w-32 bg-[#e4edf9] text-[#223bb2] border-l-2 border-gray-300">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DEPARTMENT_OPTIONS.map(dept => {
                      const deptCosts = freelancerCosts[dept] || {};
                      const deptTotal = weightedViewData.monthNames.reduce((sum, m) => sum + (deptCosts[m] || 0), 0);
                      
                      return (
                        <tr key={dept} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-2 font-medium text-gray-900">{dept}</td>
                          {weightedViewData.monthNames.map(m => (
                            <td key={`fl-${dept}-${m}`} className="px-2 py-2 text-center">
                              <Input
                                value={deptCosts[m] ? `$${deptCosts[m].toLocaleString()}` : ''}
                                onChange={(e) => handleFreelancerCostChange(dept, m, e.target.value)}
                                className="text-center w-full"
                                placeholder="$0"
                              />
                            </td>
                          ))}
                          <td className="px-4 py-2 text-right font-semibold border-l-2 border-gray-200">
                            ${deptTotal.toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                    {/* Total Row */}
                    <tr className="bg-gray-100 border-t-2 border-gray-400">
                      <td className="px-4 py-3 font-bold text-gray-900">Total</td>
                      {weightedViewData.monthNames.map(m => {
                        const monthTotal = DEPARTMENT_OPTIONS.reduce((sum, dept) => {
                          return sum + ((freelancerCosts[dept] || {})[m] || 0);
                        }, 0);
                        return (
                          <td key={`fl-total-${m}`} className="px-3 py-3 text-center font-bold bg-[#f6f9ff] text-[#223bb2]">
                            ${monthTotal.toLocaleString()}
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 text-right font-bold bg-[#e4edf9] text-[#223bb2] border-l-2 border-gray-300">
                        ${(() => {
                          const grandTotal = DEPARTMENT_OPTIONS.reduce((sum, dept) => {
                            return sum + weightedViewData.monthNames.reduce((deptSum, m) => {
                              return deptSum + ((freelancerCosts[dept] || {})[m] || 0);
                            }, 0);
                          }, 0);
                          return grandTotal.toLocaleString();
                        })()}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
        {isAdminMode && adminView === 'annualPlan' && (
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 space-y-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Annual Plan - Client Summary</h2>
              <div className="flex items-center gap-2">
                {annualPlanSaveStatus === 'saving' && (
                  <span className="text-sm text-gray-500">Saving...</span>
                )}
                {annualPlanSaveStatus === 'saved' && (
                  <span className="text-sm text-green-600 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Saved
                  </span>
                )}
              </div>
            </div>
            <div className="mb-4">
              <p className="text-sm text-gray-600">Edit Plan Fees and Plan Revenue; Actuals are auto-calculated from Pipeline with weighting.</p>
            </div>

            {/* Summary Metrics */}
            {(() => {
              let totalPlanFees = 0;
              Object.values(annualPlanEntries).forEach(v => {
                totalPlanFees += v.planFees || 0;
              });

              let totalConfirmedFees = 0;
              entries.forEach(entry => {
                const statusKey = (entry.status || '').toLowerCase();
                if (statusKey === 'confirmed') {
                  totalConfirmedFees += entry.totalFees || 0;
                }
              });

              const percentOfPlan = totalPlanFees > 0 ? Math.min(100, (totalConfirmedFees / totalPlanFees) * 100) : 0;

              const today = new Date();
              const startOfYear = new Date(today.getFullYear(), 0, 1);
              const daysPassed = Math.floor((today.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)) + 1;
              const percentOfYear = Math.min(100, (daysPassed / 365) * 100);

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
                    <dt className="text-sm font-medium text-gray-500 mb-2">% of Plan</dt>
                    <dd className="metric-value text-blue-600 mb-4">{percentOfPlan.toFixed(0)}%</dd>
                    <div className="h-2 w-full bg-gray-200 rounded">
                      <div
                        className="h-2 bg-blue-600 rounded"
                        style={{ width: `${percentOfPlan}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">Confirmed Fees vs Annual Plan</p>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
                    <dt className="text-sm font-medium text-gray-500 mb-2">% of Year Complete</dt>
                    <dd className="metric-value text-green-600 mb-4">{percentOfYear.toFixed(0)}%</dd>
                    <div className="h-2 w-full bg-gray-200 rounded">
                      <div
                        className="h-2 bg-green-500 rounded"
                        style={{ width: `${percentOfYear}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">{daysPassed} of 365 days</p>
                  </div>
                </div>
              );
            })()}

            {/* % of Plan vs Year by Client */}
            <div className="mb-8">
              <button
                onClick={() => setShowPlanVsYear(!showPlanVsYear)}
                className="w-full flex items-center justify-between bg-blue-100 hover:bg-blue-200 px-4 py-3 rounded-lg mb-2 transition-colors"
              >
                <h3 className="text-lg font-semibold text-gray-900">% of Plan vs Year by Client</h3>
                <svg
                  className={`w-5 h-5 text-gray-700 transition-transform ${showPlanVsYear ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {showPlanVsYear && (
                <div className="bg-white p-4">
                  {(() => {
                    // Calculate % of Year once
                    const today = new Date();
                    const startOfYear = new Date(today.getFullYear(), 0, 1);
                    const daysPassed = Math.floor((today.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                    const percentOfYear = (daysPassed / 365) * 100;

                    // Calculate confirmed fees by client
                    const confirmedFeesByClient: { [client: string]: number } = {};
                    entries.forEach(entry => {
                      const statusKey = (entry.status || '').toLowerCase();
                      if (statusKey === 'confirmed') {
                        const client = entry.client;
                        if (!confirmedFeesByClient[client]) {
                          confirmedFeesByClient[client] = 0;
                        }
                        confirmedFeesByClient[client] += entry.totalFees || 0;
                      }
                    });

                    // Helper to get billing entity for a client
                    const getClientBillingEntity = (clientName: string): 'Salt XC Canada' | 'Salt XC US' => {
                      const setting = clientSettings.find(c => c.name === clientName);
                      return setting?.billingEntity || 'Salt XC Canada';
                    };

                    // Get all clients with plan or confirmed fees, sorted alphabetically with Other at the end
                    const sortClientsWithOtherAtEnd = (clients: string[]) => {
                      const regular = clients.filter(c => !c.startsWith('Other -') && !c.startsWith('NBD -')).sort();
                      const others = clients.filter(c => c.startsWith('Other -') || c.startsWith('NBD -')).sort();
                      return [...regular, ...others];
                    };

                    const allClients = sortClientsWithOtherAtEnd(
                      CLIENT_LIST.filter(c => {
                        const planFees = annualPlanEntries[c]?.planFees || 0;
                        const confirmedFees = confirmedFeesByClient[c] || 0;
                        return planFees > 0 || confirmedFees > 0;
                      })
                    );

                    // Group clients by billing entity
                    const canadaClients = allClients.filter(c => getClientBillingEntity(c) === 'Salt XC Canada');
                    const usClients = allClients.filter(c => getClientBillingEntity(c) === 'Salt XC US');

                    const renderClientRow = (client: string) => {
                      const planFees = annualPlanEntries[client]?.planFees || 0;
                      const confirmedFees = confirmedFeesByClient[client] || 0;
                      const percentOfPlan = planFees > 0 ? (confirmedFees / planFees * 100) : 0;

                      // Determine if on track (% of Plan should be >= % of Year)
                      const isOnTrack = percentOfPlan >= percentOfYear;

                      return (
                        <div key={client} className="flex items-center gap-3 py-1.5 border-b border-gray-100 last:border-0">
                          <span className="text-sm font-medium text-gray-900 w-32 flex-shrink-0">{client}</span>
                          <span className={`text-sm font-semibold ${isOnTrack ? 'text-green-600' : 'text-red-600'} w-24 text-right`}>
                            {percentOfPlan.toFixed(1)}%
                          </span>
                          <span className="text-sm text-gray-600 w-24 text-right">
                            {percentOfYear.toFixed(1)}%
                          </span>
                        </div>
                      );
                    };

                    return (
                      <div className="flex gap-6">
                        {/* Salt XC Canada Column */}
                        <div className="flex-1">
                          <div className="bg-black text-white px-3 py-2 rounded mb-2">
                            <h4 className="text-sm font-bold">Salt XC Canada</h4>
                          </div>
                          <div className="flex items-center gap-3 pb-2 mb-2 border-b-2 border-gray-300">
                            <span className="text-xs font-semibold text-gray-600 w-32 flex-shrink-0">Client</span>
                            <span className="text-xs font-semibold text-gray-600 w-24 text-right">% of Plan</span>
                            <span className="text-xs font-semibold text-gray-600 w-24 text-right">% of Year</span>
                          </div>
                          <div>
                            {canadaClients.length > 0 ? (
                              canadaClients.map(renderClientRow)
                            ) : (
                              <div className="text-sm text-gray-500 py-4 text-center">No clients</div>
                            )}
                          </div>
                        </div>

                        {/* Salt XC US Column */}
                        <div className="flex-1">
                          <div className="bg-black text-white px-3 py-2 rounded mb-2">
                            <h4 className="text-sm font-bold">Salt XC US</h4>
                          </div>
                          <div className="flex items-center gap-3 pb-2 mb-2 border-b-2 border-gray-300">
                            <span className="text-xs font-semibold text-gray-600 w-32 flex-shrink-0">Client</span>
                            <span className="text-xs font-semibold text-gray-600 w-24 text-right">% of Plan</span>
                            <span className="text-xs font-semibold text-gray-600 w-24 text-right">% of Year</span>
                          </div>
                          <div>
                            {usClients.length > 0 ? (
                              usClients.map(renderClientRow)
                            ) : (
                              <div className="text-sm text-gray-500 py-4 text-center">No clients</div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Chart Visualization */}
            <div className="mb-8">
              <button
                onClick={() => setShowAnnualPlanChart(!showAnnualPlanChart)}
                className="w-full flex items-center justify-between bg-blue-100 hover:bg-blue-200 px-4 py-3 rounded-lg mb-2 transition-colors"
              >
                <h3 className="text-lg font-semibold text-gray-900">Annual Plan vs Weighted (Visual)</h3>
                <svg
                  className={`w-5 h-5 text-gray-700 transition-transform ${showAnnualPlanChart ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {showAnnualPlanChart && (
              <div className="bg-white p-4 overflow-x-auto">
                {(() => {
                  const weightByStatus: Record<string, number> = {
                    'confirmed': 1.0,
                    'open': 0.9,
                    'high pitch': 0.75,
                    'medium pitch': 0.5,
                    'low pitch': 0.1,
                    'whitespace': 0
                  };

                  // Calculate actual fees by client
                  const actualsByClient: { [client: string]: { actualFees: number } } = {};
                  entries.forEach(entry => {
                    const client = entry.client;
                    if (!actualsByClient[client]) {
                      actualsByClient[client] = { actualFees: 0 };
                    }
                    const statusKey = (entry.status || '').toLowerCase();
                    const weight = weightByStatus[statusKey] ?? 0;
                    actualsByClient[client].actualFees += (entry.totalFees || 0) * weight;
                  });

                  // Helper to get billing entity for a client
                  const getClientBillingEntity = (clientName: string): 'Salt XC Canada' | 'Salt XC US' => {
                    const setting = clientSettings.find(c => c.name === clientName);
                    return setting?.billingEntity || 'Salt XC Canada';
                  };

                  // Group clients by billing entity with custom sort
                  const sortClientsWithOtherAtEnd = (clients: string[]) => {
                    const regular = clients.filter(c => !c.startsWith('Other -') && !c.startsWith('NBD -')).sort();
                    const others = clients.filter(c => c.startsWith('Other -') || c.startsWith('NBD -')).sort();
                    return [...regular, ...others];
                  };

                  const canadaClients = sortClientsWithOtherAtEnd(
                    CLIENT_LIST.filter(c => {
                    const planFees = annualPlanEntries[c]?.planFees || 0;
                    const actualFees = actualsByClient[c]?.actualFees || 0;
                      return (planFees > 0 || actualFees > 0) && getClientBillingEntity(c) === 'Salt XC Canada';
                    })
                  );

                  const usClients = sortClientsWithOtherAtEnd(
                    CLIENT_LIST.filter(c => {
                      const planFees = annualPlanEntries[c]?.planFees || 0;
                      const actualFees = actualsByClient[c]?.actualFees || 0;
                      return (planFees > 0 || actualFees > 0) && getClientBillingEntity(c) === 'Salt XC US';
                    })
                  );

                  // Find max value for scaling across all clients
                  const allClients = [...canadaClients, ...usClients];
                  const maxValue = Math.max(
                    ...allClients.map(c => Math.max(
                      annualPlanEntries[c]?.planFees || 0,
                      actualsByClient[c]?.actualFees || 0
                    ))
                  );
                  const renderClientRow = (client: string) => {
                    const planFees = annualPlanEntries[client]?.planFees || 0;
                    const actualFees = actualsByClient[client]?.actualFees || 0;
                    const variance = planFees > 0 ? ((actualFees - planFees) / planFees * 100) : 0;
                    const varianceColor = variance >= 0 ? 'text-green-600' : 'text-red-600';

                    return (
                      <div key={client} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                        {/* Client Name - Fixed width */}
                        <div className="w-32 flex-shrink-0">
                          <span className="text-xs font-semibold text-gray-700">{client}</span>
                        </div>
                        
                        {/* Plan Bar */}
                        <div className="flex items-center gap-2 w-80 flex-shrink-0">
                          <span className="text-[10px] text-gray-500 w-10 text-right">Plan</span>
                          <div className="flex-1 bg-gray-200 rounded h-5 relative overflow-hidden">
                            <div 
                              className="bg-blue-600 h-full flex items-center justify-end pr-2"
                              style={{ width: `${maxValue > 0 ? (planFees / maxValue * 100) : 0}%`, minWidth: planFees > 0 ? '20px' : '0' }}
                                >
                                  {planFees > 0 && (
                                <span className="text-[10px] font-semibold text-white whitespace-nowrap">
                                  ${Math.round(planFees / 1000)}k
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                        {/* Actual Bar */}
                        <div className="flex items-center gap-2 w-80 flex-shrink-0">
                          <span className="text-[10px] text-gray-500 w-10 text-right">Actual</span>
                          <div className="flex-1 bg-gray-200 rounded h-5 relative overflow-hidden">
                            <div 
                              className="bg-teal-500 h-full flex items-center justify-end pr-2"
                              style={{ width: `${maxValue > 0 ? (actualFees / maxValue * 100) : 0}%`, minWidth: actualFees > 0 ? '20px' : '0' }}
                                >
                                  {actualFees > 0 && (
                                <span className="text-[10px] font-semibold text-white whitespace-nowrap">
                                  ${Math.round(actualFees / 1000)}k
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                        {/* Variance */}
                        <div className="w-20 flex-shrink-0 text-right">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${varianceColor}`}>
                            {planFees > 0 ? `${variance > 0 ? '+' : ''}${variance.toFixed(0)}%` : '—'}
                            {planFees > 0 && (
                              <svg width="12" height="12" viewBox="0 0 12 12" className="inline-block">
                                <circle cx="6" cy="6" r="6" fill={variance >= 0 ? '#16a34a' : '#dc2626'} />
                              </svg>
                            )}
                          </span>
                          </div>
                        </div>
                    );
                  };

                  return (
                    <div className="space-y-6 min-w-[900px]">
                      {/* Salt XC Canada Section */}
                      {canadaClients.length > 0 && (
                        <div>
                          <h4 className="text-sm font-bold text-white bg-black px-3 py-1.5 mb-3 rounded">Salt XC Canada</h4>
                          <div>
                            {canadaClients.map(renderClientRow)}
                          </div>
                        </div>
                      )}

                      {/* Salt XC US Section */}
                      {usClients.length > 0 && (
                        <div>
                          <h4 className="text-sm font-bold text-white bg-black px-3 py-1.5 mb-3 rounded">Salt XC US</h4>
                          <div>
                            {usClients.map(renderClientRow)}
                          </div>
                        </div>
                      )}
                      </div>
                    );
                })()}
              </div>
              )}
            </div>
            
            {/* Table 1: Annual Plan vs Weighted Details */}
            <div className="mb-8">
              <button
                onClick={() => setShowAnnualPlanTable1(!showAnnualPlanTable1)}
                className="w-full flex items-center justify-between bg-blue-100 hover:bg-blue-200 px-4 py-3 rounded-lg mb-2 transition-colors"
              >
                <h3 className="text-lg font-semibold text-gray-900">Annual Plan vs Weighted (Table)</h3>
                <svg
                  className={`w-5 h-5 text-gray-700 transition-transform ${showAnnualPlanTable1 ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {showAnnualPlanTable1 && (
              <div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                    <th className="px-3 py-1.5 text-right text-xs font-bold text-gray-500 uppercase tracking-wider bg-blue-50">Plan - Fees</th>
                    <th className="px-3 py-1.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actual - Fees</th>
                    <th className="px-3 py-1.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">% Var</th>
                    <th className="px-3 py-1.5 text-right text-xs font-bold text-gray-500 uppercase tracking-wider bg-blue-50">Plan - Revenue</th>
                    <th className="px-3 py-1.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actual - Revenue</th>
                    <th className="px-3 py-1.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">% Var</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {(() => {
                    const weightByStatus: Record<string, number> = {
                      'confirmed': 1.0,
                      'open': 0.9,
                      'high pitch': 0.75,
                      'medium pitch': 0.5,
                      'low pitch': 0.1,
                      'whitespace': 0
                    };

                    // Calculate actual fees and revenue by client from pipeline entries
                    const actualsByClient: { [client: string]: { actualFees: number; actualRevenue: number } } = {};
                    entries.forEach(entry => {
                      if (!actualsByClient[entry.client]) {
                        actualsByClient[entry.client] = { actualFees: 0, actualRevenue: 0 };
                      }
                      const statusKey = (entry.status || '').toLowerCase();
                      const weight = weightByStatus[statusKey] ?? 0;
                      actualsByClient[entry.client].actualFees += (entry.totalFees || 0) * weight;
                      actualsByClient[entry.client].actualRevenue += (entry.revenue || 0) * weight;
                    });

                    // Helper to get billing entity for a client
                    const getClientBillingEntity = (clientName: string): 'Salt XC Canada' | 'Salt XC US' => {
                      const setting = clientSettings.find(c => c.name === clientName);
                      return setting?.billingEntity || 'Salt XC Canada';
                    };

                    // Sort clients: alphabetically with "Other" and "NBD" at the bottom
                    const regularClients = CLIENT_LIST.filter(c => !c.startsWith('Other -') && !c.startsWith('NBD -')).sort();
                    const otherClients = CLIENT_LIST.filter(c => c.startsWith('Other -') || c.startsWith('NBD -')).sort();
                    const sortedClients = [...regularClients, ...otherClients];
                    
                    // Group clients by billing entity
                    const canadaClients = sortedClients.filter(c => getClientBillingEntity(c) === 'Salt XC Canada');
                    const usClients = sortedClients.filter(c => getClientBillingEntity(c) === 'Salt XC US');

                    const renderClientRows = (clients: string[]) => clients.map(client => {
                      const planFees = annualPlanEntries[client]?.planFees || 0;
                      const planRevenue = annualPlanEntries[client]?.planRevenue || 0;
                      const actualFees = actualsByClient[client]?.actualFees || 0;
                      const actualRevenue = actualsByClient[client]?.actualRevenue || 0;
                      
                      const feesVariance = planFees > 0 
                        ? ((actualFees - planFees) / planFees * 100) 
                        : 0;
                      const revenueVariance = planRevenue > 0 
                        ? ((actualRevenue - planRevenue) / planRevenue * 100) 
                        : 0;
                      
                      return (
                        <tr key={client} className="hover:bg-gray-50">
                          <td className="px-3 py-1 whitespace-nowrap text-sm font-medium text-gray-900">{client}</td>
                          <td className="px-3 py-1 whitespace-nowrap text-sm text-right font-bold bg-blue-50">
                            <div className="relative inline-block">
                              <span className="absolute left-1 top-1/2 -translate-y-1/2 text-gray-500 text-xs">$</span>
                              <input
                                type="text"
                                className="w-28 pl-5 pr-1 py-0.5 text-sm text-right font-bold border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
                                value={planFees ? planFees.toLocaleString() : ''}
                                onChange={(e) => {
                                  const numeric = e.target.value.replace(/[^0-9]/g, '');
                                  setAnnualPlanEntries(prev => ({
                                    ...prev,
                                    [client]: { ...prev[client], planFees: Number(numeric || 0), planRevenue: prev[client]?.planRevenue || 0 }
                                  }));
                                }}
                                placeholder="0"
                              />
                            </div>
                          </td>
                          <td className="px-3 py-1 whitespace-nowrap text-sm text-right text-gray-900">${actualFees.toLocaleString()}</td>
                          <td className={`px-3 py-1 whitespace-nowrap text-sm text-right font-semibold ${
                            feesVariance > 0 ? 'text-green-600' : feesVariance < 0 ? 'text-red-600' : 'text-gray-900'
                          }`}>
                            <span className="inline-flex items-center gap-1.5">
                            {planFees > 0 ? `${feesVariance > 0 ? '+' : ''}${feesVariance.toFixed(1)}%` : '—'}
                              {planFees > 0 && (
                                <svg width="12" height="12" viewBox="0 0 12 12" className="inline-block">
                                  <circle cx="6" cy="6" r="6" fill={feesVariance >= 0 ? '#16a34a' : '#dc2626'} />
                                </svg>
                              )}
                            </span>
                          </td>
                          <td className="px-3 py-1 whitespace-nowrap text-sm text-right font-bold bg-blue-50">
                            <div className="relative inline-block">
                              <span className="absolute left-1 top-1/2 -translate-y-1/2 text-gray-500 text-xs">$</span>
                              <input
                                type="text"
                                className="w-28 pl-5 pr-1 py-0.5 text-sm text-right font-bold border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
                                value={planRevenue ? planRevenue.toLocaleString() : ''}
                                onChange={(e) => {
                                  const numeric = e.target.value.replace(/[^0-9]/g, '');
                                  setAnnualPlanEntries(prev => ({
                                    ...prev,
                                    [client]: { planFees: prev[client]?.planFees || 0, planRevenue: Number(numeric || 0) }
                                  }));
                                }}
                                placeholder="0"
                              />
                            </div>
                          </td>
                          <td className="px-3 py-1 whitespace-nowrap text-sm text-right text-gray-900">${actualRevenue.toLocaleString()}</td>
                          <td className={`px-3 py-1 whitespace-nowrap text-sm text-right font-semibold ${
                            revenueVariance > 0 ? 'text-green-600' : revenueVariance < 0 ? 'text-red-600' : 'text-gray-900'
                          }`}>
                            <span className="inline-flex items-center gap-1.5">
                            {planRevenue > 0 ? `${revenueVariance > 0 ? '+' : ''}${revenueVariance.toFixed(1)}%` : '—'}
                              {planRevenue > 0 && (
                                <svg width="12" height="12" viewBox="0 0 12 12" className="inline-block">
                                  <circle cx="6" cy="6" r="6" fill={revenueVariance >= 0 ? '#16a34a' : '#dc2626'} />
                                </svg>
                              )}
                            </span>
                          </td>
                        </tr>
                      );
                    });

                    const calculateSubtotal = (clients: string[]) => {
                      let subtotalPlanFees = 0;
                      let subtotalActualFees = 0;
                      let subtotalPlanRevenue = 0;
                      let subtotalActualRevenue = 0;

                      clients.forEach(client => {
                        subtotalPlanFees += annualPlanEntries[client]?.planFees || 0;
                        subtotalPlanRevenue += annualPlanEntries[client]?.planRevenue || 0;
                        subtotalActualFees += actualsByClient[client]?.actualFees || 0;
                        subtotalActualRevenue += actualsByClient[client]?.actualRevenue || 0;
                      });

                      const feesVariance = subtotalPlanFees > 0 
                        ? ((subtotalActualFees - subtotalPlanFees) / subtotalPlanFees * 100) 
                        : 0;
                      const revenueVariance = subtotalPlanRevenue > 0 
                        ? ((subtotalActualRevenue - subtotalPlanRevenue) / subtotalPlanRevenue * 100) 
                        : 0;

                      return { subtotalPlanFees, subtotalActualFees, subtotalPlanRevenue, subtotalActualRevenue, feesVariance, revenueVariance };
                    };

                    const canadaSubtotal = calculateSubtotal(canadaClients);
                    const usSubtotal = calculateSubtotal(usClients);

                    return (
                      <>
                        {/* Salt XC Canada Section Header */}
                        <tr className="bg-black">
                          <td colSpan={7} className="px-3 py-2 text-sm font-bold text-white">
                            Salt XC Canada
                          </td>
                        </tr>
                        {renderClientRows(canadaClients)}
                        {/* Canada Subtotal */}
                        <tr className="bg-blue-200 font-semibold border-t border-gray-300">
                          <td className="px-3 py-1.5 whitespace-nowrap text-sm text-gray-900">Canada Subtotal</td>
                          <td className="px-3 py-1.5 whitespace-nowrap text-sm text-right font-bold text-gray-900 bg-blue-200">${canadaSubtotal.subtotalPlanFees.toLocaleString()}</td>
                          <td className="px-3 py-1.5 whitespace-nowrap text-sm text-right text-gray-900">${canadaSubtotal.subtotalActualFees.toLocaleString()}</td>
                          <td className={`px-3 py-1.5 whitespace-nowrap text-sm text-right ${
                            canadaSubtotal.feesVariance > 0 ? 'text-green-600' : canadaSubtotal.feesVariance < 0 ? 'text-red-600' : 'text-gray-900'
                          }`}>
                            <span className="inline-flex items-center gap-1.5">
                              {canadaSubtotal.feesVariance > 0 ? '+' : ''}{canadaSubtotal.feesVariance.toFixed(1)}%
                              <svg width="12" height="12" viewBox="0 0 12 12" className="inline-block">
                                <circle cx="6" cy="6" r="6" fill={canadaSubtotal.feesVariance >= 0 ? '#16a34a' : '#dc2626'} />
                              </svg>
                            </span>
                          </td>
                          <td className="px-3 py-1.5 whitespace-nowrap text-sm text-right font-bold text-gray-900 bg-blue-200">${canadaSubtotal.subtotalPlanRevenue.toLocaleString()}</td>
                          <td className="px-3 py-1.5 whitespace-nowrap text-sm text-right text-gray-900">${canadaSubtotal.subtotalActualRevenue.toLocaleString()}</td>
                          <td className={`px-3 py-1.5 whitespace-nowrap text-sm text-right ${
                            canadaSubtotal.revenueVariance > 0 ? 'text-green-600' : canadaSubtotal.revenueVariance < 0 ? 'text-red-600' : 'text-gray-900'
                          }`}>
                            <span className="inline-flex items-center gap-1.5">
                              {canadaSubtotal.revenueVariance > 0 ? '+' : ''}{canadaSubtotal.revenueVariance.toFixed(1)}%
                              <svg width="12" height="12" viewBox="0 0 12 12" className="inline-block">
                                <circle cx="6" cy="6" r="6" fill={canadaSubtotal.revenueVariance >= 0 ? '#16a34a' : '#dc2626'} />
                              </svg>
                            </span>
                          </td>
                        </tr>

                        {/* Salt XC US Section Header */}
                        <tr className="bg-black">
                          <td colSpan={7} className="px-3 py-2 text-sm font-bold text-white">
                            Salt XC US
                          </td>
                        </tr>
                        {renderClientRows(usClients)}
                        {/* US Subtotal */}
                        <tr className="bg-blue-200 font-semibold border-t border-gray-300">
                          <td className="px-3 py-1.5 whitespace-nowrap text-sm text-gray-900">US Subtotal</td>
                          <td className="px-3 py-1.5 whitespace-nowrap text-sm text-right font-bold text-gray-900 bg-blue-200">${usSubtotal.subtotalPlanFees.toLocaleString()}</td>
                          <td className="px-3 py-1.5 whitespace-nowrap text-sm text-right text-gray-900">${usSubtotal.subtotalActualFees.toLocaleString()}</td>
                          <td className={`px-3 py-1.5 whitespace-nowrap text-sm text-right ${
                            usSubtotal.feesVariance > 0 ? 'text-green-600' : usSubtotal.feesVariance < 0 ? 'text-red-600' : 'text-gray-900'
                          }`}>
                            <span className="inline-flex items-center gap-1.5">
                              {usSubtotal.feesVariance > 0 ? '+' : ''}{usSubtotal.feesVariance.toFixed(1)}%
                              <svg width="12" height="12" viewBox="0 0 12 12" className="inline-block">
                                <circle cx="6" cy="6" r="6" fill={usSubtotal.feesVariance >= 0 ? '#16a34a' : '#dc2626'} />
                              </svg>
                            </span>
                          </td>
                          <td className="px-3 py-1.5 whitespace-nowrap text-sm text-right font-bold text-gray-900 bg-blue-200">${usSubtotal.subtotalPlanRevenue.toLocaleString()}</td>
                          <td className="px-3 py-1.5 whitespace-nowrap text-sm text-right text-gray-900">${usSubtotal.subtotalActualRevenue.toLocaleString()}</td>
                          <td className={`px-3 py-1.5 whitespace-nowrap text-sm text-right ${
                            usSubtotal.revenueVariance > 0 ? 'text-green-600' : usSubtotal.revenueVariance < 0 ? 'text-red-600' : 'text-gray-900'
                          }`}>
                            <span className="inline-flex items-center gap-1.5">
                              {usSubtotal.revenueVariance > 0 ? '+' : ''}{usSubtotal.revenueVariance.toFixed(1)}%
                              <svg width="12" height="12" viewBox="0 0 12 12" className="inline-block">
                                <circle cx="6" cy="6" r="6" fill={usSubtotal.revenueVariance >= 0 ? '#16a34a' : '#dc2626'} />
                              </svg>
                            </span>
                          </td>
                        </tr>
                      </>
                    );
                  })()}
                  {/* Grand Total Row */}
                  {(() => {
                    let totalPlanFees = 0;
                    let totalActualFees = 0;
                    let totalPlanRevenue = 0;
                    let totalActualRevenue = 0;

                    // Sum plans from annualPlanEntries
                    Object.values(annualPlanEntries).forEach(v => {
                      totalPlanFees += v.planFees || 0;
                      totalPlanRevenue += v.planRevenue || 0;
                    });

                    const weightByStatus: Record<string, number> = {
                      'confirmed': 1.0,
                      'open': 0.9,
                      'high pitch': 0.75,
                      'medium pitch': 0.5,
                      'low pitch': 0.1,
                      'whitespace': 0
                    };
                    // Sum weighted actuals from entries
                    entries.forEach(entry => {
                      const statusKey = (entry.status || '').toLowerCase();
                      const weight = weightByStatus[statusKey] ?? 0;
                      totalActualFees += (entry.totalFees || 0) * weight;
                      totalActualRevenue += (entry.revenue || 0) * weight;
                    });
                    
                    const totalFeesVariance = totalPlanFees > 0 
                      ? ((totalActualFees - totalPlanFees) / totalPlanFees * 100) 
                      : 0;
                    const totalRevenueVariance = totalPlanRevenue > 0 
                      ? ((totalActualRevenue - totalPlanRevenue) / totalPlanRevenue * 100) 
                      : 0;
                    
                    return (
                      <tr className="bg-blue-300 font-bold border-t-2 border-gray-300">
                        <td className="px-3 py-1.5 whitespace-nowrap text-sm text-gray-900">GRAND TOTAL</td>
                        <td className="px-3 py-1.5 whitespace-nowrap text-sm text-right font-bold text-gray-900 bg-blue-300">${totalPlanFees.toLocaleString()}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap text-sm text-right text-gray-900">${totalActualFees.toLocaleString()}</td>
                        <td className={`px-3 py-1.5 whitespace-nowrap text-sm text-right ${
                          totalFeesVariance > 0 ? 'text-green-600' : totalFeesVariance < 0 ? 'text-red-600' : 'text-gray-900'
                        }`}>
                          <span className="inline-flex items-center gap-1.5">
                          {totalFeesVariance > 0 ? '+' : ''}{totalFeesVariance.toFixed(1)}%
                            <svg width="12" height="12" viewBox="0 0 12 12" className="inline-block">
                              <circle cx="6" cy="6" r="6" fill={totalFeesVariance >= 0 ? '#16a34a' : '#dc2626'} />
                            </svg>
                          </span>
                        </td>
                        <td className="px-3 py-1.5 whitespace-nowrap text-sm text-right font-bold text-gray-900 bg-blue-300">${totalPlanRevenue.toLocaleString()}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap text-sm text-right text-gray-900">${totalActualRevenue.toLocaleString()}</td>
                        <td className={`px-3 py-1.5 whitespace-nowrap text-sm text-right ${
                          totalRevenueVariance > 0 ? 'text-green-600' : totalRevenueVariance < 0 ? 'text-red-600' : 'text-gray-900'
                        }`}>
                          <span className="inline-flex items-center gap-1.5">
                          {totalRevenueVariance > 0 ? '+' : ''}{totalRevenueVariance.toFixed(1)}%
                            <svg width="12" height="12" viewBox="0 0 12 12" className="inline-block">
                              <circle cx="6" cy="6" r="6" fill={totalRevenueVariance >= 0 ? '#16a34a' : '#dc2626'} />
                            </svg>
                          </span>
                        </td>
                      </tr>
                    );
                  })()}
                </tbody>
              </table>
            </div>
            
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-xs text-blue-800">
                <strong>Note:</strong> Actuals are weighted by status (Confirmed 100%, Open 90%, High Pitch 75%, Medium Pitch 50%, Low Pitch 10%, Whitespace 0%). Variance = (Actual - Plan) / Plan × 100.
              </p>
            </div>
              </div>
              )}
            </div>

            {/* Table 2: Annual Plan vs Potential & Weighted */}
            <div className="mb-8">
              <button
                onClick={() => setShowAnnualPlanTable2(!showAnnualPlanTable2)}
                className="w-full flex items-center justify-between bg-blue-100 hover:bg-blue-200 px-4 py-3 rounded-lg mb-2 transition-colors"
              >
                <h3 className="text-lg font-semibold text-gray-900">Annual Plan vs Potential & Weighted</h3>
                <svg
                  className={`w-5 h-5 text-gray-700 transition-transform ${showAnnualPlanTable2 ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {showAnnualPlanTable2 && (
              <div>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                      <th className="px-3 py-1.5 text-right text-xs font-bold text-gray-500 uppercase tracking-wider bg-blue-50">Plan Fees</th>
                      <th className="px-3 py-1.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Potential Fees</th>
                      <th className="px-3 py-1.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Weighted Fees</th>
                      <th className="px-3 py-1.5 text-right text-xs font-bold text-gray-500 uppercase tracking-wider bg-blue-50">Plan Revenue</th>
                      <th className="px-3 py-1.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Potential Revenue</th>
                      <th className="px-3 py-1.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Weighted Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {(() => {
                      // Calculate fees and revenue by client
                      const dataByClient: { [client: string]: { 
                        potentialFees: number; 
                        weightedFees: number;
                        potentialRevenue: number;
                        weightedRevenue: number;
                      } } = {};
                      
                      const weightByStatus: Record<string, number> = {
                        'confirmed': 1.0,
                        'open': 0.9,
                        'high pitch': 0.75,
                        'medium pitch': 0.5,
                        'low pitch': 0.1,
                        'whitespace': 0
                      };
                      
                      entries.forEach(entry => {
                        const client = entry.client;
                        if (!dataByClient[client]) {
                          dataByClient[client] = { 
                            potentialFees: 0, 
                            weightedFees: 0,
                            potentialRevenue: 0,
                            weightedRevenue: 0
                          };
                        }
                        
                        const fees = entry.totalFees || 0;
                        const revenue = entry.revenue || 0;
                        dataByClient[client].potentialFees += fees;
                        dataByClient[client].potentialRevenue += revenue;
                        
                        const statusKey = (entry.status || '').toLowerCase();
                        const weight = weightByStatus[statusKey] ?? 0;
                        dataByClient[client].weightedFees += fees * weight;
                        dataByClient[client].weightedRevenue += revenue * weight;
                      });

                      // Sort clients: alphabetically with "Other" and "NBD" at the bottom
                      const regularClients = CLIENT_LIST.filter(c => !c.startsWith('Other -') && !c.startsWith('NBD -')).sort();
                      const otherClients = CLIENT_LIST.filter(c => c.startsWith('Other -') || c.startsWith('NBD -')).sort();
                      const sortedClients = [...regularClients, ...otherClients];

                      // Helper to get billing entity for a client
                      const getClientBillingEntity = (clientName: string): 'Salt XC Canada' | 'Salt XC US' => {
                        const setting = clientSettings.find(c => c.name === clientName);
                        return setting?.billingEntity || 'Salt XC Canada';
                      };

                      // Group clients by billing entity
                      const canadaClients = sortedClients.filter(c => getClientBillingEntity(c) === 'Salt XC Canada');
                      const usClients = sortedClients.filter(c => getClientBillingEntity(c) === 'Salt XC US');

                      const renderClientRows = (clients: string[]) => clients.map(client => {
                        const planFees = annualPlanEntries[client]?.planFees || 0;
                        const planRevenue = annualPlanEntries[client]?.planRevenue || 0;
                        const potentialFees = dataByClient[client]?.potentialFees || 0;
                        const weightedFees = dataByClient[client]?.weightedFees || 0;
                        const potentialRevenue = dataByClient[client]?.potentialRevenue || 0;
                        const weightedRevenue = dataByClient[client]?.weightedRevenue || 0;

                        // Calculate percentages for color coding
                        const potentialFeesPercent = planFees > 0 ? (potentialFees / planFees) * 100 : 0;
                        const weightedFeesPercent = planFees > 0 ? (weightedFees / planFees) * 100 : 0;
                        const potentialRevenuePercent = planRevenue > 0 ? (potentialRevenue / planRevenue) * 100 : 0;
                        const weightedRevenuePercent = planRevenue > 0 ? (weightedRevenue / planRevenue) * 100 : 0;

                        // Helper function to get color class (no background)
                        const getColorClass = (percent: number) => {
                          if (percent >= 90) return 'text-green-700';
                          if (percent >= 65) return 'text-orange-600';
                          return 'text-red-700';
                        };

                        // Helper function to get circle color
                        const getCircleColor = (percent: number) => {
                          if (percent >= 90) return '#15803d'; // green-700
                          if (percent >= 65) return '#ea580c'; // orange-600
                          return '#b91c1c'; // red-700
                        };

                        const potentialFeesColor = (planFees > 0 && potentialFees > 0) ? getColorClass(potentialFeesPercent) : 'text-gray-400';
                        const weightedFeesColor = (planFees > 0 && weightedFees > 0) ? getColorClass(weightedFeesPercent) : 'text-gray-400';
                        const potentialRevenueColor = (planRevenue > 0 && potentialRevenue > 0) ? getColorClass(potentialRevenuePercent) : 'text-gray-400';
                        const weightedRevenueColor = (planRevenue > 0 && weightedRevenue > 0) ? getColorClass(weightedRevenuePercent) : 'text-gray-400';

                        const potentialFeesCircle = (planFees > 0 && potentialFees > 0) ? getCircleColor(potentialFeesPercent) : '#d1d5db';
                        const weightedFeesCircle = (planFees > 0 && weightedFees > 0) ? getCircleColor(weightedFeesPercent) : '#d1d5db';
                        const potentialRevenueCircle = (planRevenue > 0 && potentialRevenue > 0) ? getCircleColor(potentialRevenuePercent) : '#d1d5db';
                        const weightedRevenueCircle = (planRevenue > 0 && weightedRevenue > 0) ? getCircleColor(weightedRevenuePercent) : '#d1d5db';

                        return (
                          <tr key={client} className="hover:bg-gray-50">
                            <td className="px-3 py-1 whitespace-nowrap text-sm font-medium text-gray-900">{client}</td>
                            <td className="px-3 py-1 whitespace-nowrap text-sm text-right font-bold text-gray-600 bg-blue-50">${planFees.toLocaleString()}</td>
                            <td className={`px-3 py-1 whitespace-nowrap text-sm text-right font-semibold ${potentialFeesColor}`}>
                              <span className="inline-flex items-center gap-1.5">
                                ${potentialFees.toLocaleString()}
                                <svg width="12" height="12" viewBox="0 0 12 12" className="inline-block">
                                  <circle cx="6" cy="6" r="6" fill={potentialFeesCircle} />
                                </svg>
                              </span>
                            </td>
                            <td className={`px-3 py-1 whitespace-nowrap text-sm text-right font-semibold ${weightedFeesColor}`}>
                              <span className="inline-flex items-center gap-1.5">
                                ${weightedFees.toLocaleString()}
                                <svg width="12" height="12" viewBox="0 0 12 12" className="inline-block">
                                  <circle cx="6" cy="6" r="6" fill={weightedFeesCircle} />
                                </svg>
                              </span>
                            </td>
                            <td className="px-3 py-1 whitespace-nowrap text-sm text-right font-bold text-gray-600 bg-blue-50">${planRevenue.toLocaleString()}</td>
                            <td className={`px-3 py-1 whitespace-nowrap text-sm text-right font-semibold ${potentialRevenueColor}`}>
                              <span className="inline-flex items-center gap-1.5">
                                ${potentialRevenue.toLocaleString()}
                                <svg width="12" height="12" viewBox="0 0 12 12" className="inline-block">
                                  <circle cx="6" cy="6" r="6" fill={potentialRevenueCircle} />
                                </svg>
                              </span>
                            </td>
                            <td className={`px-3 py-1 whitespace-nowrap text-sm text-right font-semibold ${weightedRevenueColor}`}>
                              <span className="inline-flex items-center gap-1.5">
                                ${weightedRevenue.toLocaleString()}
                                <svg width="12" height="12" viewBox="0 0 12 12" className="inline-block">
                                  <circle cx="6" cy="6" r="6" fill={weightedRevenueCircle} />
                                </svg>
                              </span>
                            </td>
                          </tr>
                        );
                      });
                    
                      const calculateTotals = (clients: string[]) => {
                      let totalPlanFees = 0;
                        let totalPotentialFees = 0;
                        let totalWeightedFees = 0;
                        let totalPlanRevenue = 0;
                        let totalPotentialRevenue = 0;
                        let totalWeightedRevenue = 0;

                        clients.forEach(client => {
                          totalPlanFees += annualPlanEntries[client]?.planFees || 0;
                          totalPlanRevenue += annualPlanEntries[client]?.planRevenue || 0;
                          totalPotentialFees += dataByClient[client]?.potentialFees || 0;
                          totalWeightedFees += dataByClient[client]?.weightedFees || 0;
                          totalPotentialRevenue += dataByClient[client]?.potentialRevenue || 0;
                          totalWeightedRevenue += dataByClient[client]?.weightedRevenue || 0;
                        });

                        return { totalPlanFees, totalPotentialFees, totalWeightedFees, totalPlanRevenue, totalPotentialRevenue, totalWeightedRevenue };
                      };

                      const canadaTotals = calculateTotals(canadaClients);
                      const usTotals = calculateTotals(usClients);

                      return (
                        <>
                          {/* Salt XC Canada Section */}
                          <tr className="bg-black">
                            <td colSpan={7} className="px-3 py-2 text-sm font-bold text-white">
                              Salt XC Canada
                            </td>
                          </tr>
                          {renderClientRows(canadaClients)}
                          {/* Canada Total */}
                          <tr className="bg-blue-200 font-bold border-t border-gray-300">
                          <td className="px-3 py-1.5 whitespace-nowrap text-sm text-gray-900">TOTAL</td>
                            <td className="px-3 py-1.5 whitespace-nowrap text-sm text-right font-bold text-gray-900 bg-blue-200">${canadaTotals.totalPlanFees.toLocaleString()}</td>
                            <td className={`px-3 py-1.5 whitespace-nowrap text-sm text-right font-bold ${
                              (canadaTotals.totalPlanFees > 0 && canadaTotals.totalPotentialFees > 0) && (canadaTotals.totalPotentialFees / canadaTotals.totalPlanFees * 100) >= 90 
                                ? 'text-green-700' 
                                : (canadaTotals.totalPlanFees > 0 && canadaTotals.totalPotentialFees > 0) && (canadaTotals.totalPotentialFees / canadaTotals.totalPlanFees * 100) >= 65
                                ? 'text-orange-600'
                                : (canadaTotals.totalPlanFees > 0 && canadaTotals.totalPotentialFees > 0)
                                ? 'text-red-700'
                                : 'text-gray-400'
                            }`}>
                              <span className="inline-flex items-center gap-1.5">
                                ${canadaTotals.totalPotentialFees.toLocaleString()}
                                <svg width="12" height="12" viewBox="0 0 12 12" className="inline-block">
                                  <circle cx="6" cy="6" r="6" fill={
                                    (canadaTotals.totalPlanFees > 0 && canadaTotals.totalPotentialFees > 0) && (canadaTotals.totalPotentialFees / canadaTotals.totalPlanFees * 100) >= 90 
                                      ? '#15803d' 
                                      : (canadaTotals.totalPlanFees > 0 && canadaTotals.totalPotentialFees > 0) && (canadaTotals.totalPotentialFees / canadaTotals.totalPlanFees * 100) >= 65
                                      ? '#ea580c'
                                      : (canadaTotals.totalPlanFees > 0 && canadaTotals.totalPotentialFees > 0)
                                      ? '#b91c1c'
                                      : '#d1d5db'
                                  } />
                                </svg>
                              </span>
                            </td>
                            <td className={`px-3 py-1.5 whitespace-nowrap text-sm text-right font-bold ${
                              (canadaTotals.totalPlanFees > 0 && canadaTotals.totalWeightedFees > 0) && (canadaTotals.totalWeightedFees / canadaTotals.totalPlanFees * 100) >= 90 
                                ? 'text-green-700' 
                                : (canadaTotals.totalPlanFees > 0 && canadaTotals.totalWeightedFees > 0) && (canadaTotals.totalWeightedFees / canadaTotals.totalPlanFees * 100) >= 65
                                ? 'text-orange-600'
                                : (canadaTotals.totalPlanFees > 0 && canadaTotals.totalWeightedFees > 0)
                                ? 'text-red-700'
                                : 'text-gray-400'
                            }`}>
                              <span className="inline-flex items-center gap-1.5">
                                ${canadaTotals.totalWeightedFees.toLocaleString()}
                                <svg width="12" height="12" viewBox="0 0 12 12" className="inline-block">
                                  <circle cx="6" cy="6" r="6" fill={
                                    (canadaTotals.totalPlanFees > 0 && canadaTotals.totalWeightedFees > 0) && (canadaTotals.totalWeightedFees / canadaTotals.totalPlanFees * 100) >= 90 
                                      ? '#15803d' 
                                      : (canadaTotals.totalPlanFees > 0 && canadaTotals.totalWeightedFees > 0) && (canadaTotals.totalWeightedFees / canadaTotals.totalPlanFees * 100) >= 65
                                      ? '#ea580c'
                                      : (canadaTotals.totalPlanFees > 0 && canadaTotals.totalWeightedFees > 0)
                                      ? '#b91c1c'
                                      : '#d1d5db'
                                  } />
                                </svg>
                              </span>
                            </td>
                            <td className="px-3 py-1.5 whitespace-nowrap text-sm text-right font-bold text-gray-900 bg-blue-200">${canadaTotals.totalPlanRevenue.toLocaleString()}</td>
                            <td className={`px-3 py-1.5 whitespace-nowrap text-sm text-right font-bold ${
                              (canadaTotals.totalPlanRevenue > 0 && canadaTotals.totalPotentialRevenue > 0) && (canadaTotals.totalPotentialRevenue / canadaTotals.totalPlanRevenue * 100) >= 90 
                                ? 'text-green-700' 
                                : (canadaTotals.totalPlanRevenue > 0 && canadaTotals.totalPotentialRevenue > 0) && (canadaTotals.totalPotentialRevenue / canadaTotals.totalPlanRevenue * 100) >= 65
                                ? 'text-orange-600'
                                : (canadaTotals.totalPlanRevenue > 0 && canadaTotals.totalPotentialRevenue > 0)
                                ? 'text-red-700'
                                : 'text-gray-400'
                            }`}>
                              <span className="inline-flex items-center gap-1.5">
                                ${canadaTotals.totalPotentialRevenue.toLocaleString()}
                                <svg width="12" height="12" viewBox="0 0 12 12" className="inline-block">
                                  <circle cx="6" cy="6" r="6" fill={
                                    (canadaTotals.totalPlanRevenue > 0 && canadaTotals.totalPotentialRevenue > 0) && (canadaTotals.totalPotentialRevenue / canadaTotals.totalPlanRevenue * 100) >= 90 
                                      ? '#15803d' 
                                      : (canadaTotals.totalPlanRevenue > 0 && canadaTotals.totalPotentialRevenue > 0) && (canadaTotals.totalPotentialRevenue / canadaTotals.totalPlanRevenue * 100) >= 65
                                      ? '#ea580c'
                                      : (canadaTotals.totalPlanRevenue > 0 && canadaTotals.totalPotentialRevenue > 0)
                                      ? '#b91c1c'
                                      : '#d1d5db'
                                  } />
                                </svg>
                              </span>
                            </td>
                            <td className={`px-3 py-1.5 whitespace-nowrap text-sm text-right font-bold ${
                              (canadaTotals.totalPlanRevenue > 0 && canadaTotals.totalWeightedRevenue > 0) && (canadaTotals.totalWeightedRevenue / canadaTotals.totalPlanRevenue * 100) >= 90 
                                ? 'text-green-700' 
                                : (canadaTotals.totalPlanRevenue > 0 && canadaTotals.totalWeightedRevenue > 0) && (canadaTotals.totalWeightedRevenue / canadaTotals.totalPlanRevenue * 100) >= 65
                                ? 'text-orange-600'
                                : (canadaTotals.totalPlanRevenue > 0 && canadaTotals.totalWeightedRevenue > 0)
                                ? 'text-red-700'
                                : 'text-gray-400'
                            }`}>
                              <span className="inline-flex items-center gap-1.5">
                                ${canadaTotals.totalWeightedRevenue.toLocaleString()}
                                <svg width="12" height="12" viewBox="0 0 12 12" className="inline-block">
                                  <circle cx="6" cy="6" r="6" fill={
                                    (canadaTotals.totalPlanRevenue > 0 && canadaTotals.totalWeightedRevenue > 0) && (canadaTotals.totalWeightedRevenue / canadaTotals.totalPlanRevenue * 100) >= 90 
                                      ? '#15803d' 
                                      : (canadaTotals.totalPlanRevenue > 0 && canadaTotals.totalWeightedRevenue > 0) && (canadaTotals.totalWeightedRevenue / canadaTotals.totalPlanRevenue * 100) >= 65
                                      ? '#ea580c'
                                      : (canadaTotals.totalPlanRevenue > 0 && canadaTotals.totalWeightedRevenue > 0)
                                      ? '#b91c1c'
                                      : '#d1d5db'
                                  } />
                                </svg>
                              </span>
                            </td>
                        </tr>

                          {/* Salt XC US Section */}
                          <tr className="bg-black">
                            <td colSpan={7} className="px-3 py-2 text-sm font-bold text-white">
                              Salt XC US
                            </td>
                          </tr>
                          {renderClientRows(usClients)}
                          {/* US Total */}
                          <tr className="bg-blue-200 font-bold border-t border-gray-300">
                            <td className="px-3 py-1.5 whitespace-nowrap text-sm text-gray-900">TOTAL</td>
                            <td className="px-3 py-1.5 whitespace-nowrap text-sm text-right font-bold text-gray-900 bg-blue-200">${usTotals.totalPlanFees.toLocaleString()}</td>
                            <td className={`px-3 py-1.5 whitespace-nowrap text-sm text-right font-bold ${
                              (usTotals.totalPlanFees > 0 && usTotals.totalPotentialFees > 0) && (usTotals.totalPotentialFees / usTotals.totalPlanFees * 100) >= 90 
                                ? 'text-green-700' 
                                : (usTotals.totalPlanFees > 0 && usTotals.totalPotentialFees > 0) && (usTotals.totalPotentialFees / usTotals.totalPlanFees * 100) >= 65
                                ? 'text-orange-600'
                                : (usTotals.totalPlanFees > 0 && usTotals.totalPotentialFees > 0)
                                ? 'text-red-700'
                                : 'text-gray-400'
                            }`}>
                              <span className="inline-flex items-center gap-1.5">
                                ${usTotals.totalPotentialFees.toLocaleString()}
                                <svg width="12" height="12" viewBox="0 0 12 12" className="inline-block">
                                  <circle cx="6" cy="6" r="6" fill={
                                    (usTotals.totalPlanFees > 0 && usTotals.totalPotentialFees > 0) && (usTotals.totalPotentialFees / usTotals.totalPlanFees * 100) >= 90 
                                      ? '#15803d' 
                                      : (usTotals.totalPlanFees > 0 && usTotals.totalPotentialFees > 0) && (usTotals.totalPotentialFees / usTotals.totalPlanFees * 100) >= 65
                                      ? '#ea580c'
                                      : (usTotals.totalPlanFees > 0 && usTotals.totalPotentialFees > 0)
                                      ? '#b91c1c'
                                      : '#d1d5db'
                                  } />
                                </svg>
                              </span>
                            </td>
                            <td className={`px-3 py-1.5 whitespace-nowrap text-sm text-right font-bold ${
                              (usTotals.totalPlanFees > 0 && usTotals.totalWeightedFees > 0) && (usTotals.totalWeightedFees / usTotals.totalPlanFees * 100) >= 90 
                                ? 'text-green-700' 
                                : (usTotals.totalPlanFees > 0 && usTotals.totalWeightedFees > 0) && (usTotals.totalWeightedFees / usTotals.totalPlanFees * 100) >= 65
                                ? 'text-orange-600'
                                : (usTotals.totalPlanFees > 0 && usTotals.totalWeightedFees > 0)
                                ? 'text-red-700'
                                : 'text-gray-400'
                            }`}>
                              <span className="inline-flex items-center gap-1.5">
                                ${usTotals.totalWeightedFees.toLocaleString()}
                                <svg width="12" height="12" viewBox="0 0 12 12" className="inline-block">
                                  <circle cx="6" cy="6" r="6" fill={
                                    (usTotals.totalPlanFees > 0 && usTotals.totalWeightedFees > 0) && (usTotals.totalWeightedFees / usTotals.totalPlanFees * 100) >= 90 
                                      ? '#15803d' 
                                      : (usTotals.totalPlanFees > 0 && usTotals.totalWeightedFees > 0) && (usTotals.totalWeightedFees / usTotals.totalPlanFees * 100) >= 65
                                      ? '#ea580c'
                                      : (usTotals.totalPlanFees > 0 && usTotals.totalWeightedFees > 0)
                                      ? '#b91c1c'
                                      : '#d1d5db'
                                  } />
                                </svg>
                              </span>
                            </td>
                            <td className="px-3 py-1.5 whitespace-nowrap text-sm text-right font-bold text-gray-900 bg-blue-200">${usTotals.totalPlanRevenue.toLocaleString()}</td>
                            <td className={`px-3 py-1.5 whitespace-nowrap text-sm text-right font-bold ${
                              (usTotals.totalPlanRevenue > 0 && usTotals.totalPotentialRevenue > 0) && (usTotals.totalPotentialRevenue / usTotals.totalPlanRevenue * 100) >= 90 
                                ? 'text-green-700' 
                                : (usTotals.totalPlanRevenue > 0 && usTotals.totalPotentialRevenue > 0) && (usTotals.totalPotentialRevenue / usTotals.totalPlanRevenue * 100) >= 65
                                ? 'text-orange-600'
                                : (usTotals.totalPlanRevenue > 0 && usTotals.totalPotentialRevenue > 0)
                                ? 'text-red-700'
                                : 'text-gray-400'
                            }`}>
                              <span className="inline-flex items-center gap-1.5">
                                ${usTotals.totalPotentialRevenue.toLocaleString()}
                                <svg width="12" height="12" viewBox="0 0 12 12" className="inline-block">
                                  <circle cx="6" cy="6" r="6" fill={
                                    (usTotals.totalPlanRevenue > 0 && usTotals.totalPotentialRevenue > 0) && (usTotals.totalPotentialRevenue / usTotals.totalPlanRevenue * 100) >= 90 
                                      ? '#15803d' 
                                      : (usTotals.totalPlanRevenue > 0 && usTotals.totalPotentialRevenue > 0) && (usTotals.totalPotentialRevenue / usTotals.totalPlanRevenue * 100) >= 65
                                      ? '#ea580c'
                                      : (usTotals.totalPlanRevenue > 0 && usTotals.totalPotentialRevenue > 0)
                                      ? '#b91c1c'
                                      : '#d1d5db'
                                  } />
                                </svg>
                              </span>
                            </td>
                            <td className={`px-3 py-1.5 whitespace-nowrap text-sm text-right font-bold ${
                              (usTotals.totalPlanRevenue > 0 && usTotals.totalWeightedRevenue > 0) && (usTotals.totalWeightedRevenue / usTotals.totalPlanRevenue * 100) >= 90 
                                ? 'text-green-700' 
                                : (usTotals.totalPlanRevenue > 0 && usTotals.totalWeightedRevenue > 0) && (usTotals.totalWeightedRevenue / usTotals.totalPlanRevenue * 100) >= 65
                                ? 'text-orange-600'
                                : (usTotals.totalPlanRevenue > 0 && usTotals.totalWeightedRevenue > 0)
                                ? 'text-red-700'
                                : 'text-gray-400'
                            }`}>
                              <span className="inline-flex items-center gap-1.5">
                                ${usTotals.totalWeightedRevenue.toLocaleString()}
                                <svg width="12" height="12" viewBox="0 0 12 12" className="inline-block">
                                  <circle cx="6" cy="6" r="6" fill={
                                    (usTotals.totalPlanRevenue > 0 && usTotals.totalWeightedRevenue > 0) && (usTotals.totalWeightedRevenue / usTotals.totalPlanRevenue * 100) >= 90 
                                      ? '#15803d' 
                                      : (usTotals.totalPlanRevenue > 0 && usTotals.totalWeightedRevenue > 0) && (usTotals.totalWeightedRevenue / usTotals.totalPlanRevenue * 100) >= 65
                                      ? '#ea580c'
                                      : (usTotals.totalPlanRevenue > 0 && usTotals.totalWeightedRevenue > 0)
                                      ? '#b91c1c'
                                      : '#d1d5db'
                                  } />
                                </svg>
                              </span>
                            </td>
                          </tr>
                        </>
                      );
                    })()}
                  </tbody>
                </table>
              </div>
              </div>
              )}
            </div>

            {/* Table 3: Weighted Fees Breakdown */}
            <div className="mb-8">
              <button
                onClick={() => setShowAnnualPlanTable3(!showAnnualPlanTable3)}
                className="w-full flex items-center justify-between bg-blue-100 hover:bg-blue-200 px-4 py-3 rounded-lg mb-2 transition-colors"
              >
                <h3 className="text-lg font-semibold text-gray-900">Weighted Fees Breakdown</h3>
                <svg
                  className={`w-5 h-5 text-gray-700 transition-transform ${showAnnualPlanTable3 ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {showAnnualPlanTable3 && (
              <div>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                      <th className="px-3 py-1.5 text-right text-xs font-bold text-gray-500 uppercase tracking-wider bg-blue-50">Plan Fees</th>
                      <th className="px-3 py-1.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Confirmed</th>
                      <th className="px-3 py-1.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Open</th>
                      <th className="px-3 py-1.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">High Pitch</th>
                      <th className="px-3 py-1.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Medium Pitch</th>
                      <th className="px-3 py-1.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Low Pitch</th>
                      <th className="px-3 py-1.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">White Space</th>
                      <th className="px-3 py-1.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider border-l-2 border-gray-300 bg-blue-50">Total</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {(() => {
                      // Calculate fees by client and status
                      const feesByClientStatus: { [client: string]: { [status: string]: number } } = {};

                      entries.forEach(entry => {
                        if (!feesByClientStatus[entry.client]) {
                          feesByClientStatus[entry.client] = {
                            'Confirmed': 0,
                            'Open': 0,
                            'High Pitch': 0,
                            'Medium Pitch': 0,
                            'Low Pitch': 0,
                            'Whitespace': 0
                          };
                        }
                        const status = (entry.status || 'Whitespace').toLowerCase();
                        let normalizedStatus = '';
                        
                        // Map status to proper format
                        if (status === 'confirmed') normalizedStatus = 'Confirmed';
                        else if (status === 'open') normalizedStatus = 'Open';
                        else if (status === 'high pitch') normalizedStatus = 'High Pitch';
                        else if (status === 'medium pitch') normalizedStatus = 'Medium Pitch';
                        else if (status === 'low pitch') normalizedStatus = 'Low Pitch';
                        else normalizedStatus = 'Whitespace';
                        
                        feesByClientStatus[entry.client][normalizedStatus] += entry.totalFees || 0;
                      });

                      // Sort clients: alphabetically with "Other" and "NBD" at the bottom
                      const regularClients = CLIENT_LIST.filter(c => !c.startsWith('Other -') && !c.startsWith('NBD -')).sort();
                      const otherClients = CLIENT_LIST.filter(c => c.startsWith('Other -') || c.startsWith('NBD -')).sort();
                      const sortedClients = [...regularClients, ...otherClients];

                      // Helper to get billing entity for a client
                      const getClientBillingEntity = (clientName: string): 'Salt XC Canada' | 'Salt XC US' => {
                        const setting = clientSettings.find(c => c.name === clientName);
                        return setting?.billingEntity || 'Salt XC Canada';
                      };

                      // Group clients by billing entity
                      const canadaClients = sortedClients.filter(c => getClientBillingEntity(c) === 'Salt XC Canada');
                      const usClients = sortedClients.filter(c => getClientBillingEntity(c) === 'Salt XC US');

                      const renderClientRows = (clients: string[]) => clients.map(client => {
                        const planFees = annualPlanEntries[client]?.planFees || 0;
                        const statusFees = feesByClientStatus[client] || {
                          'Confirmed': 0,
                          'Open': 0,
                          'High Pitch': 0,
                          'Medium Pitch': 0,
                          'Low Pitch': 0,
                          'Whitespace': 0
                        };
                        const total = Object.values(statusFees).reduce((sum, val) => sum + val, 0);

                        return (
                          <tr key={client} className="hover:bg-gray-50">
                            <td className="px-3 py-1 whitespace-nowrap text-sm font-medium text-gray-900">{client}</td>
                            <td className="px-3 py-1 whitespace-nowrap text-sm text-right font-bold text-gray-600 bg-blue-50">${planFees.toLocaleString()}</td>
                            <td className="px-3 py-1 whitespace-nowrap text-sm text-right">${statusFees['Confirmed'].toLocaleString()}</td>
                            <td className="px-3 py-1 whitespace-nowrap text-sm text-right">${statusFees['Open'].toLocaleString()}</td>
                            <td className="px-3 py-1 whitespace-nowrap text-sm text-right">${statusFees['High Pitch'].toLocaleString()}</td>
                            <td className="px-3 py-1 whitespace-nowrap text-sm text-right">${statusFees['Medium Pitch'].toLocaleString()}</td>
                            <td className="px-3 py-1 whitespace-nowrap text-sm text-right">${statusFees['Low Pitch'].toLocaleString()}</td>
                            <td className="px-3 py-1 whitespace-nowrap text-sm text-right">${statusFees['Whitespace'].toLocaleString()}</td>
                            <td className="px-3 py-1 whitespace-nowrap text-sm text-right font-bold border-l-2 border-gray-300 bg-blue-50">${total.toLocaleString()}</td>
                          </tr>
                        );
                      });
                    
                      const calculateTotals = (clients: string[]) => {
                      let totalPlanFees = 0;
                        let totalConfirmed = 0;
                        let totalOpen = 0;
                        let totalHighPitch = 0;
                        let totalMediumPitch = 0;
                        let totalLowPitch = 0;
                        let totalWhitespace = 0;

                        clients.forEach(client => {
                          totalPlanFees += annualPlanEntries[client]?.planFees || 0;
                          const statusFees = feesByClientStatus[client] || {};
                          totalConfirmed += statusFees['Confirmed'] || 0;
                          totalOpen += statusFees['Open'] || 0;
                          totalHighPitch += statusFees['High Pitch'] || 0;
                          totalMediumPitch += statusFees['Medium Pitch'] || 0;
                          totalLowPitch += statusFees['Low Pitch'] || 0;
                          totalWhitespace += statusFees['Whitespace'] || 0;
                        });

                        const grandTotal = totalConfirmed + totalOpen + totalHighPitch + totalMediumPitch + totalLowPitch + totalWhitespace;

                        return { totalPlanFees, totalConfirmed, totalOpen, totalHighPitch, totalMediumPitch, totalLowPitch, totalWhitespace, grandTotal };
                      };

                      const canadaTotals = calculateTotals(canadaClients);
                      const usTotals = calculateTotals(usClients);

                      return (
                        <>
                          {/* Salt XC Canada Section */}
                          <tr className="bg-black">
                            <td colSpan={9} className="px-3 py-2 text-sm font-bold text-white">
                              Salt XC Canada
                            </td>
                        </tr>
                          {renderClientRows(canadaClients)}
                          {/* Canada Total */}
                          <tr className="bg-blue-200 font-bold border-t border-gray-300">
                            <td className="px-3 py-1.5 whitespace-nowrap text-sm text-gray-900">TOTAL</td>
                            <td className="px-3 py-1.5 whitespace-nowrap text-sm text-right font-bold text-gray-900 bg-blue-200">${canadaTotals.totalPlanFees.toLocaleString()}</td>
                            <td className="px-3 py-1.5 whitespace-nowrap text-sm text-right text-gray-900">${canadaTotals.totalConfirmed.toLocaleString()}</td>
                            <td className="px-3 py-1.5 whitespace-nowrap text-sm text-right text-gray-900">${canadaTotals.totalOpen.toLocaleString()}</td>
                            <td className="px-3 py-1.5 whitespace-nowrap text-sm text-right text-gray-900">${canadaTotals.totalHighPitch.toLocaleString()}</td>
                            <td className="px-3 py-1.5 whitespace-nowrap text-sm text-right text-gray-900">${canadaTotals.totalMediumPitch.toLocaleString()}</td>
                            <td className="px-3 py-1.5 whitespace-nowrap text-sm text-right text-gray-900">${canadaTotals.totalLowPitch.toLocaleString()}</td>
                            <td className="px-3 py-1.5 whitespace-nowrap text-sm text-right text-gray-900">${canadaTotals.totalWhitespace.toLocaleString()}</td>
                            <td className="px-3 py-1.5 whitespace-nowrap text-sm text-right font-bold text-gray-900 border-l-2 border-gray-300 bg-blue-200">${canadaTotals.grandTotal.toLocaleString()}</td>
                          </tr>

                          {/* Salt XC US Section */}
                          <tr className="bg-black">
                            <td colSpan={9} className="px-3 py-2 text-sm font-bold text-white">
                              Salt XC US
                            </td>
                          </tr>
                          {renderClientRows(usClients)}
                          {/* US Total */}
                          <tr className="bg-blue-200 font-bold border-t border-gray-300">
                            <td className="px-3 py-1.5 whitespace-nowrap text-sm text-gray-900">TOTAL</td>
                            <td className="px-3 py-1.5 whitespace-nowrap text-sm text-right font-bold text-gray-900 bg-blue-200">${usTotals.totalPlanFees.toLocaleString()}</td>
                            <td className="px-3 py-1.5 whitespace-nowrap text-sm text-right text-gray-900">${usTotals.totalConfirmed.toLocaleString()}</td>
                            <td className="px-3 py-1.5 whitespace-nowrap text-sm text-right text-gray-900">${usTotals.totalOpen.toLocaleString()}</td>
                            <td className="px-3 py-1.5 whitespace-nowrap text-sm text-right text-gray-900">${usTotals.totalHighPitch.toLocaleString()}</td>
                            <td className="px-3 py-1.5 whitespace-nowrap text-sm text-right text-gray-900">${usTotals.totalMediumPitch.toLocaleString()}</td>
                            <td className="px-3 py-1.5 whitespace-nowrap text-sm text-right text-gray-900">${usTotals.totalLowPitch.toLocaleString()}</td>
                            <td className="px-3 py-1.5 whitespace-nowrap text-sm text-right text-gray-900">${usTotals.totalWhitespace.toLocaleString()}</td>
                            <td className="px-3 py-1.5 whitespace-nowrap text-sm text-right font-bold text-gray-900 border-l-2 border-gray-300 bg-blue-200">${usTotals.grandTotal.toLocaleString()}</td>
                          </tr>
                        </>
                      );
                    })()}
                  </tbody>
                </table>
              </div>
              </div>
              )}
            </div>
          </div>
        )}
        {isAdminMode && adminView === 'financeReporting' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Downloads</h2>
            
            {/* Report Type Selection */}
            <div className="mb-6 space-y-4">
              <div>
                <Label className="text-base font-semibold">Select Report Type</Label>
                <select
                  value={financeReportType}
                  onChange={(e) => setFinanceReportType(e.target.value as 'projectByMonth' | 'clientSummary' | 'departmentBreakdown')}
                  className="mt-2 w-full max-w-md px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="projectByMonth">Fees by Project by Department by Month</option>
                  <option value="clientSummary">Client Summary Report</option>
                  <option value="departmentBreakdown">Department Breakdown Report</option>
                </select>
              </div>

              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <Label>Client Filter (Optional)</Label>
                  <select
                    value={financeClientFilter}
                    onChange={(e) => setFinanceClientFilter(e.target.value)}
                    className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">All Clients</option>
                    {CLIENT_LIST.map(client => (
                      <option key={client} value={client}>{client}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label>Status Filter (Optional)</Label>
                  <select
                    value={financeStatusFilter}
                    onChange={(e) => setFinanceStatusFilter(e.target.value)}
                    className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">All Statuses</option>
                    <option value="Confirmed">Confirmed</option>
                    <option value="Open">Open</option>
                    <option value="High Pitch">High Pitch</option>
                    <option value="Medium Pitch">Medium Pitch</option>
                    <option value="Low Pitch">Low Pitch</option>
                    <option value="Whitespace">Whitespace</option>
                  </select>
                </div>

                <div>
                  <Label>Month Filter (Optional)</Label>
                  <select
                    value={financeMonthFilter}
                    onChange={(e) => setFinanceMonthFilter(e.target.value)}
                    className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">All Months</option>
                    {(() => {
                      const months = new Set<string>();
                      entries.forEach(entry => {
                        months.add(formatMonthYear(entry.startMonth));
                        months.add(formatMonthYear(entry.endMonth));
                      });
                      return Array.from(months).sort((a, b) => {
                        const dateA = new Date(a);
                        const dateB = new Date(b);
                        return dateA.getTime() - dateB.getTime();
                      }).map(month => (
                        <option key={month} value={month}>{month}</option>
                      ));
                    })()}
                  </select>
                </div>

                <div>
                  <Label>Year Filter (Optional)</Label>
                  <select
                    value={financeYearFilter}
                    onChange={(e) => setFinanceYearFilter(e.target.value)}
                    className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">All Years</option>
                    <option value="2024">2024</option>
                    <option value="2025">2025</option>
                    <option value="2026">2026</option>
                  </select>
                </div>
              </div>

              {/* Export Button */}
              <div className="flex gap-4">
                <button
                  onClick={handleExportToExcel}
                  className="px-6 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-60"
                 
                >
                  Export to Excel
                </button>
                <button
                  onClick={() => {
                    setFinanceClientFilter('');
                    setFinanceStatusFilter('');
                    setFinanceYearFilter('');
                    setFinanceMonthFilter('');
                  }}
                  className="px-6 py-2 bg-gray-200 text-gray-700 font-medium rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
                >
                  Clear Filters
                </button>
              </div>
            </div>

            {/* Preview Section */}
            <div className="mt-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Report Preview</h3>
              <div className="overflow-x-auto">
                {financeReportType === 'projectByMonth' && (
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project Code</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Program Name</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Start Month</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">End Month</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Fees</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Accounts</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Creative</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Design</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Strategy</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Media</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Studio</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Creator</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Social</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Omni</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Finance</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {(() => {
                        const filteredEntries = entries.filter(entry => {
                          if (financeClientFilter && entry.client !== financeClientFilter) return false;
                          if (financeStatusFilter && entry.status !== financeStatusFilter) return false;
                          if (financeYearFilter) {
                            const startYear = new Date(entry.startMonth).getFullYear().toString();
                            if (startYear !== financeYearFilter) return false;
                          }
                          if (financeMonthFilter) {
                            const startMonth = formatMonthYear(entry.startMonth);
                            const endMonth = formatMonthYear(entry.endMonth);
                            // Check if the selected month falls within the project's date range
                            if (startMonth !== financeMonthFilter && endMonth !== financeMonthFilter) {
                              // Check if it's in between
                              const filterDate = new Date(financeMonthFilter);
                              const startDate = new Date(entry.startMonth);
                              const endDate = new Date(entry.endMonth);
                              if (filterDate < startDate || filterDate > endDate) return false;
                            }
                          }
                          return true;
                        });

                        return filteredEntries.length === 0 ? (
                          <tr>
                            <td colSpan={17} className="px-4 py-8 text-center text-gray-500">
                              No data matches the selected filters
                            </td>
                          </tr>
                        ) : (
                          filteredEntries.map((entry, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{entry.projectCode}</td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 min-w-[9rem]">{entry.client}</td>
                              <td className="px-4 py-3 text-sm text-gray-900 min-w-[24rem]">{entry.programName}</td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{formatMonthYear(entry.startMonth)}</td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{formatMonthYear(entry.endMonth)}</td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm">
                                <span className={`px-3 py-1 rounded-md text-xs font-medium ${
                                  entry.status === 'Confirmed' ? 'bg-green-100 text-green-800' :
                                  entry.status === 'Open' ? 'bg-blue-100 text-blue-800' :
                                  entry.status === 'High Pitch' ? 'bg-yellow-100 text-yellow-800' :
                                  entry.status === 'Medium Pitch' ? 'bg-orange-100 text-orange-800' :
                                  entry.status === 'Low Pitch' ? 'bg-red-100 text-red-800' :
                                  entry.status === 'Whitespace' ? 'bg-gray-100 text-gray-800' :
                                  'bg-gray-100 text-gray-600'
                                }`}>
                                  {entry.status}
                                </span>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900">${(entry.totalFees ?? 0).toLocaleString()}</td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900">${(entry.accounts ?? 0).toLocaleString()}</td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900">${(entry.creative ?? 0).toLocaleString()}</td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900">${(entry.design ?? 0).toLocaleString()}</td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900">${(entry.strategy ?? 0).toLocaleString()}</td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900">${(entry.media ?? 0).toLocaleString()}</td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900">${(entry.studio ?? 0).toLocaleString()}</td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900">${(entry.creator ?? 0).toLocaleString()}</td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900">${(entry.social ?? 0).toLocaleString()}</td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900">${(entry.omni ?? 0).toLocaleString()}</td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900">${(entry.finance ?? 0).toLocaleString()}</td>
                            </tr>
                          ))
                        );
                      })()}
                    </tbody>
                  </table>
                )}

                {financeReportType === 'clientSummary' && (
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Projects</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Fees</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {(() => {
                        const filteredEntries = entries.filter(entry => {
                          if (financeClientFilter && entry.client !== financeClientFilter) return false;
                          if (financeStatusFilter && entry.status !== financeStatusFilter) return false;
                          if (financeYearFilter) {
                            const startYear = new Date(entry.startMonth).getFullYear().toString();
                            if (startYear !== financeYearFilter) return false;
                          }
                          if (financeMonthFilter) {
                            const startMonth = formatMonthYear(entry.startMonth);
                            const endMonth = formatMonthYear(entry.endMonth);
                            // Check if the selected month falls within the project's date range
                            if (startMonth !== financeMonthFilter && endMonth !== financeMonthFilter) {
                              // Check if it's in between
                              const filterDate = new Date(financeMonthFilter);
                              const startDate = new Date(entry.startMonth);
                              const endDate = new Date(entry.endMonth);
                              if (filterDate < startDate || filterDate > endDate) return false;
                            }
                          }
                          return true;
                        });

                        const clientSummary: { [client: string]: { count: number; fees: number; revenue: number } } = {};
                        filteredEntries.forEach(entry => {
                          if (!clientSummary[entry.client]) {
                            clientSummary[entry.client] = { count: 0, fees: 0, revenue: 0 };
                          }
                          clientSummary[entry.client].count++;
                          clientSummary[entry.client].fees += entry.totalFees ?? 0;
                          clientSummary[entry.client].revenue += entry.revenue ?? 0;
                        });

                        const sortedClients = Object.keys(clientSummary).sort();

                        return sortedClients.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                              No data matches the selected filters
                            </td>
                          </tr>
                        ) : (
                          sortedClients.map(client => (
                            <tr key={client} className="hover:bg-gray-50">
                              <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{client}</td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900">{clientSummary[client].count}</td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900">${clientSummary[client].fees.toLocaleString()}</td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900">${clientSummary[client].revenue.toLocaleString()}</td>
                            </tr>
                          ))
                        );
                      })()}
                    </tbody>
                  </table>
                )}

                {financeReportType === 'departmentBreakdown' && (
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Fees</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">% of Total</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {(() => {
                        const filteredEntries = entries.filter(entry => {
                          if (financeClientFilter && entry.client !== financeClientFilter) return false;
                          if (financeStatusFilter && entry.status !== financeStatusFilter) return false;
                          if (financeYearFilter) {
                            const startYear = new Date(entry.startMonth).getFullYear().toString();
                            if (startYear !== financeYearFilter) return false;
                          }
                          if (financeMonthFilter) {
                            const startMonth = formatMonthYear(entry.startMonth);
                            const endMonth = formatMonthYear(entry.endMonth);
                            // Check if the selected month falls within the project's date range
                            if (startMonth !== financeMonthFilter && endMonth !== financeMonthFilter) {
                              // Check if it's in between
                              const filterDate = new Date(financeMonthFilter);
                              const startDate = new Date(entry.startMonth);
                              const endDate = new Date(entry.endMonth);
                              if (filterDate < startDate || filterDate > endDate) return false;
                            }
                          }
                          return true;
                        });

                        const deptTotals = {
                          'Accounts': 0,
                          'Creative': 0,
                          'Design': 0,
                          'Strategy': 0,
                          'Media': 0,
                          'Studio': 0,
                          'Creator': 0,
                          'Social': 0,
                          'Omni': 0,
                          'Finance': 0
                        };

                        filteredEntries.forEach(entry => {
                          deptTotals['Accounts'] += entry.accounts ?? 0;
                          deptTotals['Creative'] += entry.creative ?? 0;
                          deptTotals['Design'] += entry.design ?? 0;
                          deptTotals['Strategy'] += entry.strategy ?? 0;
                          deptTotals['Media'] += entry.media ?? 0;
                          deptTotals['Studio'] += entry.studio ?? 0;
                          deptTotals['Creator'] += entry.creator ?? 0;
                          deptTotals['Social'] += entry.social ?? 0;
                          deptTotals['Omni'] += entry.omni ?? 0;
                          deptTotals['Finance'] += entry.finance ?? 0;
                        });

                        const totalFees = Object.values(deptTotals).reduce((sum, val) => sum + val, 0);

                        return Object.entries(deptTotals).map(([dept, total]) => (
                          <tr key={dept} className="hover:bg-gray-50">
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{dept}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900">${total.toLocaleString()}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900">
                              {totalFees > 0 ? ((total / totalFees) * 100).toFixed(1) : 0}%
                            </td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}
        {isAdminMode && adminView === 'settings' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
              <Button
                onClick={() => {
                  setSettingsSaveStatus('saving');
                  // Save to cloudStorage
                  cloudStorage.setItem('pipeline-fx-rate', fxRate.toString());
                  cloudStorage.setItem('pipeline-fx-meta', JSON.stringify(fxMeta));
                  cloudStorage.setItem('pipeline-fx-log', JSON.stringify(fxLog));
                  cloudStorage.setItem('pipeline-client-settings', JSON.stringify(clientSettings));
                  cloudStorage.setItem('pipeline-settings-changelog', JSON.stringify(settingsChangeLog));
                  cloudStorage.setItem('pipeline-changelog', JSON.stringify(pipelineChangeLog));
                  cloudStorage.setItem('pipeline-month-locks', JSON.stringify(monthLocks));
                  cloudStorage.setItem('pipeline-month-notes', JSON.stringify(monthNotes));
                  setTimeout(() => setSettingsSaveStatus('saved'), 500);
                  setTimeout(() => setSettingsSaveStatus('idle'), 2000);
                }}
                className="bg-blue-600 text-white hover:bg-blue-700"
              >
                {settingsSaveStatus === 'saving' && '💾 Saving...'}
                {settingsSaveStatus === 'saved' && '✅ Saved!'}
                {settingsSaveStatus === 'idle' && 'Save Changes'}
              </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column - FX and Billing Entity */}
              <div className="space-y-6">
                {/* Foreign Exchange */}
                <div className="border rounded-lg p-4 bg-white">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Foreign Exchange</h3>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-sm font-medium text-gray-700">USD/CAD Exchange Rate</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={fxRate}
                        onChange={(e) => {
                          const newRate = parseFloat(e.target.value);
                          if (!isNaN(newRate) && newRate !== fxRate) {
                            const now = new Date();
                            const logEntry = {
                              from: fxRate,
                              to: newRate,
                              date: now.toISOString(),
                              user: user.name
                            };
                            setFxLog(prev => [logEntry, ...prev]);
                            setFxMeta({
                              date: now.toISOString(),
                              user: user.name
                            });
                            setFxRate(newRate);
                            
                            // Add to settings change log
                            setSettingsChangeLog(prev => [{
                              type: 'fx',
                              description: `Exchange rate changed from ${fxRate.toFixed(2)} to ${newRate.toFixed(2)}`,
                              date: now.toISOString(),
                              user: user.name
                            }, ...prev]);
                          }
                        }}
                        className="w-full mt-1"
                      />
                      {fxMeta && (
                        <p className="text-xs text-gray-500 mt-2">
                          Last saved on {new Date(fxMeta.date).toLocaleDateString()} at {new Date(fxMeta.date).toLocaleTimeString()} by {fxMeta.user}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Client Setup */}
                <div className="border rounded-lg p-4 bg-white">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Client Setup</h3>
                  <div className="max-h-[500px] overflow-y-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Billing Entity</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Business Owner</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {clientSettings
                          .sort((a, b) => {
                            // Sort "Other" and "NBD" clients to bottom
                            const aIsOther = a.name.startsWith('Other -') || a.name.startsWith('NBD -');
                            const bIsOther = b.name.startsWith('Other -') || b.name.startsWith('NBD -');
                            if (aIsOther && !bIsOther) return 1;
                            if (!aIsOther && bIsOther) return -1;
                            return a.name.localeCompare(b.name);
                          })
                          .map((client, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900">{client.name}</td>
                            <td className="px-3 py-3">
                              <Select
                                value={client.billingEntity}
                                onValueChange={(v) => {
                                  const oldEntity = client.billingEntity;
                                  const newEntity = v as 'Salt XC Canada' | 'Salt XC US';
                                  setClientSettings(prev => prev.map((c, i) => 
                                    i === idx ? { ...c, billingEntity: newEntity } : c
                                  ));
                                  
                                  // Add to settings change log
                                  const now = new Date();
                                  setSettingsChangeLog(prev => [{
                                    type: 'billing',
                                    description: `${client.name}: ${oldEntity} → ${newEntity}`,
                                    date: now.toISOString(),
                                    user: user.name
                                  }, ...prev]);
                                }}
                              >
                                <SelectTrigger className="h-8 text-xs w-full">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Salt XC Canada">Salt XC Canada</SelectItem>
                                  <SelectItem value="Salt XC US">Salt XC US</SelectItem>
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="px-3 py-3">
                              <Select
                                value={(client as any).businessOwner || ''}
                                onValueChange={(owner) => {
                                  setClientSettings(prev => prev.map((c, i) => 
                                    i === idx ? { ...c, businessOwner: owner } as any : c
                                  ));
                                  // Add to settings change log
                                  const now = new Date();
                                  setSettingsChangeLog(prev => [{
                                    type: 'billing',
                                    description: `${client.name}: Owner → ${owner}`,
                                    date: now.toISOString(),
                                    user: user.name
                                  }, ...prev]);
                                }}
                              >
                                <SelectTrigger className="h-8 text-xs w-full">
                                  <SelectValue placeholder="Select owner" />
                                </SelectTrigger>
                                <SelectContent>
                                  {['Rob C','Steve B','Dane H','Sandra R','Zak C','Carol P','Marcin B','Kait D','Bianca M','Meg Y','Mike M','Steve M','Ray V'].map(n => (
                                    <SelectItem key={n} value={n}>{n}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>

              {/* Right Column - Change Log */}
              <div>
                <div className="border rounded-lg p-4 bg-white h-full">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Change Log</h3>
                  <div className="max-h-[680px] overflow-y-auto space-y-2">
                    {settingsChangeLog.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-8">No changes logged yet</p>
                    ) : (
                      settingsChangeLog.map((log, idx) => (
                        <div key={idx} className="p-3 bg-gray-50 text-sm">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium mr-2 ${
                                log.type === 'fx' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                              }`}>
                                {log.type === 'fx' ? 'FX Rate' : 'Billing Entity'}
                              </span>
                              <p className="text-gray-900 mt-1 font-medium">{log.description}</p>
                            </div>
                          </div>
                          <div className="mt-2 text-xs text-gray-500">
                            {new Date(log.date).toLocaleDateString()} at {new Date(log.date).toLocaleTimeString()} • <span className="text-blue-600 font-medium">{log.user}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Month End Section */}
            <div className="border rounded-lg p-4 bg-white mt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Month End</h3>
              <div className="max-h-[500px] overflow-y-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Month</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Confirmed Fees</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Confirmed Revenue</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Month End</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {(() => {
                      // Get all months from the current year
                      const months = [
                        'January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'
                      ];

                      const result: any[] = [];

                      months.forEach((monthName, monthIndex) => {
                        let totalConfirmedFees = 0;
                        let totalConfirmedRevenue = 0;

                        // Get confirmed and non-confirmed entries for this month
                        const confirmedEntries: any[] = [];
                        const nonConfirmedEntries: any[] = [];

                        entries.forEach(entry => {
                          if (entry.startMonth) {
                            const [year, month] = entry.startMonth.split('-').map(Number);
                            
                            if (month === monthIndex + 1) {
                              if (entry.status?.toLowerCase() === 'confirmed') {
                                totalConfirmedFees += entry.totalFees || 0;
                                totalConfirmedRevenue += entry.revenue || 0;
                                confirmedEntries.push(entry);
                              } else {
                                nonConfirmedEntries.push(entry);
                              }
                            }
                          }
                        });

                        // Add month row
                        const currentDate = new Date();
                        const currentMonth = currentDate.getMonth(); // 0-11
                        const canLock = monthIndex <= currentMonth;
                        
                        result.push(
                          <tr key={`month-${monthIndex}`} className="hover:bg-gray-50 border-t border-gray-200">
                            <td className="px-3 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                              {monthName}
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap text-sm text-right text-gray-900">
                              ${totalConfirmedFees.toLocaleString()}
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap text-sm text-right text-gray-900">
                              ${totalConfirmedRevenue.toLocaleString()}
                            </td>
                            <td className="px-3 py-3 text-center">
                              {canLock ? (
                                <div className="flex items-center justify-center">
                                  {monthLocks[monthIndex] ? (
                                    <div className="flex items-center gap-2">
                                      {/* Unlocked icon - grayed out */}
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                                        <path d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2H7V7a3 3 0 015.905-.75 1 1 0 001.937-.5A5.002 5.002 0 0010 2z" />
                                      </svg>
                                      {/* Toggle switch - locked position */}
                                      <div className="relative inline-block w-12 h-6 bg-red-200 rounded-full cursor-not-allowed">
                                        <div className="absolute right-0 top-0 w-6 h-6 bg-red-600 rounded-full flex items-center justify-center shadow-md">
                                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-white" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                          </svg>
                                        </div>
                                      </div>
                                      {/* Locked icon - highlighted */}
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-600" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                      </svg>
                                    </div>
                                  ) : (
                                    <div 
                                      className="flex items-center gap-2 cursor-pointer"
                                      onClick={() => {
                                        // Check if there are any non-confirmed entries for this month
                                        const hasNonConfirmedEntries = entries.some(entry => {
                                          if (entry.startMonth) {
                                            const [year, month] = entry.startMonth.split('-').map(Number);
                                            return month === monthIndex + 1 && entry.status?.toLowerCase() !== 'confirmed';
                                          }
                                          return false;
                                        });

                                        if (hasNonConfirmedEntries) {
                                          alert('You must adjust or confirm remaining projects before month can close');
                                          return;
                                        }

                                        // Locking - require password
                                        const password = prompt(`Enter password to lock ${monthName}:\n\nWarning: Once locked, this month cannot be unlocked.`);
                                        if (password && password.trim()) {
                                          const confirmLock = window.confirm(
                                            `Are you sure you want to lock ${monthName}?\n\nThis action is permanent and cannot be undone. No entries for this month can be edited or deleted once locked.`
                                          );
                                          if (confirmLock) {
                                            const newLocks = { ...monthLocks };
                                            newLocks[monthIndex] = true;
                                            setMonthLocks(newLocks);
                                            
                                            // Add to change log
                                            const lockLog = {
                                              type: 'change' as const,
                                              projectCode: 'MONTH-END',
                                              projectName: `${monthName} Month End Lock`,
                                              client: 'System',
                                              description: `${monthName} has been locked and can no longer be edited`,
                                              date: new Date().toISOString(),
                                              user: user.name
                                            };
                                            setPipelineChangeLog(prev => [lockLog, ...prev]);
                                            
                                            // Save to cloudStorage
                                            try {
                                              const updatedLog = [lockLog, ...pipelineChangeLog];
                                              cloudStorage.setItem('pipeline-changelog', JSON.stringify(updatedLog));
                                            } catch (err) {
                                              console.error('Failed to save change log:', err);
                                            }
                                          }
                                        } else if (password !== null) {
                                          alert('Password is required to lock the month.');
                                        }
                                      }}
                                    >
                                      {/* Unlocked icon - highlighted */}
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600" viewBox="0 0 20 20" fill="currentColor">
                                        <path d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2H7V7a3 3 0 015.905-.75 1 1 0 001.937-.5A5.002 5.002 0 0010 2z" />
                                      </svg>
                                      {/* Toggle switch - unlocked position */}
                                      <div className="relative inline-block w-12 h-6 bg-green-200 rounded-full transition-all hover:bg-green-300">
                                        <div className="absolute left-0 top-0 w-6 h-6 bg-green-600 rounded-full flex items-center justify-center shadow-md transition-all">
                                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-white" viewBox="0 0 20 20" fill="currentColor">
                                            <path d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2H7V7a3 3 0 015.905-.75 1 1 0 001.937-.5A5.002 5.002 0 0010 2z" />
                                          </svg>
                                        </div>
                                      </div>
                                      {/* Locked icon - grayed out */}
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                      </svg>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="flex items-center justify-center">
                                  <div className="flex items-center gap-2 opacity-40 cursor-not-allowed">
                                    {/* Unlocked icon - disabled */}
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                                      <path d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2H7V7a3 3 0 015.905-.75 1 1 0 001.937-.5A5.002 5.002 0 0010 2z" />
                                    </svg>
                                    {/* Toggle switch - disabled unlocked position */}
                                    <div className="relative inline-block w-12 h-6 bg-gray-200 rounded-full">
                                      <div className="absolute left-0 top-0 w-6 h-6 bg-gray-400 rounded-full flex items-center justify-center shadow-md">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-white" viewBox="0 0 20 20" fill="currentColor">
                                          <path d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2H7V7a3 3 0 015.905-.75 1 1 0 001.937-.5A5.002 5.002 0 0010 2z" />
                                        </svg>
                                      </div>
                                    </div>
                                    {/* Locked icon - disabled */}
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                    </svg>
                                  </div>
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-3">
                              <textarea
                                value={monthNotes[monthIndex] || ''}
                                onChange={(e) => {
                                  setMonthNotes({
                                    ...monthNotes,
                                    [monthIndex]: e.target.value
                                  });
                                }}
                                placeholder="Add notes for this month..."
                                className="w-full text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                rows={2}
                              />
                            </td>
                          </tr>
                        );

                        // Add non-confirmed entries as sublines
                        nonConfirmedEntries.forEach((entry, entryIdx) => {
                          result.push(
                            <tr 
                              key={`${monthIndex}-entry-${entryIdx}`} 
                              className="bg-gray-50 hover:bg-gray-100"
                            >
                              <td className="px-3 py-2 pl-8 text-xs text-gray-600">
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      // Find the actual index of this entry in the entries array
                                      const actualIndex = entries.findIndex(e => 
                                        e.projectCode === entry.projectCode && 
                                        e.client === entry.client && 
                                        e.programName === entry.programName &&
                                        e.startMonth === entry.startMonth
                                      );
                                      if (actualIndex !== -1) {
                                        handleEditEntry(actualIndex);
                                      }
                                    }}
                                    className="text-gray-600 hover:text-blue-600 transition-colors"
                                    title="Edit entry"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                  </button>
                                  <span className="italic">
                                    {entry.projectCode} - {entry.client} - {entry.programName}
                                    <span className="ml-2 inline-block px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                                      {entry.status}
                                    </span>
                                  </span>
                                </div>
                              </td>
                              <td className="px-3 py-2 text-xs text-right text-gray-600">
                                ${(entry.totalFees || 0).toLocaleString()}
                              </td>
                              <td className="px-3 py-2 text-xs text-right text-gray-600">
                                ${(entry.revenue || 0).toLocaleString()}
                              </td>
                              <td className="px-3 py-2"></td>
                              <td className="px-3 py-2"></td>
                            </tr>
                          );
                        });
                      });

                      return result;
                    })()}
                    {/* Total Row */}
                    <tr className="bg-blue-100 font-bold border-t-2 border-gray-300">
                      <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900">
                        TOTAL
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-sm text-right text-gray-900">
                        ${(() => {
                          let total = 0;
                          entries.forEach(entry => {
                            if (entry.status?.toLowerCase() === 'confirmed') {
                              total += entry.totalFees || 0;
                            }
                          });
                          return total.toLocaleString();
                        })()}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-sm text-right text-gray-900">
                        ${(() => {
                          let total = 0;
                          entries.forEach(entry => {
                            if (entry.status?.toLowerCase() === 'confirmed') {
                              total += entry.revenue || 0;
                            }
                          });
                          return total.toLocaleString();
                        })()}
                      </td>
                      <td className="px-3 py-3"></td>
                      <td className="px-3 py-3"></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
        {/* User View Content - shown when NOT in admin mode */}
        {!isAdminMode && selectedUserView === 'executive' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Financial Health</h2>
            
            {/* % of Year Complete and % of Plan Confirmed Tiles */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* % of Year Complete */}
              <div className="bg-white p-6 border border-gray-200 rounded-lg shadow-sm">
                <dt className="text-sm font-medium text-gray-500 mb-2">% of Year Complete</dt>
                <dd className="metric-value text-blue-600 mb-4">
                  {(() => {
                    const now = new Date();
                    const start = new Date(now.getFullYear(), 0, 1);
                    const diffDays = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                    const yearPct = Math.max(0, Math.min(100, (diffDays / 365) * 100));
                    return Math.round(yearPct);
                  })()}%
                </dd>
                <div className="h-2 w-full bg-gray-200 rounded">
                  <div 
                    className="h-2 bg-blue-600 rounded" 
                    style={{ 
                      width: `${(() => {
                        const now = new Date();
                        const start = new Date(now.getFullYear(), 0, 1);
                        const diffDays = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                        return Math.max(0, Math.min(100, (diffDays / 365) * 100));
                      })()}%` 
                    }}
                  ></div>
                </div>
              </div>

              {/* % of Plan Confirmed */}
              <div className="bg-white p-6 border border-gray-200 rounded-lg shadow-sm">
                <dt className="text-sm font-medium text-gray-500 mb-2">% of Plan Confirmed</dt>
                <dd className="metric-value text-green-600 mb-4">
                  {(() => {
                    const totalPlanFees = Object.values(annualPlanEntries).reduce((sum, v: any) => sum + (v?.planFees || 0), 0);
                    const confirmedTotal = filteredEntries.filter(e => e.status === 'Confirmed').reduce((sum, e) => sum + (e.totalFees || 0), 0);
                    const planPct = totalPlanFees > 0 ? Math.max(0, Math.min(100, (confirmedTotal / totalPlanFees) * 100)) : 0;
                    return Math.round(planPct);
                  })()}%
                </dd>
                <div className="h-2 w-full bg-gray-200 rounded">
                  <div 
                    className="h-2 bg-green-600 rounded" 
                    style={{ 
                      width: `${(() => {
                        const totalPlanFees = Object.values(annualPlanEntries).reduce((sum, v: any) => sum + (v?.planFees || 0), 0);
                        const confirmedTotal = filteredEntries.filter(e => e.status === 'Confirmed').reduce((sum, e) => sum + (e.totalFees || 0), 0);
                        return totalPlanFees > 0 ? Math.max(0, Math.min(100, (confirmedTotal / totalPlanFees) * 100)) : 0;
                      })()}%` 
                    }}
                  ></div>
                </div>
              </div>
            </div>

            {/* All Executive Summary Tiles - 9 tiles in 2 rows */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
              {/* Total Potential Fees */}
              <div className="bg-white p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Total Potential Fees</dt>
                      <dd className="text-[24px] font-medium text-gray-900">
                        ${filteredEntries.reduce((sum, entry) => sum + entry.totalFees, 0).toLocaleString()}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>

              {/* Total Weighted Fees */}
              <div className="bg-white p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Total Weighted Fees</dt>
                      <dd className="text-[24px] font-medium text-gray-900">
                        ${filteredEntries.reduce((sum, entry) => {
                          const statusMultiplier = {
                            'Confirmed': 1.0,
                            'Open': 0.9,
                            'High Pitch': 0.75,
                            'Medium Pitch': 0.5,
                            'Low Pitch': 0.1,
                            'Whitespace': 0.0,
                            'Finance Review': 0.9
                          }[entry.status] || 0.9;
                          return sum + (entry.totalFees * statusMultiplier);
                        }, 0).toLocaleString()}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>

              {/* Monthly Projects to Close */}
              <div className="bg-white p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Current Month - Fees to Close</dt>
                      <dd className="text-[24px] font-medium text-gray-900">
                        ${(() => {
                          const now = new Date();
                          const currentYear = now.getFullYear();
                          const currentMonth = now.getMonth();
                          
                          return filteredEntries
                            .filter(e => {
                              if (e.status === 'Confirmed') return false;
                              if (e.startMonth) {
                                const startDate = new Date(e.startMonth);
                                return startDate.getFullYear() === currentYear && 
                                       startDate.getMonth() === currentMonth;
                              }
                              return false;
                            })
                            .reduce((sum, entry) => sum + entry.totalFees, 0)
                            .toLocaleString();
                        })()}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
            {/* Status Breakdown Tiles */}
            <div className="mb-8 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {/* Confirmed */}
              <div className="bg-white rounded-lg shadow p-4 border-l-4 border-emerald-500">
                <div className="text-center">
                  <div className="text-sm font-medium text-gray-500">Confirmed</div>
                  <div className="text-[24px] font-medium text-gray-900">
                    ${filteredEntries.filter(e => e.status === 'Confirmed').reduce((sum, entry) => sum + entry.totalFees, 0).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Open */}
              <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
                <div className="text-center">
                  <div className="text-sm font-medium text-gray-500">Open</div>
                  <div className="text-[24px] font-medium text-gray-900">
                    ${filteredEntries.filter(e => e.status === 'Open').reduce((sum, entry) => sum + entry.totalFees, 0).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* High Pitch */}
              <div className="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-500">
                <div className="text-center">
                  <div className="text-sm font-medium text-gray-500">High Pitch</div>
                  <div className="text-[24px] font-medium text-gray-900">
                    ${filteredEntries.filter(e => e.status === 'High Pitch').reduce((sum, entry) => sum + entry.totalFees, 0).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Medium Pitch */}
              <div className="bg-white rounded-lg shadow p-4 border-l-4 border-orange-500">
                <div className="text-center">
                  <div className="text-sm font-medium text-gray-500">Medium Pitch</div>
                  <div className="text-[24px] font-medium text-gray-900">
                    ${filteredEntries.filter(e => e.status === 'Medium Pitch').reduce((sum, entry) => sum + entry.totalFees, 0).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Low Pitch */}
              <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-500">
                <div className="text-center">
                  <div className="text-sm font-medium text-gray-500">Low Pitch</div>
                  <div className="text-[24px] font-medium text-gray-900">
                    ${filteredEntries.filter(e => e.status === 'Low Pitch').reduce((sum, entry) => sum + entry.totalFees, 0).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Whitespace */}
              <div className="bg-white rounded-lg shadow p-4 border-l-4 border-gray-500">
                <div className="text-center">
                  <div className="text-sm font-medium text-gray-500">Whitespace</div>
                  <div className="text-[24px] font-medium text-gray-900">
                    ${filteredEntries.filter(e => e.status === 'Whitespace').reduce((sum, entry) => sum + entry.totalFees, 0).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>

            {/* Newsfeed */}
            <div className="mt-8">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Newsfeed</h3>
              <div className="space-y-4">
                {/* Project Additions */}
                <div className="bg-white border rounded-lg shadow overflow-hidden">
                  <div className="bg-green-100 px-6 py-3 border-b border-green-200">
                    <h4 className="text-lg font-semibold text-green-700 flex items-center">
                      <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                      </svg>
                      Project Additions
                    </h4>
                  </div>
                  <div className="p-6">
                    <div className="max-h-64 overflow-y-auto space-y-2">
                      {pipelineChangeLog.filter(log => log.type === 'addition').length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-4">No additions yet</p>
                      ) : (
                        pipelineChangeLog.filter(log => log.type === 'addition').map((log, idx) => (
                          <div key={idx} className="p-3 bg-green-50 rounded border border-green-200 text-sm">
                            <div className="flex items-center justify-between gap-4">
                              <span className="font-medium text-gray-900">{log.projectCode}</span>
                              <span className="text-gray-600">{log.client || 'N/A'}</span>
                              <span className="text-gray-700 flex-1">{log.projectName}</span>
                              <span className="text-xs text-gray-600 whitespace-nowrap">
                                {new Date(log.date).toLocaleDateString()} at {new Date(log.date).toLocaleTimeString()}
                              </span>
                              <span className="text-xs text-blue-600 font-medium">{log.user}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Project Changes */}
                <div className="bg-white border rounded-lg shadow overflow-hidden">
                  <div className="bg-blue-100 px-6 py-3 border-b border-blue-200">
                    <h4 className="text-lg font-semibold text-blue-700 flex items-center">
                      <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                      </svg>
                      Project Changes
                    </h4>
                  </div>
                  <div className="p-6">
                    <div className="max-h-64 overflow-y-auto space-y-2">
                      {pipelineChangeLog.filter(log => log.type === 'change').length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-4">No changes yet</p>
                      ) : (
                        pipelineChangeLog.filter(log => log.type === 'change').map((log, idx) => (
                          <div key={idx} className="p-3 bg-blue-50 rounded border border-blue-200 text-sm">
                            <div className="flex items-start justify-between gap-4">
                              <span className="font-medium text-gray-900">{log.projectCode}</span>
                              <span className="text-gray-600">{log.client || 'N/A'}</span>
                              <span className="text-gray-700 flex-1">{log.projectName}</span>
                              <div className="flex flex-col items-end">
                                <span className="text-xs text-gray-600 whitespace-nowrap">
                                  {new Date(log.date).toLocaleDateString()} at {new Date(log.date).toLocaleTimeString()}
                                </span>
                                <span className="text-xs text-blue-600 font-medium">{log.user}</span>
                              </div>
                            </div>
                            <div className="mt-2 text-xs text-gray-600 pl-0">
                              {log.description}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Project Deletions */}
                <div className="bg-white border rounded-lg shadow overflow-hidden">
                  <div className="bg-red-100 px-6 py-3 border-b border-red-200">
                    <h4 className="text-lg font-semibold text-red-700 flex items-center">
                      <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                      Project Deletions
                    </h4>
                  </div>
                  <div className="p-6">
                    <div className="max-h-64 overflow-y-auto space-y-2">
                      {pipelineChangeLog.filter(log => log.type === 'deletion').length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-4">No deletions yet</p>
                      ) : (
                        pipelineChangeLog.filter(log => log.type === 'deletion').map((log, idx) => (
                          <div key={idx} className="p-3 bg-red-50 rounded border border-red-200 text-sm">
                            <div className="flex items-center justify-between gap-4">
                              <span className="font-medium text-gray-900">{log.projectCode}</span>
                              <span className="text-gray-600">{log.client || 'N/A'}</span>
                              <span className="text-gray-700 flex-1">{log.projectName}</span>
                              <span className="text-xs text-gray-600 whitespace-nowrap">
                                {new Date(log.date).toLocaleDateString()} at {new Date(log.date).toLocaleTimeString()}
                              </span>
                              <span className="text-xs text-blue-600 font-medium">{log.user}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {!isAdminMode && selectedUserView === 'pipeline' && (
          <div className="space-y-6">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Pipeline</h2>
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Input
                    type="text"
                    placeholder="Search by project, client, region, program type..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-80 pl-10"
                  />
                  <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button className="bg-black text-white hover:bg-gray-800">
                      Add Entry
                      <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setDialogOpen(true)}>
                      Add New
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setAddToCurrentDialogOpen(true)}>
                      Add to Current
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div className="bg-white shadow rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr className="text-left border-b border-gray-200">
                      <th className="px-2 py-3 w-12 text-center"></th>
                      <th className="px-4 py-3 text-center w-32">Status</th>
                      <th className="px-4 py-3 w-[8.05rem] min-w-[8.05rem]">Project #</th>
                      <th className="px-4 py-3 w-[8.28rem] min-w-[8.28rem]">Owner</th>
                      <th className="px-4 py-3 w-[9.9rem] min-w-[9.9rem]">Client</th>
                      <th className="px-4 py-3 w-[10rem] min-w-[10rem]">Program</th>
                      <th className="px-4 py-3 w-28">Start Month</th>
                      <th className="px-4 py-3 w-28">End Month</th>
                      <th className="px-4 py-3 text-right w-32 bg-[#e4edf9] text-[#223bb2]">Revenue</th>
                      <th className="px-4 py-3 text-right w-32 bg-[#e4edf9] text-[#223bb2]">Total Fees</th>
                      <th className="px-4 py-3 text-right w-28">Accounts</th>
                      <th className="px-4 py-3 text-right w-28">Creative</th>
                      <th className="px-4 py-3 text-right w-28">Design</th>
                      <th className="px-4 py-3 text-right w-36">Strategy</th>
                      <th className="px-4 py-3 text-right w-24">Media</th>
                      <th className="px-4 py-3 text-right w-24">Studio</th>
                      <th className="px-4 py-3 text-right w-24">Creator</th>
                      <th className="px-4 py-3 text-right w-24">Social</th>
                      <th className="px-4 py-3 text-right w-32">Omni Shopper</th>
                      <th className="px-4 py-3 text-right w-24">Finance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEntries.length === 0 && entries.length === 0 && [1,2,3,4,5].map((i) => (
                      <tr key={i} className="border-b border-gray-100">
                        <td className="px-2 py-3 text-center w-12">
                          <span className="text-gray-400">—</span>
                        </td>
                        <td className="px-4 py-3 text-center w-32">
                          <span className="inline-block px-2 py-1 text-xs rounded bg-gray-100 text-gray-700">—</span>
                        </td>
                        <td className="px-4 py-3 text-gray-400 w-[8.05rem]">—</td>
                        <td className="px-4 py-3 text-gray-400 w-[8.28rem]">—</td>
                        <td className="px-4 py-3 text-gray-400 w-[9.9rem]">—</td>
                        <td className="px-4 py-3 text-gray-400 w-[10rem] min-w-[10rem]">—</td>
                        <td className="px-4 py-3 text-gray-400 w-28">—</td>
                        <td className="px-4 py-3 text-gray-400 w-28">—</td>
                        <td className="px-4 py-3 text-right text-gray-400 bg-[#f6f9ff] w-32">—</td>
                        <td className="px-4 py-3 text-right text-gray-400 bg-[#f6f9ff] w-32">—</td>
                        <td className="px-4 py-3 text-right text-gray-400 w-28">—</td>
                        <td className="px-4 py-3 text-right text-gray-400 w-28">—</td>
                        <td className="px-4 py-3 text-right text-gray-400 w-28">—</td>
                        <td className="px-4 py-3 text-right text-gray-400 w-36">—</td>
                        <td className="px-4 py-3 text-right text-gray-400 w-24">—</td>
                        <td className="px-4 py-3 text-right text-gray-400 w-24">—</td>
                        <td className="px-4 py-3 text-right text-gray-400 w-24">—</td>
                        <td className="px-4 py-3 text-right text-gray-400 w-24">—</td>
                        <td className="px-4 py-3 text-right text-gray-400 w-32">—</td>
                        <td className="px-4 py-3 text-right text-gray-400 w-24">—</td>
                      </tr>
                    ))}
                    {filteredEntries.length === 0 && entries.length > 0 && (
                      <tr>
                        <td colSpan={20} className="px-4 py-8 text-center text-gray-500">
                          No entries found matching "{searchTerm}"
                        </td>
                      </tr>
                    )}
                    {filteredEntries.map((e, idx) => {
                      const originalIndex = entries.findIndex(entry => entry.projectCode === e.projectCode);
                      return (
                        <tr key={idx} className="border-b border-gray-100">
                          <td className="px-2 py-3 text-center w-12">
                            {e.status === 'Confirmed' ? (
                              <button 
                                className="text-gray-300 cursor-not-allowed"
                                title="Confirmed entries cannot be edited"
                                disabled
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                            ) : (
                              <button 
                                className="text-gray-600 hover:text-blue-600 transition-colors"
                                title="Edit entry"
                                onClick={() => handleEditEntry(originalIndex)}
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center w-32">
                            <span className={`inline-block px-2 py-1 text-xs rounded font-medium ${
                              e.status === 'Confirmed' ? 'bg-green-100 text-green-800' :
                              e.status === 'Open' ? 'bg-blue-100 text-blue-800' :
                              e.status === 'High Pitch' ? 'bg-yellow-100 text-yellow-800' :
                              e.status === 'Medium Pitch' ? 'bg-orange-100 text-orange-800' :
                              e.status === 'Low Pitch' ? 'bg-red-100 text-red-800' :
                              e.status === 'Whitespace' ? 'bg-gray-100 text-gray-800' :
                              e.status === 'Finance Review' ? 'bg-purple-100 text-purple-800' :
                              e.status === 'Pending Deletion' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-700'
                            }`}>{e.status}</span>
                          </td>
                          <td className="px-4 py-3 w-[8.05rem] min-w-[8.05rem]">{e.projectCode}</td>
                          <td className="px-4 py-3 w-[8.28rem] min-w-[8.28rem]">{e.owner}</td>
                          <td className="px-4 py-3 w-[9.9rem] min-w-[9.9rem]">{e.client}</td>
                          <td className="px-4 py-3 w-[10rem] min-w-[10rem]">
                            <div className="flex items-center gap-2 min-w-[10rem]">
                              {e.programName}
                              {spansMultipleYears(e.startMonth, e.endMonth) && (
                                <span className="inline-flex items-center" title="Project spans multiple calendar years - fee deferral required">
                                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <circle cx="12" cy="12" r="9" strokeWidth="2" />
                                    <path d="M10 8l6 4-6 4V8z" strokeWidth="2" fill="currentColor" />
                                  </svg>
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 w-28">{formatMonthYear(e.startMonth)}</td>
                          <td className="px-4 py-3 w-28">{formatMonthYear(e.endMonth)}</td>
                          <td className={`px-4 py-3 text-right bg-[#f6f9ff] w-32 ${(e.revenue ?? 0) === 0 ? 'opacity-40 text-gray-400' : ''}`}>${(e.revenue ?? 0).toLocaleString()}</td>
                          <td className={`px-4 py-3 text-right bg-[#f6f9ff] w-32 ${(e.totalFees ?? 0) === 0 ? 'opacity-40 text-gray-400' : ''}`}>${(e.totalFees ?? 0).toLocaleString()}</td>
                          <td className={`px-4 py-3 text-right w-28 ${(e.accounts ?? 0) === 0 ? 'opacity-40 text-gray-400' : ''}`}>${(e.accounts ?? 0).toLocaleString()}</td>
                          <td className={`px-4 py-3 text-right w-28 ${(e.creative ?? 0) === 0 ? 'opacity-40 text-gray-400' : ''}`}>${(e.creative ?? 0).toLocaleString()}</td>
                          <td className={`px-4 py-3 text-right w-28 ${(e.design ?? 0) === 0 ? 'opacity-40 text-gray-400' : ''}`}>${(e.design ?? 0).toLocaleString()}</td>
                          <td className={`px-4 py-3 text-right w-36 ${(e.strategy ?? 0) === 0 ? 'opacity-40 text-gray-400' : ''}`}>${(e.strategy ?? 0).toLocaleString()}</td>
                          <td className={`px-4 py-3 text-right w-24 ${(e.media ?? 0) === 0 ? 'opacity-40 text-gray-400' : ''}`}>${(e.media ?? 0).toLocaleString()}</td>
                          <td className={`px-4 py-3 text-right w-24 ${(e.studio ?? 0) === 0 ? 'opacity-40 text-gray-400' : ''}`}>${(e.studio ?? 0).toLocaleString()}</td>
                          <td className={`px-4 py-3 text-right w-24 ${(e.creator ?? 0) === 0 ? 'opacity-40 text-gray-400' : ''}`}>${(e.creator ?? 0).toLocaleString()}</td>
                          <td className={`px-4 py-3 text-right w-24 ${(e.social ?? 0) === 0 ? 'opacity-40 text-gray-400' : ''}`}>${(e.social ?? 0).toLocaleString()}</td>
                          <td className={`px-4 py-3 text-right w-32 ${(e.omni ?? 0) === 0 ? 'opacity-40 text-gray-400' : ''}`}>${(e.omni ?? 0).toLocaleString()}</td>
                          <td className={`px-4 py-3 text-right w-24 ${(e.finance ?? 0) === 0 ? 'opacity-40 text-gray-400' : ''}`}>${(e.finance ?? 0).toLocaleString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Business Owner Settings View */}
        {!isAdminMode && selectedUserView === 'settings' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Settings</h2>
            
            {/* Team Member Access Section */}
            <div className="bg-white p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Team Member Access</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Grant team members access to view or edit your pipeline. Limited to Director and above roles and employees only. Maximum 10 members.
                  </p>
                </div>
                <Button 
                  onClick={() => setShowAddMemberDialog(true)}
                  disabled={teamMembers.length >= 10}
                  className="bg-black text-white hover:bg-gray-800"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Member
                </Button>
              </div>

              {/* Team Members List */}
              {teamMembers.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <svg className="w-12 h-12 mx-auto mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <p>No team members added yet</p>
                  <p className="text-sm mt-1">Click "Add Member" to grant access to your team</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Permission</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {teamMembers.map((member) => (
                        <tr key={member.id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                                <span className="text-blue-600 font-medium text-sm">
                                  {member.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                                </span>
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900">{member.name}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-gray-900">{member.role}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Select
                              value={member.permission}
                              onValueChange={(value) => handleUpdatePermission(member.id, value as 'View' | 'Edit')}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="View">View</SelectItem>
                                <SelectItem value="Edit">Edit</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button
                              onClick={() => handleRemoveTeamMember(member.id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {teamMembers.length > 0 && (
                <div className="mt-4 text-sm text-gray-600">
                  {teamMembers.length} of 10 members added
                </div>
              )}
            </div>
          </div>
        )}

      </main>
      {/* Add Team Member Dialog */}
      <Dialog open={showAddMemberDialog} onOpenChange={setShowAddMemberDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Team Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <Input
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
                placeholder="Enter team member name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <Select value={newMemberRole} onValueChange={setNewMemberRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {availableRoles.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Permission</label>
              <Select value={newMemberPermission} onValueChange={(val) => setNewMemberPermission(val as 'View' | 'Edit')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="View">View Only</SelectItem>
                  <SelectItem value="Edit">View & Edit</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddMemberDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddTeamMember} className="bg-black text-white hover:bg-gray-800">
              Add Member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add to Current Dialog - Select Parent Project */}
      <Dialog open={addToCurrentDialogOpen} onOpenChange={setAddToCurrentDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Select Parent Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Parent Project</Label>
              <Select value={selectedParentProject} onValueChange={setSelectedParentProject}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  {entries.map((entry) => (
                    <SelectItem key={entry.projectCode} value={entry.projectCode}>
                      {entry.projectCode} - {entry.client} - {entry.programName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setAddToCurrentDialogOpen(false);
              setSelectedParentProject('');
            }}>
              Cancel
            </Button>
            <Button className="bg-black text-white hover:bg-gray-800" onClick={handleAddToCurrentSubmit}>
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Entry Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
            <DialogTitle>Add Pipeline Entry</DialogTitle>
            </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Project Number</Label>
              <Input value={form.projectCode} readOnly className="bg-gray-50" />
            </div>
            <div>
              <Label>Entry Type</Label>
              <Select value={form.entryType} onValueChange={(v) => setForm(prev => ({...prev, entryType: v as any}))}>
                <SelectTrigger><SelectValue placeholder="Select entry type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="In Plan">In Plan</SelectItem>
                  <SelectItem value="New to Plan">New to Plan</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm(prev => ({...prev, status: v}))}>
                <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(s => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Owner</Label>
              <Select value={form.owner} onValueChange={(v) => setForm(prev => ({...prev, owner: v}))}>
                <SelectTrigger><SelectValue placeholder="Select owner" /></SelectTrigger>
                <SelectContent>
                  {OWNER_OPTIONS.map(o => (<SelectItem key={o} value={o}>{o}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label>Client</Label>
              <Select value={form.client} onValueChange={(v) => setForm(prev => ({...prev, client: v}))}>
                <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                    <SelectContent>
                  {CLIENT_LIST.map(c => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
            <div className="md:col-span-2">
              <Label>Program Name</Label>
              <Input 
                value={form.programName} 
                onChange={(e) => setForm(prev => ({...prev, programName: e.target.value}))} 
                maxLength={30}
              />
            </div>
            <div>
              <Label>Region</Label>
              <Select value={form.region} onValueChange={(v) => setForm(prev => ({...prev, region: v}))}>
                <SelectTrigger><SelectValue placeholder="Select region" /></SelectTrigger>
                <SelectContent>
                  {REGION_OPTIONS.map(r => (<SelectItem key={r} value={r}>{r}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Program Type</Label>
              <Select value={form.programType} onValueChange={(v) => setForm(prev => ({...prev, programType: v}))}>
                <SelectTrigger><SelectValue placeholder="Select program type" /></SelectTrigger>
                <SelectContent>
                  {PROGRAM_TYPE_OPTIONS.map(p => (<SelectItem key={p} value={p}>{p}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Start Date</Label>
              <Input 
                type="date" 
                value={form.startMonth} 
                onChange={(e) => setForm(prev => ({...prev, startMonth: e.target.value}))}
                className="w-full"
              />
              <p className="text-xs text-gray-500 mt-1">Select the project start date</p>
            </div>
            <div>
              <Label>End Date</Label>
              <Input 
                type="date" 
                value={form.endMonth} 
                onChange={(e) => setForm(prev => ({...prev, endMonth: e.target.value}))}
                className="w-full"
              />
              <p className="text-xs text-gray-500 mt-1">Select the project end date</p>
            </div>
                  <div>
              <Label>Revenue</Label>
              <Input value={form.revenue} onChange={(e) => handleCurrencyChange('revenue', e.target.value)} placeholder="$0" />
                  </div>
                  <div>
              <Label>Total Fees (auto)</Label>
              <Input value={'$' + computedTotalFees.toLocaleString()} readOnly className="bg-gray-50" />
                  </div>
                  </div>
          <div className="mt-4">
            <Label>Department Fees</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2">
              <Input placeholder="Accounts" value={form.accounts} onChange={(e) => handleCurrencyChange('accounts', e.target.value)} />
              <Input placeholder="Creative" value={form.creative} onChange={(e) => handleCurrencyChange('creative', e.target.value)} />
              <Input placeholder="Design" value={form.design} onChange={(e) => handleCurrencyChange('design', e.target.value)} />
              <Input placeholder="Strategy" value={form.strategy} onChange={(e) => handleCurrencyChange('strategy', e.target.value)} />
              <Input placeholder="Media" value={form.media} onChange={(e) => handleCurrencyChange('media', e.target.value)} />
              <Input placeholder="Studio" value={form.studio} onChange={(e) => handleCurrencyChange('studio', e.target.value)} />
              <Input placeholder="Creator" value={form.creator} onChange={(e) => handleCurrencyChange('creator', e.target.value)} />
              <Input placeholder="Social" value={form.social} onChange={(e) => handleCurrencyChange('social', e.target.value)} />
              <Input placeholder="Omni Shopper" value={form.omni} onChange={(e) => handleCurrencyChange('omni', e.target.value)} />
              <Input placeholder="Finance" value={form.finance} onChange={(e) => handleCurrencyChange('finance', e.target.value)} />
                  </div>
                </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button className="bg-black text-white hover:bg-gray-800" onClick={handleSaveEntry}>Save Entry</Button>
          </DialogFooter>
          </DialogContent>
        </Dialog>
        {/* Edit Entry Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-[95vw] w-full max-h-[95vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Pipeline Entry</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Project Number</Label>
                <Input value={editForm.projectCode} readOnly className="bg-gray-50" />
              </div>
            <div>
              <Label>Entry Type</Label>
              <Select value={editForm.entryType} onValueChange={(v) => setEditForm(prev => ({...prev, entryType: v as any}))}>
                <SelectTrigger><SelectValue placeholder="Select entry type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="In Plan">In Plan</SelectItem>
                  <SelectItem value="New to Plan">New to Plan</SelectItem>
                </SelectContent>
              </Select>
            </div>
              <div>
                <Label>Status</Label>
                <Select value={editForm.status} onValueChange={(v) => setEditForm(prev => ({...prev, status: v}))}>
                  <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(s => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Owner</Label>
                <Select value={editForm.owner} onValueChange={(v) => setEditForm(prev => ({...prev, owner: v}))}>
                  <SelectTrigger><SelectValue placeholder="Select owner" /></SelectTrigger>
                  <SelectContent>
                    {OWNER_OPTIONS.map(o => (<SelectItem key={o} value={o}>{o}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Client</Label>
                <Select value={editForm.client} onValueChange={(v) => setEditForm(prev => ({...prev, client: v}))}>
                  <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>
                    {CLIENT_LIST.map(c => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label>Program Name</Label>
                <Input 
                  value={editForm.programName} 
                  onChange={(e) => setEditForm(prev => ({...prev, programName: e.target.value}))} 
                  maxLength={30}
                />
              </div>
              <div>
                <Label>Region</Label>
                <Select value={editForm.region} onValueChange={(v) => setEditForm(prev => ({...prev, region: v}))}>
                  <SelectTrigger><SelectValue placeholder="Select region" /></SelectTrigger>
                  <SelectContent>
                    {REGION_OPTIONS.map(r => (<SelectItem key={r} value={r}>{r}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Program Type</Label>
                <Select value={editForm.programType} onValueChange={(v) => setEditForm(prev => ({...prev, programType: v}))}>
                  <SelectTrigger><SelectValue placeholder="Select program type" /></SelectTrigger>
                  <SelectContent>
                    {PROGRAM_TYPE_OPTIONS.map(p => (<SelectItem key={p} value={p}>{p}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Start Date</Label>
                <Input 
                  type="date" 
                  value={editForm.startMonth} 
                  onChange={(e) => setEditForm(prev => ({...prev, startMonth: e.target.value}))}
                  className="w-full"
                />
                <p className="text-xs text-gray-500 mt-1">Select the project start date</p>
              </div>
              <div>
                <Label>End Date</Label>
                <Input 
                  type="date" 
                  value={editForm.endMonth} 
                  onChange={(e) => setEditForm(prev => ({...prev, endMonth: e.target.value}))}
                  className="w-full"
                />
                <p className="text-xs text-gray-500 mt-1">Select the project end date</p>
              </div>
              <div>
                <Label>Revenue</Label>
                <Input value={editForm.revenue} onChange={(e) => handleEditCurrencyChange('revenue', e.target.value)} placeholder="$0" />
              </div>
              <div>
                <Label>Total Fees (auto)</Label>
                <Input value={'$' + computedEditTotalFees.toLocaleString()} readOnly className="bg-gray-50" />
              </div>
            </div>
            <div className="mt-6">
              <Label className="text-base font-semibold">Department Fees</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mt-3">
                <div>
                  <Label className="text-xs text-gray-600">Accounts</Label>
                  <Input value={editForm.accounts} onChange={(e) => handleEditCurrencyChange('accounts', e.target.value)} placeholder="$0" />
                </div>
                <div>
                  <Label className="text-xs text-gray-600">Creative</Label>
                  <Input value={editForm.creative} onChange={(e) => handleEditCurrencyChange('creative', e.target.value)} placeholder="$0" />
                </div>
                <div>
                  <Label className="text-xs text-gray-600">Design</Label>
                  <Input value={editForm.design} onChange={(e) => handleEditCurrencyChange('design', e.target.value)} placeholder="$0" />
                </div>
                <div>
                  <Label className="text-xs text-gray-600">Strategy</Label>
                  <Input value={editForm.strategy} onChange={(e) => handleEditCurrencyChange('strategy', e.target.value)} placeholder="$0" />
                </div>
                <div>
                  <Label className="text-xs text-gray-600">Media</Label>
                  <Input value={editForm.media} onChange={(e) => handleEditCurrencyChange('media', e.target.value)} placeholder="$0" />
                </div>
                <div>
                  <Label className="text-xs text-gray-600">Studio</Label>
                  <Input value={editForm.studio} onChange={(e) => handleEditCurrencyChange('studio', e.target.value)} placeholder="$0" />
                </div>
                <div>
                  <Label className="text-xs text-gray-600">Creator</Label>
                  <Input value={editForm.creator} onChange={(e) => handleEditCurrencyChange('creator', e.target.value)} placeholder="$0" />
                </div>
                <div>
                  <Label className="text-xs text-gray-600">Social</Label>
                  <Input value={editForm.social} onChange={(e) => handleEditCurrencyChange('social', e.target.value)} placeholder="$0" />
                </div>
                <div>
                  <Label className="text-xs text-gray-600">Omni Shopper</Label>
                  <Input value={editForm.omni} onChange={(e) => handleEditCurrencyChange('omni', e.target.value)} placeholder="$0" />
                </div>
                <div>
                  <Label className="text-xs text-gray-600">Finance</Label>
                  <Input value={editForm.finance} onChange={(e) => handleEditCurrencyChange('finance', e.target.value)} placeholder="$0" />
                </div>
              </div>
            </div>
            <div className="mt-6 mb-4">
              <Label className="text-gray-700 font-semibold">Comments (Optional)</Label>
              <Textarea 
                placeholder="Add any notes about the changes..."
                value={editForm.comments}
                onChange={(e) => setEditForm(prev => ({...prev, comments: e.target.value}))}
                className="mt-2 min-h-[80px] w-full"
              />
            </div>
            <DialogFooter className="flex justify-between items-center pt-4 mt-4 border-t">
              <Button variant="destructive" onClick={handleDeleteEntry}>Delete Entry</Button>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
                <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={handleSaveEditedEntry}>Save Updates</Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Finance Review Dialog */}
        <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle className="text-xl text-red-700">Finance Review Details</DialogTitle>
            </DialogHeader>
            {reviewingEntry && reviewingChanges && (
              <div className="space-y-6">
                {/* Header Info */}
                <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h3 className="font-semibold text-gray-900">Project: {reviewingEntry.projectCode}</h3>
                      <p className="text-sm text-gray-600">Submitted by: {reviewingChanges.submittedBy}</p>
                      <p className="text-sm text-gray-600">Date: {new Date(reviewingChanges.submittedAt).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{reviewingEntry.programName}</h3>
                      <p className="text-sm text-gray-600">Client: {reviewingEntry.client}</p>
                      <p className="text-sm text-gray-600">Owner: {reviewingEntry.owner}</p>
                    </div>
                  </div>
                </div>

                {/* Comments Section */}
                {reviewingChanges.comments && (
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <h3 className="font-semibold text-gray-900 mb-2">Comments</h3>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{reviewingChanges.comments}</p>
                  </div>
                )}

                {/* Changes Comparison */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Changes Made</h3>
                  <div className="bg-white border rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Field</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Original</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Changed To</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {/* Program Name */}
                        {reviewingChanges.originalEntry.programName !== reviewingChanges.submittedChanges.programName && (
                          <tr className="bg-yellow-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">Program Name</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{reviewingChanges.originalEntry.programName}</td>
                            <td className="px-4 py-3 text-sm text-green-700 font-medium">{reviewingChanges.submittedChanges.programName}</td>
                          </tr>
                        )}
                        {/* Revenue */}
                        {reviewingChanges.originalEntry.revenue !== reviewingChanges.submittedChanges.revenue && (
                          <tr className="bg-yellow-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">Revenue</td>
                            <td className="px-4 py-3 text-sm text-gray-600">${reviewingChanges.originalEntry.revenue.toLocaleString()}</td>
                            <td className="px-4 py-3 text-sm text-green-700 font-medium">${reviewingChanges.submittedChanges.revenue.toLocaleString()}</td>
                          </tr>
                        )}
                        {/* Total Fees */}
                        {reviewingChanges.originalEntry.totalFees !== reviewingChanges.submittedChanges.totalFees && (
                          <tr className="bg-yellow-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">Total Fees</td>
                            <td className="px-4 py-3 text-sm text-gray-600">${reviewingChanges.originalEntry.totalFees.toLocaleString()}</td>
                            <td className="px-4 py-3 text-sm text-green-700 font-medium">${reviewingChanges.submittedChanges.totalFees.toLocaleString()}</td>
                          </tr>
                        )}
                        {/* Department Fees */}
                        {['accounts', 'creative', 'design', 'strategy', 'media', 'studio', 'creator', 'social', 'omni', 'finance'].map(dept => {
                          const deptName = dept === 'strategy' ? 'Strategy' : dept.charAt(0).toUpperCase() + dept.slice(1);
                          const originalValue = (reviewingChanges.originalEntry as any)[dept];
                          const changedValue = (reviewingChanges.submittedChanges as any)[dept];
                          
                          if (originalValue !== changedValue) {
                            return (
                              <tr key={dept} className="bg-yellow-50">
                                <td className="px-4 py-3 text-sm font-medium text-gray-900">{deptName}</td>
                                <td className="px-4 py-3 text-sm text-gray-600">${originalValue.toLocaleString()}</td>
                                <td className="px-4 py-3 text-sm text-green-700 font-medium">${changedValue.toLocaleString()}</td>
                              </tr>
                            );
                          }
                          return null;
                        })}
                        {/* Other fields */}
                        {reviewingChanges.originalEntry.owner !== reviewingChanges.submittedChanges.owner && (
                          <tr className="bg-yellow-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">Owner</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{reviewingChanges.originalEntry.owner}</td>
                            <td className="px-4 py-3 text-sm text-green-700 font-medium">{reviewingChanges.submittedChanges.owner}</td>
                          </tr>
                        )}
                        {reviewingChanges.originalEntry.client !== reviewingChanges.submittedChanges.client && (
                          <tr className="bg-yellow-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">Client</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{reviewingChanges.originalEntry.client}</td>
                            <td className="px-4 py-3 text-sm text-green-700 font-medium">{reviewingChanges.submittedChanges.client}</td>
                          </tr>
                        )}
                        {reviewingChanges.originalEntry.startMonth !== reviewingChanges.submittedChanges.startMonth && (
                          <tr className="bg-yellow-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">Start Month</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{reviewingChanges.originalEntry.startMonth}</td>
                            <td className="px-4 py-3 text-sm text-green-700 font-medium">{reviewingChanges.submittedChanges.startMonth}</td>
                          </tr>
                        )}
                        {reviewingChanges.originalEntry.endMonth !== reviewingChanges.submittedChanges.endMonth && (
                          <tr className="bg-yellow-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">End Month</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{reviewingChanges.originalEntry.endMonth}</td>
                            <td className="px-4 py-3 text-sm text-green-700 font-medium">{reviewingChanges.submittedChanges.endMonth}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button variant="outline" onClick={() => setReviewDialogOpen(false)}>
                    Close
                  </Button>
                  <Button 
                    className="bg-green-600 text-white hover:bg-green-700"
                    onClick={() => {
                      const entryIndex = entries.findIndex(e => e.projectCode === reviewingEntry.projectCode);
                      handleApproveFinanceReview(entryIndex);
                      setReviewDialogOpen(false);
                    }}
                  >
                    Approve Changes
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => {
                      const entryIndex = entries.findIndex(e => e.projectCode === reviewingEntry.projectCode);
                      handleRejectFinanceReview(entryIndex);
                      setReviewDialogOpen(false);
                    }}
                  >
                    Reject Changes
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
    </div>
  );
}
