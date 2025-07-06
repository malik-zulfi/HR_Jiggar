import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CandidateSummaryOutput } from "@/lib/types";
import { Award, Target, Telescope, UserMinus, UserCheck, Users } from "lucide-react";

interface SummaryDisplayProps {
  summary: CandidateSummaryOutput;
}

export default function SummaryDisplay({ summary }: SummaryDisplayProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Overall Assessment Summary</CardTitle>
        <CardDescription>A complete overview of all candidates and strategic recommendations.</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="tiers" className="w-full">
          <TabsList className="grid w-full grid-cols-1 md:grid-cols-3">
            <TabsTrigger value="tiers"><Users className="mr-2 h-4 w-4"/>Candidate Tiers</TabsTrigger>
            <TabsTrigger value="commonalities"><Target className="mr-2 h-4 w-4"/>Commonalities</TabsTrigger>
            <TabsTrigger value="strategy"><Telescope className="mr-2 h-4 w-4"/>Interview Strategy</TabsTrigger>
          </TabsList>
          <TabsContent value="tiers" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <TierList title="Top Tier" candidates={summary.topTier} icon={<Award className="h-5 w-5 text-accent"/>} />
              <TierList title="Mid Tier" candidates={summary.midTier} icon={<UserCheck className="h-5 w-5 text-primary"/>} />
              <TierList title="Not Suitable" candidates={summary.notSuitable} icon={<UserMinus className="h-5 w-5 text-destructive"/>} />
            </div>
          </TabsContent>
          <TabsContent value="commonalities" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold mb-2 text-lg">Common Strengths</h4>
                <ul className="list-disc list-inside space-y-2 text-sm">
                  {summary.commonStrengths.map((s, i) => <li key={`strength-${i}`}>{s}</li>)}
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2 text-lg">Common Gaps</h4>
                <ul className="list-disc list-inside space-y-2 text-sm">
                  {summary.commonGaps.map((g, i) => <li key={`gap-${i}`}>{g}</li>)}
                </ul>
              </div>
            </div>
          </TabsContent>
          <TabsContent value="strategy" className="mt-6">
             <h4 className="font-semibold mb-2 text-lg">Suggested Interview Strategy</h4>
             <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{summary.interviewStrategy}</p>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

const TierList = ({ title, candidates, icon }: { title: string; candidates: string[]; icon: React.ReactNode }) => (
  <div className="p-4 rounded-lg border bg-card">
    <h4 className="font-semibold mb-3 flex items-center">{icon}<span className="ml-2">{title}</span></h4>
    {candidates.length > 0 ? (
      <ul className="space-y-1.5 text-sm">
        {candidates.map((name, i) => <li key={i} className="p-2 rounded-md bg-secondary/30">{name}</li>)}
      </ul>
    ) : (
      <p className="text-sm text-muted-foreground">No candidates in this tier.</p>
    )}
  </div>
);
