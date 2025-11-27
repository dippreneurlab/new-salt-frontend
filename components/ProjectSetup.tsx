'use client';

import { useMemo, useState, useEffect } from 'react';
import { Project, PhaseSettings } from '../types';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  generateNextProjectNumber,
  isPipelineProjectNumber 
} from '../utils/pipelineUtils';
import { cloudStorage } from '@/lib/cloudStorage';

interface ProjectSetupProps {
  onSave: (project: Project) => void;
  onSaveOnly: (project: Project) => void;
  initialProject?: Project | null;
}

const CLIENT_CATEGORIES = [
  'Category 1 - Foundational',
  'Category 2 - Core Partners', 
  'Category 3 - Prospective Growth',
  'Category 4 - Service Anchors',
  'Category 5 - Baseline Booster'
];

import { DEFAULT_clientOptions, DEFAULT_RATE_CARD_MAP } from '../utils/pipelineUtils';
import { usePipelineMetadata } from '@/hooks/usePipelineMetadata';

const PHASES = [
  'Planning',
  'Production/Execution',
  'Post Production/Wrap'
];

// Rate card options based on Salt Rate Card 2025
const RATE_CARDS = [
  'Labatt',
  'RBC', 
  'Toyota Retainer',
  'Hershey Retainer',
  'ABI',
  'Rogers',
  'Standard',
  'Blended'
];

// Currency options
const CURRENCIES = [
  'CAD',
  'USD'
];

// Rate mapping based on rate card selection (using average rates from the CSV)
const RATE_MAPPING: Record<string, number> = {
  'Labatt': 150,
  'RBC': 85,
  'Toyota Retainer': 160,
  'Hershey Retainer': 140,
  'ABI': 185,
  'Rogers': 200,
  'Standard': 170,
  'Blended': 165
};

const BUDGET_TYPES = [
  'Net New',
  'Scope Adjustment'
];

