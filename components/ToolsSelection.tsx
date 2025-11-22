'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { User, ChevronDown } from "lucide-react";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ToolsSelectionProps {
  user: { email: string; name: string; role?: string; department?: string };
  onLogout: () => void;
  onSelectQuoteHub: () => void;
  onSelectProjectManagement?: () => void;
  onSelectPipeline?: () => void;
  onSelectThreeInOne?: () => void;
  onUserViewChange?: (view: 'Admin' | 'Business Owner' | 'Team Member') => void;
}

const tools = [
  {
    id: 'pipeline',
    title: 'Business Pipeline',
    description: 'Track and manage your project pipeline',
    icon: '/icons/pipeline.svg',
    enabled: false,
    comingSoon: false
  },
  {
    id: 'quote-hub',
    title: 'Quoting',
    description: 'Create and manage project quotes and estimates',
    icon: '/icons/quote.svg',
    enabled: false,
    comingSoon: false
  },
  {
    id: 'three-in-one',
    title: '3 in 1',
    description: 'Unified dashboard across Pipeline, Project Management, and Quoting',
    icon: '/icons/reporting.svg',
    enabled: true,
    comingSoon: false
  }
];

export default function ToolsSelection({ user, onLogout, onSelectQuoteHub, onSelectProjectManagement, onSelectPipeline, onSelectThreeInOne, onUserViewChange }: ToolsSelectionProps) {
  const [userView, setUserView] = useState<'Admin' | 'Business Owner' | 'Team Member'>('Admin');

  const handleUserViewChange = (view: 'Admin' | 'Business Owner' | 'Team Member') => {
    setUserView(view);
    if (onUserViewChange) {
      onUserViewChange(view);
    }
  };

  const handleToolClick = (toolId: string) => {
    console.log('🔍 Tool clicked:', toolId);
    console.log('🔍 onSelectProjectManagement exists?', !!onSelectProjectManagement);
    
    if (toolId === 'quote-hub') {
      console.log('✅ Navigating to quote-hub');
      onSelectQuoteHub();
      return;
    }
    if (toolId === 'pipeline' && onSelectPipeline) {
      console.log('✅ Navigating to pipeline');
      onSelectPipeline();
      return;
    }
    if (toolId === 'project-management' && onSelectProjectManagement) {
      console.log('✅ Navigating to project-management');
      onSelectProjectManagement();
      return;
    }
    if (toolId === 'three-in-one' && onSelectThreeInOne) {
      console.log('✅ Navigating to three-in-one');
      onSelectThreeInOne();
      return;
    }
    console.log('❌ No handler found for tool:', toolId);
    // Other tools are disabled, so no action needed
  };

  // Filter tools based on user view and role
  const visibleTools = tools.filter(tool => {
    // Team Members don't see Business Pipeline
    if (userView === 'Team Member' && tool.id === 'pipeline') {
      return false;
    }
    
    // Team Members only see Quoting if they have senior Accounts roles
    if (userView === 'Team Member' && tool.id === 'quote-hub') {
      const seniorAccountsRoles = [
        'Supervisor',
        'Director', 
        'Sr Director',
        'Senior Director',
        'Managing Director',
        'VP',
        'SVP',
        'EVP'
      ];
      
      // Check if user is in Accounts department with senior role
      const isAccountsDepartment = user.department?.toLowerCase().includes('accounts') || 
                                   user.department?.toLowerCase().includes('account');
      const hasSeniorRole = seniorAccountsRoles.some(role => 
        user.role?.toLowerCase().includes(role.toLowerCase())
      );
      
      // Only show Quoting to senior Accounts team members
      if (!isAccountsDepartment || !hasSeniorRole) {
        return false;
      }
    }
    
    return true;
  });

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <img 
                src="/sxc-application-icon.png" 
                alt="Salt XC Hub"
                className="h-12 w-auto"
              />
            </div>
            
            <div className="flex items-center space-x-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="outline" 
                    className="text-sm flex items-center space-x-2"
                  >
                    <span>User View: {userView}</span>
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleUserViewChange('Admin')}>
                    Admin
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleUserViewChange('Business Owner')}>
                    Business Owner
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleUserViewChange('Team Member')}>
                    Team Member
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              <div className="flex items-center space-x-2">
                <User className="w-5 h-5 text-gray-600" />
                <span className="text-sm font-medium text-gray-700">{user.name}</span>
              </div>
              <Button variant="outline" onClick={onLogout} className="text-sm">
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Welcome to Salt XC Hub
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Choose from our suite of integrated business tools to streamline your workflow and boost productivity.
          </p>
        </div>

        {/* Tools Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {visibleTools.map((tool) => (
            <Card 
              key={tool.id}
              className={`relative transition-all duration-200 border-0 ${
                tool.enabled 
                  ? 'hover:shadow-lg hover:scale-105 cursor-pointer' 
                  : 'opacity-50 cursor-not-allowed'
              }`}
              style={{
                backgroundColor: tool.enabled ? '#f8faff' : '#f8f9fa'
              }}
            >
              <CardHeader className="text-center pb-4">
                <div className="flex justify-center mb-3">
                  <img 
                    src={tool.icon} 
                    alt={tool.title}
                    width={48}
                    height={48}
                    className={`${tool.enabled ? 'opacity-100' : 'opacity-50'}`}
                  />
                </div>
                <CardTitle className={`text-lg ${tool.enabled ? 'text-gray-900' : 'text-gray-500'} mb-2`}>
                  {tool.title}
                </CardTitle>
                <CardDescription className={`text-sm ${tool.enabled ? 'text-gray-600' : 'text-gray-400'}`}>
                  {tool.description}
                </CardDescription>
                {tool.comingSoon && (
                  <div className="absolute top-3 right-3">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                      Coming Soon
                    </span>
                  </div>
                )}
              </CardHeader>
              <CardContent className="text-center flex flex-col justify-end h-20 pt-4">
                {tool.enabled && (
                  <Button 
                    className="w-full text-white hover:opacity-90"
                    style={{
                      backgroundColor: '#cae6fd',
                      color: '#0b2345'
                    }}
                    onClick={() => {
                      console.log('🔍 Button clicked for tool:', tool.id);
                      handleToolClick(tool.id);
                    }}
                  >
                    Get Started
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
