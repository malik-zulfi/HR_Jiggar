
"use client";

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { ExtractJDCriteriaOutput, Requirement } from "@/lib/types";
import { cn } from '@/lib/utils';
import { ClipboardCheck, Briefcase, GraduationCap, Star, BrainCircuit, ListChecks, ChevronsUpDown, PlusCircle, Trash2, RotateCcw } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Input } from './ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { useToast } from '@/hooks/use-toast';


interface JdAnalysisProps {
  analysis: ExtractJDCriteriaOutput;
  originalAnalysis: ExtractJDCriteriaOutput | null;
  onSaveChanges: (editedJd: ExtractJDCriteriaOutput) => void;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

type CategoryKey = Exclude<keyof ExtractJDCriteriaOutput, 'jobTitle' | 'positionNumber' | 'code' | 'grade' | 'department' | 'formattedCriteria'>;

const RequirementList = ({ title, requirements, icon, categoryKey, onRequirementChange, onDeleteRequirement, getOriginalRequirement }: { 
  title: string; 
  requirements: Requirement[] | undefined;
  icon: React.ReactNode;
  categoryKey: CategoryKey;
  onRequirementChange: (categoryKey: CategoryKey, index: number, field: 'priority' | 'score', value: any) => void;
  onDeleteRequirement?: (categoryKey: CategoryKey, index: number) => void;
  getOriginalRequirement: (categoryKey: CategoryKey, index: number) => Requirement | undefined;
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
          const originalReq = getOriginalRequirement(categoryKey, index);
          const hasPriorityChanged = originalReq && req.priority !== originalReq.priority;
          const hasScoreChanged = originalReq && req.score !== originalReq.score;

          return (
            <li 
                key={`${categoryKey}-${index}`}
                className={cn(
                    "p-3 rounded-lg border bg-secondary/30 transition-colors",
                    (hasPriorityChanged || hasScoreChanged) && "bg-accent/20 border-accent/40"
                )}
            >
              <p className="flex-1 text-sm text-foreground mb-2">{req.description}</p>
              <div className="flex items-center justify-between gap-4">
                 <div 
                    className="flex items-center space-x-2"
                 >
                    <Label htmlFor={`p-switch-${categoryKey}-${index}`} className={cn("text-xs", req.priority === 'NICE-TO-HAVE' ? 'text-muted-foreground' : 'font-semibold text-accent')}>
                      {req.priority === 'NICE-TO-HAVE' ? 'Nice to Have' : 'Must Have'}
                    </Label>
                    <Switch
                        id={`p-switch-${categoryKey}-${index}`}
                        checked={req.priority === 'MUST-HAVE'}
                        onCheckedChange={(checked) => {
                            onRequirementChange(categoryKey, index, 'priority', checked ? 'MUST-HAVE' : 'NICE-TO-HAVE');
                        }}
                        className={cn(hasPriorityChanged && "ring-2 ring-accent ring-offset-2 ring-offset-background")}
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={req.score}
                      onChange={(e) => onRequirementChange(categoryKey, index, 'score', Number(e.target.value))}
                      className={cn("h-7 w-16 text-center", hasScoreChanged && "ring-2 ring-accent")}
                    />
                    <Label className="text-sm font-medium">points</Label>
                </div>
                {onDeleteRequirement && (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
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
  const { toast } = useToast();
  
  const [isAddPopoverOpen, setIsAddPopoverOpen] = useState(false);
  const [newRequirement, setNewRequirement] = useState<{
      description: string;
      priority: Requirement['priority'];
      score: number;
  }>({
    description: '',
    priority: 'NICE-TO-HAVE',
    score: 2,
  });

  const [resetOption, setResetOption] = useState<'both' | 'scores' | 'priorities'>('both');

  const originalJdMap = useMemo(() => {
    if (!originalAnalysis) return new Map<string, Requirement>();
    
    const map = new Map<string, Requirement>();
    Object.keys(originalAnalysis).forEach(catKey => {
      const category = originalAnalysis[catKey as CategoryKey];
      if(Array.isArray(category)) {
        category.forEach((req, index) => {
          map.set(`${catKey}-${index}`, req);
        });
      }
    });
    return map;
  }, [originalAnalysis]);

  const isDirty = useMemo(() => {
    return JSON.stringify(analysis) !== JSON.stringify(editedJd);
  }, [analysis, editedJd]);

  useEffect(() => {
    setEditedJd(analysis);
  }, [analysis, isOpen]);
  
  const getOriginalRequirement = (categoryKey: CategoryKey, index: number) => {
    return originalJdMap.get(`${categoryKey}-${index}`);
  }

  const handleAddRequirement = () => {
    if (!newRequirement.description.trim()) {
        return;
    }

    setEditedJd(prevJd => {
        const newJd = JSON.parse(JSON.stringify(prevJd));
        if (!newJd.additionalRequirements) {
            newJd.additionalRequirements = [];
        }
        const score = newRequirement.priority === 'MUST-HAVE' ? 5 : 2;
        newJd.additionalRequirements.push({
            description: newRequirement.description,
            priority: newRequirement.priority,
            score: newRequirement.score,
            defaultScore: newRequirement.score,
        });
        return newJd;
    });

    setNewRequirement({
        description: '',
        priority: 'NICE-TO-HAVE',
        score: 2,
    });
    setIsAddPopoverOpen(false);
  };

  const handleDeleteRequirement = (categoryKey: CategoryKey, index: number) => {
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
    categoryKey: CategoryKey,
    index: number,
    field: 'priority' | 'score',
    value: any
  ) => {
    setEditedJd(prevJd => {
        const newAnalyzedJd = JSON.parse(JSON.stringify(prevJd));
        const reqs = newAnalyzedJd[categoryKey];
        if (Array.isArray(reqs)) {
            const reqToUpdate = reqs[index];
            const originalReq = getOriginalRequirement(categoryKey, index);
            if (!originalReq) return newAnalyzedJd;
            
            if (field === 'priority') {
                reqToUpdate.priority = value;
                const newDefaultScore = value === 'MUST-HAVE' ? 
                    originalReq.defaultScore 
                    : Math.ceil(originalReq.defaultScore / 2);
                reqToUpdate.score = newDefaultScore;
            } else {
                 reqToUpdate.score = value;
            }
            return newAnalyzedJd;
        }
        return newAnalyzedJd;
    });
  };

  const handleSaveClick = () => {
    onSaveChanges(editedJd);
  };
  
  const handleReset = () => {
    let newJd = JSON.parse(JSON.stringify(editedJd));

    Object.keys(newJd).forEach(catKey => {
      const category = newJd[catKey as CategoryKey];
      if (Array.isArray(category)) {
        category.forEach((req: Requirement, index: number) => {
          const originalReq = getOriginalRequirement(catKey as CategoryKey, index);
          if (originalReq) {
            if (resetOption === 'both' || resetOption === 'scores') {
                req.score = originalReq.score;
            }
            if (resetOption === 'both' || resetOption === 'priorities') {
                req.priority = originalReq.priority;
            }
          }
        });
      }
    });

    setEditedJd(newJd);
    toast({ description: `Changes have been reset for: ${resetOption}.` });
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
  ] as { key: CategoryKey, title: string, icon: React.ReactNode}[];

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
                            <CardDescription>The JD has been deconstructed. Expand to see details and adjust requirement priorities and scores.</CardDescription>
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
                          <p>Show/Hide Details & Edit Priorities/Scores</p>
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
                            requirements={editedJd[section.key as CategoryKey] as Requirement[] | undefined}
                            icon={section.icon}
                            categoryKey={section.key as CategoryKey}
                            onRequirementChange={handleRequirementChange}
                            onDeleteRequirement={section.key === 'additionalRequirements' ? handleDeleteRequirement : undefined}
                            getOriginalRequirement={getOriginalRequirement}
                          />
                        ))}
                    </div>
                </CardContent>
                <CardFooter className="flex justify-between items-center p-4 border-t">
                    <div className="flex gap-2">
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
                                                        const priority = checked ? 'MUST-HAVE' : 'NICE-TO-HAVE';
                                                        const score = priority === 'MUST-HAVE' ? 5 : 2;
                                                        setNewRequirement(prev => ({ ...prev, priority, score }));
                                                    }}
                                                />
                                                <Label htmlFor="p-switch-new" className="text-xs font-semibold text-accent cursor-pointer">Must Have</Label>
                                            </div>
                                        </div>
                                         <div className="grid grid-cols-3 items-center gap-4">
                                            <Label>Score</Label>
                                            <div className="col-span-2">
                                                <Input
                                                    type="number"
                                                    value={newRequirement.score}
                                                    onChange={(e) => setNewRequirement(prev => ({ ...prev, score: Number(e.target.value) }))}
                                                    className="h-8"
                                                />
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

                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="outline" disabled={!isDirty}>
                                    <RotateCcw className="mr-2 h-4 w-4" /> Reset
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Reset Requirement Changes</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Select what you would like to reset to its original, AI-analyzed state. This action cannot be undone.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <RadioGroup defaultValue="both" className="my-4 space-y-2" value={resetOption} onValueChange={(value) => setResetOption(value as any)}>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="scores" id="r-scores" />
                                        <Label htmlFor="r-scores">Reset only scores</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="priorities" id="r-priorities" />
                                        <Label htmlFor="r-priorities">Reset only priorities</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="both" id="r-both" />
                                        <Label htmlFor="r-both">Reset both scores and priorities</Label>
                                    </div>
                                </RadioGroup>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleReset}>Reset</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                    
                    <Button onClick={handleSaveClick} disabled={!isDirty}>
                        Save Changes
                    </Button>
                </CardFooter>
            </CollapsibleContent>
        </Card>
    </Collapsible>
  );
}

    