"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ExtractJDCriteriaOutput, Requirement } from "@/lib/types";
import { ClipboardCheck, Briefcase, GraduationCap, Star, BrainCircuit, ListChecks, ChevronsUpDown } from "lucide-react";

interface JdAnalysisProps {
  analysis: ExtractJDCriteriaOutput;
  onRequirementChange: (
    requirement: Requirement,
    fromCategoryKey: keyof ExtractJDCriteriaOutput,
    toCategoryKey: keyof ExtractJDCriteriaOutput
  ) => void;
}

const categoryDisplayNames: Record<string, string> = {
    technicalSkills: 'Technical Skills',
    softSkills: 'Soft Skills',
    experience: 'Experience',
    education: 'Education',
    certifications: 'Certifications',
    responsibilities: 'Responsibilities'
};
const categoryKeys = Object.keys(categoryDisplayNames) as (keyof ExtractJDCriteriaOutput)[];


const RequirementList = ({ title, requirements, icon, categoryKey, onRequirementChange }: { 
  title: string; 
  requirements: Requirement[]; 
  icon: React.ReactNode;
  categoryKey: keyof ExtractJDCriteriaOutput;
  onRequirementChange: JdAnalysisProps['onRequirementChange'];
}) => {
  if (!requirements || requirements.length === 0) return null;
  return (
    <div className="break-inside-avoid">
      <h3 className="text-lg font-semibold mb-3 flex items-center text-primary">
        {icon}
        <span className="ml-2">{title}</span>
      </h3>
      <ul className="space-y-2">
        {requirements.map((req, index) => (
          <li key={index} className="flex items-start justify-between gap-2 p-3 rounded-lg border bg-secondary/30">
            <p className="flex-1 text-sm text-foreground">{req.description}</p>
            <div className="flex flex-col items-end gap-2 shrink-0 w-[150px]">
                <Badge variant={req.priority === 'MUST-HAVE' ? 'destructive' : 'secondary'} className="whitespace-nowrap self-end">
                  {req.priority.replace('-', ' ')}
                </Badge>
                <Select
                    value={categoryKey}
                    onValueChange={(newCategory) => {
                        onRequirementChange(req, categoryKey, newCategory as keyof ExtractJDCriteriaOutput);
                    }}
                >
                    <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Change category" />
                    </SelectTrigger>
                    <SelectContent>
                        {categoryKeys.map((key) => (
                            <SelectItem key={key} value={key}>
                                {categoryDisplayNames[key]}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default function JdAnalysis({ analysis, onRequirementChange }: JdAnalysisProps) {
  const [isOpen, setIsOpen] = useState(true);

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
        onOpenChange={setIsOpen}
        asChild
    >
        <Card>
            <CardHeader>
                <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                        <CardTitle>Job Description Breakdown</CardTitle>
                        <CardDescription>The JD has been deconstructed. You can re-categorize requirements below.</CardDescription>
                    </div>
                    <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="icon" className="flex-shrink-0 w-8 h-8 -mt-1 -mr-2">
                            <ChevronsUpDown className="h-4 w-4" />
                            <span className="sr-only">Toggle JD Analysis</span>
                        </Button>
                    </CollapsibleTrigger>
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
                            icon={section.icon}
                            categoryKey={section.key as keyof ExtractJDCriteriaOutput}
                            onRequirementChange={onRequirementChange}
                          />
                        ))}
                    </div>
                </CardContent>
            </CollapsibleContent>
        </Card>
    </Collapsible>
  );
}
