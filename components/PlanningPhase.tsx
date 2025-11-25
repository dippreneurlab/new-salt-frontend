'use client';

import { useState, useEffect } from 'react';
import { Project, Stage, Department, Role, PhaseData } from '../app/AppClient';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency } from '../utils/currency';
import AssignmentModal from './AssignmentModal';
import { UserPlus, Trash } from 'lucide-react';

interface PlanningPhaseProps {
  project: Project;
  phaseData: PhaseData;
  setPhaseData: (phaseData: PhaseData) => void;
  onBack: () => void;
  onNext?: () => void;
  onSave: () => void;
}

const DURATION_OPTIONS = Array.from({ length: 52 }, (_, i) => i + 1);
const OUTPUT_OPTIONS = ['Level 1', 'Level 2', 'Level 3'];
const ALLOCATION_OPTIONS = [
  { value: 10, label: '10% (0.5 days / 4hrs)' },
  { value: 20, label: '20% (1 day / 8 hrs)' },
  { value: 40, label: '40% (2 days / 16 hrs)' },
  { value: 60, label: '60% (3 days / 24 hrs)' },
  { value: 80, label: '80% (4 days / 32 hrs)' },
  { value: 100, label: '100% (5 days / 40hrs)' }
];

const DEPARTMENTS = [
  'Accounts',
  'Design',
  'Creative',
  'Creator',
  'Studio',
  'Strategy',
  'Omni Shopper',
  'Social',
  'Media',
  'Digital'
];

// Import the new 2025 rate mapping
import { RATE_MAPPING_2025, getRolesByDepartment } from '../utils/rateMapping2025';

// Use the 2025 rate mapping directly
const RATE_MAPPING = RATE_MAPPING_2025;

// Initialize roles by department using the 2025 rate mapping
const ROLES_BY_DEPARTMENT: { [key: string]: string[] } = {};

DEPARTMENTS.forEach(department => {
  ROLES_BY_DEPARTMENT[department] = getRolesByDepartment(department);
});


// Helper function to get phase colors
const getPhaseColor = (phase: string) => {
  const normalizedPhase = phase.toLowerCase();
  if (normalizedPhase.includes('planning')) return 'text-[#183f9d]';
  // Check post before production so "post production" doesn't match production first
  if (normalizedPhase.includes('post') || normalizedPhase.includes('wrap')) return 'text-[#7e2e0b]';
  if (normalizedPhase.includes('production') || normalizedPhase.includes('execution')) return 'text-[#554511]';
  return 'bg-gray-100 text-gray-800'; // fallback
};

// Helper function to get phase background colors
const getPhaseBackgroundColor = (phase: string) => {
  const normalizedPhase = phase.toLowerCase();
  if (normalizedPhase.includes('planning')) return 'bg-[#EDF0FE]';
  // Check post before production so "post production" doesn't match production first
  if (normalizedPhase.includes('post') || normalizedPhase.includes('wrap')) return 'bg-[#f7c3ac]';
  if (normalizedPhase.includes('production') || normalizedPhase.includes('execution')) return 'bg-[#fdf0cd]';
  return 'bg-gray-100'; // fallback
};

const getPhaseBorderColor = (phase: string) => {
  const normalizedPhase = phase.toLowerCase();
  if (normalizedPhase.includes('planning')) return 'border-blue-200';
  if (normalizedPhase.includes('production') || normalizedPhase.includes('execution')) return 'border-purple-200';
  if (normalizedPhase.includes('post') || normalizedPhase.includes('wrap')) return 'border-green-200';
  return 'border-gray-200'; // fallback
};

