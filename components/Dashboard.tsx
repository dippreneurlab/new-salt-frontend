'use client';

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from '../utils/currency';
import BrandedHeader from './BrandedHeader';
import { cloudStorage } from '@/lib/cloudStorage';

// Pipeline data structure
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
}

interface User {
  email: string;
  name: string;
}

interface Quote {
  id: string;
  projectNumber: string;
  clientName: string;
  brand: string;
  projectName: string;
  inMarketDate: string;
  projectCompletionDate: string;
  currency: string;
  totalRevenue: number;
  departmentBreakdown: { [department: string]: number };
  status: 'draft' | 'pending' | 'approved' | 'completed';
  createdDate: string;
  lastModified: string;
  createdBy: string;
  project?: any; // Optional project object for pre-population
  budgetLabel?: string; // Optional budget label for sublines
}

interface DashboardProps {
  user: User;
  onLogout: () => void;
  onCreateNewQuote: (projectData?: Quote) => void;
  onEditQuote: (quoteId: string) => void;
  onDeleteQuote: (quoteId: string) => void;
  onBackToHub?: () => void;
}

// Function to convert Pipeline entries to Quote format for display
const convertPipelineToQuotes = (entries: PipelineEntry[]): Quote[] => {
  return entries.map((entry) => {
    const projectData = {
      projectNumber: entry.projectCode,
      clientName: entry.client,
      clientCategory: '', // Will be auto-populated in ProjectSetup
      brand: entry.client, // Use client as brand
      projectName: entry.programName,
      startDate: entry.startMonth,
      endDate: entry.endMonth,
      totalProgramBudget: entry.totalFees,
      rateCard: 'Standard', // Will be auto-populated in ProjectSetup
      currency: entry.region === 'US' ? 'USD' : 'CAD',
      phases: [],
      phaseSettings: {},
      budgetLabel: 'Planning'
    };
    
    return {
      id: entry.projectCode, // Use projectCode as ID for consistency
      projectNumber: entry.projectCode,
      clientName: entry.client,
      brand: entry.client, // Use client as brand
      projectName: entry.programName,
      inMarketDate: entry.startMonth,
      projectCompletionDate: entry.endMonth,
      currency: entry.region === 'US' ? 'USD' : 'CAD',
      totalRevenue: entry.revenue,
      departmentBreakdown: {
        'Accounts': entry.accounts,
        'Creative': entry.creative,
        'Design': entry.design,
        'Strategy': entry.strategy,
        'Media': entry.media,
        'Creator': entry.creator,
        'Social': entry.social,
        'Studio': entry.studio,
        'Omni': entry.omni,
        'Finance': entry.finance
      },
      status: 'draft', // Default status for pipeline entries
      createdDate: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      createdBy: entry.owner,
      // Include project object for pre-population
      project: projectData
    };
  });
};

// Function to load pipeline entries from cloudStorage
const loadPipelineEntries = (): PipelineEntry[] => {
  try {
    const savedEntries = cloudStorage.getItem('pipeline-entries');
    if (!savedEntries) {
      return [];
    }

    const entries = JSON.parse(savedEntries) as PipelineEntry[];
    
    // Filter out entries with "Pending Deletion" or "Finance Review" status
    const activeEntries = entries.filter(entry => 
      entry.status !== 'Pending Deletion' && 
      entry.status !== 'Finance Review'
    );
    
    return activeEntries;
  } catch (error) {
    console.error('Error loading pipeline entries:', error);
    return [];
  }
};

