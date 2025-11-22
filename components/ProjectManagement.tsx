'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import BrandedHeader from './BrandedHeader';
import { getAllQuotes } from '@/utils/quoteManager';
import { Department } from '../types';
import { cloudStorage } from '@/lib/cloudStorage';

// Task type library based on Quote Hub stages
const TASK_TYPES = {
  planning: [
    { id: 'strategic-check-in', name: 'Strategic Check In', description: 'Initial strategic alignment and briefing', color: 'bg-blue-50 text-blue-700' },
    { id: 'strategy-presentation', name: 'Strategy Presentation', description: 'Present strategic direction and approach', color: 'bg-blue-50 text-blue-700' },
    { id: 'creative-tissue', name: 'Creative Tissue', description: 'Initial creative exploration and ideation', color: 'bg-blue-50 text-blue-700' },
    { id: 'refined-concepts', name: 'Refined Concepts', description: 'Develop and refine creative concepts', color: 'bg-blue-50 text-blue-700' },
    { id: 'final-concepts', name: 'Final Concepts', description: 'Finalize approved creative concepts', color: 'bg-blue-50 text-blue-700' }
  ],
  production: [
    { id: 'pre-production', name: 'Pre-Production', description: 'Planning and preparation for production', color: 'bg-yellow-50 text-yellow-700' },
    { id: 'production-setup', name: 'Production Setup', description: 'Set up production environment and resources', color: 'bg-yellow-50 text-yellow-700' },
    { id: 'content-creation', name: 'Content Creation', description: 'Create final content and deliverables', color: 'bg-green-100 text-green-800' },
    { id: 'quality-review', name: 'Quality Review', description: 'Review and approve content quality', color: 'bg-green-100 text-green-800' }
  ],
  'post-production': [
    { id: 'final-review', name: 'Final Review', description: 'Final client review and approval', color: 'bg-orange-100 text-orange-800' },
    { id: 'asset-delivery', name: 'Asset Delivery', description: 'Deliver final assets to client', color: 'bg-orange-100 text-orange-800' },
    { id: 'project-wrap', name: 'Project Wrap', description: 'Project completion and documentation', color: 'bg-orange-100 text-orange-800' },
    { id: 'post-mortem', name: 'Post-Mortem', description: 'Project review and learnings', color: 'bg-orange-100 text-orange-800' }
  ]
};

// Helper functions for phase colors - matching the Quote Hub system
const getPhaseColor = (phase: string) => {
  const normalizedPhase = phase.toLowerCase();
  if (normalizedPhase.includes('planning')) return 'text-[#183f9d]';
  if (normalizedPhase.includes('post') || normalizedPhase.includes('wrap')) return 'text-[#7e2e0b]';
  if (normalizedPhase.includes('production') || normalizedPhase.includes('execution')) return 'text-[#554511]';
  return 'text-[#183f9d]'; // default
};

const getPhaseBackgroundColor = (phase: string) => {
  const normalizedPhase = phase.toLowerCase();
  if (normalizedPhase.includes('planning')) return 'bg-[#EDF0FE]';
  if (normalizedPhase.includes('post') || normalizedPhase.includes('wrap')) return 'bg-[#f7c3ac]';
  if (normalizedPhase.includes('production') || normalizedPhase.includes('execution')) return 'bg-[#fdf0cd]';
  return 'bg-[#EDF0FE]'; // default
};

interface ProjectManagementProps {
  user: { email: string; name: string };
  onLogout: () => void;
  selectedQuoteId?: string;
  onBackToDashboard?: () => void;
  onOpenPerson?: (name: string) => void;
  scrollToTaskId?: string;
}

interface PMResourceAssignment {
  id: string;
  department: string;
  role: string;
  assignee: string;
  startDate: string;
  endDate: string;
  totalWeeks: number;
  allocation: number; // percentage
}

interface PMWorkbackSection {
  id: string;
  name: string;
  phase: string;
  tasks: Array<{ id: string; task: string; date: string; owner: string; status: 'not-started' | 'in-progress' | 'on-hold' | 'pending-approval' | 'completed'; notes: string; endDate?: string; duration?: number }>;
}

interface PMMilestone {
  id: string;
  name: string;
  start: string; // ISO date
  end: string;   // ISO date
  color?: string;
}

interface PMState {
  selectedQuoteId: string | null;
  briefDate: string;
  inMarketDate: string;
  projectCompletionDate: string;
  resourceAssignments: { [phase: string]: { [department: string]: PMResourceAssignment[] } };
  workback: PMWorkbackSection[];
  milestones: PMMilestone[];
  // Standalone project fields
  isStandalone?: boolean;
  standaloneProject?: {
    id: string;
    clientName: string;
    brand: string;
    projectName: string;
    projectNumber: string;
    startDate: string;
    endDate: string;
    phases: string[];
  };
}

// Staff data interface
interface StaffMember {
  name: string;
  department: string;
  jobTitle: string;
}

// Global staff data with immediate fallback
let STAFF_DATA: StaffMember[] = [
  // Immediate fallback data while CSV loads
  { name: 'Abby Gold', department: 'Creator', jobTitle: 'Supervisor, Creator Marketing' },
  { name: 'Adrian Valenzuela', department: 'Creative', jobTitle: 'Creative Director' },
  { name: 'Alex Buckby', department: 'Media', jobTitle: 'Vice President, Media' },
  { name: 'Amelia Rutledge', department: 'Accounts', jobTitle: 'Account Manager' },
  { name: 'Andrea Martino', department: 'Accounts', jobTitle: 'Account Supervisor' },
  { name: 'Andrew Moussa', department: 'Design', jobTitle: 'Senior Designer' },
  { name: 'Ashley Pratt', department: 'Accounts', jobTitle: 'Account Manager' },
  { name: 'Bary Hakim', department: 'Design', jobTitle: 'Design Director' },
  { name: 'Benjamin Gehlen', department: 'Design', jobTitle: 'Senior Design Director' },
  { name: 'Benny Fulton', department: 'Accounts', jobTitle: 'Account Coordinator' },
  { name: 'Ben Scott', department: 'Creative', jobTitle: 'Creative Director' },
  { name: 'Bianca Myers', department: 'Accounts', jobTitle: 'Managing Director, Client Service' },
  { name: 'Brad Van Schaik', department: 'Creative', jobTitle: 'Executive Creative Director' },
  { name: 'Brett Moon', department: 'Media', jobTitle: 'General Manager, Media' },
  { name: 'Brittany Niblett', department: 'Omni Shopper', jobTitle: 'Account Manager, Shopper Marketing' },
  { name: 'Caitlin O\'Brien', department: 'Media', jobTitle: 'Account Manager, Media' },
  { name: 'Carmen Skoretz', department: 'Design', jobTitle: '3D Designer' },
  { name: 'Caroline Law', department: 'Creator', jobTitle: 'Coordinator, Creator Marketing' },
  { name: 'Carol Purves', department: 'Accounts', jobTitle: 'Account Director' },
  { name: 'Casey Shapiro', department: 'Accounts', jobTitle: 'Account Supervisor' },
  { name: 'Chris Rochon', department: 'Content', jobTitle: 'Production Head, Salt Studios' },
  { name: 'CJ Nash', department: 'Design', jobTitle: 'Design Director' },
  { name: 'Clayton DuQuene', department: 'Design', jobTitle: 'Senior Designer' },
  { name: 'Cody Finney', department: 'Creative', jobTitle: 'Group Creative Director' },
  { name: 'Colton Horner', department: 'Digital', jobTitle: 'Director, Digital' },
  { name: 'Dane Hutton', department: 'Accounts', jobTitle: 'Senior Account Director' },
  { name: 'Daniel Bennett', department: 'Creative', jobTitle: 'Creative Director' },
  { name: 'David Tang', department: 'Design', jobTitle: 'Design Director, Shopper Marketing' },
  { name: 'Dean Hamann', department: 'Creative', jobTitle: 'Creative Director' },
  { name: 'Duncan Collis', department: 'Design', jobTitle: 'Design Director' },
  { name: 'Dylan Fleming', department: 'Accounts', jobTitle: 'Account Coordinator' },
  { name: 'Emma Henry', department: 'Accounts', jobTitle: 'Account Manager' },
  { name: 'Emma Hornsby', department: 'Accounts', jobTitle: 'Account Supervisor' },
  { name: 'Erica Boynton', department: 'Creative', jobTitle: 'Executive Creative Director' },
  { name: 'Garrett Mitchell', department: 'Media', jobTitle: 'Senior Director, Media' },
  { name: 'Gillian Newing', department: 'Creative', jobTitle: 'Associate Creative Director' },
  { name: 'Gillian Reason', department: 'Accounts', jobTitle: 'Account Manager' },
  { name: 'Gillian Scammell', department: 'Accounts', jobTitle: 'Account Director' },
  { name: 'Grace Murphy', department: 'Accounts', jobTitle: 'Account Coordinator' },
  { name: 'Haley Tice', department: 'Accounts', jobTitle: 'Account Manager' },
  { name: 'Hannah Chang', department: 'Accounts', jobTitle: 'Account Coordinator' },
  { name: 'Harris Butkovich', department: 'Accounts', jobTitle: 'Account Executive' },
  { name: 'Honor Wood', department: 'Accounts', jobTitle: 'Account Coordinator' },
  { name: 'Hunter Surphlis', department: 'Media', jobTitle: 'Account Manager, Media' },
  { name: 'Hussein Popat', department: 'Media', jobTitle: 'Senior Director, Media' },
  { name: 'Ilana Gotz', department: 'Design', jobTitle: 'Design Director' },
  { name: 'Iman Ghader', department: 'Design', jobTitle: 'Design Director' },
  { name: 'Isabella Tomassi', department: 'Accounts', jobTitle: 'Account Coordinator' },
  { name: 'Jack Bowman', department: 'Digital', jobTitle: 'User Experience Lead' },
  { name: 'Jake Hooper', department: 'Accounts', jobTitle: 'Account Coordinator' },
  { name: 'James Peng', department: 'Design', jobTitle: 'Designer' },
  { name: 'Jared Kinsella', department: 'Design', jobTitle: 'Design Director' },
  { name: 'Jared Wineberg', department: 'Strategy', jobTitle: 'Strategist' },
  { name: 'Jeff Pontes', department: 'Digital', jobTitle: 'Senior Vice President, Digital Strategy & CX Consulting' },
  { name: 'Jenna Greenspoon', department: 'Accounts', jobTitle: 'Account Executive' },
  { name: 'Jennifer Sintime', department: 'Strategy', jobTitle: 'Director, Strategy' },
  { name: 'Jessica Leong', department: 'Design', jobTitle: 'Senior Design Director' },
  { name: 'Jessica Pearlman', department: 'Media', jobTitle: 'Senior Account Director, Media' },
  { name: 'Jordan Bortolotti', department: 'Media', jobTitle: 'President, Salt Media' },
  { name: 'Juan Ariado', department: 'Creative', jobTitle: 'Associate Creative Director' },
  { name: 'Kara Anthony', department: 'Accounts', jobTitle: 'Account Executive' },
  { name: 'Kara Oddi', department: 'Accounts', jobTitle: 'Account Supervisor' },
  { name: 'Kareem Halfawi', department: 'Creative', jobTitle: 'Creative Director' },
  { name: 'Karen Flanagan', department: 'Accounts', jobTitle: 'Vice President/Managing Director' },
  { name: 'Karsten O\'Neill-Larsen', department: 'Digital', jobTitle: 'Developer' },
  { name: 'Kat Nicholson', department: 'Accounts', jobTitle: 'Account Supervisor' },
  { name: 'Kelly MacDonald', department: 'Accounts', jobTitle: 'Account Supervisor' },
  { name: 'Krishna Solanki', department: 'Digital', jobTitle: 'Intermediate Developer' },
  { name: 'Kylie Barkin', department: 'Social', jobTitle: 'Social Media Specialist' },
  { name: 'Laura Richardson', department: 'Accounts', jobTitle: 'Account Director' },
  { name: 'Lauren Hebert', department: 'Accounts', jobTitle: 'Account Executive' },
  { name: 'Lauren Schell', department: 'Content', jobTitle: 'Senior Producer' },
  { name: 'Lucas Mastromattei', department: 'Accounts', jobTitle: 'Account Manager' },
  { name: 'Lucy McGovern', department: 'Accounts', jobTitle: 'Account Manager' },
  { name: 'MacKenzie Thomson', department: 'Content', jobTitle: 'Executive Producer' },
  { name: 'Maggie Curran', department: 'Social', jobTitle: 'Social Media Manager' },
  { name: 'Marc Tedesco', department: 'Accounts', jobTitle: 'Account Manager' },
  { name: 'Mark Delisi', department: 'Creative', jobTitle: 'Creative Director' },
  { name: 'Matthew Valenzano', department: 'Creative', jobTitle: 'Creative Director' },
  { name: 'Max Brannen', department: 'Accounts', jobTitle: 'Account Coordinator' },
  { name: 'Max Fulton', department: 'Accounts', jobTitle: 'Account Executive' },
  { name: 'Mckenzie Holden', department: 'Accounts', jobTitle: 'Account Manager' },
  { name: 'Megan Doll', department: 'Accounts', jobTitle: 'Account Supervisor' },
  { name: 'Meg Southgate', department: 'Accounts', jobTitle: 'Account Director' },
  { name: 'Mike Beene', department: 'Design', jobTitle: 'Senior 3D Design Director' },
  { name: 'Mikey Membreno', department: 'Design', jobTitle: 'Senior Designer' },
  { name: 'Natalie Festa', department: 'Accounts', jobTitle: 'Director of Operations' },
  { name: 'Natalie Racz', department: 'Creative', jobTitle: 'Creative Director' },
  { name: 'Nathan Brown', department: 'Accounts', jobTitle: 'Account Director' },
  { name: 'Nick Frizzell', department: 'Accounts', jobTitle: 'Account Manager' },
  { name: 'Nicole Jesty', department: 'Accounts', jobTitle: 'Account Manager' },
  { name: 'Nikki Cook', department: 'Accounts', jobTitle: 'Account Manager' },
  { name: 'Paul Dela Merced', department: 'Creative', jobTitle: 'Creative Director' },
  { name: 'Phil Heim', department: 'Media', jobTitle: 'Director, SEM' },
  { name: 'Phoebe Heslop', department: 'Accounts', jobTitle: 'Account Director' },
  { name: 'Puneet Badh', department: 'Media', jobTitle: 'Director, Media' },
  { name: 'Rachel Alexander', department: 'Accounts', jobTitle: 'Account Director' },
  { name: 'Rachel Branco', department: 'Accounts', jobTitle: 'Account Director' },
  { name: 'Randy Westcott', department: 'Design', jobTitle: 'Design Director' },
  { name: 'Raquelle Castillo', department: 'Digital', jobTitle: 'Junior Digital Project Manager' },
  { name: 'Rena Menkes Hula', department: 'Creative', jobTitle: 'Executive Creative Director' },
  { name: 'Richard Dao', department: 'Creative', jobTitle: 'Creative Director' },
  { name: 'Rob Simone', department: 'Design', jobTitle: 'Senior Design Director' },
  { name: 'Samantha Fajardo', department: 'Digital', jobTitle: 'Senior Digital Producer' },
  { name: 'Sam Davis', department: 'Social', jobTitle: 'Supervisor, Social Media' },
  { name: 'Samone Murphy', department: 'Design', jobTitle: 'Design Director' },
  { name: 'Sandra Renwick', department: 'Accounts', jobTitle: 'Senior Account Director' },
  { name: 'Sarah Black', department: 'Accounts', jobTitle: 'Account Coordinator' },
  { name: 'Sarah Murray', department: 'Accounts', jobTitle: 'Account Manager' },
  { name: 'Sasha Newton', department: 'Creative', jobTitle: 'Creative Director' },
  { name: 'Scott Rodgers', department: 'Design', jobTitle: 'Senior 3D Designer' },
  { name: 'Shane Rodak', department: 'Creative', jobTitle: 'Associate Creative Director' },
  { name: 'Shelton D\'souza', department: 'Design', jobTitle: 'Design Director' },
  { name: 'Skylar Bradley', department: 'Accounts', jobTitle: 'Account Executive' },
  { name: 'Steve Benetti', department: 'Accounts', jobTitle: 'Senior Account Director' },
  { name: 'Sydney Doyle', department: 'Accounts', jobTitle: 'Account Executive' },
  { name: 'Sylvie Harper', department: 'Accounts', jobTitle: 'Account Manager' },
  { name: 'Thivaaj Pathmanathan', department: 'Accounts', jobTitle: 'Account Executive' },
  { name: 'Toni Raines', department: 'Accounts', jobTitle: 'Account Executive' },
  { name: 'Waleed Bachnak', department: 'Creative', jobTitle: 'Associate Creative Director' },
  { name: 'William Boyle', department: 'Accounts', jobTitle: 'Account Manager' },
  { name: 'Zoe Campanaro', department: 'Accounts', jobTitle: 'Account Manager' }
];

