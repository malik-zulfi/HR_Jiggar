
"use client";

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ExtractJDCriteriaOutput, Requirement } from "@/lib/types";
import { cn } from '@/lib/utils';
import { Briefcase, ChevronsUpDown, Building, MapPin, Calendar, Target, User, Users, Star, BrainCircuit, ListChecks, ClipboardCheck, GraduationCap, Edit3 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { Input } from './ui/input';

type CategoryKey = keyof ExtractJDCriteriaOutput['Requirements'] | 'Responsibilities';

interface JdAnalysisProps {
  analysis: ExtractJDCriteriaOutput;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onRequirementChange: (category: CategoryKey, reqId: string, newPriority: 'MUST_HAVE' | 'NICE_TO_HAVE') => void;
  onScoreChange: (category: CategoryKey, priority: 'MUST_HAVE' | 'NICE_TO_HAVE', reqId: string, newScore: number) => void;
}

const InfoBadge = ({ label, value, icon }: { label: string, value?: string, icon: React.ReactNode }) => {
    if (!value || value === "Not Found") return null;
    return (
        <Badge variant="outline" className="font-normal text-muted-foreground whitespace-nowrap">
            <div className="flex items-center gap-1.5">
                {icon}
                <span className="font-semibold mr-1">{label}:</span>
                {value}
            </div>
        </Badge>
    );
};

const RequirementItem = ({ item, category, onRequirementChange, onScoreChange }: {
    item: Requirement;
    category: CategoryKey;
    onRequirementChange: (category: CategoryKey, reqId: string, newPriority: 'MUST_HAVE' | 'NICE_TO_HAVE') => void;
    onScoreChange: (category: CategoryKey, priority: 'MUST_HAVE' | 'NICE_TO_HAVE', reqId: string, newScore: number) => void;
}) => {
    const isModified = item.priority !== item.originalPriority || item.score !== item.originalScore;
    const [localScore, setLocalScore] = useState(item.score.toString());

    useEffect(() => {
        setLocalScore(item.score.toString());
    }, [item.score]);
    
    const handleScoreBlur = () => {
        const newScore = parseInt(localScore, 10);
        if (!isNaN(newScore) && newScore !== item.score) {
            onScoreChange(category, item.priority, item.id, newScore);
        } else {
            setLocalScore(item.score.toString()); // Revert if invalid
        }
    };
    
    const handleToggle = () => {
        const newPriority = item.priority === 'MUST_HAVE' ? 'NICE_TO_HAVE' : 'MUST_HAVE';
        onRequirementChange(category, item.id, newPriority);
    };

    return (
         <li className={cn(
            "flex items-center gap-4 justify-between p-2 rounded-md hover:bg-background/50",
            isModified && "ring-1 ring-amber-500/50 bg-amber-50/20"
        )}>
            {isModified && (
                 <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="text-amber-500">
                                <Edit3 className="w-4 h-4" />
                            </div>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>This requirement has been modified.</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            )}
            <span className="flex-1">{item.description}</span>
            <div className="flex items-center gap-4">
                 <Input 
                    type="number" 
                    value={localScore}
                    onChange={(e) => setLocalScore(e.target.value)}
                    onBlur={handleScoreBlur}
                    onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                    className="h-8 w-16 text-center"
                 />
                 <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Switch
                                id={`switch-${item.id}`}
                                checked={item.priority === 'MUST_HAVE'}
                                onCheckedChange={handleToggle}
                                aria-label={`Toggle ${item.description} priority`}
                            />
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Toggle to {item.priority === 'MUST_HAVE' ? 'Nice to Have' : 'Must Have'}</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>
        </li>
    );
};


const RequirementSection = ({ title, mustHaves, niceToHaves, icon, category, onRequirementChange, onScoreChange }: {
    title: string;
    mustHaves?: Requirement[];
    niceToHaves?: Requirement[];
    icon: React.ReactNode;
    category: CategoryKey;
    onRequirementChange: (category: CategoryKey, reqId: string, newPriority: 'MUST_HAVE' | 'NICE_TO_HAVE') => void;
    onScoreChange: (category: CategoryKey, priority: 'MUST_HAVE' | 'NICE_TO_HAVE', reqId: string, newScore: number) => void;
}) => {
    const hasMustHaves = mustHaves && mustHaves.length > 0;
    const hasNiceToHaves = niceToHaves && niceToHaves.length > 0;

    if (!hasMustHaves && !hasNiceToHaves) {
        return null;
    }

    return (
        <div className="break-inside-avoid">
            <h3 className="text-base font-semibold mb-3 flex items-center text-primary">
                {icon}
                <span className="ml-2">{title}</span>
            </h3>
            <div className="space-y-3">
                {hasMustHaves && (
                    <div>
                        <h4 className="text-sm font-bold text-accent mb-1">Must Have</h4>
                        <ul className="space-y-2 text-sm">
                            {mustHaves.map((item) => (
                               <RequirementItem key={item.id} item={item} category={category} onRequirementChange={onRequirementChange} onScoreChange={onScoreChange} />
                            ))}
                        </ul>
                    </div>
                )}
                {hasNiceToHaves && (
                     <div>
                        <h4 className="text-sm font-bold text-muted-foreground mb-1">Nice to Have</h4>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                             {niceToHaves.map((item) => (
                                <RequirementItem key={item.id} item={item} category={category} onRequirementChange={onRequirementChange} onScoreChange={onScoreChange} />
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
};

export default function JdAnalysis({ analysis, isOpen, onOpenChange, onRequirementChange, onScoreChange }: JdAnalysisProps) {
  const {
      JobTitle,
      JobCode,
      PositionNumber,
      PayGrade,
      Department,
      Company,
      Location,
      DateApproved,
      PrincipalObjective,
      OrganizationalRelationship,
      Responsibilities,
      Requirements
  } = analysis;

  const experienceMustHaves: Requirement[] = (Requirements.Experience.MUST_HAVE.Years && Requirements.Experience.MUST_HAVE.Years !== 'Not Found' && Requirements.Experience.MUST_HAVE.Fields.length > 0) 
    ? [{
        id: 'exp-must-years',
        description: `${Requirements.Experience.MUST_HAVE.Years} in ${Requirements.Experience.MUST_HAVE.Fields.join(', ')}`,
        priority: 'MUST_HAVE',
        score: 10,
        originalScore: 10,
        originalPriority: 'MUST_HAVE',
      }]
    : [];

  const experienceNiceToHaves = Requirements.Experience.NICE_TO_HAVE || [];


  return (
    <Collapsible open={isOpen} onOpenChange={onOpenChange} asChild>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <CollapsibleTrigger asChild>
              <div className="flex-1 cursor-pointer">
                <CardTitle className="flex items-center gap-2 flex-wrap">
                  <Briefcase className="h-5 w-5 text-primary"/>
                  <span className="mr-2">{JobTitle || 'Job Description Breakdown'}</span>
                </CardTitle>
                <CardDescription>The JD has been deconstructed. You can edit requirement priorities and scores below.</CardDescription>
                 <div className="flex items-center gap-2 flex-wrap mt-2">
                    <InfoBadge label="Position" value={PositionNumber} icon={<span className="font-bold">#</span>} />
                    <InfoBadge label="Code" value={JobCode} icon={<span className="font-bold text-xs">C</span>} />
                    <InfoBadge label="Grade" value={PayGrade} icon={<Star className="w-3 h-3"/>} />
                    <InfoBadge label="Dept" value={Department} icon={<Users className="w-3 h-3"/>} />
                    <InfoBadge label="Company" value={Company} icon={<Building className="w-3 h-3"/>} />
                    <InfoBadge label="Location" value={Location} icon={<MapPin className="w-3 h-3"/>} />
                    <InfoBadge label="Approved" value={DateApproved} icon={<Calendar className="w-3 h-3"/>} />
                </div>
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
                  <p>Show/Hide Details</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent>
            <div className="mb-6 p-4 border rounded-lg bg-muted/30">
                <div className="mb-4">
                    <h3 className="text-base font-semibold mb-2 flex items-center text-primary">
                        <Target className="h-5 w-5" />
                        <span className="ml-2">Principal Objective</span>
                    </h3>
                    <p className="text-sm text-muted-foreground">{PrincipalObjective}</p>
                </div>
                
                <div>
                    <h3 className="text-base font-semibold mb-2 flex items-center text-primary">
                        <Users className="h-5 w-5" />
                        <span className="ml-2">Organizational Relationship</span>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        {OrganizationalRelationship.ReportsTo.length > 0 && (
                            <div>
                                <h4 className="font-medium">Reports To:</h4>
                                <ul className="list-disc list-outside pl-5 text-muted-foreground">
                                    {OrganizationalRelationship.ReportsTo.map((role, i) => <li key={`report-${i}`}>{role}</li>)}
                                </ul>
                            </div>
                        )}
                         {OrganizationalRelationship.InterfacesWith.length > 0 && (
                            <div>
                                <h4 className="font-medium">Interfaces With:</h4>
                                <ul className="list-disc list-outside pl-5 text-muted-foreground">
                                    {OrganizationalRelationship.InterfacesWith.map((role, i) => <li key={`interface-${i}`}>{role}</li>)}
                                </ul>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="md:columns-2 gap-8 space-y-6">
                <RequirementSection title="Education" icon={<GraduationCap className="h-5 w-5"/>} mustHaves={Requirements.Education.MUST_HAVE} niceToHaves={Requirements.Education.NICE_TO_HAVE} category="Education" onRequirementChange={onRequirementChange} onScoreChange={onScoreChange} />
                <RequirementSection title="Certifications" icon={<Star className="h-5 w-5"/>} mustHaves={Requirements.Certifications.MUST_HAVE} niceToHaves={Requirements.Certifications.NICE_TO_HAVE} category="Certifications" onRequirementChange={onRequirementChange} onScoreChange={onScoreChange} />
                <RequirementSection title="Experience" icon={<Briefcase className="h-5 w-5"/>} mustHaves={experienceMustHaves} niceToHaves={experienceNiceToHaves} category="Experience" onRequirementChange={onRequirementChange} onScoreChange={onScoreChange} />
                <RequirementSection title="Technical Skills" icon={<BrainCircuit className="h-5 w-5"/>} mustHaves={Requirements.TechnicalSkills.MUST_HAVE} niceToHaves={Requirements.TechnicalSkills.NICE_TO_HAVE} category="TechnicalSkills" onRequirementChange={onRequirementChange} onScoreChange={onScoreChange} />
                <RequirementSection title="Soft Skills" icon={<ClipboardCheck className="h-5 w-5"/>} mustHaves={Requirements.SoftSkills.MUST_HAVE} niceToHaves={Requirements.SoftSkills.NICE_TO_HAVE} category="SoftSkills" onRequirementChange={onRequirementChange} onScoreChange={onScoreChange} />
                <RequirementSection title="Responsibilities" icon={<ListChecks className="h-5 w-5"/>} mustHaves={Responsibilities.MUST_HAVE} niceToHaves={Responsibilities.NICE_TO_HAVE} category="Responsibilities" onRequirementChange={onRequirementChange} onScoreChange={onScoreChange} />
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
