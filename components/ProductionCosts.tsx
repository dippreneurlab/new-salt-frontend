'use client';

import { useState, useEffect, type Dispatch, type SetStateAction } from 'react';
import { Project } from '../types';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from '../utils/currency';

// Helper function to get phase colors - matching Project Fees format
const getPhaseColor = (phase: string) => {
  const normalizedPhase = phase.toLowerCase();
  if (normalizedPhase.includes('planning')) return 'text-[#183f9d]';
  // Check post before production so "post production" does not match production first
  if (normalizedPhase.includes('post') || normalizedPhase.includes('wrap')) return 'text-[#7e2e0b]';
  if (normalizedPhase.includes('production') || normalizedPhase.includes('execution')) return 'text-[#554511]';
  return 'text-[#183f9d]'; // default
};

// Helper function to get phase background colors
const getPhaseBackgroundColor = (phase: string) => {
  const normalizedPhase = phase.toLowerCase();
  if (normalizedPhase.includes('planning')) return 'bg-[#EDF0FE]';
  // Check post before production so "post production" does not match production first
  if (normalizedPhase.includes('post') || normalizedPhase.includes('wrap')) return 'bg-[#f7c3ac]';
  if (normalizedPhase.includes('production') || normalizedPhase.includes('execution')) return 'bg-[#fdf0cd]';
  return 'bg-[#EDF0FE]'; // default
};

const getPhaseBorderColor = (phase: string) => {
  const normalizedPhase = phase.toLowerCase();
  if (normalizedPhase.includes('planning')) return 'border-gray-200'; // Light gray border for planning
  return 'border-blue-300'; // Blue border for production and post-production
};

const getPhaseAccentColor = (phase: string) => {
  // All phases use the same accent color as Project Fees
  return 'text-blue-700';
};

interface ProductionCostsProps {
  project: Project;
  productionData: ProductionData;
  setProductionData: Dispatch<SetStateAction<ProductionData>>;
  onBack: () => void;
  onSave: () => void;
  onNext?: () => void;
}

// Production cost categories
const PRODUCTION_CATEGORIES = [
  'Field Staff',
  'Studio', 
  'Decor',
  'Equipment',
  'Technology',
  'Printing & Signage',
  'Training and Recruitment',
  'Giveaways and Premiums',
  'Travel and Expenses',
  'Storage',
  'Vehicle Rental',
  'Media Billings',
  'Creator Fees',
  'Platforms and Licensing',
  'Measurement',
  'Contingency'
];

// Field staff rates from CSV
const FIELD_STAFF_RATES: { [key: string]: { [key: string]: number } } = {
  'Labatt': {
    'Brand Ambassador - no certification': 49.25,
    'Brand Ambassador - w/ certification': 53.30,
    'Team Lead': 60.75,
    'Festival Brand Ambassador - no certification': 54.25,
    'Festival Brand Ambassador - w/ certification': 58.30,
    'Festival Team Lead': 65.75,
    'BRIKA Retail Sales Associate': 28.60,
    'Brika Store manager': 34.13,
    'Field Representative': 60.00,
    'Other (mascot etc.)': 87.75
  },
  'RBC': {
    'Brand Ambassador - no certification': 49.25,
    'Brand Ambassador - w/ certification': 53.30,
    'Team Lead': 60.75,
    'Festival Brand Ambassador - no certification': 54.25,
    'Festival Brand Ambassador - w/ certification': 58.30,
    'Festival Team Lead': 65.75,
    'BRIKA Retail Sales Associate': 28.60,
    'Brika Store manager': 34.13,
    'Field Representative': 35.00,
    'Other (mascot etc.)': 87.75
  },
  'Blended': {
    'Brand Ambassador - no certification': 49.25,
    'Brand Ambassador - w/ certification': 53.30,
    'Team Lead': 60.75,
    'Festival Brand Ambassador - no certification': 54.25,
    'Festival Brand Ambassador - w/ certification': 58.30,
    'Festival Team Lead': 65.75,
    'BRIKA Retail Sales Associate': 28.60,
    'Brika Store manager': 34.13,
    'Field Representative': 60.00,
    'Other (mascot etc.)': 87.75
  }
};