export default function PlanningPhase({ project, phaseData, setPhaseData, onBack, onNext, onSave }: PlanningPhaseProps) {
  const [activePhase, setActivePhase] = useState<string>(project.phases?.[0] || '');
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);

  // Debug: Log when phaseData changes
  useEffect(() => {
    console.log('🔄 PlanningPhase re-rendered with phaseData:', {
      phases: Object.keys(phaseData),
      activePhase,
      stageCount: phaseData[activePhase]?.length || 0
    });
  }, [phaseData, activePhase]);
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);



  // Role display name to rate lookup mapping
  const ROLE_RATE_MAPPING: { [displayName: string]: string } = {
    'Creative': 'Conceptor', // Map "Creative" display name to "Conceptor" rate lookup
  };

  // Custom role ordering for specific departments
  const DEPARTMENT_ROLE_ORDER: { [department: string]: string[] } = {
    'Design': [
      'VP, Design',
      'Design Director', 
      '3D Design Director',
      'Sr Designer',
      'Sr 3D Designer',
      'Asc Design Director',
      'Asc 3D Design Director', 
      'Designer',
      '3D Designer',
      // Fallback mappings for existing CSV roles
      'Sr. Design Director', // Maps to Sr Designer position
      'Associate 3d Design Director' // Maps to Asc 3D Design Director position
    ]
  };

  // Helper function to get ordered roles for a department
  const getOrderedRoles = (department: string, availableRoles: string[]): string[] => {
    const customOrder = DEPARTMENT_ROLE_ORDER[department];
    if (!customOrder) {
      return availableRoles; // Return original order if no custom order defined
    }
    
    // Filter custom order to only include roles that actually exist
    const orderedRoles = customOrder.filter(role => availableRoles.includes(role));
    
    // Add any remaining roles that weren't in the custom order
    const remainingRoles = availableRoles.filter(role => !customOrder.includes(role));
    
    return [...orderedRoles, ...remainingRoles];
  };

  // Helper function to get hourly rate
  const getHourlyRate = (roleName: string): number => {
    const rateCard = project.rateCard || 'Standard';
    
    // Check if this role needs to be mapped to a different name for rate lookup
    const rateLookupName = ROLE_RATE_MAPPING[roleName] || roleName;
    
    // Try the new 2025 rate mapping first
    let rate = RATE_MAPPING_2025[rateCard]?.[rateLookupName] || 0;
    
    // Fallback to old mapping if not found in 2025 data
    if (rate === 0) {
      rate = RATE_MAPPING[rateCard]?.[rateLookupName] || 0;
    }
    
    // If rate is 0 or unexpected, check if role exists in other rate cards (this might be the bug)
    if (rate === 0 || (rateCard === 'Blended' && rate === 75) || (rateCard === 'Blended' && rate === 125)) {
      console.log(`❌ WRONG RATE DETECTED! Expected ${rateCard} rate but got ${rate}`);
      console.log('⚠️ Checking all rate cards for this role...');
      Object.keys(RATE_MAPPING).forEach(card => {
        if (RATE_MAPPING[card][roleName]) {
          console.log(`Found "${roleName}" in ${card} with rate: ${RATE_MAPPING[card][roleName]}`);
        } else {
          console.log(`"${roleName}" NOT FOUND in ${card}`);
        }
      });
      
      // Show exact role name for debugging
      console.log('🔍 Exact role name being searched:', {
        roleName,
        roleNameLength: roleName.length,
        roleNameCharCodes: [...roleName].map(c => c.charCodeAt(0)),
        expectedRate: rateCard === 'Blended' ? 165 : rateCard === 'RBC' ? 85 : 170
      });
    }
    
    console.log('🔍 Getting rate for role:', {
      roleName,
      rateCard,
      rate,
      rateCardExists: !!RATE_MAPPING[rateCard],
      roleExistsInCard: roleName in (RATE_MAPPING[rateCard] || {}),
      availableRatesCount: RATE_MAPPING[rateCard] ? Object.keys(RATE_MAPPING[rateCard]).length : 0,
      firstFewRoles: RATE_MAPPING[rateCard] ? Object.keys(RATE_MAPPING[rateCard]).slice(0, 5) : 'None',
      searchingForExact: `"${roleName}"`,
      rateMappingStatus: Object.keys(RATE_MAPPING).map(card => ({
        card,
        roleCount: Object.keys(RATE_MAPPING[card]).length
      }))
    });
    
    // Try to find close matches if exact match fails
    if (rate === 0 && RATE_MAPPING[rateCard]) {
      const availableRoles = Object.keys(RATE_MAPPING[rateCard]);
      const closeMatches = availableRoles.filter(role => 
        role.toLowerCase().includes(roleName.toLowerCase()) ||
        roleName.toLowerCase().includes(role.toLowerCase())
      );
      console.log('🔍 No exact match found. Close matches:', closeMatches);
      
      // Show exact character comparison for debugging
      const exactMatch = availableRoles.find(role => role === roleName);
      if (!exactMatch) {
        console.log('❌ Role not found exactly. Available roles containing "supervisor":', 
          availableRoles.filter(role => role.toLowerCase().includes('supervisor'))
        );
        console.log('❌ Character-by-character comparison for first close match:');
        if (closeMatches.length > 0) {
          const firstMatch = closeMatches[0];
          console.log(`Expected: "${roleName}" (length: ${roleName.length})`);
          console.log(`Found: "${firstMatch}" (length: ${firstMatch.length})`);
          console.log('Character codes:', [...roleName].map(c => c.charCodeAt(0)));
          console.log('Match char codes:', [...firstMatch].map(c => c.charCodeAt(0)));
        }
      }
    }
    
    return rate;
  };

  // Recalculate all role rates when rate card changes
  useEffect(() => {
    if (!project?.rateCard) return;
    console.log('♻️ Recalculating all role rates for rate card:', project.rateCard);
    const updated: PhaseData = {};
    (project.phases || []).forEach((phase) => {
      const stages = phaseData[phase] || [];
      updated[phase] = stages.map((stage) => ({
        ...stage,
        departments: stage.departments.map((dept) => ({
          ...dept,
          roles: dept.roles.map((role) => {
            const newRate = role.name ? getHourlyRate(role.name) : 0;
            const newHours = calculateHours(role.weeks, role.allocation);
            return {
              ...role,
              rate: newRate,
              totalDollars: newHours * newRate,
            };
          }),
        })),
      }));
    });
    setPhaseData({ ...phaseData, ...updated });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.rateCard]);

  // Note: Auto-save is handled by the main app component to prevent infinite loops

  // Calculate total hours for a role
  const calculateHours = (weeks: number, allocation: number): number => {
    return (weeks * 40 * allocation) / 100;
  };

  // Get stage columns for a phase
  const getStageColumns = (phase: string) => {
    return phaseData[phase] || [];
  };

  // Get all departments used in this phase
  const getUsedDepartments = (phase: string): string[] => {
    const stages = phaseData[phase] || [];
    const departments = new Set<string>();
    stages.forEach(stage => {
      stage.departments.forEach(dept => {
        departments.add(dept.name);
      });
    });
    return Array.from(departments);
  };

  // Check if department has been filled out (has roles with hours/budget)
  const isDepartmentComplete = (phase: string, departmentName: string): boolean => {
    const stages = phaseData[phase] || [];
    
    for (const stage of stages) {
      const dept = stage.departments.find(d => d.name === departmentName);
      if (dept && dept.roles && dept.roles.length > 0) {
        // Check if any role has hours > 0 and totalDollars > 0
        const hasValidRoles = dept.roles.some(role => 
          role.hours > 0 && role.totalDollars > 0 && role.name.trim() !== ''
        );
        if (hasValidRoles) {
          return true;
        }
      }
    }
    
    return false;
  };

  // Get department assignment status across all stages in a phase
  const getDepartmentAssignmentStatus = (phase: string, departmentName: string): string | null => {
    const stages = phaseData[phase] || [];
    let hasAssignment = false;
    
    stages.forEach(stage => {
      const dept = stage.departments.find(d => d.name === departmentName);
      if (dept && dept.assignedTo) {
        hasAssignment = true;
      }
    });
    
    if (!hasAssignment) return null;
    
    // If department has valid roles with hours/budget, mark as completed
    if (isDepartmentComplete(phase, departmentName)) {
      return 'completed';
    }
    
    // Otherwise, it's just assigned
    return 'assigned';
  };

  // Get assigned email for a department across all stages in a phase
  const getDepartmentAssignedEmail = (phase: string, departmentName: string): string | null => {
    const stages = phaseData[phase] || [];
    
    for (const stage of stages) {
      const dept = stage.departments.find(d => d.name === departmentName);
      if (dept && dept.assignedTo) {
        return dept.assignedTo;
      }
    }
    
    return null;
  };

  // Open assignment modal for a department
  const openAssignmentModal = (phase: string, departmentName: string) => {
    // Find the first department instance to get current assignment info
    const stages = phaseData[phase] || [];
    let departmentData = null;
    
    for (const stage of stages) {
      const dept = stage.departments.find(d => d.name === departmentName);
      if (dept) {
        departmentData = dept;
        break;
      }
    }
    
    // Create a Department object for the modal
    const mockDepartment: Department = {
      id: `${phase}-${departmentName}`,
      name: departmentName,
      output: departmentData?.output || '',
      assignedTo: departmentData?.assignedTo,
      assignedName: departmentData?.assignedName,
      status: departmentData?.status || 'unassigned',
      roles: []
    };
    
    setSelectedDepartment(mockDepartment);
    setShowAssignmentModal(true);
  };

  // Assign a department across all stages in a phase
  const assignDepartment = (phase: string, departmentName: string, email: string) => {
    const newData = { ...phaseData };
    const stages = newData[phase] || [];
    
    // Update assignment info for this department in all stages
    stages.forEach((stage: Stage) => {
      const deptIndex = stage.departments.findIndex((d: Department) => d.name === departmentName);
      if (deptIndex !== -1) {
        stage.departments[deptIndex] = {
          ...stage.departments[deptIndex],
          assignedTo: email,
          assignedName: undefined, // No longer using name
          status: 'assigned'
        };
      }
    });
    
    newData[phase] = stages;
    setPhaseData(newData);

    // Here you would typically send an email invitation
    console.log(`📧 Email invitation sent to ${email} for ${departmentName} department in ${phase} phase`);
  };

  // Unassign a department across all stages in a phase  
  const unassignDepartment = (phase: string, departmentName: string) => {
    const newData = { ...phaseData };
    const stages = newData[phase] || [];
    
    // Remove assignment info for this department in all stages
    stages.forEach((stage: Stage) => {
      const deptIndex = stage.departments.findIndex((d: Department) => d.name === departmentName);
      if (deptIndex !== -1) {
        stage.departments[deptIndex] = {
          ...stage.departments[deptIndex],
          assignedTo: undefined,
          assignedName: undefined,
          status: 'unassigned'
        };
      }
    });
    
    newData[phase] = stages;
    setPhaseData(newData);
  };

  // Predefined stage options by phase
  const getStageOptions = (phase: string): string[] => {
    const normalizedPhase = phase.toLowerCase();
    if (normalizedPhase.includes('planning')) {
      return ['Strategic Check In', 'Strategy Presentation', 'Creative Tissue', 'Refined Concepts', 'Final Concepts', 'Custom'];
    }
    // Check post/wrap BEFORE production/execution so "post production" doesn't match production first
    if (normalizedPhase.includes('post') || normalizedPhase.includes('wrap')) {
      // Updated order: Post Production, Reporting, Custom
      return ['Post Production', 'Reporting', 'Custom'];
    }
    if (normalizedPhase.includes('production') || normalizedPhase.includes('execution')) {
      return ['Pre-Production', 'In Field Execution', 'Custom'];
    }
    return ['Custom'];
  };

  // Add a new stage column
  const addStageColumn = (phase: string) => {
    const currentStages = phaseData[phase] || [];
    // Limit Planning phase to maximum 5 stages
    if (phase.toLowerCase().includes('planning') && currentStages.length >= 5) {
      alert('You can add up to 5 stages in the Planning phase.');
      return;
    }
    const stageOptions = getStageOptions(phase);
    const defaultName = stageOptions[Math.min(currentStages.length, stageOptions.length - 1)];
    
    const newStage: Stage = {
      id: Date.now().toString(),
      name: defaultName,
      duration: 1,
      departments: [],
      phase: phase
    };

    setPhaseData({
      ...phaseData,
      [phase]: [...currentStages, newStage]
    });
  };

  // Update stage column
  const updateStageColumn = (phase: string, stageId: string, field: 'name' | 'duration', value: string | number) => {
    const currentStages = phaseData[phase] || [];
    const updatedStages = currentStages.map(stage => {
      if (stage.id === stageId) {
        const updatedStage = { ...stage, [field]: value };
        
        // If duration changes, update all role weeks to match the new stage duration
        if (field === 'duration') {
          const newDuration = value as number;
          console.log(`🔄 Stage duration changed to ${newDuration} weeks - updating all role weeks in stage ${stageId}`);
          
          updatedStage.departments = stage.departments.map(dept => ({
            ...dept,
            roles: dept.roles.map(role => {
              const updatedWeeks = newDuration; // Set all roles to the new stage duration
              const updatedHours = calculateHours(updatedWeeks, role.allocation);
              const updatedTotal = updatedHours * role.rate;
              
              console.log(`📝 Updating role "${role.name}": ${role.weeks} → ${updatedWeeks} weeks`);
              
              return {
                ...role,
                weeks: updatedWeeks,
                hours: updatedHours,
                totalDollars: updatedTotal
              };
            })
          }));
        }
        
        return updatedStage;
      }
      return stage;
    });

    setPhaseData({
      ...phaseData,
      [phase]: updatedStages
    });
  };

  // Delete stage column
  const deleteStageColumn = (phase: string, stageId: string) => {
    const currentStages = phaseData[phase] || [];
    const updatedStages = currentStages.filter(stage => stage.id !== stageId);

    setPhaseData({
      ...phaseData,
      [phase]: updatedStages
    });
  };

  // Add department to all stages in phase
  const addDepartment = (phase: string, departmentName: string) => {
    console.log('🏢 addDepartment called:', { phase, departmentName });
    
    const currentStages = phaseData[phase] || [];
    console.log('📊 Current stages before adding department:', currentStages.map(s => ({ 
      id: s.id, 
      name: s.name, 
      deptCount: s.departments.length,
      departments: s.departments.map(d => d.name)
    })));
    
    const updatedStages = currentStages.map(stage => {
      // Check if department already exists in this stage
      const existingDept = stage.departments.find(d => d.name === departmentName);
      if (existingDept) {
        console.log(`⚠️ Department ${departmentName} already exists in stage ${stage.name}`);
        return stage;
      }

      // Add department to this stage
      const newDepartment: Department = {
        id: `${stage.id}-${departmentName}-${Date.now()}`,
        name: departmentName,
      output: '',
        roles: [],
        status: 'unassigned'
      };

      console.log(`➕ Adding department ${departmentName} to stage ${stage.name}`);
      return {
        ...stage,
        departments: [...stage.departments, newDepartment]
      };
    });

    console.log('📊 Updated stages after adding department:', updatedStages.map(s => ({ 
      id: s.id, 
      name: s.name, 
      deptCount: s.departments.length,
      departments: s.departments.map(d => d.name)
    })));

    setPhaseData({
      ...phaseData,
      [phase]: updatedStages
    });
  };

  // Remove department from all stages in phase
  const removeDepartment = (phase: string, departmentName: string) => {
    const currentStages = phaseData[phase] || [];
    const updatedStages = currentStages.map(stage => ({
      ...stage,
      departments: stage.departments.filter(d => d.name !== departmentName)
    }));

    setPhaseData({
      ...phaseData,
      [phase]: updatedStages
    });
  };

  // Update department output for specific stage
  const updateDepartmentOutput = (phase: string, departmentName: string, stageId: string, output: string) => {
    const currentStages = phaseData[phase] || [];
    const updatedStages = currentStages.map(stage => {
      if (stage.id === stageId) {
        return {
          ...stage,
          departments: stage.departments.map(dept => 
            dept.name === departmentName ? { ...dept, output } : dept
          )
        };
      }
      return stage;
    });

    setPhaseData({
      ...phaseData,
      [phase]: updatedStages
    });
  };

  // Helper function to get the role from the same row position in Stage 1
  const getRoleFromSameRowInStage1 = (phase: string, departmentName: string, currentStageId: string): string => {
    const currentStages = phaseData[phase] || [];
    
    // Find Stage 1 (first stage in the phase)
    const stage1 = currentStages[0]; // Assuming the first stage is "Stage 1"
    if (!stage1 || stage1.id === currentStageId) {
      console.log(`🔍 No Stage 1 found or current stage is Stage 1`);
      return '';
    }
    
    // Find the department in Stage 1
    const stage1Dept = stage1.departments.find(d => d.name === departmentName);
    if (!stage1Dept) {
      console.log(`🔍 Department "${departmentName}" not found in Stage 1`);
      return '';
    }
    
    // Find the current stage and department to determine row position
    const currentStage = currentStages.find(s => s.id === currentStageId);
    const currentDept = currentStage?.departments.find(d => d.name === departmentName);
    
    if (!currentDept) {
      console.log(`🔍 Current department not found`);
      return '';
    }
    
    // The row position is the current number of roles in the current department
    const rowIndex = currentDept.roles.length;
    
    // Get the role from the same row position in Stage 1
    const stage1Role = stage1Dept.roles[rowIndex];
    const suggestedRoleName = stage1Role?.name || '';
    
    console.log(`🔍 Same row analysis for ${departmentName}:`, {
      stage1Name: stage1.name,
      rowIndex,
      stage1RolesCount: stage1Dept.roles.length,
      currentRolesCount: currentDept.roles.length,
      suggestedRoleName,
      stage1Roles: stage1Dept.roles.map(r => r.name)
    });
    
    return suggestedRoleName;
  };

  // Add role to department in specific stage
  const addRole = (phase: string, departmentName: string, stageId: string) => {
    console.log('🎯 addRole called:', { phase, departmentName, stageId });
    
    const currentStages = phaseData[phase] || [];
    console.log('📊 Current stages:', currentStages.map(s => ({ id: s.id, name: s.name, deptCount: s.departments.length })));
    
    const updatedStages = currentStages.map(stage => {
      if (stage.id === stageId) {
        console.log('🎯 Found target stage:', { id: stage.id, name: stage.name, departments: stage.departments.map(d => d.name) });
        
        // Check if department exists in this stage
        const departmentExists = stage.departments.find(d => d.name === departmentName);
        if (!departmentExists) {
          console.log('❌ Department not found in stage:', { departmentName, stageId, availableDepts: stage.departments.map(d => d.name) });
          return stage; // Return unchanged if department doesn't exist
        }
        
        return {
          ...stage,
          departments: stage.departments.map(dept => {
            if (dept.name === departmentName) {
              console.log('🎯 Found target department:', { name: dept.name, currentRoles: dept.roles.length });
              
              // Check for role in the same row position in Stage 1
              const suggestedRoleName = getRoleFromSameRowInStage1(phase, departmentName, stageId);
              const suggestedRate = suggestedRoleName ? getHourlyRate(suggestedRoleName) : 0;
              const stageWeeks = stage.duration || 1;
              const calculatedHours = calculateHours(stageWeeks, 100);
              
              const newRole: Role = {
                id: Date.now().toString(),
                name: suggestedRoleName, // Auto-select the most common role
                weeks: stageWeeks, // Use the current stage's duration
                allocation: 100,
                hours: calculatedHours,
                rate: suggestedRate,
                totalDollars: calculatedHours * suggestedRate
              };
              
              if (suggestedRoleName) {
                console.log(`✨ Auto-selected role "${suggestedRoleName}" from same row position in Stage 1`);
              } else {
                console.log('➕ Adding blank role - no corresponding role found in Stage 1 at this row position');
              }
              
              console.log('➕ Adding new role:', newRole);
              return { ...dept, roles: [...dept.roles, newRole] };
            }
            return dept;
          })
        };
      }
      return stage;
    });

    console.log('💾 Setting updated phase data');
    const newPhaseData = {
      ...phaseData,
      [phase]: updatedStages
    };
    console.log('🔍 New phase data structure:', {
      phase,
      stageCount: updatedStages.length,
      targetStage: updatedStages.find(s => s.id === stageId),
      targetDepartment: updatedStages.find(s => s.id === stageId)?.departments.find(d => d.name === departmentName)
    });
    setPhaseData(newPhaseData);
  };

  // Update role
  const updateRole = (phase: string, departmentName: string, stageId: string, roleId: string, field: keyof Role, value: string | number) => {
    const currentStages = phaseData[phase] || [];
    const updatedStages = currentStages.map(stage => {
      if (stage.id === stageId) {
        return {
            ...stage,
          departments: stage.departments.map(dept => {
            if (dept.name === departmentName) {
              return {
                ...dept,
                roles: dept.roles.map(role => {
              if (role.id === roleId) {
                const updatedRole = { ...role, [field]: value };
                    
                    // Always recalculate rate when name changes
                    if (field === 'name') {
                      updatedRole.rate = getHourlyRate(value as string);
                    }
                    
                    // Always recalculate hours and total dollars
                    updatedRole.hours = calculateHours(updatedRole.weeks, updatedRole.allocation);
                    updatedRole.totalDollars = Math.round(updatedRole.hours * updatedRole.rate);
                    
                    console.log('Role updated:', {
                      roleName: updatedRole.name,
                      rate: updatedRole.rate,
                      hours: updatedRole.hours,
                      totalDollars: updatedRole.totalDollars,
                      rateCard: project.rateCard
                    });
                    
                return updatedRole;
              }
              return role;
            })
              };
            }
            return dept;
          })
        };
      }
      return stage;
    });

    setPhaseData({
      ...phaseData,
      [phase]: updatedStages
    });
  };

  // Delete role
  const deleteRole = (phase: string, departmentName: string, stageId: string, roleId: string) => {
    const currentStages = phaseData[phase] || [];
    const updatedStages = currentStages.map(stage => {
      if (stage.id === stageId) {
        return {
          ...stage,
          departments: stage.departments.map(dept => {
            if (dept.name === departmentName) {
              return {
                ...dept,
                roles: dept.roles.filter(role => role.id !== roleId)
              };
            }
            return dept;
          })
        };
      }
      return stage;
    });

    setPhaseData({
      ...phaseData,
      [phase]: updatedStages
    });
  };

  // Calculate totals
  const calculateTotals = () => {
    let grandTotalHours = 0;
    let grandTotalDollars = 0;
    const phaseTotal: { [phase: string]: { hours: number; dollars: number } } = {};
    const departmentTotals: { [department: string]: { hours: number; dollars: number } } = {};

    (project.phases || []).forEach(phase => {
      let phaseHours = 0;
      let phaseDollars = 0;

      (phaseData[phase] || []).forEach(stage => {
        stage.departments.forEach(dept => {
          dept.roles.forEach(role => {
            phaseHours += role.hours;
            phaseDollars += role.totalDollars;
            
            if (!departmentTotals[dept.name]) {
              departmentTotals[dept.name] = { hours: 0, dollars: 0 };
            }
            departmentTotals[dept.name].hours += role.hours;
            departmentTotals[dept.name].dollars += role.totalDollars;
          });
        });
      });

      phaseTotal[phase] = { hours: phaseHours, dollars: phaseDollars };
      grandTotalHours += phaseHours;
      grandTotalDollars += phaseDollars;
    });

    return { grandTotalHours, grandTotalDollars, phaseTotal, departmentTotals };
  };

  const { grandTotalHours, grandTotalDollars, phaseTotal, departmentTotals } = calculateTotals();

  // Calculate creative and design resourcing fees with 1.5% charge each
  const calculateResourcingFees = () => {
    const creativeTotal = departmentTotals['Creative']?.dollars || 0;
    const designTotal = departmentTotals['Design']?.dollars || 0;
    
    // Calculate 1.5% charge for each department separately
    const creativeResourcingFee = creativeTotal * 0.015;
    const designResourcingFee = designTotal * 0.015;
    
    return {
      creativeTotal,
      designTotal,
      creativeResourcingFee,
      designResourcingFee
    };
  };

  const { creativeTotal, designTotal, creativeResourcingFee, designResourcingFee } = calculateResourcingFees();



  if (!project.phases || project.phases.length === 0) {
  return (
      <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
            <CardTitle>No Phases Selected</CardTitle>
            <CardDescription>
              Please go back to project setup and select at least one phase to quote.
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
          <p className="text-gray-600">Configure the resource allocation by stage, department and row across planning, production/execution and post-production/wrap phases.</p>
            </div>

            </div>

      {/* Project Summary removed per request */}

      {/* Project Fee Overview */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Project Fee Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Phase Totals */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(project.phases || []).map(phase => {
                const phaseHours = phaseTotal[phase]?.hours || 0;
                let phaseDollars = phaseTotal[phase]?.dollars || 0;
                
                // Add creative and design resourcing fees to Planning phase total
                if (phase.toLowerCase().includes('planning')) {
                  phaseDollars += creativeResourcingFee + designResourcingFee;
                }
                
                if (phaseHours === 0) return null;

                return (
                  <div key={phase} className={`${getPhaseBackgroundColor(phase)} p-4 rounded-lg`}>
                    <div className="text-center">
                      <p className={`font-semibold mb-2 ${getPhaseColor(phase)}`}>{phase}</p>
                      <p className={`text-xl font-bold ${getPhaseColor(phase)}`}>{formatCurrency(phaseDollars, project.currency)}</p>
            </div>
              </div>
                );
              })}
            </div>

            {/* Department Totals Across All Phases */}
            <div className="space-y-3">
              <h4 className="text-base font-semibold text-gray-800 border-b border-gray-200 pb-2">Department Totals</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {Object.entries(departmentTotals)
                  .filter(([_, totals]) => totals.hours > 0)
                  .map(([deptName, totals]) => {
                    // Check if this department has resourcing fees
                    const hasCreativeResourcing = deptName === 'Creative' && creativeResourcingFee > 0;
                    const hasDesignResourcing = deptName === 'Design' && designResourcingFee > 0;
                    
                    return (
                      <div key={deptName} className="bg-[#f8fafc] p-3 rounded-md">
                        <p className="font-medium text-[#444646] text-sm mb-1">{deptName}</p>
                        <p className="text-sm text-[#444646] font-bold">{formatCurrency(totals.dollars, project.currency)}</p>
                        <p className="text-sm text-[#444646] font-semibold">{totals.hours.toFixed(0)} hours</p>
                        
                        {/* Add Creative Resourcing line item under Creative department */}
                        {hasCreativeResourcing && (
                          <div className="mt-2 pt-2 border-t border-gray-300 bg-blue-50 p-2 rounded">
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-medium text-blue-700">Creative Resourcing (1.5%):</span>
                              <span className="text-xs font-bold text-blue-600">{formatCurrency(creativeResourcingFee, project.currency)}</span>
                            </div>
                          </div>
                        )}
                        
                        {/* Add Design Resourcing line item under Design department */}
                        {hasDesignResourcing && (
                          <div className="mt-2 pt-2 border-t border-gray-300 bg-blue-50 p-2 rounded">
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-medium text-blue-700">Design Resourcing (1.5%):</span>
                              <span className="text-xs font-bold text-blue-600">{formatCurrency(designResourcingFee, project.currency)}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
              
            </div>

            {/* Grand Total */}
            {(grandTotalHours > 0 || grandTotalDollars > 0) && (
              <div className="bg-[#f8fafc] p-6 rounded-lg">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-base font-bold text-[#444646]">Project Fees Total</p>
                      <p className="text-base text-[#444646]">
                        {project.phases.length} phases • {Object.keys(departmentTotals).filter(dept => departmentTotals[dept].hours > 0).length} departments
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-bold text-[#444646]">{formatCurrency(grandTotalDollars, project.currency)}</p>
                    </div>
                  </div>
                  
                  {(creativeResourcingFee > 0 || designResourcingFee > 0) && (
                    <div className="border-t border-gray-300 pt-3">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-sm font-semibold text-[#444646]">Resourcing Fees (1.5%)</p>
                          <p className="text-xs text-[#666]">Project Management & Resourcing</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-blue-600">{formatCurrency(creativeResourcingFee + designResourcingFee, project.currency)}</p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="border-t-2 border-gray-400 pt-3">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-lg font-bold text-[#444646]">Total Project Fees</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-[#444646]">{formatCurrency(grandTotalDollars + creativeResourcingFee + designResourcingFee, project.currency)}</p>
                      </div>
                    </div>
                  </div>
                </div>
            </div>
          )}
          </div>
        </CardContent>
      </Card>

      {/* Phase Tabs */}
      <Tabs value={activePhase} onValueChange={setActivePhase}>
        <TabsList className="grid grid-cols-1 md:grid-cols-3 w-full">
          {project.phases.sort((a, b) => {
            const order = ['Planning', 'Production/Execution', 'Post Production/Wrap'];
            return order.indexOf(a) - order.indexOf(b);
          }).map(phase => {
            const normalizedPhase = phase.toLowerCase();
            const isPlanning = normalizedPhase.includes('planning');
            const isPostProduction = normalizedPhase.includes('post') || normalizedPhase.includes('wrap');
            const isProduction = (normalizedPhase.includes('execution') || (normalizedPhase.includes('production') && !isPostProduction));
            
            let tabClasses = "text-sm ";
            if (isPlanning) {
              tabClasses += " bg-[#EDF0FE] text-[#183f9d] font-bold";
            } else if (isProduction) {
              tabClasses += " bg-[#fdf0cd] text-[#554511] font-bold";
            } else if (isPostProduction) {
              tabClasses += " bg-[#f7c3ac] text-[#7e2e0b] font-bold";
            }
            
            return (
              <TabsTrigger 
                key={phase} 
                value={phase} 
                className={tabClasses}
              >
                {phase}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {project.phases.sort((a, b) => {
          const order = ['Planning', 'Production/Execution', 'Post Production/Wrap'];
          return order.indexOf(a) - order.indexOf(b);
        }).map(phase => (
          <TabsContent key={phase} value={phase} className="space-y-6">
            {/* Stage Management */}
            <Card className="border-0">
              <CardHeader className="pb-4">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-lg">{phase} - Stage Configuration</CardTitle>
                  <Button onClick={() => addStageColumn(phase)} size="sm" variant="outline" className="bg-white text-black border-black hover:bg-gray-50">
                    + Stage
                  </Button>
                </div>
                <CardDescription>
                  Add stages as columns, then add departments as rows. Configure output and roles for each department-stage intersection.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Departments moved above stages */}
                  {/* Department Management */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Available Departments</Label>
                    <div className="flex flex-wrap gap-2">
                      {DEPARTMENTS.filter(dept => !getUsedDepartments(phase).includes(dept)).map(dept => (
                        <Button
                          key={dept}
                          variant="outline"
                          size="sm"
                          onClick={() => addDepartment(phase, dept)}
                          className="text-xs"
                        >
                          + {dept}
                        </Button>
                      ))}
                    </div>
                  </div>

                {/* Scrollable container for stage grid */}
                <div className="overflow-x-auto">
                {/* Stage headers (stage name and weeks) - placed directly under available departments */}
                {getStageColumns(phase).length > 0 && (
                  <div
                    className="grid gap-3 mt-4 -ml-2"
                    style={{ gridTemplateColumns: `200px repeat(${getStageColumns(phase).length}, 200px)` }}
                  >
                    <div></div>
                    {getStageColumns(phase).map((stage) => (
                      <Card key={stage.id} className="p-3 bg-blue-50" style={{ fontSize: '10px' }}>
                        <div className="space-y-2">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              {getStageOptions(phase).includes(stage.name) ? (
                                <Select
                                  value={stage.name}
                                  onValueChange={(value) => {
                                    if (value === 'Custom') {
                                      updateStageColumn(phase, stage.id, 'name', '');
                                    } else {
                                      updateStageColumn(phase, stage.id, 'name', value);
                                    }
                                  }}
                                >
                                  <SelectTrigger className="text-xs font-medium h-8 text-left">
                                    <SelectValue placeholder="Select stage" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {getStageOptions(phase).map(option => (
                                      <SelectItem key={option} value={option}>
                                        {option}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <Input
                                  value={stage.name}
                                  onChange={(e) => updateStageColumn(phase, stage.id, 'name', e.target.value)}
                                  placeholder="Custom stage name"
                                  className="text-xs font-medium h-8"
                                />
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteStageColumn(phase, stage.id)}
                              className="text-red-600 hover:text-red-800 ml-2 h-6 w-6 p-0"
                            >
                              ×
                            </Button>
                          </div>
                          <div>
                            <Label className="text-xs">Duration (weeks)</Label>
                            <Select
                              value={stage.duration.toString()}
                              onValueChange={(value) => updateStageColumn(phase, stage.id, 'duration', parseInt(value))}
                            >
                              <SelectTrigger className="h-7 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {DURATION_OPTIONS.map(duration => (
                                  <SelectItem key={duration} value={duration.toString()}>{duration} weeks</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}

                  {/* Separator line between stages and departments */}
                  {getUsedDepartments(phase).length > 0 && (
                    <div className="border-t border-gray-200 my-4"></div>
                  )}

                  {/* Department Rows */}
                  {getUsedDepartments(phase).map((departmentName, index) => (
                    <div key={departmentName} className={`py-4 ${index > 0 ? 'border-t border-gray-200' : ''}`}>
                      <div className="grid gap-3 -ml-2" style={{ gridTemplateColumns: `200px repeat(${getStageColumns(phase).length}, 200px)` }}>
                        {/* Department Name Column */}
                  <div className="space-y-2 pl-2">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-gray-900">{departmentName}</h3>
                            {/* Assignment Status Badge */}
                            {getDepartmentAssignmentStatus(phase, departmentName) && (
                              <Badge 
                                variant={getDepartmentAssignmentStatus(phase, departmentName) === 'completed' ? 'default' : 'secondary'}
                                className={`text-xs ${
                                  getDepartmentAssignmentStatus(phase, departmentName) === 'completed' 
                                    ? 'bg-green-500 text-white hover:bg-green-600' 
                                    : 'bg-yellow-500 text-white hover:bg-yellow-600'
                                }`}
                              >
                                {getDepartmentAssignmentStatus(phase, departmentName) === 'completed' ? 'Complete' : 'Assigned'}
                              </Badge>
                            )}
                          </div>
                          {/* Assigned Email Display */}
                          {getDepartmentAssignedEmail(phase, departmentName) && (
                            <div className="text-xs text-gray-600">
                              <span className="font-medium">Assigned to:</span> {getDepartmentAssignedEmail(phase, departmentName)}
                            </div>
                          )}
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openAssignmentModal(phase, departmentName)}
                              className="text-gray-700 hover:text-gray-900 text-xs h-6 px-2"
                              aria-label={getDepartmentAssignmentStatus(phase, departmentName) ? 'Reassign' : 'Assign'}
                              title={getDepartmentAssignmentStatus(phase, departmentName) ? 'Reassign' : 'Assign'}
                            >
                              <UserPlus className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeDepartment(phase, departmentName)}
                              className="text-gray-700 hover:text-gray-900 text-xs h-6 px-2"
                              aria-label="Remove department"
                              title="Remove"
                            >
                              <Trash className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>

                        {/* Stage Columns for this Department */}
                        {getStageColumns(phase).map((stage) => {
                          const department = stage.departments.find(d => d.name === departmentName);
                          const roles = department?.roles || [];
                          
                          return (
                            <Card key={stage.id} className="p-2 bg-gray-50">
                              <div className="space-y-2">
                                {/* Roles */}
                                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                                    <Label className="text-xs font-semibold">Roles</Label>
                    <Button
                                      variant="ghost"
                      size="sm"
                                      onClick={() => addRole(phase, departmentName, stage.id)}
                                      className="text-xs h-6 px-2"
                    >
                                      +
                    </Button>
                  </div>

                                  {roles.map((role) => (
                                    <Card key={role.id} className="p-2 bg-white border" style={{ fontSize: '10px' }}>
                        <div className="space-y-2">
                                        {/* Role Name */}
                          <Select
                            value={role.name}
                                          onValueChange={(value) => updateRole(phase, departmentName, stage.id, role.id, 'name', value)}
                          >
                                          <SelectTrigger className="h-6 text-xs">
                              <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                            <SelectContent>
                              {(() => {
                                const rawRoles = ROLES_BY_DEPARTMENT[departmentName] || [];
                                const roles = getOrderedRoles(departmentName, rawRoles);
                                const rateCard = project.rateCard || 'Standard';
                                
                                console.log(`🔍 Role dropdown for ${departmentName} in stage ${stage.id}:`, {
                                  departmentName,
                                  stageId: stage.id,
                                  stageName: stage.name,
                                  roles,
                                  rateCard,
                                  allDepartments: Object.keys(ROLES_BY_DEPARTMENT),
                                  roleCount: roles.length,
                                  has2025Mapping: !!RATE_MAPPING_2025[rateCard],
                                  availableRateCards: Object.keys(RATE_MAPPING_2025)
                                });

                                // Debug: Show what roles exist in the rate card for this department
                                if (RATE_MAPPING_2025[rateCard]) {
                                  const availableRoles = roles.filter(role => RATE_MAPPING_2025[rateCard][role] > 0);
                                  const missingRoles = roles.filter(role => !RATE_MAPPING_2025[rateCard][role] || RATE_MAPPING_2025[rateCard][role] === 0);
                                  console.log(`🎯 Rate card analysis for ${rateCard} - ${departmentName}:`, {
                                    availableRoles: availableRoles.length,
                                    availableRolesList: availableRoles,
                                    missingRoles: missingRoles.length,
                                    missingRolesList: missingRoles,
                                    shouldFilter: missingRoles.length > 0
                                  });
                                }
                                
                                // Filter roles to only show those with valid rates for the selected rate card
                                const filterRolesByRateAvailability = (roleList: string[]) => {
                                  return roleList.filter(roleName => {
                                    // Prioritize 2025 rate mapping for more accurate filtering
                                    const rate2025 = RATE_MAPPING_2025[rateCard]?.[roleName] || 0;
                                    
                                    // If 2025 mapping exists for this rate card, only use roles from that mapping
                                    if (RATE_MAPPING_2025[rateCard]) {
                                      const hasValidRate = rate2025 > 0;
                                      if (!hasValidRate) {
                                        console.log(`❌ Filtering out "${roleName}" - no rate in ${rateCard} 2025 mapping`);
                                      }
                                      return hasValidRate;
                                    }
                                    
                                    // Fallback to CSV mapping only if 2025 mapping doesn't exist for this rate card
                                    const rateCSV = RATE_MAPPING[rateCard]?.[roleName] || 0;
                                    const hasValidRate = rateCSV > 0;
                                    
                                    if (!hasValidRate) {
                                      console.log(`❌ Filtering out "${roleName}" - no rate in ${rateCard} CSV mapping`);
                                    }
                                    
                                    return hasValidRate;
                                  });
                                };
                                
                                // If no roles found for department, show all available roles as fallback
                                if (roles.length === 0) {
                                  console.log(`⚠️ No roles found for ${departmentName} in stage ${stage.id}, showing filtered fallback roles`);
                                  const allRoles = Object.values(ROLES_BY_DEPARTMENT).flat();
                                  const uniqueRoles = [...new Set(allRoles)].sort();
                                  const filteredRoles = filterRolesByRateAvailability(uniqueRoles);
                                  console.log(`📋 Filtered fallback roles:`, filteredRoles.slice(0, 10), '... total:', filteredRoles.length);
                                  return filteredRoles.map(roleName => (
                                    <SelectItem key={roleName} value={roleName}>{roleName}</SelectItem>
                                  ));
                                }
                                
                                // Filter department roles by rate availability
                                const filteredRoles = filterRolesByRateAvailability(roles);
                                console.log(`📋 Filtered ${departmentName} roles for ${rateCard}:`, {
                                  originalCount: roles.length,
                                  filteredCount: filteredRoles.length,
                                  filteredRoles: filteredRoles,
                                  removedRoles: roles.filter(r => !filteredRoles.includes(r))
                                });
                                
                                return filteredRoles.map(roleName => (
                                  <SelectItem key={roleName} value={roleName}>{roleName}</SelectItem>
                                ));
                              })()}
                            </SelectContent>
                          </Select>

                                                                                {/* Role Details - Vertical Layout */}
                                        <div className="space-y-2">
                                          <div>
                                            <Select
                                              value={role.weeks.toString()}
                                              onValueChange={(value) => updateRole(phase, departmentName, stage.id, role.id, 'weeks', parseInt(value))}
                                            >
                                              <SelectTrigger className={`h-6 text-xs ${role.weeks > stage.duration ? 'border-red-500' : ''}`}>
                                                <SelectValue placeholder={`${role.weeks} weeks`} />
                                              </SelectTrigger>
                                              <SelectContent>
                                                {Array.from({ length: stage.duration }, (_, i) => i + 1).map(week => (
                                                  <SelectItem key={week} value={week.toString()}>{week} weeks</SelectItem>
                                                ))}
                                              </SelectContent>
                                            </Select>
                                            {role.weeks > stage.duration && (
                                              <p className="text-xs text-red-600">Max: {stage.duration}w</p>
                                            )}
                                          </div>

                                          <div>
                                            <Label className="text-xs">Allocation (Avg/Week)</Label>
                                            <Select
                                              value={role.allocation.toString()}
                                              onValueChange={(value) => updateRole(phase, departmentName, stage.id, role.id, 'allocation', parseInt(value))}
                                            >
                                              <SelectTrigger className="h-6 text-xs text-left">
                                                <SelectValue />
                                              </SelectTrigger>
                                              <SelectContent>
                                                {ALLOCATION_OPTIONS.map(allocation => (
                                                  <SelectItem key={allocation.value} value={allocation.value.toString()}>{allocation.label}</SelectItem>
                                                ))}
                                              </SelectContent>
                                            </Select>
                                          </div>
                                        </div>

                                        {/* Calculated Values */}
                                        <div className="space-y-1 text-left text-xs">
                                          <div className="flex justify-between items-center">
                                            <span className="text-gray-600">Hours</span>
                                            <span className="font-semibold text-[#183f9d]">{role.hours.toFixed(0)} hrs</span>
                                          </div>
                                          <div className="flex justify-between items-center">
                                            <span className="text-gray-600">Rate</span>
                                            <span className="font-semibold text-[#183f9d]">${role.rate.toLocaleString()}</span>
                                          </div>
                                          <div className="flex justify-between items-center">
                                            <span className="text-gray-600">Total</span>
                                            <span className="font-semibold text-[#183f9d]">${Math.round(role.totalDollars).toLocaleString()}</span>
                                          </div>
                        </div>

                                        {/* Delete Role */}
                        <div className="flex justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteRole(phase, departmentName, stage.id, role.id)}
                            className="text-xs text-gray-700 hover:text-gray-900 h-5 px-1"
                            aria-label="Remove role"
                            title="Remove"
                          >
                            <Trash className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}

                                  {roles.length === 0 && (
                                    <p className="text-xs text-gray-500 italic">No roles added</p>
                                  )}
                      </div>
                              </div>
                            </Card>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  {/* End of scrollable container */}
                  </div>

                  {getStageColumns(phase).length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <p>No stages added to this phase.</p>
                      <p className="text-sm">Click "+ Stage" to get started.</p>
                    </div>
                  )}

                  {getUsedDepartments(phase).length === 0 && getStageColumns(phase).length > 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <p>No departments added to this phase.</p>
                      <p className="text-sm">Click on a department above to add it.</p>
                    </div>
                  )}

                  {/* Stage section removed here; headers now appear above department rows */}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* Footer Actions */}
      <div className="hide-bottom-nav flex justify-between">
        <Button variant="outline" onClick={onBack}>
          ← Back to Project Setup
            </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onSave} className="text-black border-black hover:bg-gray-50">
            Save Quote
            </Button>
          {onNext && (
            <Button className="bg-black hover:bg-gray-800 text-white" onClick={onNext}>
              Next: Production Costs →
            </Button>
          )}
          </div>
      </div>

      {/* Modals */}
      {showAssignmentModal && selectedDepartment && (
        <AssignmentModal
          isOpen={showAssignmentModal}
          onClose={() => {
            setShowAssignmentModal(false);
            setSelectedDepartment(null);
          }}
          department={selectedDepartment}
          onAssign={(departmentId, email) => {
            assignDepartment(activePhase, selectedDepartment?.name || '', email);
            setShowAssignmentModal(false);
            setSelectedDepartment(null);
          }}
          onUnassign={(departmentId) => {
            unassignDepartment(activePhase, selectedDepartment?.name || '');
            setShowAssignmentModal(false);
            setSelectedDepartment(null);
          }}
        />
      )}


    </div>
  );
}
