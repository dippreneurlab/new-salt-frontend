'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { formatCurrency } from '../utils/currency';
import BrandedHeader from './BrandedHeader';
import { cloudStorage } from '@/lib/cloudStorage';
import { authFetch } from '@/lib/authFetch';

interface User {
  email: string;
  name: string;
}

interface PipelineEntry {
  projectCode: string;
  entryType?: 'In Plan' | 'New to Plan';
  owner: string;
  client: string;
  programName: string;
  startMonth: string; // Full date (YYYY-MM-DD)
  endMonth: string;   // Full date (YYYY-MM-DD)
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
}

interface Quote {
  id: string;
  projectNumber?: string;
  clientName: string;
  brand: string;
  projectName: string;
  inMarketDate: string;
  projectCompletionDate: string;
  currency: string;
  totalRevenue: number;
  status: 'draft' | 'pending' | 'approved' | 'completed';
  lastModified: string;
  project?: {
    phases: string[];
  };
  // Full quote data to check if project has been setup
  phaseData?: any;
  productionCostData?: any;
  pmData?: any;
}

interface PMDashboardProps {
  user: User;
  onLogout: () => void;
  onBackToHub?: () => void;
  onOpenProject: (quoteId: string) => void;
  onCreateNew: () => void;
  onOpenPerson: (name: string) => void;
  onOpenProjectWithData?: (entry: PipelineEntry) => void;
  userView?: 'Admin' | 'Business Owner' | 'Team Member';
  onUserViewChange?: (view: 'Admin' | 'Business Owner' | 'Team Member') => void;
  isEmbedded?: boolean; // When true, hide header
}

const parseCurrencyInput = (value: string): number => {
  if (!value) return 0;
  const numeric = value.replace(/[^\d.-]/g, '');
  const parsed = parseFloat(numeric || '0');
  return isNaN(parsed) ? 0 : parsed;
};

const formatCurrencyInput = (value: string): string => {
  const numeric = value.replace(/[^\d]/g, '');
  if (!numeric) return '';
  return '$' + Number(numeric).toLocaleString('en-US', { maximumFractionDigits: 0 });
};

