
"use client";

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ExtractJDCriteriaOutput } from "@/lib/types";
import { cn } from '@/lib/utils';
import { Briefcase, ChevronsUpDown, Building, MapPin, Calendar, Target, User, Users, Star, BrainCircuit, ListChecks, ClipboardCheck } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface JdAnalysisProps {
  analysis: ExtractJDCriteriaOutput;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
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

const RequirementSection = ({ title, mustHaves, niceToHaves, icon }: {
    title: string;
    mustHaves?: string[];
    niceToHaves?: string[];
    icon: React.ReactNode;
}) => {
    if ((!mustHaves || mustHaves.length === 0) && (!niceToHaves || niceToHaves.length === 0)) {
        return null;
    }

    return (
        <div className="break-inside-avoid">
            <h3 className="text-base font-semibold mb-3 flex items-center text-primary">
                {icon}
                <span className="ml-2">{title}</span>
            </h3>
            <div className="space-y-3">
                {mustHaves && mustHaves.length > 0 && (
                    <div>
                        <h4 className="text-sm font-bold text-accent mb-1">Must Have</h4>
                        <ul className="list-disc list-outside pl-5 space-y-1 text-sm">
                            {mustHaves.map((item, index) => <li key={`must-${index}`}>{item}</li>)}
                        </ul>
                    </div>
                )}
                {niceToHaves && niceToHaves.length > 0 && (
                     <div>
                        <h4 className="text-sm font-bold text-muted-foreground mb-1">Nice to Have</h4>
                        <ul className="list-disc list-outside pl-5 space-y-1 text-sm text-muted-foreground">
                            {niceToHaves.map((item, index) => <li key={`nice-${index}`}>{item}</li>)}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
};

export default function JdAnalysis({ analysis, isOpen, onOpenChange }: JdAnalysisProps) {
  const {
      JobTitle,
      JobCode,
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

  const experienceMustHaves = [
      ...(Requirements.Experience.MUST_HAVE.Years !== "Not Found" ? [`${Requirements.Experience.MUST_HAVE.Years} in:`] : []),
      ...(Requirements.Experience.MUST_HAVE.Fields.map(f => `  - ${f}`))
  ];

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
                <CardDescription>The JD has been deconstructed. Expand to see details.</CardDescription>
                 <div className="flex items-center gap-2 flex-wrap mt-2">
                    <InfoBadge label="Code" value={JobCode} icon={<span className="font-bold">#</span>} />
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
            <div className="mb-6">
                <h3 className="text-base font-semibold mb-2 flex items-center text-primary">
                    <Target className="h-5 w-5" />
                    <span className="ml-2">Principal Objective</span>
                </h3>
                <p className="text-sm text-muted-foreground">{PrincipalObjective}</p>
            </div>
            
            <div className="mb-6">
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

            <div className="md:columns-2 gap-8 space-y-6">
              <RequirementSection title="Responsibilities" icon={<ListChecks className="h-5 w-5"/>} mustHaves={Responsibilities.MUST_HAVE} niceToHaves={Responsibilities.NICE_TO_HAVE} />
              <RequirementSection title="Education" icon={<GraduationCap className="h-5 w-5"/>} mustHaves={Requirements.Education.MUST_HAVE} niceToHaves={Requirements.Education.NICE_TO_HAVE} />
              <RequirementSection title="Experience" icon={<Briefcase className="h-5 w-5"/>} mustHaves={experienceMustHaves} niceToHaves={Requirements.Experience.NICE_TO_HAVE} />
              <RequirementSection title="Technical Skills" icon={<BrainCircuit className="h-5 w-5"/>} mustHaves={Requirements.TechnicalSkills.MUST_HAVE} niceToHaves={Requirements.TechnicalSkills.NICE_TO_HAVE} />
              <RequirementSection title="Soft Skills" icon={<ClipboardCheck className="h-5 w-5"/>} mustHaves={Requirements.SoftSkills.MUST_HAVE} niceToHaves={Requirements.SoftSkills.NICE_TO_HAVE} />
              <RequirementSection title="Certifications" icon={<Star className="h-5 w-5"/>} mustHaves={Requirements.Certifications.MUST_HAVE} niceToHaves={Requirements.Certifications.NICE_TO_HAVE} />
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
