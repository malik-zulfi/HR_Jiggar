"use client";

import { useState } from "react";
import { Accordion } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Briefcase, FileText, Users, Lightbulb } from "lucide-react";

import type { AnalyzedCandidate, CandidateSummaryOutput, ExtractJDCriteriaOutput } from "@/lib/types";
import { analyzeCVAgainstJD } from "@/ai/flows/cv-analyzer";
import { extractJDCriteria } from "@/ai/flows/jd-analyzer";
import { summarizeCandidateAssessments } from "@/ai/flows/candidate-summarizer";

import { Header } from "@/components/header";
import JdAnalysis from "@/components/jd-analysis";
import CandidateCard from "@/components/candidate-card";
import SummaryDisplay from "@/components/summary-display";
import FileUploader from "@/components/file-uploader";

export default function Home() {
  const { toast } = useToast();

  const [jd, setJd] = useState("");
  const [analyzedJd, setAnalyzedJd] = useState<ExtractJDCriteriaOutput | null>(null);
  const [cv, setCv] = useState("");
  const [candidateName, setCandidateName] = useState("");
  const [candidates, setCandidates] = useState<AnalyzedCandidate[]>([]);
  const [summary, setSummary] = useState<CandidateSummaryOutput | null>(null);
  const [cvResetKey, setCvResetKey] = useState(0);

  const [isJdLoading, setIsJdLoading] = useState(false);
  const [isCvLoading, setIsCvLoading] = useState(false);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);

  const handleJdUpload = (content: string) => {
    setJd(content);
  };
  
  const handleJdClear = () => {
    setJd("");
    setAnalyzedJd(null);
    setCandidates([]);
    setSummary(null);
  }

  const handleCvUpload = (content: string) => {
    setCv(content);
  };
  
  const handleCvClear = () => {
    setCv("");
  }

  const handleAnalyzeJd = async () => {
    if (!jd) {
      toast({ variant: "destructive", description: "Please upload a Job Description file." });
      return;
    }
    setIsJdLoading(true);
    setAnalyzedJd(null);
    setCandidates([]);
    setSummary(null);
    try {
      const result = await extractJDCriteria({ jobDescription: jd });
      setAnalyzedJd(result);
      toast({ description: "Job Description analyzed successfully." });
    } catch (error) {
      console.error("Error analyzing JD:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to analyze Job Description." });
    } finally {
      setIsJdLoading(false);
    }
  };

  const handleAnalyzeCv = async () => {
    if (!cv || !candidateName) {
      toast({ variant: "destructive", description: "Please provide a candidate name and upload a CV file." });
      return;
    }
     if (!jd) {
        toast({ variant: "destructive", description: "Please analyze a Job Description first." });
        return;
    }
    setIsCvLoading(true);
    try {
      const result = await analyzeCVAgainstJD({ jobDescription: jd, cv });
      setCandidates(prev => [...prev, { ...result, candidateName }]);
      toast({ description: `Candidate "${candidateName}" has been assessed.` });
      setCv("");
      setCandidateName("");
      setCvResetKey(key => key + 1);
    } catch (error) {
      console.error("Error analyzing CV:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to analyze CV." });
    } finally {
      setIsCvLoading(false);
    }
  };
  
  const handleGenerateSummary = async () => {
    if (candidates.length === 0 || !jd) return;
    setIsSummaryLoading(true);
    try {
      const candidateAssessments = candidates.map(c => ({
        candidateName: c.candidateName,
        recommendation: c.recommendation,
        strengths: c.strengths,
        weaknesses: c.weaknesses,
        interviewProbes: c.interviewProbes,
      }));
      const result = await summarizeCandidateAssessments({ candidateAssessments, jobDescription: jd });
      setSummary(result);
      toast({ description: "Candidate summary generated." });
    } catch (error) {
      console.error("Error generating summary:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to generate summary." });
    } finally {
      setIsSummaryLoading(false);
    }
  };

  const acceptedFileTypes = ".pdf,.docx,.txt";

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 p-4 md:p-8 container mx-auto">
        <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Briefcase /> Step 1: Analyze Job Description</CardTitle>
              <CardDescription>Upload or drop a Job Description (JD) file below to deconstruct it into key requirements.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <FileUploader
                  id="jd-uploader"
                  label="Job Description"
                  acceptedFileTypes={acceptedFileTypes}
                  onFileUpload={handleJdUpload}
                  onFileClear={handleJdClear}
                />
                <Button onClick={handleAnalyzeJd} disabled={isJdLoading || !jd}>
                  {isJdLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Analyze Job Description
                </Button>
              </div>
            </CardContent>
          </Card>
          
          {isJdLoading && <div className="flex justify-center items-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}
          {analyzedJd && <JdAnalysis analysis={analyzedJd} />}
          
          {analyzedJd && (
            <>
              <Separator />
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><FileText /> Step 2: Assess Candidate CVs</CardTitle>
                  <CardDescription>Enter candidate details and upload their CV to get an assessment against the JD.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2 md:col-span-1">
                        <Label htmlFor="candidate-name">Candidate Name</Label>
                        <Input id="candidate-name" placeholder="e.g., Jane Doe" value={candidateName} onChange={e => setCandidateName(e.target.value)} />
                      </div>
                    </div>
                     <div className="space-y-2">
                      <FileUploader
                        key={cvResetKey}
                        id="cv-uploader"
                        label="Candidate CV"
                        acceptedFileTypes={acceptedFileTypes}
                        onFileUpload={handleCvUpload}
                        onFileClear={handleCvClear}
                      />
                    </div>
                    <Button onClick={handleAnalyzeCv} disabled={isCvLoading || !cv || !candidateName}>
                      {isCvLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Add and Assess Candidate
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {candidates.length > 0 && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Users /> Step 3: Review Candidates</CardTitle>
                  <CardDescription>Here are the assessments for the submitted candidates. When you're done, generate a final summary.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Accordion type="single" collapsible className="w-full">
                    {candidates.map((c, i) => (
                      <CandidateCard key={`${c.candidateName}-${i}`} candidate={c} />
                    ))}
                  </Accordion>
                </CardContent>
              </Card>

              <Separator />

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Lightbulb /> Step 4: Generate Summary</CardTitle>
                  <CardDescription>Create a summary report of all assessed candidates with a suggested interview strategy.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button onClick={handleGenerateSummary} disabled={isSummaryLoading}>
                    {isSummaryLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Generate Summary
                  </Button>
                </CardContent>
              </Card>
            </>
          )}

          {isSummaryLoading && <div className="flex justify-center items-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}
          {summary && <SummaryDisplay summary={summary} />}
        </div>
      </main>
    </div>
  );
}