export default function Dashboard({ user, onLogout, onCreateNewQuote, onEditQuote, onDeleteQuote, onBackToHub }: DashboardProps) {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [savedQuotes, setSavedQuotes] = useState<Quote[]>([]);
  const [filteredQuotes, setFilteredQuotes] = useState<Quote[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('lastModified');
  const [isAdminView, setIsAdminView] = useState(true); // Auto-show admin view
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  // Helper function to get unique clients
  const getUniqueClients = (): string[] => {
    const clients = quotes.map(quote => quote.clientName);
    return [...new Set(clients)].sort();
  };

  // Get saved quotes for a specific project (exclude empty $0 auto-created placeholders)
  const getProjectQuotes = (projectNumber: string): Quote[] => {
    return savedQuotes.filter(q => q.projectNumber === projectNumber && (q.totalRevenue ?? 0) > 0);
  };

  // Load projects from Pipeline Hub cloudStorage
  useEffect(() => {
    const loadFromPipeline = () => {
      try {
        const entries = loadPipelineEntries();
        const pipelineQuotes = convertPipelineToQuotes(entries);
        setQuotes(pipelineQuotes);
        
        // Load saved quotes from cloudStorage
        const savedQuotesData = cloudStorage.getItem('saltxc-all-quotes');
        if (savedQuotesData) {
          const parsed = JSON.parse(savedQuotesData);
          setSavedQuotes(parsed);
        }

        // Load pending approvals (quotes submitted for review to this user)
        const reviewRequestsData = cloudStorage.getItem('quote-review-requests');
        if (reviewRequestsData) {
          const requests = JSON.parse(reviewRequestsData);
          console.log('📋 All review requests:', requests);
          console.log('👤 Current user name:', user.name);
          // Filter for requests sent to current user's name (case-insensitive matching)
          // Include both 'pending' (initial submission) and 'pending-admin' (business lead approved, awaiting admin)
          const userRequests = requests.filter((req: any) => {
            const match = req.reviewerName?.toLowerCase() === user.name?.toLowerCase() && 
                         (req.status === 'pending' || req.status === 'pending-admin');
            console.log(`Comparing: "${req.reviewerName}" === "${user.name}"`, match);
            return match;
          });
          console.log('✅ Filtered requests for user:', userRequests);
          setPendingApprovals(userRequests);
        } else {
          console.log('⚠️ No review requests found in cloudStorage');
          setPendingApprovals([]);
        }
      } catch (err) {
        console.error('Error loading from Pipeline:', err);
        setQuotes([]);
      }
    };
    loadFromPipeline();
    
    // Set up listener for storage changes to refresh quotes
    const handleStorageChange = () => {
      loadFromPipeline();
    };
    
    // Refresh when window regains focus (e.g., returning from quote editor)
    const handleFocus = () => {
      loadFromPipeline();
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('focus', handleFocus);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [user.name, user.email, isAdminView]);

  // Filter and sort quotes
  useEffect(() => {
    const filtered = quotes.filter(quote => {
      const matchesSearch = searchTerm === '' || 
        quote.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        quote.projectName.toLowerCase().includes(searchTerm.toLowerCase());
      
      const pipelineStatus = getPipelineStatusFromEntry(quote.projectNumber);
      const matchesStatus = statusFilter === 'all' || pipelineStatus === statusFilter;
      const matchesClient = clientFilter === 'all' || quote.clientName === clientFilter;
      
      return matchesSearch && matchesStatus && matchesClient;
    });

    // Sort quotes
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'clientName':
          return a.clientName.localeCompare(b.clientName);
        case 'totalRevenue':
          return b.totalRevenue - a.totalRevenue;
        case 'inMarketDate':
          return new Date(a.inMarketDate).getTime() - new Date(b.inMarketDate).getTime();
        case 'lastModified':
        default:
          return new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime();
      }
    });

    setFilteredQuotes(filtered);
  }, [quotes, searchTerm, statusFilter, clientFilter, sortBy]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPipelineStatusColor = (status: string) => {
    const lowerStatus = status.toLowerCase();
    if (lowerStatus === 'confirmed') return 'bg-green-100 text-green-800';
    if (lowerStatus === 'open') return 'bg-blue-100 text-blue-800';
    if (lowerStatus.includes('high')) return 'bg-yellow-100 text-yellow-800';
    if (lowerStatus.includes('medium')) return 'bg-orange-100 text-orange-800';
    if (lowerStatus.includes('low')) return 'bg-red-100 text-red-800';
    if (lowerStatus === 'whitespace') return 'bg-gray-100 text-gray-800';
    if (lowerStatus.includes('review')) return 'bg-red-100 text-red-800';
    return 'bg-gray-100 text-gray-800';
  };

  const getPipelineStatusFromEntry = (projectNumber: string): string => {
    try {
      const savedEntries = cloudStorage.getItem('pipeline-entries');
      if (!savedEntries) return 'Open';
      const pipelineEntries = JSON.parse(savedEntries);
      const entry = pipelineEntries.find((e: any) => e.projectCode === projectNumber);
      return entry?.status || 'Open';
    } catch (error) {
      console.error('Error getting pipeline status:', error);
      return 'Open';
    }
  };


  // When a quote is approved in the Quote Hub, push/update it in the PM Hub storage
  const upsertPMProjectFromQuote = (q: Quote) => {
    try {
      const saved = cloudStorage.getItem('saltxc-all-quotes');
      const list: Quote[] = saved ? JSON.parse(saved) : [];

      const nowIso = new Date().toISOString();
      const idx = list.findIndex(item => item.id === q.id || (q.projectNumber && item.projectNumber === q.projectNumber));

      const toStore: Quote = {
        ...q,
        status: 'approved',
        lastModified: nowIso,
      };

      if (idx >= 0) {
        list[idx] = { ...list[idx], ...toStore };
      } else {
        list.push(toStore);
      }

      cloudStorage.setItem('saltxc-all-quotes', JSON.stringify(list));
      console.log('📦 Synced approved quote to PM Hub storage', { id: q.id, projectNumber: q.projectNumber });
    } catch (e) {
      console.error('Failed to upsert approved quote into PM Hub storage:', e);
    }
  };



  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const handleDeleteQuote = (quoteId: string, quoteName: string) => {
    if (window.confirm(`Are you sure you want to delete the quote "${quoteName}"? This action cannot be undone.`)) {
      onDeleteQuote(quoteId);
      // Refresh saved quotes
      const savedQuotesData = cloudStorage.getItem('saltxc-all-quotes');
      if (savedQuotesData) {
        const parsed = JSON.parse(savedQuotesData);
        setSavedQuotes(parsed);
      }
    }
  };

  const handleSavedQuoteStatusChange = (quoteId: string, newStatus: 'draft' | 'approved') => {
    try {
      const savedQuotesData = cloudStorage.getItem('saltxc-all-quotes');
      if (!savedQuotesData) return;
      
      const quotes = JSON.parse(savedQuotesData);
      const updatedQuotes = quotes.map((q: any) => {
        if (q.id === quoteId) {
          return { ...q, status: newStatus, lastModified: new Date().toISOString() };
        }
        return q;
      });
      
      cloudStorage.setItem('saltxc-all-quotes', JSON.stringify(updatedQuotes));
      setSavedQuotes(updatedQuotes);
      
      console.log(`✅ Updated quote ${quoteId} status to ${newStatus}`);
    } catch (error) {
      console.error('Failed to update saved quote status:', error);
      alert('Failed to update quote status. Please try again.');
    }
  };


  const handleStatusChange = (quoteId: string, newStatus: 'draft' | 'pending' | 'approved') => {
    console.log(`🔄 Attempting to update status for "${quoteId}" to ${newStatus}`);
    
    try {
      // Since these are pipeline entries, update the pipeline data
      const savedEntries = cloudStorage.getItem('pipeline-entries');
      if (!savedEntries) {
        throw new Error('No pipeline entries found in cloudStorage');
      }

      const pipelineEntries = JSON.parse(savedEntries);
      console.log(`📊 Found ${pipelineEntries.length} pipeline entries`);
      
      let entryFound = false;
      let updateCount = 0;
      const updatedEntries = pipelineEntries.map((entry: any) => {
        // STRICT matching - only match if projectCode exactly equals quoteId
        // Don't allow partial matches or fallbacks
        if (entry.projectCode && entry.projectCode === quoteId && !entryFound) {
          entryFound = true;
          updateCount++;
          console.log(`✅ EXACT MATCH found - Updating entry: "${entry.projectCode}" (${entry.client} - ${entry.programName})`);
          
          // Map quote status back to pipeline status
          let pipelineStatus = entry.status;
          if (newStatus === 'approved') pipelineStatus = 'Confirmed';
          else if (newStatus === 'pending') pipelineStatus = 'High Pitch';
          else pipelineStatus = 'Open';
          
          console.log(`🔄 Updating status from "${entry.status}" to "${pipelineStatus}"`);
          return { ...entry, status: pipelineStatus };
        }
        return entry;
      });
      
      if (!entryFound) {
        console.error(`❌ No exact match found for projectCode: "${quoteId}"`);
        console.error('Available projectCodes:', pipelineEntries.map((e: any) => `"${e.projectCode}"`).join(', '));
        throw new Error(`No pipeline entry found with projectCode: ${quoteId}`);
      }
      
      if (updateCount > 1) {
        console.error(`⚠️ WARNING: Multiple entries updated (${updateCount})! This should not happen.`);
      }
      
      // Save updated pipeline entries
      cloudStorage.setItem('pipeline-entries', JSON.stringify(updatedEntries));
      console.log(`💾 Saved updated pipeline entries (${updateCount} entry updated)`);
      
      // Update the local quotes state and, if approved, sync to PM Hub storage
      setQuotes(prevQuotes => {
        let uiUpdateCount = 0;
        const updated = prevQuotes.map(quote => {
          // STRICT matching - only match exact projectNumber
          if (quote.projectNumber && quote.projectNumber === quoteId) {
            uiUpdateCount++;
            console.log(`✅ Updating quote in UI: "${quote.projectNumber}" (${quote.clientName} - ${quote.projectName})`);
            return { ...quote, status: newStatus, lastModified: new Date().toISOString() };
          }
          return quote;
        });

        if (uiUpdateCount > 1) {
          console.error(`⚠️ WARNING: Multiple UI quotes updated (${uiUpdateCount})! This should not happen.`);
        }

        if (newStatus === 'approved') {
          // Find the approved quote by exact projectNumber match
          const approvedQuote = updated.find(q => 
            q.projectNumber && q.projectNumber === quoteId
          );
          if (approvedQuote) {
            console.log(`📦 Syncing approved quote to PM Hub: "${approvedQuote.projectNumber}"`);
            upsertPMProjectFromQuote(approvedQuote);
          } else {
            console.error(`❌ Could not find approved quote with projectNumber: "${quoteId}"`);
          }
        }

        return updated;
      });
      
      console.log(`✅ Successfully updated pipeline entry ${quoteId} status to ${newStatus}`);
    } catch (error) {
      console.error('❌ Failed to update status:', error);
      alert(`Failed to update status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const getTotalQuoteValue = () => {
    return filteredQuotes.reduce((sum, quote) => sum + quote.totalRevenue, 0);
  };

  const getTotalConfirmedValue = () => {
    return filteredQuotes
      .filter(quote => getPipelineStatusFromEntry(quote.projectNumber) === 'Confirmed')
      .reduce((sum, quote) => sum + quote.totalRevenue, 0);
  };

  const getQuotesByPipelineStatus = () => {
    const statusCounts = { 
      confirmed: 0, 
      open: 0, 
      highPitch: 0, 
      mediumPitch: 0,
      lowPitch: 0,
      whitespace: 0
    };
    filteredQuotes.forEach(quote => {
      const status = getPipelineStatusFromEntry(quote.projectNumber);
      if (status === 'Confirmed') statusCounts.confirmed++;
      else if (status === 'Open') statusCounts.open++;
      else if (status.includes('High')) statusCounts.highPitch++;
      else if (status.includes('Medium')) statusCounts.mediumPitch++;
      else if (status.includes('Low')) statusCounts.lowPitch++;
      else if (status === 'Whitespace') statusCounts.whitespace++;
    });
    return statusCounts;
  };

  const statusCounts = getQuotesByPipelineStatus();


  return (
    <div className="min-h-screen bg-gray-50">
      {/* Branded Header */}
      <BrandedHeader 
        user={user} 
        onLogout={onLogout} 
        showBackButton={!!onBackToHub}
        onBackClick={onBackToHub}
        backLabel="← Salt XC Hub"
        title="Quote Hub"
        showCenteredLogo={true}
        showAdminButton={false}
        isAdminMode={isAdminView}
        onToggleAdmin={() => setIsAdminView(!isAdminView)}
        adminButtonText="Admin View"
      />
      
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Statistics Cards */}
        <div className="grid grid-cols-6 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-gray-500">
            <div className="text-center">
              <div className="text-sm font-medium text-gray-500">Total Projects</div>
              <div className="text-2xl font-bold text-gray-900">{filteredQuotes.length}</div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
            <div className="text-center">
              <div className="text-sm font-medium text-gray-500">Confirmed</div>
              <div className="text-2xl font-bold text-green-700">{statusCounts.confirmed}</div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-purple-500">
            <div className="text-center">
              <div className="text-sm font-medium text-gray-500">High Pitch</div>
              <div className="text-2xl font-bold text-purple-700">{statusCounts.highPitch}</div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
            <div className="text-center">
              <div className="text-sm font-medium text-gray-500">Open</div>
              <div className="text-2xl font-bold text-blue-700">{statusCounts.open}</div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-gray-500">
            <div className="text-center">
              <div className="text-sm font-medium text-gray-500">Total Value</div>
              <div className="text-2xl font-bold text-gray-900">
                ${getTotalQuoteValue().toLocaleString()}
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
            <div className="text-center">
              <div className="text-sm font-medium text-gray-500">Confirmed Value</div>
              <div className="text-2xl font-bold text-green-700">
                ${getTotalConfirmedValue().toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex-1 min-w-64">
                <Input
                  placeholder="Search quotes by client, brand, or project..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="min-w-32">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-32">
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lastModified">Last Modified</SelectItem>
                    <SelectItem value="clientName">Client Name</SelectItem>
                    <SelectItem value="totalRevenue">Total Revenue</SelectItem>
                    <SelectItem value="inMarketDate">In Market Date</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pending Approvals Section - Only visible in Admin View */}
        {isAdminView && (
          <Card className="mb-6 border-l-4 border-yellow-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Pending Budget Approvals ({pendingApprovals.filter(approval => {
                  const quote = savedQuotes.find(q => q.id === approval.quoteId);
                  if (!quote) return false;
                  const matchesSearch = searchTerm === '' || 
                    quote.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    quote.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    quote.projectNumber.toLowerCase().includes(searchTerm.toLowerCase());
                  return matchesSearch;
                }).length})
              </CardTitle>
              <CardDescription>Quotes submitted to you for review and approval</CardDescription>
            </CardHeader>
            <CardContent>
              {pendingApprovals.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No pending budget approvals at this time.</p>
                  <p className="text-sm mt-2">Quotes submitted to you ({user.name}) will appear here.</p>
                </div>
              ) : pendingApprovals.filter(approval => {
                const quote = savedQuotes.find(q => q.id === approval.quoteId);
                if (!quote) return false;
                const matchesSearch = searchTerm === '' || 
                  quote.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  quote.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  quote.projectNumber.toLowerCase().includes(searchTerm.toLowerCase());
                return matchesSearch;
              }).length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No pending approvals match your search.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingApprovals.filter(approval => {
                    const quote = savedQuotes.find(q => q.id === approval.quoteId);
                    if (!quote) return false;
                    const matchesSearch = searchTerm === '' || 
                      quote.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      quote.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      quote.projectNumber.toLowerCase().includes(searchTerm.toLowerCase());
                    return matchesSearch;
                  }).map((approval, index) => {
                    // Find the quote data from savedQuotes
                    const quote = savedQuotes.find(q => q.id === approval.quoteId);
                    
                    return (
                      <div key={index} className={`border rounded-lg p-4 ${
                        approval.businessLeadApproved 
                          ? 'bg-blue-50 border-blue-300' 
                          : 'bg-yellow-50 border-yellow-200'
                      }`}>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <span className="font-mono text-xs font-medium text-gray-700 bg-white px-2 py-1 rounded">
                                {quote?.projectNumber || 'N/A'}
                              </span>
                              <h3 className="font-semibold text-gray-900">
                                {quote?.clientName} - {quote?.projectName}
                              </h3>
                              {approval.businessLeadApproved && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                  <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                  </svg>
                                  Business Lead Approved
                                </span>
                              )}
                            </div>
                            <div className="grid grid-cols-3 gap-4 text-sm">
                              <div>
                                <span className="text-gray-500">Submitted by:</span>
                                <span className="ml-2 font-medium">{approval.submittedBy}</span>
                              </div>
                              <div>
                                <span className="text-gray-500">Submitted on:</span>
                                <span className="ml-2 font-medium">{new Date(approval.submittedDate).toLocaleDateString()}</span>
                              </div>
                              <div>
                                <span className="text-gray-500">Total Revenue:</span>
                                <span className={`ml-2 font-medium ${
                                  quote && quote.totalRevenue > 500000 ? 'text-orange-700 font-bold' : 'text-green-700'
                                }`}>
                                  {quote ? formatCurrency(quote.totalRevenue, quote.currency) : 'N/A'}
                                  {quote && quote.totalRevenue > 500000 && (
                                    <span className="ml-1 text-xs text-orange-600">(Requires Admin)</span>
                                  )}
                                </span>
                              </div>
                            </div>
                            {approval.businessLeadApproved && approval.businessLeadApprovedBy && (
                              <div className="mt-2 text-sm">
                                <span className="text-gray-500">Business Lead Approved by:</span>
                                <span className="ml-2 font-medium text-blue-700">
                                  {approval.businessLeadApprovedBy} on {new Date(approval.businessLeadApprovalDate).toLocaleDateString()}
                                </span>
                              </div>
                            )}
                            {approval.message && (
                              <div className="mt-2 text-sm">
                                <span className="text-gray-500">Message:</span>
                                <p className="mt-1 text-gray-700 italic">{approval.message}</p>
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2 ml-4">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-blue-600 border-blue-600 hover:bg-blue-50"
                              onClick={() => {
                                if (quote) {
                                  onEditQuote(approval.quoteId);
                                }
                              }}
                            >
                              Review Quote
                            </Button>
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700 text-white"
                              onClick={() => {
                                // Check if quote requires admin approval (over $500,000)
                                const requiresAdminApproval = quote && quote.totalRevenue > 500000;
                                
                                if (requiresAdminApproval && approval.approvalLevel !== 'admin') {
                                  // Business Lead approval - forward to admin
                                  const requests = JSON.parse(cloudStorage.getItem('quote-review-requests') || '[]');
                                  const updated = requests.map((req: any) => 
                                    req.quoteId === approval.quoteId ? { 
                                      ...req, 
                                      status: 'pending-admin', 
                                      businessLeadApproved: true,
                                      businessLeadApprovalDate: new Date().toISOString(),
                                      businessLeadApprovedBy: user.name,
                                      approvalLevel: 'admin',
                                      message: `Business Lead approved. Requires admin approval (Budget: ${formatCurrency(quote.totalRevenue, quote.currency)} exceeds $500,000)`
                                    } : req
                                  );
                                  cloudStorage.setItem('quote-review-requests', JSON.stringify(updated));
                                  
                                  // Update quote status to show it's waiting for admin
                                  if (quote) {
                                    const allQuotes = JSON.parse(cloudStorage.getItem('saltxc-all-quotes') || '[]');
                                    const updatedQuotes = allQuotes.map((q: any) => 
                                      q.id === approval.quoteId ? { ...q, status: 'pending-admin-approval' } : q
                                    );
                                    cloudStorage.setItem('saltxc-all-quotes', JSON.stringify(updatedQuotes));
                                  }
                                  
                                  alert('Budget approved and forwarded to admin for final approval (exceeds $500,000)');
                                  window.location.reload();
                                } else {
                                  // Final approval (either under $500k or admin approval)
                                  const requests = JSON.parse(cloudStorage.getItem('quote-review-requests') || '[]');
                                  const updated = requests.map((req: any) => 
                                    req.quoteId === approval.quoteId ? { 
                                      ...req, 
                                      status: 'approved', 
                                      approvedDate: new Date().toISOString(),
                                      approvedBy: user.name
                                    } : req
                                  );
                                  cloudStorage.setItem('quote-review-requests', JSON.stringify(updated));
                                  
                                  // Update the quote status
                                  if (quote) {
                                    const allQuotes = JSON.parse(cloudStorage.getItem('saltxc-all-quotes') || '[]');
                                    const updatedQuotes = allQuotes.map((q: any) => 
                                      q.id === approval.quoteId ? { ...q, status: 'approved' } : q
                                    );
                                    cloudStorage.setItem('saltxc-all-quotes', JSON.stringify(updatedQuotes));
                                  }
                                  
                                  // Refresh the page
                                  window.location.reload();
                                }
                              }}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 border-red-600 hover:bg-red-50"
                              onClick={() => {
                                // Reject the quote
                                if (confirm('Are you sure you want to reject this budget request?')) {
                                  const requests = JSON.parse(cloudStorage.getItem('quote-review-requests') || '[]');
                                  const updated = requests.map((req: any) => 
                                    req.quoteId === approval.quoteId ? { ...req, status: 'rejected', rejectedDate: new Date().toISOString() } : req
                                  );
                                  cloudStorage.setItem('quote-review-requests', JSON.stringify(updated));
                                  
                                  // Refresh the page
                                  window.location.reload();
                                }
                              }}
                            >
                              Reject
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Removed top-level Create New Quote button per user request */}

        {/* Pending Approval Section - Shows quotes submitted for review (hidden in Admin View) */}
        {!isAdminView && (() => {
          // Get all quotes that have been submitted for review (have pending review requests)
          const reviewRequestsData = cloudStorage.getItem('quote-review-requests');
          let pendingQuotes: Quote[] = [];
          
          if (reviewRequestsData) {
            try {
              const requests = JSON.parse(reviewRequestsData);
              const pendingRequests = requests.filter((req: any) => req.status === 'pending');
              
              // Get quotes that match pending review requests
              pendingQuotes = savedQuotes.filter(quote => 
                pendingRequests.some((req: any) => req.quoteId === quote.id)
              );
            } catch (e) {
              console.error('Error loading pending quotes:', e);
            }
          }

          if (pendingQuotes.length === 0) return null;

          return (
            <Card className="mb-6 border-l-4 border-orange-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Pending Approval ({pendingQuotes.length})
                </CardTitle>
                <CardDescription>Quotes that have been submitted for review</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-2 w-24">Project #</th>
                        <th className="text-left py-3 px-2">Client</th>
                        <th className="text-left py-3 px-2">Project</th>
                        <th className="text-left py-3 px-2 w-28">Start Date</th>
                        <th className="text-left py-3 px-2 w-28">End Date</th>
                        <th className="text-right py-3 px-2">Total Revenue</th>
                        <th className="text-center py-3 px-2">Submitted To</th>
                        <th className="text-center py-3 px-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingQuotes.map((quote) => {
                        // Find the review request for this quote
                        const reviewRequest = JSON.parse(cloudStorage.getItem('quote-review-requests') || '[]')
                          .find((req: any) => req.quoteId === quote.id && req.status === 'pending');
                        
                        return (
                          <tr key={quote.id} className="border-b border-gray-100 hover:bg-orange-50">
                            <td className="py-3 px-2 font-mono text-sm w-24">
                              <span className="text-xs font-medium text-gray-700">
                                {quote.projectNumber}
                              </span>
                            </td>
                            <td className="py-3 px-2 font-medium">{quote.clientName}</td>
                            <td className="py-3 px-2">{quote.projectName}</td>
                            <td className="py-3 px-2 w-28">{formatDate(quote.inMarketDate)}</td>
                            <td className="py-3 px-2 w-28">{formatDate(quote.projectCompletionDate)}</td>
                            <td className="py-3 px-2 text-right font-semibold">
                              {formatCurrency(quote.totalRevenue, quote.currency)}
                            </td>
                            <td className="py-3 px-2 text-center">
                              <span className="px-3 py-1 rounded-md text-xs font-medium bg-orange-100 text-orange-800">
                                {reviewRequest?.reviewerName || 'Unknown'}
                              </span>
                            </td>
                            <td className="py-3 px-2 text-center">
                              <div className="flex gap-2 justify-center">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-blue-600 border-blue-600 hover:bg-blue-50"
                                  onClick={() => onEditQuote(quote.id)}
                                >
                                  View Quote
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-red-600 border-red-600 hover:bg-red-50"
                                  onClick={() => {
                                    if (confirm('Are you sure you want to cancel this review request?')) {
                                      // Remove the review request
                                      const requests = JSON.parse(cloudStorage.getItem('quote-review-requests') || '[]');
                                      const updated = requests.filter((req: any) => req.quoteId !== quote.id);
                                      cloudStorage.setItem('quote-review-requests', JSON.stringify(updated));
                                      
                                      // Trigger a refresh
                                      window.location.reload();
                                    }
                                  }}
                                >
                                  Cancel Review
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {/* Quotes Table */}
        <Card>
          <CardHeader>
            <CardTitle>Quotes ({filteredQuotes.length})</CardTitle>
            <CardDescription>Manage and view all your quotes</CardDescription>
          </CardHeader>
          <CardContent>
            {filteredQuotes.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-2">Project Code</th>
                      <th className="text-left py-3 px-2">
                        <div className="flex items-center gap-2">
                          <span>Client</span>
                          <Select value={clientFilter} onValueChange={setClientFilter}>
                            <SelectTrigger className="w-4 h-4 p-0 border-0 bg-transparent">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Clients</SelectItem>
                              {getUniqueClients().map(client => (
                                <SelectItem key={client} value={client}>{client}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </th>
                      <th className="text-left py-3 px-2">Project Name</th>
                      <th className="text-center py-3 px-2">
                        <div className="flex items-center justify-center gap-2">
                          <span>Status</span>
                          <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-4 h-4 p-0 border-0 bg-transparent">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Status</SelectItem>
                              <SelectItem value="Confirmed">Confirmed</SelectItem>
                              <SelectItem value="Open">Open</SelectItem>
                              <SelectItem value="High Pitch">High Pitch</SelectItem>
                              <SelectItem value="Medium Pitch">Medium Pitch</SelectItem>
                              <SelectItem value="Low Pitch">Low Pitch</SelectItem>
                              <SelectItem value="Whitespace">Whitespace</SelectItem>
                              <SelectItem value="Finance Review">Finance Review</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </th>
                      <th className="text-left py-3 px-2">Start Date</th>
                      <th className="text-left py-3 px-2">End Date</th>
                      <th className="text-right py-3 px-2">Total Quote</th>
                      <th className="text-right py-3 px-2">Total Fees</th>
                      <th className="text-left py-3 px-2">Last Modified</th>
                      <th className="text-center py-3 px-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredQuotes.map((quote, index) => {
                      const projectQuotes = getProjectQuotes(quote.projectNumber);
                      const hasQuotes = projectQuotes.length > 0;
                      
                      // Check if this quote has been approved
                      const isApproved = (() => {
                        try {
                          const reviewRequests = JSON.parse(cloudStorage.getItem('quote-review-requests') || '[]');
                          return reviewRequests.some((req: any) => 
                            req.quoteId === quote.id && req.status === 'approved'
                          );
                        } catch (e) {
                          return false;
                        }
                      })();
                      
                      return (
                        <React.Fragment key={`${quote.id || quote.projectNumber || 'unknown'}-${index}`}>
                          {/* Main Project Row */}
                          <tr className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-3 px-2 font-mono text-sm">
                              {quote.projectNumber ? (
                                <span className="text-xs font-medium text-gray-700">
                                  {quote.projectNumber}
                                </span>
                              ) : (
                                <span className="text-gray-400 text-xs">N/A</span>
                              )}
                            </td>
                            <td className="py-3 px-2 font-medium">{quote.clientName}</td>
                            <td className="py-3 px-2">
                              <div className="flex items-center gap-2">
                                <span>{quote.projectName}</span>
                                {isApproved && (
                                  <svg 
                                    className="w-5 h-5 text-green-600" 
                                    fill="currentColor" 
                                    viewBox="0 0 20 20"
                                  >
                                    <title>Budget Approved</title>
                                    <path fillRule="evenodd" d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 8l2.55 3.4A1 1 0 0116 13H6a1 1 0 00-1 1v3a1 1 0 11-2 0V6z" clipRule="evenodd" />
                                  </svg>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-2">
                              <div className="flex justify-center">
                                <span className={`px-3 py-1 rounded-md text-xs font-medium ${getPipelineStatusColor(getPipelineStatusFromEntry(quote.projectNumber))}`}>
                                  {getPipelineStatusFromEntry(quote.projectNumber)}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-2">{formatDate(quote.inMarketDate)}</td>
                            <td className="py-3 px-2">{formatDate(quote.projectCompletionDate)}</td>
                            <td className="py-3 px-2 text-right font-semibold">
                              {formatCurrency(quote.totalRevenue, quote.currency)}
                            </td>
                            <td className="py-3 px-2 text-right font-semibold">
                              {formatCurrency((quote as any).totalFees || quote.totalRevenue, quote.currency)}
                            </td>
                            <td className="py-3 px-2 text-sm text-gray-600">
                              {quote.lastModified ? new Date(quote.lastModified).toLocaleDateString() : 'N/A'}
                            </td>
                            <td className="py-3 px-2 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <Button
                                  size="sm"
                                  className="bg-black hover:bg-gray-800 text-white"
                                  onClick={() => {
                                    console.log('🔘 Add Quote clicked for:', quote);
                                    console.log('🔍 Quote has project?', !!quote.project);
                                    // Persist a copy in session for robust handoff
                                    try {
                                      const projectPayload = quote.project || {
                                        projectNumber: quote.projectNumber,
                                        clientName: quote.clientName,
                                        clientCategory: '',
                                        brand: quote.brand,
                                        projectName: quote.projectName,
                                        startDate: (quote as any).startDate || quote.inMarketDate,
                                        endDate: (quote as any).endDate || quote.projectCompletionDate,
                                        totalProgramBudget: (quote as any).totalFees || quote.totalRevenue || 0,
                                        rateCard: 'Standard',
                                        currency: quote.currency || 'CAD',
                                        phases: [],
                                        phaseSettings: {},
                                        budgetLabel: 'Planning'
                                      };
                                      sessionStorage.setItem('new-quote-project', JSON.stringify(projectPayload));
                                      console.log('💾 Stored new-quote-project in sessionStorage');
                                    } catch (e) {
                                      console.warn('⚠️ Failed to persist new-quote-project', e);
                                    }
                                    if (quote.project) {
                                      console.log('📦 Project data:', JSON.stringify(quote.project, null, 2));
                                    }
                                    onCreateNewQuote(quote);
                                  }}
                                  title="Add Quote/Budget"
                                >
                                  Add Quote
                                </Button>
                              </div>
                            </td>
                          </tr>
                          
                          {/* Saved Quotes Sub-rows - Always shown */}
                          {projectQuotes.map((savedQuote, sqIndex) => {
                            // Check if this saved quote has been approved
                            const isSubQuoteApproved = (() => {
                              try {
                                const reviewRequests = JSON.parse(cloudStorage.getItem('quote-review-requests') || '[]');
                                return reviewRequests.some((req: any) => 
                                  req.quoteId === savedQuote.id && req.status === 'approved'
                                );
                              } catch (e) {
                                return false;
                              }
                            })();
                            
                            return (
                            <tr key={`saved-${savedQuote.id}-${sqIndex}`} className="border-b border-gray-50 bg-gray-100 hover:bg-gray-150">
                              <td className="py-2 px-2 pl-8 font-mono text-xs w-24">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs bg-white text-gray-600 border border-gray-300">
                                  {savedQuote.budgetLabel || 'General'}
                                </span>
                              </td>
                              <td className="py-2 px-2 text-sm text-gray-600">{savedQuote.clientName}</td>
                              <td className="py-2 px-2 text-sm text-gray-600">
                                <div className="flex items-center gap-2">
                                  <span>{savedQuote.projectName}</span>
                                  {isSubQuoteApproved && (
                                    <svg 
                                      className="w-4 h-4 text-green-600" 
                                      fill="currentColor" 
                                      viewBox="0 0 20 20"
                                    >
                                      <title>Budget Approved</title>
                                      <path fillRule="evenodd" d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 8l2.55 3.4A1 1 0 0116 13H6a1 1 0 00-1 1v3a1 1 0 11-2 0V6z" clipRule="evenodd" />
                                    </svg>
                                  )}
                                </div>
                              </td>
                              <td className="py-2 px-2 w-28 text-sm text-gray-600">{formatDate((savedQuote.project as any)?.startDate || savedQuote.inMarketDate)}</td>
                              <td className="py-2 px-2 w-28 text-sm text-gray-600">{formatDate((savedQuote.project as any)?.endDate || savedQuote.projectCompletionDate)}</td>
                              <td className="py-2 px-2 text-right font-semibold text-sm">
                                {formatCurrency(savedQuote.totalRevenue, savedQuote.currency)}
                              </td>
                              <td className="py-2 px-2">
                                <div className="flex justify-center">
                                  <Select
                                    value={savedQuote.status === 'approved' ? 'approved' : 'draft'}
                                    onValueChange={(value: 'draft' | 'approved') => handleSavedQuoteStatusChange(savedQuote.id, value)}
                                  >
                                    <SelectTrigger className={`w-24 h-7 text-xs ${
                                      savedQuote.status === 'approved' 
                                        ? 'bg-green-100 border-green-300 text-green-800' 
                                        : 'bg-gray-100 border-gray-300 text-gray-800'
                                    }`}>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="draft">Draft</SelectItem>
                                      <SelectItem value="approved">Approved</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </td>
                              <td className="py-2 px-2 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => onEditQuote(savedQuote.id)}
                                    className="text-xs h-7"
                                    title="Edit Quote"
                                  >
                                    Edit
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleDeleteQuote(savedQuote.id, savedQuote.projectName)}
                                    disabled={savedQuote.status === 'approved'}
                                    className={`w-7 h-7 p-0 ${
                                      savedQuote.status === 'approved' 
                                        ? 'text-gray-400 cursor-not-allowed opacity-50' 
                                        : 'text-red-600 hover:bg-red-50'
                                    }`}
                                    title={savedQuote.status === 'approved' ? 'Approved quotes cannot be deleted' : 'Delete quote'}
                                  >
                                    ×
                                  </Button>
                                </div>
                              </td>
                            </tr>
                            );
                          })}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-gray-500 mb-4">
                  {quotes.length === 0 ? 'No quotes created yet' : 'No quotes match your filters'}
                </div>
                {/* Removed CTA when empty to avoid global add; row-level add remains */}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
