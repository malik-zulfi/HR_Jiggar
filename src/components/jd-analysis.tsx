
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
import { ClipboardCheck, Briefcase, GraduationCap, Star, BrainCircuit, ListChecks, ChevronsUpDown } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface JdAnalysisProps {
  analysis: ExtractJDCriteriaOutput;
  originalAnalysis: ExtractJDCriteriaOutput | null;
  onSaveChanges: (editedJd: ExtractJDCriteriaOutput) => void;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

const RequirementList = ({ title, requirements, icon, categoryKey, originalRequirements, onRequirementChange }: { 
  title: string; 
  requirements: Requirement[]; 
  icon: React.ReactNode;
  categoryKey: keyof ExtractJDCriteriaOutput;
  originalRequirements: Requirement[] | undefined;
  onRequirementChange: (categoryKey: keyof ExtractJDCriteriaOutput, index: number, newPriority: Requirement['priority']) => void;
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
                    onRequirementChange(categoryKey, index, newPriority);
                }}
            >
              <p className="flex-1 text-sm text-foreground">{req.description}</p>
              <div 
                className="flex items-center space-x-2 shrink-0"
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
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default function JdAnalysis({ analysis, originalAnalysis, onSaveChanges, isOpen, onOpenChange }: JdAnalysisProps) {
  const [editedJd, setEditedJd] = useState(analysis);

  const isDirty = useMemo(() => {
    return JSON.stringify(analysis) !== JSON.stringify(editedJd);
  }, [analysis, editedJd]);

  useMemo(() => {
    setEditedJd(analysis);
  }, [analysis]);

  const handleRequirementChange = (
    categoryKey: keyof ExtractJDCriteriaOutput,
    index: number,
    newPriority: Requirement['priority']
  ) => {
    setEditedJd(prevJd => {
        const newAnalyzedJd = { ...prevJd };
        if (Array.isArray(newAnalyzedJd[categoryKey])) {
            const category = [...(newAnalyzedJd[categoryKey] as Requirement[])];
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
  
  categorySections.push(allSections.responsibilities);

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
                        <CardTitle className="flex items-center gap-2 text-xl font-bold">
                            <Briefcase className="h-5 w-5 text-primary"/>
                            <span>{analysis.jobTitle || 'Job Description Breakdown'}</span>
                            {analysis.positionNumber && <Badge variant="outline">#{analysis.positionNumber}</Badge>}
                        </CardTitle>
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
                            requirements={editedJd[section.key as keyof ExtractJDCriteriaOutput] as Requirement[]}
                            originalRequirements={originalAnalysis?.[section.key as keyof ExtractJDCriteriaOutput] as Requirement[]}
                            icon={section.icon}
                            categoryKey={section.key as keyof ExtractJDCriteriaOutput}
                            onRequirementChange={handleRequirementChange}
                          />
                        ))}
                    </div>
                </CardContent>
                {isDirty && (
                    <CardFooter className="flex justify-end p-4 border-t">
                        <Button onClick={handleSaveClick}>
                            Save Changes
                        </Button>
                    </CardFooter>
                )}
            </CollapsibleContent>
        </Card>
    </Collapsible>
  );
}
