"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import type { ExtractJDCriteriaOutput, Requirement } from "@/lib/types";
import { ClipboardCheck, Briefcase, GraduationCap, Star, BrainCircuit, ListChecks, ChevronsUpDown } from "lucide-react";

interface JdAnalysisProps {
  analysis: ExtractJDCriteriaOutput;
}

const RequirementList = ({ title, requirements, icon }: { title: string; requirements: Requirement[], icon: React.ReactNode }) => {
  if (!requirements || requirements.length === 0) return null;
  return (
    <div className="break-inside-avoid">
      <h3 className="text-lg font-semibold mb-3 flex items-center text-primary">
        {icon}
        <span className="ml-2">{title}</span>
      </h3>
      <ul className="space-y-2">
        {requirements.map((req, index) => (
          <li key={index} className="flex items-start justify-between gap-4 p-3 rounded-lg border bg-secondary/30">
            <p className="text-sm text-foreground">{req.description}</p>
            <Badge variant={req.priority === 'MUST-HAVE' ? 'destructive' : 'secondary'} className="whitespace-nowrap shrink-0">
              {req.priority.replace('-', ' ')}
            </Badge>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default function JdAnalysis({ analysis }: JdAnalysisProps) {
  const [isOpen, setIsOpen] = useState(true);

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
                        <CardDescription>The JD has been deconstructed into the following categories and priorities.</CardDescription>
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
                        <RequirementList title="Technical Skills" requirements={analysis.technicalSkills} icon={<BrainCircuit className="h-5 w-5" />} />
                        <RequirementList title="Soft Skills" requirements={analysis.softSkills} icon={<ClipboardCheck className="h-5 w-5" />} />
                        <RequirementList title="Experience" requirements={analysis.experience} icon={<Briefcase className="h-5 w-5" />} />
                        <RequirementList title="Education" requirements={analysis.education} icon={<GraduationCap className="h-5 w-5" />} />
                        <RequirementList title="Certifications" requirements={analysis.certifications} icon={<Star className="h-5 w-5" />} />
                        <RequirementList title="Responsibilities" requirements={analysis.responsibilities} icon={<ListChecks className="h-5 w-5" />} />
                    </div>
                </CardContent>
            </CollapsibleContent>
        </Card>
    </Collapsible>
  );
}
