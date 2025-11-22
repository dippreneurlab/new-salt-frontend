'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Project, PhaseData, QuoteReviewData } from '../types';
import { cloudStorage } from '@/lib/cloudStorage';

// Helper function to get phase colors - matching Project Fees and Production Costs tabs
const getPhaseColor = (phase: string) => {
  const normalizedPhase = phase.toLowerCase();
  if (normalizedPhase.includes('planning')) return 'text-[#183f9d]';
  if (normalizedPhase.includes('post') || normalizedPhase.includes('wrap')) return 'text-[#7e2e0b]';
  if (normalizedPhase.includes('production') || normalizedPhase.includes('execution')) return 'text-[#554511]';
  return 'text-[#183f9d]'; // default
};

// Helper function to get phase background colors
const getPhaseBackgroundColor = (phase: string) => {
  const normalizedPhase = phase.toLowerCase();
  if (normalizedPhase.includes('planning')) return 'bg-[#EDF0FE]';
  if (normalizedPhase.includes('post') || normalizedPhase.includes('wrap')) return 'bg-[#f7c3ac]';
  if (normalizedPhase.includes('production') || normalizedPhase.includes('execution')) return 'bg-[#fdf0cd]';
  return 'bg-[#EDF0FE]'; // default
};

const getPhaseBorderColor = (phase: string) => {
  const normalizedPhase = phase.toLowerCase();
  if (normalizedPhase.includes('planning')) return 'border-blue-300';
  if (normalizedPhase.includes('post') || normalizedPhase.includes('wrap')) return 'border-[#f7c3ac]';
  if (normalizedPhase.includes('production') || normalizedPhase.includes('execution')) return 'border-yellow-300';
  return 'border-blue-300'; // default
};

const getPhaseTextColor = (phase: string) => {
  return getPhaseColor(phase);
};

interface InvoiceLineItem {
  id: string;
  invoiceNumber: string;
  amount: number;
  percentage?: number;
  paymentDue: string;
  paymentTerms: string;
  customTerms?: string;
}

interface QuoteReviewProps {
  project: Project;
  phaseData: PhaseData;
  productionData: any;
  quoteReviewData: QuoteReviewData;
  onBack: () => void;
  onEdit: (step: 'setup' | 'project-fees' | 'production-costs') => void;
  onSave: (data: QuoteReviewData) => void;
}

const PAYMENT_TERMS = [
  'Upon Receipt',
  '15 Days',
  '30 Days', 
  '60 Days',
  '90 Days',
  '180 Days',
  'Custom'
];