export default function ProjectSetup({ onSave, onSaveOnly, initialProject }: ProjectSetupProps) {
  const [formData, setFormData] = useState<Project>({
    projectNumber: '',
    clientName: '',
    clientCategory: '',
    brand: '',
    projectName: '',
    startDate: '',
    endDate: '',
    totalProgramBudget: 0,
    rateCard: 'Standard',
    currency: 'CAD',
    phases: [],
    phaseSettings: {},
    budgetLabel: 'Net New' // Default budget type
  });

  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const { metadata } = usePipelineMetadata();
  const clientOptions = useMemo(
    () => (metadata.clients?.length ? metadata.clients : DEFAULT_clientOptions),
    [metadata.clients]
  );
  const rateCardMap = useMemo(
    () => (metadata.rateCardMap && Object.keys(metadata.rateCardMap).length ? metadata.rateCardMap : DEFAULT_RATE_CARD_MAP),
    [metadata.rateCardMap]
  );

  // Populate form data when initialProject is provided (for editing existing quotes)
  // Reset form data when initialProject is null (for new quotes)
  useEffect(() => {
    if (initialProject) {
      console.log('📝 Populating ProjectSetup form with existing data:', { 
        projectName: initialProject.projectName,
        rateCard: initialProject.rateCard,
        clientName: initialProject.clientName,
        currency: initialProject.currency,
        fullProject: initialProject
      });

      const autoRateCard = rateCardMap[initialProject.clientName] || initialProject.rateCard || 'Standard';
      const startDate = (initialProject as any).startDate || (initialProject as any).inMarketDate || '';
      const endDate = (initialProject as any).endDate || (initialProject as any).projectCompletionDate || '';

      const filled = {
        ...initialProject,
        clientCategory: '', // No longer used
        rateCard: autoRateCard,
        startDate,
        endDate
      } as typeof formData;

      console.log('🔍 Setting formData with auto-filled fields:', filled);
      setFormData(filled);
      setIsInitialLoad(false); // Mark as loaded
    } else {
      console.log('🆕 No initialProject provided - resetting form for new quote');
      setFormData({
        projectNumber: '',
        clientName: '',
        clientCategory: '',
        brand: '',
        projectName: '',
        startDate: '',
        endDate: '',
        totalProgramBudget: 0,
        rateCard: 'Standard',
        currency: 'CAD',
        phases: [],
        phaseSettings: {},
        budgetLabel: 'Planning'
      });
      setIsInitialLoad(false); // Mark as ready for new quote
    }
  }, [initialProject, rateCardMap]);

  // Debug: Monitor formData changes
  useEffect(() => {
    console.log('🔍 FormData changed:', {
      currency: formData.currency,
      rateCard: formData.rateCard,
      clientName: formData.clientName,
      isInitialLoad,
      timestamp: new Date().toISOString()
    });
  }, [formData.currency, formData.rateCard, formData.clientName, isInitialLoad]);

  // Debug: Monitor currency field specifically
  useEffect(() => {
    console.log('💰 Currency field changed:', {
      currency: formData.currency,
      isInitialLoad,
      initialProject: !!initialProject,
      initialProjectCurrency: initialProject?.currency,
      timestamp: new Date().toISOString()
    });
  }, [formData.currency, isInitialLoad, initialProject]);

  // Auto-save form data changes after a delay to prevent loss of data
  // Skip auto-save during initial load to prevent overwriting loaded data
  useEffect(() => {
    console.log('🔍 Auto-save useEffect triggered:', {
      isInitialLoad,
      hasFormData: !!formData,
      phases: formData.phases,
      budgetLabel: formData.budgetLabel
    });
    
    if (!isInitialLoad) {
      const timeoutId = setTimeout(() => {
        console.log('🔄 Auto-saving ProjectSetup changes...', {
          currency: formData.currency,
          rateCard: formData.rateCard,
          clientName: formData.clientName,
          phases: formData.phases,
          budgetLabel: formData.budgetLabel,
          fullFormData: formData
        });
        // Always auto-save, even if form is not fully valid
        // This ensures phases and partial progress are saved
        onSaveOnly(formData);
        console.log('✅ Called onSaveOnly with formData');
      }, 1000); // Auto-save after 1 second of inactivity

      return () => {
        console.log('🧹 Clearing auto-save timeout');
        clearTimeout(timeoutId);
      };
    } else {
      console.log('⏸️ Skipping auto-save (still in initial load)');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData, isInitialLoad]);

  const [errors, setErrors] = useState<Partial<Record<keyof Project, string>>>({});

  // Real-time date validation helper
  const validateDatesOnly = (data: typeof formData) => {
    const dateErrors: Partial<Record<keyof Project, string>> = {};
    
    if (data.startDate && data.endDate) {
      const startDate = new Date(data.startDate);
      const endDate = new Date(data.endDate);
      
      // Check that end date is after start date
      if (startDate >= endDate) {
        dateErrors.endDate = 'End date must be after start date';
      }
    }
    
    return dateErrors;
  };

  const validateForm = () => {
    const newErrors: Partial<Record<keyof Project, string>> = {};
    
    // Required field validation
    if (!formData.projectNumber) newErrors.projectNumber = 'Project number is required';
    if (!formData.clientName) newErrors.clientName = 'Client name is required';
    if (!formData.brand) newErrors.brand = 'Brand is required';
    if (!formData.projectName) newErrors.projectName = 'Project name is required';
    if (!formData.startDate) newErrors.startDate = 'Start date is required';
    if (!formData.endDate) newErrors.endDate = 'End date is required';
    if (!formData.rateCard) newErrors.rateCard = 'Rate card selection is required';
    if (!formData.phases || formData.phases.length === 0) newErrors.phases = 'At least one phase must be selected';
    
    // Date validation (only if both dates are provided)
    if (formData.startDate && formData.endDate) {
      const startDate = new Date(formData.startDate);
      const endDate = new Date(formData.endDate);
      
      if (startDate >= endDate) {
        newErrors.endDate = 'End date must be after start date';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Silent validation for auto-save (doesn't set error state)
  const validateFormSilent = (): boolean => {
    const newErrors: Partial<Record<keyof Project, string>> = {};

    // Required field validation
    if (!formData.projectNumber.trim()) newErrors.projectNumber = 'Project number is required';
    if (!formData.clientName.trim()) newErrors.clientName = 'Client is required';
    if (!formData.brand.trim()) newErrors.brand = 'Brand is required';
    if (!formData.projectName.trim()) newErrors.projectName = 'Project name is required';
    if (!formData.startDate) newErrors.startDate = 'Start date is required';
    if (!formData.endDate) newErrors.endDate = 'End date is required';
    if (!formData.rateCard) newErrors.rateCard = 'Rate card is required';
    if (!formData.phases || formData.phases.length === 0) newErrors.phases = 'At least one phase is required';

    // Date validation
    const dateErrors = validateDatesOnly(formData);
    Object.assign(newErrors, dateErrors);

    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('💾 ProjectSetup handleSubmit called:', { formData, onSave: typeof onSave });
    if (validateForm()) {
      console.log('✅ ProjectSetup validation passed, calling onSave');
      try {
        onSave(formData);
        console.log('✅ onSave called successfully');
      } catch (error) {
        console.error('❌ Error calling onSave:', error);
      }
    } else {
      console.log('❌ ProjectSetup validation failed', { errors });
    }
  };

  const handleInputChange = (field: keyof Project, value: string | number) => {
    console.log('🔄 ProjectSetup field change:', { field, value, currentFormData: formData });
    let newData = { ...formData, [field]: value };
    
    // Auto-populate rate card and currency when client is selected
    if (field === 'clientName' && value && typeof value === 'string') {
      const suggestedRateCard = rateCardMap[value] || 'Standard';
      
      // Get currency based on billing entity
      let currency = 'CAD'; // default
      try {
        const savedClientSettings = cloudStorage.getItem('pipeline-client-settings');
        if (savedClientSettings) {
          const clientSettings = JSON.parse(savedClientSettings);
          const clientSetting = clientSettings.find((c: any) => c.name === value);
          if (clientSetting) {
            // If billing entity is US, use USD, otherwise use CAD
            currency = clientSetting.billingEntity === 'Salt XC US' ? 'USD' : 'CAD';
          }
        }
      } catch (err) {
        console.error('Failed to load client settings for currency selection:', err);
      }
      
      console.log('🎯 Auto-populating for client:', {
        clientName: value,
        suggestedRateCard,
        currency,
        foundInRateCardMap: !!rateCardMap[value],
        usingDefault: !rateCardMap[value]
      });
      
      // Always update the rate card and currency
      newData = {
        ...newData,
        rateCard: suggestedRateCard,
        currency
      };
      
      // Clear errors since they're now auto-populated
      setErrors(prev => ({ 
        ...prev, 
        rateCard: undefined 
      }));
    } else if (field === 'clientName') {
      console.log('⚠️ No auto-population for client (empty value):', { clientName: value });
    }
    
    setFormData(newData);
    
    // Clear current field error
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
    
    // Perform real-time date validation for date fields
    if (field === 'startDate' || field === 'endDate') {
      const dateErrors = validateDatesOnly(newData);
      setErrors(prev => ({
        ...prev,
        // Only update date errors, preserve required field errors for empty dates
        startDate: prev.startDate?.includes('required') ? prev.startDate : undefined,
        endDate: dateErrors.endDate || (prev.endDate?.includes('required') ? prev.endDate : undefined)
      }));
    }
  };



  const handlePhaseToggle = (phase: string) => {
    console.log('🔄 Phase toggle called:', { phase, currentPhases: formData.phases });
    
    const currentPhases = formData.phases || [];
    const isSelected = currentPhases.includes(phase);
    
    let newPhases: string[];
      const newPhaseSettings = { ...formData.phaseSettings };
    
    if (isSelected) {
      newPhases = currentPhases.filter(p => p !== phase);
      // Remove phase settings when phase is deselected
      delete newPhaseSettings[phase];
      console.log('➖ Deselecting phase:', { phase, newPhases });
    } else {
      newPhases = [...currentPhases, phase];
      // Add default phase settings when phase is selected
      newPhaseSettings[phase] = {
        includeProjectFees: true,
        includeProductionCosts: false
      };
      console.log('➕ Selecting phase:', { phase, newPhases, settings: newPhaseSettings[phase] });
    }
    
    const updatedFormData = { 
      ...formData, 
      phases: newPhases,
      phaseSettings: newPhaseSettings
    };
    
    console.log('💾 Updating formData with new phases:', {
      oldPhases: formData.phases,
      newPhases,
      newPhaseSettings
    });
    
    setFormData(updatedFormData);
    
    if (errors.phases && newPhases.length > 0) {
      setErrors(prev => ({ ...prev, phases: undefined }));
    }
  };

  const handlePhaseSettingToggle = (phase: string, setting: 'includeProjectFees' | 'includeProductionCosts') => {
    setFormData(prev => ({
      ...prev,
      phaseSettings: {
        ...prev.phaseSettings,
        [phase]: {
          ...prev.phaseSettings[phase],
          [setting]: !prev.phaseSettings[phase]?.[setting]
        }
      }
    }));
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header removed per request */}

      <Card className="border-0 shadow-none">
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Budget Type Selection */}
            <div className="space-y-2 p-4 bg-[#eef1fc] border border-gray-200 rounded-lg">
              <Label htmlFor="budgetType" className="text-gray-700">Budget Type *</Label>
              <Select 
                value={formData.budgetLabel || 'Net New'} 
                onValueChange={(value) => handleInputChange('budgetLabel', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select budget type" />
                </SelectTrigger>
                <SelectContent>
                  {BUDGET_TYPES.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-600">
                Select the type of budget you're creating for this project
              </p>
            </div>

            {/* Project Number */}
            <div className="space-y-2">
              <Label htmlFor="projectNumber">Project Number *</Label>
              <Input
                id="projectNumber"
                type="text"
                value={formData.projectNumber}
                onChange={(e) => handleInputChange('projectNumber', e.target.value)}
                placeholder="e.g., P20001, PRJ-2025-001"
                className={errors.projectNumber ? 'border-red-500' : ''}
              />
              {errors.projectNumber && (
                <p className="text-sm text-red-600">{errors.projectNumber}</p>
              )}
            </div>

            {/* Client Name */}
            <div className="space-y-2">
              <Label htmlFor="clientName">Client Name *</Label>
              <Select
                value={formData.clientName}
                onValueChange={(value) => handleInputChange('clientName', value)}
              >
                <SelectTrigger className={errors.clientName ? 'border-red-500' : ''}>
                  <SelectValue placeholder="Select a client" />
                </SelectTrigger>
                <SelectContent>
                  {clientOptions.map(client => (
                    <SelectItem key={client} value={client}>{client}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.clientName && (
                <p className="text-sm text-red-600">{errors.clientName}</p>
              )}
            </div>

            {/* Brand */}
            <div className="space-y-2">
              <Label htmlFor="brand">Brand *</Label>
              <Input
                id="brand"
                type="text"
                value={formData.brand}
                onChange={(e) => handleInputChange('brand', e.target.value)}
                placeholder="Enter brand name"
                className={errors.brand ? 'border-red-500' : ''}
              />
              {errors.brand && (
                <p className="text-sm text-red-600">{errors.brand}</p>
              )}
            </div>

            {/* Project Name */}
            <div className="space-y-2">
              <Label htmlFor="projectName">Project Name *</Label>
              <Input
                id="projectName"
                type="text"
                value={formData.projectName}
                onChange={(e) => handleInputChange('projectName', e.target.value)}
                placeholder="Enter project name"
                className={errors.projectName ? 'border-red-500' : ''}
              />
              {errors.projectName && (
                <p className="text-sm text-red-600">{errors.projectName}</p>
              )}
            </div>

            {/* Rate Card and Currency */}
            <div className="grid grid-cols-2 gap-4">
              {/* Rate Card */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="rateCard">Rate Card *</Label>
                  {formData.clientName && formData.rateCard && (
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      rateCardMap[formData.clientName] && rateCardMap[formData.clientName] !== 'Standard'
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {rateCardMap[formData.clientName] && rateCardMap[formData.clientName] !== 'Standard'
                        ? '✓ Client-specific' 
                        : '○ Standard default'
                      }
                    </span>
                  )}
                </div>
                <Select
                  value={formData.rateCard}
                  onValueChange={(value) => handleInputChange('rateCard', value)}
                >
                  <SelectTrigger className={`${errors.rateCard ? 'border-red-500' : ''} ${
                    formData.clientName && formData.rateCard ? (
                      rateCardMap[formData.clientName] && rateCardMap[formData.clientName] !== 'Standard'
                        ? 'bg-green-50 border-green-200' 
                        : 'bg-blue-50 border-blue-200'
                    ) : ''
                  }`}>
                    <SelectValue placeholder="Select rate card" />
                  </SelectTrigger>
                  <SelectContent>
                    {RATE_CARDS.map(rateCard => (
                      <SelectItem key={rateCard} value={rateCard}>{rateCard}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formData.clientName && formData.rateCard && (
                  <p className={`text-xs ${
                    rateCardMap[formData.clientName] && rateCardMap[formData.clientName] !== 'Standard'
                      ? 'text-green-600' 
                      : 'text-blue-600'
                  }`}>
                    {rateCardMap[formData.clientName] && rateCardMap[formData.clientName] !== 'Standard'
                      ? `${formData.rateCard} rate card automatically selected for ${formData.clientName}`
                      : `Using Standard rate card (default for ${formData.clientName})`
                    }
                  </p>
                )}
                {errors.rateCard && (
                  <p className="text-sm text-red-600">{errors.rateCard}</p>
                )}
              </div>

              {/* Currency */}
              <div className="space-y-2">
                <Label htmlFor="currency">Currency *</Label>
                <Select
                  value={formData.currency}
                  onValueChange={(value) => handleInputChange('currency', value)}
                  disabled={isPipelineProjectNumber(formData.projectNumber)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map(currency => (
                      <SelectItem key={currency} value={currency}>
                        {currency}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isPipelineProjectNumber(formData.projectNumber) && (
                  <p className="text-xs text-gray-500">Currency is auto-selected based on client billing entity</p>
                )}
              </div>
            </div>

            {/* Date Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date *</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => handleInputChange('startDate', e.target.value)}
                  className={errors.startDate ? 'border-red-500' : ''}
                />
                <p className="text-xs text-muted-foreground">When the project begins</p>
                {errors.startDate && (
                  <p className="text-sm text-red-600">{errors.startDate}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="endDate">End Date *</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => handleInputChange('endDate', e.target.value)}
                  className={errors.endDate ? 'border-red-500' : ''}
                />
                <p className="text-xs text-muted-foreground">When the project ends</p>
                {errors.endDate && (
                  <p className="text-sm text-red-600">{errors.endDate}</p>
                )}
              </div>
            </div>

            {/* Phases Selection */}
            <div className="space-y-3">
              <Label className="text-base font-medium">Project Phases to Quote *</Label>
              <p className="text-sm text-muted-foreground">
                Select which phases you want to include in your quote
              </p>
              <div className="space-y-4">
                {PHASES.map((phase) => (
                  <div key={phase} className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={phase}
                        checked={formData.phases?.includes(phase) || false}
                        onCheckedChange={() => handlePhaseToggle(phase)}
                        className={errors.phases ? 'border-red-500' : ''}
                      />
                      <Label 
                        htmlFor={phase} 
                        className="text-sm font-medium cursor-pointer flex-1"
                      >
                        {phase}
                      </Label>
                    </div>
                    
                    {/* Phase Settings - only show if phase is selected */}
                    {formData.phases?.includes(phase) && (
                      <div className="ml-6 space-y-2 p-3 bg-muted/20 rounded-md border-l-2 border-blue-300">
                        <p className="text-xs font-medium text-muted-foreground">What to include for this phase:</p>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`${phase}-fees`}
                            checked={formData.phaseSettings[phase]?.includeProjectFees || false}
                            onCheckedChange={() => handlePhaseSettingToggle(phase, 'includeProjectFees')}
                          />
                          <Label htmlFor={`${phase}-fees`} className="text-xs cursor-pointer">
                            Project Fees
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`${phase}-costs`}
                            checked={formData.phaseSettings[phase]?.includeProductionCosts || false}
                            onCheckedChange={() => handlePhaseSettingToggle(phase, 'includeProductionCosts')}
                          />
                          <Label htmlFor={`${phase}-costs`} className="text-xs cursor-pointer">
                            Production Costs
                          </Label>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {errors.phases && (
                  <p className="text-sm text-red-600">{errors.phases}</p>
                )}
              </div>
              {formData.phases && formData.phases.length > 0 && (
                <div className="mt-3 p-3 bg-muted/30 rounded-md">
                  <p className="text-sm text-muted-foreground">
                    Selected phases: <span className="font-medium">{formData.phases.join(', ')}</span>
                  </p>
                </div>
              )}
            </div>

          </form>
        </CardContent>
      </Card>
    </div>
  );
}