// Field staff role options
const FIELD_STAFF_ROLES = Object.keys(FIELD_STAFF_RATES.Labatt);

// Standard cost item interface
interface StandardCostItem {
  id: string;
  item: string;
  quantity: number;
  rate: number;
  totalCost: number;
  description: string;
}

// Media cost item interface
interface MediaCostItem {
  id: string;
  item: string;
  impressions: number;
  cpm: number;
  fixed: number;
  totalCost: number;
  useFixed: boolean;
}

// Field staff cost item interface
interface FieldStaffCostItem {
  id: string;
  role: string;
  numReps: number;
  trainingHours: number;
  numShifts: number;
  shiftLength: number;
  totalHours: number;
  hourlyRate: number;
  totalCost: number;
}

// Phase production data interface
interface PhaseProductionData {
  [category: string]: {
    standardItems?: StandardCostItem[];
    mediaItems?: MediaCostItem[];
    fieldStaffItems?: FieldStaffCostItem[];
  };
}

// Production data interface
interface ProductionData {
  [phase: string]: PhaseProductionData;
}



export default function ProductionCosts({ project, productionData, setProductionData, onBack, onSave, onNext }: ProductionCostsProps) {
  const [activePhase, setActivePhase] = useState<string>(
    project.phases?.find(phase => project.phaseSettings[phase]?.includeProductionCosts) || ''
  );

  // Initialize production data for phases that include production costs
  useEffect(() => {
    if (!project?.phases) return;
    
    const shouldInitialize = project.phases.some(phase => 
      project.phaseSettings[phase]?.includeProductionCosts && !productionData[phase]
    );
    
    if (!shouldInitialize) return;
    
    const initialData: ProductionData = { ...productionData };
    
    project.phases.forEach(phase => {
      if (project.phaseSettings[phase]?.includeProductionCosts && !initialData[phase]) {
        initialData[phase] = {};
        
        PRODUCTION_CATEGORIES.forEach(category => {
          initialData[phase][category] = {
            standardItems: [],
            mediaItems: [],
            fieldStaffItems: []
          };
        });
      }
    });
    
    setProductionData(initialData);
  }, [project?.phases, project?.phaseSettings]);

  // Note: Auto-save is handled by the main app component to prevent infinite loops



  // Get used categories for a phase
  const getUsedCategories = (phase: string): string[] => {
    const phaseData = productionData[phase] || {};
    return Object.keys(phaseData).filter(category => {
      const categoryData = phaseData[category];
      return (categoryData?.standardItems?.length || 0) > 0 ||
             (categoryData?.mediaItems?.length || 0) > 0 ||
             (categoryData?.fieldStaffItems?.length || 0) > 0;
    });
  };

  // Helper functions to create new items
  const createNewStandardItem = (): StandardCostItem => ({
    id: Date.now().toString(),
    item: '',
    quantity: 1,
    rate: 0,
    totalCost: 0,
    description: ''
  });

  const createNewMediaItem = (): MediaCostItem => ({
    id: Date.now().toString(),
    item: '',
    impressions: 0,
    cpm: 0,
    fixed: 0,
    totalCost: 0,
    useFixed: false
  });

  const createNewFieldStaffItem = (): FieldStaffCostItem => ({
    id: Date.now().toString(),
    role: '',
    numReps: 1,
    trainingHours: 0,
    numShifts: 1,
    shiftLength: 8,
    totalHours: 8,
    hourlyRate: 0,
    totalCost: 0
  });

  // Add category to phase
  const addCategory = (phase: string, category: string) => {
    setProductionData((prev: ProductionData) => ({
      ...prev,
      [phase]: {
        ...prev[phase],
        [category]: {
          standardItems: category === 'Media Billings' || category === 'Field Staff' ? [] : [createNewStandardItem()],
          mediaItems: category === 'Media Billings' ? [createNewMediaItem()] : [],
          fieldStaffItems: category === 'Field Staff' ? [createNewFieldStaffItem()] : []
        }
      }
    }));
  };

  // Remove category from phase
  const removeCategory = (phase: string, category: string) => {
    setProductionData((prev: ProductionData) => {
      const newData = { ...prev };
      if (newData[phase]) {
        delete newData[phase][category];
      }
      return newData;
    });
  };

  // Add standard cost item
  const addStandardItem = (phase: string, category: string) => {
    const newItem: StandardCostItem = {
      id: Date.now().toString(),
      item: '',
      quantity: 1,
      rate: 0,
      totalCost: 0,
      description: ''
    };

    setProductionData(prev => ({
      ...prev,
      [phase]: {
        ...prev[phase],
        [category]: {
          ...prev[phase][category],
          standardItems: [...(prev[phase][category]?.standardItems || []), newItem]
        }
      }
    }));
  };

  // Update standard cost item
  const updateStandardItem = (phase: string, category: string, itemId: string, field: keyof StandardCostItem, value: string | number) => {
    setProductionData(prev => {
      const newData = { ...prev };
      const items = newData[phase][category]?.standardItems || [];
      const itemIndex = items.findIndex(item => item.id === itemId);
      
      if (itemIndex !== -1) {
        const updatedItem = { ...items[itemIndex], [field]: value };
        // Recalculate total cost
        updatedItem.totalCost = Math.round(updatedItem.quantity * updatedItem.rate);
        items[itemIndex] = updatedItem;
      }
      
      return newData;
    });
  };

  // Delete standard cost item
  const deleteStandardItem = (phase: string, category: string, itemId: string) => {
    setProductionData(prev => ({
      ...prev,
      [phase]: {
        ...prev[phase],
        [category]: {
          ...prev[phase][category],
          standardItems: prev[phase][category]?.standardItems?.filter(item => item.id !== itemId) || []
        }
      }
    }));
  };

  // Add media cost item
  const addMediaItem = (phase: string, category: string) => {
    const newItem: MediaCostItem = {
      id: Date.now().toString(),
      item: '',
      impressions: 0,
      cpm: 0,
      fixed: 0,
      totalCost: 0,
      useFixed: false
    };

    setProductionData(prev => ({
      ...prev,
      [phase]: {
        ...prev[phase],
        [category]: {
          ...prev[phase][category],
          mediaItems: [...(prev[phase][category]?.mediaItems || []), newItem]
        }
      }
    }));
  };

  // Update media cost item
  const updateMediaItem = (phase: string, category: string, itemId: string, field: keyof MediaCostItem, value: string | number | boolean) => {
    setProductionData(prev => {
      const newData = { ...prev };
      const items = newData[phase][category]?.mediaItems || [];
      const itemIndex = items.findIndex(item => item.id === itemId);
      
      if (itemIndex !== -1) {
        const updatedItem = { ...items[itemIndex], [field]: value };
        
        // Handle fixed vs calculated logic
        if (field === 'impressions' || field === 'cpm') {
          if (updatedItem.impressions > 0 && updatedItem.cpm > 0) {
            updatedItem.useFixed = false;
            updatedItem.totalCost = Math.round((updatedItem.impressions / 1000) * updatedItem.cpm);
          }
        } else if (field === 'fixed') {
          updatedItem.useFixed = true;
          updatedItem.totalCost = Math.round(updatedItem.fixed);
        }
        
        items[itemIndex] = updatedItem;
      }
      
      return newData;
    });
  };

  // Delete media cost item
  const deleteMediaItem = (phase: string, category: string, itemId: string) => {
    setProductionData(prev => ({
      ...prev,
      [phase]: {
        ...prev[phase],
        [category]: {
          ...prev[phase][category],
          mediaItems: prev[phase][category]?.mediaItems?.filter(item => item.id !== itemId) || []
        }
      }
    }));
  };

  // Add field staff cost item
  const addFieldStaffItem = (phase: string, category: string) => {
    const newItem: FieldStaffCostItem = {
      id: Date.now().toString(),
      role: '',
      numReps: 1,
      trainingHours: 0,
      numShifts: 1,
      shiftLength: 8,
      totalHours: 8,
      hourlyRate: 0,
      totalCost: 0
    };

    setProductionData(prev => ({
      ...prev,
      [phase]: {
        ...prev[phase],
        [category]: {
          ...prev[phase][category],
          fieldStaffItems: [...(prev[phase][category]?.fieldStaffItems || []), newItem]
        }
      }
    }));
  };

  // Update field staff cost item
  const updateFieldStaffItem = (phase: string, category: string, itemId: string, field: keyof FieldStaffCostItem, value: string | number) => {
    setProductionData(prev => {
      const newData = { ...prev };
      const items = newData[phase][category]?.fieldStaffItems || [];
      const itemIndex = items.findIndex(item => item.id === itemId);
      
      if (itemIndex !== -1) {
        const updatedItem = { ...items[itemIndex], [field]: value };
        
        // Update hourly rate when role changes
        if (field === 'role') {
          const rateCard = project.rateCard || 'Labatt';
          // Try to find rates for the specific rate card, fallback to Labatt if not found
          const rates = FIELD_STAFF_RATES[rateCard] || FIELD_STAFF_RATES['Labatt'];
          updatedItem.hourlyRate = rates?.[value as string] || 0;
        }
        
        // Recalculate total hours and total cost
        updatedItem.totalHours = (updatedItem.trainingHours + (updatedItem.numShifts * updatedItem.shiftLength)) * updatedItem.numReps;
        updatedItem.totalCost = Math.round(updatedItem.totalHours * updatedItem.hourlyRate);
        
        items[itemIndex] = updatedItem;
      }
      
      return newData;
    });
  };

  // Delete field staff cost item
  const deleteFieldStaffItem = (phase: string, category: string, itemId: string) => {
    setProductionData(prev => ({
      ...prev,
      [phase]: {
        ...prev[phase],
        [category]: {
          ...prev[phase][category],
          fieldStaffItems: prev[phase][category]?.fieldStaffItems?.filter(item => item.id !== itemId) || []
        }
      }
    }));
  };

  // Calculate phase total
  const calculatePhaseTotal = (phase: string): number => {
    const phaseData = productionData[phase] || {};
    let total = 0;
    
    Object.values(phaseData).forEach(categoryData => {
      categoryData.standardItems?.forEach(item => total += item.totalCost);
      categoryData.mediaItems?.forEach(item => total += item.totalCost);
      categoryData.fieldStaffItems?.forEach(item => total += item.totalCost);
    });
    
    return total;
  };

  // Calculate category total
  const calculateCategoryTotal = (phase: string, category: string): number => {
    const categoryData = productionData[phase]?.[category];
    if (!categoryData) return 0;
    
    let total = 0;
    categoryData.standardItems?.forEach(item => total += item.totalCost);
    categoryData.mediaItems?.forEach(item => total += item.totalCost);
    categoryData.fieldStaffItems?.forEach(item => total += item.totalCost);
    
    return total;
  };

  // Get category totals for all phases - for the overview section
  const getCategoryTotals = (): { [category: string]: number } => {
    const categoryTotals: { [category: string]: number } = {};
    
    Object.keys(productionData).forEach(phase => {
      Object.keys(productionData[phase] || {}).forEach(category => {
        const categoryTotal = calculateCategoryTotal(phase, category);
        if (categoryTotal > 0) {
          categoryTotals[category] = (categoryTotals[category] || 0) + categoryTotal;
        }
      });
    });
    
    return categoryTotals;
  };

  // Formatting helpers for inputs
  const formatNumberWithCommas = (value: number | string): string => {
    const num = typeof value === 'string' ? Number(value) : value;
    if (!isFinite(num)) return '';
    return Math.trunc(num).toLocaleString();
  };

  const parseNumberFromString = (value: string): number => {
    const cleaned = value.replace(/[^0-9.]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  };

  const formatCurrencyInput = (value: number): string => {
    if (!isFinite(value) || value === 0) return '';
    // If the value is a whole number, display without decimals
    // This way users only see decimals if they explicitly typed them
    if (value === Math.floor(value)) {
      return value.toString();
    }
    // If there are decimals, show up to 2 decimal places
    return value.toFixed(2);
  };

  // Calculate grand total
  const calculateGrandTotal = (): number => {
    let total = 0;
    Object.keys(productionData).forEach(phase => {
      total += calculatePhaseTotal(phase);
    });
    return total;
  };

  // Get phases that include production costs
  const productionPhases = project.phases?.filter(phase => 
    project.phaseSettings[phase]?.includeProductionCosts
  ) || [];

  if (productionPhases.length === 0) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>No Production Costs Enabled</CardTitle>
            <CardDescription>
              Please go back to project setup and enable production costs for specific phases.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={onBack}>Back to Project Setup</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            {/* Title removed per request */}
            <p className="text-gray-600">Configure hard costs by category and phase</p>
          </div>

        </div>

        {/* Project Summary removed per request */}

        {/* Phase Totals Summary */}
        <Card className="bg-white">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Production Cost Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {productionPhases.map(phase => (
                <div key={phase} className={`${getPhaseBackgroundColor(phase)} p-4 rounded-lg`}>
                  <div className="text-center">
                    <p className={`font-semibold mb-2 ${getPhaseColor(phase)}`}>{phase}</p>
                    <p className={`text-xl font-bold ${getPhaseColor(phase)}`}>{formatCurrency(calculatePhaseTotal(phase), project.currency)}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Category Totals - matching Project Fees format */}
            <div className="space-y-4">
              <h4 className="text-md font-semibold text-gray-900">Cost Category Totals</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {Object.entries(getCategoryTotals())
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([categoryName, total]) => (
                  <div key={categoryName} className="bg-[#f8fafc] p-3 rounded-md">
                    <p className="font-medium text-[#444646] text-sm mb-1">{categoryName}</p>
                    <p className="text-sm font-bold text-[#444646]">{formatCurrency(total, project.currency)}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Total Production Costs - matching Project Fees format */}
            {(() => {
              const categoryTotals = getCategoryTotals();
              const grandTotal = Object.values(categoryTotals).reduce((sum, total) => sum + total, 0);
              const activeCategoriesCount = Object.keys(categoryTotals).filter(category => categoryTotals[category] > 0).length;
              
              return grandTotal > 0 && (
                <div className="bg-[#f8fafc] p-6 rounded-lg">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-base font-bold text-[#444646]">Total Production Costs</p>
                      <p className="text-base text-[#444646]">
                        {productionPhases.length} phases • {activeCategoriesCount} categories
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-bold text-[#444646]">{formatCurrency(grandTotal, project.currency)}</p>
                    </div>
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>

        {/* Phase Tabs */}
        <Tabs value={activePhase} onValueChange={setActivePhase}>
          <TabsList className="grid grid-cols-1 md:grid-cols-3 w-full">
            {productionPhases.map(phase => (
              <TabsTrigger 
                key={phase} 
                value={phase} 
                className={`${getPhaseBackgroundColor(phase)} ${getPhaseColor(phase)} text-sm font-bold`}
              >
                {phase}
              </TabsTrigger>
            ))}
          </TabsList>

          {productionPhases.map(phase => (
            <TabsContent key={phase} value={phase} className="space-y-6">
              <Card>
                <CardHeader className="pb-4">
                    <CardTitle className="text-lg">{phase} - Production Costs</CardTitle>
                  <CardDescription>
                    Add and configure cost categories for this phase
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                      {/* Available Categories */}
                      <div className="space-y-3">
                        <Label className="text-sm font-medium">Available Categories</Label>
                        <div className="flex flex-wrap gap-2">
                          {PRODUCTION_CATEGORIES.filter(cat => !getUsedCategories(phase).includes(cat)).map(category => (
                            <Button
                              key={category}
                              variant="outline"
                              size="sm"
                              onClick={() => addCategory(phase, category)}
                              className="text-xs"
                            >
                              + {category}
                            </Button>
                          ))}
                        </div>
                      </div>

                      {/* Used Categories */}
                      {getUsedCategories(phase).map(category => (
                    <div key={category} className="border rounded-lg p-4">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="font-medium text-gray-900">{category}</h3>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeCategory(phase, category)}
                          className="text-red-600 hover:text-red-800 text-xs"
                        >
                          Remove Category
                        </Button>
                      </div>

                      {/* Field Staff - Special Format */}
                      {category === 'Field Staff' && (
                        <div className="space-y-3">
                          <div className="flex justify-end items-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => addFieldStaffItem(phase, category)}
                              className="text-xs h-6 px-2"
                            >
                              + Add Role
                            </Button>
                          </div>

                          <div className="space-y-2">
                            {/* Header Row */}
                            <div className="px-2">
                              <div className="grid gap-2 text-sm font-medium text-gray-600 border-b pb-1" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr' }}>
                                <span className="text-left">Field Staff Role</span>
                                <span className="text-left"># Reps</span>
                                <span className="text-left">Training Hrs</span>
                                <span className="text-left"># Shifts</span>
                                <span className="text-left">Shift Hrs</span>
                                <span className="text-left">Total Hrs</span>
                                <span className="text-left">Hourly Rate</span>
                                <span className="text-right">Total Cost</span>
                              </div>
                            </div>

                            {/* Data Rows */}
                            {productionData[phase]?.[category]?.fieldStaffItems?.map(item => (
                              <Card key={item.id} className="p-2 bg-gray-50">
                                <div className="grid gap-2 items-center" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr' }}>
                                  <Select
                                    value={item.role}
                                    onValueChange={(value) => updateFieldStaffItem(phase, category, item.id, 'role', value)}
                                  >
                                    <SelectTrigger className="h-8 text-xs w-full min-w-0">
                                      <SelectValue placeholder="Select role" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {FIELD_STAFF_ROLES.map(role => (
                                        <SelectItem key={role} value={role} className="text-sm">{role}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>

                                  <Input
                                    type="text"
                                    value={formatNumberWithCommas(item.numReps)}
                                    onChange={(e) => updateFieldStaffItem(phase, category, item.id, 'numReps', parseNumberFromString(e.target.value))}
                                    className="h-8 text-sm w-full min-w-0"
                                    min="1"
                                  />

                                  <Input
                                    type="text"
                                    value={formatNumberWithCommas(item.trainingHours)}
                                    onChange={(e) => updateFieldStaffItem(phase, category, item.id, 'trainingHours', parseNumberFromString(e.target.value))}
                                    className="h-8 text-sm w-full min-w-0"
                                    min="0"
                                  />

                                  <Input
                                    type="text"
                                    value={formatNumberWithCommas(item.numShifts)}
                                    onChange={(e) => updateFieldStaffItem(phase, category, item.id, 'numShifts', parseNumberFromString(e.target.value))}
                                    className="h-8 text-sm w-full min-w-0"
                                    min="1"
                                  />

                                  <Input
                                    type="text"
                                    value={formatNumberWithCommas(item.shiftLength)}
                                    onChange={(e) => updateFieldStaffItem(phase, category, item.id, 'shiftLength', parseNumberFromString(e.target.value))}
                                    className="h-8 text-sm w-full min-w-0"
                                    min="1"
                                  />

                                  <Badge variant="outline" className="h-8 flex items-center justify-center text-sm">
                                    {Math.trunc(item.totalHours).toLocaleString()}
                                  </Badge>

                                  <Badge variant="secondary" className="h-8 flex items-center justify-center text-sm">
                                    ${item.hourlyRate.toLocaleString()}
                                  </Badge>

                                  <div className="flex items-center justify-end h-8">
                                    <Badge variant="default" className="h-8 flex items-center justify-center text-sm bg-green-600">
                                      {formatCurrency(item.totalCost, project.currency)}
                                    </Badge>
                                    <Button
                                      onClick={() => deleteFieldStaffItem(phase, category, item.id)}
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0 text-red-600 hover:text-red-800"
                                    >
                                      ×
                                    </Button>
                                  </div>
                                </div>
                              </Card>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Media Billings - Special Format */}
                      {category === 'Media Billings' && (
                        <div className="space-y-3">
                          <div className="flex justify-end items-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => addMediaItem(phase, category)}
                              className="text-xs h-6 px-2"
                            >
                              + Add Media Item
                            </Button>
                          </div>

                          <div className="space-y-2">
                            {/* Header Row */}
                            <div className="px-2">
                              <div className="grid gap-2 text-sm font-medium text-gray-600 border-b pb-1" style={{ gridTemplateColumns: '2fr 1fr 1fr 2fr 2fr' }}>
                              <span className="text-left">Item Name</span>
                              <span className="text-left">Impressions</span>
                              <span className="text-left">CPM ($)</span>
                              <span className="text-left">Fixed Cost ($)</span>
                              <span className="text-right">Total Cost</span>
                              </div>
                            </div>

                            {/* Data Rows */}
                            {productionData[phase]?.[category]?.mediaItems?.map(item => (
                              <Card key={item.id} className="p-2 bg-gray-50">
                                <div className="grid gap-2 items-center" style={{ gridTemplateColumns: '2fr 1fr 1fr 2fr 2fr' }}>
                                  <Input
                                    value={item.item}
                                    onChange={(e) => updateMediaItem(phase, category, item.id, 'item', e.target.value)}
                                    className="h-8 text-xs leading-none w-full min-w-0 px-2 placeholder:text-xs"
                                    placeholder="Item name"
                                  />

                                  <Input
                                    type="text"
                                    value={formatNumberWithCommas(item.impressions)}
                                    onChange={(e) => updateMediaItem(phase, category, item.id, 'impressions', parseNumberFromString(e.target.value))}
                                    className="h-8 text-sm w-full min-w-0"
                                    placeholder="Impressions"
                                    disabled={item.useFixed}
                                  />

                                  <Input
                                    type="text"
                                    value={formatCurrencyInput(item.cpm)}
                                    onChange={(e) => updateMediaItem(phase, category, item.id, 'cpm', parseNumberFromString(e.target.value))}
                                    className="h-8 text-sm w-full min-w-0"
                                    placeholder="CPM"
                                    disabled={item.useFixed}
                                  />

                                  <Input
                                    type="text"
                                    value={formatCurrencyInput(item.fixed)}
                                    onChange={(e) => updateMediaItem(phase, category, item.id, 'fixed', parseNumberFromString(e.target.value))}
                                    className="h-8 text-sm w-full min-w-0"
                                    placeholder="Fixed cost"
                                    disabled={!item.useFixed && item.impressions > 0 && item.cpm > 0}
                                  />

                                  <div className="flex items-center justify-end h-8">
                                    <Badge variant="default" className="h-8 flex items-center justify-center text-sm bg-green-600">
                                      {formatCurrency(item.totalCost, project.currency)}
                                    </Badge>
                                    <Button
                                      onClick={() => deleteMediaItem(phase, category, item.id)}
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0 text-red-600 hover:text-red-800 ml-2"
                                    >
                                      ×
                                    </Button>
                                  </div>
                                </div>
                              </Card>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Standard Format - All Other Categories */}
                      {category !== 'Field Staff' && category !== 'Media Billings' && (
                        <div className="space-y-3">
                          <div className="flex justify-end items-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => addStandardItem(phase, category)}
                              className="text-xs h-6 px-2"
                            >
                              + Add Item
                            </Button>
                          </div>

                          <div className="space-y-2">
                            {/* Header Row */}
                            <div className="px-2">
                              <div className="grid gap-2 text-sm font-medium text-gray-600 border-b pb-1" style={{ gridTemplateColumns: '2fr 1fr 1fr 3fr 2fr' }}>
                                <span className="text-left">Item Name</span>
                                <span className="text-left">Quantity</span>
                                <span className="text-left">Rate ($)</span>
                                <span className="text-left">Description</span>
                                <span className="text-right">Total Cost</span>
                              </div>
                            </div>

                            {/* Data Rows */}
                            {productionData[phase]?.[category]?.standardItems?.map(item => (
                              <Card key={item.id} className="p-2 bg-gray-50">
                                <div className="grid gap-2 items-center" style={{ gridTemplateColumns: '2fr 1fr 1fr 3fr 2fr' }}>
                                  <Input
                                    value={item.item}
                                    onChange={(e) => updateStandardItem(phase, category, item.id, 'item', e.target.value)}
                                    className="h-8 text-xs leading-none w-full min-w-0 px-2 placeholder:text-xs"
                                    placeholder="Item name"
                                  />

                                  <Input
                                    type="text"
                                    value={formatNumberWithCommas(item.quantity)}
                                    onChange={(e) => updateStandardItem(phase, category, item.id, 'quantity', parseNumberFromString(e.target.value))}
                                    className="h-8 text-sm w-full min-w-0"
                                    min="1"
                                  />

                                  <Input
                                    type="text"
                                    value={formatCurrencyInput(item.rate)}
                                    onChange={(e) => updateStandardItem(phase, category, item.id, 'rate', parseNumberFromString(e.target.value))}
                                    className="h-8 text-sm w-full min-w-0"
                                    placeholder="Rate"
                                  />

                                  <Input
                                    value={item.description}
                                    onChange={(e) => updateStandardItem(phase, category, item.id, 'description', e.target.value)}
                                    className="h-8 text-xs leading-none w-full min-w-0 px-2 placeholder:text-xs"
                                    placeholder="Description"
                                  />

                                  <div className="flex items-center justify-end h-8">
                                    <Badge variant="default" className="h-8 flex items-center justify-center text-sm bg-green-600">
                                      {formatCurrency(item.totalCost, project.currency)}
                                    </Badge>
                                    <Button
                                      onClick={() => deleteStandardItem(phase, category, item.id)}
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0 text-red-600 hover:text-red-800 ml-2"
                                    >
                                      ×
                                    </Button>
                                  </div>
                                </div>
                              </Card>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                      {getUsedCategories(phase).length === 0 && (
                        <div className="text-center py-8 text-gray-500">
                          <p>No cost categories added to this phase.</p>
                          <p className="text-sm">Click the + buttons above to get started.</p>
                        </div>
                      )}
                    </div>
                </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* Footer Actions */}
      <div className="hide-bottom-nav flex justify-between">
        <Button variant="outline" onClick={onBack}>
          ← Back to Project Fees
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onSave} className="text-black border-black hover:bg-gray-50">
            Save Quote
          </Button>
          {onNext && (
            <Button className="bg-black hover:bg-gray-800 text-white" onClick={onNext}>
              Next: Finalize Quote
            </Button>
          )}
        </div>
      </div>

      </div>
  );
}