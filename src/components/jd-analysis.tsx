import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ExtractJDCriteriaOutput, Requirement } from "@/lib/types";
import { ClipboardCheck, Briefcase, GraduationCap, Star, BrainCircuit, ListChecks } from "lucide-react";

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
  return (
    <Card>
      <CardHeader>
        <CardTitle>Job Description Breakdown</CardTitle>
        <CardDescription>The JD has been deconstructed into the following categories and priorities.</CardDescription>
      </CardHeader>
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
    </Card>
  );
}
