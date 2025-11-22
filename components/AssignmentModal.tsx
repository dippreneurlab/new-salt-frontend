'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Department } from '../app/page';

interface AssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  department: Department | null;
  onAssign: (departmentId: string, email: string) => void;
  onUnassign: (departmentId: string) => void;
}

export default function AssignmentModal({ 
  isOpen, 
  onClose, 
  department, 
  onAssign, 
  onUnassign 
}: AssignmentModalProps) {
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<{ email?: string }>({});

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleAssign = () => {
    const newErrors: { email?: string } = {};
    
    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    setErrors(newErrors);
    
    if (Object.keys(newErrors).length === 0 && department) {
      onAssign(department.id, email.trim());
      setEmail('');
      setErrors({});
      onClose();
    }
  };

  const handleUnassign = () => {
    if (department) {
      onUnassign(department.id);
      onClose();
    }
  };

  const handleClose = () => {
    setEmail('');
    setErrors({});
    onClose();
  };

  if (!department) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Department: {department.name}</DialogTitle>
          <DialogDescription>
            Assign a team member to complete the {department.name} portion of this quote.
            They will receive an email invitation with access to edit only their department's roles and outputs.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current Assignment */}
          {department.assignedTo && (
            <div className="p-3 bg-muted/30 rounded-md">
              <Label className="text-sm font-medium">Currently Assigned To:</Label>
              <div className="flex items-center justify-between mt-1">
                <div>
                  <p className="text-sm text-muted-foreground">{department.assignedTo}</p>
                </div>
                <Badge 
                  variant={department.status === 'completed' ? 'default' : 'secondary'}
                  className={`text-xs ${
                    department.status === 'completed' 
                      ? 'bg-green-500 text-white hover:bg-green-600' 
                      : 'bg-yellow-500 text-white hover:bg-yellow-600'
                  }`}
                >
                  {department.status === 'completed' ? 'Complete' : 'Assigned'}
                </Badge>
              </div>
            </div>
          )}

          {/* Assignment Form */}
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                type="email"
                placeholder="colleague@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={errors.email ? 'border-red-500' : ''}
              />
              {errors.email && (
                <p className="text-sm text-red-600">{errors.email}</p>
              )}
            </div>
          </div>

          {/* Info Box */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-800">
              💡 <strong>What happens next:</strong>
            </p>
            <ul className="text-sm text-blue-700 mt-1 space-y-1">
              <li>• Assignee receives email invitation with secure link</li>
              <li>• They can only edit roles and outputs for {department.name}</li>
              <li>• You'll see real-time updates as they work</li>
              <li>• Status updates automatically when they complete their section</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          {department.assignedTo && (
            <Button
              variant="outline"
              onClick={handleUnassign}
              className="text-red-600 hover:text-red-800"
            >
              Unassign
            </Button>
          )}
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleAssign}>
            {department.assignedTo ? 'Reassign' : 'Send Invitation'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
