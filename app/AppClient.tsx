'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import ProjectSetup from '../components/ProjectSetup';
import PlanningPhase from '../components/PlanningPhase';
import ProductionCosts from '../components/ProductionCosts';
import QuoteReview from '../components/QuoteReview';
import Login from '../components/Login';
import SignUp from '../components/SignUp';
import Dashboard from '../components/Dashboard';
import ToolsSelection from '../components/ToolsSelection';
import ProjectManagement from '../components/ProjectManagement';
import PMDashboard from '../components/PMDashboard';
import PersonDashboard from '../components/PersonDashboard';
import Pipeline from '../components/Pipeline';
import ThreeInOne from '../components/ThreeInOne';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { saveQuote, loadQuote, deleteQuote, createQuoteFromPipeline } from '../utils/quoteManager';
import BrandedHeader from '../components/BrandedHeader';
import { cloudStorage, hydrateCloudStorage, clearCloudStorageCache } from '@/lib/cloudStorage';
import { firebaseAuth } from '@/lib/firebaseClient';
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';

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
  // Legacy fields for backward compatibility
  briefDate?: string;
  inMarketDate?: string;
  projectCompletionDate?: string;
}

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

export interface Department {
  id: string;
  name: string;
  output: string;
  assignedTo?: string; // email of assigned user
  assignedName?: string; // display name of assigned user
  status: 'unassigned' | 'assigned' | 'in_progress' | 'completed';
  roles: Role[];
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

export interface PhaseData {
  [phaseName: string]: Stage[];
}

// Add interface for quote review data
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

// Add interface for complete quote data
export interface QuoteData {
  project: Project | null;
  phaseData: PhaseData;
  productionCostData: any;
  quoteReviewData?: QuoteReviewData;
  currentStep: 'setup' | 'project-fees' | 'production-costs' | 'review';
  lastSaved: string;
}

export default function Home() {
  // Authentication state
  const [user, setUser] = useState<{ email: string; name: string; role?: string; department?: string } | null>(null);
  const [currentView, setCurrentView] = useState<'login' | 'signup' | 'tools-selection' | 'dashboard' | 'quote-editor' | 'project-management' | 'project-management-hub' | 'person-dashboard' | 'pipeline' | 'three-in-one'>('login');
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);
  const [pmSelectedQuoteId, setPmSelectedQuoteId] = useState<string | null>(null);
  const [dashboardKey, setDashboardKey] = useState<number>(0);
  const [pmDashboardKey, setPmDashboardKey] = useState<number>(0);
  const [personName, setPersonName] = useState<string>('');
  const [scrollTaskId, setScrollTaskId] = useState<string | null>(null);
  const [userView, setUserView] = useState<'Admin' | 'Business Owner' | 'Team Member'>('Admin');

  // Quote editor state
  const [currentStep, setCurrentStep] = useState<'setup' | 'project-fees' | 'production-costs' | 'review'>('setup');

  // Debug step changes
  useEffect(() => {
    console.log('📍 Current step changed to:', currentStep);
  }, [currentStep]);
  const [project, setProject] = useState<Project | null>(null);
  const [phaseData, setPhaseData] = useState<PhaseData>({});
  const phaseDataRef = useRef<PhaseData>({});
  const [productionCostData, setProductionCostData] = useState<any>({});
  const [quoteReviewData, setQuoteReviewData] = useState<QuoteReviewData>({
    projectScope: '',
    descriptions: {},
    invoiceItems: []
  });
  const [lastSaved, setLastSaved] = useState<string>('');
  const [storageReady, setStorageReady] = useState(false);