const computeNextProjectCode = (entries: PipelineEntry[]): string => {
  const year = new Date().getFullYear().toString().slice(-2);
  const nums = entries
    .map((e) => e.projectCode)
    .filter((c): c is string => !!c && c.endsWith(`-${year}`))
    .map((c) => {
      const match = c.match(/^P(\d+)-/);
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter((n) => !isNaN(n));
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  return `P${String(next).padStart(4, '0')}-${year}`;
};

const OWNER_OPTIONS = [
  'Kait D', 'Bianca M', 'Marcin B', 'Zak C', 'Mike M',
  'Steve B', 'Dane H', 'Carol P', 'Rob C', 'Sandra R'
];

const STATUS_OPTIONS = ['open', 'confirmed', 'high-pitch', 'medium-pitch', 'low-pitch', 'whitespace'];
const REGION_OPTIONS = ['Canada', 'US'];
const PROGRAM_TYPE_OPTIONS = ['Integrated', 'Media', 'XM'];

export default function PMDashboard({ user, onLogout, onBackToHub, onOpenProject, onCreateNew, onOpenPerson, onOpenProjectWithData, userView, onUserViewChange, isEmbedded = false }: PMDashboardProps) {
  const [pipelineEntries, setPipelineEntries] = useState<PipelineEntry[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [filtered, setFiltered] = useState<PipelineEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [sortBy, setSortBy] = useState<'date' | 'client' | 'project'>('date');
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [newForm, setNewForm] = useState({
    projectCode: '',
    entryType: 'In Plan' as 'In Plan' | 'New to Plan',
    status: 'open',
    owner: '',
    client: '',
    programName: '',
    region: 'Canada',
    programType: 'Integrated',
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
  });
  const newTotalFees = useMemo(() => {
    const fields = ['accounts','creative','design','strategy','media','studio','creator','social','omni','finance'] as const;
    return fields.reduce((sum, key) => sum + parseCurrencyInput((newForm as any)[key]), 0);
  }, [newForm]);
  
  // Function to organize entries into parent-child hierarchy
  const organizeHierarchy = (entries: PipelineEntry[]) => {
    const result: PipelineEntry[] = [];
    const childMap = new Map<string, PipelineEntry[]>();
    
    // Group children by parent
    entries.forEach(entry => {
      if ((entry as any).parentProjectCode) {
        const parentCode = (entry as any).parentProjectCode;
        if (!childMap.has(parentCode)) {
          childMap.set(parentCode, []);
        }
        childMap.get(parentCode)!.push(entry);
      }
    });
    
    // Build hierarchy: parent followed by its children
    entries.forEach(entry => {
      if (!(entry as any).parentProjectCode) {
        // This is a parent/standalone project
        result.push(entry);
        // Add its children immediately after
        const children = childMap.get(entry.projectCode) || [];
        result.push(...children);
      }
    });
    
    return result;
  };
  
  const uniqueResourcedPeople = useMemo(() => {
    const names = new Set<string>();
    quotes.forEach((q) => {
      const ra = (q as any).pmData?.resourceAssignments;
      if (!ra) return;
      Object.values(ra).forEach((phaseAssignments: any) => {
        Object.values(phaseAssignments || {}).forEach((deptAssignments: any) => {
          (deptAssignments || []).forEach((assignment: any) => {
            const name = (assignment.assignee || '').trim();
            if (name) names.add(name);
          });
        });
      });
    });
    return Array.from(names).sort();
  }, [quotes]);

  useEffect(() => {
    const loadData = () => {
      // Load pipeline entries (master entries)
      const savedPipeline = cloudStorage.getItem('pipeline-entries');
      console.log('🔍 PM Dashboard: Loading pipeline entries from cloudStorage');
      if (savedPipeline) {
        try {
          const data = JSON.parse(savedPipeline) as PipelineEntry[];
          console.log('📊 PM Dashboard: Loaded', data.length, 'pipeline entries');
          // Filter out entries with "Pending Deletion" or "Finance Review" status
          const activeEntries = data.filter(entry => 
            entry.status !== 'Pending Deletion' && 
            entry.status !== 'Finance Review'
          );
          console.log('✅ PM Dashboard: Filtered to', activeEntries.length, 'active entries');
          setPipelineEntries(activeEntries);
        } catch (e) {
          console.error('❌ Failed to load pipeline entries for PM:', e);
        }
      } else {
        console.log('⚠️ PM Dashboard: No pipeline entries found in cloudStorage');
      }

      // Also load quotes to check if projects have been setup
      const savedQuotes = cloudStorage.getItem('saltxc-all-quotes');
      if (savedQuotes) {
        try {
          const data = JSON.parse(savedQuotes) as Quote[];
          console.log('📂 PM Dashboard: Loaded', data.length, 'quotes');
          setQuotes(data);
        } catch (e) {
          console.error('❌ Failed to load quotes for PM:', e);
        }
      }
    };

    // Load data initially
    loadData();

    // Set up listener for storage changes (when quotes are added in Quote Hub)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'saltxc-all-quotes') {
        console.log('🔄 PM Dashboard: Quotes changed in cloudStorage, reloading...');
        loadData();
      }
    };

    // Refresh when window regains focus (returning from Quote Hub)
    const handleFocus = () => {
      console.log('👁️ PM Dashboard: Window focused, reloading data...');
      loadData();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('focus', handleFocus);
    // Listen for in-tab custom event fired after quote save
    const handleQuotesUpdated = () => {
      console.log('📣 PM Dashboard: received saltxc-quotes-updated event');
      loadData();
    };
    window.addEventListener('saltxc-quotes-updated', handleQuotesUpdated as EventListener);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('saltxc-quotes-updated', handleQuotesUpdated as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!newModalOpen) return;
    setNewForm((prev) => ({
      ...prev,
      projectCode: computeNextProjectCode(pipelineEntries),
      owner: prev.owner || user.name,
      status: 'open',
      region: prev.region || 'Canada',
      programType: prev.programType || 'Integrated',
    }));
  }, [newModalOpen, pipelineEntries, user.name]);

  // No explicit click action requested; we list people from PM resourcing across all projects


  useEffect(() => {
    const term = searchTerm.trim().toLowerCase();
    const list = pipelineEntries
      .filter(entry => {
        const matchesSearch = term === '' ||
          entry.client.toLowerCase().includes(term) ||
          entry.programName.toLowerCase().includes(term) ||
          entry.owner.toLowerCase().includes(term);
        
        const matchesStatus = statusFilter === 'all' || entry.status.toLowerCase() === statusFilter.toLowerCase();
        
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        if (sortBy === 'client') {
          return a.client.localeCompare(b.client);
        } else if (sortBy === 'project') {
          return a.programName.localeCompare(b.programName);
        } else {
          // Default: sort by start date (most recent first)
          return new Date(b.startMonth).getTime() - new Date(a.startMonth).getTime();
        }
      });
    setFiltered(list);
  }, [pipelineEntries, searchTerm, statusFilter, sortBy]);

  const handleOpenNew = () => {
    setNewForm((prev) => ({
      ...prev,
      projectCode: computeNextProjectCode(pipelineEntries),
      owner: prev.owner || user.name,
      status: 'open',
      region: prev.region || 'Canada',
      programType: prev.programType || 'Integrated',
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
    }));
    setNewModalOpen(true);
    onCreateNew?.();
  };

  const handleNewCurrencyChange = (field: keyof typeof newForm, value: string) => {
    const formatted = formatCurrencyInput(value);
    setNewForm((prev) => ({ ...prev, [field]: formatted }));
  };

  const handleSubmitNewProject = async () => {
    if (!newForm.owner || !newForm.client || !newForm.programName || !newForm.startMonth || !newForm.endMonth) {
      alert('Owner, Client, Project Name, Start Date, and End Date are required.');
      return;
    }
    const entryPayload = {
      projectCode: newForm.projectCode,
      owner: newForm.owner,
      client: newForm.client,
      programName: newForm.programName,
      programType: newForm.programType,
      region: newForm.region,
      startMonth: newForm.startMonth,
      endMonth: newForm.endMonth,
      revenue: parseCurrencyInput(newForm.revenue),
      totalFees: newTotalFees,
      status: newForm.status,
      accounts: parseCurrencyInput(newForm.accounts),
      creative: parseCurrencyInput(newForm.creative),
      design: parseCurrencyInput(newForm.design),
      strategy: parseCurrencyInput(newForm.strategy),
      media: parseCurrencyInput(newForm.media),
      studio: parseCurrencyInput(newForm.studio),
      creator: parseCurrencyInput(newForm.creator),
      social: parseCurrencyInput(newForm.social),
      omni: parseCurrencyInput(newForm.omni),
      finance: parseCurrencyInput(newForm.finance),
    };

    try {
      const res = await authFetch('/api/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entry: entryPayload }),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || 'Failed to create project');
      }
      const data = await res.json();
      const saved = data?.entry || entryPayload;
      const updatedEntries = [saved as PipelineEntry, ...pipelineEntries].sort((a, b) =>
        (b.createdAt || b.startMonth || '').localeCompare(a.createdAt || a.startMonth || '')
      );
      setPipelineEntries(updatedEntries);
      cloudStorage.setItem('pipeline-entries', JSON.stringify(updatedEntries));
      setNewModalOpen(false);
    } catch (err) {
      console.error('Failed to create pipeline entry', err);
      alert('Could not create project. Please try again.');
    }
  };

  // Function to determine if a project has PM data saved
  const hasProjectManagementData = (projectCode: string): boolean => {
    const projectQuote = quotes.find(q => q.projectNumber === projectCode);
    if (!projectQuote) {
      console.log(`📊 PM Check: No quote found for ${projectCode}`);
      return false;
    }
    
    console.log(`📊 Full quote data for ${projectCode}:`, projectQuote);
    
    // Check if pmData exists and has been saved (has resourceAssignments or workback)
    const hasPMData = projectQuote.pmData && (
      (projectQuote.pmData.resourceAssignments && Object.keys(projectQuote.pmData.resourceAssignments).length > 0) ||
      (projectQuote.pmData.workback && projectQuote.pmData.workback.length > 0)
    );
    
    console.log(`📊 PM Check for ${projectCode}:`, {
      hasPmData: !!projectQuote.pmData,
      pmDataKeys: projectQuote.pmData ? Object.keys(projectQuote.pmData) : [],
      hasResourceAssignments: projectQuote.pmData?.resourceAssignments ? Object.keys(projectQuote.pmData.resourceAssignments).length : 0,
      hasWorkback: projectQuote.pmData?.workback?.length || 0,
      result: hasPMData
    });
    
    return hasPMData || false;
  };

  // Helper to check if a saved quote exists for a project (subline present in Quote Hub)
  const hasQuoteCreated = (projectCode: string): boolean => {
    const result = quotes.some(q => {
      const matchesProject = (q.projectNumber === projectCode) || ((q as any).project?.projectNumber === projectCode);
      const hasValue = ((q.totalRevenue ?? 0) > 0);
      return matchesProject && hasValue;
    });
    
    // Debug logging to help identify mismatches
    if (!result) {
      const allProjectNumbers = quotes.map(q => q.projectNumber).filter(Boolean);
      if (allProjectNumbers.length > 0 && !allProjectNumbers.includes(projectCode)) {
        console.log(`⚠️ No quote found for pipeline project: ${projectCode}. Available project numbers:`, allProjectNumbers);
      }
    }
    
    return result;
  };

  // Helper to get the quote ID for a project code (if it exists)
  const getQuoteIdForProject = (projectCode: string): string | null => {
    const candidates = quotes
      .filter(q => {
        const matchesProject = (q.projectNumber === projectCode) || ((q as any).project?.projectNumber === projectCode);
        const hasValue = ((q.totalRevenue ?? 0) > 0);
        return matchesProject && hasValue;
      })
      .sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());
    return candidates[0]?.id || null;
  };

  // Helper to get department phases from a pipeline entry
  const getDepartmentPhases = (entry: PipelineEntry): string[] => {
    const phases: string[] = [];
    const deptMap: { [key: string]: keyof PipelineEntry } = {
      'Accounts': 'accounts',
      'Creative': 'creative',
      'Design': 'design',
      'Strategy': 'strategy',
      'Media': 'media',
      'Creator': 'creator',
      'Social': 'social',
      'Studio': 'studio',
    };
    
    Object.entries(deptMap).forEach(([name, key]) => {
      if ((entry[key] as number) > 0) {
        phases.push(name);
      }
    });
    
    return phases;
  };

  return (
    <div className="min-h-screen bg-white">
      {!isEmbedded && (
        <BrandedHeader
          user={user}
          onLogout={onLogout}
          title="Project Workspace Hub"
          showBackButton={!!onBackToHub}
          onBackClick={onBackToHub}
          backLabel="← Salt XC Hub"
          showActionsDropdown
          menuItems={[
            { label: 'Admin View', onClick: () => console.log('Admin View clicked') },
            { label: 'Business Lead', onClick: () => console.log('Business Lead clicked') },
            { 
              label: 'Team Member', 
              onClick: () => {
                // Open team member view - show first assigned person or current user
                if (uniqueResourcedPeople.length > 0) {
                  // If there are assigned people, show the first one
                  onOpenPerson(uniqueResourcedPeople[0]);
                } else if (user?.name) {
                  // Otherwise, show the current logged-in user
                  onOpenPerson(user.name);
                }
              }
            }
          ]}
          showCenteredLogo={true}
          showUserViewSelector={true}
          userView={userView}
          onUserViewChange={onUserViewChange}
        />
      )}

      <div className="py-8 px-8">
        {/* Title */}
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Project Workspace</h2>

        {/* Filters and Search */}
        <div className="mb-6">
          <div className="flex items-center gap-3">
            {/* New Project Button */}
            <Dialog open={newModalOpen} onOpenChange={setNewModalOpen}>
              <DialogTrigger asChild>
                <button
                  onClick={handleOpenNew}
                  className="flex items-center gap-2 px-4 py-2 bg-[#4A90E2] text-white rounded-md hover:bg-[#357ABD] transition-colors text-sm font-medium"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  New Project
                </button>
              </DialogTrigger>

              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add Pipeline Entry</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Project Number</label>
                    <Input value={newForm.projectCode} readOnly className="bg-gray-50" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Entry Type</label>
                    <Select value={newForm.entryType} onValueChange={(v) => setNewForm(prev => ({...prev, entryType: v as any}))}>
                      <SelectTrigger><SelectValue placeholder="Select entry type" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="In Plan">In Plan</SelectItem>
                        <SelectItem value="New to Plan">New to Plan</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Status</label>
                    <Select value={newForm.status} onValueChange={(v) => setNewForm(prev => ({...prev, status: v}))}>
                      <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map(s => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Owner</label>
                    <Select value={newForm.owner} onValueChange={(v) => setNewForm(prev => ({...prev, owner: v}))}>
                      <SelectTrigger><SelectValue placeholder="Select owner" /></SelectTrigger>
                      <SelectContent>
                        {OWNER_OPTIONS.map(o => (<SelectItem key={o} value={o}>{o}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Client</label>
                    <Input value={newForm.client} onChange={(e) => setNewForm(prev => ({...prev, client: e.target.value}))} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Program Name</label>
                    <Input value={newForm.programName} onChange={(e) => setNewForm(prev => ({...prev, programName: e.target.value}))} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Region</label>
                    <Select value={newForm.region} onValueChange={(v) => setNewForm(prev => ({...prev, region: v}))}>
                      <SelectTrigger><SelectValue placeholder="Select region" /></SelectTrigger>
                      <SelectContent>
                        {REGION_OPTIONS.map(r => (<SelectItem key={r} value={r}>{r}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Program Type</label>
                    <Select value={newForm.programType} onValueChange={(v) => setNewForm(prev => ({...prev, programType: v}))}>
                      <SelectTrigger><SelectValue placeholder="Select program type" /></SelectTrigger>
                      <SelectContent>
                        {PROGRAM_TYPE_OPTIONS.map(p => (<SelectItem key={p} value={p}>{p}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Start Date</label>
                    <Input
                      type="date"
                      value={newForm.startMonth}
                      onChange={(e) => setNewForm(prev => ({...prev, startMonth: e.target.value}))}
                    />
                    <p className="text-xs text-gray-500 mt-1">Select the project start date</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">End Date</label>
                    <Input
                      type="date"
                      value={newForm.endMonth}
                      onChange={(e) => setNewForm(prev => ({...prev, endMonth: e.target.value}))}
                    />
                    <p className="text-xs text-gray-500 mt-1">Select the project end date</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Revenue</label>
                    <Input value={newForm.revenue} onChange={(e) => handleNewCurrencyChange('revenue', e.target.value)} placeholder="$0" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Total Fees (auto)</label>
                    <Input value={newTotalFees.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} readOnly className="bg-gray-50" />
                  </div>
                  <div className="md:col-span-2">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Department Fees</h4>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                      {(['accounts','creative','design','strategy','media','studio','creator','social','omni','finance'] as const).map((field) => (
                        <div key={field} className="space-y-1">
                          <label className="text-xs text-gray-600 capitalize">{field}</label>
                          <Input
                            value={(newForm as any)[field]}
                            onChange={(e) => handleNewCurrencyChange(field as any, e.target.value)}
                            placeholder="$0"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <Button variant="outline" onClick={() => setNewModalOpen(false)}>Cancel</Button>
                  <Button onClick={handleSubmitNewProject}>Save</Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Divider */}
            <div className="h-6 w-px bg-gray-300"></div>

            {/* Search */}
            <div className="flex items-center gap-2">
              {isSearchExpanded ? (
                <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-4 duration-200">
                  <Input
                    type="text"
                    placeholder="Search projects, clients, or owners..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-64 h-9 text-sm"
                    autoFocus
                  />
                  <button 
                    onClick={() => {
                      setSearchTerm('');
                      setIsSearchExpanded(false);
                    }}
                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                    title="Close search"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => setIsSearchExpanded(true)}
                  className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-md transition-colors text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Search
                </button>
              )}
            </div>

            {/* Sort */}
            <div className="relative">
              <button 
                onClick={() => setIsSortMenuOpen(!isSortMenuOpen)}
                className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-md transition-colors text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                </svg>
                Sort
                <svg className={`w-3 h-3 transition-transform ${isSortMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {isSortMenuOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setIsSortMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-20">
                    <button
                      onClick={() => {
                        setSortBy('client');
                        setIsSortMenuOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 ${sortBy === 'client' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}
                    >
                      Sort by Client
                    </button>
                    <button
                      onClick={() => {
                        setSortBy('project');
                        setIsSortMenuOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 ${sortBy === 'project' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}
                    >
                      Sort by Project
                    </button>
                    <button
                      onClick={() => {
                        setSortBy('date');
                        setIsSortMenuOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 ${sortBy === 'date' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}
                    >
                      Sort by Date
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Hide */}
            <button className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-md transition-colors text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
              Hide
            </button>
          </div>
        </div>

        {/* Project List */}
        <div>
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Projects</h3>
            <p className="text-sm text-gray-600">Open a project to manage resources, timelines, and tasks</p>
          </div>
          <div>
            {filtered.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-2">Project Code</th>
                      <th className="text-left py-3 px-2">Client</th>
                      <th className="text-left py-3 px-2">Project Name</th>
                      <th className="text-center py-3 px-2">Status</th>
                      <th className="text-left py-3 px-2">Start Date</th>
                      <th className="text-left py-3 px-2">End Date</th>
                      <th className="text-right py-3 px-2">Total Quote</th>
                      <th className="text-right py-3 px-2">Total Fees</th>
                      <th className="text-left py-3 px-2">Last Modified</th>
                      {!isEmbedded && <th className="text-center py-3 px-2"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {organizeHierarchy(filtered).map((entry) => {
                      const quoteId = getQuoteIdForProject(entry.projectCode);
                      const quoteExists = hasQuoteCreated(entry.projectCode);
                      const pmDataExists = hasProjectManagementData(entry.projectCode);
                      const isChild = !!(entry as any).parentProjectCode;
                      
                      // Get the quote for this project to access totalRevenue and lastModified
                      const projectQuote = quotes.find(q => q.projectNumber === entry.projectCode);
                      
                      const handleRowClick = () => {
                        if (quoteExists && quoteId) {
                          onOpenProject(quoteId);
                        } else if (onOpenProjectWithData) {
                          onOpenProjectWithData(entry);
                        }
                      };
                      
                      return (
                        <tr 
                          key={entry.projectCode} 
                          onClick={handleRowClick}
                          className={`border-b hover:bg-blue-50 cursor-pointer transition-colors ${isChild ? 'bg-gray-50/50' : ''}`}
                        >
                          <td className="py-3 px-2 font-mono text-sm">
                            {entry.projectCode ? (
                              <span className={`text-xs font-medium ${isChild ? 'text-gray-600' : 'text-gray-700'}`}>
                                {isChild && '  └─ '}{entry.projectCode}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-xs">N/A</span>
                            )}
                          </td>
                          <td className={`py-3 px-2 font-medium ${isChild ? 'pl-6 text-gray-600' : ''}`}>{entry.client}</td>
                          <td className={`py-3 px-2 ${isChild ? 'pl-6 text-gray-600 italic' : ''}`}>{entry.programName}</td>
                          <td className="py-3 px-2">
                            <div className="flex justify-center">
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
                            </div>
                          </td>
                          <td className="py-3 px-2">{new Date(entry.startMonth).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                          <td className="py-3 px-2">{new Date(entry.endMonth).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                          <td className="py-3 px-2 text-right font-semibold">
                            {projectQuote ? formatCurrency(projectQuote.totalRevenue || 0, entry.region === 'US' ? 'USD' : 'CAD') : '—'}
                          </td>
                          <td className="py-3 px-2 text-right font-semibold">{formatCurrency(entry.totalFees || 0, entry.region === 'US' ? 'USD' : 'CAD')}</td>
                          <td className="py-3 px-2 text-sm text-gray-600">
                            {projectQuote?.lastModified ? new Date(projectQuote.lastModified).toLocaleDateString() : '—'}
                          </td>
                          {!isEmbedded && (
                            <td className="py-3 px-2 text-center">
                              {quoteExists && quoteId ? (
                                <button 
                                  className="p-2 hover:bg-gray-100 rounded-md transition-colors"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    onOpenProject(quoteId);
                                  }}
                                  title={pmDataExists ? 'Edit Project' : 'Set Up Project'}
                                >
                                  <svg 
                                    className="w-5 h-5 text-gray-700" 
                                    fill="none" 
                                    stroke="currentColor" 
                                    viewBox="0 0 24 24"
                                  >
                                    <path 
                                      strokeLinecap="round" 
                                      strokeLinejoin="round" 
                                      strokeWidth={2} 
                                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" 
                                    />
                                  </svg>
                                </button>
                              ) : (
                                <button 
                                  className="p-2 hover:bg-gray-100 rounded-md transition-colors"
                                  onClick={() => {
                                    if (onOpenProjectWithData) {
                                      onOpenProjectWithData(entry);
                                    } else {
                                      alert('Please create a standalone project from the Project Management page');
                                    }
                                  }}
                                  title="Set Up Project"
                                >
                                  <svg 
                                    className="w-5 h-5 text-gray-700" 
                                    fill="none" 
                                    stroke="currentColor" 
                                    viewBox="0 0 24 24"
                                  >
                                    <path 
                                      strokeLinecap="round" 
                                      strokeLinejoin="round" 
                                      strokeWidth={2} 
                                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" 
                                    />
                                  </svg>
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center text-gray-500 py-10">No projects found</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