export default function QuoteReview({ project, phaseData, productionData, quoteReviewData, onBack, onEdit, onSave }: QuoteReviewProps) {
  const [descriptions, setDescriptions] = useState<{ [key: string]: string }>(quoteReviewData.descriptions);
  const [projectScope, setProjectScope] = useState<string>(quoteReviewData.projectScope);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceLineItem[]>(
    (quoteReviewData.invoiceItems || []).map(item => ({
      ...item,
      percentage: item.percentage ?? 0
    }))
  );
  const [showPreview, setShowPreview] = useState(false);
  const [pricingType, setPricingType] = useState<'value' | 'line-item'>('line-item');
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [reviewerName, setReviewerName] = useState('');
  const [ownersList, setOwnersList] = useState<string[]>([]);

  // Load owners list from pipeline entries
  useEffect(() => {
    try {
      const pipelineData = cloudStorage.getItem('pipeline-entries');
      if (pipelineData) {
        const entries = JSON.parse(pipelineData);
        // Get unique owners
        const owners = [...new Set(entries.map((entry: any) => entry.owner).filter(Boolean))];
        // Add "JL" if not already in the list
        if (!owners.includes('JL')) {
          owners.push('JL');
        }
        // Sort alphabetically
        setOwnersList(owners.sort() as string[]);
      } else {
        // If no pipeline data, at least show "JL"
        setOwnersList(['JL']);
      }
    } catch (error) {
      console.error('Error loading owners list:', error);
      // Fallback to just "JL"
      setOwnersList(['JL']);
    }
  }, []);

  // Sync state when quoteReviewData prop changes (when loading a different quote)
  useEffect(() => {
    console.log('🔄 QuoteReview useEffect - quoteReviewData changed:', {
      descriptions: Object.keys(quoteReviewData.descriptions || {}),
      projectScope: quoteReviewData.projectScope,
      invoiceItemsCount: quoteReviewData.invoiceItems?.length || 0,
      invoiceItems: quoteReviewData.invoiceItems
    });
    
    // Initialize descriptions with existing quote review descriptions
    const initialDescriptions = { ...(quoteReviewData.descriptions || {}) };
    
    // Add production cost descriptions if they don't already exist
    // Inline the production cost extraction to avoid function dependency issues
    Object.keys(productionData).forEach(phase => {
      if (!project.phases?.includes(phase) || !project.phaseSettings?.[phase]?.includeProductionCosts) {
        return;
      }
      
      const phaseCategories = productionData[phase] || {};
      Object.keys(phaseCategories).forEach(category => {
        const categoryData = phaseCategories[category];
        
        if (categoryData.standardItems) {
          categoryData.standardItems.forEach((item: any) => {
            if (item.item && item.totalCost > 0 && item.description) {
              const itemId = `${phase}-${category}-${item.id}`;
              if (!initialDescriptions[itemId]) {
                initialDescriptions[itemId] = item.description;
              }
            }
          });
        }
      });
    });
    
    setDescriptions(initialDescriptions);
    setProjectScope(quoteReviewData.projectScope || '');
    setInvoiceItems((quoteReviewData.invoiceItems || []).map(item => ({
      ...item,
      percentage: item.percentage ?? 0
    })));
  }, [quoteReviewData, productionData, project.phases, project.phaseSettings]);

  // Note: Auto-save is handled by the main app component to prevent infinite loops

  // Get all project fee line items grouped by phase and department
  const getProjectFeeLineItemsByPhaseAndDepartment = () => {
    const phaseGroups: { [phase: string]: { [department: string]: Array<{
      id: string;
      role: string;
      hours: number;
      rate: number;
      total: number;
    }> } } = {};

    // Only process phases that are selected and have project fees enabled
    Object.keys(phaseData).forEach(phase => {
      // Check if this phase is selected in project setup and has project fees enabled
      if (!project.phases?.includes(phase) || !project.phaseSettings?.[phase]?.includeProjectFees) {
        return; // Skip this phase
      }
      
      phaseGroups[phase] = {};
      const stages = phaseData[phase] || [];
      stages.forEach(stage => {
        stage.departments.forEach(dept => {
          if (!phaseGroups[phase][dept.name]) {
            phaseGroups[phase][dept.name] = [];
          }
          dept.roles.forEach(role => {
            if (role.name && role.hours > 0) {
              // Try to find an existing entry for this role within the department for this phase
              const existing = phaseGroups[phase][dept.name].find(r => r.role === role.name);
              if (existing) {
                // Aggregate: sum hours and total; compute weighted average rate
                existing.hours += role.hours;
                existing.total += Math.round(role.totalDollars || 0);
                const totalHours = existing.hours;
                existing.rate = totalHours > 0 ? existing.total / totalHours : existing.rate;
              } else {
                phaseGroups[phase][dept.name].push({
                  id: `${phase}-${dept.name}-${role.id}`,
                  role: role.name,
                  hours: role.hours,
                  rate: role.rate,
                  total: Math.round(role.totalDollars || 0)
                });
              }
            }
          });
        });
      });
    });

    return phaseGroups;
  };

  // Get all production cost line items (combined across all phases)
  const getProductionCostLineItems = () => {
    const lineItems: Array<{
      id: string;
      phase: string;
      category: string;
      item: string;
      quantity?: number;
      rate?: number;
      hours?: number;
      total: number;
      description?: string;
    }> = [];



    Object.keys(productionData).forEach(phase => {
      // Check if this phase is selected in project setup and has production costs enabled
      if (!project.phases?.includes(phase) || !project.phaseSettings?.[phase]?.includeProductionCosts) {
        return; // Skip this phase
      }
      
      const phaseCategories = productionData[phase] || {};
      Object.keys(phaseCategories).forEach(category => {
        const categoryData = phaseCategories[category];
        
        // Standard items
        if (categoryData.standardItems) {
          categoryData.standardItems.forEach((item: any) => {
            if (item.item && item.totalCost > 0) {
              lineItems.push({
                id: `${phase}-${category}-${item.id}`,
                phase,
                category,
                item: item.item,
                quantity: item.quantity,
                rate: item.rate,
                total: Math.round(item.totalCost),
                description: item.description || ''
              });
            }
          });
        }

        // Media items
        if (categoryData.mediaItems) {
          categoryData.mediaItems.forEach((item: any) => {
            if (item.item && item.totalCost > 0) {
              lineItems.push({
                id: `${phase}-${category}-${item.id}`,
                phase,
                category,
                item: item.item,
                quantity: item.impressions || item.fixed,
                rate: item.cpm || item.fixed,
                total: Math.round(item.totalCost)
              });
            }
          });
        }

        // Field staff items
        if (categoryData.fieldStaffItems) {
          categoryData.fieldStaffItems.forEach((item: any) => {
            if (item.role && item.totalCost > 0) {
              lineItems.push({
                id: `${phase}-${category}-${item.id}`,
                phase,
                category,
                item: item.role,
                hours: item.totalHours,
                rate: item.hourlyRate,
                total: Math.round(item.totalCost)
              });
            }
          });
        }
      });
    });


    return lineItems;
  };

  const projectFeeItemsByPhaseAndDepartment = getProjectFeeLineItemsByPhaseAndDepartment();
  const productionCostItems = getProductionCostLineItems();

  // Calculate totals
  const projectFeesTotal = Math.round(Object.values(projectFeeItemsByPhaseAndDepartment)
    .flatMap(phase => Object.values(phase))
    .flat()
    .reduce((sum, item) => sum + item.total, 0));
  const productionCostsTotal = Math.round(productionCostItems.reduce((sum, item) => sum + item.total, 0));
  
  // Calculate creative and design resourcing fees with 1.5% charge each
  const calculateResourcingFees = () => {
    let creativeTotal = 0;
    let designTotal = 0;
    
    // Sum up Creative and Design department totals from project fees
    Object.values(projectFeeItemsByPhaseAndDepartment).forEach(phase => {
      Object.entries(phase).forEach(([deptName, items]) => {
        if (deptName === 'Creative') {
          items.forEach(item => {
            creativeTotal += item.total;
          });
        } else if (deptName === 'Design') {
          items.forEach(item => {
            designTotal += item.total;
          });
        }
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

  const { creativeTotal, designTotal, creativeResourcingFee, designResourcingFee } = calculateResourcingFees();
  const grandTotal = projectFeesTotal + productionCostsTotal + creativeResourcingFee + designResourcingFee;

  const updateDescription = (id: string, value: string) => {
    setDescriptions(prev => ({ ...prev, [id]: value }));
  };

  // Invoice management functions
  const redistributeInvoiceAmounts = (items: InvoiceLineItem[]) => {
    if (items.length === 0) return items;
    
    const amountPerInvoice = Math.ceil(grandTotal / items.length);
    const remainder = grandTotal - (amountPerInvoice * items.length);
    
    return items.map((item, index) => {
      const amount = index === 0 ? amountPerInvoice + remainder : amountPerInvoice;
      const percentage = grandTotal > 0 ? Math.round((amount / grandTotal) * 100 * 100) / 100 : 0;
      
      return {
        ...item,
        amount,
        percentage
      };
    });
  };

  const addInvoiceItem = () => {
    const nextInvoiceNumber = `Invoice ${invoiceItems.length + 1}`;
    const newItem: InvoiceLineItem = {
      id: Math.random().toString(36).substr(2, 9),
      invoiceNumber: nextInvoiceNumber,
      amount: 0,
      percentage: 0,
      paymentDue: '',
      paymentTerms: 'Upon Receipt',
      customTerms: ''
    };
    
    const newItems = [...invoiceItems, newItem];
    const redistributedItems = redistributeInvoiceAmounts(newItems);
    setInvoiceItems(redistributedItems);
  };

  const updateInvoiceItem = (id: string, field: keyof InvoiceLineItem, value: string | number) => {
    setInvoiceItems(prev => prev.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value };
        
        // If percentage is being updated, calculate the amount (round up to nearest dollar)
        if (field === 'percentage') {
          const percentage = Number(value);
          updatedItem.amount = Math.ceil((percentage / 100) * grandTotal);
        }
        // If amount is being updated, calculate the percentage
        else if (field === 'amount') {
          const amount = Number(value);
          updatedItem.percentage = grandTotal > 0 ? Math.round((amount / grandTotal) * 100 * 100) / 100 : 0;
        }
        
        return updatedItem;
      }
      return item;
    }));
  };

  const removeInvoiceItem = (id: string) => {
    const filteredItems = invoiceItems.filter(item => item.id !== id);
    const redistributedItems = redistributeInvoiceAmounts(filteredItems);
    setInvoiceItems(redistributedItems);
  };

  // Save quote review data
  const handleSaveQuote = () => {
    const currentData: QuoteReviewData = {
      projectScope,
      descriptions,
      invoiceItems
    };
    console.log('💾 QuoteReview handleSaveQuote - saving data:', {
      projectScope,
      descriptionsCount: Object.keys(descriptions).length,
      invoiceItemsCount: invoiceItems.length,
      invoiceItems
    });
    onSave(currentData);
  };

  // Submit for review
  const handleSubmitForReview = () => {
    if (!reviewerName || reviewerName.trim() === '') {
      alert('Please select a reviewer name');
      return;
    }

    // Save the quote first
    handleSaveQuote();

    // Get the actual saved quote to ensure we have the right ID
    const savedQuotesData = cloudStorage.getItem('saltxc-all-quotes');
    let actualQuoteId = (project as any).id || project.projectNumber;
    
    if (savedQuotesData) {
      try {
        const quotes = Array.isArray(savedQuotesData) ? savedQuotesData : JSON.parse(savedQuotesData);
        const matchingQuote = quotes.find((q: any) => 
          q.projectNumber === project.projectNumber || q.id === (project as any).id
        );
        if (matchingQuote) {
          actualQuoteId = matchingQuote.id;
          console.log('✅ Found matching quote with ID:', actualQuoteId);
        }
      } catch (e) {
        console.error('Error finding quote ID:', e);
      }
    }

    // Store the review request in Cloud SQL-backed storage
    const reviewRequest = {
      quoteId: actualQuoteId,
      projectNumber: project.projectNumber,
      reviewerName: reviewerName, // Store reviewer name instead of email
      submittedBy: (project as any).createdBy || 'Current User',
      submittedDate: new Date().toISOString(),
      status: 'pending',
      message: `Please review and approve the budget for ${project.clientName} - ${project.projectName}`
    };

    console.log('📤 Submitting review request:', reviewRequest);

    // Get existing requests or create new array
    const existingRequests = JSON.parse(cloudStorage.getItem('quote-review-requests') || '[]');
    existingRequests.push(reviewRequest);
    cloudStorage.setItem('quote-review-requests', JSON.stringify(existingRequests));

    console.log('💾 Saved review requests:', existingRequests);
    console.log('💾 Total review requests in storage:', existingRequests.length);

    // Trigger a storage event manually for same-tab updates
    window.dispatchEvent(new Event('storage'));

    // Generate a shareable link (in production, this would be a unique URL)
    const quoteLink = `${window.location.origin}?quote=${project.projectNumber}`;
    
    // In a production environment, this would send an actual email via API
    // For now, we'll show a confirmation and copy the link to clipboard
    navigator.clipboard.writeText(quoteLink).then(() => {
      alert(`Review request sent to ${reviewerName}\n\nThe quote will appear in their Admin View.\n\nLink copied to clipboard:\n${quoteLink}`);
      setShowSubmitDialog(false);
      setReviewerName('');
    }).catch(() => {
      alert(`Review request sent to ${reviewerName}\n\nThe quote will appear in their Admin View.\n\nPlease copy this link:\n${quoteLink}`);
      setShowSubmitDialog(false);
      setReviewerName('');
    });
  };

  // PDF download function with proper 8.5" width formatting
  const downloadPDF = async () => {
    try {
      // Dynamic import to avoid build issues
      const html2canvas = (await import('html2canvas')).default;
      const jsPDF = (await import('jspdf')).jsPDF;

      // Create a temporary container for the PDF content
      const tempContainer = document.createElement('div');
      tempContainer.style.position = 'absolute';
      tempContainer.style.left = '-9999px';
      tempContainer.style.top = '0';
      tempContainer.style.width = '800px';
      tempContainer.style.padding = '20px';
      tempContainer.style.backgroundColor = 'white';
      tempContainer.style.fontFamily = 'Arial, sans-serif';
      tempContainer.style.fontSize = '12px';
      tempContainer.style.lineHeight = '1.4';
      
      // Get project fee data
      const projectFeeData = getProjectFeeLineItemsByPhaseAndDepartment();
      
      // Create the PDF content based on Quote Preview
      tempContainer.innerHTML = `
        <div style="text-align: center; margin-bottom: 20px;">
          <img src="/salt-logo.png" alt="Salt Logo" style="height: 40px; width: auto; margin-bottom: 10px;" />
          <h1 style="font-size: 24px; font-weight: bold; margin: 0 0 5px 0;">QUOTE</h1>
          <p style="font-size: 14px; margin: 0;">${project.clientName} - ${project.projectName}</p>
        </div>

        <!-- Project Summary -->
        <div style="border: 1px solid #333; margin-bottom: 16px; padding: 12px;">
          <h2 style="font-size: 16px; font-weight: bold; margin: 0 0 8px 0; border-bottom: 1px solid #333; padding-bottom: 4px;">Project Summary</h2>
          <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 12px;">
            <div style="font-size: 11px; line-height: 1.6;">
              <div><strong>Client:</strong> ${project.clientName}</div>
              <div><strong>Brand:</strong> ${project.brand}</div>
              <div><strong>Project:</strong> ${project.projectName}</div>
              <div><strong>Start Date:</strong> ${project.startDate ? new Date(project.startDate).toLocaleDateString() : '—'}</div>
              <div><strong>End Date:</strong> ${project.endDate ? new Date(project.endDate).toLocaleDateString() : '—'}</div>
            </div>
            ${projectScope ? `
              <div>
                <div style="font-size: 11px; font-weight: bold;">Project Scope:</div>
                <p style="font-size: 11px; margin: 4px 0 0 0; line-height: 1.4;">${projectScope}</p>
              </div>
            ` : ''}
          </div>
        </div>

        <!-- Project Fees -->
        <div style="border: 1px solid #333; margin-bottom: 16px; padding: 12px;">
          <h2 style="font-size: 16px; font-weight: bold; margin: 0 0 8px 0; border-bottom: 1px solid #333; padding-bottom: 4px;">Project Fees</h2>
          
          ${Object.entries(projectFeeData).map(([phaseName, departments]) => `
            <div style="margin-bottom: 12px;">
              <h3 style="font-size: 13px; font-weight: bold; margin: 0 0 4px 0; ${(() => {
                const normalizedPhase = phaseName.toLowerCase();
                if (normalizedPhase.includes('planning')) return 'color: #183f9d;';
                if (normalizedPhase.includes('post') || normalizedPhase.includes('wrap')) return 'color: #7e2e0b;';
                if (normalizedPhase.includes('production') || normalizedPhase.includes('execution')) return 'color: #554511;';
                return 'color: #000;';
              })()}">${phaseName}</h3>
              
              ${Object.entries(departments).map(([deptName, roles]) => {
                const deptTotal = roles.reduce((sum, role) => sum + role.total, 0);
                // Add resourcing fee to department total
                const deptTotalWithResourcing = deptTotal + 
                  (deptName === 'Creative' && creativeResourcingFee > 0 ? Math.round(creativeResourcingFee) : 0) +
                  (deptName === 'Design' && designResourcingFee > 0 ? Math.round(designResourcingFee) : 0);
                const phaseColorClass = (() => {
                  const normalizedPhase = phaseName.toLowerCase();
                  if (normalizedPhase.includes('planning')) return 'background-color: #EDF0FE; color: #183f9d;';
                  if (normalizedPhase.includes('post') || normalizedPhase.includes('wrap')) return 'background-color: #f7c3ac; color: #7e2e0b;';
                  if (normalizedPhase.includes('production') || normalizedPhase.includes('execution')) return 'background-color: #fdf0cd; color: #554511;';
                  return 'background-color: #f5f5f5; color: #000;';
                })();
                
                return `
                  <div style="margin-bottom: 8px;">
                    <h4 style="font-size: 11px; font-weight: bold; ${phaseColorClass} padding: 4px; display: flex; justify-content: space-between; margin: 0 0 2px 0;">
                      <span>${deptName}</span>
                      <span>$${deptTotalWithResourcing.toLocaleString()}</span>
                    </h4>
                    ${roles.map((role) => `
                      <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr 2fr; gap: 8px; font-size: 10px; padding: 2px 0; border-bottom: 1px solid #eee;">
                        <div style="color: #000;">${role.role}</div>
                        <div style="text-align: center; color: #000;">${role.hours.toFixed(0)}</div>
                        <div style="text-align: center; color: #000;">$${role.rate.toLocaleString()}</div>
                        <div style="text-align: center; color: #000;">$${role.total.toLocaleString()}</div>
                        <div style="font-size: 9px; color: #666;">${descriptions[role.id] || ''}</div>
                      </div>
                    `).join('')}
                    ${deptName === 'Creative' && creativeResourcingFee > 0 ? `
                      <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr 2fr; gap: 8px; font-size: 10px; padding: 2px 0; border-bottom: 1px solid #eee;">
                        <div style="color: #2563eb; font-weight: bold;">Creative Resourcing (1.5%)</div>
                        <div style="text-align: center; color: #666;">-</div>
                        <div style="text-align: center; color: #666;">-</div>
                        <div style="text-align: center; color: #2563eb; font-weight: bold;">$${Math.round(creativeResourcingFee).toLocaleString()}</div>
                        <div style="font-size: 9px; color: #666;">Project Management & Resourcing</div>
                      </div>
                    ` : ''}
                    ${deptName === 'Design' && designResourcingFee > 0 ? `
                      <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr 2fr; gap: 8px; font-size: 10px; padding: 2px 0; border-bottom: 1px solid #eee;">
                        <div style="color: #2563eb; font-weight: bold;">Design Resourcing (1.5%)</div>
                        <div style="text-align: center; color: #666;">-</div>
                        <div style="text-align: center; color: #666;">-</div>
                        <div style="text-align: center; color: #2563eb; font-weight: bold;">$${Math.round(designResourcingFee).toLocaleString()}</div>
                        <div style="font-size: 9px; color: #666;">Project Management & Resourcing</div>
                      </div>
                    ` : ''}
                  </div>
                `;
              }).join('')}
            </div>
          `).join('')}
          
          <div style="background-color: #f8f9fc; padding: 8px; margin-top: 8px;">
            <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 13px; color: #363838;">
              <span>Project Fee Total:</span>
              <span>$${projectFeesTotal.toLocaleString()} ${project.currency}</span>
            </div>
          </div>
        </div>

        <!-- Production Costs -->
        ${productionCostItems.length > 0 ? `
          <div style="border: 1px solid #333; margin-bottom: 16px; padding: 12px;">
            <h2 style="font-size: 16px; font-weight: bold; margin: 0 0 8px 0; border-bottom: 1px solid #333; padding-bottom: 4px;">Production Costs</h2>
            
            ${(() => {
              const groupedByPhase: { [phase: string]: { [category: string]: typeof productionCostItems } } = {};
              
              productionCostItems.forEach(item => {
                if (!groupedByPhase[item.phase]) {
                  groupedByPhase[item.phase] = {};
                }
                if (!groupedByPhase[item.phase][item.category]) {
                  groupedByPhase[item.phase][item.category] = [];
                }
                groupedByPhase[item.phase][item.category].push(item);
              });

              return Object.entries(groupedByPhase).map(([phaseName, categories]) => `
                <div style="margin-bottom: 12px;">
                  <h3 style="font-size: 13px; font-weight: bold; margin: 0 0 4px 0; ${(() => {
                    const normalizedPhase = phaseName.toLowerCase();
                    if (normalizedPhase.includes('planning')) return 'color: #183f9d;';
                    if (normalizedPhase.includes('post') || normalizedPhase.includes('wrap')) return 'color: #7e2e0b;';
                    if (normalizedPhase.includes('production') || normalizedPhase.includes('execution')) return 'color: #554511;';
                    return 'color: #000;';
                  })()}">${phaseName}</h3>
                  
                  ${Object.entries(categories).map(([categoryName, items]) => {
                    const categoryTotal = items.reduce((sum, item) => sum + item.total, 0);
                    const phaseColorClass = (() => {
                      const normalizedPhase = phaseName.toLowerCase();
                      if (normalizedPhase.includes('planning')) return 'background-color: #EDF0FE; color: #183f9d;';
                      if (normalizedPhase.includes('post') || normalizedPhase.includes('wrap')) return 'background-color: #f7c3ac; color: #7e2e0b;';
                      if (normalizedPhase.includes('production') || normalizedPhase.includes('execution')) return 'background-color: #fdf0cd; color: #554511;';
                      return 'background-color: #f5f5f5; color: #000;';
                    })();
                    
                    return `
                      <div style="margin-bottom: 8px;">
                        <h4 style="font-size: 11px; font-weight: bold; ${phaseColorClass} padding: 4px; display: flex; justify-content: space-between; margin: 0 0 2px 0;">
                          <span>${categoryName}</span>
                          <span>$${categoryTotal.toLocaleString()}</span>
                        </h4>
                        
                        <!-- Column Headers -->
                        <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr 2fr; gap: 8px; font-size: 10px; font-weight: bold; background-color: #f5f5f5; padding: 4px; margin-bottom: 4px; border-bottom: 1px solid #333;">
                          <div>Item</div>
                          <div style="text-align: center;">Qty/Hrs</div>
                          <div style="text-align: center;">Rate</div>
                          <div style="text-align: center;">Total</div>
                          <div>Description</div>
                        </div>
                        
                        ${items.map((item) => `
                          <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr 2fr; gap: 8px; font-size: 10px; padding: 2px 0; border-bottom: 1px solid #eee;">
                            <div style="color: #000;">${item.item}</div>
                            <div style="text-align: center; color: #000;">${item.hours ? item.hours.toFixed(0).toLocaleString() : (item.quantity ? item.quantity.toLocaleString() : '-')}</div>
                            <div style="text-align: center; color: #000;">${item.rate ? `$${item.rate.toLocaleString()}` : '-'}</div>
                            <div style="text-align: center; color: #000;">$${item.total.toLocaleString()}</div>
                            <div style="font-size: 9px; color: #666;">${descriptions[item.id] || ''}</div>
                          </div>
                        `).join('')}
                      </div>
                    `;
                  }).join('')}
                </div>
              `).join('');
            })()}
            
            <div style="background-color: #f8f9fc; padding: 8px; margin-top: 8px;">
              <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 13px; color: #363838;">
                <span>Production Costs Total:</span>
                <span>$${productionCostsTotal.toLocaleString()} ${project.currency}</span>
              </div>
            </div>
          </div>
        ` : ''}

        <!-- Project Estimate -->
        <div style="background-color: #f8f9fc; padding: 12px; margin-top: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center; font-weight: bold; color: #363838; font-size: 14px;">
            <span>Project Estimate:</span>
            <span>$${grandTotal.toLocaleString()} ${project.currency}</span>
          </div>
        </div>

        <!-- Invoicing Schedule -->
        ${invoiceItems.length > 0 ? `
          <div style="border: 1px solid #333; margin-top: 16px; padding: 12px;">
            <h2 style="font-size: 16px; font-weight: bold; margin: 0 0 8px 0; border-bottom: 1px solid #333; padding-bottom: 4px;">Invoicing Schedule</h2>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr 1fr; gap: 8px; font-size: 10px; font-weight: bold; background-color: #f5f5f5; padding: 4px; margin-bottom: 8px; border-bottom: 1px solid #333;">
              <div>Invoice #</div>
              <div style="text-align: center;">%</div>
              <div style="text-align: center;">Amount</div>
              <div>Payment Due</div>
              <div>Payment Terms</div>
            </div>
            
            ${invoiceItems.map((item) => `
              <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr 1fr; gap: 8px; font-size: 10px; padding: 2px 0; border-bottom: 1px solid #eee;">
                <div style="color: #000;">${item.invoiceNumber}</div>
                <div style="text-align: center; color: #000;">${item.percentage}%</div>
                <div style="text-align: center; color: #000;">$${item.amount.toLocaleString()}</div>
                <div style="color: #000;">${item.paymentDue}</div>
                <div style="color: #000;">${item.paymentTerms === 'Custom' ? item.customTerms : item.paymentTerms}</div>
              </div>
            `).join('')}
            
            <div style="background-color: #f8f9fc; padding: 8px; margin-top: 8px;">
              <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 13px; color: #363838;">
                <span>Total Invoiced:</span>
                <span>$${invoiceItems.reduce((sum, item) => sum + item.amount, 0).toLocaleString()} ${project.currency}</span>
            </div>
          </div>
        </div>
      ` : ''}
      `;

      document.body.appendChild(tempContainer);

      // Generate canvas from the content
      const canvas = await html2canvas(tempContainer, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: 800,
        height: tempContainer.scrollHeight
      });

      // Remove the temporary container
      document.body.removeChild(tempContainer);

      // Create PDF
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgData = canvas.toDataURL('image/png');
      
      const pdfWidth = 210; // A4 width in mm
      const imgWidth = pdfWidth - 20; // Leave 10mm margin on each side
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      // Add image to PDF starting from top with minimal margin
      pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, imgHeight);

      // Download the PDF
      const fileName = `Quote_${project.clientName}_${project.projectName}_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);

    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try again.');
    }
  };

  // Component for PDF Preview
  const PDFPreview = () => (
    <div className="bg-white p-8 w-full max-w-none" style={{ fontSize: '10px', lineHeight: '1.2' }}>
      {/* Header */}
      <div className="text-center mb-6">
        <div className="flex justify-center mb-2">
          <img src="/salt-logo.png" alt="Salt Logo" className="h-10 w-auto" />
        </div>
        <h1 className="text-xl font-bold mb-2">QUOTE</h1>
        <p className="text-sm">{project.clientName} - {project.projectName}</p>
      </div>

      {/* Project Summary */}
      <div className="border border-gray-300 mb-4 p-3">
        <h2 className="text-md font-bold mb-2 border-b border-gray-300 pb-1">Project Summary</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Project Details - Left Column */}
          <div className="space-y-1 text-xs">
            <div><strong>Client:</strong> {project.clientName}</div>
            <div><strong>Brand:</strong> {project.brand}</div>
            <div><strong>Project:</strong> {project.projectName}</div>
            <div><strong>Brief Date:</strong> {project.briefDate ? new Date(project.briefDate).toLocaleDateString() : '—'}</div>
            <div><strong>In Market Date:</strong> {project.inMarketDate ? new Date(project.inMarketDate).toLocaleDateString() : '—'}</div>
            <div><strong>Completion Date:</strong> {project.projectCompletionDate ? new Date(project.projectCompletionDate).toLocaleDateString() : '—'}</div>
          </div>
          
          {/* Project Scope - Right Column (spans 2 columns) */}
          {projectScope && (
            <div className="md:col-span-2">
              <div className="text-xs"><strong>Project Scope:</strong></div>
              <div className="text-xs mt-1 whitespace-pre-line">
                {projectScope.split('\n').map((line, index) => {
                  // Handle bullet points
                  if (line.trim().startsWith('•')) {
                    return <div key={index} className="ml-2">• {line.substring(1).trim()}</div>;
                  }
                  // Handle bold text (markdown style **text**)
                  if (line.includes('**')) {
                    const parts = line.split(/(\*\*.*?\*\*)/g);
                    return (
                      <div key={index}>
                        {parts.map((part, partIndex) => {
                          if (part.startsWith('**') && part.endsWith('**')) {
                            return <strong key={partIndex}>{part.slice(2, -2)}</strong>;
                          }
                          return part;
                        })}
                      </div>
                    );
                  }
                  return <div key={index}>{line}</div>;
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Project Fees */}
      <div className="border border-gray-300 mb-4 p-3">
        <h2 className="text-md font-bold mb-2 border-b border-gray-300 pb-1">Project Fees</h2>
        
        {/* Column Headers */}
        <div className="grid gap-2 text-xs font-semibold bg-gray-100 p-1 mb-2 border-b border-gray-300" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 2fr' }}>
          <div>Role</div>
          <div className="text-center">Hours</div>
          <div className="text-center">Rate</div>
          <div className="text-center">Total</div>
          <div>Description</div>
        </div>
        
        {Object.entries(getProjectFeeLineItemsByPhaseAndDepartment()).map(([phaseName, departments]) => (
          <div key={phaseName} className="mb-3">
            <h3 className={`text-sm font-bold mb-1 ${(() => {
              const normalizedPhase = phaseName.toLowerCase();
              if (normalizedPhase.includes('planning')) return 'text-[#183f9d]';
              if (normalizedPhase.includes('post') || normalizedPhase.includes('wrap')) return 'text-[#7e2e0b]';
              if (normalizedPhase.includes('production') || normalizedPhase.includes('execution')) return 'text-[#554511]';
              return 'text-gray-800';
            })()}`}>{phaseName}</h3>
            
            {Object.entries(departments).map(([deptName, roles]) => {
              const deptTotal = roles.reduce((sum, role) => sum + role.total, 0);
                                const phaseColorClass = (() => {
                    const normalizedPhase = phaseName.toLowerCase();
                    if (normalizedPhase.includes('planning')) return 'bg-[#EDF0FE] text-[#183f9d]';
                    if (normalizedPhase.includes('post') || normalizedPhase.includes('wrap')) return 'bg-[#f7c3ac] text-[#7e2e0b]';
                    if (normalizedPhase.includes('production') || normalizedPhase.includes('execution')) return 'bg-[#fdf0cd] text-[#554511]';
                    return 'bg-gray-100 text-gray-800';
                  })();
                  
                  return (
                    <div key={deptName} className="mb-2">
                      <h4 className={`text-xs font-semibold ${phaseColorClass} p-1 flex justify-between`}>
                        <span>{deptName}</span>
                        <span>${deptTotal.toLocaleString()}</span>
                      </h4>
                  {roles.map((role) => (
                    <div key={role.id} className={`grid gap-2 text-xs py-0.5 border-b ${(() => {
                      const normalizedPhase = phaseName.toLowerCase();
                      if (normalizedPhase.includes('planning')) return 'border-[#EDF0FE]';
                      if (normalizedPhase.includes('post') || normalizedPhase.includes('wrap')) return 'border-[#f7c3ac]';
                      if (normalizedPhase.includes('production') || normalizedPhase.includes('execution')) return 'border-[#fdf0cd]';
                      return 'border-gray-100';
                    })()}`} style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 2fr' }}>
                      <div className="text-black">{role.role}</div>
                      <div className="text-center text-black">{role.hours.toFixed(0)}</div>
                      <div className="text-center text-black">${role.rate.toLocaleString()}</div>
                      <div className="text-center text-black">${role.total.toLocaleString()}</div>
                      <div className="text-xs text-gray-600">{descriptions[role.id] || ''}</div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
        
        <div className="p-2 mt-2" style={{ backgroundColor: '#f8f9fc' }}>
          <div className="flex justify-between items-center font-bold text-sm" style={{ color: '#363838' }}>
            <span>Project Fee Total:</span>
            <span className="text-sm">{`$${projectFeesTotal.toLocaleString()} ${project.currency}`}</span>
          </div>
        </div>
      </div>

      {/* Production Costs */}
      {productionCostItems.length > 0 && (
        <div className="border border-gray-300 mb-4 p-3">
          <h2 className="text-md font-bold mb-2 border-b border-gray-300 pb-1">Production Costs</h2>
          
          {(() => {
            const groupedByPhase: { [phase: string]: { [category: string]: typeof productionCostItems } } = {};
            
            productionCostItems.forEach(item => {
              if (!groupedByPhase[item.phase]) {
                groupedByPhase[item.phase] = {};
              }
              if (!groupedByPhase[item.phase][item.category]) {
                groupedByPhase[item.phase][item.category] = [];
              }
              groupedByPhase[item.phase][item.category].push(item);
            });

            return Object.entries(groupedByPhase).map(([phaseName, categories]) => (
              <div key={phaseName} className="mb-3">
                <h3 className={`text-sm font-bold mb-1 ${(() => {
                  const normalizedPhase = phaseName.toLowerCase();
                  if (normalizedPhase.includes('planning')) return 'text-[#183f9d]';
                  if (normalizedPhase.includes('post') || normalizedPhase.includes('wrap')) return 'text-[#7e2e0b]';
                  if (normalizedPhase.includes('production') || normalizedPhase.includes('execution')) return 'text-[#554511]';
                  return 'text-gray-800';
                })()}`}>{phaseName}</h3>
                
                {Object.entries(categories).map(([categoryName, items]) => {
                  const categoryTotal = items.reduce((sum, item) => sum + item.total, 0);
                  const phaseColorClass = (() => {
                    const normalizedPhase = phaseName.toLowerCase();
                    if (normalizedPhase.includes('planning')) return 'bg-[#EDF0FE] text-[#183f9d]';
                    if (normalizedPhase.includes('post') || normalizedPhase.includes('wrap')) return 'bg-[#f7c3ac] text-[#7e2e0b]';
                    if (normalizedPhase.includes('production') || normalizedPhase.includes('execution')) return 'bg-[#fdf0cd] text-[#554511]';
                    return 'bg-gray-100 text-gray-800';
                  })();
                  
                  return (
                    <div key={categoryName} className="mb-2">
                      <h4 className={`text-xs font-semibold ${phaseColorClass} p-1 flex justify-between`}>
                        <span>{categoryName}</span>
                        <span>${categoryTotal.toLocaleString()}</span>
                      </h4>
                      
                      {/* Column Headers */}
                      <div className="grid gap-2 text-xs font-semibold bg-gray-100 p-1 mb-1 border-b border-gray-300" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 2fr' }}>
                        <div>Item</div>
                        <div className="text-center">Qty/Hrs</div>
                        <div className="text-center">Rate</div>
                        <div className="text-center">Total</div>
                        <div>Description</div>
                      </div>
                      
                      {items.map((item) => (
                        <div key={item.id} className={`grid gap-2 text-xs py-0.5 border-b ${(() => {
                          const normalizedPhase = phaseName.toLowerCase();
                          if (normalizedPhase.includes('planning')) return 'border-[#EDF0FE]';
                          if (normalizedPhase.includes('post') || normalizedPhase.includes('wrap')) return 'border-[#f7c3ac]';
                          if (normalizedPhase.includes('production') || normalizedPhase.includes('execution')) return 'border-[#fdf0cd]';
                          return 'border-gray-100';
                        })()}`} style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 2fr' }}>
                          <div className="text-black">{item.item}</div>
                          <div className="text-center text-black">{item.hours ? item.hours.toFixed(0).toLocaleString() : (item.quantity ? item.quantity.toLocaleString() : '-')}</div>
                          <div className="text-center text-black">{item.rate ? `$${item.rate.toLocaleString()}` : '-'}</div>
                          <div className="text-center text-black">${item.total.toLocaleString()}</div>
                          <div className="text-xs text-gray-600">{descriptions[item.id] || ''}</div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            ));
          })()}
          
          <div className="p-2 mt-2" style={{ backgroundColor: '#f8f9fc' }}>
            <div className="flex justify-between font-bold text-sm" style={{ color: '#363838' }}>
              <span>Production Costs Total:</span>
              <span className="text-sm">{`$${productionCostsTotal.toLocaleString()} ${project.currency}`}</span>
            </div>
          </div>
        </div>
      )}

      {/* Project Estimate */}
      <div className="p-3 mb-6" style={{ backgroundColor: '#f8f9fc', color: '#363838' }}>
        <div className="flex justify-between items-center">
          <span className="font-semibold text-base">Project Estimate:</span>
          <span className="font-bold text-base">{`$${grandTotal.toLocaleString()} ${project.currency}`}</span>
        </div>
      </div>

      {/* Invoicing Schedule */}
      {invoiceItems.length > 0 && (
        <div className="border border-gray-300 mb-4 p-3">
          <h2 className="text-md font-bold mb-2 border-b border-gray-300 pb-1">Invoicing Schedule</h2>
          
          <div className="grid grid-cols-5 gap-2 text-xs font-semibold border-b border-gray-300 pb-1 mb-2">
            <div>Invoice #</div>
            <div>%</div>
            <div>Amount</div>
            <div>Payment Due</div>
            <div>Payment Terms</div>
          </div>
          
          {invoiceItems.map((item) => (
            <div key={item.id} className="grid grid-cols-5 gap-2 text-xs py-0.5 border-b border-gray-100">
              <div>{item.invoiceNumber}</div>
              <div>{item.percentage}%</div>
              <div>${item.amount.toLocaleString()}</div>
              <div>{item.paymentDue}</div>
              <div>{item.paymentTerms === 'Custom' ? item.customTerms : item.paymentTerms}</div>
            </div>
          ))}
          

        </div>
      )}
    </div>
  );

  return (
    <div className="container mx-auto p-6 space-y-6 quote-review-content">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          {/* Title removed per request */}
          <p className="text-gray-600">Review your quote and set the detailed scope, invoicing schedule and export to PDF for client approval</p>
        </div>
      </div>

      {/* Pricing Type Selection */}
      <Card className="mb-6">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Quote Format</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Label htmlFor="pricingType" className="text-sm font-medium">Pricing Type:</Label>
            <Select value={pricingType} onValueChange={(value: 'value' | 'line-item') => setPricingType(value)}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="value">Value Pricing</SelectItem>
                <SelectItem value="line-item">Line Item Pricing</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">
              {pricingType === 'value' 
                ? 'Shows consolidated pricing by phase/category' 
                : 'Shows detailed breakdown of all roles and items'
              }
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Project Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            <span>Project Summary</span>
            <Button variant="outline" size="sm" onClick={() => onEdit('setup')} className="no-print">
              Edit Project Details
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Project Details - Left Column */}
            <div className="space-y-2 text-sm">
              <div><strong>Client:</strong> {project.clientName}</div>
              <div><strong>Brand:</strong> {project.brand}</div>
              <div><strong>Project:</strong> {project.projectName}</div>
              <div><strong>Start Date:</strong> {project.startDate ? new Date(project.startDate).toLocaleDateString() : '—'}</div>
              <div><strong>End Date:</strong> {project.endDate ? new Date(project.endDate).toLocaleDateString() : '—'}</div>
            </div>
            
            {/* Project Scope - Right Column (spans 2 columns) */}
            <div className="md:col-span-2">
              <label htmlFor="projectScope" className="block text-sm font-medium text-gray-600 mb-2">
                Project Scope
              </label>
              
              {/* Rich Text Editor Toolbar */}
              <div className="flex gap-2 mb-2 p-2 bg-gray-50 rounded border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const textarea = document.getElementById('projectScope') as HTMLTextAreaElement;
                    if (textarea) {
                      const start = textarea.selectionStart;
                      const end = textarea.selectionEnd;
                      const selectedText = textarea.value.substring(start, end);
                      const newText = textarea.value.substring(0, start) + `**${selectedText}**` + textarea.value.substring(end);
                      setProjectScope(newText);
                      // Set cursor position after the bold markers
                      setTimeout(() => {
                        textarea.focus();
                        textarea.setSelectionRange(start + 2, end + 2);
                      }, 0);
                    }
                  }}
                  className="text-xs h-7 px-2 font-bold"
                >
                  B
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const textarea = document.getElementById('projectScope') as HTMLTextAreaElement;
                    if (textarea) {
                      const start = textarea.selectionStart;
                      const end = textarea.selectionEnd;
                      const selectedText = textarea.value.substring(start, end);
                      
                      // If text is selected, add bullets to each line
                      if (start !== end) {
                        const lines = selectedText.split('\n');
                        const bulletedLines = lines.map(line => line.trim() ? `• ${line.trim()}` : line).join('\n');
                        const newText = textarea.value.substring(0, start) + bulletedLines + textarea.value.substring(end);
                        setProjectScope(newText);
                        
                        // Select the newly bulleted text
                        setTimeout(() => {
                          textarea.focus();
                          textarea.setSelectionRange(start, start + bulletedLines.length);
                        }, 0);
                      } else {
                        // If no text selected, just add a bullet at cursor position
                        const newText = textarea.value.substring(0, start) + '• ' + textarea.value.substring(start);
                        setProjectScope(newText);
                        setTimeout(() => {
                          textarea.focus();
                          textarea.setSelectionRange(start + 2, start + 2);
                        }, 0);
                      }
                    }
                  }}
                  className="text-xs h-7 px-2"
                >
                  •
                </Button>
                <span className="text-xs text-gray-500 self-center">Select text and click B for bold, select multiple lines and click • for bullets</span>
              </div>
              
              <Textarea
                id="projectScope"
                placeholder="Enter the total scope associated with this project...&#10;&#10;Use the toolbar above to:&#10;• Add bullet points&#10;• Make text **bold**"
                value={projectScope}
                onChange={(e) => setProjectScope(e.target.value)}
                className="min-h-[140px] resize-none font-mono text-sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Project Fees Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            <span>Project Fees</span>
            <Button variant="outline" size="sm" onClick={() => onEdit('project-fees')}>
              Edit
            </Button>
          </CardTitle>
          <CardDescription>Professional services and team resources</CardDescription>
        </CardHeader>
        <CardContent>
          {Object.keys(projectFeeItemsByPhaseAndDepartment).length > 0 ? (
            <div className="space-y-2">
              {/* Header Row */}
              <div className={`grid gap-4 font-medium text-xs text-gray-600 border-b pb-1 ${
                pricingType === 'value' ? 'grid-cols-8' : 'grid-cols-12'
              }`}>
                <div className="col-span-3">Role</div>
                {pricingType === 'line-item' && (
                  <>
                    <div className="col-span-1 text-center">Hours</div>
                    <div className="col-span-1 text-center">Rate</div>
                  </>
                )}
                <div className="col-span-1 text-right">Total</div>
                <div className={pricingType === 'value' ? 'col-span-4' : 'col-span-6'}>Description</div>
              </div>

              {/* Phase Sections */}
              {Object.entries(projectFeeItemsByPhaseAndDepartment).map(([phase, departments]) => (
                Object.keys(departments).length > 0 && (
                  <div key={phase} className="space-y-1">
                    {/* Phase Header */}
                    <h3 className={`text-md font-semibold ${getPhaseTextColor(phase)} border-b ${getPhaseBorderColor(phase)} pb-0.5 mb-1`}>
                      {phase}
                    </h3>
                    
                    {/* Department Sections */}
                    {Object.entries(departments).map(([department, roles]) => {
                      const departmentTotal = roles.reduce((sum, role) => sum + role.total, 0);
                      // Add resourcing fee to department total
                      const departmentTotalWithResourcing = departmentTotal + 
                        (department === 'Creative' && creativeResourcingFee > 0 ? Math.round(creativeResourcingFee) : 0) +
                        (department === 'Design' && designResourcingFee > 0 ? Math.round(designResourcingFee) : 0);
                      return roles.length > 0 && (
                        <div key={`${phase}-${department}`} className="space-y-0.5">
                          {/* Department Header */}
                          <h4 className={`text-sm font-medium ${getPhaseTextColor(phase)} ${getPhaseBackgroundColor(phase)} px-2 py-0.5 rounded flex justify-between`}>
                            <span>{department}</span>
                            <span className="font-semibold">${departmentTotalWithResourcing.toLocaleString()}</span>
                          </h4>
                          
                          {/* Role Rows for this Department */}
                          {roles.map((role) => (
                            <div key={role.id} className={`grid gap-4 items-center py-0.5 border-b border-gray-100 hover:bg-gray-50 ml-3 ${
                              pricingType === 'value' ? 'grid-cols-8' : 'grid-cols-12'
                            }`}>
                              <div className="col-span-3 text-xs">{role.role}</div>
                              {pricingType === 'line-item' && (
                                <>
                                  <div className="col-span-1 text-center text-xs">{role.hours.toFixed(0).toLocaleString()}</div>
                                  <div className="col-span-1 text-center text-xs">${role.rate.toLocaleString()}</div>
                                </>
                              )}
                              <div className="col-span-1 text-right text-xs font-semibold">${role.total.toLocaleString()}</div>
                              <div className={pricingType === 'value' ? 'col-span-4' : 'col-span-6'}>
                                                    <Input
                      placeholder="Add description..."
                      value={descriptions[role.id] || ''}
                      onChange={(e) => {
                        const value = e.target.value.slice(0, 100);
                        updateDescription(role.id, value);
                      }}
                      maxLength={100}
                      className="h-8 text-xs leading-none w-full px-2 placeholder:text-xs"
                    />
                              </div>
                            </div>
                          ))}
                          
                          {/* Add Creative Resourcing line item under Creative department */}
                          {department === 'Creative' && creativeResourcingFee > 0 && (
                            <div className={`grid gap-4 items-center py-0.5 border-b border-gray-100 hover:bg-gray-50 ml-3 ${
                              pricingType === 'value' ? 'grid-cols-8' : 'grid-cols-12'
                            }`}>
                              <div className="col-span-3 text-xs font-medium text-blue-600">Creative Resourcing (1.5%)</div>
                              {pricingType === 'line-item' && (
                                <>
                                  <div className="col-span-1 text-center text-xs">-</div>
                                  <div className="col-span-1 text-center text-xs">-</div>
                                </>
                              )}
                              <div className="col-span-1 text-right text-xs font-semibold text-blue-600">${Math.round(creativeResourcingFee).toLocaleString()}</div>
                              <div className={pricingType === 'value' ? 'col-span-4' : 'col-span-6'}>
                                <div className="text-xs text-gray-500 px-2 py-2">Project Management & Resourcing</div>
                              </div>
                            </div>
                          )}
                          
                          {/* Add Design Resourcing line item under Design department */}
                          {department === 'Design' && designResourcingFee > 0 && (
                            <div className={`grid gap-4 items-center py-0.5 border-b border-gray-100 hover:bg-gray-50 ml-3 ${
                              pricingType === 'value' ? 'grid-cols-8' : 'grid-cols-12'
                            }`}>
                              <div className="col-span-3 text-xs font-medium text-blue-600">Design Resourcing (1.5%)</div>
                              {pricingType === 'line-item' && (
                                <>
                                  <div className="col-span-1 text-center text-xs">-</div>
                                  <div className="col-span-1 text-center text-xs">-</div>
                                </>
                              )}
                              <div className="col-span-1 text-right text-xs font-semibold text-blue-600">${Math.round(designResourcingFee).toLocaleString()}</div>
                              <div className={pricingType === 'value' ? 'col-span-4' : 'col-span-6'}>
                                <div className="text-xs text-gray-500 px-2 py-2">Project Management & Resourcing</div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )
              ))}

              {/* Project Fees Subtotal */}
              <div className="flex justify-end pt-2 p-2 rounded" style={{ backgroundColor: '#f8f9fc' }}>
                <div className="flex gap-4 items-center font-bold" style={{ color: '#363838' }}>
                  <span className="text-sm whitespace-nowrap">Project Fee Total:</span>
                  <span className="text-sm">{`$${projectFeesTotal.toLocaleString()} ${project.currency}`}</span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No project fees configured</p>
          )}
        </CardContent>
      </Card>

      {/* Production Costs Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            <span>Production Costs</span>
            <Button variant="outline" size="sm" onClick={() => onEdit('production-costs')}>
              Edit
            </Button>
          </CardTitle>
          <CardDescription>Production costs and hard expenses</CardDescription>
        </CardHeader>
        <CardContent>
          {productionCostItems.length > 0 ? (
            <div className="space-y-2">
              {/* Header Row */}
              <div className={`grid gap-4 font-medium text-xs text-gray-600 border-b pb-1 ${
                pricingType === 'value' ? 'grid-cols-8' : 'grid-cols-12'
              }`}>
                <div className="col-span-3">Item</div>
                {pricingType === 'line-item' && (
                  <>
                    <div className="col-span-1 text-center">Qty/Hrs</div>
                    <div className="col-span-1 text-center">Rate</div>
                  </>
                )}
                <div className="col-span-1 text-right">Total</div>
                <div className={pricingType === 'value' ? 'col-span-4' : 'col-span-6'}>Description</div>
              </div>

              {/* Group production costs by phase, then by category */}
              {(() => {
                const groupedByPhase: { [phase: string]: { [category: string]: typeof productionCostItems } } = {};
                
                productionCostItems.forEach(item => {
                  if (!groupedByPhase[item.phase]) {
                    groupedByPhase[item.phase] = {};
                  }
                  if (!groupedByPhase[item.phase][item.category]) {
                    groupedByPhase[item.phase][item.category] = [];
                  }
                  groupedByPhase[item.phase][item.category].push(item);
                });

                return Object.entries(groupedByPhase).map(([phase, categories]) => (
                  Object.keys(categories).length > 0 && (
                    <div key={phase} className="space-y-1">
                      {/* Phase Header */}
                      <h3 className={`text-md font-semibold ${getPhaseTextColor(phase)} border-b ${getPhaseBorderColor(phase)} pb-0.5 mb-1`}>
                        {phase}
                      </h3>
                      
                      {/* Category Sections */}
                      {Object.entries(categories).map(([category, items]) => {
                        const categoryTotal = items.reduce((sum, item) => sum + item.total, 0);
                        return items.length > 0 && (
                          <div key={`${phase}-${category}`} className="space-y-0.5">
                            {/* Category Header */}
                            <h4 className={`text-sm font-medium ${getPhaseTextColor(phase)} ${getPhaseBackgroundColor(phase)} px-2 py-0.5 rounded flex justify-between`}>
                              <span>{category}</span>
                              <span className="font-semibold">${categoryTotal.toLocaleString()}</span>
                            </h4>
                            
                            {/* Item Rows for this Category */}
                            {items.map((item) => (
                              <div key={item.id} className={`grid gap-4 items-center py-0.5 border-b border-gray-100 hover:bg-gray-50 ml-3 ${
                                pricingType === 'value' ? 'grid-cols-8' : 'grid-cols-12'
                              }`}>
                                <div className="col-span-3 text-xs">{item.item}</div>
                                {pricingType === 'line-item' && (
                                  <>
                                    <div className="col-span-1 text-center text-xs">
                                      {item.hours ? item.hours.toFixed(0).toLocaleString() : (item.quantity ? item.quantity.toLocaleString() : '-')}
                                    </div>
                                    <div className="col-span-1 text-center text-xs">
                                      {item.rate ? `$${item.rate.toLocaleString()}` : '-'}
                                    </div>
                                  </>
                                )}
                                <div className="col-span-1 text-right text-xs font-semibold">${item.total.toLocaleString()}</div>
                                <div className={pricingType === 'value' ? 'col-span-4' : 'col-span-6'}>
                                  <Input
                                    placeholder="Add description..."
                                    value={descriptions[item.id] || ''}
                                    onChange={(e) => {
                                      const value = e.target.value.slice(0, 100);
                                      updateDescription(item.id, value);
                                    }}
                                    maxLength={100}
                                    className="h-8 text-xs leading-none w-full px-2 placeholder:text-xs"
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  )
                ));
              })()}

              {/* Production Costs Subtotal */}
              <div className="flex justify-end pt-2 p-2 rounded" style={{ backgroundColor: '#f8f9fc' }}>
                <div className="flex gap-4 items-center font-bold" style={{ color: '#363838' }}>
                  <span className="text-sm whitespace-nowrap">Production Costs Total:</span>
                  <span className="text-sm">{`$${productionCostsTotal.toLocaleString()} ${project.currency}`}</span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No production costs configured</p>
          )}
        </CardContent>
      </Card>


      {/* Grand Total */}
      <Card>
        <CardContent className="pt-3">
          <div className="p-3 rounded" style={{ backgroundColor: '#f8f9fc', color: '#363838' }}>
            <div className="flex justify-between items-center">
              <span className="font-semibold">Quote Total:</span>
              <span className="font-bold">{`$${grandTotal.toLocaleString()} ${project.currency}`}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Invoicing Schedule */}
      <Card>
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            <span>Invoicing Schedule</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => {
                const redistributedItems = redistributeInvoiceAmounts(invoiceItems);
                setInvoiceItems(redistributedItems);
              }} className="no-print text-xs">
                Balance Invoices
              </Button>
              <Button variant="outline" size="sm" onClick={addInvoiceItem} className="no-print">
                + Add Invoice Line
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {invoiceItems.length > 0 ? (
            <div className="space-y-4">
              {/* Header */}
              <div className="grid grid-cols-12 gap-4 pb-2 border-b font-semibold text-sm text-gray-700">
                <div className="col-span-2">Invoice #</div>
                <div className="col-span-1">%</div>
                <div className="col-span-2">Billing Total</div>
                <div className="col-span-2">Payment Due</div>
                <div className="col-span-4">Payment Terms</div>
                <div className="col-span-1 no-print">Actions</div>
              </div>

              {/* Invoice Items */}
              {invoiceItems.map((item) => (
                <div key={item.id} className="grid grid-cols-12 gap-4 items-center py-2 border-b border-gray-100">
                  <div className="col-span-2">
                    <Input
                      placeholder="INV-001"
                      value={item.invoiceNumber}
                      onChange={(e) => updateInvoiceItem(item.id, 'invoiceNumber', e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="col-span-1">
                    <div className="relative">
                      <Input
                        type="number"
                        placeholder="0"
                        value={item.percentage || ''}
                        onChange={(e) => updateInvoiceItem(item.id, 'percentage', parseFloat(e.target.value) || 0)}
                        className="h-8 text-sm pr-6"
                        min="0"
                        max="100"
                        step="0.01"
                      />
                      <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">%</span>
                    </div>
                  </div>
                  <div className="col-span-2">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">$</span>
                      <Input
                        type="text"
                        placeholder="0"
                        value={item.amount ? item.amount.toLocaleString() : ''}
                        onChange={(e) => {
                          const value = e.target.value.replace(/,/g, '');
                          updateInvoiceItem(item.id, 'amount', parseFloat(value) || 0);
                        }}
                        className="h-8 text-sm pl-6"
                      />
                    </div>
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="date"
                      value={item.paymentDue}
                      onChange={(e) => updateInvoiceItem(item.id, 'paymentDue', e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className={item.paymentTerms === 'Custom' ? "col-span-2" : "col-span-4"}>
                    <Select 
                      value={item.paymentTerms} 
                      onValueChange={(value) => updateInvoiceItem(item.id, 'paymentTerms', value)}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select terms" />
                      </SelectTrigger>
                      <SelectContent>
                        {PAYMENT_TERMS.map((term) => (
                          <SelectItem key={term} value={term}>{term}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {item.paymentTerms === 'Custom' && (
                    <div className="col-span-2">
                      <Input
                        placeholder="Custom terms..."
                        value={item.customTerms || ''}
                        onChange={(e) => updateInvoiceItem(item.id, 'customTerms', e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                  )}
                  <div className="col-span-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeInvoiceItem(item.id)}
                      className="h-8 w-8 p-0 text-red-600 hover:bg-red-50 no-print"
                    >
                      ×
                    </Button>
                  </div>
                </div>
              ))}

              {/* Invoice Totals and Balance Check */}
              <div className="border-t pt-4 mt-4">
                {(() => {
                  const totalInvoiced = invoiceItems.reduce((sum, item) => sum + item.amount, 0);
                  const isBalanced = totalInvoiced === grandTotal;
                  
                  return (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold">Total Invoiced:</span>
                        <span className={`font-bold ${isBalanced ? 'text-green-600' : 'text-red-600'}`}>
                          ${Math.round(totalInvoiced).toLocaleString('en-US')} {project.currency}
                        </span>
                      </div>
                      <div className="flex justify-between items-center p-2 rounded" style={{ backgroundColor: '#f8f9fc', color: '#363838' }}>
                        <span className="font-semibold">Quote Total:</span>
                        <span className="font-bold">${Math.round(grandTotal).toLocaleString('en-US')} {project.currency}</span>
                      </div>
                      {!isBalanced && (
                        <div className="rounded p-3 mt-2" style={{ backgroundColor: '#fff7ed', color: '#92400e' }}>
                          <div className="flex items-center gap-2">
                            <span className="text-yellow-600">⚠️</span>
                            <span className="text-yellow-800 text-sm font-medium">
                              Invoice amounts don't match quote total 
                              (Difference: ${Math.abs(totalInvoiced - grandTotal).toLocaleString()})
                            </span>
                          </div>
                          <p className="text-yellow-700 text-xs mt-1">
                            Click "Balance Invoices" to automatically distribute the quote total across all invoices.
                          </p>
                        </div>
                      )}
                      {isBalanced && invoiceItems.length > 0 && (
                        <div className="bg-green-50 border border-green-200 rounded p-2 mt-2">
                          <div className="flex items-center gap-2">
                            <span className="text-green-600">✅</span>
                            <span className="text-green-800 text-sm font-medium">
                              Invoice schedule matches quote total
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No invoice schedule configured</p>
              <p className="text-sm">Click "Add Invoice Line" to create your invoicing schedule</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Information Box */}
      <Card className="bg-black text-white border-black">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column - Project Info */}
            <div className="space-y-3">
              <h3 className="text-lg font-bold text-white mb-4">Project Information</h3>
              <div className="space-y-2 text-sm">
                <div><strong>Client:</strong> {project.clientName}</div>
                <div><strong>Brand:</strong> {project.brand}</div>
                <div><strong>Project:</strong> {project.projectName}</div>
                <div><strong>Start Date:</strong> {project.startDate ? new Date(project.startDate).toLocaleDateString() : '—'}</div>
                <div><strong>End Date:</strong> {project.endDate ? new Date(project.endDate).toLocaleDateString() : '—'}</div>
                <div><strong>Currency:</strong> {project.currency}</div>
              </div>
            </div>

            {/* Right Column - Financial Summary */}
            <div className="space-y-3">
              <h3 className="text-lg font-bold text-white mb-4">Financial Summary</h3>
              
              {/* Total Fees by Department */}
              <div className="mb-4">
                <h4 className="text-md font-semibold text-white mb-2">Total Fees by Department</h4>
                <div className="space-y-1 text-sm">
                  {(() => {
                    const departmentTotals: { [dept: string]: number } = {};
                    
                    // Debug: Log the structure to understand what we're working with
                    console.log('🔍 Project Fee Items by Phase and Department:', projectFeeItemsByPhaseAndDepartment);
                    
                    Object.values(projectFeeItemsByPhaseAndDepartment).forEach(phaseData => {
                      Object.entries(phaseData).forEach(([dept, roles]) => {
                        if (roles.length > 0) {
                          const deptTotal = Math.round(roles.reduce((sum, role) => sum + role.total, 0));
                          departmentTotals[dept] = (departmentTotals[dept] || 0) + deptTotal;
                          console.log(`📊 Department: ${dept}, Phase Total: $${deptTotal}, Running Total: $${departmentTotals[dept]}`);
                        }
                      });
                    });

                    console.log('📋 Final Department Totals:', departmentTotals);

                    const departmentEntries = Object.entries(departmentTotals)
                      .filter(([_, total]) => total > 0)
                      .sort(([a], [b]) => a.localeCompare(b));

                    if (departmentEntries.length === 0) {
                      return (
                        <div className="text-gray-300 text-sm">No project fees configured</div>
                      );
                    }

                    return departmentEntries.map(([dept, total]) => (
                      <div key={dept} className="flex justify-between">
                        <span>{dept}:</span>
                        <span>${total.toLocaleString()}</span>
                      </div>
                    ));
                  })()}
                </div>
              </div>

              {/* Total Production Costs */}
              <div className="mb-4">
                <div className="flex justify-between text-sm">
                  <span><strong>Total Production Costs:</strong></span>
                  <span><strong>${productionCostsTotal.toLocaleString()}</strong></span>
                </div>
              </div>

              {/* Invoicing Schedule Summary */}
              <div>
                <h4 className="text-md font-semibold text-white mb-2">Invoicing Schedule</h4>
                <div className="space-y-1 text-sm">
                  {invoiceItems.length > 0 ? (
                    <>
                      {invoiceItems.map((item, index) => (
                        <div key={item.id} className="flex justify-between">
                          <span>Invoice {index + 1}:</span>
                          <span>${item.amount.toLocaleString()}</span>
                        </div>
                      ))}
                      <div className="flex justify-between font-bold border-t border-gray-600 pt-1 mt-2">
                        <span>Total Invoiced:</span>
                        <span>${invoiceItems.reduce((sum, item) => sum + item.amount, 0).toLocaleString('en-US')} {project.currency}</span>
                      </div>
                    </>
                  ) : (
                    <div className="text-gray-300 text-sm">No invoicing schedule configured</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
