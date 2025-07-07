
"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { ExtractJDCriteriaOutput, Requirement } from "@/lib/types";
import { cn } from '@/lib/utils';
import { ClipboardCheck, Briefcase, GraduationCap, Star, BrainCircuit, ListChecks, ChevronsUpDown, Loader2 } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface JdAnalysisProps {
  analysis: ExtractJDCriteriaOutput;
  originalAnalysis: ExtractJDCriteriaOutput | null;
  onRequirementPriorityChange: (
    requirement: Requirement,
    categoryKey: keyof ExtractJDCriteriaOutput,
    newPriority: Requirement['priority']
  ) => void;
  isDirty: boolean;
  onSaveChanges: () => Promise<void>;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

const RequirementList = ({ title, requirements, icon, categoryKey, originalRequirements, onRequirementPriorityChange }: { 
  title: string; 
  requirements: Requirement[]; 
  icon: React.ReactNode;
  categoryKey: keyof ExtractJDCriteriaOutput;
  originalRequirements: Requirement[] | undefined;
  onRequirementPriorityChange: JdAnalysisProps['onRequirementPriorityChange'];
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
                key={index} 
                className={cn(
                    "flex items-center justify-between gap-4 p-3 rounded-lg border bg-secondary/30 cursor-pointer transition-colors hover:bg-secondary/60",
                    hasChanged && "bg-accent/20 border-accent/40"
                )}
                onClick={() => {
                    const newPriority = req.priority === 'MUST-HAVE' ? 'NICE-TO-HAVE' : 'MUST-HAVE';
                    onRequirementPriorityChange(req, categoryKey, newPriority);
                }}
            >
              <p className="flex-1 text-sm text-foreground">{req.description}</p>
              <div 
                className="flex items-center space-x-2 shrink-0"
                onClick={(e) => {
                    // Stop the li's onClick from firing when we interact with the switch directly
                    e.stopPropagation(); 
                }}
              >
                  <Label htmlFor={`p-switch-${categoryKey}-${index}`} className="text-xs text-muted-foreground cursor-pointer">Nice to Have</Label>
                  <Switch
                      id={`p-switch-${categoryKey}-${index}`}
                      checked={req.priority === 'MUST-HAVE'}
                      onCheckedChange={(checked) => {
                          onRequirementPriorityChange(req, categoryKey, checked ? 'MUST-HAVE' : 'NICE-TO-HAVE');
                      }}
                  />
                  <Label htmlFor={`p-switch-${categoryKey}-${index}`} className="text-xs font-semibold text-accent cursor-pointer">Must Have</Label>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default function JdAnalysis({ analysis, originalAnalysis, onRequirementPriorityChange, isDirty, onSaveChanges, isOpen, onOpenChange }: JdAnalysisProps) {
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveClick = async () => {
      setIsSaving(true);
      await onSaveChanges();
      setIsSaving(false);
      onOpenChange(false);
  };

  const categorySections = [
    { key: 'technicalSkills', title: 'Technical Skills', icon: <BrainCircuit className="h-5 w-5" /> },
    { key: 'softSkills', title: 'Soft Skills', icon: <ClipboardCheck className="h-5 w-5" /> },
    { key: 'experience', title: 'Experience', icon: <Briefcase className="h-5 w-5" /> },
    { key: 'education', title: 'Education', icon: <GraduationCap className="h-5 w-5" /> },
    { key: 'certifications', title: 'Certifications', icon: <Star className="h-5 w-5" /> },
    { key: 'responsibilities', title: 'Responsibilities', icon: <ListChecks className="h-5 w-5" /> },
  ];

  return (
    <Collapsible
        open={isOpen}
        onOpenChange={onOpenChange}
        asChild
    >
        <Card>
            <CardHeader>
                <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                        <CardTitle>Job Description Breakdown</CardTitle>
                        <CardDescription>The JD has been deconstructed. Expand to see details and adjust requirement priorities.</CardDescription>
                    </div>
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
                            requirements={analysis[section.key as keyof ExtractJDCriteriaOutput]}
                            originalRequirements={originalAnalysis?.[section.key as keyof ExtractJDCriteriaOutput]}
                            icon={section.icon}
                            categoryKey={section.key as keyof ExtractJDCriteriaOutput}
                            onRequirementPriorityChange={onRequirementPriorityChange}
                          />
                        ))}
                    </div>
                </CardContent>
                {isDirty && (
                    <CardFooter className="flex justify-end p-4 border-t">
                        <Button onClick={handleSaveClick} disabled={isSaving}>
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Changes & Re-assess
                        </Button>
                    </CardFooter>
                )}
            </CollapsibleContent>
        </Card>
    </Collapsible>
  );
}