  // Check for existing session on component mount
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (firebaseUser) => {
      if (firebaseUser) {
        const userData = {
          email: firebaseUser.email || '',
          name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User'
        };
        setUser(userData);
        clearCloudStorageCache();
        await hydrateCloudStorage();
        setStorageReady(true);
        setCurrentView(prev => (prev === 'login' || prev === 'signup') ? 'tools-selection' : prev);
        await migrateExistingQuotesToNewPhaseNames();
      } else {
        clearCloudStorageCache();
        setStorageReady(false);
        setUser(null);
        setCurrentView('login');
      }
    });

    return () => unsubscribe();
  }, []);

  // Redirect to appropriate view when userView changes
  useEffect(() => {
    if (user && currentView === 'tools-selection' && userView === 'Team Member') {
      setCurrentView('project-management-hub');
    } else if (user && currentView === 'project-management-hub' && userView !== 'Team Member') {
      setCurrentView('tools-selection');
    }
  }, [userView, user, currentView]);

  // Migration function to update existing quotes with new phase names
  const migrateExistingQuotesToNewPhaseNames = useCallback(async () => {
    try {
      const savedQuotes = cloudStorage.getItem('saltxc-all-quotes');
      if (!savedQuotes) return;

      const quotes = Array.isArray(savedQuotes) ? savedQuotes : JSON.parse(savedQuotes);
      let migrationNeeded = false;

      const updatedQuotes = quotes.map((quote: any) => {
        let updatedQuote = { ...quote };
        
        // Update project phases
        if (quote.project?.phases) {
          const newPhases = quote.project.phases.map((phase: string) => {
            if (phase === 'planning') return 'Planning';
            if (phase === 'production') return 'Production/Execution';
            if (phase === 'postProduction') return 'Post Production/Wrap';
            return phase; // Keep existing if already updated
          });
          
          if (JSON.stringify(newPhases) !== JSON.stringify(quote.project.phases)) {
            updatedQuote = {
              ...updatedQuote,
              project: {
                ...updatedQuote.project,
                phases: newPhases
              }
            };
            migrationNeeded = true;
          }
        }

        // Update phaseData keys
        if (quote.phaseData) {
          const newPhaseData: Record<string, any> = {};
          let phaseDataChanged = false;
          
          Object.keys(quote.phaseData).forEach(oldPhase => {
            let newPhase = oldPhase;
            if (oldPhase === 'planning') {
              newPhase = 'Planning';
              phaseDataChanged = true;
            } else if (oldPhase === 'production') {
              newPhase = 'Production/Execution';
              phaseDataChanged = true;
            } else if (oldPhase === 'postProduction') {
              newPhase = 'Post Production/Wrap';
              phaseDataChanged = true;
            }
            newPhaseData[newPhase] = quote.phaseData[oldPhase];
          });
          
          if (phaseDataChanged) {
            updatedQuote = {
              ...updatedQuote,
              phaseData: newPhaseData
            };
            migrationNeeded = true;
          }
        }

        // Update phaseSettings keys
        if (quote.project?.phaseSettings) {
          const newPhaseSettings: Record<string, any> = {};
          let phaseSettingsChanged = false;
          
          Object.keys(quote.project.phaseSettings).forEach(oldPhase => {
            let newPhase = oldPhase;
            if (oldPhase === 'planning') {
              newPhase = 'Planning';
              phaseSettingsChanged = true;
            } else if (oldPhase === 'production') {
              newPhase = 'Production/Execution';
              phaseSettingsChanged = true;
            } else if (oldPhase === 'postProduction') {
              newPhase = 'Post Production/Wrap';
              phaseSettingsChanged = true;
            }
            newPhaseSettings[newPhase] = quote.project.phaseSettings[oldPhase];
          });
          
          if (phaseSettingsChanged) {
            updatedQuote = {
              ...updatedQuote,
              project: {
                ...updatedQuote.project,
                phaseSettings: newPhaseSettings
              }
            };
            migrationNeeded = true;
          }
        }

        return updatedQuote;
      });

      if (migrationNeeded) {
        cloudStorage.setItem('saltxc-all-quotes', JSON.stringify(updatedQuotes));
        console.log('✅ Migrated existing quotes to new phase names');
      }
    } catch (error) {
      console.error('❌ Failed to migrate quotes:', error);
    }
  }, []);

  // Load saved quote data when editing
  useEffect(() => {
    if (currentView === 'quote-editor' && editingQuoteId) {
      console.log('📂 Loading quote for editing:', editingQuoteId);
      const quote = loadQuote(editingQuoteId);
      if (quote) {
        console.log('✅ Quote loaded successfully:', {
          id: quote.id,
          clientName: quote.project.clientName,
          projectName: quote.project.projectName,
          brand: quote.project.brand,
          rateCard: quote.project.rateCard,
          currency: quote.project.currency
        });
        setProject(quote.project);
        console.log('📊 Loading phaseData:', { 
          phaseDataKeys: Object.keys(quote.phaseData || {}),
          phaseDataEntries: Object.keys(quote.phaseData || {}).length,
          fullPhaseData: quote.phaseData,
          rawQuote: quote
        });
        setPhaseData(quote.phaseData || {});
        phaseDataRef.current = quote.phaseData || {};
        setProductionCostData(quote.productionCostData || {});
        console.log('📂 Loading quote review data from storage:', {
          quoteReviewData: quote.quoteReviewData,
          invoiceItemsCount: quote.quoteReviewData?.invoiceItems?.length || 0,
          invoiceItems: quote.quoteReviewData?.invoiceItems
        });
        setQuoteReviewData(quote.quoteReviewData || {
          projectScope: '',
          descriptions: {},
          invoiceItems: []
        });
        setCurrentStep('setup');
      } else {
        console.log('❌ Quote not found:', editingQuoteId);
      }
    } else if (currentView === 'quote-editor' && !editingQuoteId) {
      console.log('📄 Creating new quote - initializing');
      // Apply budget label from session if present; do NOT clear pre-filled project
      if (typeof window !== 'undefined') {
        const budgetLabel = sessionStorage.getItem('new-quote-budget-label');
        if (budgetLabel) {
          sessionStorage.removeItem('new-quote-budget-label');
          setProject(prev => ({ ...(prev || {} as any), budgetLabel } as any));
        }
      }
      setPhaseData({});
      setProductionCostData({});
      setQuoteReviewData({
        projectScope: '',
        descriptions: {},
        invoiceItems: []
      });
      setCurrentStep('setup');
    }
  }, [currentView, editingQuoteId]);

  // Authentication handlers
  const handleLogin = (userData: { email: string; name: string }) => {
    setUser(userData);
    setCurrentView('tools-selection');
  };

  const handleSignUp = (userData: { email: string; name: string; firstName: string; lastName: string }) => {
    const userWithProfile = {
      email: userData.email,
      name: userData.name,
      firstName: userData.firstName,
      lastName: userData.lastName
    };
    setUser(userWithProfile);
    setCurrentView('tools-selection');
  };

  const handleShowSignUp = () => {
    setCurrentView('signup');
  };

  const handleBackToLogin = () => {
    setCurrentView('login');
  };

  const handleLogout = async () => {
    try {
      await firebaseSignOut(firebaseAuth);
    } catch (err) {
      console.error('Error signing out of Firebase', err);
    }
    clearCloudStorageCache();
    setStorageReady(false);
    setUser(null);
    setCurrentView('login');
    // Clear current quote data
    setProject(null);
    setPhaseData({});
    setProductionCostData({});
    setQuoteReviewData({ projectScope: '', descriptions: {}, invoiceItems: [] });
    setEditingQuoteId(null);
  };

  const handleSelectQuoteHub = () => {
    setCurrentView('dashboard');
  };

  const handleSelectProjectManagement = () => {
    setCurrentView('project-management-hub');
  };

  const handleSelectPipeline = () => {
    setCurrentView('pipeline');
  };

  const handleSelectThreeInOne = () => {
    setCurrentView('three-in-one');
  };


  const handleOpenPMProject = (quoteId: string) => {
    setPmSelectedQuoteId(quoteId);
    setCurrentView('project-management');
  };

  const handleOpenProjectWithData = (entry: any) => {
    // Create a standalone project from pipeline data
    const newProject = {
      id: crypto.randomUUID(),
      clientName: entry.client,
      brand: entry.client, // Use client as brand if no brand field
      projectName: entry.programName,
      projectNumber: entry.projectCode,
      startDate: entry.startMonth,
      endDate: entry.endMonth,
      phases: ['Planning', 'Production', 'Post-Production'] // Default phases
    };

    // Save to standalone projects
    const existingStandalone = cloudStorage.getItem('saltxc-standalone-projects');
    const standaloneProjects = existingStandalone ? JSON.parse(existingStandalone) : [];
    standaloneProjects.push(newProject);
    cloudStorage.setItem('saltxc-standalone-projects', JSON.stringify(standaloneProjects));

    // Open project management with this standalone project
    setPmSelectedQuoteId(newProject.id);
    setCurrentView('project-management');
  };

  const handleOpenPerson = (name: string) => {
    setPersonName(name);
    setCurrentView('person-dashboard');
  };

  const handleOpenProjectTask = (quoteId: string, taskId: string) => {
    setPmSelectedQuoteId(quoteId);
    setScrollTaskId(taskId);
    setCurrentView('project-management');
  };

  const handleCreateNewQuote = (projectData?: any) => {
    console.log('🆕 Creating new quote - RAW projectData:', JSON.stringify(projectData, null, 2));
    console.log('🔍 Does projectData have .project?', !!projectData?.project);
    setEditingQuoteId(null);
    
    // Fallback: try sessionStorage handoff first
    try {
      const fromSession = sessionStorage.getItem('new-quote-project');
      if (fromSession) {
        const parsed = JSON.parse(fromSession);
        console.log('📦 Retrieved new-quote-project from sessionStorage:', parsed);
        const newProjectData = {
          ...parsed,
          budgetLabel: 'Planning',
          phases: [],
          phaseSettings: {},
          totalProgramBudget: parsed.totalProgramBudget || 0
        } as Project;
        setProject(newProjectData);
        sessionStorage.removeItem('new-quote-project');
      } else if (projectData?.project) {
        // Pre-populate with existing project data
        console.log('📋 Pre-populating form with project data:', JSON.stringify(projectData.project, null, 2));
        const newProjectData = {
          ...projectData.project,
          budgetLabel: 'Planning', // Default to Planning for new budget
          phases: [], // Reset phases for new budget
          phaseSettings: {}, // Reset phase settings
          totalProgramBudget: 0 // Reset budget
        };
        console.log('✅ Setting project state to:', JSON.stringify(newProjectData, null, 2));
        setProject(newProjectData);
      } else {
        // Fallback: derive initial project from the selected row (quote/pipeline) data
        console.log('🧩 Deriving project from row (no embedded project found)');
        if (projectData) {
          const derivedProject = {
            projectNumber: projectData.projectNumber || '',
            clientName: projectData.clientName || '',
            clientCategory: '',
            brand: projectData.brand || '',
            projectName: projectData.projectName || '',
            startDate: projectData.startDate || projectData.inMarketDate || '',
            endDate: projectData.endDate || projectData.projectCompletionDate || '',
            totalProgramBudget: projectData.totalFees || projectData.totalRevenue || 0,
            rateCard: 'Standard',
            currency: projectData.currency || 'CAD',
            phases: [],
            phaseSettings: {},
            budgetLabel: 'Planning'
          } as Project;
          console.log('✅ Setting derived project state to:', JSON.stringify(derivedProject, null, 2));
          setProject(derivedProject);
        } else {
          console.log('🆕 Creating brand new project - projectData was:', projectData);
          setProject(null);
        }
      }
    } catch (err) {
      console.warn('⚠️ Session handoff failed, falling back to existing logic', err);
      if (projectData?.project) {
        const newProjectData = {
          ...projectData.project,
          budgetLabel: 'Planning',
          phases: [],
          phaseSettings: {},
          totalProgramBudget: 0
        } as Project;
        setProject(newProjectData);
      } else {
        setProject(null);
      }
    }
    
    setPhaseData({});
    phaseDataRef.current = {};
    setProductionCostData({});
    setQuoteReviewData({
      projectScope: '',
      descriptions: {},
      invoiceItems: []
    });
    setCurrentStep('setup');
    setCurrentView('quote-editor');
  };

  const handleEditQuote = (quoteRef: string) => {
    // Try loading by quote ID first
    const existingById = loadQuote(quoteRef);
    if (existingById) {
      if (existingById.status === 'approved') {
        alert('This quote has been approved and cannot be edited.');
        return;
      }
      setEditingQuoteId(existingById.id);
      setCurrentView('quote-editor');
      return;
    }

    // If not found by quote ID, attempt to resolve by project number using pipeline entries
    try {
      const pipelineEntriesRaw = cloudStorage.getItem('pipeline-entries');
      const pipelineEntries = pipelineEntriesRaw ? JSON.parse(pipelineEntriesRaw) : [];
      const match = Array.isArray(pipelineEntries) ? pipelineEntries.find((e: any) => e.projectCode === quoteRef) : null;
      if (match) {
        // Find existing quote by projectNumber
        const allQuotesRaw = cloudStorage.getItem('saltxc-all-quotes');
        const allQuotes = allQuotesRaw ? (Array.isArray(allQuotesRaw) ? allQuotesRaw : JSON.parse(allQuotesRaw)) : [];
        const existingByProject = allQuotes.find((q: any) => q.projectNumber === quoteRef);
        const resolvedId = existingByProject?.id;
        // Do not auto-create a new quote; only open if one exists
        if (!resolvedId) return;
        setEditingQuoteId(resolvedId);
        setCurrentView('quote-editor');
        return;
      }
    } catch (_err) {}

    // Fallback: open editor but warn
    alert('Could not locate a matching quote or pipeline project for this item.');
  };

  const handleDeleteQuote = (quoteId: string) => {
    try {
      // Check if quote is approved before allowing delete
      const quote = loadQuote(quoteId);
      if (quote && quote.status === 'approved') {
        alert('This quote has been approved and cannot be deleted.');
        return;
      }
      
      const success = deleteQuote(quoteId);
      if (success) {
        console.log('✅ Quote deleted successfully:', quoteId);
        // If we're currently editing the deleted quote, go back to dashboard
        if (editingQuoteId === quoteId) {
          setEditingQuoteId(null);
          setCurrentView('dashboard');
        }
      } else {
        console.error('❌ Failed to delete quote:', quoteId);
        alert('Failed to delete quote. Please try again.');
      }
    } catch (error) {
      console.error('❌ Error deleting quote:', error);
      alert('An error occurred while deleting the quote.');
    }
  };

  const handleBackToDashboard = () => {
    // Save current work before leaving the quote editor
    saveQuoteDataWithRef();
    setCurrentView('dashboard');
    setEditingQuoteId(null);
    // Force dashboard refresh
    setDashboardKey(prev => prev + 1);
    // Also refresh PM Dashboard in case user goes there next
    setPmDashboardKey(prev => prev + 1);
  };

  // Save quote data using ref (for auto-save to get latest data)
  const saveQuoteDataWithRef = (showConfirmation = false) => {
    if (!user || !project) {
      console.log('❌ Cannot save with ref: missing user or project', { user: !!user, project: !!project });
      return;
    }
    
    console.log('💾 Saving quote data with ref...', { 
      project: project.projectName, 
      phaseDataRefKeys: Object.keys(phaseDataRef.current),
      phaseDataRefEntries: Object.keys(phaseDataRef.current).length,
      showConfirmation 
    });
    
    try {
      const quoteId = saveQuote(
        project,
        phaseDataRef.current, // Use ref for latest data
        productionCostData,
        quoteReviewData,
        user.email,
        editingQuoteId || undefined
      );
      
      if (!editingQuoteId) {
        setEditingQuoteId(quoteId);
      }
      
      const now = new Date().toISOString();
      setLastSaved(now);
      
      if (showConfirmation) {
        // Create a temporary notification
        const notification = document.createElement('div');
        notification.textContent = '✅ Quote saved successfully with ref!';
        notification.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          background: #10b981;
          color: white;
          padding: 12px 20px;
          border-radius: 8px;
          z-index: 10000;
          font-family: 'Poppins', sans-serif;
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        `;
        document.body.appendChild(notification);
        
        setTimeout(() => {
          if (document.body.contains(notification)) {
            document.body.removeChild(notification);
          }
        }, 3000);
      }
    } catch (error) {
      console.error('Failed to save quote with ref:', error);
    }
  };

  // Save quote data to the quotes system
  const saveQuoteData = (showConfirmation = false) => {
    if (!user || !project) {
      console.log('❌ Cannot save: missing user or project', { user: !!user, project: !!project });
      return;
    }
    
    console.log('💾 Saving quote data...', { 
      project: project.projectName, 
      phaseDataKeys: Object.keys(phaseData),
      phaseDataEntries: Object.keys(phaseData).length,
      showConfirmation 
    });
    
    try {
      const quoteId = saveQuote(
        project,
        phaseData,
        productionCostData,
        quoteReviewData,
        user.email,
        editingQuoteId || undefined
      );
      
      if (!editingQuoteId) {
        setEditingQuoteId(quoteId);
      }
      
      const now = new Date().toISOString();
      setLastSaved(now);
      
      if (showConfirmation) {
        // Create a temporary notification
        const notification = document.createElement('div');
        notification.textContent = '✅ Quote saved successfully!';
        notification.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          background: #10b981;
          color: white;
          padding: 12px 20px;
          border-radius: 8px;
          z-index: 10000;
          font-family: 'Poppins', sans-serif;
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        `;
        document.body.appendChild(notification);
        
        // Remove notification after 3 seconds
        setTimeout(() => {
          document.body.removeChild(notification);
        }, 3000);
      }
    } catch (error) {
      console.error('Failed to save quote:', error);
      
      if (showConfirmation) {
        // Show error notification
        const notification = document.createElement('div');
        notification.textContent = '❌ Failed to save quote!';
        notification.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          background: #ef4444;
          color: white;
          padding: 12px 20px;
          border-radius: 8px;
          z-index: 10000;
          font-family: 'Poppins', sans-serif;
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        `;
        document.body.appendChild(notification);
        
        setTimeout(() => {
          document.body.removeChild(notification);
        }, 3000);
      }
    }
  };

  // Keep ref in sync with phaseData state
  useEffect(() => {
    phaseDataRef.current = phaseData;
    console.log('📚 phaseDataRef updated:', { 
      keys: Object.keys(phaseData),
      refKeys: Object.keys(phaseDataRef.current)
    });
  }, [phaseData]);

  // Auto-save when data changes
  useEffect(() => {
    if (project) {
      console.log('🕐 Auto-save timer started', { 
        projectName: project.projectName,
        phaseDataKeys: Object.keys(phaseData),
        phaseDataRefKeys: Object.keys(phaseDataRef.current),
        currentStep 
      });
      
      const timeoutId = setTimeout(() => {
        console.log('🔄 Auto-saving quote data...', { 
          phaseDataKeys: Object.keys(phaseData),
          phaseDataRefKeys: Object.keys(phaseDataRef.current),
          phaseDataEntries: Object.keys(phaseDataRef.current).length,
          phaseDataContent: phaseDataRef.current
        });
        saveQuoteDataWithRef();
      }, 1000); // Reduced to 1 second for more frequent auto-save

      return () => {
        console.log('⏸️ Auto-save timer cleared');
        clearTimeout(timeoutId);
      };
    }
  }, [project, phaseData, productionCostData, quoteReviewData, currentStep]);

  // Enhanced auto-save: Save on any data change (debounced)
  useEffect(() => {
    if (project && (Object.keys(phaseData).length > 0 || Object.keys(productionCostData).length > 0)) {
      console.log('🔄 Data change detected, starting debounced save...');
      
      const timeoutId = setTimeout(() => {
        console.log('🔄 Debounced auto-save triggered...');
        saveQuoteDataWithRef();
      }, 500); // Debounce to 500ms

      return () => {
        clearTimeout(timeoutId);
      };
    }
  }, [phaseData, productionCostData, quoteReviewData]);

  // Save data when user leaves the page or switches tabs
  useEffect(() => {
    const handlePageVisibilityChange = () => {
      if (document.hidden && project) {
        console.log('👋 Page hidden, saving data before user leaves...');
        saveQuoteDataWithRef();
      }
    };

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (project) {
        console.log('🚪 Page unloading, saving data...');
        // Storage writes are already handled by auto-save; nothing synchronous needed here
      }
    };

    document.addEventListener('visibilitychange', handlePageVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handlePageVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [project]);

  const handleProjectSave = (projectData: Project) => {
    console.log('🎯 handleProjectSave called with:', { projectData, currentStep });
    // Ensure phases is always an array for backward compatibility
    const safeProjectData = {
      ...projectData,
      phases: projectData.phases || []
    };
    
    // Preserve existing phase data where possible; initialize only new phases
    const updatedPhaseData: PhaseData = {};
    safeProjectData.phases.forEach(phase => {
      updatedPhaseData[phase] = phaseData[phase] || [];
    });
    
    setProject(safeProjectData);
    setPhaseData(updatedPhaseData);
    
    // Save the project data immediately with the new project data
    if (user) {
      try {
        const quoteId = saveQuote(
          safeProjectData,
          updatedPhaseData,
          productionCostData,
          quoteReviewData,
          user.email,
          editingQuoteId || undefined
        );
        
        if (!editingQuoteId) {
          setEditingQuoteId(quoteId);
        }
        
        const now = new Date().toISOString();
        setLastSaved(now);
        
        // Show success notification
        const notification = document.createElement('div');
        notification.textContent = '✅ Project saved successfully!';
        notification.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          background: #10b981;
          color: white;
          padding: 12px 20px;
          border-radius: 8px;
          z-index: 10000;
          font-family: 'Poppins', sans-serif;
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        `;
        document.body.appendChild(notification);
        
        setTimeout(() => {
          document.body.removeChild(notification);
        }, 3000);
        
      } catch (error) {
        console.error('Failed to save project:', error);
      }
    }
    
    console.log('🚀 Navigating to Project Fees step');
    setCurrentStep('project-fees');
    console.log('📍 setCurrentStep called with project-fees');
  };

  const handleProjectSaveOnly = (projectData: Project) => {
    // Ensure phases is always an array for backward compatibility
    const safeProjectData = {
      ...projectData,
      phases: projectData.phases || []
    };
    
    // Preserve existing phase data where possible; initialize only new phases
    const updatedPhaseData: PhaseData = {};
    safeProjectData.phases.forEach(phase => {
      updatedPhaseData[phase] = phaseData[phase] || [];
    });
    
    setProject(safeProjectData);
    setPhaseData(updatedPhaseData);
    
    // Save the project data immediately with the new project data
    if (user) {
      try {
        const quoteId = saveQuote(
          safeProjectData,
          updatedPhaseData,
          productionCostData,
          quoteReviewData,
          user.email,
          editingQuoteId || undefined
        );
        
        if (!editingQuoteId) {
          setEditingQuoteId(quoteId);
        }
        
        const now = new Date().toISOString();
        setLastSaved(now);
        
        // Show success notification
        const notification = document.createElement('div');
        notification.textContent = '✅ Quote saved successfully!';
        notification.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          background: #10b981;
          color: white;
          padding: 12px 20px;
          border-radius: 8px;
          z-index: 10000;
          font-family: 'Poppins', sans-serif;
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        `;
        document.body.appendChild(notification);
        
        setTimeout(() => {
          document.body.removeChild(notification);
        }, 3000);
        
      } catch (error) {
        console.error('Failed to save project:', error);
      }
    }
    
    // Don't change the step - stay on current step
  };

  // Manual save functions with confirmation
  const handleProjectFeesSave = () => {
    console.log('💾 Manual save triggered for Project Fees', { 
      phaseDataKeys: Object.keys(phaseData),
      phaseDataRefKeys: Object.keys(phaseDataRef.current),
      phaseDataEntries: Object.keys(phaseData).length,
      phaseDataRefEntries: Object.keys(phaseDataRef.current).length,
      fullPhaseData: phaseData,
      fullPhaseDataRef: phaseDataRef.current
    });
    saveQuoteDataWithRef(true);
  };

  const handleProductionCostsSave = () => {
    saveQuoteDataWithRef(true);
  };

  const handleQuoteReviewSave = (reviewData: QuoteReviewData) => {
    console.log('📋 Main app handleQuoteReviewSave - received data:', {
      projectScope: reviewData.projectScope,
      descriptionsCount: Object.keys(reviewData.descriptions || {}).length,
      invoiceItemsCount: reviewData.invoiceItems?.length || 0,
      invoiceItems: reviewData.invoiceItems
    });
    setQuoteReviewData(reviewData);
    saveQuoteDataWithRef(true);
  };

  const handleBackToSetup = () => {
    // Auto-save before navigating back to setup
    saveQuoteDataWithRef();
    setCurrentStep('setup');
  };

  const handleProjectFeesComplete = () => {
    // Auto-save before navigating to production costs
    console.log('➡️ Project Fees Complete - navigating to production costs', { phaseData });
    saveQuoteDataWithRef();
    setCurrentStep('production-costs');
  };

  const handleBackToProjectFees = () => {
    // Auto-save before navigating back to project fees
    saveQuoteDataWithRef();
    setCurrentStep('project-fees');
  };

  const handleToReview = () => {
    // Auto-save before navigating to review
    saveQuoteDataWithRef();
    setCurrentStep('review');
  };

  const handleBackToProductionCosts = () => {
    // Auto-save before navigating back to production costs
    saveQuoteDataWithRef();
    setCurrentStep('production-costs');
  };

  if (user && !storageReady) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-lg font-medium text-gray-800">Loading your data…</p>
          <p className="text-sm text-gray-500">Hang tight while we sync your workspace.</p>
        </div>
      </div>
    );
  }

  // Render different views based on current state
  if (currentView === 'login') {
    return <Login onLogin={handleLogin} onShowSignUp={handleShowSignUp} />;
  }

  if (currentView === 'signup') {
    return <SignUp onSignUp={handleSignUp} onBackToLogin={handleBackToLogin} />;
  }

  if (currentView === 'tools-selection') {
    return (
      <ToolsSelection
        user={user!}
        onLogout={handleLogout}
        onSelectQuoteHub={handleSelectQuoteHub}
        onSelectProjectManagement={handleSelectProjectManagement}
        onSelectPipeline={handleSelectPipeline}
        onSelectThreeInOne={handleSelectThreeInOne}
        onUserViewChange={setUserView}
      />
    );
  }

  if (currentView === 'dashboard') {
    return (
      <Dashboard
        key={dashboardKey}
        user={user!}
        onLogout={handleLogout}
        onCreateNewQuote={handleCreateNewQuote}
        onEditQuote={handleEditQuote}
        onDeleteQuote={handleDeleteQuote}
        onBackToHub={() => setCurrentView('tools-selection')}
      />
    );
  }

  if (currentView === 'project-management') {
    return (
      <ProjectManagement
        user={user!}
        onLogout={handleLogout}
        selectedQuoteId={pmSelectedQuoteId || undefined}
        onBackToDashboard={() => {
          if (scrollTaskId) {
            // Came from Person Dashboard
            setCurrentView('person-dashboard');
          } else {
            setCurrentView('project-management-hub');
          }
          setScrollTaskId(null);
        }}
        onOpenPerson={handleOpenPerson}
        scrollToTaskId={scrollTaskId || undefined}
      />
    );
  }

  if (currentView === 'project-management-hub') {
    return (
      <PMDashboard
        key={pmDashboardKey}
        user={user!}
        onLogout={handleLogout}
        onBackToHub={() => setCurrentView('tools-selection')}
        onOpenProject={handleOpenPMProject}
        onCreateNew={() => setCurrentView('quote-editor')}
        onOpenPerson={handleOpenPerson}
        onOpenProjectWithData={handleOpenProjectWithData}
        userView={userView}
        onUserViewChange={setUserView}
      />
    );
  }
  if (currentView === 'person-dashboard') {
    return (
      <PersonDashboard
        user={user!}
        onLogout={handleLogout}
        onBackToHub={() => setCurrentView('project-management-hub')}
        personName={personName}
        onOpenProjectTask={handleOpenProjectTask}
      />
    );
  }

  if (currentView === 'pipeline') {
    return (
      <Pipeline
        user={user!}
        onLogout={handleLogout}
        onBack={() => setCurrentView('tools-selection')}
        userView={userView}
      />
    );
  }

  if (currentView === 'three-in-one') {
    return (
      <ThreeInOne
        user={user!}
        onLogout={handleLogout}
        onBackToHub={() => setCurrentView('tools-selection')}
        userView={userView}
        onUserViewChange={setUserView}
      />
    );
  }


  if (currentView === 'quote-editor') {
    return (
      <div className="min-h-screen bg-white font-sans">
        {/* Branded Header */}
        <BrandedHeader 
          user={user}
          showBackButton={false}
          onBackClick={handleBackToDashboard}
          lastSaved={lastSaved}
          showSidebar={true}
        />
        
        <div className="flex">
          {/* Sidebar Navigation */}
          <div className="fixed left-0 top-0 w-64 bg-blue-50 border-r border-blue-200 h-screen p-4 flex-shrink-0 overflow-y-auto">
            {/* Logo and Title */}
            <div className="mb-4 flex flex-col items-center gap-1">
              <img src="/salt-logo.png" alt="Salt Logo" className="h-12 w-auto" />
              <h1 className="text-lg font-semibold text-gray-800">Quote Hub</h1>
            </div>
            
            {/* Dashboard Button */}
            <button
              onClick={handleBackToDashboard}
              className="w-full mb-4 px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-blue-100 rounded-lg transition-colors text-center"
            >
              ← Salt XC Hub
            </button>
            
            <div className="space-y-2">
              <button
                onClick={() => {
                  saveQuoteDataWithRef();
                  setCurrentStep('setup');
                }}
                className={`w-full text-left px-4 py-3 rounded-lg font-medium text-sm transition-colors ${
                  currentStep === 'setup'
                    ? 'bg-white text-black shadow-sm'
                    : 'text-blue-800 hover:bg-blue-100'
                }`}
              >
                Step 1: Project Setup
              </button>
              
              <button
                onClick={() => {
                  if (project) {
                    saveQuoteDataWithRef();
                    setCurrentStep('project-fees');
                  }
                }}
                disabled={!project}
                className={`w-full text-left px-4 py-3 rounded-lg font-medium text-sm transition-colors ${
                  currentStep === 'project-fees'
                    ? 'bg-white text-black shadow-sm'
                    : !project
                    ? 'text-blue-400 cursor-not-allowed opacity-50'
                    : 'text-blue-800 hover:bg-blue-100'
                }`}
              >
                Step 2: Project Fees
              </button>
              
              <button
                onClick={() => {
                  if (project) {
                    saveQuoteDataWithRef();
                    setCurrentStep('production-costs');
                  }
                }}
                disabled={!project}
                className={`w-full text-left px-4 py-3 rounded-lg font-medium text-sm transition-colors ${
                  currentStep === 'production-costs'
                    ? 'bg-white text-black shadow-sm'
                    : !project
                    ? 'text-blue-400 cursor-not-allowed opacity-50'
                    : 'text-blue-800 hover:bg-blue-100'
                }`}
              >
                Step 3: Production Costs
              </button>
              
              <button
                onClick={() => {
                  if (project) {
                    saveQuoteDataWithRef();
                    setCurrentStep('review');
                  }
                }}
                disabled={!project}
                className={`w-full text-left px-4 py-3 rounded-lg font-medium text-sm transition-colors ${
                  currentStep === 'review'
                    ? 'bg-white text-black shadow-sm'
                    : !project
                    ? 'text-blue-400 cursor-not-allowed opacity-50'
                    : 'text-blue-800 hover:bg-blue-100'
                }`}
              >
                Step 4: Quote Review
              </button>
            </div>

            {/* Save Quote Button */}
            <div className="mt-6 pt-6 border-t border-blue-200">
              <button
                onClick={() => {
                  saveQuoteDataWithRef();
                  alert('Quote saved successfully!');
                }}
                disabled={!project}
                className={`w-full px-4 py-3 rounded-lg font-medium text-sm transition-colors ${
                  !project
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-black text-white hover:bg-gray-800'
                }`}
              >
                Save Quote
              </button>
              {lastSaved && (
                <div className="mt-2 text-xs text-gray-500 text-center">
                  Last saved: {new Date(lastSaved).toLocaleTimeString()}
                </div>
              )}
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 overflow-auto ml-64">
            <div className="container mx-auto px-4 py-8">
              {currentStep === 'setup' && (
                <ProjectSetup 
                  onSave={handleProjectSave} 
                  onSaveOnly={handleProjectSaveOnly}
                  initialProject={project} 
                />
              )}

              {currentStep === 'project-fees' && project && (
                <PlanningPhase 
                  project={{
                    ...project,
                    phases: project.phases || []
                  }}
                  phaseData={phaseData}
                  setPhaseData={(newPhaseData) => {
                    console.log('📡 Main app setPhaseData called:', { 
                      type: typeof newPhaseData === 'function' ? 'function' : 'object',
                      keys: typeof newPhaseData === 'function' ? 'N/A' : Object.keys(newPhaseData)
                    });
                    setPhaseData(newPhaseData);
                  }}
                  onBack={handleBackToSetup}
                  onNext={handleProjectFeesComplete}
                  onSave={handleProjectFeesSave}
                />
              )}

              {currentStep === 'production-costs' && project && (
                <ProductionCosts 
                  project={project}
                  productionData={productionCostData}
                  setProductionData={setProductionCostData}
                  onBack={handleBackToProjectFees}
                  onSave={handleProductionCostsSave}
                  onNext={handleToReview}
                />
              )}

              {currentStep === 'review' && project && (
                <QuoteReview
                  project={project}
                  phaseData={phaseData}
                  productionData={productionCostData}
                  quoteReviewData={quoteReviewData}
                  onBack={handleBackToProductionCosts}
                  onEdit={(step) => setCurrentStep(step)}
                  onSave={handleQuoteReviewSave}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
