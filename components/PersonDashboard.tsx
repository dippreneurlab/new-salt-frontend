'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { cloudStorage } from '@/lib/cloudStorage';
import BrandedHeader from './BrandedHeader';

interface User {
  email: string;
  name: string;
}

interface PersonDashboardProps {
  user: User;
  onLogout: () => void;
  onBackToHub: () => void;
  personName: string;
  onOpenProjectTask?: (quoteId: string, taskId: string) => void;
}

export default function PersonDashboard({ user, onLogout, onBackToHub, personName, onOpenProjectTask }: PersonDashboardProps) {
  const [quotes, setQuotes] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');

  useEffect(() => {
    try {
      const savedQuotes = cloudStorage.getItem('saltxc-all-quotes');
      if (savedQuotes) {
        const data = Array.isArray(savedQuotes) ? savedQuotes : JSON.parse(savedQuotes);
        setQuotes(data);
      }
    } catch (e) {
      console.error('Failed to load quotes for person dashboard', e);
    }
  }, []);

  const projectsForPerson = useMemo(() => {
    const list: Array<{ id: string; label: string }> = [];
    quotes.forEach((q) => {
      const projectLabel = `${q?.project?.clientName || q.clientName || 'Client'} — ${q?.project?.projectName || q.projectName || 'Project'}`;

      let hasAssignment = false;
      const ra = q?.pmData?.resourceAssignments;
      if (ra) {
        Object.values(ra).forEach((phaseAssignments: any) => {
          Object.values(phaseAssignments || {}).forEach((deptAssignments: any) => {
            (deptAssignments || []).forEach((assignment: any) => {
              if ((assignment.assignee || '').trim() === personName.trim()) {
                hasAssignment = true;
              }
            });
          });
        });
      }

      const wb = q?.pmData?.workback || [];
      if (!hasAssignment && wb.length > 0) {
        wb.forEach((section: any) => {
          (section.tasks || []).forEach((task: any) => {
            if ((task.owner || '').trim() === personName.trim()) {
              hasAssignment = true;
            }
          });
        });
      }

      if (hasAssignment) {
        list.push({ id: q.id, label: projectLabel });
      }
    });
    return list;
  }, [quotes, personName]);

  const now = useMemo(() => new Date(), []);
  const end = useMemo(() => new Date(now.getFullYear(), now.getMonth(), now.getDate() + 13), [now]);

  const days = useMemo(() => {
    const arr: Date[] = [];
    const d = new Date(now);
    for (let i = 0; i < 14; i++) {
      const day = new Date(d.getFullYear(), d.getMonth(), d.getDate() + i);
      arr.push(day);
    }
    return arr;
  }, [now]);

  const filteredQuotes = useMemo(() => {
    if (selectedProjectId === 'all') return quotes;
    return quotes.filter((q) => q.id === selectedProjectId);
  }, [quotes, selectedProjectId]);

  const deliverablesByDate = useMemo(() => {
    // Map yyyy-mm-dd -> array of { projectLabel, task }
    const map: Record<string, Array<{ project: string; task: any }>> = {};
    const startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const endTime = end.getTime();

    filteredQuotes.forEach((q) => {
      const projectLabel = `${q?.project?.clientName || q.clientName || 'Client'} — ${q?.project?.projectName || q.projectName || 'Project'}`;
      const wb = q?.pmData?.workback || [];
      wb.forEach((section: any) => {
        (section.tasks || []).forEach((task: any) => {
          if ((task.owner || '').trim() !== personName.trim()) return;
          if (!task.date) return;
          const dateObj = new Date(task.date);
          const time = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()).getTime();
          if (time >= startTime && time <= endTime) {
            const key = dateObj.toISOString().slice(0, 10);
            if (!map[key]) map[key] = [];
            map[key].push({ project: projectLabel, task });
          }
        });
      });
    });
    return map;
  }, [filteredQuotes, personName, now, end]);

  const weeklyAllocation = useMemo(() => {
    // Compute allocation for current week and next week based on resourceAssignments overlaps
    const startOfWeek = new Date(now);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay()); // Sunday start
    const startOfNextWeek = new Date(startOfWeek);
    startOfNextWeek.setDate(startOfNextWeek.getDate() + 7);
    const endOfNextWeek = new Date(startOfNextWeek);
    endOfNextWeek.setDate(endOfNextWeek.getDate() + 6);

    const ranges = [
      { label: 'This Week', start: startOfWeek, end: new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate() + 6) },
      { label: 'Next Week', start: startOfNextWeek, end: endOfNextWeek }
    ];

    return ranges.map((range) => {
      let total = 0;
      filteredQuotes.forEach((q) => {
        const ra = q?.pmData?.resourceAssignments;
        if (!ra) return;
        Object.values(ra).forEach((phaseAssignments: any) => {
          Object.values(phaseAssignments || {}).forEach((deptAssignments: any) => {
            (deptAssignments || []).forEach((assignment: any) => {
              if ((assignment.assignee || '').trim() !== personName.trim()) return;
              if (!assignment.startDate || !assignment.endDate) return;
              const aStart = new Date(assignment.startDate);
              const aEnd = new Date(assignment.endDate);
              // If overlaps week range, include allocation
              if (aStart <= range.end && aEnd >= range.start) {
                total += Number(assignment.allocation || 0);
              }
            });
          });
        });
      });
      // Cap at 100 for readability
      return { label: range.label, allocation: Math.min(100, total) };
    });
  }, [filteredQuotes, personName, now]);

  const monthlyAllocation = useMemo(() => {
    // Compute allocation for this month and next month based on resourceAssignments overlaps
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfThisMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const endOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0);

    const ranges = [
      { label: 'This Month', start: startOfThisMonth, end: endOfThisMonth },
      { label: 'Next Month', start: startOfNextMonth, end: endOfNextMonth }
    ];

    return ranges.map((range) => {
      let total = 0;
      filteredQuotes.forEach((q) => {
        const ra = q?.pmData?.resourceAssignments;
        if (!ra) return;
        Object.values(ra).forEach((phaseAssignments: any) => {
          Object.values(phaseAssignments || {}).forEach((deptAssignments: any) => {
            (deptAssignments || []).forEach((assignment: any) => {
              if ((assignment.assignee || '').trim() !== personName.trim()) return;
              if (!assignment.startDate || !assignment.endDate) return;
              const aStart = new Date(assignment.startDate);
              const aEnd = new Date(assignment.endDate);
              // If overlaps month range, include allocation
              if (aStart <= range.end && aEnd >= range.start) {
                total += Number(assignment.allocation || 0);
              }
            });
          });
        });
      });
      // Cap at 100 for readability
      return { label: range.label, allocation: Math.min(100, total) };
    });
  }, [filteredQuotes, personName, now]);

  const projectTimelines = useMemo(() => {
    // Build per-project chronological task lists for this person
    type TimelineItem = { date?: string; endDate?: string; name: string; status?: string; section?: string; taskId?: string };
    const result: Array<{ id: string; label: string; items: TimelineItem[] }> = [];
    filteredQuotes.forEach((q) => {
      const projectLabel = `${q?.project?.clientName || q.clientName || 'Client'} — ${q?.project?.projectName || q.projectName || 'Project'}`;
      const wb = q?.pmData?.workback || [];
      const items: TimelineItem[] = [];
      wb.forEach((section: any) => {
        (section.tasks || []).forEach((task: any) => {
          if ((task.owner || '').trim() !== personName.trim()) return;
          items.push({
            date: task.date,
            endDate: task.endDate,
            name: task.task,
            status: task.status,
            section: section.name,
            taskId: task.id
          });
        });
      });
      if (items.length > 0) {
        const withDateFirst = items.slice().sort((a, b) => {
          const ad = a.date ? new Date(a.date).getTime() : Number.POSITIVE_INFINITY;
          const bd = b.date ? new Date(b.date).getTime() : Number.POSITIVE_INFINITY;
          return ad - bd;
        });
        result.push({ id: q.id, label: projectLabel, items: withDateFirst });
      }
    });
    return result;
  }, [filteredQuotes, personName]);

  return (
    <div className="min-h-screen bg-gray-50">
      <BrandedHeader
        user={user}
        onLogout={onLogout}
        title={`Dashboard — ${personName}`}
        showBackButton={true}
        onBackClick={onBackToHub}
        backLabel="← Salt XC Hub"
      />

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Project Filter</CardTitle>
            <CardDescription className="text-sm">Limit the view to a single project</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center gap-3">
              <div className="min-w-64">
                <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Projects</SelectItem>
                    {projectsForPerson.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Next Two Weeks — Key Deliverables</CardTitle>
            <CardDescription className="text-sm">Tasks assigned to {personName}</CardDescription>
          </CardHeader>
          <CardContent className="pt-0 overflow-x-auto">
            <div className="min-w-max">
              <div className="grid" style={{ gridTemplateColumns: `repeat(${days.length}, 220px)` }}>
                {days.map((d, idx) => (
                  <div key={idx} className="border border-gray-200 rounded mr-2 mb-2 bg-white">
                    <div className="px-3 py-2 border-b bg-gray-50">
                      <div className="text-xs text-gray-500">{d.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                      <div className="text-sm font-medium">{d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                    </div>
                    <div className="p-2 space-y-2">
                      {(() => {
                        const key = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString().slice(0, 10);
                        const items = deliverablesByDate[key] || [];
                        if (items.length === 0) {
                          return <div className="text-xs text-gray-400 italic">No deliverables</div>;
                        }
                        return items.map((item, i) => (
                          <div key={i} className="p-2 rounded border bg-white hover:bg-gray-50">
                            <div className="text-xs text-gray-500 truncate">{item.project}</div>
                            <div className="text-sm font-medium truncate">{item.task.task}</div>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {projectTimelines.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {projectTimelines.map((proj) => (
              <div key={proj.id} className="border rounded bg-white">
                <div className="px-4 py-3 border-b bg-gray-50">
                  <div className="text-sm font-medium">{proj.label}</div>
                  <div className="text-xs text-gray-500">{proj.items.length} deliverable{proj.items.length !== 1 ? 's' : ''}</div>
                </div>
                <div className="p-3">
                  {proj.items.map((it, idx) => (
                    <button key={idx} className="flex items-start gap-3 py-2 border-b last:border-b-0 w-full text-left hover:bg-gray-50 rounded"
                      onClick={() => {
                        if (onOpenProjectTask && proj.id && it.taskId) {
                          onOpenProjectTask(proj.id, it.taskId);
                        }
                      }}
                    >
                      <div className="w-28 flex-shrink-0 text-xs text-gray-600">
                        {it.date ? new Date(it.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : <span className="italic text-gray-400">No date</span>}
                        {it.endDate && (
                          <div className="text-[10px] text-gray-400">→ {new Date(it.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{it.name || 'Untitled task'}</div>
                        <div className="text-[11px] text-gray-500 truncate">{it.section || 'Section'}</div>
                      </div>
                      {it.status && (
                        <div className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 border border-gray-200">
                          {it.status.replace('-', ' ')}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Resource Allocation</CardTitle>
            <CardDescription className="text-sm">Weekly allocation (top) and monthly allocation (below)</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {weeklyAllocation.map((w) => (
                <div key={w.label} className="p-4 border rounded bg-white">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium">{w.label}</div>
                    <div className="text-sm font-semibold">{w.allocation}%</div>
                  </div>
                  <div className="w-full h-2 bg-gray-200 rounded">
                    <div className="h-2 bg-blue-600 rounded" style={{ width: `${Math.min(100, Math.max(0, w.allocation))}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {monthlyAllocation.map((m) => (
                <div key={m.label} className="p-4 border rounded bg-white">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium">{m.label}</div>
                    <div className="text-sm font-semibold">{m.allocation}%</div>
                  </div>
                  <div className="w-full h-2 bg-gray-200 rounded">
                    <div className="h-2 bg-indigo-600 rounded" style={{ width: `${Math.min(100, Math.max(0, m.allocation))}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
