"use client";

import { AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import type { AnalyzedCandidate } from "@/lib/types";
import { Lightbulb, ThumbsDown, ThumbsUp, AlertTriangle, ClipboardCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import AlignmentTable from "./alignment-table";

interface CandidateCardProps {
  candidate: AnalyzedCandidate;
}

const getRecommendationInfo = (recommendation: AnalyzedCandidate['recommendation']) => {
    switch (recommendation) {
        case 'Strongly Recommended':
            return {
                icon: <ThumbsUp className="h-4 w-4" />,
                className: 'bg-primary text-primary-foreground border-transparent hover:bg-primary/90',
            };
        case 'Recommended with Reservations':
            return {
                icon: <AlertTriangle className="h-4 w-4" />,
                className: 'bg-accent text-accent-foreground border-transparent hover:bg-accent/80',
            };
        case 'Not Recommended':
            return {
                icon: <ThumbsDown className="h-4 w-4" />,
                className: 'bg-destructive text-destructive-foreground border-transparent hover:bg-destructive/90',
            };
        default:
            return { icon: null, className: 'text-foreground border-border' };
    }
};

export default function CandidateCard({ candidate }: CandidateCardProps) {
  const recommendationInfo = getRecommendationInfo(candidate.recommendation);

  return (
    <AccordionItem value={candidate.candidateName}>
      <AccordionTrigger className="hover:no-underline px-4 py-3 data-[state=open]:bg-secondary/50">
        <div className="flex items-center justify-between w-full gap-4">
          <span className="font-semibold text-foreground truncate">{candidate.candidateName}</span>
          <Badge className={cn("whitespace-nowrap", recommendationInfo.className)}>
            <div className="flex items-center gap-2">
              {recommendationInfo.icon}
              {candidate.recommendation}
            </div>
          </Badge>
        </div>
      </AccordionTrigger>
      <AccordionContent className="p-4 bg-muted/30 rounded-b-md border-t">
        <div className="space-y-6">
          <div>
            <h4 className="font-semibold mb-2 flex items-center"><ClipboardCheck className="w-4 h-4 mr-2 text-primary"/> Alignment Details</h4>
            <p className="text-sm text-foreground/80 whitespace-pre-wrap mb-4">{candidate.alignmentSummary}</p>
            <AlignmentTable details={candidate.alignmentDetails} />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold mb-2 flex items-center"><ThumbsUp className="w-4 h-4 mr-2 text-primary"/> Strengths</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                {candidate.strengths.map((s, i) => <li key={`strength-${i}`} className="text-foreground">{s}</li>)}
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2 flex items-center"><ThumbsDown className="w-4 h-4 mr-2 text-destructive"/> Weaknesses</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                {candidate.weaknesses.map((w, i) => <li key={`weakness-${i}`} className="text-foreground">{w}</li>)}
              </ul>
            </div>
          </div>
          <div>
            <h4 className="font-semibold mb-2 flex items-center"><Lightbulb className="w-4 h-4 mr-2 text-accent"/> Interview Probes</h4>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              {candidate.interviewProbes.map((p, i) => <li key={`probe-${i}`} className="text-foreground">{p}</li>)}
            </ul>
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
