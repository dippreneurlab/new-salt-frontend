  'use client';

import { useState, useEffect } from 'react';
import { Home, TrendingUp, Briefcase, FileText, ChevronDown, ChevronRight, ChevronLeft, Calendar, CheckCircle, Wrench, User, Package, Plus, Trash2, MessageCircle, Search, X, Filter, ArrowUpDown, Clock, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrency } from '../utils/currency';
import Pipeline from './Pipeline';
import PMDashboard from './PMDashboard';
import Dashboard from './Dashboard';
import ProjectSetup from './ProjectSetup';
import PlanningPhase from './PlanningPhase';
import ProductionCosts from './ProductionCosts';
import QuoteReview from './QuoteReview';
import { Poppins } from 'next/font/google';
import { cloudStorage } from '@/lib/cloudStorage';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '700']
});

interface User {
  email: string;
  name: string;
  role?: string;
  department?: string;
}

interface ThreeInOneProps {
  user: User;
  onLogout: () => void;
  onBackToHub: () => void;
  userView?: 'Admin' | 'Business Owner' | 'Team Member';
  onUserViewChange?: (view: 'Admin' | 'Business Owner' | 'Team Member') => void;
}

export default function ThreeInOne({ 
  user, 
  onLogout, 
  onBackToHub,
  userView = 'Admin',
  onUserViewChange
}: ThreeInOneProps) {
  const [selectedSection, setSelectedSection] = useState<'overview' | 'pipeline' | 'project-management' | 'quoting' | 'my-team'>('overview');
  const [pipelineExpanded, setPipelineExpanded] = useState(false);
  const [pipelineSubView, setPipelineSubView] = useState<string>('executive');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [personName, setPersonName] = useState<string | null>(null);
  const [selectedProjectMeta, setSelectedProjectMeta] = useState<{ client: string; projectName: string } | null>(null);
  const [projectSubView, setProjectSubView] = useState<'details' | 'quoting' | 'resourcing' | 'tasks' | 'assets'>('details');
  const [selectedProjectDetails, setSelectedProjectDetails] = useState<{
    status: string;
    projectCode: string;
    client: string;
    programName: string;
    owner?: string;
    region?: string;
    programType?: string;
    startMonth?: string;
    endMonth?: string;
    revenue?: number;
    totalFees?: number;
  } | null>(null);
  const [calendarDate, setCalendarDate] = useState<Date>(new Date());
  const [projectMilestones, setProjectMilestones] = useState<Array<{ name: string; date: string }>>([]);
  const [selectedProjectQuotes, setSelectedProjectQuotes] = useState<any[]>([]);
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);
  const [quoteEditorTab, setQuoteEditorTab] = useState<'setup' | 'fees' | 'production' | 'review'>('setup');
  const [quoteProject, setQuoteProject] = useState<any | null>(null);
  const [phaseData, setPhaseData] = useState<any>({});
  const [productionData, setProductionData] = useState<any>({});
  const [quoteReviewData, setQuoteReviewData] = useState<any>({
    projectScope: '',
    descriptions: {},
    invoiceItems: []
  });
  const [quoteModalOpen, setQuoteModalOpen] = useState(false);
  const [quoteForm, setQuoteForm] = useState<{
    id?: string;
    projectNumber: string;
    projectName: string;
    status: 'draft' | 'pending' | 'approved' | 'completed';
    totalRevenue: number;
    currency: string;
  }>({
    projectNumber: '',
    projectName: '',
    status: 'draft',
    totalRevenue: 0,
    currency: 'USD'
  });
  
  // Resourcing state
  const [staffData, setStaffData] = useState<Array<{ name: string; title: string; department?: string }>>([]);
  const [resourceAssignments, setResourceAssignments] = useState<{
    [phase: string]: {
      [department: string]: Array<{
        roleName: string;
        allocation: number;
        weeks: number;
        hours: number;
        assignee: string;
        startDate: string;
        endDate: string;
      }>
    }
  }>({});
  const [phaseDates, setPhaseDates] = useState<{
    [phase: string]: {
      startDate: string;
      endDate: string;
    }
  }>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [milestonesDrawerOpen, setMilestonesDrawerOpen] = useState(false);
  
  // Task assignment state
  const [projectTasks, setProjectTasks] = useState<Array<{
    id: string;
    name: string;
    status: 'Not Started' | 'In Progress' | 'Complete' | 'Cancelled';
    dueDate: string;
    owner: string;
    notes: string;
    sectionId?: string;
    subtasks?: Array<{
      id: string;
      name: string;
      status: 'Not Started' | 'In Progress' | 'Complete' | 'Cancelled';
      dueDate: string;
      owner: string;
      notes: string;
    }>;
    isExpanded?: boolean;
  }>>([]);
  
  const [taskSections, setTaskSections] = useState<Array<{
    id: string;
    name: string;
    color: string;
    isCollapsed?: boolean;
  }>>([]);
  
  // Asset tracker state
  const [projectAssets, setProjectAssets] = useState<Array<{
    id: string;
    name: string;
    saltStatus: string;
    type: 'Print' | 'Digital';
    location: string;
    dueDate: string;
    notes: string;
    sectionId?: string;
  }>>([]);
  
  const [assetSections, setAssetSections] = useState<Array<{
    id: string;
    name: string;
    color: string;
    isCollapsed?: boolean;
  }>>([]);
  
  // Task search, sort, and filter state
  const [taskSearchTerm, setTaskSearchTerm] = useState('');
  const [taskSearchExpanded, setTaskSearchExpanded] = useState(false);
  const [taskSortBy, setTaskSortBy] = useState<'name' | 'status' | 'owner' | 'dueDate'>('name');
  const [taskFilterStatus, setTaskFilterStatus] = useState<string>('all');
  const [taskFilterOwner, setTaskFilterOwner] = useState<string>('all');
  const [taskFilterDue, setTaskFilterDue] = useState<string>('all');
  
  // Asset search, sort, and filter state
  const [assetSearchTerm, setAssetSearchTerm] = useState('');
  const [assetSearchExpanded, setAssetSearchExpanded] = useState(false);
  const [assetSortBy, setAssetSortBy] = useState<'dueDate' | 'saltStatus'>('dueDate');
  const [assetFilterSaltStatus, setAssetFilterSaltStatus] = useState<string>('all');
  const [assetFilterType, setAssetFilterType] = useState<string>('all');
  const [assetFilterLocation, setAssetFilterLocation] = useState<string>('all');
  
  // Recent programs state
  const [recentPrograms, setRecentPrograms] = useState<Array<{
    id: string;
    projectName: string;
    client: string;
    lastAccessed: string;
  }>>([]);
  
  // Team management state
  const [myTeamView, setMyTeamView] = useState<'overview' | 'build' | 'manage'>('manage');
  const [teamStructure, setTeamStructure] = useState<Array<{
    id: string;
    name: string;
    type: 'team' | 'person';
    role?: string;
    parentId?: string;
    members?: string[];
    isExpanded?: boolean;
  }>>([]);
  const [teamSearchTerm, setTeamSearchTerm] = useState('');
  const [showAddTeamModal, setShowAddTeamModal] = useState(false);
  const [showAddPersonModal, setShowAddPersonModal] = useState(false);
  const [selectedParentTeam, setSelectedParentTeam] = useState<string | null>(null);
  const [newTeamName, setNewTeamName] = useState('');
  const [selectedPersonForAdd, setSelectedPersonForAdd] = useState('');
  
  // Dashboard data state
  const [dashboardData, setDashboardData] = useState({
    yearComplete: 0,
    planConfirmed: 0,
    currentMonthFeesToClose: 0,
    projectsToClose: [] as any[],
    pendingQuotes: [] as any[],
    upcomingDeliverables: [] as any[]
  });

  useEffect(() => {
    loadDashboardData();
  }, [userView, user]);

  const loadDashboardData = () => {
    // Calculate % of year complete
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const endOfYear = new Date(now.getFullYear(), 11, 31);
    const yearComplete = ((now.getTime() - startOfYear.getTime()) / (endOfYear.getTime() - startOfYear.getTime())) * 100;

    // Load pipeline entries
    const pipelineEntries = cloudStorage.getItem('pipeline-entries');
    let entries = [];
    if (pipelineEntries) {
      try {
        entries = JSON.parse(pipelineEntries);
      } catch (e) {
        console.error('Error loading pipeline entries:', e);
      }
    }

    // Filter entries based on user view
    if (userView === 'Business Owner') {
      entries = entries.filter((entry: any) => entry.owner === user.name);
    }

    // Calculate % of plan confirmed
    const totalFees = entries.reduce((sum: number, entry: any) => sum + (entry.totalFees || 0), 0);
    const confirmedFees = entries
      .filter((entry: any) => entry.status === 'Confirmed')
      .reduce((sum: number, entry: any) => sum + (entry.totalFees || 0), 0);
    const planConfirmed = totalFees > 0 ? (confirmedFees / totalFees) * 100 : 0;

    // Get current month projects to close
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const projectsToClose = entries.filter((entry: any) => {
      if (entry.status === 'Confirmed' && entry.endMonth) {
        const endDate = new Date(entry.endMonth);
        return endDate.getMonth() === currentMonth && endDate.getFullYear() === currentYear;
      }
      return false;
    });

    // Calculate current month fees to close at 100%
    const currentMonthFeesToClose = projectsToClose.reduce((sum: number, entry: any) => sum + (entry.totalFees || 0), 0);

    // Load quotes that need approval
    const quotesData = cloudStorage.getItem('saltxc-quotes');
    let quotes = [];
    if (quotesData) {
      try {
        quotes = JSON.parse(quotesData);
      } catch (e) {
        console.error('Error loading quotes:', e);
      }
    }

    // Filter pending quotes
    const pendingQuotes = quotes.filter((quote: any) => {
      if (userView === 'Business Owner') {
        // Business owners see quotes for their projects
        return quote.status === 'pending' && entries.some((entry: any) => 
          entry.projectCode === quote.projectNumber && entry.owner === user.name
        );
      }
      return quote.status === 'pending';
    });

    // Load deliverables for next 2 weeks
    const twoWeeksFromNow = new Date(now);
    twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 14);
    
    const projectsData = cloudStorage.getItem('saltxc-quotes');
    const allDeliverables: any[] = [];
    if (projectsData) {
      try {
        const projects = JSON.parse(projectsData);
        projects.forEach((project: any) => {
          // Check if this project belongs to the user (for Business Owner view)
          const isUserProject = userView === 'Admin' || entries.some((entry: any) => 
            entry.projectCode === project.projectNumber && entry.owner === user.name
          );
          
          if (isUserProject && project.milestones) {
            project.milestones.forEach((milestone: any) => {
              if (milestone.date) {
                const milestoneDate = new Date(milestone.date);
                if (milestoneDate >= now && milestoneDate <= twoWeeksFromNow) {
                  allDeliverables.push({
                    projectName: project.projectName,
                    projectNumber: project.projectNumber,
                    milestone: milestone.name,
                    date: milestone.date,
                    status: milestone.status || 'pending'
                  });
                }
              }
            });
          }
        });
      } catch (e) {
        console.error('Error loading deliverables:', e);
      }
    }

    // Sort deliverables by date
    allDeliverables.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    setDashboardData({
      yearComplete: Math.round(yearComplete),
      planConfirmed: Math.round(planConfirmed),
      currentMonthFeesToClose,
      projectsToClose,
      pendingQuotes,
      upcomingDeliverables: allDeliverables
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Load staff data from CSV
  useEffect(() => {
    const loadStaffData = async () => {
      try {
        const response = await fetch('/Salt_staff.csv', { cache: 'no-cache' });
        if (!response.ok) throw new Error('Failed to load staff data');
        
        const csvText = await response.text();
        const lines = csvText.split('\n');
        const staff: Array<{ name: string; title: string; department?: string }> = [];
        
        // Skip header row
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          
          const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
          if (cols.length >= 2 && cols[0]) {
            staff.push({
              name: cols[0],
              title: cols[1] || '',
              department: cols[2] || ''
            });
          }
        }
        
        setStaffData(staff);
        console.log('✅ Loaded', staff.length, 'staff members');
      } catch (error) {
        console.error('❌ Failed to load staff data:', error);
      }
    };
    
    loadStaffData();
  }, []);

  // Extract resource roles from selected quote
  useEffect(() => {
    if (selectedProjectId && projectSubView === 'resourcing') {
      console.log('🔍 Loading resourcing data for project:', selectedProjectId);
      
      const quotes = JSON.parse(cloudStorage.getItem('saltxc-all-quotes') || '[]');
      console.log('📦 All quotes:', quotes.length);
      
      // Find all quotes for this project
      const projectQuotes = quotes.filter((q: any) => 
        q.projectNumber === selectedProjectId || 
        q.id === selectedProjectId ||
        (selectedProjectDetails && q.projectNumber === selectedProjectDetails.projectCode)
      );
      
      console.log('📋 Project quotes found:', projectQuotes.length, projectQuotes.map((q: any) => q.id));
      
      if (projectQuotes.length > 0) {
        const newAssignments: typeof resourceAssignments = {};
        
        // Process all quotes for this project
        projectQuotes.forEach((quote: any) => {
          console.log('🔄 Processing quote:', quote.id, 'phaseData:', quote.phaseData);
          
          if (quote.phaseData) {
            // Extract roles from all phases
            Object.keys(quote.phaseData).forEach((phase) => {
              if (!newAssignments[phase]) {
                newAssignments[phase] = {};
              }
              
              const stages = quote.phaseData[phase] || [];
              console.log(`📊 Phase "${phase}" has ${stages.length} stages`);
              
              stages.forEach((stage: any) => {
                console.log('  Stage departments:', stage.departments?.length || 0);
                stage.departments?.forEach((dept: any) => {
                  if (!newAssignments[phase][dept.name]) {
                    newAssignments[phase][dept.name] = [];
                  }
                  
                  console.log(`    Dept "${dept.name}" has ${dept.roles?.length || 0} roles`);
                  dept.roles?.forEach((role: any) => {
                    console.log(`      Role: ${role.name}, weeks: ${role.weeks}, allocation: ${role.allocation}, hours: ${role.hours}`);
                    
                    // Check if this role already exists
                    const existing = newAssignments[phase][dept.name].find(
                      r => r.roleName === role.name
                    );
                    
                    if (existing) {
                      // Aggregate weeks and hours
                      existing.weeks += role.weeks || 0;
                      existing.hours += role.hours || 0;
                      console.log(`      ✓ Aggregated to existing role: weeks=${existing.weeks}, hours=${existing.hours}`);
                    } else {
                      // Add new role
                      newAssignments[phase][dept.name].push({
                        roleName: role.name,
                        allocation: role.allocation || 100,
                        weeks: role.weeks || 0,
                        hours: role.hours || 0,
                        assignee: '',
                        startDate: '',
                        endDate: ''
                      });
                      console.log(`      ✓ Added new role`);
                    }
                  });
                });
              });
            });
            
            // Load existing assignments from pmData if available
            if (quote.pmData && quote.pmData.resourceAssignments) {
              console.log('💾 Loading existing assignments from pmData');
              Object.keys(quote.pmData.resourceAssignments).forEach((phase) => {
                Object.keys(quote.pmData.resourceAssignments[phase]).forEach((dept) => {
                  quote.pmData.resourceAssignments[phase][dept]?.forEach((assignment: any) => {
                    if (newAssignments[phase] && newAssignments[phase][dept]) {
                      const role = newAssignments[phase][dept].find(
                        r => r.roleName === assignment.roleName
                      );
                      if (role) {
                        role.assignee = assignment.assignee || '';
                        role.startDate = assignment.startDate || '';
                        role.endDate = assignment.endDate || '';
                        console.log(`  ✓ Loaded assignee for ${assignment.roleName}: ${role.assignee}`);
                      }
                    }
                  });
                });
              });
            }
          }
        });
        
        console.log('✅ Final resource assignments:', newAssignments);
        setResourceAssignments(newAssignments);
      } else {
        console.warn('⚠️ No quotes found for project:', selectedProjectId);
        setResourceAssignments({});
      }
    }
  }, [selectedProjectId, projectSubView, selectedProjectDetails]);

  const getTimeInTimezone = (timezone: string) => {
    return currentTime.toLocaleTimeString('en-US', { 
      timeZone: timezone, 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const navButtonBase =
    'w-full px-4 py-3 rounded-lg text-sm font-medium transition-colors flex items-center gap-3';
  const getNavButtonClasses = (isActive: boolean) =>
    `${navButtonBase} ${
      isActive
        ? 'bg-[#e8edff] text-[#142a63]'
        : 'text-[#415078] hover:bg-[#f3f5ff]'
    }`;
  const getNavIconClasses = (isActive: boolean) =>
    `w-4 h-4 ${isActive ? 'text-[#142a63]' : 'text-[#8f9abc]'}`;
  const getSubNavClasses = (isActive: boolean) =>
    `w-full px-4 py-2 rounded-md text-sm transition-colors text-left ${
      isActive
        ? 'bg-[#dce5ff] text-[#142a63]'
        : 'text-[#4a5a86] hover:bg-[#eef2ff]'
    }`;

  const handleUserViewChange = (view: 'Admin' | 'Business Owner' | 'Team Member') => {
    if (onUserViewChange) {
      onUserViewChange(view);
    }
  };

  const handlePipelineSubMenu = (subView: string) => {
    setPipelineSubView(subView);
    setSelectedSection('pipeline');
  };

  const handleProjectSubMenu = (subView: 'details' | 'quoting' | 'resourcing' | 'tasks' | 'assets') => {
    setProjectSubView(subView);
    setSelectedSection('project-management');
  };
  const handleOpenProject = (quoteId: string) => {
    setSelectedProjectId(quoteId);
    setProjectSubView('details'); // Always default to details view when opening a project
  };

  const handleBackToProjects = () => {
    setSelectedProjectId(null);
  };

  const handleOpenPerson = (name: string) => {
    setPersonName(name);
  };

  const handleOpenProjectWithData = (entry: any) => {
    // Create a standalone project from pipeline data
    const quotes = cloudStorage.getItem('saltxc-quotes');
    const allQuotes = quotes ? JSON.parse(quotes) : [];

    console.log('Opening project with data:', entry.projectCode);
    setSelectedProjectId(entry.projectCode);
    setSelectedProjectMeta({ 
      client: entry.client, 
      projectName: entry.programName 
    });
    setSelectedProjectDetails({
      status: entry.status,
      projectCode: entry.projectCode,
      client: entry.client,
      programName: entry.programName,
      startMonth: entry.startMonth,
      endMonth: entry.endMonth
    });
    
    // Add to recent programs
    addToRecentPrograms(entry.projectCode, entry.programName, entry.client);
  };

  // Load recent programs from cloudStorage
  useEffect(() => {
    try {
      const stored = cloudStorage.getItem('recent-programs');
      if (stored) {
        const programs = JSON.parse(stored);
        setRecentPrograms(programs.slice(0, 5)); // Keep only top 5
      }
    } catch (error) {
      console.error('Error loading recent programs:', error);
    }
  }, []);

  // Add a program to recent programs
  const addToRecentPrograms = (id: string, projectName: string, client: string) => {
    try {
      const stored = cloudStorage.getItem('recent-programs');
      let programs = stored ? JSON.parse(stored) : [];
      
      // Remove if already exists
      programs = programs.filter((p: any) => p.id !== id);
      
      // Add to front
      programs.unshift({
        id,
        projectName,
        client,
        lastAccessed: new Date().toISOString()
      });
      
      // Keep only top 5
      programs = programs.slice(0, 5);
      
      cloudStorage.setItem('recent-programs', JSON.stringify(programs));
      setRecentPrograms(programs);
    } catch (error) {
      console.error('Error saving recent programs:', error);
    }
  };

  // Team management functions
  useEffect(() => {
    // Load team structure from cloudStorage
    try {
      const stored = cloudStorage.getItem(`team-structure-${user.email}`);
      if (stored) {
        setTeamStructure(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading team structure:', error);
    }
  }, [user.email]);

  const saveTeamStructure = (structure: any[]) => {
    try {
      cloudStorage.setItem(`team-structure-${user.email}`, JSON.stringify(structure));
      setTeamStructure(structure);
    } catch (error) {
      console.error('Error saving team structure:', error);
    }
  };

  const addTeam = (parentId?: string) => {
    if (!newTeamName.trim()) return;
    
    const newTeam = {
      id: 'team-' + Date.now(),
      name: newTeamName.trim(),
      type: 'team' as const,
      parentId: parentId || undefined,
      members: [],
      isExpanded: true
    };
    
    const updated = [...teamStructure, newTeam];
    saveTeamStructure(updated);
    setNewTeamName('');
    setShowAddTeamModal(false);
    setSelectedParentTeam(null);
  };

  const addPersonToTeam = (parentId: string) => {
    if (!selectedPersonForAdd) return;
    
    const person = staffData.find(s => s.name === selectedPersonForAdd);
    if (!person) return;
    
    const newPerson = {
      id: 'person-' + Date.now(),
      name: person.name,
      type: 'person' as const,
      role: person.title,
      parentId: parentId
    };
    
    const updated = [...teamStructure, newPerson];
    saveTeamStructure(updated);
    setSelectedPersonForAdd('');
    setShowAddPersonModal(false);
    setSelectedParentTeam(null);
  };

  const removeTeamMember = (id: string) => {
    if (!confirm('Are you sure you want to remove this item?')) return;
    
    // Remove the item and any children
    const removeWithChildren = (itemId: string): string[] => {
      const children = teamStructure.filter(t => t.parentId === itemId);
      let toRemove = [itemId];
      children.forEach(child => {
        toRemove = [...toRemove, ...removeWithChildren(child.id)];
      });
      return toRemove;
    };
    
    const idsToRemove = removeWithChildren(id);
    const updated = teamStructure.filter(t => !idsToRemove.includes(t.id));
    saveTeamStructure(updated);
  };

  const toggleTeamExpansion = (id: string) => {
    const updated = teamStructure.map(t => 
      t.id === id ? { ...t, isExpanded: !t.isExpanded } : t
    );
    saveTeamStructure(updated);
  };

  const renderTeamTree = (parentId?: string, level: number = 0) => {
    const items = teamStructure.filter(t => t.parentId === parentId);
    
    return items.map(item => {
      const children = teamStructure.filter(t => t.parentId === item.id);
      const hasChildren = children.length > 0;
      
      return (
        <div key={item.id} style={{ marginLeft: `${level * 24}px` }}>
          <div className="flex items-center gap-2 py-2 px-3 hover:bg-gray-50 rounded-md group">
            {hasChildren && (
              <button
                onClick={() => toggleTeamExpansion(item.id)}
                className="p-1 hover:bg-gray-200 rounded"
              >
                {item.isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-gray-600" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-600" />
                )}
              </button>
            )}
            {!hasChildren && <div className="w-6" />}
            
            {item.type === 'team' ? (
              <Users className="w-5 h-5 text-blue-600" />
            ) : (
              <User className="w-5 h-5 text-gray-600" />
            )}
            
            <div className="flex-1">
              <div className="font-medium text-gray-900">{item.name}</div>
              {item.role && (
                <div className="text-xs text-gray-500">{item.role}</div>
              )}
            </div>
            
            {item.type === 'team' && (
              <button
                onClick={() => {
                  setSelectedParentTeam(item.id);
                  setShowAddPersonModal(true);
                }}
                className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-blue-100 rounded text-blue-600 text-xs"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
            
            <button
              onClick={() => removeTeamMember(item.id)}
              className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-100 rounded text-red-600"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          
          {item.isExpanded && hasChildren && renderTeamTree(item.id, level + 1)}
        </div>
      );
    });
  };

  // Calculate team member coverage from resourcing assignments
  const calculateTeamCoverage = () => {
    try {
      const quotes = JSON.parse(cloudStorage.getItem('saltxc-all-quotes') || '[]');
      const today = new Date();
      const currentWeekStart = new Date(today);
      currentWeekStart.setDate(today.getDate() - today.getDay());
      const currentWeekEnd = new Date(currentWeekStart);
      currentWeekEnd.setDate(currentWeekStart.getDate() + 6);
      
      const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const currentMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      
      const currentQuarter = Math.floor(today.getMonth() / 3);
      const currentQuarterStart = new Date(today.getFullYear(), currentQuarter * 3, 1);
      const currentQuarterEnd = new Date(today.getFullYear(), currentQuarter * 3 + 3, 0);
      
      // Get all team members (people only, not teams)
      const teamMembers = teamStructure.filter(t => t.type === 'person');
      
      const coverageData = teamMembers.map(member => {
        let weekHours = 0;
        let monthHours = 0;
        let quarterHours = 0;
        let weekAllocation = 0;
        let monthAllocation = 0;
        let quarterAllocation = 0;
        let weekCount = 0;
        let monthCount = 0;
        let quarterCount = 0;
        
        // Iterate through all quotes and their resource assignments
        quotes.forEach((quote: any) => {
          if (quote.pmData && quote.pmData.resourceAssignments) {
            Object.values(quote.pmData.resourceAssignments).forEach((depts: any) => {
              Object.values(depts).forEach((roles: any) => {
                if (Array.isArray(roles)) {
                  roles.forEach((role: any) => {
                    if (role.assignee === member.name && role.startDate && role.endDate) {
                      const assignmentStart = new Date(role.startDate);
                      const assignmentEnd = new Date(role.endDate);
                      
                      // Check if assignment overlaps with current week
                      if (assignmentStart <= currentWeekEnd && assignmentEnd >= currentWeekStart) {
                        weekHours += role.hours || 0;
                        weekAllocation += role.allocation || 0;
                        weekCount++;
                      }
                      
                      // Check if assignment overlaps with current month
                      if (assignmentStart <= currentMonthEnd && assignmentEnd >= currentMonthStart) {
                        monthHours += role.hours || 0;
                        monthAllocation += role.allocation || 0;
                        monthCount++;
                      }
                      
                      // Check if assignment overlaps with current quarter
                      if (assignmentStart <= currentQuarterEnd && assignmentEnd >= currentQuarterStart) {
                        quarterHours += role.hours || 0;
                        quarterAllocation += role.allocation || 0;
                        quarterCount++;
                      }
                    }
                  });
                }
              });
            });
          }
        });
        
        return {
          id: member.id,
          name: member.name,
          role: member.role || 'Team Member',
          parentId: member.parentId,
          week: {
            hours: Math.round(weekHours),
            allocation: weekCount > 0 ? Math.round(weekAllocation / weekCount) : 0,
            assignmentCount: weekCount
          },
          month: {
            hours: Math.round(monthHours),
            allocation: monthCount > 0 ? Math.round(monthAllocation / monthCount) : 0,
            assignmentCount: monthCount
          },
          quarter: {
            hours: Math.round(quarterHours),
            allocation: quarterCount > 0 ? Math.round(quarterAllocation / quarterCount) : 0,
            assignmentCount: quarterCount
          }
        };
      });
      
      return coverageData;
    } catch (error) {
      console.error('Error calculating team coverage:', error);
      return [];
    }
  };

  // Group coverage data by teams
  const getTeamsWithCoverage = () => {
    const coverageData = calculateTeamCoverage();
    const teams = teamStructure.filter(t => t.type === 'team');
    
    return teams.map(team => {
      const teamMembers = coverageData.filter(member => member.parentId === team.id);
      return {
        id: team.id,
        name: team.name,
        members: teamMembers,
        isCollapsed: !team.isExpanded
      };
    });
  };

  // Resource assignment functions
  const updateResourceAssignment = (phase: string, dept: string, roleIndex: number, assignee: string) => {
    setResourceAssignments(prev => {
      const updated = { ...prev };
      if (updated[phase] && updated[phase][dept] && updated[phase][dept][roleIndex]) {
        updated[phase][dept][roleIndex].assignee = assignee;
      }
      return updated;
    });
  };

  const updateResourceDate = (phase: string, dept: string, roleIndex: number, field: 'startDate' | 'endDate', date: string) => {
    setResourceAssignments(prev => {
      const updated = { ...prev };
      if (updated[phase] && updated[phase][dept] && updated[phase][dept][roleIndex]) {
        updated[phase][dept][roleIndex][field] = date;
      }
      return updated;
    });
  };

  const saveResourceAssignments = () => {
    try {
      const quotes = JSON.parse(cloudStorage.getItem('saltxc-all-quotes') || '[]');
      const quoteIndex = quotes.findIndex((q: any) => q.id === selectedProjectId);
      
      if (quoteIndex >= 0) {
        if (!quotes[quoteIndex].pmData) {
          quotes[quoteIndex].pmData = {};
        }
        
        quotes[quoteIndex].pmData.resourceAssignments = resourceAssignments;
        quotes[quoteIndex].lastModified = new Date().toISOString();
        
        cloudStorage.setItem('saltxc-all-quotes', JSON.stringify(quotes));
        
        // Trigger update event
        window.dispatchEvent(new Event('saltxc-quotes-updated'));
        
        alert('Resource assignments saved successfully!');
      }
    } catch (error) {
      console.error('Failed to save resource assignments:', error);
      alert('Failed to save resource assignments');
    }
  };

  const getFilteredStaff = (searchTerm: string) => {
    // Show all staff when no search term, otherwise filter
    if (!searchTerm) return staffData.slice(0, 50); // Show first 50 staff members
    const term = searchTerm.toLowerCase();
    return staffData.filter(s => 
      s.name.toLowerCase().includes(term) ||
      s.title.toLowerCase().includes(term)
    ).slice(0, 50); // Increased limit to 50
  };

  // Task management functions
  const addSection = () => {
    const colors = ['bg-blue-100', 'bg-purple-100', 'bg-green-100', 'bg-yellow-100', 'bg-pink-100', 'bg-indigo-100'];
    const newSection = {
      id: 'section-' + Date.now(),
      name: 'New Section',
      color: colors[taskSections.length % colors.length],
      isCollapsed: false
    };
    const updated = [...taskSections, newSection];
    setTaskSections(updated);
    saveSectionsToStorage(updated);
  };

  const updateSection = (sectionId: string, name: string) => {
    const updated = taskSections.map(section =>
      section.id === sectionId ? { ...section, name } : section
    );
    setTaskSections(updated);
    saveSectionsToStorage(updated);
  };

  const deleteSection = (sectionId: string) => {
    if (!confirm('Are you sure you want to delete this section and all its tasks?')) return;
    const updated = taskSections.filter(section => section.id !== sectionId);
    setTaskSections(updated);
    saveSectionsToStorage(updated);
    
    // Delete all tasks in this section
    const updatedTasks = projectTasks.filter(task => task.sectionId !== sectionId);
    setProjectTasks(updatedTasks);
    saveTasksToStorage(updatedTasks);
  };

  const toggleSectionCollapse = (sectionId: string) => {
    setTaskSections(taskSections.map(section =>
      section.id === sectionId ? { ...section, isCollapsed: !section.isCollapsed } : section
    ));
  };

  const addTask = (sectionId: string) => {
    const newTask = {
      id: 'task-' + Date.now(),
      name: 'New Task',
      status: 'Not Started' as const,
      dueDate: '',
      owner: '',
      notes: '',
      sectionId,
      isExpanded: false
    };
    setProjectTasks([...projectTasks, newTask]);
    saveTasksToStorage([...projectTasks, newTask]);
  };

  const addSubtask = (parentTaskId: string) => {
    const newSubtask = {
      id: 'subtask-' + Date.now(),
      name: 'New Subtask',
      status: 'Not Started' as const,
      dueDate: '',
      owner: '',
      notes: ''
    };
    
    const updated = projectTasks.map(task => {
      if (task.id === parentTaskId) {
        return {
          ...task,
          subtasks: [...(task.subtasks || []), newSubtask],
          isExpanded: true
        };
      }
      return task;
    });
    
    setProjectTasks(updated);
    saveTasksToStorage(updated);
  };

  const updateTask = (taskId: string, field: string, value: any) => {
    const updated = projectTasks.map(task => {
      if (task.id === taskId) {
        return { ...task, [field]: value };
      }
      return task;
    });
    setProjectTasks(updated);
    saveTasksToStorage(updated);
  };

  const updateSubtask = (parentTaskId: string, subtaskId: string, field: string, value: any) => {
    const updated = projectTasks.map(task => {
      if (task.id === parentTaskId && task.subtasks) {
        return {
          ...task,
          subtasks: task.subtasks.map(subtask =>
            subtask.id === subtaskId ? { ...subtask, [field]: value } : subtask
          )
        };
      }
      return task;
    });
    setProjectTasks(updated);
    saveTasksToStorage(updated);
  };

  const deleteTask = (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    const updated = projectTasks.filter(task => task.id !== taskId);
    setProjectTasks(updated);
    saveTasksToStorage(updated);
  };

  const deleteSubtask = (parentTaskId: string, subtaskId: string) => {
    if (!confirm('Are you sure you want to delete this subtask?')) return;
    const updated = projectTasks.map(task => {
      if (task.id === parentTaskId && task.subtasks) {
        return {
          ...task,
          subtasks: task.subtasks.filter(subtask => subtask.id !== subtaskId)
        };
      }
      return task;
    });
    setProjectTasks(updated);
    saveTasksToStorage(updated);
  };

  const toggleTaskExpansion = (taskId: string) => {
    setProjectTasks(projectTasks.map(task =>
      task.id === taskId ? { ...task, isExpanded: !task.isExpanded } : task
    ));
  };

  const saveTasksToStorage = (tasks: any[]) => {
    try {
      const entriesRaw = cloudStorage.getItem('pipeline-entries');
      const entries = entriesRaw ? JSON.parse(entriesRaw) : [];
      const pipelineIdx = entries.findIndex((e: any) => e.projectCode === selectedProjectDetails?.projectCode);
      
      if (pipelineIdx >= 0) {
        entries[pipelineIdx].tasks = tasks;
        entries[pipelineIdx].lastModified = new Date().toISOString();
        cloudStorage.setItem('pipeline-entries', JSON.stringify(entries));
        window.dispatchEvent(new Event('pipeline-updated'));
      }
    } catch (error) {
      console.error('Error saving tasks:', error);
    }
  };

  const saveSectionsToStorage = (sections: any[]) => {
    try {
      const entriesRaw = cloudStorage.getItem('pipeline-entries');
      const entries = entriesRaw ? JSON.parse(entriesRaw) : [];
      const pipelineIdx = entries.findIndex((e: any) => e.projectCode === selectedProjectDetails?.projectCode);
      
      if (pipelineIdx >= 0) {
        entries[pipelineIdx].taskSections = sections;
        entries[pipelineIdx].lastModified = new Date().toISOString();
        cloudStorage.setItem('pipeline-entries', JSON.stringify(entries));
        window.dispatchEvent(new Event('pipeline-updated'));
      }
    } catch (error) {
      console.error('Error saving sections:', error);
    }
  };

  // Asset management functions
  const addAssetSection = () => {
    const colors = ['bg-blue-100', 'bg-purple-100', 'bg-green-100', 'bg-yellow-100', 'bg-pink-100', 'bg-indigo-100'];
    const newSection = {
      id: 'asset-section-' + Date.now(),
      name: 'New Section',
      color: colors[assetSections.length % colors.length],
      isCollapsed: false
    };
    const updated = [...assetSections, newSection];
    setAssetSections(updated);
    saveAssetSectionsToStorage(updated);
  };

  const updateAssetSection = (sectionId: string, name: string) => {
    const updated = assetSections.map(section =>
      section.id === sectionId ? { ...section, name } : section
    );
    setAssetSections(updated);
    saveAssetSectionsToStorage(updated);
  };

  const deleteAssetSection = (sectionId: string) => {
    if (!confirm('Are you sure you want to delete this section and all its assets?')) return;
    const updated = assetSections.filter(section => section.id !== sectionId);
    setAssetSections(updated);
    saveAssetSectionsToStorage(updated);
    
    // Delete all assets in this section
    const updatedAssets = projectAssets.filter(asset => asset.sectionId !== sectionId);
    setProjectAssets(updatedAssets);
    saveAssetsToStorage(updatedAssets);
  };

  const toggleAssetSectionCollapse = (sectionId: string) => {
    setAssetSections(assetSections.map(section =>
      section.id === sectionId ? { ...section, isCollapsed: !section.isCollapsed } : section
    ));
  };

  const addAsset = (sectionId: string) => {
    const newAsset = {
      id: 'asset-' + Date.now(),
      name: 'New Asset',
      saltStatus: '',
      type: 'Digital' as const,
      location: '',
      dueDate: '',
      notes: '',
      sectionId
    };
    setProjectAssets([...projectAssets, newAsset]);
    saveAssetsToStorage([...projectAssets, newAsset]);
  };

  const updateAsset = (assetId: string, field: string, value: any) => {
    const updated = projectAssets.map(asset => {
      if (asset.id === assetId) {
        return { ...asset, [field]: value };
      }
      return asset;
    });
    setProjectAssets(updated);
    saveAssetsToStorage(updated);
  };

  const deleteAsset = (assetId: string) => {
    if (!confirm('Are you sure you want to delete this asset?')) return;
    const updated = projectAssets.filter(asset => asset.id !== assetId);
    setProjectAssets(updated);
    saveAssetsToStorage(updated);
  };

  const saveAssetsToStorage = (assets: any[]) => {
    try {
      const entriesRaw = cloudStorage.getItem('pipeline-entries');
      const entries = entriesRaw ? JSON.parse(entriesRaw) : [];
      const pipelineIdx = entries.findIndex((e: any) => e.projectCode === selectedProjectDetails?.projectCode);
      
      if (pipelineIdx >= 0) {
        entries[pipelineIdx].assets = assets;
        entries[pipelineIdx].lastModified = new Date().toISOString();
        cloudStorage.setItem('pipeline-entries', JSON.stringify(entries));
        window.dispatchEvent(new Event('pipeline-updated'));
      }
    } catch (error) {
      console.error('Error saving assets:', error);
    }
  };

  const saveAssetSectionsToStorage = (sections: any[]) => {
    try {
      const entriesRaw = cloudStorage.getItem('pipeline-entries');
      const entries = entriesRaw ? JSON.parse(entriesRaw) : [];
      const pipelineIdx = entries.findIndex((e: any) => e.projectCode === selectedProjectDetails?.projectCode);
      
      if (pipelineIdx >= 0) {
        entries[pipelineIdx].assetSections = sections;
        entries[pipelineIdx].lastModified = new Date().toISOString();
        cloudStorage.setItem('pipeline-entries', JSON.stringify(entries));
        window.dispatchEvent(new Event('pipeline-updated'));
      }
    } catch (error) {
      console.error('Error saving asset sections:', error);
    }
  };

  const getAssignedResources = () => {
    const resources = new Set<string>();
    Object.values(resourceAssignments).forEach((depts: any) => {
      Object.values(depts).forEach((roles: any) => {
        if (Array.isArray(roles)) {
          roles.forEach((role: any) => {
            if (role.assignee) {
              resources.add(role.assignee);
            }
          });
        }
      });
    });
    return Array.from(resources);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Complete':
        return 'bg-green-500';
      case 'In Progress':
        return 'bg-blue-500';
      case 'Cancelled':
        return 'bg-red-500';
      default:
        return 'bg-gray-300';
    }
  };

  // Task filtering and sorting functions
  const getFilteredAndSortedTasks = (tasks: any[]) => {
    let filtered = [...tasks];
    
    // Apply search filter
    if (taskSearchTerm) {
      const term = taskSearchTerm.toLowerCase();
      filtered = filtered.filter(task => 
        task.name.toLowerCase().includes(term) ||
        task.owner.toLowerCase().includes(term) ||
        task.notes.toLowerCase().includes(term)
      );
    }
    
    // Apply status filter
    if (taskFilterStatus !== 'all') {
      filtered = filtered.filter(task => task.status === taskFilterStatus);
    }
    
    // Apply owner filter
    if (taskFilterOwner !== 'all') {
      filtered = filtered.filter(task => task.owner === taskFilterOwner);
    }
    
    // Apply due date filter
    if (taskFilterDue !== 'all') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      filtered = filtered.filter(task => {
        if (!task.dueDate) return taskFilterDue === 'none';
        
        const dueDate = new Date(task.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        
        switch (taskFilterDue) {
          case 'overdue':
            return dueDate < today && task.status !== 'Complete';
          case 'today':
            return dueDate.getTime() === today.getTime();
          case 'upcoming':
            return dueDate > today;
          case 'none':
            return false;
          default:
            return true;
        }
      });
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      switch (taskSortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'status':
          return a.status.localeCompare(b.status);
        case 'owner':
          return (a.owner || '').localeCompare(b.owner || '');
        case 'dueDate':
          if (!a.dueDate && !b.dueDate) return 0;
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        default:
          return 0;
      }
    });
    
    return filtered;
  };

  const getUniqueOwners = () => {
    const owners = new Set<string>();
    projectTasks.forEach(task => {
      if (task.owner) owners.add(task.owner);
    });
    return Array.from(owners).sort();
  };

  // Asset filtering and sorting functions
  const getFilteredAndSortedAssets = (assets: any[]) => {
    let filtered = [...assets];
    
    // Apply search filter
    if (assetSearchTerm) {
      const term = assetSearchTerm.toLowerCase();
      filtered = filtered.filter(asset => 
        asset.name.toLowerCase().includes(term) ||
        asset.saltStatus.toLowerCase().includes(term) ||
        asset.location.toLowerCase().includes(term) ||
        asset.notes.toLowerCase().includes(term)
      );
    }
    
    // Apply salt status filter
    if (assetFilterSaltStatus !== 'all') {
      filtered = filtered.filter(asset => asset.saltStatus === assetFilterSaltStatus);
    }
    
    // Apply type filter
    if (assetFilterType !== 'all') {
      filtered = filtered.filter(asset => asset.type === assetFilterType);
    }
    
    // Apply location filter
    if (assetFilterLocation !== 'all') {
      filtered = filtered.filter(asset => asset.location === assetFilterLocation);
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      switch (assetSortBy) {
        case 'dueDate':
          if (!a.dueDate && !b.dueDate) return 0;
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        case 'saltStatus':
          return (a.saltStatus || '').localeCompare(b.saltStatus || '');
        default:
          return 0;
      }
    });
    
    return filtered;
  };

  const getUniqueSaltStatuses = () => {
    const statuses = new Set<string>();
    projectAssets.forEach(asset => {
      if (asset.saltStatus) statuses.add(asset.saltStatus);
    });
    return Array.from(statuses).sort();
  };

  const getUniqueLocations = () => {
    const locations = new Set<string>();
    projectAssets.forEach(asset => {
      if (asset.location) locations.add(asset.location);
    });
    return Array.from(locations).sort();
  };

  // Load selected project metadata for header and details for the Project Details view
  useEffect(() => {
    if (!selectedProjectId) {
      setSelectedProjectMeta(null);
      setSelectedProjectDetails(null);
      setProjectMilestones([]);
      setSelectedProjectQuotes([]);
      return;
    }
    try {
      const quotesRaw = cloudStorage.getItem('saltxc-all-quotes');
      const quotes = quotesRaw ? JSON.parse(quotesRaw) : [];
      const found = quotes.find((q: any) => q.id === selectedProjectId);

      const pipelineRaw = cloudStorage.getItem('pipeline-entries');
      const pipelineEntries = pipelineRaw ? JSON.parse(pipelineRaw) : [];
      
      // Try to find matching pipeline entry by project code from quote, or directly by selectedProjectId as project code
      let matchingEntry = null;
      if (found) {
        matchingEntry = pipelineEntries.find((e: any) => e.projectCode === found.projectNumber);
      }
      // If no quote found, try using selectedProjectId as the project code directly
      if (!matchingEntry) {
        matchingEntry = pipelineEntries.find((e: any) => e.projectCode === selectedProjectId);
      }

      console.log('🔍 Loading project details:', {
        selectedProjectId,
        foundQuote: !!found,
        foundPipelineEntry: !!matchingEntry,
        projectCode: found?.projectNumber || selectedProjectId
      });

      // Header meta
      if (found || matchingEntry) {
        const projectMeta = {
          client: (found?.clientName || found?.client || matchingEntry?.client || ''),
          projectName: (found?.projectName || matchingEntry?.programName || '')
        };
        setSelectedProjectMeta(projectMeta);
        
        // Add to recent programs when project is loaded
        const projectCode = matchingEntry?.projectCode || found?.projectNumber || selectedProjectId;
        if (projectCode && projectMeta.projectName) {
          addToRecentPrograms(projectCode, projectMeta.projectName, projectMeta.client);
        }
      } else {
        setSelectedProjectMeta(null);
      }

      // Details payload - prioritize pipeline entry data
      const details = {
        status: (matchingEntry?.status || found?.status || 'Open') as string,
        projectCode: (matchingEntry?.projectCode || found?.projectNumber || selectedProjectId || '') as string,
        client: (matchingEntry?.client || found?.clientName || found?.client || '') as string,
        programName: (matchingEntry?.programName || found?.projectName || '') as string,
        owner: matchingEntry?.owner || '',
        region: matchingEntry?.region || '',
        programType: matchingEntry?.programType || '',
        startMonth: matchingEntry?.startMonth || found?.inMarketDate || '',
        endMonth: matchingEntry?.endMonth || found?.projectCompletionDate || '',
        revenue: matchingEntry?.revenue || 0,
        totalFees: matchingEntry?.totalFees || 0
      };
      setSelectedProjectDetails(details);

      // Load tasks - prioritize pipeline entry data
      const tasks = Array.isArray(matchingEntry?.tasks) 
        ? matchingEntry.tasks 
        : [];
      setProjectTasks(tasks);

      // Milestones - prioritize pipeline entry data
      const milestones = Array.isArray(matchingEntry?.milestones) 
        ? matchingEntry.milestones 
        : (Array.isArray(found?.milestones) ? found.milestones : []);
      setProjectMilestones(milestones);

      // Quotes for this project
      const projectNumber = (matchingEntry?.projectCode || found?.projectNumber || selectedProjectId || '') as string;
      let projectQuotes = Array.isArray(quotes) ? quotes.filter((q: any) => (q.projectNumber || '') === projectNumber) : [];
      
      // Recalculate totals for all quotes in case they weren't calculated before
      projectQuotes = projectQuotes.map((q: any) => {
        if (q.phaseData || q.productionData) {
          const { totalFees, totalRevenue } = calculateQuoteTotals(q.phaseData || {}, q.productionData || {});
          return {
            ...q,
            totalFees,
            totalRevenue
          };
        }
        return q;
      });
      
      // Update cloudStorage with recalculated totals
      const updatedQuotes = quotes.map((q: any) => {
        const matchingQuote = projectQuotes.find((pq: any) => pq.id === q.id);
        return matchingQuote || q;
      });
      cloudStorage.setItem('saltxc-all-quotes', JSON.stringify(updatedQuotes));
      
      setSelectedProjectQuotes(projectQuotes);
      
      // Set phase dates from project details (use project start/end as defaults for all phases)
      if (matchingEntry?.startMonth && matchingEntry?.endMonth) {
        const projectStartDate = new Date(matchingEntry.startMonth).toISOString().split('T')[0];
        const projectEndDate = new Date(matchingEntry.endMonth).toISOString().split('T')[0];
        
        // Initialize phase dates with project dates
        // In the future, this could be customized per phase
        const initialPhaseDates: { [phase: string]: { startDate: string; endDate: string } } = {};
        ['Planning', 'Production', 'Post Production'].forEach(phase => {
          initialPhaseDates[phase] = {
            startDate: projectStartDate,
            endDate: projectEndDate
          };
        });
        setPhaseDates(initialPhaseDates);
      }
    } catch (error) {
      console.error('❌ Error loading project details:', error);
      setSelectedProjectMeta(null);
      setSelectedProjectDetails(null);
      setProjectMilestones([]);
      setSelectedProjectQuotes([]);
    }
  }, [selectedProjectId]);

  // Helpers for calendar rendering
  const startOfMonth = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1);
  const endOfMonth = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 0);
  const startWeekday = startOfMonth.getDay(); // 0 = Sun
  const daysInMonth = endOfMonth.getDate();

  const prevMonth = () => {
    const d = new Date(calendarDate);
    d.setMonth(d.getMonth() - 1);
    setCalendarDate(d);
  };

  const nextMonth = () => {
    const d = new Date(calendarDate);
    d.setMonth(d.getMonth() + 1);
    setCalendarDate(d);
  };

  const saveMilestones = (updated: Array<{ name: string; date: string }>) => {
    try {
      // Save to pipeline entries
      const entriesRaw = cloudStorage.getItem('pipeline-entries');
      const entries = entriesRaw ? JSON.parse(entriesRaw) : [];
      const pipelineIdx = entries.findIndex((e: any) => e.projectCode === selectedProjectDetails?.projectCode);
      if (pipelineIdx >= 0) {
        entries[pipelineIdx].milestones = updated;
        entries[pipelineIdx].lastModified = new Date().toISOString();
        cloudStorage.setItem('pipeline-entries', JSON.stringify(entries));
        window.dispatchEvent(new Event('pipeline-updated'));
      }
      
      // Also save to quotes storage for backward compatibility
      const quotesRaw = cloudStorage.getItem('saltxc-all-quotes');
      const quotes = quotesRaw ? JSON.parse(quotesRaw) : [];
      const quoteIdx = quotes.findIndex((q: any) => q.projectNumber === selectedProjectDetails?.projectCode);
      if (quoteIdx >= 0) {
        quotes[quoteIdx].milestones = updated;
        quotes[quoteIdx].lastModified = new Date().toISOString();
        cloudStorage.setItem('saltxc-all-quotes', JSON.stringify(quotes));
      }
    } catch (error) {
      console.error('Error saving milestones:', error);
    }
    setProjectMilestones(updated);
  };

  const addMilestone = (day: number) => {
    if (!selectedProjectId) return;
    const name = typeof window !== 'undefined' ? window.prompt('Milestone name') : null;
    if (!name) return;
    const date = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), day);
    const iso = date.toISOString();
    const updated = [...projectMilestones, { name: name.trim(), date: iso }];
    // sort by date ascending
    updated.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    saveMilestones(updated);
  };

  // Load quote builder state when a quote is selected
  useEffect(() => {
    if (!editingQuoteId) {
      // Clear quote state when no quote is being edited
      setQuoteProject(null);
      setPhaseData({});
      setProductionData({});
      setQuoteReviewData({ projectScope: '', descriptions: {}, invoiceItems: [] });
      return;
    }
    
    try {
      const quotesRaw = cloudStorage.getItem('saltxc-all-quotes');
      const quotes = quotesRaw ? JSON.parse(quotesRaw) : [];
      const q = quotes.find((x: any) => x.id === editingQuoteId);
      
      console.log('🔍 Loading quote for editing:', {
        editingQuoteId,
        foundQuote: !!q,
        totalQuotes: quotes.length,
        quoteData: q ? {
          hasProject: !!q.project,
          hasPhaseData: !!q.phaseData,
          hasProductionData: !!q.productionData
        } : null
      });
      
      if (q) {
        // Build a minimal Project-like payload from quote fields if project object missing
        const p = q.project || {
          projectNumber: q.projectNumber || selectedProjectDetails?.projectCode || '',
          clientName: q.clientName || selectedProjectDetails?.client || '',
          clientCategory: '',
          brand: q.brand || selectedProjectDetails?.client || '',
          projectName: q.projectName || selectedProjectDetails?.programName || '',
          startDate: q.inMarketDate || selectedProjectDetails?.startMonth || '',
          endDate: q.projectCompletionDate || selectedProjectDetails?.endMonth || '',
          totalProgramBudget: q.totalRevenue || 0,
          rateCard: 'Standard',
          currency: q.currency || 'CAD',
          phases: q.project?.phases || [],
          phaseSettings: q.project?.phaseSettings || {},
          budgetLabel: q.budgetLabel || 'Net New'
        };
        
        // Ensure phases is always an array
        if (!p.phases || !Array.isArray(p.phases)) {
          p.phases = [];
        }
        
        console.log('✅ Setting quote project:', {
          ...p,
          phasesCount: p.phases.length,
          phases: p.phases
        });
        setQuoteProject(p);
        setPhaseData(q.phaseData || {});
        setProductionData(q.productionData || {});
        setQuoteReviewData(q.quoteReviewData || { projectScope: '', descriptions: {}, invoiceItems: [] });
      } else {
        console.warn('⚠️ Quote not found for editing:', editingQuoteId);
      }
    } catch (error) {
      console.error('❌ Error loading quote:', error);
    }
  }, [editingQuoteId, selectedProjectDetails]);

  // Reload quote data when switching tabs to ensure we have the latest saved data
  useEffect(() => {
    if (editingQuoteId && quoteEditorTab !== 'setup') {
      console.log('🔄 Tab changed to:', quoteEditorTab, '- Reloading quote data from cloudStorage');
      try {
        const quotesRaw = cloudStorage.getItem('saltxc-all-quotes');
        const quotes = quotesRaw ? JSON.parse(quotesRaw) : [];
        const q = quotes.find((x: any) => x.id === editingQuoteId);
        
        if (q && q.project) {
          console.log('✅ Reloaded quote project with phases:', {
            phases: q.project.phases,
            phaseSettings: q.project.phaseSettings
          });
          setQuoteProject(q.project);
        }
      } catch (error) {
        console.error('❌ Error reloading quote on tab change:', error);
      }
    }
  }, [quoteEditorTab, editingQuoteId]);

  const calculateQuoteTotals = (phaseData: any, productionData: any) => {
    let totalFees = 0;
    let totalProductionCosts = 0;
    
    // Calculate project fees from phaseData
    Object.values(phaseData || {}).forEach((stages: any) => {
      if (Array.isArray(stages)) {
        stages.forEach((stage: any) => {
          stage.departments?.forEach((dept: any) => {
            dept.roles?.forEach((role: any) => {
              if (role.totalDollars) {
                totalFees += Math.round(role.totalDollars);
              }
            });
          });
        });
      }
    });
    
    // Calculate production costs from productionData
    Object.values(productionData || {}).forEach((phaseCategories: any) => {
      Object.values(phaseCategories || {}).forEach((categoryData: any) => {
        // Standard items
        if (categoryData.standardItems) {
          categoryData.standardItems.forEach((item: any) => {
            if (item.totalCost) {
              totalProductionCosts += Math.round(item.totalCost);
            }
          });
        }
        // Media items
        if (categoryData.mediaItems) {
          categoryData.mediaItems.forEach((item: any) => {
            if (item.totalCost) {
              totalProductionCosts += Math.round(item.totalCost);
            }
          });
        }
        // Field staff items
        if (categoryData.fieldStaffItems) {
          categoryData.fieldStaffItems.forEach((item: any) => {
            if (item.totalCost) {
              totalProductionCosts += Math.round(item.totalCost);
            }
          });
        }
      });
    });
    
    // Add 1.5% resourcing fee for Creative and Design departments
    let creativeTotal = 0;
    let designTotal = 0;
    
    Object.values(phaseData || {}).forEach((stages: any) => {
      if (Array.isArray(stages)) {
        stages.forEach((stage: any) => {
          stage.departments?.forEach((dept: any) => {
            if (dept.name === 'Creative') {
              dept.roles?.forEach((role: any) => {
                if (role.totalDollars) {
                  creativeTotal += Math.round(role.totalDollars);
                }
              });
            } else if (dept.name === 'Design') {
              dept.roles?.forEach((role: any) => {
                if (role.totalDollars) {
                  designTotal += Math.round(role.totalDollars);
                }
              });
            }
          });
        });
      }
    });
    
    const creativeResourcingFee = Math.round(creativeTotal * 0.015);
    const designResourcingFee = Math.round(designTotal * 0.015);
    const resourcingFees = creativeResourcingFee + designResourcingFee;
    
    const totalRevenue = totalFees + totalProductionCosts + resourcingFees;
    
    console.log('📊 Calculated quote totals:', {
      totalFees,
      totalProductionCosts,
      creativeResourcingFee,
      designResourcingFee,
      totalRevenue
    });
    
    return {
      totalFees: totalFees + resourcingFees, // Include resourcing in fees
      totalRevenue
    };
  };

  const persistQuoteState = (patch: any) => {
    console.log('💾 persistQuoteState called:', {
      editingQuoteId,
      patchKeys: Object.keys(patch),
      patch
    });
    
    setSaveStatus('saving');
    try {
      const quotesRaw = cloudStorage.getItem('saltxc-all-quotes');
      const quotes = quotesRaw ? JSON.parse(quotesRaw) : [];
      
      console.log('📦 Current quotes in cloudStorage:', {
        totalQuotes: quotes.length,
        quoteIds: quotes.map((q: any) => q.id)
      });
      
      const idx = quotes.findIndex((x: any) => x.id === editingQuoteId);
      
      if (idx >= 0) {
        console.log('✅ Found quote at index:', idx);
        
        // Merge the patch with existing quote
        const updatedQuote = { ...quotes[idx], ...patch, lastModified: new Date().toISOString() };
        
        // Calculate totals if phaseData or productionData is being updated
        if (patch.phaseData || patch.productionData) {
          const currentPhaseData = patch.phaseData || quotes[idx].phaseData || {};
          const currentProductionData = patch.productionData || quotes[idx].productionData || {};
          
          const { totalFees, totalRevenue } = calculateQuoteTotals(currentPhaseData, currentProductionData);
          
          updatedQuote.totalFees = totalFees;
          updatedQuote.totalRevenue = totalRevenue;
          
          console.log('💰 Updated quote totals:', {
            totalFees,
            totalRevenue
          });
        }
        
        quotes[idx] = updatedQuote;
        cloudStorage.setItem('saltxc-all-quotes', JSON.stringify(quotes));
        
        // refresh list cache too
        const projectQuotes = quotes.filter((qq: any) => (qq.projectNumber || '') === (selectedProjectDetails?.projectCode || ''));
        setSelectedProjectQuotes(projectQuotes);
        
        console.log('💾 Persisted quote state:', {
          quoteId: editingQuoteId,
          updatedFields: Object.keys(patch),
          updatedQuote: quotes[idx]
        });
        
        // Show saved status
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } else {
        console.warn('⚠️ Could not find quote to persist:', {
          editingQuoteId,
          availableIds: quotes.map((q: any) => q.id)
        });
        setSaveStatus('idle');
      }
    } catch (error) {
      console.error('❌ Error persisting quote state:', error);
      setSaveStatus('idle');
    }
  };
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#eef1fc] shadow-sm border-b">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <div className={`${poppins.className} poppins-force w-12 h-12 rounded-full bg-[#9B42F3] flex items-center justify-center`}>
              <span className="text-white text-2xl font-bold leading-none">S</span>
            </div>
            <span className={`${poppins.className} poppins-force text-4xl flex items-baseline gap-1`}>
              <span className="font-bold leading-none">salt</span>
              <span className="font-light leading-none">hub</span>
            </span>
            </div>
            
          <div className="flex items-center gap-4">
                  <Button 
                    variant="outline" 
              onClick={onBackToHub}
              className="text-sm"
                  >
              ← Back to Hub
                  </Button>
            <Select value={userView} onValueChange={handleUserViewChange}>
              <SelectTrigger className="w-52 bg-white text-sm">
                <SelectValue placeholder="Select user type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Admin">Admin</SelectItem>
                <SelectItem value="Business Owner">Business Owner</SelectItem>
                <SelectItem value="Team Member">Team Member</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="flex flex-1">
        {/* Sidebar */}
        <aside className="w-64 bg-[#f5f5f7] min-h-screen border-r border-gray-200 p-4 flex-shrink-0">
          <nav className="space-y-2">
            <button
              onClick={() => {
                setSelectedSection('overview');
                setSelectedProjectId(null);
              }}
              className={getNavButtonClasses(selectedSection === 'overview')}
            >
              <Home className={`${getNavIconClasses(selectedSection === 'overview')} mr-3`} />
                <span>Home</span>
              </button>

            {/* My Team - only for Admin and Business Owner */}
            {(userView === 'Admin' || userView === 'Business Owner') && (
              <button
                onClick={() => {
                  setSelectedSection('my-team');
                  setSelectedProjectId(null);
                }}
                className={getNavButtonClasses(selectedSection === 'my-team')}
              >
                <Users className={`${getNavIconClasses(selectedSection === 'my-team')} mr-3`} />
                <span>My Team</span>
              </button>
            )}

            {/* Business Pipeline with submenu */}
              <div>
                <button
                  onClick={() => {
                    setPipelineExpanded(!pipelineExpanded);
                    if (!pipelineExpanded) {
                      setSelectedSection('pipeline');
                    }
                  }}
                className={`${getNavButtonClasses(selectedSection === 'pipeline')} justify-between`}
              >
                <div className="flex items-center gap-3">
                  <TrendingUp className={getNavIconClasses(selectedSection === 'pipeline')} />
                    <span>Business Pipeline</span>
                  </div>
                {pipelineExpanded ? (
                  <ChevronDown className={getNavIconClasses(selectedSection === 'pipeline')} />
                ) : (
                  <ChevronRight className={getNavIconClasses(selectedSection === 'pipeline')} />
                )}
                </button>

                {pipelineExpanded && (
                <div className="ml-4 mt-1 space-y-1">
              {[
                { key: 'executive', label: 'Financial Health' },
                { key: 'pipeline', label: 'Pipeline Overview' },
                { key: 'annualPlan', label: 'Annual Plan' },
                { key: 'weighted', label: 'Weighted ROIs' },
                { key: 'overheads', label: 'Overheads' },
                { key: 'reporting', label: 'Downloads' },
                { key: 'settings', label: 'Settings' }
              ].map(item => (
                    <button
                  key={item.key}
                  onClick={() => handlePipelineSubMenu(item.key)}
                  className={getSubNavClasses(pipelineSubView === item.key)}
                >
                  {item.label}
                    </button>
              ))}
                  </div>
                )}
              </div>

                    <button
              onClick={() => {
                setSelectedSection('project-management');
                setSelectedProjectId(null);
              }}
              className={getNavButtonClasses(selectedSection === 'project-management')}
            >
              <Briefcase className={`${getNavIconClasses(selectedSection === 'project-management')} mr-3`} />
                <span>Project Workspace</span>
                    </button>
              {selectedProjectId !== null && (
                <div className="ml-4 mt-1 space-y-1">
                  {[
                    { key: 'details', label: 'Project Details' },
                    { key: 'quoting', label: 'Quoting' },
                    { key: 'resourcing', label: 'Resourcing' },
                    { key: 'tasks', label: 'Task Assignment' },
                    { key: 'assets', label: 'Asset Tracker' }
                  ].map(item => (
                    <button
                      key={item.key}
                      onClick={() => handleProjectSubMenu(item.key as 'details' | 'quoting' | 'resourcing' | 'tasks' | 'assets')}
                      className={getSubNavClasses(projectSubView === (item.key as any))}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Recent Programs */}
              {recentPrograms.length > 0 && (
                <>
                  <div className="my-4 border-t border-gray-300"></div>
                  <div className="px-4 py-2 flex items-center gap-3 text-sm font-medium text-[#415078]">
                    <Clock className="w-4 h-4 text-[#8f9abc]" />
                    <span>Recent Programs</span>
                  </div>
                  <div className="space-y-1">
                    {recentPrograms.map((program) => (
                      <button
                        key={program.id}
                        onClick={() => {
                          // Find the program in pipeline entries
                          try {
                            const entriesRaw = cloudStorage.getItem('pipeline-entries');
                            const entries = entriesRaw ? JSON.parse(entriesRaw) : [];
                            const entry = entries.find((e: any) => e.projectCode === program.id);
                            
                            if (entry) {
                              handleOpenProjectWithData(entry);
                              setSelectedSection('project-management');
                              setProjectSubView('details');
                            } else {
                              // Fallback: try to open as quote ID
                              setSelectedProjectId(program.id);
                              setSelectedSection('project-management');
                              setProjectSubView('details');
                            }
                          } catch (error) {
                            console.error('Error opening recent program:', error);
                          }
                        }}
                        className="w-full px-4 py-2 rounded-md text-xs text-left transition-colors text-[#4a5a86] hover:bg-[#eef2ff] truncate"
                        title={`${program.client} - ${program.projectName}`}
                      >
                        <div className="truncate font-medium">{program.projectName}</div>
                        <div className="truncate text-[10px] text-gray-500 mt-0.5">{program.client}</div>
                      </button>
                    ))}
                  </div>
                </>
              )}

            </nav>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 overflow-auto">
          {selectedSection === 'overview' && (userView === 'Admin' || userView === 'Business Owner') && (
            <div className="flex flex-col">
              <div className="p-4" style={{ backgroundColor: '#5865D8' }}>
                <div className="grid grid-cols-5 gap-4 text-center">
                  <div>
                    <div className="text-xs font-medium text-white mb-1">Toronto</div>
                    <div className="text-lg font-semibold text-white">{getTimeInTimezone('America/Toronto')}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-white mb-1">New York</div>
                    <div className="text-lg font-semibold text-white">{getTimeInTimezone('America/New_York')}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-white mb-1">Chicago</div>
                    <div className="text-lg font-semibold text-white">{getTimeInTimezone('America/Chicago')}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-white mb-1">Austin</div>
                    <div className="text-lg font-semibold text-white">{getTimeInTimezone('America/Chicago')}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-white mb-1">LA/Portland</div>
                    <div className="text-lg font-semibold text-white">{getTimeInTimezone('America/Los_Angeles')}</div>
                  </div>
                </div>
              </div>

              <div className="p-8">
                <h2 className="text-3xl font-bold text-gray-900 mb-2">
                  Welcome Back, {user.name.split(' ')[0]}!
                </h2>
                <p className="text-sm text-gray-600 mb-8">
                  Today is {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}.
                </p>

                {/* Top Row - Key Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                {/* % of Year Complete */}
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <h3 className="text-sm font-medium text-gray-600 mb-2">% of Year Complete</h3>
                  <div className="metric-value text-blue-600">{dashboardData.yearComplete}%</div>
                  <div className="mt-2 text-xs text-gray-500">
                    {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </div>
                </div>

                {/* % of Plan Confirmed */}
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <h3 className="text-sm font-medium text-gray-600 mb-2">% of Plan Confirmed</h3>
                  <div className="metric-value text-green-600">{dashboardData.planConfirmed}%</div>
                  <div className="mt-2 text-xs text-gray-500">
                    Based on total fees in pipeline
                  </div>
                </div>

                {/* Current Month - Total Fees to Close */}
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <h3 className="text-sm font-medium text-gray-600 mb-2">Current Month - Fees to Close</h3>
                  <div className="metric-value text-purple-600">
                    {formatCurrency(dashboardData.currentMonthFeesToClose)}
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    @100% value
                  </div>
                </div>
              </div>

              {/* Second Row - Lists */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* Projects to Close This Month */}
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Projects to Close This Month</h3>
                    <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded">
                      {dashboardData.projectsToClose.length}
                    </span>
                  </div>
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {dashboardData.projectsToClose.length > 0 ? (
                      dashboardData.projectsToClose.map((project, index) => (
                        <div key={index} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="font-medium text-gray-900">{project.programName}</div>
                              <div className="text-sm text-gray-600">{project.projectCode} - {project.client}</div>
                              <div className="text-xs text-gray-500 mt-1">
                                Closes: {formatDate(project.endMonth)}
                              </div>
                            </div>
                            <div className="text-sm font-semibold text-gray-900">
                              {formatCurrency(project.totalFees)}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <CheckCircle className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                        <p>No projects closing this month</p>
                  </div>
                )}
                  </div>
              </div>

                {/* Quotes Needing Approval */}
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Quotes Needing Approval</h3>
                    <span className="bg-orange-100 text-orange-800 text-xs font-medium px-2.5 py-0.5 rounded">
                      {dashboardData.pendingQuotes.length}
                    </span>
                  </div>
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {dashboardData.pendingQuotes.length > 0 ? (
                      dashboardData.pendingQuotes.map((quote, index) => (
                        <div key={index} className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="font-medium text-gray-900">{quote.projectName}</div>
                              <div className="text-sm text-gray-600">{quote.projectNumber} - {quote.clientName}</div>
                              <div className="text-xs text-gray-500 mt-1">
                                Submitted: {formatDate(quote.createdAt || new Date().toISOString())}
                              </div>
                            </div>
                            <div className="text-sm font-semibold text-gray-900">
                              {formatCurrency(quote.totalRevenue || 0)}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <CheckCircle className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                        <p>No quotes pending approval</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Third Row - 2-Week Calendar View of Deliverables */}
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Upcoming Deliverables (Next 2 Weeks)</h3>
                    <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded">
                      {dashboardData.upcomingDeliverables.length} deliverables
                    </span>
          </div>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {dashboardData.upcomingDeliverables.length > 0 ? (
                      dashboardData.upcomingDeliverables.map((deliverable, index) => (
                        <div key={index} className="flex items-center p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors">
                          <Calendar className="w-5 h-5 text-blue-600 mr-3 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900">{deliverable.milestone}</span>
                              <span className={`text-xs px-2 py-0.5 rounded ${
                                deliverable.status === 'completed' 
                                  ? 'bg-green-100 text-green-800' 
                                  : deliverable.status === 'in-progress'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {deliverable.status}
                              </span>
        </div>
                            <div className="text-sm text-gray-600 truncate">
                              {deliverable.projectName} ({deliverable.projectNumber})
                            </div>
                          </div>
                          <div className="text-sm font-medium text-gray-900 ml-4 flex-shrink-0">
                            {formatDate(deliverable.date)}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-12 text-gray-500">
                        <Calendar className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                        <p>No deliverables scheduled for the next 2 weeks</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {selectedSection === 'overview' && userView === 'Team Member' && (
            <div className="p-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-6">
                Welcome Back, {user.name.split(' ')[0]}!
              </h2>
              <p className="text-gray-600 mb-8">
                Select a section from the menu to get started.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div 
                  onClick={() => { setPipelineExpanded(true); setSelectedSection('pipeline'); }}
                  className="bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer border border-gray-200"
                >
                  <TrendingUp className="w-8 h-8 text-blue-600 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Business Pipeline</h3>
                  <p className="text-sm text-gray-600">
                    View pipeline analytics, department insights, and financial reporting
                  </p>
                </div>
                <div 
                  onClick={() => setSelectedSection('project-management')}
                  className="bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer border border-gray-200"
                >
                  <Briefcase className="w-8 h-8 text-green-600 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Project Management</h3>
                  <p className="text-sm text-gray-600">
                    Manage projects, resources, timelines, and deliverables
                  </p>
                </div>
                <div 
                  onClick={() => setSelectedSection('quoting')}
                  className="bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer border border-gray-200"
                >
                  <FileText className="w-8 h-8 text-purple-600 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Quoting</h3>
                  <p className="text-sm text-gray-600">
                    Create and manage project quotes and cost estimates
                  </p>
                </div>
              </div>
            </div>
          )}

          {selectedSection === 'pipeline' && (
            <div className="h-full w-full overflow-hidden">
                  <Pipeline
                    user={user}
                onLogout={() => {}}
                onBack={() => {}}
                    userView={userView}
                    isEmbedded={true}
                    initialView={pipelineSubView}
                  />
            </div>
          )}

          {selectedSection === 'my-team' && (
            <div className="p-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                My Team
              </h2>
              <p className="text-gray-600 mb-6">
                View and manage your team members, their roles, and project assignments.
              </p>
              
              {myTeamView === 'overview' && (
                <>
                  <div className="flex gap-4 mb-8">
                    <Button
                      className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3"
                      onClick={() => setMyTeamView('build')}
                    >
                      Build My Team
                    </Button>
                    <Button
                      variant="outline"
                      className="px-6 py-3"
                      onClick={() => setMyTeamView('manage')}
                    >
                      Manage My Team
                    </Button>
                  </div>
                  
                  <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <div className="text-center py-12">
                      <Users className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Team Management</h3>
                      <p className="text-gray-600">
                        Click "Build My Team" to create your organizational structure.
                      </p>
                    </div>
                  </div>
                </>
              )}

              {myTeamView === 'build' && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                  <div className="p-6 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">Build Your Team Structure</h3>
                        <p className="text-sm text-gray-600 mt-1">Create teams and add people to build your organizational hierarchy</p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedParentTeam(null);
                            setShowAddTeamModal(true);
                          }}
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Add Team
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setMyTeamView('overview')}
                        >
                          Back
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="p-6">
                    {teamStructure.length === 0 ? (
                      <div className="text-center py-12">
                        <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                        <p className="text-gray-600 mb-4">No teams created yet</p>
                        <Button
                          onClick={() => {
                            setSelectedParentTeam(null);
                            setShowAddTeamModal(true);
                          }}
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Create Your First Team
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {renderTeamTree()}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {myTeamView === 'manage' && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                  <div className="p-6 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">Manage My Team</h3>
                        <p className="text-sm text-gray-600 mt-1">View team member workload and project assignments</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setMyTeamView('build')}
                      >
                        Build Team
                      </Button>
                    </div>
                  </div>
                  <div className="p-6">
                    {(() => {
                      const teamsWithCoverage = getTeamsWithCoverage();
                      
                      if (teamsWithCoverage.length === 0) {
                        return (
                          <div className="text-center py-12">
                            <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                            <p className="text-gray-600 mb-2">No teams created yet</p>
                            <Button
                              onClick={() => setMyTeamView('build')}
                              className="bg-blue-600 hover:bg-blue-700 text-white"
                            >
                              Build Your Team
                            </Button>
                          </div>
                        );
                      }
                      
                      return (
                        <div className="space-y-6">
                          {teamsWithCoverage.map((team) => (
                            <div key={team.id} className="border border-gray-200 rounded-lg overflow-hidden">
                              {/* Team Header */}
                              <div className="bg-blue-50 p-4 flex items-center justify-between border-b border-blue-200">
                                <div className="flex items-center gap-3">
                                  <button
                                    onClick={() => {
                                      const updated = teamStructure.map(t => 
                                        t.id === team.id ? { ...t, isExpanded: !t.isExpanded } : t
                                      );
                                      saveTeamStructure(updated);
                                    }}
                                    className="p-1 hover:bg-blue-100 rounded transition-colors"
                                  >
                                    {team.isCollapsed ? (
                                      <ChevronRight className="w-5 h-5 text-gray-700" />
                                    ) : (
                                      <ChevronDown className="w-5 h-5 text-gray-700" />
                                    )}
                                  </button>
                                  <Users className="w-5 h-5 text-blue-600" />
                                  <h4 className="text-base font-semibold text-gray-900">{team.name}</h4>
                                  <span className="text-sm text-gray-600">
                                    ({team.members.length} {team.members.length === 1 ? 'member' : 'members'})
                                  </span>
                                </div>
                              </div>

                              {/* Team Members Table */}
                              {!team.isCollapsed && (
                                <>
                                  {team.members.length === 0 ? (
                                    <div className="p-8 text-center bg-white">
                                      <p className="text-sm text-gray-500">No members in this team yet</p>
                                      <Button
                                        onClick={() => setMyTeamView('build')}
                                        variant="outline"
                                        size="sm"
                                        className="mt-3"
                                      >
                                        Add Members
                                      </Button>
                                    </div>
                                  ) : (
                                    <div className="overflow-x-auto">
                                      <table className="w-full text-sm">
                                        <thead>
                                          <tr className="border-b border-gray-200">
                                            <th className="text-left py-3 px-4 font-semibold text-gray-600 bg-gray-50">Team Member</th>
                                            <th className="text-left py-3 px-4 font-semibold text-gray-600 bg-gray-50">Role</th>
                                            <th className="text-center py-3 px-4 font-semibold text-gray-600 bg-blue-50 border-l border-blue-200" colSpan={3}>
                                              Current Week
                                            </th>
                                            <th className="text-center py-3 px-4 font-semibold text-gray-600 bg-purple-50 border-l border-purple-200" colSpan={3}>
                                              Current Month
                                            </th>
                                            <th className="text-center py-3 px-4 font-semibold text-gray-600 bg-green-50 border-l border-green-200" colSpan={3}>
                                              Current Quarter
                                            </th>
                                          </tr>
                                          <tr className="border-b border-gray-200">
                                            <th className="py-2 px-4"></th>
                                            <th className="py-2 px-4"></th>
                                            <th className="text-center py-2 px-2 text-xs font-medium text-gray-600 bg-blue-50 border-l border-blue-200">Hours</th>
                                            <th className="text-center py-2 px-2 text-xs font-medium text-gray-600 bg-blue-50">Avg %</th>
                                            <th className="text-center py-2 px-2 text-xs font-medium text-gray-600 bg-blue-50">Projects</th>
                                            <th className="text-center py-2 px-2 text-xs font-medium text-gray-600 bg-purple-50 border-l border-purple-200">Hours</th>
                                            <th className="text-center py-2 px-2 text-xs font-medium text-gray-600 bg-purple-50">Avg %</th>
                                            <th className="text-center py-2 px-2 text-xs font-medium text-gray-600 bg-purple-50">Projects</th>
                                            <th className="text-center py-2 px-2 text-xs font-medium text-gray-600 bg-green-50 border-l border-green-200">Hours</th>
                                            <th className="text-center py-2 px-2 text-xs font-medium text-gray-600 bg-green-50">Avg %</th>
                                            <th className="text-center py-2 px-2 text-xs font-medium text-gray-600 bg-green-50">Projects</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {team.members.map((member, idx) => (
                                            <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                                              <td className="py-3 px-4">
                                                <div className="font-medium text-gray-900">{member.name}</div>
                                              </td>
                                              <td className="py-3 px-4">
                                                <div className="text-gray-600">{member.role}</div>
                                              </td>
                                              {/* Current Week */}
                                              <td className="py-3 px-2 text-center border-l border-blue-100 bg-blue-50/30">
                                                <span className="font-semibold text-gray-900">{member.week.hours}</span>
                                              </td>
                                              <td className="py-3 px-2 text-center bg-blue-50/30">
                                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                                  member.week.allocation > 100 ? 'bg-red-100 text-red-800' :
                                                  member.week.allocation > 80 ? 'bg-orange-100 text-orange-800' :
                                                  member.week.allocation > 0 ? 'bg-blue-100 text-blue-800' :
                                                  'bg-gray-100 text-gray-600'
                                                }`}>
                                                  {member.week.allocation}%
                                                </span>
                                              </td>
                                              <td className="py-3 px-2 text-center bg-blue-50/30">
                                                <span className="text-gray-700">{member.week.assignmentCount}</span>
                                              </td>
                                              {/* Current Month */}
                                              <td className="py-3 px-2 text-center border-l border-purple-100 bg-purple-50/30">
                                                <span className="font-semibold text-gray-900">{member.month.hours}</span>
                                              </td>
                                              <td className="py-3 px-2 text-center bg-purple-50/30">
                                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                                  member.month.allocation > 100 ? 'bg-red-100 text-red-800' :
                                                  member.month.allocation > 80 ? 'bg-orange-100 text-orange-800' :
                                                  member.month.allocation > 0 ? 'bg-purple-100 text-purple-800' :
                                                  'bg-gray-100 text-gray-600'
                                                }`}>
                                                  {member.month.allocation}%
                                                </span>
                                              </td>
                                              <td className="py-3 px-2 text-center bg-purple-50/30">
                                                <span className="text-gray-700">{member.month.assignmentCount}</span>
                                              </td>
                                              {/* Current Quarter */}
                                              <td className="py-3 px-2 text-center border-l border-green-100 bg-green-50/30">
                                                <span className="font-semibold text-gray-900">{member.quarter.hours}</span>
                                              </td>
                                              <td className="py-3 px-2 text-center bg-green-50/30">
                                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                                  member.quarter.allocation > 100 ? 'bg-red-100 text-red-800' :
                                                  member.quarter.allocation > 80 ? 'bg-orange-100 text-orange-800' :
                                                  member.quarter.allocation > 0 ? 'bg-green-100 text-green-800' :
                                                  'bg-gray-100 text-gray-600'
                                                }`}>
                                                  {member.quarter.allocation}%
                                                </span>
                                              </td>
                                              <td className="py-3 px-2 text-center bg-green-50/30">
                                                <span className="text-gray-700">{member.quarter.assignmentCount}</span>
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
          )}

          {selectedSection === 'project-management' && (
            <div className="h-full overflow-hidden">
              {selectedProjectId === null ? (
              <PMDashboard
                user={user}
                  onLogout={() => {}}
                  onBackToHub={() => {}}
                  onOpenProject={handleOpenProject}
                onCreateNew={() => console.log('Create new')}
                  onOpenPerson={handleOpenPerson}
                  onOpenProjectWithData={handleOpenProjectWithData}
                userView={userView}
                  onUserViewChange={handleUserViewChange}
                isEmbedded={true}
              />
              ) : (
                <div className="h-full flex flex-col">
                  {/* Header for selected project */}
                  <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <h2 className="text-xl font-semibold text-gray-900">
                        {selectedProjectMeta && (selectedProjectMeta.client || selectedProjectMeta.projectName)
                          ? `${selectedProjectMeta.client || ''}${selectedProjectMeta.client && selectedProjectMeta.projectName ? ' - ' : ''}${selectedProjectMeta.projectName || ''} Workspace`
                          : 'Project Workspace'}
                      </h2>
            </div>
                  </div>
                  
                  {/* Project sub-views */}
                  <div className="flex-1 overflow-auto bg-white">
                    {projectSubView === 'details' && (
                      <div className="p-6 w-full">
                        <div className="w-full bg-white p-6 border border-gray-200 rounded-lg shadow-sm">
                          <h3 className="text-lg font-semibold text-gray-900 mb-6">Project Details</h3>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                              <div className="text-xs text-gray-500 mb-1">Project Code</div>
                              <div className="text-sm font-medium text-gray-900">{selectedProjectDetails?.projectCode || 'N/A'}</div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-500 mb-1">Status</div>
                              <div className="text-sm">
                                <span className={`px-3 py-1 rounded-md text-xs font-medium ${
                                  selectedProjectDetails?.status === 'Confirmed' ? 'bg-green-100 text-green-800' :
                                  selectedProjectDetails?.status === 'Open' ? 'bg-blue-100 text-blue-800' :
                                  selectedProjectDetails?.status === 'High Pitch' ? 'bg-yellow-100 text-yellow-800' :
                                  selectedProjectDetails?.status === 'Medium Pitch' ? 'bg-orange-100 text-orange-800' :
                                  selectedProjectDetails?.status === 'Low Pitch' ? 'bg-red-100 text-red-800' :
                                  selectedProjectDetails?.status === 'Whitespace' ? 'bg-gray-100 text-gray-800' :
                                  'bg-gray-100 text-gray-600'
                                }`}>
                                  {selectedProjectDetails?.status || 'N/A'}
                                </span>
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-500 mb-1">Owner</div>
                              <div className="text-sm font-medium text-gray-900">{selectedProjectDetails?.owner || 'N/A'}</div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-500 mb-1">Client Name</div>
                              <div className="text-sm font-medium text-gray-900">{selectedProjectDetails?.client || 'N/A'}</div>
                            </div>
                            <div className="md:col-span-2">
                              <div className="text-xs text-gray-500 mb-1">Project Name</div>
                              <div className="text-sm font-medium text-gray-900">{selectedProjectDetails?.programName || 'N/A'}</div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-500 mb-1">Region</div>
                              <div className="text-sm font-medium text-gray-900">{selectedProjectDetails?.region || 'N/A'}</div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-500 mb-1">Program Type</div>
                              <div className="text-sm font-medium text-gray-900">{selectedProjectDetails?.programType || 'N/A'}</div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-500 mb-1">Start Date</div>
                              <div className="text-sm font-medium text-gray-900">
                                {selectedProjectDetails?.startMonth ? new Date(selectedProjectDetails.startMonth).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-500 mb-1">End Date</div>
                              <div className="text-sm font-medium text-gray-900">
                                {selectedProjectDetails?.endMonth ? new Date(selectedProjectDetails.endMonth).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-500 mb-1">Total Revenue</div>
                              <div className="text-sm font-semibold text-gray-900">
                                {selectedProjectDetails?.revenue ? `$${selectedProjectDetails.revenue.toLocaleString()}` : 'N/A'}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-500 mb-1">Total Fees</div>
                              <div className="text-sm font-semibold text-gray-900">
                                {selectedProjectDetails?.totalFees ? `$${selectedProjectDetails.totalFees.toLocaleString()}` : 'N/A'}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Calendar Tile */}
                        <div className="w-full bg-white p-6 border border-gray-200 rounded-lg shadow-sm mt-6">
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="text-base font-semibold text-gray-900">Key Milestones Calendar</h3>
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={prevMonth}
                                className="h-8 w-8 flex items-center justify-center text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                              >
                                &lt;
                              </button>
                              <div className="text-sm font-medium text-gray-900 min-w-[140px] text-center">
                                {calendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                              </div>
                              <button 
                                onClick={nextMonth}
                                className="h-8 w-8 flex items-center justify-center text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                              >
                                &gt;
                              </button>
                            </div>
                          </div>
                          <div className="grid grid-cols-7 text-xs font-medium text-gray-600 mb-2">
                            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d) => (
                              <div key={d} className="py-2 text-center">{d}</div>
                            ))}
                          </div>
                          <div className="grid grid-cols-7 gap-1">
                            {Array.from({ length: startWeekday }).map((_, i) => (
                              <div key={`empty-${i}`} className="h-20 bg-gray-50 rounded-md border border-dashed border-gray-200" />
                            ))}
                            {Array.from({ length: daysInMonth }).map((_, i) => {
                              const day = i + 1;
                              const cellDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), day);
                              const milestonesForDay = projectMilestones.filter(m => {
                                const d = new Date(m.date);
                                return d.getFullYear() === cellDate.getFullYear() &&
                                       d.getMonth() === cellDate.getMonth() &&
                                       d.getDate() === cellDate.getDate();
                              });
                              return (
                                <div
                                  key={`day-${day}`}
                                  className="group h-24 bg-white rounded-md border border-gray-200 p-2 hover:bg-blue-50 cursor-pointer transition-colors relative"
                                  onClick={() => addMilestone(day)}
                                  title="Click to add milestone"
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="text-xs font-semibold text-gray-700">{day}</div>
                                    {milestonesForDay.length > 0 && (
                                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-[10px]">
                                        {milestonesForDay.length}
                                      </span>
                                    )}
                                  </div>
                                  {/* "+ Add" text on hover */}
                                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                    <span className="text-sm font-medium text-blue-600">+ Add</span>
                                  </div>
                                  <div className="mt-1 space-y-1">
                                    {milestonesForDay.slice(0, 2).map((m, idx) => (
                                      <div key={idx} className="truncate text-[11px] px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                                        {m.name}
                                      </div>
                                    ))}
                                    {milestonesForDay.length > 2 && (
                                      <div className="text-[11px] text-gray-500">+{milestonesForDay.length - 2} more</div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <p className="text-[11px] text-gray-500 mt-2">Tip: Click a day to add a milestone.</p>
                        </div>

                        {/* Key Milestones Tile */}
                        <div className="w-full bg-white p-6 border border-gray-200 rounded-lg shadow-sm mt-6">
                          <h3 className="text-base font-semibold text-gray-900 mb-4">Key Milestones</h3>
                          {projectMilestones.length === 0 ? (
                            <div className="text-sm text-gray-500">No milestones yet. Add milestones from the calendar above.</div>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="text-left text-gray-600 border-b">
                                    <th className="py-2 pr-4">Date</th>
                                    <th className="py-2">Milestone</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {projectMilestones
                                    .slice()
                                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                                    .map((m, idx) => (
                                      <tr key={idx} className="border-b last:border-0">
                                        <td className="py-2 pr-4 whitespace-nowrap text-gray-900">
                                          {new Date(m.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </td>
                                        <td className="py-2 text-gray-900">{m.name}</td>
                                      </tr>
                                    ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    {projectSubView === 'quoting' && editingQuoteId === null && (
                      <div className="p-6 w-full">
                        <div className="w-full bg-white p-6 border border-gray-200 rounded-lg shadow-sm">
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="text-base font-semibold text-gray-900">Quotes</h3>
                            <Button
                              className="h-8 px-3 text-xs"
                              onClick={() => {
                                // Create a new quote ID
                                const newQuoteId = 'quote-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
                                
                                // Create initial quote data
                                const newQuote = {
                                  id: newQuoteId,
                                  projectNumber: selectedProjectDetails?.projectCode || '',
                                  clientName: selectedProjectDetails?.client || '',
                                  brand: selectedProjectDetails?.client || '',
                                  projectName: selectedProjectDetails?.programName || 'Untitled Quote',
                                  inMarketDate: selectedProjectDetails?.startMonth || '',
                                  projectCompletionDate: selectedProjectDetails?.endMonth || '',
                                  currency: 'CAD',
                                  totalRevenue: 0,
                                  departmentBreakdown: {},
                                  budgetLabel: 'Net New',
                                  status: 'draft' as const,
                                  createdDate: new Date().toISOString(),
                                  lastModified: new Date().toISOString(),
                                  createdBy: user?.email || 'unknown',
                                  project: {
                                    projectNumber: selectedProjectDetails?.projectCode || '',
                                    clientName: selectedProjectDetails?.client || '',
                                    clientCategory: '',
                                    brand: selectedProjectDetails?.client || '',
                                    projectName: selectedProjectDetails?.programName || 'Untitled Quote',
                                    startDate: selectedProjectDetails?.startMonth || '',
                                    endDate: selectedProjectDetails?.endMonth || '',
                                    totalProgramBudget: 0,
                                    rateCard: 'Standard',
                                    currency: 'CAD',
                                    phases: [],
                                    phaseSettings: {},
                                    budgetLabel: 'Net New'
                                  },
                                  phaseData: {},
                                  productionCostData: {},
                                  quoteReviewData: {
                                    projectScope: '',
                                    descriptions: {},
                                    invoiceItems: []
                                  }
                                };
                                
                                // Save to cloudStorage
                                try {
                                  const quotes = JSON.parse(cloudStorage.getItem('saltxc-all-quotes') || '[]');
                                  quotes.push(newQuote);
                                  cloudStorage.setItem('saltxc-all-quotes', JSON.stringify(quotes));
                                  
                                  // Update local state
                                  setSelectedProjectQuotes([...selectedProjectQuotes, newQuote]);
                                  
                                  // Set the quote project immediately so ProjectSetup can render
                                  setQuoteProject(newQuote.project);
                                  setPhaseData({});
                                  setProductionData({});
                                  setQuoteReviewData({ projectScope: '', descriptions: {}, invoiceItems: [] });
                                  
                                  // Open the quote editor
                                  setEditingQuoteId(newQuoteId);
                                  setQuoteEditorTab('setup');
                                  
                                  console.log('✅ Created new quote and set quoteProject:', {
                                    quoteId: newQuoteId,
                                    project: newQuote.project
                                  });
                                  
                                  // Trigger update event
                                  window.dispatchEvent(new Event('saltxc-quotes-updated'));
                                } catch (error) {
                                  console.error('Failed to create quote:', error);
                                  alert('Failed to create quote');
                                }
                              }}
                            >
                              + Add Quote
                            </Button>
                          </div>
                          {selectedProjectQuotes.length === 0 ? (
                            <div className="text-sm text-gray-500">No quotes yet for this project.</div>
                          ) : (
                            <div className="overflow-x-auto w-full">
                              <table className="w-full text-sm min-w-max">
                                <thead>
                                  <tr className="text-left text-gray-600 border-b">
                                    <th className="py-2 pr-4 whitespace-nowrap">Project Code</th>
                                    <th className="py-2 pr-4 whitespace-nowrap">Client</th>
                                    <th className="py-2 pr-4 whitespace-nowrap">Project Name</th>
                                    <th className="py-2 pr-4 whitespace-nowrap">Status</th>
                                    <th className="py-2 pr-4 whitespace-nowrap">Start Date</th>
                                    <th className="py-2 pr-4 whitespace-nowrap">End Date</th>
                                    <th className="py-2 pr-4 whitespace-nowrap">Quote Type</th>
                                    <th className="py-2 pr-4 text-right whitespace-nowrap">Total Quote</th>
                                    <th className="py-2 pr-4 text-right whitespace-nowrap">Total Fees</th>
                                    <th className="py-2 whitespace-nowrap">Last Modified</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {selectedProjectQuotes.map((q: any) => (
                                    <tr
                                      key={q.id}
                                      className="border-b last:border-0 hover:bg-blue-50 cursor-pointer"
                                      onClick={() => {
                                        setEditingQuoteId(q.id);
                                        setQuoteEditorTab('setup');
                                      }}
                                      title="Click to edit quote"
                                    >
                                      <td className="py-2 pr-4 text-gray-900 font-mono text-xs whitespace-nowrap">{q.projectNumber || selectedProjectDetails?.projectCode || '—'}</td>
                                      <td className="py-2 pr-4 text-gray-900 font-medium whitespace-nowrap">{q.clientName || selectedProjectDetails?.client || '—'}</td>
                                      <td className="py-2 pr-4 text-gray-900 whitespace-nowrap">{q.projectName || 'Untitled Quote'}</td>
                                      <td className="py-2 pr-4 whitespace-nowrap">
                                        <span className={`px-3 py-1 rounded-md text-xs font-medium ${
                                          selectedProjectDetails?.status === 'Confirmed' ? 'bg-green-100 text-green-800' :
                                          selectedProjectDetails?.status === 'Open' ? 'bg-blue-100 text-blue-800' :
                                          selectedProjectDetails?.status === 'High Pitch' ? 'bg-yellow-100 text-yellow-800' :
                                          selectedProjectDetails?.status === 'Medium Pitch' ? 'bg-orange-100 text-orange-800' :
                                          selectedProjectDetails?.status === 'Low Pitch' ? 'bg-red-100 text-red-800' :
                                          selectedProjectDetails?.status === 'Whitespace' ? 'bg-gray-100 text-gray-800' :
                                          'bg-gray-100 text-gray-600'
                                        }`}>
                                          {selectedProjectDetails?.status || 'N/A'}
                                        </span>
                                      </td>
                                      <td className="py-2 pr-4 text-gray-900 whitespace-nowrap">
                                        {q.inMarketDate 
                                          ? new Date(q.inMarketDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                          : selectedProjectDetails?.startMonth 
                                            ? new Date(selectedProjectDetails.startMonth).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                            : '—'}
                                      </td>
                                      <td className="py-2 pr-4 text-gray-900 whitespace-nowrap">
                                        {q.projectCompletionDate 
                                          ? new Date(q.projectCompletionDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                          : selectedProjectDetails?.endMonth 
                                            ? new Date(selectedProjectDetails.endMonth).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                            : '—'}
                                      </td>
                                      <td className="py-2 pr-4 text-gray-900 whitespace-nowrap">
                                        <span className="px-2 py-1 bg-purple-50 text-purple-700 rounded text-xs font-medium">
                                          {q.budgetLabel || q.project?.budgetLabel || 'Net New'}
                                        </span>
                                      </td>
                                      <td className="py-2 pr-4 text-gray-900 text-right font-semibold whitespace-nowrap">
                                        {typeof q.totalRevenue === 'number'
                                          ? formatCurrency(q.totalRevenue, q.currency || 'USD')
                                          : '—'}
                                      </td>
                                      <td className="py-2 pr-4 text-gray-900 text-right font-semibold whitespace-nowrap">
                                        {typeof (q as any).totalFees === 'number'
                                          ? formatCurrency((q as any).totalFees, q.currency || 'USD')
                                          : typeof q.totalRevenue === 'number'
                                            ? formatCurrency(q.totalRevenue, q.currency || 'USD')
                                            : '—'}
                                      </td>
                                      <td className="py-2 text-gray-900 whitespace-nowrap">
                                        {q.lastModified
                                          ? new Date(q.lastModified).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                          : '—'}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    {projectSubView === 'quoting' && editingQuoteId !== null && (
                      <div className="p-6">
                        <div className="flex gap-4 relative">
                          {/* Main quote builder content */}
                          <div className="w-full bg-white p-6">
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-3">
                                <h3 className="text-base font-semibold text-gray-900">Quote Builder</h3>
                              {saveStatus === 'saving' && (
                                <span className="text-xs text-blue-600 flex items-center gap-1">
                                  <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  Saving...
                                </span>
                              )}
                              {saveStatus === 'saved' && (
                                <span className="text-xs text-green-600 flex items-center gap-1">
                                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                  Saved!
                                </span>
                              )}
                            </div>
                            <Button
                              variant="outline"
                              className="h-8 px-3 text-xs"
                              onClick={() => setEditingQuoteId(null)}
                            >
                              ← Back to Quotes
                            </Button>
                          </div>
                          <Tabs value={quoteEditorTab} onValueChange={(v) => setQuoteEditorTab(v as any)}>
                            <TabsList className="grid grid-cols-4 w-full mb-4 bg-transparent rounded-lg p-0 gap-2">
                              <TabsTrigger 
                                value="setup"
                                className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-800 data-[state=inactive]:text-gray-600 data-[state=inactive]:bg-transparent hover:bg-gray-50 transition-colors rounded-lg flex items-center justify-center gap-2 py-2 border-0"
                              >
                                <Wrench className="w-4 h-4" />
                                Project Setup
                              </TabsTrigger>
                              <TabsTrigger 
                                value="fees"
                                className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-800 data-[state=inactive]:text-gray-600 data-[state=inactive]:bg-transparent hover:bg-gray-50 transition-colors rounded-lg flex items-center justify-center gap-2 py-2 border-0"
                              >
                                <User className="w-4 h-4" />
                                Project Fees
                              </TabsTrigger>
                              <TabsTrigger 
                                value="production"
                                className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-800 data-[state=inactive]:text-gray-600 data-[state=inactive]:bg-transparent hover:bg-gray-50 transition-colors rounded-lg flex items-center justify-center gap-2 py-2 border-0"
                              >
                                <Package className="w-4 h-4" />
                                Production Costs
                              </TabsTrigger>
                              <TabsTrigger 
                                value="review"
                                className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-800 data-[state=inactive]:text-gray-600 data-[state=inactive]:bg-transparent hover:bg-gray-50 transition-colors rounded-lg flex items-center justify-center gap-2 py-2 border-0"
                              >
                                <FileText className="w-4 h-4" />
                                Quote Review
                              </TabsTrigger>
                            </TabsList>
                            
                            {/* Separator line */}
                            <div className="border-t border-gray-200 mb-1"></div>
                            
                            <TabsContent value="setup">
                              {quoteProject && (
                                <ProjectSetup
                                  initialProject={quoteProject}
                                  onSave={(proj) => {
                                    console.log('📝 ProjectSetup onSave called with:', {
                                      phases: proj.phases,
                                      phaseSettings: proj.phaseSettings,
                                      phasesCount: proj.phases?.length || 0
                                    });
                                    setQuoteProject(proj);
                                    persistQuoteState({ project: proj });
                                    setQuoteEditorTab('fees');
                                  }}
                                  onSaveOnly={(proj) => {
                                    console.log('📝 ProjectSetup onSaveOnly called with:', {
                                      phases: proj.phases,
                                      phaseSettings: proj.phaseSettings,
                                      phasesCount: proj.phases?.length || 0
                                    });
                                    setQuoteProject(proj);
                                    persistQuoteState({ project: proj });
                                  }}
                                />
                              )}
                            </TabsContent>
                            <TabsContent value="fees">
                              {quoteProject ? (
                                <>
                                  {console.log('🎯 Rendering PlanningPhase with project:', {
                                    phases: quoteProject.phases,
                                    phasesCount: quoteProject.phases?.length || 0,
                                    phaseSettings: quoteProject.phaseSettings
                                  })}
                                  <PlanningPhase
                                    project={quoteProject}
                                    phaseData={phaseData}
                                    setPhaseData={(pd: any) => {
                                      setPhaseData(pd);
                                      persistQuoteState({ phaseData: pd });
                                    }}
                                    onBack={() => setQuoteEditorTab('setup')}
                                    onSave={() => {
                                      persistQuoteState({ phaseData });
                                    }}
                                    onNext={() => setQuoteEditorTab('production')}
                                  />
                                </>
                              ) : (
                                <div className="p-6 text-center text-gray-500">
                                  Loading project data...
            </div>
                              )}
                            </TabsContent>
                            <TabsContent value="production">
                              {quoteProject && (
                                <ProductionCosts
                                  project={quoteProject}
                                  productionData={productionData}
                                  setProductionData={(pd: any) => {
                                    setProductionData(pd);
                                    persistQuoteState({ productionData: pd });
                                  }}
                                  onBack={() => setQuoteEditorTab('fees')}
                                  onSave={() => {
                                    persistQuoteState({ productionData });
                                    setQuoteEditorTab('review');
                                  }}
                                  onNext={() => setQuoteEditorTab('review')}
                                />
                              )}
                            </TabsContent>
                            <TabsContent value="review">
                              {quoteProject && (
                                <QuoteReview
                                  project={quoteProject}
                                  phaseData={phaseData}
                                  productionData={productionData}
                                  quoteReviewData={quoteReviewData}
                                  onBack={() => setQuoteEditorTab('production')}
                                  onEdit={() => setQuoteEditorTab('setup')}
                                  onSave={(data: any) => {
                                    setQuoteReviewData(data);
                                    persistQuoteState({ quoteReviewData: data });
                                  }}
                                />
                              )}
                            </TabsContent>
                          </Tabs>
                          {/* Bottom action bar */}
                          <div className="mt-4 pt-3 border-t flex justify-end gap-2">
                            <Button
                              variant="outline"
                              className="h-9 px-4 text-sm"
                              onClick={() => {
                                if (quoteEditorTab === 'setup' && quoteProject) {
                                  persistQuoteState({ project: quoteProject });
                                } else if (quoteEditorTab === 'fees') {
                                  persistQuoteState({ phaseData });
                                } else if (quoteEditorTab === 'production') {
                                  persistQuoteState({ productionData });
                                } else if (quoteEditorTab === 'review') {
                                  persistQuoteState({ quoteReviewData });
                                }
                              }}
                            >
                              Save
                            </Button>
                            {quoteEditorTab === 'review' && (
                              <>
                                <Button
                                  variant="outline"
                                  className="h-9 px-4 text-sm"
                                  onClick={() => setQuoteEditorTab('review')}
                                >
                                  Review Quote
                                </Button>
                                <Button
                                  className="h-9 px-4 text-sm bg-blue-600 text-white hover:bg-blue-700"
                                  onClick={() => {
                                    try {
                                      // Create or update a review request for this quote
                                      const requests = JSON.parse(cloudStorage.getItem('quote-review-requests') || '[]');
                                      const exists = requests.find((r: any) => r.quoteId === editingQuoteId && (r.status === 'pending' || r.status === 'pending-admin'));
                                      if (!exists) {
                                        requests.push({
                                          quoteId: editingQuoteId,
                                          reviewerName: 'Admin',
                                          requestedBy: (user && user.name) || 'Unknown',
                                          requestedDate: new Date().toISOString(),
                                          status: 'pending-admin',
                                          approvalLevel: 'admin'
                                        });
                                        cloudStorage.setItem('quote-review-requests', JSON.stringify(requests));
                                      }
                                    } catch {}
                                    // Mark quote as pending in its record
                                    try {
                                      const quotesRaw = cloudStorage.getItem('saltxc-quotes');
                                      const quotes = quotesRaw ? JSON.parse(quotesRaw) : [];
                                      const idx = quotes.findIndex((q: any) => q.id === editingQuoteId);
                                      if (idx >= 0) {
                                        quotes[idx].status = 'pending-admin-approval';
                                        quotes[idx].lastModified = new Date().toISOString();
                                        cloudStorage.setItem('saltxc-quotes', JSON.stringify(quotes));
                                      }
                                    } catch {}
                                    alert('Quote submitted for approval.');
                                  }}
                                >
                                  Submit for Approval
                                </Button>
                              </>
          )}
        </div>
      </div>
                          
                          {/* Milestones Drawer - Collapsible Tab for Quote Builder */}
                          <div className="relative">
                            {/* Collapsed Tab */}
                            {!milestonesDrawerOpen && (
                              <button
                                onClick={() => setMilestonesDrawerOpen(true)}
                                className="fixed right-0 top-1/2 -translate-y-1/2 bg-blue-600 text-white px-3 py-6 rounded-l-lg shadow-lg hover:bg-blue-700 transition-colors flex items-center gap-2 z-30"
                                style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
                              >
                                <Calendar className="w-4 h-4" style={{ transform: 'rotate(-90deg)' }} />
                                <span className="text-sm font-medium">Key Dates</span>
                              </button>
                            )}
                            
                            {/* Expanded Drawer */}
                            {milestonesDrawerOpen && (
                              <div className="fixed right-0 top-0 h-screen w-80 bg-white border-l border-gray-200 shadow-xl overflow-y-auto z-40">
                                <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
                                  <div>
                                    <h3 className="text-base font-semibold text-gray-900">Key Dates</h3>
                                    <p className="text-xs text-gray-600 mt-0.5">Project timeline reference</p>
    </div>
                                  <button
                                    onClick={() => setMilestonesDrawerOpen(false)}
                                    className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                                  >
                                    <ChevronRight className="w-5 h-5 text-gray-600" />
                                  </button>
                                </div>
                                
                                <div className="p-5">
                                  {projectMilestones && projectMilestones.length > 0 ? (
                                    <div className="space-y-3">
                                      {projectMilestones.map((milestone: any, idx: number) => (
                                        <div key={idx} className="flex items-start gap-3 pb-3 border-b border-gray-100 last:border-b-0">
                                          <Calendar className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                                          <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-900 truncate">{milestone.name}</p>
                                            <p className="text-xs text-gray-600 mt-0.5">
                                              {milestone.date ? new Date(milestone.date).toLocaleDateString('en-US', { 
                                                month: 'short', 
                                                day: 'numeric', 
                                                year: 'numeric' 
                                              }) : 'Date TBD'}
                                            </p>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="text-center py-8">
                                      <Calendar className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                                      <p className="text-sm text-gray-500">No milestones added yet</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                    {projectSubView === 'resourcing' && (
                      <div className="p-6 w-full">
                        <div className="flex gap-4 relative">
                          {/* Main content area */}
                          <div className="w-full bg-white p-6 border border-gray-200 rounded-lg shadow-sm">
                            <div className="flex items-center justify-between mb-6">
                              <div>
                                <h3 className="text-lg font-semibold text-gray-900">Resource Assignment</h3>
                                <p className="text-sm text-gray-600 mt-1">Assign team members to project roles from the quote</p>
                              </div>
                              <Button
                                onClick={saveResourceAssignments}
                                className="bg-blue-600 hover:bg-blue-700 text-white"
                              >
                                Save Assignments
                              </Button>
                            </div>

                          {Object.keys(resourceAssignments).length === 0 ? (
                            <div className="text-center py-12">
                              <p className="text-gray-500">No quote data available. Please create a quote first.</p>
                            </div>
                          ) : (
                            <div className="space-y-8">
                              {Object.keys(resourceAssignments).map((phase) => {
                                const depts = resourceAssignments[phase];
                                const hasRoles = Object.keys(depts).some(dept => depts[dept].length > 0);
                                
                                if (!hasRoles) return null;
                                
                                const phaseColor = phase.toLowerCase().includes('planning') 
                                  ? 'bg-blue-50 border-blue-200' 
                                  : phase.toLowerCase().includes('production') 
                                    ? 'bg-purple-50 border-purple-200' 
                                    : 'bg-green-50 border-green-200';
                                
                                return (
                                  <div key={phase} className={`border rounded-lg p-5 ${phaseColor}`}>
                                    <h4 className="text-base font-semibold text-gray-900 mb-4">{phase}</h4>
                                    
                                    {Object.keys(depts).map((dept) => {
                                      const roles = depts[dept];
                                      if (roles.length === 0) return null;
                                      
                                      return (
                                        <div key={dept} className="mb-6 last:mb-0">
                                          <h5 className="text-sm font-medium text-gray-700 mb-3 px-2">{dept}</h5>
                                          
                                          <div className="bg-white rounded-md border border-gray-200 overflow-hidden">
                                            <table className="w-full text-sm table-fixed">
                                              <colgroup>
                                                <col style={{ width: '20%' }} />
                                                <col style={{ width: '10%' }} />
                                                <col style={{ width: '8%' }} />
                                                <col style={{ width: '8%' }} />
                                                <col style={{ width: '13%' }} />
                                                <col style={{ width: '13%' }} />
                                                <col style={{ width: '28%' }} />
                                              </colgroup>
                                              <thead className="bg-gray-50 border-b border-gray-200">
                                                <tr>
                                                  <th className="text-left py-2 px-3 font-medium text-gray-700">Role</th>
                                                  <th className="text-center py-2 px-3 font-medium text-gray-700">Allocation</th>
                                                  <th className="text-center py-2 px-3 font-medium text-gray-700">Weeks</th>
                                                  <th className="text-center py-2 px-3 font-medium text-gray-700">Hours</th>
                                                  <th className="text-center py-2 px-3 font-medium text-gray-700">Start Date</th>
                                                  <th className="text-center py-2 px-3 font-medium text-gray-700">End Date</th>
                                                  <th className="text-left py-2 px-3 font-medium text-gray-700">Assigned To</th>
                                                </tr>
                                              </thead>
                                              <tbody>
                                                {roles.map((role, roleIndex) => {
                                                  const inputId = `${phase}-${dept}-${roleIndex}`;
                                                  const isInputFocused = focusedInput === inputId;
                                                  const filtered = getFilteredStaff(role.assignee);
                                                  
                                                  return (
                                                    <tr key={roleIndex} className="border-b last:border-b-0 hover:bg-gray-50">
                                                      <td className="py-2 px-3 text-gray-900">{role.roleName}</td>
                                                      <td className="py-2 px-3 text-center text-gray-700">{role.allocation}%</td>
                                                      <td className="py-2 px-3 text-center text-gray-700">{role.weeks}</td>
                                                      <td className="py-2 px-3 text-center text-gray-700">{role.hours.toFixed(0)}</td>
                                                      <td className="py-2 px-3">
                                                        <input
                                                          type="date"
                                                          value={role.startDate}
                                                          onChange={(e) => updateResourceDate(phase, dept, roleIndex, 'startDate', e.target.value)}
                                                          className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                        />
                                                      </td>
                                                      <td className="py-2 px-3">
                                                        <input
                                                          type="date"
                                                          value={role.endDate}
                                                          onChange={(e) => updateResourceDate(phase, dept, roleIndex, 'endDate', e.target.value)}
                                                          className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                        />
                                                      </td>
                                                      <td className="py-2 px-3 relative">
                                                        <input
                                                          type="text"
                                                          value={role.assignee}
                                                          onChange={(e) => updateResourceAssignment(phase, dept, roleIndex, e.target.value)}
                                                          onFocus={() => setFocusedInput(inputId)}
                                                          onBlur={() => setTimeout(() => setFocusedInput(null), 200)}
                                                          placeholder="Search employee..."
                                                          className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                        />
                                                        
                                                        {isInputFocused && filtered.length > 0 && (
                                                          <div className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                                                            {filtered.map((staff, idx) => (
                                                              <button
                                                                key={idx}
                                                                onClick={() => {
                                                                  updateResourceAssignment(phase, dept, roleIndex, staff.name);
                                                                  setFocusedInput(null);
                                                                }}
                                                                className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm border-b last:border-b-0"
                                                              >
                                                                <div className="font-medium text-gray-900">{staff.name}</div>
                                                                <div className="text-xs text-gray-600">{staff.title}</div>
                                                              </button>
                                                            ))}
                                                          </div>
                                                        )}
                                                      </td>
                                                    </tr>
                                                  );
                                                })}
                                              </tbody>
                                            </table>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        
                        {/* Milestones Drawer - Collapsible Tab */}
                        <div className="relative">
                          {/* Collapsed Tab */}
                          {!milestonesDrawerOpen && (
                            <button
                              onClick={() => setMilestonesDrawerOpen(true)}
                              className="fixed right-0 top-1/2 -translate-y-1/2 bg-blue-600 text-white px-3 py-6 rounded-l-lg shadow-lg hover:bg-blue-700 transition-colors flex items-center gap-2 z-30"
                              style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
                            >
                              <Calendar className="w-4 h-4" style={{ transform: 'rotate(-90deg)' }} />
                              <span className="text-sm font-medium">Key Dates</span>
                            </button>
                          )}
                          
                          {/* Expanded Drawer */}
                          {milestonesDrawerOpen && (
                            <div className="fixed right-0 top-0 h-screen w-80 bg-white border-l border-gray-200 shadow-xl overflow-y-auto z-40">
                              <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
                                <div>
                                  <h3 className="text-base font-semibold text-gray-900">Key Dates</h3>
                                  <p className="text-xs text-gray-600 mt-0.5">Project timeline reference</p>
                                </div>
                                <button
                                  onClick={() => setMilestonesDrawerOpen(false)}
                                  className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                                >
                                  <ChevronRight className="w-5 h-5 text-gray-600" />
                                </button>
                              </div>
                              
                              <div className="p-5">
                                {projectMilestones && projectMilestones.length > 0 ? (
                                  <div className="space-y-3">
                                    {projectMilestones.map((milestone: any, idx: number) => (
                                      <div key={idx} className="flex items-start gap-3 pb-3 border-b border-gray-100 last:border-b-0">
                                        <Calendar className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                          <p className="text-sm font-medium text-gray-900 truncate">{milestone.name}</p>
                                          <p className="text-xs text-gray-600 mt-0.5">
                                            {milestone.date ? new Date(milestone.date).toLocaleDateString('en-US', { 
                                              month: 'short', 
                                              day: 'numeric', 
                                              year: 'numeric' 
                                            }) : 'Date TBD'}
                                          </p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="text-center py-8">
                                    <Calendar className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                                    <p className="text-sm text-gray-500">No milestones added yet</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                        </div>
                      </div>
                    )}
                    {projectSubView === 'tasks' && (
                      <div className="p-6 w-full">
                        <div className="w-full bg-white border border-gray-200 rounded-lg shadow-sm">
                          <div className="p-6 border-b border-gray-200">
                            <div className="mb-4">
                              <h3 className="text-lg font-semibold text-gray-900">Task Assignment</h3>
                              <p className="text-sm text-gray-600 mt-1">Create sections and manage project tasks within them</p>
                            </div>
                            
                            <div className="flex items-center gap-3">
                              <Button
                                onClick={addSection}
                                className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
                              >
                                <Plus className="w-4 h-4" />
                                New Section
                              </Button>
                              
                              {/* Search */}
                              <div className="flex items-center gap-2">
                                {taskSearchExpanded ? (
                                  <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-md">
                                    <Search className="w-4 h-4 text-gray-400" />
                                    <input
                                      type="text"
                                      value={taskSearchTerm}
                                      onChange={(e) => setTaskSearchTerm(e.target.value)}
                                      placeholder="Search tasks..."
                                      className="outline-none text-sm w-48 bg-transparent"
                                      autoFocus
                                    />
                                    <button
                                      onClick={() => {
                                        setTaskSearchExpanded(false);
                                        setTaskSearchTerm('');
                                      }}
                                      className="p-1 hover:bg-gray-200 rounded"
                                    >
                                      <X className="w-3 h-3 text-gray-500" />
                                    </button>
                                  </div>
                                ) : (
                                  <Button
                                    onClick={() => setTaskSearchExpanded(true)}
                                    variant="ghost"
                                    size="sm"
                                    className="flex items-center gap-2"
                                  >
                                    <Search className="w-4 h-4" />
                                    Search
                                  </Button>
                                )}
                              </div>
                              
                              {/* Sort */}
                              <div className="relative">
                                <select
                                  value={taskSortBy}
                                  onChange={(e) => setTaskSortBy(e.target.value as any)}
                                  className="appearance-none rounded-md px-3 py-2 pr-8 text-sm bg-gray-50 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer border-0"
                                >
                                  <option value="name">Sort: Item</option>
                                  <option value="status">Sort: Status</option>
                                  <option value="owner">Sort: Owner</option>
                                  <option value="dueDate">Sort: Due Date</option>
                                </select>
                                <ArrowUpDown className="w-4 h-4 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                              </div>
                              
                              {/* Filter */}
                              <div className="flex items-center gap-2">
                                <div className="relative">
                                  <select
                                    value={taskFilterStatus}
                                    onChange={(e) => setTaskFilterStatus(e.target.value)}
                                    className="appearance-none rounded-md px-3 py-2 pr-8 text-sm bg-gray-50 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer border-0"
                                  >
                                    <option value="all">Status: All</option>
                                    <option value="Not Started">Not Started</option>
                                    <option value="In Progress">In Progress</option>
                                    <option value="Complete">Complete</option>
                                    <option value="Cancelled">Cancelled</option>
                                  </select>
                                  <Filter className="w-4 h-4 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                                </div>
                                
                                <div className="relative">
                                  <select
                                    value={taskFilterDue}
                                    onChange={(e) => setTaskFilterDue(e.target.value)}
                                    className="appearance-none rounded-md px-3 py-2 pr-8 text-sm bg-gray-50 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer border-0"
                                  >
                                    <option value="all">Due: All</option>
                                    <option value="overdue">Overdue</option>
                                    <option value="today">Today</option>
                                    <option value="upcoming">Upcoming</option>
                                    <option value="none">No Due Date</option>
                                  </select>
                                  <Filter className="w-4 h-4 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                                </div>
                                
                                <div className="relative">
                                  <select
                                    value={taskFilterOwner}
                                    onChange={(e) => setTaskFilterOwner(e.target.value)}
                                    className="appearance-none rounded-md px-3 py-2 pr-8 text-sm bg-gray-50 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer border-0"
                                  >
                                    <option value="all">Owner: All</option>
                                    {getUniqueOwners().map(owner => (
                                      <option key={owner} value={owner}>{owner}</option>
                                    ))}
                                  </select>
                                  <Filter className="w-4 h-4 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                                </div>
                              </div>
                            </div>
                          </div>

                          {taskSections.length === 0 ? (
                            <div className="text-center py-16">
                              <div className="text-gray-400 mb-3">
                                <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                </svg>
                              </div>
                              <p className="text-gray-500 font-medium">No sections yet</p>
                              <p className="text-sm text-gray-400 mt-1">Click "New Section" to create your first section</p>
                            </div>
                          ) : (
                            <div className="p-6 space-y-4">
                              {taskSections.map((section) => {
                                const sectionTasks = projectTasks.filter(t => t.sectionId === section.id);
                                const filteredSectionTasks = getFilteredAndSortedTasks(sectionTasks);
                                return (
                                  <div key={section.id} className="border border-gray-200 rounded-lg overflow-hidden">
                                    {/* Section Header */}
                                    <div className={`${section.color} p-4 flex items-center justify-between`}>
                                      <div className="flex items-center gap-3 flex-1">
                                        <button
                                          onClick={() => toggleSectionCollapse(section.id)}
                                          className="p-1 hover:bg-white/50 rounded transition-colors"
                                        >
                                          {section.isCollapsed ? (
                                            <ChevronRight className="w-4 h-4 text-gray-700" />
                                          ) : (
                                            <ChevronDown className="w-4 h-4 text-gray-700" />
                                          )}
                                        </button>
                                        <input
                                          type="text"
                                          value={section.name}
                                          onChange={(e) => updateSection(section.id, e.target.value)}
                                          className="flex-1 bg-transparent border-none focus:outline-none font-semibold text-gray-900 text-base px-2 py-1 hover:bg-white/30 focus:bg-white/50 rounded"
                                        />
                                        <span className="text-sm text-gray-600 font-medium">
                                          {filteredSectionTasks.length} {filteredSectionTasks.length === 1 ? 'task' : 'tasks'}
                                          {filteredSectionTasks.length !== sectionTasks.length && (
                                            <span className="text-gray-400"> (of {sectionTasks.length})</span>
                                          )}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Button
                                          onClick={() => addTask(section.id)}
                                          variant="outline"
                                          size="sm"
                                          className="bg-white/50 hover:bg-white border-gray-300"
                                        >
                                          <Plus className="w-3 h-3 mr-1" />
                                          Add Task
                                        </Button>
                                        <button
                                          onClick={() => deleteSection(section.id)}
                                          className="p-2 hover:bg-red-100 rounded transition-colors text-gray-600 hover:text-red-600"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </div>

                                    {/* Tasks Table */}
                                    {!section.isCollapsed && filteredSectionTasks.length > 0 && (
                                      <div className="overflow-x-auto">
                                        <table className="w-full text-sm bg-white">
                                          <thead>
                                            <tr className="border-b border-gray-200">
                                              <th className="text-left py-3 px-4 font-semibold text-gray-600 bg-gray-50 w-8"></th>
                                              <th className="text-left py-3 px-4 font-semibold text-gray-600 bg-gray-50 min-w-[350px]">Item</th>
                                              <th className="text-center py-3 px-4 font-semibold text-gray-600 bg-gray-50 w-24">
                                                <MessageCircle className="w-4 h-4 mx-auto" />
                                              </th>
                                              <th className="text-center py-3 px-4 font-semibold text-gray-600 bg-gray-50 w-44">Status</th>
                                              <th className="text-center py-3 px-4 font-semibold text-gray-600 bg-gray-50 w-44">Due</th>
                                              <th className="text-center py-3 px-4 font-semibold text-gray-600 bg-gray-50 w-52">Owner</th>
                                              <th className="text-left py-3 px-4 font-semibold text-gray-600 bg-gray-50 min-w-[250px]">Notes</th>
                                              <th className="text-center py-3 px-4 font-semibold text-gray-600 bg-gray-50 w-16"></th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {filteredSectionTasks.map((task) => (
                                              <>
                                                <tr key={task.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors group">
                                                  <td className="py-3 px-4">
                                                    {task.subtasks && task.subtasks.length > 0 && (
                                                      <button
                                                        onClick={() => toggleTaskExpansion(task.id)}
                                                        className="p-1 hover:bg-gray-200 rounded transition-colors"
                                                      >
                                                        {task.isExpanded ? (
                                                          <ChevronDown className="w-4 h-4 text-gray-600" />
                                                        ) : (
                                                          <ChevronRight className="w-4 h-4 text-gray-600" />
                                                        )}
                                                      </button>
                                                    )}
                                                  </td>
                                                  <td className="py-3 px-4">
                                                    <div className="flex items-center gap-2">
                                                      <div className={`w-1 h-6 rounded ${getStatusColor(task.status)}`}></div>
                                                      <input
                                                        type="text"
                                                        value={task.name}
                                                        onChange={(e) => updateTask(task.id, 'name', e.target.value)}
                                                        className="flex-1 px-2 py-1.5 border border-transparent hover:border-gray-300 focus:border-blue-400 rounded focus:outline-none font-medium text-gray-900"
                                                        placeholder="Enter task name..."
                                                      />
                                                    </div>
                                                  </td>
                                                  <td className="py-3 px-4 text-center">
                                                    <button
                                                      onClick={() => addSubtask(task.id)}
                                                      className="inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                    >
                                                      <Plus className="w-3 h-3" />
                                                      <span className="font-medium">Add</span>
                                                    </button>
                                                  </td>
                                                  <td className="py-3 px-4">
                                                    <select
                                                      value={task.status}
                                                      onChange={(e) => updateTask(task.id, 'status', e.target.value)}
                                                      className={`w-full px-3 py-2 rounded-md text-sm font-medium text-center border-0 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-colors ${
                                                        task.status === 'Complete' ? 'bg-green-100 text-green-800' :
                                                        task.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                                                        task.status === 'Cancelled' ? 'bg-red-100 text-red-800' :
                                                        'bg-gray-100 text-gray-700'
                                                      }`}
                                                    >
                                                      <option value="Not Started">Not Started</option>
                                                      <option value="In Progress">In Progress</option>
                                                      <option value="Complete">Complete</option>
                                                      <option value="Cancelled">Cancelled</option>
                                                    </select>
                                                  </td>
                                                  <td className="py-3 px-4">
                                                    <input
                                                      type="date"
                                                      value={task.dueDate}
                                                      onChange={(e) => updateTask(task.id, 'dueDate', e.target.value)}
                                                      className={`w-full px-3 py-2 border rounded-md text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all ${
                                                        task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'Complete'
                                                          ? 'border-red-300 bg-red-50 text-red-700'
                                                          : 'border-gray-200 hover:border-gray-300'
                                                      }`}
                                                    />
                                                  </td>
                                                  <td className="py-3 px-4">
                                                    <select
                                                      value={task.owner}
                                                      onChange={(e) => updateTask(task.id, 'owner', e.target.value)}
                                                      className="w-full px-3 py-2 border border-gray-200 hover:border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white transition-all"
                                                    >
                                                      <option value="" className="text-gray-400">Select person...</option>
                                                      {getAssignedResources().map((resource, idx) => (
                                                        <option key={idx} value={resource}>{resource}</option>
                                                      ))}
                                                    </select>
                                                  </td>
                                                  <td className="py-3 px-4">
                                                    <input
                                                      type="text"
                                                      value={task.notes}
                                                      onChange={(e) => updateTask(task.id, 'notes', e.target.value)}
                                                      className="w-full px-2 py-1.5 border border-transparent hover:border-gray-300 focus:border-blue-400 rounded focus:outline-none text-gray-600"
                                                      placeholder="Add notes..."
                                                    />
                                                  </td>
                                                  <td className="py-3 px-4 text-center">
                                                    <button
                                                      onClick={() => deleteTask(task.id)}
                                                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                                                    >
                                                      <Trash2 className="w-4 h-4" />
                                                    </button>
                                                  </td>
                                                </tr>
                                                {task.isExpanded && task.subtasks && task.subtasks.map((subtask: any) => (
                                                  <tr key={subtask.id} className="border-b border-gray-100 hover:bg-blue-25 transition-colors group bg-gray-50/50">
                                                    <td className="py-2.5 px-4"></td>
                                                    <td className="py-2.5 px-4 pl-16">
                                                      <div className="flex items-center gap-2">
                                                        <div className={`w-1 h-5 rounded ${getStatusColor(subtask.status)}`}></div>
                                                        <input
                                                          type="text"
                                                          value={subtask.name}
                                                          onChange={(e) => updateSubtask(task.id, subtask.id, 'name', e.target.value)}
                                                          className="flex-1 px-2 py-1 border border-transparent hover:border-gray-300 focus:border-blue-400 rounded focus:outline-none text-sm text-gray-700"
                                                          placeholder="Enter subtask name..."
                                                        />
                                                      </div>
                                                    </td>
                                                    <td className="py-2.5 px-4"></td>
                                                    <td className="py-2.5 px-4">
                                                      <select
                                                        value={subtask.status}
                                                        onChange={(e) => updateSubtask(task.id, subtask.id, 'status', e.target.value)}
                                                        className={`w-full px-3 py-1.5 rounded-md text-xs font-medium text-center border-0 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-colors ${
                                                          subtask.status === 'Complete' ? 'bg-green-100 text-green-800' :
                                                          subtask.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                                                          subtask.status === 'Cancelled' ? 'bg-red-100 text-red-800' :
                                                          'bg-gray-100 text-gray-700'
                                                        }`}
                                                      >
                                                        <option value="Not Started">Not Started</option>
                                                        <option value="In Progress">In Progress</option>
                                                        <option value="Complete">Complete</option>
                                                        <option value="Cancelled">Cancelled</option>
                                                      </select>
                                                    </td>
                                                    <td className="py-2.5 px-4">
                                                      <input
                                                        type="date"
                                                        value={subtask.dueDate}
                                                        onChange={(e) => updateSubtask(task.id, subtask.id, 'dueDate', e.target.value)}
                                                        className={`w-full px-3 py-1.5 border rounded-md text-xs text-center focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all ${
                                                          subtask.dueDate && new Date(subtask.dueDate) < new Date() && subtask.status !== 'Complete'
                                                            ? 'border-red-300 bg-red-50 text-red-700'
                                                            : 'border-gray-200 hover:border-gray-300'
                                                        }`}
                                                      />
                                                    </td>
                                                    <td className="py-2.5 px-4">
                                                      <select
                                                        value={subtask.owner}
                                                        onChange={(e) => updateSubtask(task.id, subtask.id, 'owner', e.target.value)}
                                                        className="w-full px-3 py-1.5 border border-gray-200 hover:border-gray-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white transition-all"
                                                      >
                                                        <option value="" className="text-gray-400">Select person...</option>
                                                        {getAssignedResources().map((resource, idx) => (
                                                          <option key={idx} value={resource}>{resource}</option>
                                                        ))}
                                                      </select>
                                                    </td>
                                                    <td className="py-2.5 px-4">
                                                      <input
                                                        type="text"
                                                        value={subtask.notes}
                                                        onChange={(e) => updateSubtask(task.id, subtask.id, 'notes', e.target.value)}
                                                        className="w-full px-2 py-1 border border-transparent hover:border-gray-300 focus:border-blue-400 rounded focus:outline-none text-xs text-gray-600"
                                                        placeholder="Add notes..."
                                                      />
                                                    </td>
                                                    <td className="py-2.5 px-4 text-center">
                                                      <button
                                                        onClick={() => deleteSubtask(task.id, subtask.id)}
                                                        className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                                                      >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                      </button>
                                                    </td>
                                                  </tr>
                                                ))}
                                              </>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    )}

                                    {/* Empty state for section */}
                                    {!section.isCollapsed && sectionTasks.length === 0 && (
                                      <div className="p-8 text-center bg-white">
                                        <p className="text-sm text-gray-500">No tasks in this section yet</p>
                                        <Button
                                          onClick={() => addTask(section.id)}
                                          variant="outline"
                                          size="sm"
                                          className="mt-3"
                                        >
                                          <Plus className="w-3 h-3 mr-1" />
                                          Add First Task
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    {projectSubView === 'assets' && (
                      <div className="p-6 w-full">
                        <div className="w-full bg-white border border-gray-200 rounded-lg shadow-sm">
                          <div className="p-6 border-b border-gray-200">
                            <div className="mb-4">
                              <h3 className="text-lg font-semibold text-gray-900">Asset Tracker</h3>
                              <p className="text-sm text-gray-600 mt-1">Track deliverable assets and their status</p>
                            </div>
                            
                            <div className="flex items-center gap-3">
                              <Button
                                onClick={addAssetSection}
                                className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
                              >
                                <Plus className="w-4 h-4" />
                                New Section
                              </Button>
                              
                              {/* Search */}
                              <div className="flex items-center gap-2">
                                {assetSearchExpanded ? (
                                  <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-md">
                                    <Search className="w-4 h-4 text-gray-400" />
                                    <input
                                      type="text"
                                      value={assetSearchTerm}
                                      onChange={(e) => setAssetSearchTerm(e.target.value)}
                                      placeholder="Search assets..."
                                      className="outline-none text-sm w-48 bg-transparent"
                                      autoFocus
                                    />
                                    <button
                                      onClick={() => {
                                        setAssetSearchExpanded(false);
                                        setAssetSearchTerm('');
                                      }}
                                      className="p-1 hover:bg-gray-200 rounded"
                                    >
                                      <X className="w-3 h-3 text-gray-500" />
                                    </button>
                                  </div>
                                ) : (
                                  <Button
                                    onClick={() => setAssetSearchExpanded(true)}
                                    variant="ghost"
                                    size="sm"
                                    className="flex items-center gap-2"
                                  >
                                    <Search className="w-4 h-4" />
                                    Search
                                  </Button>
                                )}
                              </div>
                              
                              {/* Filter */}
                              <div className="flex items-center gap-2">
                                <div className="relative">
                                  <select
                                    value={assetFilterSaltStatus}
                                    onChange={(e) => setAssetFilterSaltStatus(e.target.value)}
                                    className="appearance-none rounded-md px-3 py-2 pr-8 text-sm bg-gray-50 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer border-0"
                                  >
                                    <option value="all">Salt Status: All</option>
                                    {getUniqueSaltStatuses().map(status => (
                                      <option key={status} value={status}>{status}</option>
                                    ))}
                                  </select>
                                  <Filter className="w-4 h-4 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                                </div>
                                
                                <div className="relative">
                                  <select
                                    value={assetFilterType}
                                    onChange={(e) => setAssetFilterType(e.target.value)}
                                    className="appearance-none rounded-md px-3 py-2 pr-8 text-sm bg-gray-50 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer border-0"
                                  >
                                    <option value="all">Type: All</option>
                                    <option value="Print">Print</option>
                                    <option value="Digital">Digital</option>
                                  </select>
                                  <Filter className="w-4 h-4 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                                </div>
                                
                                <div className="relative">
                                  <select
                                    value={assetFilterLocation}
                                    onChange={(e) => setAssetFilterLocation(e.target.value)}
                                    className="appearance-none rounded-md px-3 py-2 pr-8 text-sm bg-gray-50 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer border-0"
                                  >
                                    <option value="all">Location: All</option>
                                    {getUniqueLocations().map(location => (
                                      <option key={location} value={location}>{location}</option>
                                    ))}
                                  </select>
                                  <Filter className="w-4 h-4 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                                </div>
                              </div>
                              
                              {/* Sort */}
                              <div className="relative">
                                <select
                                  value={assetSortBy}
                                  onChange={(e) => setAssetSortBy(e.target.value as any)}
                                  className="appearance-none rounded-md px-3 py-2 pr-8 text-sm bg-gray-50 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer border-0"
                                >
                                  <option value="dueDate">Sort: Due Date</option>
                                  <option value="saltStatus">Sort: Salt Status</option>
                                </select>
                                <ArrowUpDown className="w-4 h-4 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                              </div>
                            </div>
                          </div>

                          {assetSections.length === 0 ? (
                            <div className="text-center py-16">
                              <div className="text-gray-400 mb-3">
                                <Package className="w-16 h-16 mx-auto" />
                              </div>
                              <p className="text-gray-500 font-medium">No sections yet</p>
                              <p className="text-sm text-gray-400 mt-1">Click "New Section" to create your first section</p>
                            </div>
                          ) : (
                            <div className="p-6 space-y-4">
                              {assetSections.map((section) => {
                                const sectionAssets = projectAssets.filter(a => a.sectionId === section.id);
                                const filteredSectionAssets = getFilteredAndSortedAssets(sectionAssets);
                                return (
                                  <div key={section.id} className="border border-gray-200 rounded-lg overflow-hidden">
                                    {/* Section Header */}
                                    <div className={`${section.color} p-4 flex items-center justify-between`}>
                                      <div className="flex items-center gap-3 flex-1">
                                        <button
                                          onClick={() => toggleAssetSectionCollapse(section.id)}
                                          className="p-1 hover:bg-white/50 rounded transition-colors"
                                        >
                                          {section.isCollapsed ? (
                                            <ChevronRight className="w-4 h-4 text-gray-700" />
                                          ) : (
                                            <ChevronDown className="w-4 h-4 text-gray-700" />
                                          )}
                                        </button>
                                        <input
                                          type="text"
                                          value={section.name}
                                          onChange={(e) => updateAssetSection(section.id, e.target.value)}
                                          className="flex-1 bg-transparent border-none focus:outline-none font-semibold text-gray-900 text-base px-2 py-1 hover:bg-white/30 focus:bg-white/50 rounded"
                                        />
                                        <span className="text-sm text-gray-600 font-medium">
                                          {filteredSectionAssets.length} {filteredSectionAssets.length === 1 ? 'asset' : 'assets'}
                                          {filteredSectionAssets.length !== sectionAssets.length && (
                                            <span className="text-gray-400"> (of {sectionAssets.length})</span>
                                          )}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Button
                                          onClick={() => addAsset(section.id)}
                                          variant="outline"
                                          size="sm"
                                          className="bg-white/50 hover:bg-white border-gray-300"
                                        >
                                          <Plus className="w-3 h-3 mr-1" />
                                          Add Asset
                                        </Button>
                                        <button
                                          onClick={() => deleteAssetSection(section.id)}
                                          className="p-2 hover:bg-red-100 rounded transition-colors text-gray-600 hover:text-red-600"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </div>

                                    {/* Assets Table */}
                                    {!section.isCollapsed && filteredSectionAssets.length > 0 && (
                                      <div className="overflow-x-auto">
                                        <table className="w-full text-sm bg-white">
                                          <thead>
                                            <tr className="border-b border-gray-200">
                                              <th className="text-left py-3 px-4 font-semibold text-gray-600 bg-gray-50 min-w-[250px]">Item</th>
                                              <th className="text-left py-3 px-4 font-semibold text-gray-600 bg-gray-50 w-44">Salt Status</th>
                                              <th className="text-center py-3 px-4 font-semibold text-gray-600 bg-gray-50 w-32">Type</th>
                                              <th className="text-left py-3 px-4 font-semibold text-gray-600 bg-gray-50 min-w-[200px]">Location</th>
                                              <th className="text-center py-3 px-4 font-semibold text-gray-600 bg-gray-50 w-44">Due Date</th>
                                              <th className="text-left py-3 px-4 font-semibold text-gray-600 bg-gray-50 min-w-[200px]">Notes</th>
                                              <th className="text-center py-3 px-4 font-semibold text-gray-600 bg-gray-50 w-16"></th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {filteredSectionAssets.map((asset) => (
                                              <tr key={asset.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors group">
                                                <td className="py-3 px-4">
                                                  <input
                                                    type="text"
                                                    value={asset.name}
                                                    onChange={(e) => updateAsset(asset.id, 'name', e.target.value)}
                                                    className="w-full px-2 py-1.5 border border-transparent hover:border-gray-300 focus:border-blue-400 rounded focus:outline-none font-medium text-gray-900"
                                                    placeholder="Enter asset name..."
                                                  />
                                                </td>
                                                <td className="py-3 px-4">
                                                  <input
                                                    type="text"
                                                    value={asset.saltStatus}
                                                    onChange={(e) => updateAsset(asset.id, 'saltStatus', e.target.value)}
                                                    className="w-full px-2 py-1.5 border border-transparent hover:border-gray-300 focus:border-blue-400 rounded focus:outline-none text-gray-900"
                                                    placeholder="Status..."
                                                  />
                                                </td>
                                                <td className="py-3 px-4">
                                                  <select
                                                    value={asset.type}
                                                    onChange={(e) => updateAsset(asset.id, 'type', e.target.value)}
                                                    className="w-full px-3 py-2 border border-gray-200 hover:border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white transition-all"
                                                  >
                                                    <option value="Print">Print</option>
                                                    <option value="Digital">Digital</option>
                                                  </select>
                                                </td>
                                                <td className="py-3 px-4">
                                                  <input
                                                    type="text"
                                                    value={asset.location}
                                                    onChange={(e) => updateAsset(asset.id, 'location', e.target.value)}
                                                    className="w-full px-2 py-1.5 border border-transparent hover:border-gray-300 focus:border-blue-400 rounded focus:outline-none text-gray-900"
                                                    placeholder="Location..."
                                                  />
                                                </td>
                                                <td className="py-3 px-4">
                                                  <input
                                                    type="date"
                                                    value={asset.dueDate}
                                                    onChange={(e) => updateAsset(asset.id, 'dueDate', e.target.value)}
                                                    className={`w-full px-3 py-2 border rounded-md text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all ${
                                                      asset.dueDate && new Date(asset.dueDate) < new Date()
                                                        ? 'border-red-300 bg-red-50 text-red-700'
                                                        : 'border-gray-200 hover:border-gray-300'
                                                    }`}
                                                  />
                                                </td>
                                                <td className="py-3 px-4">
                                                  <input
                                                    type="text"
                                                    value={asset.notes}
                                                    onChange={(e) => updateAsset(asset.id, 'notes', e.target.value)}
                                                    className="w-full px-2 py-1.5 border border-transparent hover:border-gray-300 focus:border-blue-400 rounded focus:outline-none text-gray-600"
                                                    placeholder="Add notes..."
                                                  />
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                  <button
                                                    onClick={() => deleteAsset(asset.id)}
                                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                                                  >
                                                    <Trash2 className="w-4 h-4" />
                                                  </button>
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    )}

                                    {/* Empty state for section */}
                                    {!section.isCollapsed && sectionAssets.length === 0 && (
                                      <div className="p-8 text-center bg-white">
                                        <p className="text-sm text-gray-500">No assets in this section yet</p>
                                        <Button
                                          onClick={() => addAsset(section.id)}
                                          variant="outline"
                                          size="sm"
                                          className="mt-3"
                                        >
                                          <Plus className="w-3 h-3 mr-1" />
                                          Add First Asset
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Add Team Modal */}
          {showAddTeamModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div className="absolute inset-0 bg-black/30" onClick={() => {
                setShowAddTeamModal(false);
                setNewTeamName('');
                setSelectedParentTeam(null);
              }}></div>
              <div className="relative bg-white w-full max-w-md rounded-lg shadow-lg border border-gray-200 p-6">
                <h3 className="text-base font-semibold text-gray-900 mb-4">Add New Team</h3>
                <div className="space-y-4">
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Team Name</div>
                    <input
                      className="w-full border rounded-md px-3 py-2 text-sm"
                      value={newTeamName}
                      onChange={(e) => setNewTeamName(e.target.value)}
                      placeholder="Enter team name..."
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          addTeam(selectedParentTeam || undefined);
                        }
                      }}
                    />
                  </div>
                </div>
                <div className="mt-6 flex items-center justify-end gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setShowAddTeamModal(false);
                      setNewTeamName('');
                      setSelectedParentTeam(null);
                    }} 
                    className="h-9 px-4 text-sm"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => addTeam(selectedParentTeam || undefined)}
                    className="h-9 px-4 text-sm bg-blue-600 hover:bg-blue-700 text-white"
                    disabled={!newTeamName.trim()}
                  >
                    Add Team
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Add Person Modal */}
          {showAddPersonModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div className="absolute inset-0 bg-black/30" onClick={() => {
                setShowAddPersonModal(false);
                setSelectedPersonForAdd('');
                setSelectedParentTeam(null);
              }}></div>
              <div className="relative bg-white w-full max-w-md rounded-lg shadow-lg border border-gray-200 p-6">
                <h3 className="text-base font-semibold text-gray-900 mb-4">Add Person to Team</h3>
                <div className="space-y-4">
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Search and Select Person</div>
                    <input
                      className="w-full border rounded-md px-3 py-2 text-sm mb-2"
                      value={teamSearchTerm}
                      onChange={(e) => setTeamSearchTerm(e.target.value)}
                      placeholder="Search by name or title..."
                      autoFocus
                    />
                    <div className="max-h-64 overflow-y-auto border rounded-md">
                      {getFilteredStaff(teamSearchTerm).map((person, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setSelectedPersonForAdd(person.name);
                            setTeamSearchTerm('');
                          }}
                          className={`w-full text-left px-3 py-2 hover:bg-blue-50 border-b last:border-b-0 transition-colors ${
                            selectedPersonForAdd === person.name ? 'bg-blue-100' : ''
                          }`}
                        >
                          <div className="font-medium text-gray-900">{person.name}</div>
                          <div className="text-xs text-gray-600">{person.title}</div>
                        </button>
                      ))}
                    </div>
                    {selectedPersonForAdd && (
                      <div className="mt-3 p-3 bg-blue-50 rounded-md">
                        <div className="text-xs text-gray-600 mb-1">Selected:</div>
                        <div className="font-medium text-gray-900">
                          {staffData.find(s => s.name === selectedPersonForAdd)?.name}
                        </div>
                        <div className="text-xs text-gray-600">
                          {staffData.find(s => s.name === selectedPersonForAdd)?.title}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-6 flex items-center justify-end gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setShowAddPersonModal(false);
                      setSelectedPersonForAdd('');
                      setTeamSearchTerm('');
                      setSelectedParentTeam(null);
                    }} 
                    className="h-9 px-4 text-sm"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => selectedParentTeam && addPersonToTeam(selectedParentTeam)}
                    className="h-9 px-4 text-sm bg-blue-600 hover:bg-blue-700 text-white"
                    disabled={!selectedPersonForAdd}
                  >
                    Add Person
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Simple Quote Add/Edit Modal */}
          {quoteModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div className="absolute inset-0 bg-black/30" onClick={() => setQuoteModalOpen(false)}></div>
              <div className="relative bg-white w-full max-w-md rounded-lg shadow-lg border border-gray-200 p-6">
                <h3 className="text-base font-semibold text-gray-900 mb-4">{quoteForm.id ? 'Edit Quote' : 'Add Quote'}</h3>
                <div className="space-y-4">
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Quote Name</div>
                    <input
                      className="w-full border rounded-md px-3 py-2 text-sm"
                      value={quoteForm.projectName}
                      onChange={(e) => setQuoteForm({ ...quoteForm, projectName: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Total</div>
                      <input
                        type="number"
                        className="w-full border rounded-md px-3 py-2 text-sm"
                        value={quoteForm.totalRevenue}
                        onChange={(e) => setQuoteForm({ ...quoteForm, totalRevenue: Number(e.target.value || 0) })}
                      />
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Currency</div>
                      <select
                        className="w-full border rounded-md px-3 py-2 text-sm"
                        value={quoteForm.currency}
                        onChange={(e) => setQuoteForm({ ...quoteForm, currency: e.target.value })}
                      >
                        <option value="USD">USD</option>
                        <option value="CAD">CAD</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Status</div>
                    <select
                      className="w-full border rounded-md px-3 py-2 text-sm"
                      value={quoteForm.status}
                      onChange={(e) => setQuoteForm({ ...quoteForm, status: e.target.value as any })}
                    >
                      <option value="draft">Draft</option>
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                </div>
                <div className="mt-6 flex items-center justify-end gap-2">
                  <Button variant="outline" onClick={() => setQuoteModalOpen(false)} className="h-9 px-4 text-sm">Cancel</Button>
                  <Button
                    onClick={() => {
                      try {
                        const quotesRaw = cloudStorage.getItem('saltxc-quotes');
                        const quotes = quotesRaw ? JSON.parse(quotesRaw) : [];
                        const nowIso = new Date().toISOString();
                        if (quoteForm.id) {
                          const idx = quotes.findIndex((q: any) => q.id === quoteForm.id);
                          if (idx >= 0) {
                            quotes[idx] = {
                              ...quotes[idx],
                              projectName: quoteForm.projectName,
                              totalRevenue: quoteForm.totalRevenue,
                              currency: quoteForm.currency,
                              status: quoteForm.status,
                              lastModified: nowIso
                            };
                          }
                        } else {
                          const newId = `quote-${Date.now()}`;
                          quotes.push({
                            id: newId,
                            projectNumber: selectedProjectDetails?.projectCode || '',
                            projectName: quoteForm.projectName || 'Untitled Quote',
                            clientName: selectedProjectDetails?.client || '',
                            brand: '',
                            inMarketDate: '',
                            projectCompletionDate: '',
                            currency: quoteForm.currency,
                            totalRevenue: quoteForm.totalRevenue,
                            status: quoteForm.status,
                            lastModified: nowIso
                          });
                          // Open builder for new quote
                          setEditingQuoteId(newId);
                          setQuoteEditorTab('setup');
                        }
                        cloudStorage.setItem('saltxc-quotes', JSON.stringify(quotes));
                        // refresh list
                        const projectQuotes = quotes.filter((q: any) => (q.projectNumber || '') === (selectedProjectDetails?.projectCode || ''));
                        setSelectedProjectQuotes(projectQuotes);
                        setQuoteModalOpen(false);
                      } catch {
                        setQuoteModalOpen(false);
                      }
                    }}
                    className="h-9 px-4 text-sm"
                  >
                    Save
                  </Button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
