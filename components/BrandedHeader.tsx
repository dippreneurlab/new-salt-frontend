'use client';

import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState } from 'react';

interface User {
  email: string;
  name: string;
}

interface BrandedHeaderProps {
  user?: User | null;
  onLogout?: () => void;
  showBackButton?: boolean;
  onBackClick?: () => void;
  lastSaved?: string;
  title?: string;
  backLabel?: string;
  showAdminButton?: boolean;
  isAdminMode?: boolean;
  onToggleAdmin?: () => void;
  onAdminClick?: () => void;
  adminButtonText?: string;
  showActionsDropdown?: boolean;
  onCreativeUserView?: () => void; // legacy option
  menuItems?: { label: string; onClick?: () => void; submenu?: { label: string; onClick: () => void }[] }[];
  showSidebar?: boolean; // Add prop to control sidebar offset
  showCenteredLogo?: boolean; // Add prop to show centered logo with title
  showUserViewSelector?: boolean; // Add prop to show user view dropdown
  userView?: 'Admin' | 'Business Owner' | 'Team Member';
  onUserViewChange?: (view: 'Admin' | 'Business Owner' | 'Team Member') => void;
}

export default function BrandedHeader({ 
  user, 
  onLogout, 
  showBackButton = false, 
  onBackClick,
  lastSaved,
  title = 'Quote Hub',
  backLabel = '← Salt XC Hub',
  showAdminButton = false,
  isAdminMode = false,
  onToggleAdmin,
  onAdminClick,
  adminButtonText = 'Admin',
  showActionsDropdown = false,
  onCreativeUserView,
  menuItems,
  showSidebar = false,
  showCenteredLogo = false,
  showUserViewSelector = false,
  userView,
  onUserViewChange
}: BrandedHeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);
  return (
    <header className={`bg-white border-b border-gray-200 px-6 py-4 ${showSidebar ? 'ml-64' : ''}`}>
      <div className="flex justify-between items-center">
        {/* Left side - Back button */}
        <div className="flex items-center gap-4 flex-1">
          {showBackButton && onBackClick && (
            <Button 
              variant="outline" 
              onClick={onBackClick}
              className="text-gray-600 hover:text-gray-800"
            >
              {backLabel}
            </Button>
          )}
        </div>

        {/* Center - Logo and Title (when showCenteredLogo is true) */}
        {showCenteredLogo && (
          <div className="flex flex-col items-center gap-1 flex-1">
            <img 
              src="/salt-logo.png" 
              alt="Salt Logo" 
              className="h-10 w-auto"
              onError={(e) => {
                console.error('Failed to load salt-logo.png');
                e.currentTarget.style.display = 'none';
              }}
            />
            <h1 className="text-sm font-semibold text-gray-800">{title}</h1>
          </div>
        )}

        {/* Right side - User info */}
        <div className="flex flex-col items-end gap-1 flex-1">
          {user && onLogout && (
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">
                {user.name} ({user.email})
              </span>
              <div className="flex items-center gap-2">
                {/* User View Selector */}
                {showUserViewSelector && userView && onUserViewChange && (
                  <div className="relative">
                    <select
                      value={userView}
                      onChange={(e) => onUserViewChange(e.target.value as 'Admin' | 'Business Owner' | 'Team Member')}
                      className="px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
                    >
                      <option value="Admin">Admin</option>
                      <option value="Business Owner">Business Owner</option>
                      <option value="Team Member">Team Member</option>
                    </select>
                  </div>
                )}
                {showAdminButton && onToggleAdmin && (
                  <Button 
                    variant={isAdminMode ? "default" : "outline"} 
                    onClick={onToggleAdmin}
                    className={isAdminMode ? "bg-blue-600 text-white hover:bg-blue-700" : ""}
                  >
                    {isAdminMode ? `Exit ${adminButtonText}` : adminButtonText}
                  </Button>
                )}
                {showAdminButton && onAdminClick && !onToggleAdmin && (
                  <Button variant="outline" onClick={onAdminClick}>
                    {adminButtonText}
                  </Button>
                )}
                {showActionsDropdown && (
                  <div className="relative" ref={menuRef}>
                    <Button variant="outline" onClick={() => setIsMenuOpen((v) => !v)}>
                      {menuItems && menuItems.length > 0 ? 'User Type ▾' : 'View ▾'}
                    </Button>
                    {isMenuOpen && (
                      <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-50">
                        {menuItems && menuItems.length > 0 ? (
                          menuItems.map((item, idx) => (
                            <button
                              key={idx}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                              onClick={() => {
                                if (item.onClick) item.onClick();
                                setIsMenuOpen(false);
                              }}
                            >
                              {item.label}
                            </button>
                          ))
                        ) : (
                          <button
                            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                            onClick={() => {
                              onCreativeUserView ? onCreativeUserView() : console.log('Creative User View clicked');
                              setIsMenuOpen(false);
                            }}
                          >
                            Creative User View
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
                <Button variant="outline" onClick={onLogout}>
                  Sign Out
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