// Function to parse CSV data with better error handling
const parseCSV = (csvText: string): StaffMember[] => {
  try {
    const lines = csvText.split('\n');
    const staff: StaffMember[] = [];
    
    // Skip header row
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line === ',,') continue; // Skip empty lines
      
      // Handle CSV parsing with proper quote handling
      const matches = line.match(/(".*?"|[^,]*),(".*?"|[^,]*),(".*?"|[^,]*)/);
      if (matches) {
        const [, name, department, jobTitle] = matches.map(field => 
          field.replace(/^"/, '').replace(/"$/, '').trim()
        );
        
        if (name && department && jobTitle) {
          staff.push({ name, department, jobTitle });
        }
      }
    }
    
    return staff;
  } catch (error) {
    console.error('Error parsing CSV:', error);
    return [];
  }
};

// Function to load staff data with timeout
const loadStaffData = async () => {
  try {
    console.log('🔄 Loading staff data from CSV...');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const response = await fetch('/Salt_staff.csv', { 
      signal: controller.signal,
      cache: 'no-cache'
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const csvText = await response.text();
    const parsedStaff = parseCSV(csvText);
    
    if (parsedStaff.length > 0) {
      STAFF_DATA = parsedStaff;
      console.log('✅ Staff data loaded successfully:', STAFF_DATA.length, 'members');
    } else {
      console.warn('⚠️ No staff data parsed from CSV, using fallback data');
    }
  } catch (error) {
    console.error('❌ Failed to load staff data:', error);
    console.log('📋 Using fallback staff data:', STAFF_DATA.length, 'members');
  }
};

// Function to get all staff names for auto-complete
const getAllStaffNames = (): string[] => {
  return STAFF_DATA.map(staff => staff.name).sort();
};

// Auto-complete component for assignee selection
const AutoCompleteAssignee = ({ 
  value, 
  onChange, 
  placeholder = "Type to search..." 
}: { 
  value: string; 
  onChange: (value: string) => void; 
  placeholder?: string; 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filteredOptions, setFilteredOptions] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const allStaff = getAllStaffNames();

  // Filter options based on input value
  const filterOptions = (inputValue: string) => {
    if (!inputValue.trim()) {
      setFilteredOptions([]);
      return;
    }
    
    const filtered = allStaff.filter(name => 
      name.toLowerCase().includes(inputValue.toLowerCase())
    );
    setFilteredOptions(filtered.slice(0, 10)); // Limit to 10 suggestions
  };

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    filterOptions(newValue);
    setIsOpen(true);
  };

  // Handle option selection
  const handleOptionSelect = (option: string) => {
    onChange(option);
    setIsOpen(false);
    setFilteredOptions([]);
  };

  // Handle input focus
  const handleFocus = () => {
    if (value.trim()) {
      filterOptions(value);
      setIsOpen(true);
    }
  };

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <Input
        ref={inputRef}
        value={value}
        onChange={handleInputChange}
        onFocus={handleFocus}
        placeholder={placeholder}
        className="h-8 px-2 text-xs"
      />
      
      {isOpen && filteredOptions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-40 overflow-y-auto">
          {filteredOptions.map((option) => (
            <div
              key={option}
              className="px-3 py-2 text-xs cursor-pointer hover:bg-gray-100"
              onClick={() => handleOptionSelect(option)}
            >
              {option}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Function to get people for a specific role and department with precise matching
const getPeopleForRole = (role: string, department?: string): string[] => {
  console.log('🔍 getPeopleForRole called:', { role, department, staffDataLength: STAFF_DATA.length });
  
  if (!role.trim()) {
    const allStaff = STAFF_DATA.map(staff => staff.name).sort();
    console.log('📋 Returning all staff (empty role):', allStaff.length);
    return allStaff;
  }
  
  const searchRole = role.toLowerCase().trim();
  
  // Find staff members whose job title matches precisely, considering department
  let candidateStaff = STAFF_DATA;
  
  // Filter by department first if provided
  if (department) {
    candidateStaff = STAFF_DATA.filter(staff => 
      staff.department.toLowerCase() === department.toLowerCase()
    );
  }
  
  const matchingStaff = candidateStaff.filter(staff => {
    const jobTitle = staff.jobTitle.toLowerCase();
    
    // Exact match first
    if (jobTitle === searchRole) {
      return true;
    }
    
    // Handle specific role mappings to avoid confusion
    const roleMap: { [key: string]: string[] } = {
      'account coordinator': ['account coordinator'],
      'account executive': ['account executive'],
      'account manager': ['account manager'],
      'account supervisor': ['account supervisor'],
      'account director': ['account director', 'senior account director'],
      'managing director': ['managing director'],
      'vice president': ['vice president'],
      'senior account director': ['senior account director'],
      
      'creative director': ['creative director'],
      'associate creative director': ['associate creative director'],
      'executive creative director': ['executive creative director'],
      'group creative director': ['group creative director'],
      'creative': ['creative', 'senior creative'],
      'copywriter': ['copywriter'],
      'conceptor': ['conceptor'], // Exact match only - no one has this title currently
      
      'design director': ['design director'],
      'senior design director': ['senior design director', 'sr. design director'],
      'associate design director': ['associate design director'],
      'designer': ['designer'],
      'senior designer': ['senior designer'],
      '3d designer': ['3d designer'],
      'senior 3d designer': ['senior 3d designer'],
      
      'producer': ['producer'],
      'senior producer': ['senior producer', 'sr producer'],
      'executive producer': ['executive producer'],
      'production coordinator': ['production coordinator'],
      'production manager': ['production manager'],
      'production director': ['production director'],
      
      'strategist': ['strategist'],
      'senior strategist': ['senior strategist'],
      'director strategy': ['director, strategy'],
      'senior director strategy': ['senior director, strategy'],
      'director, strategy / planning': ['director, strategy / planning'],
      'sr director, strategy / planning': ['sr director, strategy / planning'],
      'senior director, strategy / planning': ['senior director, strategy / planning'],
      
      'media coordinator': ['media coordinator'],
      'media manager': ['media manager'],
      'media director': ['media director', 'director, media'],
      'senior director media': ['senior director, media'],
      'director, media': ['director, media'],
      'senior director, media': ['senior director, media'],
      
      'developer': ['developer'],
      'junior developer': ['junior developer', 'jr. developer'],
      'intermediate developer': ['intermediate developer', 'mid developer'],
      'senior developer': ['senior developer', 'sr. developer'],
      'digital project manager': ['digital project manager'],
      'junior digital project manager': ['junior digital project manager'],
      'senior digital project manager': ['senior digital project manager'],
      
      'social media specialist': ['social media specialist'],
      'social media manager': ['social media manager'],
      'community manager': ['community manager'],
      
      'coordinator': ['coordinator'],
      'manager': ['manager'],
      'director': ['director'], // Exact match only - excludes "Senior Director", "Associate Director", etc.
      'senior director': ['senior director'],
      'associate director': ['associate director'],
      'supervisor': ['supervisor'],
      'executive': ['executive']
    };
    
    // Check if the search role has specific mappings
    const mappedTitles = roleMap[searchRole];
    if (mappedTitles) {
      return mappedTitles.some(title => {
        // Exact match only - no partial matching to prevent confusion
        return jobTitle === title || 
               jobTitle === title.replace(/,/g, '').trim() || // Handle comma/space variations
               jobTitle.replace(/,/g, '').trim() === title;
      });
    }
    
    // For unmapped roles, only allow exact matches to prevent confusion
    // No partial matching to avoid "Director" matching "Senior Director"
    return jobTitle === searchRole;
  });
  
  if (matchingStaff.length > 0) {
    const result = matchingStaff.map(staff => staff.name).sort();
    console.log('✅ Found matching staff:', result);
    return result;
  }
  
  // If no exact matches found, only return people from the same department (if department is provided)
  // This prevents broad matching that shows irrelevant people
  if (department) {
    const departmentStaff = STAFF_DATA.filter(staff => 
      staff.department.toLowerCase() === department.toLowerCase()
    );
    
    // Only return department staff if the role seems like it could be in that department
    // But be very conservative to avoid showing wrong people
    const conservativeMatches = departmentStaff.filter(staff => {
      const jobTitle = staff.jobTitle.toLowerCase();
      
      // Only match if there's a clear word overlap AND it's the right department
      const roleWords = searchRole.split(' ');
      const titleWords = jobTitle.split(' ');
      
      // Check for exact word matches (not partial)
      const hasExactWordMatch = roleWords.some(roleWord => 
        titleWords.some(titleWord => titleWord === roleWord)
      );
      
      return hasExactWordMatch;
    });
    
    if (conservativeMatches.length > 0) {
      const result = conservativeMatches.map(staff => staff.name).sort();
      console.log('⚠️ Using conservative department matches:', result);
      return result;
    }
  }
  
  // If no matches at all, return all staff as fallback so dropdowns aren't empty
  // This ensures users can still select someone even if role matching fails
  console.log('❌ No matches found, returning all staff as fallback');
  return STAFF_DATA.map(staff => staff.name).sort();
};

// Updated font sizes to text-base (16px) for better readability
export default function ProjectManagement({ user, onLogout, selectedQuoteId, onBackToDashboard, onOpenPerson, scrollToTaskId }: ProjectManagementProps) {
  const [quotes, setQuotes] = useState<any[]>([]);
  const [state, setState] = useState<PMState>(() => ({
    selectedQuoteId: selectedQuoteId || null,
    briefDate: '',
    inMarketDate: '',
    projectCompletionDate: '',
    resourceAssignments: {},
    workback: [],
    milestones: [],
    isStandalone: false
  }));

  const [currentStep, setCurrentStep] = useState<'project-details' | 'workback-schedule' | 'resource-assignment' | 'gantt-chart' | 'reference-materials'>('project-details');
  const [lastSaved, setLastSaved] = useState<string>('');
  const [draggedTaskType, setDraggedTaskType] = useState<any>(null);
  const [resourcesAutoPopulated, setResourcesAutoPopulated] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [draggedTask, setDraggedTask] = useState<{sectionId: string, taskId: string} | null>(null);
  const [dragStartX, setDragStartX] = useState<number>(0);
  const [dragStartWidth, setDragStartWidth] = useState<number>(0);
  const [dragStartPosition, setDragStartPosition] = useState<number>(0);
  const [dragMode, setDragMode] = useState<'move' | 'resize' | null>(null);
  const [showSetupModal, setShowSetupModal] = useState<boolean>(false);
  const [standaloneProjects, setStandaloneProjects] = useState<any[]>([]);
  // Calendar state
  const [calendarMonths, setCalendarMonths] = useState<number>(2);
  const [calendarStartDate, setCalendarStartDate] = useState<Date>(() => {
    const d = state.inMarketDate ? new Date(state.inMarketDate) : new Date();
    d.setDate(1);
    return d;
  });
  const [newMilestoneName, setNewMilestoneName] = useState<string>('');
  const [draggingMilestone, setDraggingMilestone] = useState<{ id: string; mode: 'move' | 'resize-start' | 'resize-end' } | null>(null);

  // Save Project Management data
  const handleSave = () => {
    if (!selectedQuote) {
      console.log('❌ Cannot save: no project selected');
      return;
    }

    try {
      if (state.isStandalone && state.standaloneProject) {
        // Save standalone project
        const updatedProject = {
          ...state.standaloneProject,
          briefDate: state.briefDate,
          inMarketDate: state.inMarketDate,
          projectCompletionDate: state.projectCompletionDate,
          pmData: {
            resourceAssignments: state.resourceAssignments,
            workback: state.workback,
            milestones: state.milestones,
            lastModified: new Date().toISOString()
          }
        };

        const allStandalone = [...standaloneProjects];
        const existingIndex = allStandalone.findIndex(p => p.id === updatedProject.id);
        if (existingIndex >= 0) {
          allStandalone[existingIndex] = updatedProject;
        } else {
          allStandalone.push(updatedProject);
        }
        
        cloudStorage.setItem('saltxc-standalone-projects', JSON.stringify(allStandalone));
        setStandaloneProjects(allStandalone);
      } else {
        // Save quote-based project
      const updatedQuote = {
        ...selectedQuote,
        briefDate: state.briefDate,
        inMarketDate: state.inMarketDate,
        projectCompletionDate: state.projectCompletionDate,
        pmData: {
          resourceAssignments: state.resourceAssignments,
          workback: state.workback,
            milestones: state.milestones,
          lastModified: new Date().toISOString()
        }
      };

      const allQuotes = getAllQuotes();
      const updatedQuotes = allQuotes.map(quote => 
        quote.id === selectedQuote.id ? updatedQuote : quote
      );
      cloudStorage.setItem('saltxc-all-quotes', JSON.stringify(updatedQuotes));

        // Dispatch event so PM Dashboard knows to refresh
        try {
          window.dispatchEvent(new Event('saltxc-quotes-updated'));
          console.log('📣 Dispatched saltxc-quotes-updated event');
        } catch (e) {
          console.error('Failed to dispatch event:', e);
        }

      // Update local state
      setQuotes(updatedQuotes);
      }

      // Show success notification
      const now = new Date().toLocaleTimeString();
      setLastSaved(now);
      
      const notification = document.createElement('div');
      notification.textContent = '✅ Project Management data saved successfully!';
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10b981;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        z-index: 1000;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      `;
      document.body.appendChild(notification);
      
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 3000);

      console.log('✅ Project Management data saved successfully');
    } catch (error) {
      console.error('Failed to save Project Management data:', error);
      alert('Failed to save data. Please try again.');
    }
  };

  // Drag and drop handlers for task types
  const handleDragStart = (e: React.DragEvent, taskType: any) => {
    console.log('🚀 Drag started:', taskType.name);
    console.log('🚀 Drag event:', e);
    setDraggedTaskType(taskType);
    setIsDragging(true);
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('text/plain', taskType.name);
  };

  const handleDragEnd = () => {
    console.log('🏁 Drag ended');
    setIsDragging(false);
    setDraggedTaskType(null);
  };

  // Gantt Chart Drag Handlers
  const handleGanttBarDragStart = (e: React.MouseEvent, sectionId: string, taskId: string, currentWidth: number, currentPosition: number, isResizeHandle: boolean = false) => {
    e.preventDefault();
    e.stopPropagation();
    
    setDraggedTask({ sectionId, taskId });
    setDragStartX(e.clientX);
    setDragStartWidth(currentWidth);
    setDragStartPosition(currentPosition);
    setDragMode(isResizeHandle ? 'resize' : 'move');
    setIsDragging(true);
  };

  const handleGanttBarDragMove = (e: React.MouseEvent) => {
    if (!draggedTask || !isDragging || !dragMode) return;
    
    const deltaX = e.clientX - dragStartX;
    
    // Update the task in real-time (visual feedback)
    const task = state.workback
      .find(section => section.id === draggedTask.sectionId)
      ?.tasks.find(task => task.id === draggedTask.taskId);
    
    if (task) {
      if (dragMode === 'resize') {
        // Resize mode: adjust duration
        const newWidth = Math.max(20, dragStartWidth + deltaX); // Minimum 20px width
        const newDurationWeeks = Math.round(newWidth / 40 * 10) / 10; // Round to 1 decimal
        const newDurationDays = Math.round(newDurationWeeks * 7);
        
        // Update task date to reflect new duration
        const currentDate = task.date ? new Date(task.date) : new Date();
        const newEndDate = new Date(currentDate);
        newEndDate.setDate(newEndDate.getDate() + newDurationDays);
        
        // Update the task in state
        updateWorkbackTask(draggedTask.sectionId, draggedTask.taskId, {
          date: currentDate.toISOString().split('T')[0],
          endDate: newEndDate.toISOString().split('T')[0],
          duration: newDurationWeeks
        });
      } else if (dragMode === 'move') {
        // Move mode: adjust start date
        const weeksDelta = Math.round(deltaX / 40 * 10) / 10; // Round to 1 decimal
        const daysDelta = Math.round(weeksDelta * 7);
        
        const currentDate = task.date ? new Date(task.date) : new Date();
        const newStartDate = new Date(currentDate);
        newStartDate.setDate(newStartDate.getDate() + daysDelta);
        
        // Calculate new end date based on current duration
        const currentDuration = task.duration || 1;
        const durationDays = Math.round(currentDuration * 7);
        const newEndDate = new Date(newStartDate);
        newEndDate.setDate(newEndDate.getDate() + durationDays);
        
        // Update the task in state
        updateWorkbackTask(draggedTask.sectionId, draggedTask.taskId, {
          date: newStartDate.toISOString().split('T')[0],
          endDate: newEndDate.toISOString().split('T')[0],
          duration: currentDuration
        });
      }
    }
  };

  const handleGanttBarDragEnd = () => {
    setDraggedTask(null);
    setDragStartX(0);
    setDragStartWidth(0);
    setDragStartPosition(0);
    setDragMode(null);
    setIsDragging(false);
  };

  // Add mouse event listeners for Gantt chart drag handling
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (draggedTask && isDragging) {
        handleGanttBarDragMove(e as any);
      }
    };

    const handleMouseUp = () => {
      if (draggedTask && isDragging) {
        handleGanttBarDragEnd();
      }
    };

    if (isDragging && draggedTask) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggedTask, isDragging, dragStartX, dragStartWidth]);

  // Auto-scroll to a specific task in Workback when opening from Person Dashboard
  useEffect(() => {
    if (!scrollToTaskId) return;
    // Expand Workback tab
    setCurrentStep('workback-schedule');
    // Give time for the DOM to render
    const timeout = setTimeout(() => {
      const el = document.querySelector(`[data-task-id="${scrollToTaskId}"]`);
      if (el && 'scrollIntoView' in el) {
        (el as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' });
        (el as HTMLElement).classList.add('ring-2', 'ring-blue-400');
        setTimeout(() => {
          (el as HTMLElement).classList.remove('ring-2', 'ring-blue-400');
        }, 2000);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [scrollToTaskId]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    console.log('🎯 Drag over detected on:', e.currentTarget);
  };

  const handleDrop = (e: React.DragEvent, sectionId: string) => {
    e.preventDefault();
    
    console.log('🎯 handleDrop called:', { 
      draggedTaskType, 
      sectionId, 
      workbackSections: state.workback.length,
      workbackIds: state.workback.map(s => s.id)
    });
    
    if (!draggedTaskType) {
      console.log('❌ No dragged task type');
      return;
    }

    // Create sample tasks based on the dragged task type
    const sampleTasks = generateSampleTasks(draggedTaskType);
    console.log('📋 Generated sample tasks:', sampleTasks);

    // Find the phase for the existing section to create a new section in the same phase
    const existingSection = state.workback.find(section => section.id === sectionId);
    if (!existingSection) {
      console.log('❌ Could not find existing section');
      return;
    }

    // Create a new section with the sample tasks
    const newSectionId = crypto.randomUUID();
    const newSection = {
      id: newSectionId,
      name: `${draggedTaskType.name} Tasks`,
      phase: existingSection.phase,
      tasks: sampleTasks
    };

    console.log('📋 Creating new section:', newSection);

    setState(prev => ({
      ...prev,
      workback: [...prev.workback, newSection]
    }));

    setIsDragging(false);
    setDraggedTaskType(null);
    console.log('✅ New section created with tasks:', sampleTasks);
  };

  // Generate sample tasks based on task type
  const generateSampleTasks = (taskType: any) => {
    const baseTask = {
      id: Date.now().toString(),
      task: taskType.name,
      date: '',
      owner: '',
      status: 'not-started' as const,
      notes: taskType.description
    };

    // Generate 2-3 sample subtasks based on the task type
    const sampleTasks = [baseTask];
    
    switch (taskType.id) {
      case 'strategic-check-in':
        sampleTasks.push(
          {
            ...baseTask,
            id: (Date.now() + 1).toString(),
            task: 'Review client brief and requirements',
            notes: 'Thoroughly read through client brief and identify key requirements'
          },
          {
            ...baseTask,
            id: (Date.now() + 2).toString(),
            task: 'Stakeholder alignment meeting',
            notes: 'Meet with key stakeholders to align on project objectives'
          }
        );
        break;
      
      case 'creative-tissue':
        sampleTasks.push(
          {
            ...baseTask,
            id: (Date.now() + 1).toString(),
            task: 'Initial concept brainstorming',
            notes: 'Generate 10-15 initial creative concepts'
          },
          {
            ...baseTask,
            id: (Date.now() + 2).toString(),
            task: 'Creative presentation preparation',
            notes: 'Prepare creative presentation materials and mockups'
          },
          {
            ...baseTask,
            id: (Date.now() + 3).toString(),
            task: 'Internal creative review',
            notes: 'Present concepts internally for feedback and refinement'
          }
        );
        break;
      
      case 'content-creation':
        sampleTasks.push(
          {
            ...baseTask,
            id: (Date.now() + 1).toString(),
            task: 'Asset creation and production',
            notes: 'Create final creative assets and content'
          },
          {
            ...baseTask,
            id: (Date.now() + 2).toString(),
            task: 'Quality assurance review',
            notes: 'Review all content for quality, accuracy, and brand compliance'
          },
          {
            ...baseTask,
            id: (Date.now() + 3).toString(),
            task: 'Client review and feedback',
            notes: 'Present content to client for review and feedback'
          }
        );
        break;
      
      case 'final-review':
        sampleTasks.push(
          {
            ...baseTask,
            id: (Date.now() + 1).toString(),
            task: 'Final client presentation',
            notes: 'Present final deliverables to client for approval'
          },
          {
            ...baseTask,
            id: (Date.now() + 2).toString(),
            task: 'Revisions and refinements',
            notes: 'Implement any final revisions based on client feedback'
          }
        );
        break;
      
      default:
        // For other task types, add 1-2 generic subtasks
        sampleTasks.push(
          {
            ...baseTask,
            id: (Date.now() + 1).toString(),
            task: `${taskType.name} - Phase 1`,
            notes: `Initial phase of ${taskType.name.toLowerCase()}`
          },
          {
            ...baseTask,
            id: (Date.now() + 2).toString(),
            task: `${taskType.name} - Final Review`,
            notes: `Final review and completion of ${taskType.name.toLowerCase()}`
          }
        );
    }

    return sampleTasks;
  };

  // Load quotes from Quote Hub (cloudStorage) and staff data
  useEffect(() => {
    const all = getAllQuotes();
    setQuotes(all);
    loadStaffData();
    
    // Load standalone projects
    const savedStandalone = cloudStorage.getItem('saltxc-standalone-projects');
    if (savedStandalone) {
      const projects = JSON.parse(savedStandalone);
      setStandaloneProjects(projects);
      
      // Check if selectedQuoteId is actually a standalone project
      if (selectedQuoteId) {
        const standaloneProject = projects.find((p: any) => p.id === selectedQuoteId);
        if (standaloneProject) {
          setState(prev => ({
            ...prev,
            isStandalone: true,
            standaloneProject: standaloneProject,
            selectedQuoteId: null,
            briefDate: standaloneProject.briefDate || '',
            inMarketDate: standaloneProject.inMarketDate || '',
            projectCompletionDate: standaloneProject.projectCompletionDate || '',
            resourceAssignments: standaloneProject.pmData?.resourceAssignments || {},
            workback: standaloneProject.pmData?.workback || [],
            milestones: standaloneProject.pmData?.milestones || []
          }));
        }
      }
    }
  }, [selectedQuoteId]);

  const uniqueResourcedPeople = useMemo(() => {
    const names = new Set<string>();
    Object.values(state.resourceAssignments || {}).forEach((phaseAssignments) => {
      Object.values(phaseAssignments || {}).forEach((deptAssignments) => {
        (deptAssignments || []).forEach((assignment) => {
          const name = (assignment.assignee || '').trim();
          if (name) names.add(name);
        });
      });
    });
    return Array.from(names).sort();
  }, [state.resourceAssignments]);

  // Auto-populate project data when selectedQuoteId is provided
  useEffect(() => {
    if (state.selectedQuoteId && quotes.length > 0) {
      const selectedQuote = quotes.find(q => q.id === state.selectedQuoteId);
      if (selectedQuote) {
        // Load saved PM data if it exists (this takes priority)
        if (selectedQuote.pmData?.resourceAssignments) {
          setState(prev => ({
            ...prev,
            selectedQuoteId: state.selectedQuoteId,
            briefDate: selectedQuote.briefDate || '',
            inMarketDate: selectedQuote.inMarketDate || '',
            projectCompletionDate: selectedQuote.projectCompletionDate || '',
            resourceAssignments: selectedQuote.pmData.resourceAssignments,
            workback: selectedQuote.pmData.workback || [],
            milestones: selectedQuote.pmData.milestones || []
          }));
          setResourcesAutoPopulated(true); // Mark as populated since we loaded saved data
        } else {
          // Only auto-populate from phase data if no saved PM data exists
          setState(prev => ({
            ...prev,
            selectedQuoteId: state.selectedQuoteId,
            briefDate: selectedQuote.briefDate || '',
            inMarketDate: selectedQuote.inMarketDate || '',
            projectCompletionDate: selectedQuote.projectCompletionDate || ''
          }));

          // Auto-populate resources from the quote's project fees
          if (selectedQuote.phaseData) {
          const initialResourceAssignments: { [phase: string]: { [department: string]: PMResourceAssignment[] } } = {};
          
          Object.keys(selectedQuote.phaseData).forEach(phase => {
            const stages = selectedQuote.phaseData[phase]; // Array of stages

            
            if (stages && Array.isArray(stages)) {
              initialResourceAssignments[phase] = {};
              
              // Consolidate roles across all stages in this phase
              const consolidatedRoles: { [department: string]: { [role: string]: { totalWeeks: number; totalHours: number; totalDollars: number; allocation: number } } } = {};
              
              // Also track department assignments
              const departmentAssignments: { [department: string]: { assignedTo?: string; assignedName?: string } } = {};
              
              stages.forEach(stage => {
                stage.departments.forEach((department: Department) => {
                  
                  if (!consolidatedRoles[department.name]) {
                    consolidatedRoles[department.name] = {};
                  }
                  
                  // Store department assignment info (use first assignment found)
                  if (department.assignedTo && !departmentAssignments[department.name]) {
                    departmentAssignments[department.name] = {
                      assignedTo: department.assignedTo,
                      assignedName: department.assignedName
                    };

                  }
                  
                  department.roles.forEach(role => {
                    
                    if (!consolidatedRoles[department.name][role.name]) {
                      consolidatedRoles[department.name][role.name] = { totalWeeks: 0, totalHours: 0, totalDollars: 0, allocation: role.allocation || 100 };
                    }
                    
                    consolidatedRoles[department.name][role.name].totalWeeks += role.weeks || 0;
                    consolidatedRoles[department.name][role.name].totalHours += role.hours || 0;
                    consolidatedRoles[department.name][role.name].totalDollars += role.totalDollars || 0;
                    // Use the allocation from the first occurrence of this role (they should be the same across stages)
                    if (!consolidatedRoles[department.name][role.name].allocation) {
                      consolidatedRoles[department.name][role.name].allocation = role.allocation || 100;
                    }
                  });
                });
              });

              // Create resource assignments from consolidated data
              Object.keys(consolidatedRoles).forEach(departmentName => {
                initialResourceAssignments[phase][departmentName] = [];
                
                Object.keys(consolidatedRoles[departmentName]).forEach(roleName => {
                  const consolidated = consolidatedRoles[departmentName][roleName];
                  const totalWeeks = consolidated.totalWeeks || Math.ceil(consolidated.totalHours / 40); // Assume 40 hours per week
                  
                  if (totalWeeks > 0) {
                    // Calculate start and end dates based on project timeline and role duration
                    const projectStart = new Date(selectedQuote.inMarketDate || Date.now());
                    const projectEnd = new Date(selectedQuote.projectCompletionDate || Date.now());
                    const projectDurationWeeks = Math.ceil((projectEnd.getTime() - projectStart.getTime()) / (7 * 24 * 60 * 60 * 1000));
                    
                    // Calculate more realistic start/end dates based on role duration
                    const roleEndDate = new Date(projectStart);
                    roleEndDate.setDate(roleEndDate.getDate() + (totalWeeks * 7));
                    
                    // Don't exceed project end date
                    const finalEndDate = roleEndDate > projectEnd ? projectEnd : roleEndDate;
                    
                    // Use the actual allocation percentage from the Quote Hub
                    const allocation = consolidated.allocation;

                    // Use assigned person from department if available
                    const assignedPerson = departmentAssignments[departmentName]?.assignedName || '';
                    

                    
                    initialResourceAssignments[phase][departmentName].push({
                      id: crypto.randomUUID(),
                      department: departmentName,
                      role: roleName,
                      assignee: assignedPerson, // Auto-populate from Quote Hub assignment
                      startDate: selectedQuote.inMarketDate || '',
                      endDate: finalEndDate.toISOString().slice(0, 10),
                      totalWeeks: totalWeeks,
                      allocation: allocation
                    });
                  }
                });
              });
            }
          });


          
            setState(prev => ({
              ...prev,
              resourceAssignments: initialResourceAssignments
            }));
            setResourcesAutoPopulated(true);
          }
        }
      }
    }
  }, [state.selectedQuoteId, quotes]);



  const selectedQuote = useMemo(() => {
    if (state.isStandalone && state.standaloneProject) {
      // Return standalone project formatted like a quote
      return {
        id: state.standaloneProject.id,
        clientName: state.standaloneProject.clientName,
        projectName: state.standaloneProject.projectName,
        brand: state.standaloneProject.brand,
        project: {
          brand: state.standaloneProject.brand,
          projectNumber: state.standaloneProject.projectNumber,
          startDate: state.standaloneProject.startDate,
          endDate: state.standaloneProject.endDate,
          phases: state.standaloneProject.phases
        },
        briefDate: state.briefDate,
        inMarketDate: state.inMarketDate,
        projectCompletionDate: state.projectCompletionDate,
        pmData: {
          resourceAssignments: state.resourceAssignments,
          workback: state.workback,
          milestones: state.milestones
        }
      };
    }
    return quotes.find(q => q.id === state.selectedQuoteId) || null;
  }, [quotes, state.selectedQuoteId, state.isStandalone, state.standaloneProject, state.briefDate, state.inMarketDate, state.projectCompletionDate, state.resourceAssignments, state.workback, state.milestones]);

  // Helpers for calendar
  const addMonths = (date: Date, months: number) => {
    const d = new Date(date);
    d.setMonth(d.getMonth() + months);
    return d;
  };
  const formatMonth = (date: Date) => date.toLocaleString('default', { month: 'long', year: 'numeric' });

  // Holiday helpers (Canada in red, US in blue)
  const toDateStr = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString().slice(0,10);
  const nthWeekdayOfMonth = (year: number, month0: number, weekday0: number, n: number) => {
    // weekday0: 0=Sun..6=Sat; month0: 0-11
    const first = new Date(year, month0, 1);
    const firstWeekday = first.getDay();
    const offset = (7 + weekday0 - firstWeekday) % 7;
    return new Date(year, month0, 1 + offset + 7 * (n - 1));
  };
  const lastWeekdayOfMonth = (year: number, month0: number, weekday0: number) => {
    const last = new Date(year, month0 + 1, 0);
    const lastWeekday = last.getDay();
    const offset = (7 + lastWeekday - weekday0) % 7;
    return new Date(year, month0 + 1, 0 - offset);
  };
  const computeHolidays = (year: number) => {
    const ca: Record<string, string> = {};
    const us: Record<string, string> = {};
    // Canada
    ca[toDateStr(new Date(year, 0, 1))] = "New Year's Day";
    ca[toDateStr(nthWeekdayOfMonth(year, 1, 1, 3))] = 'Family Day'; // Feb, Monday, 3rd
    ca[toDateStr(new Date(year, 6, 1))] = 'Canada Day';
    ca[toDateStr(nthWeekdayOfMonth(year, 8, 1, 1))] = 'Labour Day'; // Sept, Monday, 1st
    ca[toDateStr(nthWeekdayOfMonth(year, 9, 1, 2))] = 'Thanksgiving (CA)'; // Oct, Monday, 2nd
    ca[toDateStr(new Date(year, 10, 11))] = 'Remembrance Day';
    ca[toDateStr(new Date(year, 11, 25))] = 'Christmas Day';
    ca[toDateStr(new Date(year, 11, 26))] = 'Boxing Day';
    // United States
    us[toDateStr(new Date(year, 0, 1))] = "New Year's Day";
    us[toDateStr(nthWeekdayOfMonth(year, 0, 1, 3))] = 'Martin Luther King Jr. Day'; // Jan, Mon, 3rd
    us[toDateStr(nthWeekdayOfMonth(year, 1, 1, 3))] = `Presidents' Day`; // Feb, Mon, 3rd
    us[toDateStr(lastWeekdayOfMonth(year, 4, 1))] = 'Memorial Day'; // May, last Mon
    us[toDateStr(new Date(year, 6, 4))] = 'Independence Day';
    us[toDateStr(nthWeekdayOfMonth(year, 8, 1, 1))] = 'Labor Day'; // Sept, Mon, 1st
    us[toDateStr(nthWeekdayOfMonth(year, 9, 1, 2))] = 'Columbus Day'; // Oct, Mon, 2nd
    us[toDateStr(new Date(year, 10, 11))] = 'Veterans Day';
    // US Thanksgiving: 4th Thu in Nov
    us[toDateStr(nthWeekdayOfMonth(year, 10, 4, 4))] = 'Thanksgiving (US)'; // Nov, Thu, 4th
    us[toDateStr(new Date(year, 11, 25))] = 'Christmas Day';
    return { ca, us };
  };

  const handleAddMilestone = () => {
    const start = new Date(calendarStartDate);
    const id = crypto.randomUUID();
    const newMilestone: PMMilestone = {
      id,
      name: newMilestoneName || 'New Milestone',
      start: start.toISOString().slice(0,10),
      end: start.toISOString().slice(0,10),
      color: '#1f2937'
    };
    setState(prev => ({ ...prev, milestones: [...prev.milestones, newMilestone] }));
    setNewMilestoneName('');
  };

  const renderMonthCells = (monthDate: Date) => {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startWeekday = firstDay.getDay();
    const daysInMonth = lastDay.getDate();
    const { ca, us } = computeHolidays(year);

    const cells: React.ReactNode[] = [];
    // Leading blanks
    for (let i = 0; i < startWeekday; i++) {
      cells.push(<div key={`blank-${i}`} className="h-24 border-b border-r bg-white" />);
    }
    // Days
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = new Date(year, month, day).toISOString().slice(0,10);
      const dayMilestones = state.milestones.filter(m => dateStr >= m.start && dateStr <= m.end);
      const caHoliday = ca[dateStr];
      const usHoliday = us[dateStr];

      cells.push(
        <div
          key={`day-${year}-${month}-${day}`}
          className="h-24 border-b border-r relative"
          onDragOver={(e) => {
            // Allow drop to land on any calendar day
            e.preventDefault();
          }}
          onDrop={(e) => {
            if (!draggingMilestone) return;
            const droppedDate = new Date(year, month, day).toISOString().slice(0,10);
            setState(prev => ({
              ...prev,
              milestones: prev.milestones.map(m => {
                if (m.id !== draggingMilestone.id) return m;
                if (draggingMilestone.mode === 'move') {
                  // maintain duration
                  const durationDays = Math.max(1, Math.ceil((new Date(m.end).getTime() - new Date(m.start).getTime()) / (24*60*60*1000)) + 1);
                  const newStart = droppedDate;
                  const newStartDate = new Date(newStart);
                  const newEndDate = new Date(newStartDate);
                  newEndDate.setDate(newStartDate.getDate() + durationDays - 1);
                  return { ...m, start: newStartDate.toISOString().slice(0,10), end: newEndDate.toISOString().slice(0,10) };
                }
                if (draggingMilestone.mode === 'resize-start') {
                  const newStart = droppedDate;
                  // ensure start <= end
                  if (new Date(newStart) > new Date(m.end)) {
                    return { ...m, start: m.end, end: newStart };
                  }
                  return { ...m, start: newStart };
                }
                if (draggingMilestone.mode === 'resize-end') {
                  const newEnd = droppedDate;
                  if (new Date(newEnd) < new Date(m.start)) {
                    return { ...m, start: newEnd, end: m.start };
                  }
                  return { ...m, end: newEnd };
                }
                return m;
              })
            }));
            setDraggingMilestone(null);
          }}
        >
          <div className="absolute top-1 left-1 text-[10px] text-gray-500">{day}</div>
          {(caHoliday || usHoliday) && (
            <div className="absolute top-1 right-1 text-[9px] space-y-0.5 text-right">
              {caHoliday && (
                <div className="px-1 rounded bg-red-100 text-red-700 border border-red-200" title={caHoliday}>{caHoliday}</div>
              )}
              {usHoliday && (
                <div className="px-1 rounded bg-blue-100 text-blue-700 border border-blue-200" title={usHoliday}>{usHoliday}</div>
              )}
            </div>
          )}
          <div className="absolute inset-x-1 bottom-1 space-y-1">
            {dayMilestones.map(m => (
              <div key={m.id} className="h-4 rounded text-[10px] px-1 flex items-center group relative"
                   style={{ backgroundColor: '#cae6fd', color: '#0b2345' }}
                   title={`${m.name}: ${m.start} → ${m.end}`}>
                {/* Left resize handle */}
                <span
                  className="absolute left-0 top-0 bottom-0 w-4 cursor-ew-resize opacity-0 group-hover:opacity-100 bg-blue-500 bg-opacity-30 hover:bg-opacity-60 z-10"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', m.id);
                    e.dataTransfer.effectAllowed = 'move';
                    setDraggingMilestone({ id: m.id, mode: 'resize-start' });
                  }}
                  onDragEnd={() => setDraggingMilestone(null)}
                />
                {/* Middle draggable area for moving */}
                <span 
                  className="mx-auto truncate flex-1 cursor-move px-4"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', m.id);
                    e.dataTransfer.effectAllowed = 'move';
                    setDraggingMilestone({ id: m.id, mode: 'move' });
                  }}
                  onDragEnd={() => setDraggingMilestone(null)}
                >
                  {m.name}
                </span>
                {/* Right resize handle */}
                <span
                  className="absolute right-0 top-0 bottom-0 w-4 cursor-ew-resize opacity-0 group-hover:opacity-100 bg-blue-500 bg-opacity-30 hover:bg-opacity-60 z-10"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', m.id);
                    e.dataTransfer.effectAllowed = 'move';
                    setDraggingMilestone({ id: m.id, mode: 'resize-end' });
                  }}
                  onDragEnd={() => setDraggingMilestone(null)}
                />
              </div>
            ))}
          </div>
        </div>
      );
    }
    // Ensure full 6 weeks grid (42 cells)
    while (cells.length % 7 !== 0) {
      cells.push(<div key={`postblank-${cells.length}`} className="h-24 border-b border-r bg-white" />);
    }
    return cells;
  };

  const addResource = (phase: string, department: string) => {
    const defaultStartDate = state.inMarketDate || new Date().toISOString().slice(0, 10);
    const defaultEndDate = state.projectCompletionDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    
    setState(prev => ({
      ...prev,
      resourceAssignments: {
        ...prev.resourceAssignments,
        [phase]: {
          ...prev.resourceAssignments[phase],
          [department]: [
            ...(prev.resourceAssignments[phase]?.[department] || []),
            { 
              id: crypto.randomUUID(), 
              department: department,
              role: '', 
              assignee: '', 
              startDate: defaultStartDate,
              endDate: defaultEndDate,
              totalWeeks: Math.ceil((new Date(defaultEndDate).getTime() - new Date(defaultStartDate).getTime()) / (7 * 24 * 60 * 60 * 1000)),
              allocation: 25
            }
          ]
        }
      }
    }));
  };

  const updateResource = (phase: string, department: string, id: string, updates: Partial<PMResourceAssignment>) => {
    setState(prev => ({
      ...prev,
      resourceAssignments: {
        ...prev.resourceAssignments,
        [phase]: {
          ...prev.resourceAssignments[phase],
          [department]: (prev.resourceAssignments[phase]?.[department] || []).map(r => {
            if (r.id === id) {
              const updated = { ...r, ...updates };
              // Recalculate total weeks if dates change
              if (updates.startDate || updates.endDate) {
                const start = new Date(updates.startDate || r.startDate);
                const end = new Date(updates.endDate || r.endDate);
                updated.totalWeeks = Math.ceil((end.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000));
              }
              return updated;
            }
            return r;
          })
        }
      }
    }));
  };

  const removeResource = (phase: string, department: string, id: string) => {
    setState(prev => ({
      ...prev,
      resourceAssignments: {
        ...prev.resourceAssignments,
        [phase]: {
          ...prev.resourceAssignments[phase],
          [department]: (prev.resourceAssignments[phase]?.[department] || []).filter(r => r.id !== id)
        }
      }
    }));
  };

  const addWorkbackSection = (phase: string) => {
    setState(prev => ({
      ...prev,
      workback: [...prev.workback, { 
        id: crypto.randomUUID(), 
        name: 'New Section', 
        phase: phase, 
        tasks: [] 
      }]
    }));
  };

  const updateWorkbackSection = (sectionId: string, updates: Partial<PMWorkbackSection>) => {
    setState(prev => ({
      ...prev,
      workback: prev.workback.map(section => 
        section.id === sectionId ? { ...section, ...updates } : section
      )
    }));
  };

  const removeWorkbackSection = (sectionId: string) => {
    setState(prev => ({
      ...prev,
      workback: prev.workback.filter(section => section.id !== sectionId)
    }));
  };

  const addWorkbackTask = (sectionId: string) => {
    setState(prev => ({
      ...prev,
      workback: prev.workback.map(section => 
        section.id === sectionId 
          ? { 
              ...section, 
              tasks: [...section.tasks, { 
                id: crypto.randomUUID(), 
                task: 'New Task', 
                date: state.inMarketDate || new Date().toISOString().slice(0,10), 
                owner: '', 
                status: 'not-started', 
                notes: '' 
              }] 
            }
          : section
      )
    }));
  };

  const updateWorkbackTask = (sectionId: string, taskId: string, updates: Partial<PMWorkbackSection['tasks'][number]>) => {
    setState(prev => ({
      ...prev,
      workback: prev.workback.map(section => 
        section.id === sectionId 
          ? { 
              ...section, 
              tasks: section.tasks.map(task => 
                task.id === taskId ? { ...task, ...updates } : task
              )
            }
          : section
      )
    }));
  };

  const removeWorkbackTask = (sectionId: string, taskId: string) => {
    setState(prev => ({
      ...prev,
      workback: prev.workback.map(section => 
        section.id === sectionId 
          ? { 
              ...section, 
              tasks: section.tasks.filter(task => task.id !== taskId)
            }
          : section
      )
    }));
  };

  return (
    <div className="min-h-screen bg-white">
      <BrandedHeader 
        user={user} 
        onLogout={onLogout} 
        title="Project Management Hub"
        showBackButton={false}
        onBackClick={onBackToDashboard}
        backLabel={scrollToTaskId ? "← Person Dashboard" : "← Projects"}
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
                onOpenPerson && onOpenPerson(uniqueResourcedPeople[0]);
              } else if (user?.name) {
                // Otherwise, show the current logged-in user
                onOpenPerson && onOpenPerson(user.name);
              }
            }
          }
        ]}
        showSidebar={!!state.selectedQuoteId}
      />

      {/* Sidebar - Only show when project is selected */}
      {state.selectedQuoteId && (
        <div className="fixed left-0 top-0 w-64 bg-blue-50 border-r border-blue-200 h-screen p-4 flex-shrink-0 overflow-y-auto">
          <div className="space-y-2">
            {/* Logo and Title */}
            <div className="mb-4 flex flex-col items-center gap-1">
              <img src="/salt-logo.png" alt="Salt Logo" className="h-12 w-auto" />
              <h1 className="text-lg font-semibold text-gray-800">Project Management</h1>
            </div>
            
            {/* Dashboard Button */}
            <button
              onClick={onBackToDashboard}
              className="w-full mb-4 px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-blue-100 rounded-lg transition-colors text-center"
            >
              ← Salt XC Hub
            </button>
            
            {/* Separator */}
            <div className="mb-6 border-t border-blue-200"></div>

            {/* Step Buttons */}
            <div className="space-y-2">
              <button
                onClick={() => setCurrentStep('project-details')}
                className={`w-full px-4 py-3 rounded-lg font-medium text-sm transition-colors text-left ${
                  currentStep === 'project-details'
                    ? 'bg-white text-black shadow-sm'
                    : 'text-blue-800 hover:bg-blue-100'
                }`}
              >
                Project Details
              </button>
              <button
                onClick={() => setCurrentStep('resource-assignment')}
                className={`w-full px-4 py-3 rounded-lg font-medium text-sm transition-colors text-left ${
                  currentStep === 'resource-assignment'
                    ? 'bg-white text-black shadow-sm'
                    : 'text-blue-800 hover:bg-blue-100'
                }`}
              >
                Resource Assignment
              </button>

              <button
                onClick={() => setCurrentStep('gantt-chart')}
                disabled={!selectedQuote}
                className={`w-full px-4 py-3 rounded-lg font-medium text-sm transition-colors text-left ${
                  currentStep === 'gantt-chart'
                    ? 'bg-white text-black shadow-sm'
                    : !selectedQuote
                    ? 'text-blue-400 cursor-not-allowed opacity-50'
                    : 'text-blue-800 hover:bg-blue-100'
                }`}
              >
                Critical Path & Task Assignment
              </button>
            </div>

            {/* Save Button */}
            <div className="mt-6 pt-6 border-t border-blue-200">
              <button
                onClick={handleSave}
                disabled={!selectedQuote}
                className={`w-full px-4 py-3 rounded-lg font-medium text-sm transition-colors ${
                  !selectedQuote
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-black text-white hover:bg-gray-800'
                }`}
              >
                Save Project
              </button>
              
              {lastSaved && (
                <div className="mt-2 text-xs text-gray-500 text-center">
                  Last saved: {lastSaved}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className={`${selectedQuote ? 'ml-64' : ''} max-w-7xl mx-auto px-4 py-4`}>
        {/* Setup Modal */}
        {showSetupModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <CardTitle>Set Up New Project</CardTitle>
                <CardDescription>Create a new project without a quote</CardDescription>
          </CardHeader>
              <CardContent>
                <form onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  const newProject = {
                    id: crypto.randomUUID(),
                    clientName: formData.get('clientName') as string,
                    brand: formData.get('brand') as string,
                    projectName: formData.get('projectName') as string,
                    projectNumber: formData.get('projectNumber') as string,
                    startDate: formData.get('startDate') as string,
                    endDate: formData.get('endDate') as string,
                    phases: (formData.get('phases') as string).split(',').map(p => p.trim()).filter(p => p)
                  };

                  setState(p => ({
                    ...p,
                    isStandalone: true,
                    standaloneProject: newProject,
                    selectedQuoteId: null,
                    briefDate: '',
                    inMarketDate: '',
                    projectCompletionDate: '',
                    resourceAssignments: {},
                    workback: [],
                    milestones: []
                  }));
                  setShowSetupModal(false);
                }} className="space-y-4">
              <div>
                    <label className="block text-sm font-medium mb-1">Client Name *</label>
                    <Input name="clientName" required placeholder="e.g., Acme Corp" />
              </div>
              <div>
                    <label className="block text-sm font-medium mb-1">Brand</label>
                    <Input name="brand" placeholder="e.g., Acme Brand" />
              </div>
              <div>
                    <label className="block text-sm font-medium mb-1">Project Name *</label>
                    <Input name="projectName" required placeholder="e.g., Spring Campaign 2025" />
              </div>
              <div>
                    <label className="block text-sm font-medium mb-1">Project Number</label>
                    <Input name="projectNumber" placeholder="e.g., PROJ-2025-001" />
              </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Start Date *</label>
                      <Input name="startDate" type="date" required />
            </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">End Date *</label>
                      <Input name="endDate" type="date" required />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Phases (comma separated) *</label>
                    <Input name="phases" required placeholder="e.g., Planning, Production, Post-Production" />
                    <p className="text-xs text-gray-500 mt-1">Enter phases separated by commas</p>
                  </div>
                  <div className="flex gap-2 justify-end pt-4">
                    <Button type="button" variant="outline" onClick={() => setShowSetupModal(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">
                      Create Project
                    </Button>
                  </div>
                </form>
          </CardContent>
        </Card>
          </div>
        )}

        {/* Step Navigation - Vertical sidebar on left when project is selected */}
        {selectedQuote && (
          <div className="fixed left-0 top-0 w-64 bg-blue-50 border-r border-blue-200 h-screen p-4 flex-shrink-0 overflow-y-auto z-10">
            {/* Logo and Title */}
            <div className="mb-4 flex flex-col items-center gap-1">
              <img src="/salt-logo.png" alt="Salt Logo" className="h-12 w-auto" />
              <h1 className="text-lg font-semibold text-gray-800 text-center">Project Management Hub</h1>
            </div>
            
            {/* Back Button */}
            <button
              onClick={onBackToDashboard}
              className="w-full mb-4 px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-blue-100 rounded-lg transition-colors text-center"
            >
              ← Salt XC Hub
            </button>
            
            {/* Separator */}
            <div className="mb-6 border-t border-blue-200"></div>
            
            <div className="space-y-2">
              <button
                onClick={() => setCurrentStep('project-details')}
                className={`w-full text-left px-4 py-3 rounded-lg font-medium text-sm transition-colors ${
                  currentStep === 'project-details'
                    ? 'bg-white text-black shadow-sm'
                    : 'text-blue-800 hover:bg-blue-100'
                }`}
              >
                {selectedQuote?.pmData ? 'Edit Project Details' : 'Set Up Project Details'}
              </button>
              
              <button
                onClick={() => setCurrentStep('reference-materials')}
                className={`w-full text-left px-4 py-3 rounded-lg font-medium text-sm transition-colors ${
                  currentStep === 'reference-materials'
                    ? 'bg-white text-black shadow-sm'
                    : 'text-blue-800 hover:bg-blue-100'
                }`}
              >
                Reference Materials
              </button>
              
              <button
                onClick={() => setCurrentStep('resource-assignment')}
                className={`w-full text-left px-4 py-3 rounded-lg font-medium text-sm transition-colors ${
                  currentStep === 'resource-assignment'
                    ? 'bg-white text-black shadow-sm'
                    : 'text-blue-800 hover:bg-blue-100'
                }`}
              >
                {selectedQuote?.pmData?.resourceAssignments && Object.keys(selectedQuote.pmData.resourceAssignments).length > 0 ? 'Edit Resources' : 'Assign Resources'}
              </button>
              
              <button
                onClick={() => setCurrentStep('workback-schedule')}
                className={`w-full text-left px-4 py-3 rounded-lg font-medium text-sm transition-colors ${
                  currentStep === 'workback-schedule'
                    ? 'bg-white text-black shadow-sm'
                    : 'text-blue-800 hover:bg-blue-100'
                }`}
              >
                {selectedQuote?.pmData?.workback && selectedQuote.pmData.workback.length > 0 ? 'Edit Tasks' : 'Set Up Tasks'}
              </button>
            </div>
          </div>
        )}

        <Tabs value={currentStep} onValueChange={(value) => {
          setCurrentStep(value as 'project-details' | 'resource-assignment' | 'workback-schedule' | 'gantt-chart' | 'reference-materials');
        }} className="w-full">

          <TabsContent value="project-details">
            <Card className="mb-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Project Details</CardTitle>
                <CardDescription className="text-sm">Review key information for the selected project</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                {selectedQuote ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <div><strong>Client:</strong> {selectedQuote.clientName}</div>
                      <div><strong>Brand:</strong> {selectedQuote.project?.brand || selectedQuote.brand || '—'}</div>
                      <div><strong>Project:</strong> {selectedQuote.projectName}</div>
                    </div>
                    <div>
                      <div><strong>Project Number:</strong> <span className="font-mono">{selectedQuote.project?.projectNumber || 'N/A'}</span></div>
                      <div><strong>Start Date:</strong> {selectedQuote.project?.startDate ? new Date(selectedQuote.project.startDate).toLocaleDateString() : '—'}</div>
                      <div><strong>End Date:</strong> {selectedQuote.project?.endDate ? new Date(selectedQuote.project.endDate).toLocaleDateString() : '—'}</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-gray-500 py-8">Select a project above to view details.</div>
                )}
              </CardContent>
            </Card>

            {/* Key Milestones (moved under Project Details) */}
            <Card className="mb-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Key Milestones</CardTitle>
                <CardDescription className="text-sm">Track major checkpoints for this project</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                {selectedQuote ? (
                  <div className="space-y-4">
                    {/* Controls */}
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 text-sm">
                        <div className="flex items-center gap-2">
                          <button
                            className="px-2 py-1 rounded border text-xs hover:bg-gray-50"
                            title="Previous Month"
                            onClick={() => setCalendarStartDate(prev => {
                              const d = new Date(prev);
                              d.setDate(1);
                              return addMonths(d, -1);
                            })}
                          >
                            ← Prev
                          </button>
                          <button
                            className="px-2 py-1 rounded border text-xs hover:bg-gray-50"
                            title="Next Month"
                            onClick={() => setCalendarStartDate(prev => {
                              const d = new Date(prev);
                              d.setDate(1);
                              return addMonths(d, 1);
                            })}
                          >
                            Next →
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-gray-600">View:</label>
                          <button
                            className={`px-3 py-1 rounded border text-xs hover:bg-gray-50 ${calendarMonths === 1 ? 'bg-gray-100' : ''}`}
                            onClick={() => setCalendarMonths(1)}
                          >
                            1 Month
                          </button>
                          <button
                            className={`px-3 py-1 rounded border text-xs hover:bg-gray-50 ${calendarMonths === 2 ? 'bg-gray-100' : ''}`}
                            onClick={() => setCalendarMonths(2)}
                          >
                            2 Months
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          placeholder="Milestone name"
                          value={newMilestoneName}
                          onChange={(e) => setNewMilestoneName(e.target.value)}
                          className="h-8 w-56"
                        />
                        <Button
                          className="h-8 px-3 bg-black hover:bg-gray-800"
                          onClick={handleAddMilestone}
                        >
                          + Add Milestone
                        </Button>
                      </div>
                    </div>

                    {/* Calendar */}
                    <div className={`grid gap-4`} style={{ gridTemplateColumns: `repeat(${calendarMonths}, minmax(0, 1fr))` }}>
                      {Array.from({ length: calendarMonths }).map((_, idx) => (
                        <div key={idx} className="border rounded-lg overflow-hidden">
                          <div className="bg-gray-50 px-3 py-2 text-sm font-medium">
                            {formatMonth(addMonths(calendarStartDate, idx))}
                          </div>
                          <div className="grid grid-cols-7 text-xs">
                            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d) => (
                              <div key={d} className="px-2 py-1 text-center text-gray-500 bg-gray-50 border-b">
                                {d}
                              </div>
                            ))}
                            {renderMonthCells(addMonths(calendarStartDate, idx))}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Garbage drop zone */}
                    <div
                      className={`mt-4 p-4 border-2 border-dashed rounded-lg text-center text-sm ${draggingMilestone ? 'border-red-400 bg-red-50 text-red-700' : 'border-gray-300 text-gray-500'}`}
                      onDragOver={(e) => {
                        if (draggingMilestone) e.preventDefault();
                      }}
                      onDrop={(e) => {
                        if (!draggingMilestone) return;
                        setState(prev => ({
                          ...prev,
                          milestones: prev.milestones.filter(m => m.id !== draggingMilestone.id)
                        }));
                        setDraggingMilestone(null);
                      }}
                    >
                      Drag here to delete milestone
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-gray-500 py-8">Select a project to view milestones.</div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reference-materials">
            <Card className="mb-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Reference Materials</CardTitle>
                <CardDescription className="text-sm">Upload and manage project documents, briefs, and reference files</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                {selectedQuote ? (
                  <div className="space-y-4">
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <p className="text-sm text-gray-600">Drag and drop files here or click to browse</p>
                        <p className="text-xs text-gray-500">PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, Images (max 10MB)</p>
                        <button className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
                          Choose Files
                        </button>
                      </div>
                    </div>

                    {/* Placeholder for uploaded files list */}
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium text-gray-700">Uploaded Files</h3>
                      <div className="text-sm text-gray-500 text-center py-8">
                        No files uploaded yet
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-gray-500 py-8">Select a project to manage reference materials.</div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="resource-assignment">
            {/* Save Button - Only show when no sidebar */}
            {!state.selectedQuoteId && (
            <div className="flex justify-between items-center mb-4">
              <div className="text-sm text-gray-600">
                {lastSaved && `Last saved: ${lastSaved}`}
              </div>
              <Button variant="outline" onClick={handleSave} className="text-black border-black hover:bg-gray-50">
                Save Resource Assignment
              </Button>
            </div>
            )}

            {/* Resources */}
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Resources</CardTitle>
            <CardDescription className="text-sm">Assign team members based on the approved budget phases</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-4">
              {/* Phase Sections */}
              {(selectedQuote?.project?.phases || []).map((phase: string) => (
                <div key={phase} className="space-y-2">
                  {/* Phase Header */}
                  <div className={`p-2 rounded ${getPhaseBackgroundColor(phase)}`}>
                    <h3 className={`text-sm font-semibold ${getPhaseColor(phase)}`}>
                      {phase}
                    </h3>
                  </div>
                  

                  {/* Resource Assignments - Flat list with department column */}
                  <div className="ml-2 space-y-1">
                    {/* Column Headers */}
                    <div className="grid gap-1 items-center font-medium text-xs text-gray-600 py-3" style={{ gridTemplateColumns: '1fr 1.725fr 1.8fr 1.2fr 1.2fr 0.8fr 0.8fr 0.5fr' }}>
                      <div className="text-xs">Department</div>
                      <div className="text-xs">Role</div>
                      <div className="text-xs">Resource</div>
                      <div className="text-xs">Start Date</div>
                      <div className="text-xs">End Date</div>
                      <div className="text-xs">Total Weeks</div>
                      <div className="text-xs">% Allocation</div>
                      <div></div>
                    </div>

                    {/* All resources for this phase (flattened from all departments) */}
                    {Object.keys(state.resourceAssignments[phase] || {}).map(department => 
                      (state.resourceAssignments[phase]?.[department] || []).map((res) => (
                        <div key={res.id} className="grid gap-1 items-center py-3 border-b border-gray-100 hover:bg-gray-50" style={{ gridTemplateColumns: '1fr 1.5fr 1.8fr 1.2fr 1.2fr 0.8fr 0.8fr 0.5fr' }}>
                          <div className="font-medium text-gray-700 bg-gray-100 px-2 rounded text-center h-8 flex items-center justify-center text-xs">
                            {department}
                          </div>
                          <Input 
                            placeholder="Role" 
                            value={res.role} 
                            onChange={(e) => updateResource(phase, department, res.id, { role: e.target.value })} 
                            className="h-8 px-2 text-[10px]"
                          />
                          <AutoCompleteAssignee
                            value={res.assignee}
                            onChange={(value) => updateResource(phase, department, res.id, { assignee: value })}
                            placeholder="Type to search..."
                          />
                          <Input 
                            type="date" 
                            value={res.startDate} 
                            onChange={(e) => updateResource(phase, department, res.id, { startDate: e.target.value })} 
                            className="h-8 px-2 text-xs [&::-webkit-calendar-picker-indicator]:w-4 [&::-webkit-calendar-picker-indicator]:h-4 [&::-webkit-calendar-picker-indicator]:opacity-60"
                          />
                          <Input 
                            type="date" 
                            value={res.endDate} 
                            onChange={(e) => updateResource(phase, department, res.id, { endDate: e.target.value })} 
                            className="h-8 px-2 text-xs [&::-webkit-calendar-picker-indicator]:w-4 [&::-webkit-calendar-picker-indicator]:h-4 [&::-webkit-calendar-picker-indicator]:opacity-60"
                          />
                          <Input 
                            type="number" 
                            min="0" 
                            value={res.totalWeeks} 
                            onChange={(e) => updateResource(phase, department, res.id, { totalWeeks: Number(e.target.value) })} 
                            className="h-8 text-center px-2 text-xs"
                          />
                          <div className="flex items-center gap-1 h-8">
                            <Input 
                              type="number" 
                              min="0" 
                              max="100" 
                              value={res.allocation} 
                              onChange={(e) => updateResource(phase, department, res.id, { allocation: Number(e.target.value) })} 
                              className="h-8 w-12 px-1 text-center text-xs"
                            />
                            <span className="text-gray-500 text-xs">%</span>
                          </div>
                          <div className="flex justify-end items-center h-8">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => removeResource(phase, department, res.id)}
                              className="h-6 w-6 p-0 text-red-600 hover:text-red-800 hover:bg-red-50"
                            >
                              ×
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                    

                  </div>
                </div>
              ))}
              
              {/* Show message if no project selected */}
              {!selectedQuote && (
                <div className="text-center text-gray-500 py-8">
                  Select a project to manage resources by phase
                </div>
              )}
            </div>
          </CardContent>
        </Card>
          </TabsContent>

          <TabsContent value="workback-schedule">
        {/* Task Library */}
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Task Library</CardTitle>
            <CardDescription className="text-sm">
              Drag and drop tasks into workback areas below. Each section will create sample tasks that you can customize.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-4">
              {Object.entries(TASK_TYPES).map(([phase, taskTypes]) => (
                <div key={phase} className="space-y-2">
                  <h4 className="text-sm font-semibold text-gray-700 capitalize">{phase.replace('-', ' ')} Sections</h4>
                  <div className="flex flex-wrap gap-2">
                    {taskTypes.map((taskType) => (
                      <div
                        key={taskType.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, taskType)}
                        onDragEnd={handleDragEnd}
                        className={`px-3 py-2 rounded-md text-xs font-medium cursor-move hover:shadow-lg hover:scale-105 transition-all duration-200 border-2 border-transparent hover:border-gray-300 ${isDragging && draggedTaskType?.id === taskType.id ? 'opacity-50' : ''} ${taskType.color}`}
                        title={`${taskType.description}\n\nDrag to workback area to create sample tasks`}
                      >
                        <div className="flex items-center gap-1">
                          <span>📋</span>
                          <span>{taskType.name}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Workback Schedule */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Workback Schedule</CardTitle>
            <CardDescription className="text-sm">Plan milestones and tasks through completion</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-4">
              {/* Phase Sections */}
              {(selectedQuote?.project?.phases || []).map((phase: string) => (
                <div key={phase} className="space-y-2">
                  {/* Phase Header */}
                  <div className={`p-2 rounded ${getPhaseBackgroundColor(phase)}`}>
                    <h3 className={`text-sm font-semibold ${getPhaseColor(phase)}`}>
                      {phase}
                    </h3>
                  </div>

                  {/* Sections for this phase */}
                  <div className="ml-2 space-y-2">
                    {/* Test Drop Zone - Always Available */}
                    {state.workback.filter(section => section.phase === phase).length === 0 && (
                      <div 
                        className={`border border-gray-200 rounded p-2 min-h-[100px] transition-all duration-200 ${
                          isDragging ? 'border-blue-400 bg-blue-50 border-dashed' : ''
                        }`}
                        onDragOver={handleDragOver}
                        onDrop={(e) => {
                          console.log('🎯 Drop on empty phase:', phase);
                          
                          if (!draggedTaskType) {
                            console.log('❌ No dragged task type in empty phase drop');
                            return;
                          }

                          // Create a new section for this phase
                          const newSectionId = crypto.randomUUID();
                          const sampleTasks = generateSampleTasks(draggedTaskType);
                          
                          const newSection = {
                            id: newSectionId,
                            name: draggedTaskType.name,
                            phase: phase,
                            tasks: sampleTasks
                          };
                          
                          console.log('📋 Creating new section with tasks:', newSection);
                          
                          setState(prev => ({
                            ...prev,
                            workback: [...prev.workback, newSection]
                          }));

                          setIsDragging(false);
                          setDraggedTaskType(null);
                        }}
                      >
                        <div className="text-center py-6 text-sm border-2 border-dashed rounded-lg mb-2 bg-gray-50">
                          <div className="flex flex-col items-center gap-2">
                            <span className="text-2xl">📋</span>
                              <div>
                                <p className="font-medium">
                                  {isDragging ? 'Drop here to create section with tasks!' : 'Drop sections here to create a new workback section'}
                                </p>
                                <p className="text-xs mt-1">
                                  {isDragging ? 'Release to create section and sample tasks' : 'Drag from the Task Library above'}
                                </p>
                              </div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Sections for this phase */}
                    {state.workback.filter(section => section.phase === phase).map(section => (
                      <div 
                        key={section.id} 
                        className={`border border-gray-200 rounded p-2 min-h-[100px] transition-all duration-200 ${
                          isDragging ? 'border-blue-400 bg-blue-50 border-dashed' : ''
                        }`}
                        onDragOver={handleDragOver}
                        onDrop={(e) => {
                          // Always create a new section, don't add to existing
                          e.preventDefault();
                          console.log('🎯 Drop on existing section, creating new section');
                          
                          if (!draggedTaskType) {
                            console.log('❌ No dragged task type');
                            return;
                          }

                          const sampleTasks = generateSampleTasks(draggedTaskType);
                          const newSectionId = crypto.randomUUID();
                          const newSection = {
                            id: newSectionId,
                            name: draggedTaskType.name,
                            phase: section.phase,
                            tasks: sampleTasks
                          };

                          console.log('📋 Creating new section from existing section drop:', newSection);

                          setState(prev => ({
                            ...prev,
                            workback: [...prev.workback, newSection]
                          }));

                          setIsDragging(false);
                          setDraggedTaskType(null);
                        }}
                      >
                        {/* Section Header */}
                        <div className="flex items-center gap-2 mb-2">
                          <Input 
                            placeholder="Section name" 
                            value={section.name} 
                            onChange={(e) => updateWorkbackSection(section.id, { name: e.target.value })} 
                            className="h-6 px-2 font-medium bg-gray-50" 
                            style={{ fontSize: '12px' }} 
                          />
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => removeWorkbackSection(section.id)}
                            className="h-6 w-6 p-0 text-red-600 hover:text-red-800 hover:bg-red-50"
                          >
                            ×
                          </Button>
                        </div>

                        {/* Column Headers for tasks */}
                        <div className="grid gap-1 items-center font-semibold text-gray-700 border-b pb-0.5 mb-1" style={{ fontSize: '12px', gridTemplateColumns: '2fr 1fr 1.5fr 1fr 2.5fr 0.5fr' }}>
                          <div>Task</div>
                          <div>Due Date</div>
                          <div>Responsible</div>
                          <div>Status</div>
                          <div>Notes</div>
                          <div></div>
                        </div>
                        
                        {/* Drop Zone Indicator */}
                        {(!section.tasks || section.tasks.length === 0) && (
                          <div className={`text-center py-6 text-sm border-2 border-dashed rounded-lg mb-2 transition-all duration-200 ${
                            isDragging 
                              ? 'border-blue-400 bg-blue-100 text-blue-700' 
                              : 'border-gray-300 bg-gray-50 text-gray-500'
                          }`}>
                            <div className="flex flex-col items-center gap-2">
                              <span className="text-2xl">📋</span>
                              <div>
                                <p className="font-medium">
                                  {isDragging ? 'Drop here to create new section!' : 'Drop sections here'}
                                </p>
                                <p className="text-xs mt-1">
                                  {isDragging ? 'Release to create new section with tasks' : 'Drag from the Task Library above'}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Tasks in this section */}
                        {(section.tasks || []).map(task => (
                          <div key={task.id} data-task-id={task.id} className="grid gap-1 items-center py-0.5" style={{ gridTemplateColumns: '2fr 1fr 1.5fr 1fr 2.5fr 0.5fr' }}>
                            <Input placeholder="Task name" value={task.task} onChange={(e) => updateWorkbackTask(section.id, task.id, { task: e.target.value })} className="h-6 px-2" style={{ fontSize: '12px' }} />
                            <Input type="date" value={task.date} onChange={(e) => updateWorkbackTask(section.id, task.id, { date: e.target.value })} className="h-6 px-2" style={{ fontSize: '12px' }} />
                            <Select value={task.owner} onValueChange={(v) => updateWorkbackTask(section.id, task.id, { owner: v })}>
                              <SelectTrigger className="h-6 px-2 py-0 min-h-0 border border-input bg-background" style={{ fontSize: '12px', lineHeight: '1', height: '24px', minHeight: '24px', maxHeight: '24px', width: '160px' }}>
                                <SelectValue placeholder="Select Salt'er" />
                              </SelectTrigger>
                              <SelectContent>
                                {(() => {
                                  // Get all assigned people from the resource section
                                  const assignedPeople = new Set<string>();
                                  Object.values(state.resourceAssignments).forEach(phaseAssignments => {
                                    Object.values(phaseAssignments).forEach(deptAssignments => {
                                      deptAssignments.forEach(assignment => {
                                        if (assignment.assignee) {
                                          assignedPeople.add(assignment.assignee);
                                        }
                                      });
                                    });
                                  });
                                  
                                  // Convert to array and sort
                                  const assignedPeopleArray = Array.from(assignedPeople).sort();
                                  
                                  return assignedPeopleArray.map(person => (
                                    <SelectItem key={person} value={person} style={{ fontSize: '12px' }}>
                                      {person}
                                    </SelectItem>
                                  ));
                                })()}
                              </SelectContent>
                            </Select>
                            <Select value={task.status} onValueChange={(v: any) => updateWorkbackTask(section.id, task.id, { status: v })}>
                              <SelectTrigger 
                                className="h-6 px-2 py-0 min-h-0 border border-input" 
                                style={{ 
                                  fontSize: '12px', 
                                  lineHeight: '1', 
                                  height: '24px', 
                                  minHeight: '24px', 
                                  maxHeight: '24px',
                                  backgroundColor: task.status === 'in-progress' ? '#dcfce7' : 
                                                 task.status === 'on-hold' ? '#fed7aa' :
                                                 task.status === 'pending-approval' ? '#fef3c7' :
                                                 task.status === 'completed' ? '#bbf7d0' : '#ffffff',
                                  color: task.status === 'completed' ? '#7e2e0b' : '#000000'
                                }}
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="not-started" style={{ fontSize: '12px' }}>Not Started</SelectItem>
                                <SelectItem value="in-progress" style={{ fontSize: '12px' }}>In Progress</SelectItem>
                                <SelectItem value="on-hold" style={{ fontSize: '12px' }}>On Hold</SelectItem>
                                <SelectItem value="pending-approval" style={{ fontSize: '12px' }}>Pending Approval</SelectItem>
                                <SelectItem value="completed" style={{ fontSize: '12px' }}>Completed</SelectItem>
                              </SelectContent>
                            </Select>
                            <Input placeholder="Notes" value={task.notes} onChange={(e) => updateWorkbackTask(section.id, task.id, { notes: e.target.value })} className="h-6 px-2" style={{ fontSize: '12px' }} />
                            <div className="flex justify-end items-center h-6">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => removeWorkbackTask(section.id, task.id)}
                                className="h-4 w-4 p-0 text-red-600 hover:text-red-800 hover:bg-red-50"
                              >
                                ×
                              </Button>
                            </div>
                          </div>
                        ))}
                        
                        {/* Add Task button for this section */}
                        <div className="mt-2">
                          <Button className="bg-gray-600 hover:bg-gray-700 h-6 px-2" onClick={() => addWorkbackTask(section.id)} style={{ fontSize: '12px' }}>+ Task</Button>
                        </div>
                      </div>
                    ))}
                    
                    {/* Add Section button for this phase */}
                    <div>
                      <Button className="bg-black hover:bg-gray-800 h-6 px-2" onClick={() => addWorkbackSection(phase)} style={{ fontSize: '12px' }}>+ Section</Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
          </TabsContent>

          <TabsContent value="gantt-chart">
            {/* Save Button - Only show when no sidebar */}
            {!state.selectedQuoteId && (
            <div className="flex justify-between items-center mb-4">
              <div className="text-sm text-gray-600">
                {lastSaved && `Last saved: ${lastSaved}`}
              </div>
              <Button variant="outline" onClick={handleSave} className="text-black border-black hover:bg-gray-50">
                Save Gantt Chart
              </Button>
            </div>
            )}

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Gantt Chart Review</CardTitle>
                <CardDescription className="text-sm">Visual timeline and project overview</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
{state.workback.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p>No workback schedule data available</p>
                    <p className="text-sm mt-2">Create sections in the Workback Schedule tab to see the Gantt chart</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Project Timeline Header */}
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700">Week-by-Week Gantt Chart</h3>
                        <p className="text-xs text-gray-500">
                          {state.briefDate && state.projectCompletionDate 
                            ? `${new Date(state.briefDate).toLocaleDateString()} - ${new Date(state.projectCompletionDate).toLocaleDateString()}`
                            : 'Set project dates to see timeline'
                          }
                        </p>
                      </div>
                      <div className="text-xs text-gray-500">
                        {state.workback.length} sections • {state.workback.reduce((total, section) => total + section.tasks.length, 0)} tasks
                      </div>
                    </div>

                    {/* Week-by-Week Gantt Chart */}
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      {/* Generate weeks based on project dates */}
                      {(() => {
                        const startDate = state.briefDate ? new Date(state.briefDate) : new Date();
                        const endDate = state.projectCompletionDate ? new Date(state.projectCompletionDate) : new Date(Date.now() + 12 * 7 * 24 * 60 * 60 * 1000); // 12 weeks default
                        
                        // Generate array of weeks
                        const weeks: Array<{ start: Date; end: Date; label: string }> = [];
                        const currentWeek = new Date(startDate);
                        while (currentWeek <= endDate) {
                          const weekStart = new Date(currentWeek);
                          const weekEnd = new Date(currentWeek);
                          weekEnd.setDate(weekEnd.getDate() + 6);
                          weeks.push({
                            start: new Date(weekStart),
                            end: new Date(weekEnd),
                            label: `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                          });
                          currentWeek.setDate(currentWeek.getDate() + 7);
                        }

                        // Simple function to find which week a date falls into
                        const getWeekIndex = (taskDate: string) => {
                          if (!taskDate) return null;
                          const taskDateObj = new Date(taskDate);
                          return weeks.findIndex(week => 
                            taskDateObj >= week.start && taskDateObj <= week.end
                          );
                        };

                        return (
                          <div className="overflow-x-auto">
                            {/* Chart Header */}
                            <div className="bg-gray-50 border-b border-gray-200 p-3 min-w-max">
                              <div className="flex">
                                <div className="w-80 flex-shrink-0 text-xs font-semibold text-gray-700">Task / Section</div>
                                <div className="flex relative" style={{ width: `${weeks.length * 40}px` }}>
                                  {weeks.map((week, index) => (
                                    <div key={index} className="w-10 text-xs text-center text-gray-600 border-l border-gray-300 px-1">
                                      {week.label.split(' ')[0]}
                                      <br />
                                      {week.label.split(' ')[1]}
                                    </div>
                                  ))}
                                  {/* Grid lines for better alignment */}
                                  {weeks.map((week, index) => (
                                    <div key={`grid-${index}`} className="absolute w-px h-full bg-gray-200" style={{ left: `${index * 40}px` }}></div>
                                  ))}
                                </div>
                              </div>
                            </div>

                            {/* Chart Body */}
                            <div className="divide-y divide-gray-100">
                              {selectedQuote?.project?.phases?.map((phase: string) => {
                                const phaseSections = state.workback.filter(section => section.phase === phase);
                                if (phaseSections.length === 0) return null;

                                return (
                                  <div key={phase} className="min-w-max">
                                    {/* Phase Header */}
                                    <div className={`px-3 py-2 ${getPhaseBackgroundColor(phase)}`}>
                                      <h4 className={`text-sm font-semibold ${getPhaseColor(phase)}`}>
                                        {phase}
                                      </h4>
                                    </div>

                                    {/* Sections and Tasks */}
                                    {phaseSections.map((section) => (
                                      <div key={section.id} className="px-3 py-1">
                                        {/* Section Row */}
                                        <div className="flex items-center py-2 border-l-2 border-blue-200 pl-2">
                                          <div className="w-80 flex-shrink-0">
                                            <div className="font-medium text-sm text-gray-900">{section.name}</div>
                                            <div className="text-xs text-gray-500">{section.tasks.length} tasks</div>
                                          </div>
                                          <div className="flex relative" style={{ width: `${weeks.length * 40}px` }}>
                                            {weeks.map((week, weekIndex) => (
                                              <div key={weekIndex} className="w-10 h-8 border-l border-gray-200"></div>
                                            ))}
                                            {/* Grid lines for section alignment */}
                                            {weeks.map((week, weekIndex) => (
                                              <div key={`section-grid-${weekIndex}`} className="absolute w-px h-full bg-gray-100" style={{ left: `${weekIndex * 40}px` }}></div>
                                            ))}
                                          </div>
                                        </div>

                                        {/* Tasks */}
                                        {section.tasks.map((task) => {
                                          const weekIndex = getWeekIndex(task.date);
                                          
                                          return (
                                            <div key={task.id} className="flex items-center py-1 pl-4 border-l border-gray-200 ml-2">
                                              <div className="w-80 flex-shrink-0">
                                                <div className="text-sm text-gray-700">{task.task}</div>
                                                {task.owner && (
                                                  <div className="text-xs text-gray-500">{task.owner}</div>
                                                )}
                                              </div>
                                              <div className="flex relative" style={{ width: `${weeks.length * 40}px` }}>
                                                {weeks.map((week, weekIdx) => (
                                                  <div key={weekIdx} className="w-10 h-6 border-l border-gray-200"></div>
                                                ))}
                                                
                                                {/* Simple colored bar based on status */}
                                                {weekIndex !== null && weekIndex >= 0 && (
                                                  <div 
                                                    className={`absolute h-4 rounded-sm ${
                                                      task.status === 'completed' ? 'bg-green-500' :
                                                      task.status === 'in-progress' ? 'bg-yellow-500' :
                                                      task.status === 'on-hold' ? 'bg-red-500' :
                                                      task.status === 'pending-approval' ? 'bg-orange-500' :
                                                      'bg-gray-400'
                                                    }`}
                                                    style={{ 
                                                      left: `${weekIndex * 40}px`,
                                                      width: '40px',
                                                      top: '2px'
                                                    }}
                                                    title={`${task.task} - ${task.status}\nDate: ${task.date}`}
                                                  >
                                                  </div>
                                                )}
                                                
                                                {/* Show "No date" for tasks without dates */}
                                                {weekIndex === null && (
                                                  <div className="absolute left-0 top-2 text-xs text-gray-400 italic px-2">
                                                    No date set
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    ))}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Legend */}
                    <div className="flex flex-wrap gap-4 text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-3 rounded-sm bg-green-500"></div>
                        <span>Completed</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-3 rounded-sm bg-yellow-500"></div>
                        <span>In Progress</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-3 rounded-sm bg-orange-500"></div>
                        <span>Pending Approval</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-3 rounded-sm bg-red-500"></div>
                        <span>On Hold</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-3 rounded-sm bg-gray-400"></div>
                        <span>Not Started</span>
                      </div>
                    </div>

                    {/* Instructions */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h4 className="text-sm font-semibold text-blue-900 mb-2">Gantt Chart Overview:</h4>
                      <ul className="text-xs text-blue-800 space-y-1">
                        <li>• <strong>Colored bars</strong> represent tasks positioned by their dates</li>
                        <li>• <strong>Bar colors</strong> indicate task status (see legend above)</li>
                        <li>• <strong>Bar position</strong> shows which week the task is scheduled</li>
                        <li>• <strong>Task names</strong> are shown on the left side of each row</li>
                        <li>• <strong>Dates</strong> are pulled from the workback schedule</li>
                        <li>• <strong>Tasks without dates</strong> show "No date set" message</li>
                        <li>• <strong>Hover over bars</strong> to see task details and dates</li>
                      </ul>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

      </div>
    </div>
  );
}

