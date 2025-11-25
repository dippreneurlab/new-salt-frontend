'use client';

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Project, PhaseData } from '../app/AppClient';

interface QuotePreviewProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  phaseData: PhaseData;
}

export default function QuotePreview({ isOpen, onClose, project, phaseData }: QuotePreviewProps) {
  const [zoomLevel, setZoomLevel] = useState(100);

  // Zoom controls
  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 25, 200));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 25, 50));
  const handleResetZoom = () => setZoomLevel(100);

  // Calculate totals
  const getPhaseTotal = (phase: string) => {
    return (phaseData[phase] || []).reduce((total, stage) => 
      total + stage.departments.reduce((stageTotal, dept) => 
        stageTotal + dept.roles.reduce((deptTotal, role) => deptTotal + role.hours, 0), 0
      ), 0
    );
  };

  const getDepartmentTotal = (phase: string, departmentName: string) => {
    return (phaseData[phase] || []).reduce((total, stage) => {
      const dept = stage.departments.find(d => d.name === departmentName);
      return total + (dept ? dept.roles.reduce((sum, role) => sum + role.hours, 0) : 0);
    }, 0);
  };

  const getAllDepartments = () => {
    const departments = new Set<string>();
    Object.values(phaseData).forEach(stages => {
      stages.forEach(stage => {
        stage.departments.forEach(dept => {
          departments.add(dept.name);
        });
      });
    });
    return Array.from(departments).sort();
  };

  const getGrandTotal = () => {
    return Object.keys(phaseData).reduce((total, phase) => total + getPhaseTotal(phase), 0);
  };

  // Calculate dollar totals
  const getPhaseTotalDollars = (phase: string) => {
    return (phaseData[phase] || []).reduce((total, stage) => 
      total + stage.departments.reduce((stageTotal, dept) => 
        stageTotal + dept.roles.reduce((deptTotal, role) => deptTotal + role.totalDollars, 0), 0
      ), 0
    );
  };

  const getGrandTotalDollars = () => {
    return Object.keys(phaseData).reduce((total, phase) => total + getPhaseTotalDollars(phase), 0);
  };

  // Calculate creative and design resourcing fees with 1.5% charge each
  const getResourcingFees = () => {
    let creativeTotal = 0;
    let designTotal = 0;
    
    // Sum up Creative and Design department totals
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

  const { creativeTotal, designTotal, creativeResourcingFee, designResourcingFee } = getResourcingFees();

  // Get department scope overview
  const getDepartmentScope = () => {
    const deptScope = new Map<string, Set<string>>();
    Object.values(phaseData).forEach(stages => {
      stages.forEach(stage => {
        stage.departments.forEach(dept => {
          if (!deptScope.has(dept.name)) {
            deptScope.set(dept.name, new Set());
          }
          if (dept.output) {
            deptScope.get(dept.name)?.add(dept.output);
          }
        });
      });
    });
    return Array.from(deptScope.entries()).map(([name, outputs]) => ({
      name,
      outputs: Array.from(outputs).join(', ') || 'TBD'
    }));
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'TBD';
    return new Date(dateString).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const handleDownloadPDF = () => {
    // Placeholder for actual PDF generation
    alert('PDF download functionality would be implemented here using libraries like jsPDF or Puppeteer');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      <style jsx global>{`
        @media print {
          body { margin: 0; padding: 0; }
          @page { 
            size: 8.5in 11in; 
            margin: 0.5in; 
          }
          .print\\:hidden { display: none !important; }
          .print\\:text-xs { font-size: 0.75rem !important; }
          .print\\:text-sm { font-size: 0.875rem !important; }
          .print\\:text-base { font-size: 1rem !important; }
          .print\\:text-xl { font-size: 1.25rem !important; }
          .print\\:p-2 { padding: 0.5rem !important; }
          .print\\:p-3 { padding: 0.75rem !important; }
          .print\\:p-6 { padding: 1.5rem !important; }
          .print\\:space-y-4 > * + * { margin-top: 1rem !important; }
          .print\\:gap-2 { gap: 0.5rem !important; }
          .print\\:gap-3 { gap: 0.75rem !important; }
          .print\\:ml-2 { margin-left: 0.5rem !important; }
          .print\\:mb-2 { margin-bottom: 0.5rem !important; }
        }
      `}</style>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-[98vw] max-h-[98vh] w-full overflow-hidden p-0">
        <DialogHeader className="p-4 pb-0 flex flex-row items-center justify-between">
          <div>
            <DialogTitle>Quote Preview</DialogTitle>
            <DialogDescription>
              Full-size preview with zoom controls - Current zoom: {zoomLevel}%
            </DialogDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleZoomOut} disabled={zoomLevel <= 50}>
              −
            </Button>
            <Button variant="outline" size="sm" onClick={handleResetZoom}>
              {zoomLevel}%
            </Button>
            <Button variant="outline" size="sm" onClick={handleZoomIn} disabled={zoomLevel >= 200}>
              +
            </Button>
          </div>
        </DialogHeader>

        {/* Scrollable Container for Quote Preview */}
        <div className="overflow-auto max-h-[calc(98vh-140px)] px-4">
          {/* Quote Container with Zoom */}
          <div 
            className="mx-auto bg-white transition-transform duration-200 min-w-full" 
            style={{ 
              transform: `scale(${zoomLevel / 100})`,
              transformOrigin: 'top center'
            }}
          >
            {/* Quote Preview Content */}
            <div className="p-6 space-y-4 text-black print:p-4 print:space-y-3" id="quote-content" style={{
              fontSize: '10pt',
              lineHeight: '1.3'
            }}>
              {/* Header */}
              <div className="border-b border-gray-200 pb-2">
                <div className="flex justify-between items-center">
                  <div>
                    <h1 className="text-xl font-bold text-gray-900">Project Quote</h1>
                    <p className="text-gray-600 text-xs">Professional Services Estimate</p>
                  </div>
                  <div className="text-right text-xs text-gray-500">
                    <p>Generated: {new Date().toLocaleDateString()}</p>
                    <p>Quote #: {Date.now().toString().slice(-6)}</p>
                  </div>
                </div>
              </div>

              {/* Project Summary */}
              <div className="space-y-2">
                <h2 className="text-base font-semibold text-gray-900 border-b border-gray-200 pb-1">
                  Project Summary
                </h2>
                <div className="flex flex-wrap items-center gap-4 text-xs">
                  <span><strong>Client:</strong> {project.clientName || 'TBD'}</span>
                  <span><strong>Brand:</strong> {project.brand || 'TBD'}</span>
                  <span><strong>Project:</strong> {project.projectName || 'TBD'}</span>
                  <span><strong>Brief Date:</strong> {project.briefDate ? formatDate(project.briefDate) : '—'}</span>
                  <span><strong>In Market:</strong> {project.inMarketDate ? formatDate(project.inMarketDate) : '—'}</span>
                  <span><strong>Completion:</strong> {project.projectCompletionDate ? formatDate(project.projectCompletionDate) : '—'}</span>
                </div>
              </div>

              {/* Project Phases */}
              <div className="space-y-1">
                <h2 className="text-base font-semibold text-gray-900 border-b border-gray-200 pb-1">
                  Project Phases
                </h2>
                <div className="flex gap-1">
                  {(project.phases || []).map(phase => (
                    <Badge key={phase} variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs px-2 py-1">
                      {phase}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Scope Overview */}
              <div className="bg-gray-50 p-3 rounded-lg">
                <h2 className="text-base font-semibold text-gray-900 mb-2">Scope Overview</h2>
                
                {/* Key Metrics */}
                <div className="grid grid-cols-4 gap-2 mb-3 text-center">
                  <div>
                    <p className="text-lg font-bold text-blue-600">{getGrandTotal().toFixed(0)}</p>
                    <p className="text-gray-600 font-medium text-xs">Total Hours</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-green-600">${(getGrandTotalDollars() + creativeResourcingFee + designResourcingFee).toFixed(0).toLocaleString()}</p>
                    <p className="text-gray-600 font-medium text-xs">Total Budget</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-purple-600">{(project.phases || []).length}</p>
                    <p className="text-gray-600 font-medium text-xs">Phases</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-orange-600">{getAllDepartments().length}</p>
                    <p className="text-gray-600 font-medium text-xs">Departments</p>
                  </div>
                </div>

                {/* Department Scope */}
                <div className="space-y-1">
                  <h3 className="text-sm font-medium text-gray-700 border-b border-gray-200 pb-1">Department Deliverables</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {getDepartmentScope().map(dept => (
                      <div key={dept.name} className="text-xs">
                        <span className="font-medium text-gray-800">{dept.name}:</span>
                        <span className="text-gray-600 ml-1">{dept.outputs}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>


              {/* Phase Breakdown */}
              {(project.phases || []).map(phase => {
                const phaseTotal = getPhaseTotal(phase);
                const phaseTotalDollars = getPhaseTotalDollars(phase);
                if (phaseTotal === 0) return null;

                return (
                  <div key={phase} className="space-y-2">
                    <div className="flex justify-between items-center border-b border-gray-200 pb-1">
                      <h2 className="text-base font-semibold text-gray-900">{phase} Phase</h2>
                      <div className="flex gap-1">
                        <Badge className="bg-blue-100 text-blue-800 text-xs px-2 py-1">
                          {phaseTotal.toFixed(1)}h
                        </Badge>
                        <Badge className="bg-green-100 text-green-800 text-xs px-2 py-1">
                          ${phaseTotalDollars.toFixed(0).toLocaleString()}
                        </Badge>
                      </div>
                    </div>

                    {/* Stages in this phase */}
                    {(phaseData[phase] || []).map((stage, stageIndex) => {
                      const stageTotal = stage.departments.reduce((total, dept) => 
                        total + dept.roles.reduce((sum, role) => sum + role.hours, 0), 0
                      );
                      const stageTotalDollars = stage.departments.reduce((total, dept) => 
                        total + dept.roles.reduce((sum, role) => sum + role.totalDollars, 0), 0
                      );

                      if (stageTotal === 0) return null;

                      return (
                        <div key={stage.id} className="ml-2 space-y-1">
                          <div className="flex justify-between items-center">
                            <h3 className="text-sm font-medium text-gray-800">
                              {stage.name || `Stage ${stageIndex + 1}`}
                            </h3>
                            <div className="flex items-center gap-1 text-xs text-gray-600">
                              <span>{stage.duration}w</span>
                              <Badge variant="outline" className="text-xs px-1 py-0">{stageTotal.toFixed(1)}h</Badge>
                              <Badge variant="outline" className="text-xs px-1 py-0 bg-green-50">${stageTotalDollars.toFixed(0).toLocaleString()}</Badge>
                            </div>
                          </div>

                          {/* Departments in this stage */}
                          <div className="space-y-1">
                            {stage.departments.map(department => {
                              const deptTotal = department.roles.reduce((sum, role) => sum + role.hours, 0);
                              const deptTotalDollars = department.roles.reduce((sum, role) => sum + role.totalDollars, 0);
                              if (deptTotal === 0) return null;

                              return (
                                <div key={department.id} className="bg-gray-50 p-2 rounded-md">
                                  <div className="flex justify-between items-start mb-1">
                                    <div>
                                      <h4 className="font-medium text-gray-900 text-xs">{department.name}</h4>
                                      {department.output && (
                                        <p className="text-xs text-gray-600">Output: {department.output}</p>
                                      )}
                                      {department.assignedTo && (
                                        <p className="text-xs text-blue-600">
                                          Assigned: {department.assignedName}
                                        </p>
                                      )}
                                    </div>
                                    <div className="flex gap-1">
                                      <Badge variant="secondary" className="text-xs px-1 py-0">{deptTotal.toFixed(1)}h</Badge>
                                      <Badge variant="secondary" className="text-xs px-1 py-0 bg-green-100">${deptTotalDollars.toFixed(0).toLocaleString()}</Badge>
                                    </div>
                                  </div>

                                  {/* Roles Grid */}
                                  <div className="space-y-1">
                                    {/* Grid Header */}
                                    <div className="grid grid-cols-4 gap-2 text-xs font-semibold text-gray-600 border-b border-gray-200 pb-1">
                                      <span>Role</span>
                                      <span className="text-center">Hours</span>
                                      <span className="text-center">Rate</span>
                                      <span className="text-right">Total</span>
                                    </div>
                                    
                                    {/* Grid Rows */}
                                    <div className="space-y-0">
                                      {department.roles.map(role => (
                                        <div key={role.id} className="grid grid-cols-4 gap-2 text-xs py-0.5">
                                          <span className="text-gray-700 font-medium">{role.name}</span>
                                          <span className="text-center text-blue-600 font-semibold">{role.hours.toFixed(1)}</span>
                                          <span className="text-center text-purple-600 font-medium">${role.rate.toLocaleString()}</span>
                                          <span className="text-right text-green-600 font-bold">${role.totalDollars.toFixed(0).toLocaleString()}</span>
                                        </div>
                                      ))}
                                    </div>
                                    
                                    {/* Department Total Row */}
                                    <div className="grid grid-cols-4 gap-2 text-xs font-bold text-gray-800 border-t border-gray-300 pt-0.5 bg-gray-100 -mx-2 px-2 py-1 rounded">
                                      <span>Subtotal</span>
                                      <span className="text-center text-blue-700">{deptTotal.toFixed(1)}</span>
                                      <span className="text-center text-gray-500">—</span>
                                      <span className="text-right text-green-700">
                                        ${department.roles.reduce((sum, role) => sum + role.totalDollars, 0).toFixed(0).toLocaleString()}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              {/* Department Summary */}
              <div className="space-y-2">
                <h2 className="text-base font-semibold text-gray-900 border-b border-gray-200 pb-1">
                  Department Summary
                </h2>
                
                {/* Grid Header */}
                <div className="grid grid-cols-3 gap-2 text-xs font-semibold text-gray-600 border-b border-gray-200 pb-1">
                  <span>Department</span>
                  <span className="text-center">Total Hours</span>
                  <span className="text-right">Total Budget</span>
                </div>
                
                {/* Department Rows */}
                <div className="space-y-1">
                  {getAllDepartments().map(deptName => {
                    const totalHours = Object.keys(phaseData).reduce((total, phase) => 
                      total + getDepartmentTotal(phase, deptName), 0
                    );
                    const totalDollars = Object.keys(phaseData).reduce((total, phase) => {
                      return total + (phaseData[phase] || []).reduce((phaseTotal, stage) => {
                        const dept = stage.departments.find(d => d.name === deptName);
                        return phaseTotal + (dept ? dept.roles.reduce((sum, role) => sum + role.totalDollars, 0) : 0);
                      }, 0);
                    }, 0);
                    
                    if (totalHours === 0) return null;

                    // Add resourcing fee to department total
                    const totalDollarsWithResourcing = totalDollars + 
                      (deptName === 'Creative' && creativeResourcingFee > 0 ? creativeResourcingFee : 0) +
                      (deptName === 'Design' && designResourcingFee > 0 ? designResourcingFee : 0);

                    return (
                      <div key={deptName} className="space-y-1">
                        <div className="grid grid-cols-3 gap-2 p-2 bg-gray-50 rounded-md text-xs">
                          <span className="font-medium text-gray-900">{deptName}</span>
                          <span className="text-center text-blue-600 font-semibold">{totalHours.toFixed(1)}</span>
                          <span className="text-right text-green-600 font-bold">${totalDollarsWithResourcing.toFixed(0).toLocaleString()}</span>
                        </div>
                        
                        {/* Show creative resourcing breakdown for Creative department */}
                        {deptName === 'Creative' && creativeResourcingFee > 0 && (
                          <div className="ml-2 p-1 bg-blue-50 rounded text-xs">
                            <div className="flex justify-between items-center">
                              <span className="text-gray-600">Base + Creative Resourcing (1.5%):</span>
                              <span className="text-blue-600 font-semibold">${totalDollars.toFixed(0).toLocaleString()} + ${creativeResourcingFee.toFixed(0).toLocaleString()}</span>
                            </div>
                          </div>
                        )}
                        
                        {/* Show design resourcing breakdown for Design department */}
                        {deptName === 'Design' && designResourcingFee > 0 && (
                          <div className="ml-2 p-1 bg-blue-50 rounded text-xs">
                            <div className="flex justify-between items-center">
                              <span className="text-gray-600">Base + Design Resourcing (1.5%):</span>
                              <span className="text-blue-600 font-semibold">${totalDollars.toFixed(0).toLocaleString()} + ${designResourcingFee.toFixed(0).toLocaleString()}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Footer */}
              <div className="border-t border-gray-200 pt-3 text-center text-xs text-gray-500">
                <p>This quote is valid for 30 days from the date of generation. All hours are estimates and subject to final scope confirmation.</p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex gap-2 p-6 pt-0 print:hidden">
          <Button variant="outline" onClick={onClose}>
            Close Preview
          </Button>
          <Button variant="outline" onClick={handlePrint}>
            Print Preview
          </Button>
          <Button onClick={handleDownloadPDF}>
            Download PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
