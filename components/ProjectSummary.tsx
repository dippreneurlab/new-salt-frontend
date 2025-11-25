'use client';

import { Project } from '../app/AppClient';
import { Badge } from "@/components/ui/badge";

interface ProjectSummaryProps {
  project: Project;
  className?: string;
  showRateCard?: boolean;
  showBudget?: boolean;
  compact?: boolean;
}

export default function ProjectSummary({ 
  project, 
  className = "", 
  showRateCard = true, 
  showBudget = true,
  compact = false 
}: ProjectSummaryProps) {
  const formatDate = (dateString: string) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (compact) {
    return (
      <div className={`project-summary ${className}`}>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="project-label">Project:</span>
            <span className="project-detail font-medium">{project.projectName}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="project-label">Client:</span>
            <span className="project-detail">{project.clientName}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="project-label">Brand:</span>
            <span className="project-detail">{project.brand}</span>
          </div>
          {project.phases && project.phases.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="project-label">Phases:</span>
              <div className="flex gap-1">
                {project.phases.map((phase) => (
                  <Badge 
                    key={phase} 
                    variant="outline" 
                    className={`text-xs ${
                      phase.toLowerCase().includes('planning') ? 'phase-planning' :
                      phase.toLowerCase().includes('production') ? 'phase-production' :
                      'phase-post'
                    }`}
                  >
                    {phase}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`project-summary hover-lift ${className}`}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Project Details - Column 1 */}
        <div className="space-y-3">
          <h3 className="subsection-title mb-4 text-blue-800">Project Details</h3>
          <div className="space-y-3">
            <div className="form-group">
              <span className="project-label">Client</span>
              <p className="project-value">{project.clientName}</p>
            </div>
            <div className="form-group">
              <span className="project-label">Brand</span>
              <p className="project-value">{project.brand}</p>
            </div>
            <div className="form-group">
              <span className="project-label">Project</span>
              <p className="project-value font-semibold text-blue-700">{project.projectName}</p>
            </div>
          </div>
        </div>

        {/* Timeline - Column 2 */}
        <div className="space-y-3">
          <h3 className="subsection-title mb-4 text-purple-800">Timeline</h3>
          <div className="space-y-3">
            <div className="form-group">
              <span className="project-label">Start Date</span>
              <p className="project-value">{formatDate(project.startDate)}</p>
            </div>
            <div className="form-group">
              <span className="project-label">End Date</span>
              <p className="project-value">{formatDate(project.endDate)}</p>
            </div>
          </div>
        </div>

        {/* Settings & Budget - Column 3 */}
        <div className="space-y-3">
          <h3 className="subsection-title mb-4 text-green-800">Configuration</h3>
          <div className="space-y-3">
            {showRateCard && (
              <div className="form-group">
                <span className="project-label">Rate Card</span>
                <div className="mt-1">
                  <Badge variant="outline" className="badge-info hover-scale">
                    {project.rateCard}
                  </Badge>
                </div>
              </div>
            )}
            {showBudget && project.totalProgramBudget > 0 && (
              <div className="form-group">
                <span className="project-label">Total Budget</span>
                <p className="project-value font-bold text-green-700 text-lg">
                  ${project.totalProgramBudget.toLocaleString()}
                </p>
              </div>
            )}
            {project.phases && project.phases.length > 0 && (
              <div className="form-group">
                <span className="project-label">Phases</span>
                <div className="flex flex-wrap gap-2 mt-2">
                  {project.phases.map((phase) => (
                    <Badge 
                      key={phase} 
                      variant="outline" 
                      className="hover-scale text-xs font-medium px-2 py-1"
                      style={{
                        backgroundColor: 
                          phase.toLowerCase().includes('planning') ? '#EDF0FE' :
                          phase.toLowerCase().includes('production') || phase.toLowerCase().includes('execution') ? '#fdf0cd' :
                          phase.toLowerCase().includes('post') || phase.toLowerCase().includes('wrap') ? '#f7c3ac' :
                          '#f3f4f6',
                        color:
                          phase.toLowerCase().includes('planning') ? '#183f9d' :
                          phase.toLowerCase().includes('production') || phase.toLowerCase().includes('execution') ? '#554511' :
                          phase.toLowerCase().includes('post') || phase.toLowerCase().includes('wrap') ? '#7e2e0b' :
                          '#374151',
                        borderColor: 'transparent'
                      }}
                    >
                      {phase}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
