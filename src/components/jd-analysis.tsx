
"use client";

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { ExtractJDCriteriaOutput, Requirement } from "@/lib/types";
import { cn } from '@/lib/utils';
import { ClipboardCheck, Briefcase, GraduationCap, Star, BrainCircuit, ListChecks, ChevronsUpDown, PlusCircle, Trash2 } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";

interface JdAnalysisProps {
  analysis: ExtractJDCriteriaOutput;
  originalAnalysis: ExtractJDCriteriaOutput | null;
  onSaveChanges: (editedJd: ExtractJDCriteriaOutput) => void;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

const RequirementList = ({ title, requirements, icon, categoryKey, originalRequirements, onRequirementChange, onDeleteRequirement }: { 
  title: string; 
  requirements: Requirement[] | undefined;
  icon: React.ReactNode;
  categoryKey: keyof ExtractJDCriteriaOutput;
  originalRequirements: Requirement[] | undefined;
  onRequirementChange: (categoryKey: keyof ExtractJDCriteriaOutput, index: number, newPriority: Requirement['priority']) => void;
  onDeleteRequirement?: (categoryKey: keyof ExtractJDCriteriaOutput, index: number) => void;
}) => {
  if (!requirements || requirements.length === 0) return null;

  return (
    <div className="break-inside-avoid">
      <h3 className="text-lg font-semibold mb-3 flex items-center text-primary">
        {icon}
        <span className="ml-2">{title}</span>
      </h3>
      <ul className="space-y-2">
        {requirements.map((req, index) => {
          const originalReq = originalRequirements?.find(r => r.description === req.description);
          const hasChanged = originalReq ? originalReq.priority !== req.priority : false;

          return (
            <li 
                key={`${categoryKey}-${index}`}
                className={cn(
                    "flex items-center justify-between gap-4 p-3 rounded-lg border bg-secondary/30 transition-colors",
                    !onDeleteRequirement && "cursor-pointer hover:bg-secondary/60",
                    hasChanged && "bg-accent/20 border-accent/40"
                )}
                onClick={() => {
                    if (onDeleteRequirement) return;
                    const newPriority = req.priority === 'MUST-HAVE' ? 'NICE-TO-HAVE' : 'MUST-HAVE';
                    onRequirementChange(categoryKey, index, newPriority);
                }}
            >
              <p className="flex-1 text-sm text-foreground">{req.description}</p>
              <div className="flex items-center space-x-2 shrink-0">
                <div 
                    className="flex items-center space-x-2"
                    onClick={(e) => {
                        e.stopPropagation(); 
                    }}
                >
                    <Label htmlFor={`p-switch-${categoryKey}-${index}`} className="text-xs text-muted-foreground cursor-pointer">Nice to Have</Label>
                    <Switch
                        id={`p-switch-${categoryKey}-${index}`}
                        checked={req.priority === 'MUST-HAVE'}
                        onCheckedChange={(checked) => {
                            onRequirementChange(categoryKey, index, checked ? 'MUST-HAVE' : 'NICE-TO-HAVE');
                        }}
                    />
                    <Label htmlFor={`p-switch-${categoryKey}-${index}`} className="text-xs font-semibold text-accent cursor-pointer">Must Have</Label>
                </div>
                {onDeleteRequirement && (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 -mr-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDeleteRequirement(categoryKey, index);
                                    }}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Delete requirement</p></TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default function JdAnalysis({ analysis, originalAnalysis, onSaveChanges, isOpen, onOpenChange }: JdAnalysisProps) {
  const [editedJd, setEditedJd] = useState(analysis);
  const [isAddPopoverOpen, setIsAddPopoverOpen] = useState(false);
  const [newRequirement, setNewRequirement] = useState<{
      description: string;
      priority: Requirement['priority'];
  }>({
    description: '',
    priority: 'NICE-TO-HAVE',
  });

  const isDirty = useMemo(() => {
    return JSON.stringify(analysis) !== JSON.stringify(editedJd);
  }, [analysis, editedJd]);

  useMemo(() => {
    setEditedJd(analysis);
  }, [analysis]);
  
  const handleAddRequirement = () => {
    if (!newRequirement.description.trim()) {
        return;
    }

    setEditedJd(prevJd => {
        const newJd = JSON.parse(JSON.stringify(prevJd));
        if (!newJd.additionalRequirements) {
            newJd.additionalRequirements = [];
        }
        newJd.additionalRequirements.push({
            description: newRequirement.description,
            priority: newRequirement.priority,
        });
        return newJd;
    });

    setNewRequirement({
        description: '',
        priority: 'NICE-TO-HAVE',
    });
    setIsAddPopoverOpen(false);
  };

  const handleDeleteRequirement = (categoryKey: keyof ExtractJDCriteriaOutput, index: number) => {
    setEditedJd(prevJd => {
        const newJd = { ...prevJd };
        if (categoryKey === 'additionalRequirements' && Array.isArray(newJd.additionalRequirements)) {
            const updatedReqs = [...newJd.additionalRequirements];
            updatedReqs.splice(index, 1);
            return { ...newJd, additionalRequirements: updatedReqs };
        }
        return newJd;
    });
  };

  const handleRequirementChange = (
    categoryKey: keyof ExtractJDCriteriaOutput,
    index: number,
    newPriority: Requirement['priority']
  ) => {
    setEditedJd(prevJd => {
        const newAnalyzedJd = { ...prevJd };
        const reqs = newAnalyzedJd[categoryKey];
        if (Array.isArray(reqs)) {
            const category = [...reqs];
            category[index] = { ...category[index], priority: newPriority };
            return { ...newAnalyzedJd, [categoryKey]: category };
        }
        return newAnalyzedJd;
    });
  };

  const handleSaveClick = () => {
    onSaveChanges(editedJd);
  };
  
  const hasMustHaveCert = editedJd.certifications?.some(c => c.priority === 'MUST-HAVE');

  const allSections = {
      education: { key: 'education', title: 'Education', icon: <GraduationCap className="h-5 w-5" /> },
      experience: { key: 'experience', title: 'Experience', icon: <Briefcase className="h-5 w-5" /> },
      certifications: { key: 'certifications', title: 'Certifications', icon: <Star className="h-5 w-5" /> },
      technicalSkills: { key: 'technicalSkills', title: 'Technical Skills', icon: <BrainCircuit className="h-5 w-5" /> },
      softSkills: { key: 'softSkills', title: 'Soft Skills', icon: <ClipboardCheck className="h-5 w-5" /> },
      responsibilities: { key: 'responsibilities', title: 'Responsibilities', icon: <ListChecks className="h-5 w-5" /> },
      additionalRequirements: { key: 'additionalRequirements', title: 'Additional Requirements', icon: <PlusCircle className="h-5 w-5" /> },
  };

  const categorySections = [
      allSections.education,
      allSections.experience
  ];

  if (hasMustHaveCert) {
      categorySections.push(allSections.certifications);
  }

  categorySections.push(allSections.technicalSkills, allSections.softSkills);

  if (!hasMustHaveCert) {
      categorySections.push(allSections.certifications);
  }
  
  categorySections.push(allSections.responsibilities, allSections.additionalRequirements);

  return (
    <Collapsible
        open={isOpen}
        onOpenChange={onOpenChange}
        asChild
    >
        <Card>
            <CardHeader>
                <div className="flex items-start justify-between gap-4">
                    <CollapsibleTrigger asChild>
                        <div className="flex-1 cursor-pointer">
                            <CardTitle className="flex items-center gap-2 flex-wrap">
                                <Briefcase className="h-5 w-5 text-primary"/>
                                <span className="mr-2">{analysis.jobTitle || 'Job Description Breakdown'}</span>
                                {analysis.positionNumber && <Badge variant="outline">Req: {analysis.positionNumber}</Badge>}
                                {analysis.code && <Badge variant="outline">Code: {analysis.code}</Badge>}
                                {analysis.grade && <Badge variant="outline">Grade: {analysis.grade}</Badge>}
                                {analysis.department && <Badge variant="outline">Dept: {analysis.department}</Badge>}
                            </CardTitle>
                            <CardDescription>The JD has been deconstructed. Expand to see details and adjust requirement priorities.</CardDescription>
                        </div>
                    </CollapsibleTrigger>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <CollapsibleTrigger asChild>
                              <Button variant="ghost" size="icon" className="flex-shrink-0 w-8 h-8 -mt-1 -mr-2">
                                  <ChevronsUpDown className="h-4 w-4" />
                                  <span className="sr-only">Toggle JD Analysis</span>
                              </Button>
                          </CollapsibleTrigger>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Show/Hide Details & Edit Priorities</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                </div>
            </CardHeader>
            <CollapsibleContent>
                <CardContent>
                    <div className="md:columns-2 gap-8 space-y-6">
                       {categorySections.map(section => (
                          <RequirementList
                            key={section.key}
                            title={section.title}
                            requirements={editedJd[section.key as keyof ExtractJDCriteriaOutput] as Requirement[] | undefined}
                            originalRequirements={originalAnalysis?.[section.key as keyof ExtractJDCriteriaOutput] as Requirement[] | undefined}
                            icon={section.icon}
                            categoryKey={section.key as keyof ExtractJDCriteriaOutput}
                            onRequirementChange={handleRequirementChange}
                            onDeleteRequirement={section.key === 'additionalRequirements' ? handleDeleteRequirement : undefined}
                          />
                        ))}
                    </div>
                </CardContent>
                <CardFooter className="flex justify-between items-center p-4 border-t">
                    <Popover open={isAddPopoverOpen} onOpenChange={setIsAddPopoverOpen}>
                        <PopoverTrigger asChild>
                            <Button variant="outline">
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Add Requirement
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80">
                            <div className="grid gap-4">
                                <div className="space-y-2">
                                    <h4 className="font-medium leading-none">Add New Requirement</h4>
                                    <p className="text-sm text-muted-foreground">
                                        Add a custom item to the &quot;Additional Requirements&quot; section.
                                    </p>
                                </div>
                                <div className="grid gap-3">
                                    <div className="grid grid-cols-3 items-start gap-4">
                                        <Label htmlFor="description">Description</Label>
                                        <Textarea
                                            id="description"
                                            value={newRequirement.description}
                                            onChange={(e) => setNewRequirement(prev => ({ ...prev, description: e.target.value }))}
                                            className="col-span-2 h-24"
                                            placeholder="e.g., Willingness to travel"
                                        />
                                    </div>
                                    <div className="grid grid-cols-3 items-center gap-4">
                                        <Label>Priority</Label>
                                        <div className="col-span-2 flex items-center space-x-2">
                                            <Label htmlFor="p-switch-new" className="text-xs text-muted-foreground cursor-pointer">Nice to Have</Label>
                                            <Switch
                                                id="p-switch-new"
                                                checked={newRequirement.priority === 'MUST-HAVE'}
                                                onCheckedChange={(checked) => {
                                                    setNewRequirement(prev => ({ ...prev, priority: checked ? 'MUST-HAVE' : 'NICE-TO-HAVE' }));
                                                }}
                                            />
                                            <Label htmlFor="p-switch-new" className="text-xs font-semibold text-accent cursor-pointer">Must Have</Label>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="sm" onClick={() => setIsAddPopoverOpen(false)}>Cancel</Button>
                                    <Button size="sm" onClick={handleAddRequirement}>Add</Button>
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>
                    
                    <Button onClick={handleSaveClick} disabled={!isDirty}>
                        Save Changes
                    </Button>
                </CardFooter>
            </CollapsibleContent>
        </Card>
    </Collapsible>
  );
}
