"use client";

import { useState, useEffect } from "react";
import { Accordion } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

const LOCAL_STORAGE_KEY = 'jiggar-session';

export default function Home() {
  const { toast } = useToast();

  const [jd, setJd] = useState("");
  const [analyzedJd, setAnalyzedJd] = useState<ExtractJDCriteriaOutput | null>(null);
  const [cvs, setCvs] = useState<{name: string, content: string}[]>([]);
  const [candidates, setCandidates] = useState<AnalyzedCandidate[]>([]);
  const [summary, setSummary] = useState<CandidateSummaryOutput | null>(null);
  const [cvResetKey, setCvResetKey] = useState(0);

  const [isJdLoading, setIsJdLoading] = useState(false);
  const [isCvLoading, setIsCvLoading] = useState(false);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);

  useEffect(() => {
    try {
        const savedStateJSON = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (savedStateJSON) {
            const savedState = JSON.parse(savedStateJSON);
            if (savedState.jd) setJd(savedState.jd);
            if (savedState.analyzedJd) setAnalyzedJd(savedState.analyzedJd);
            if (savedState.candidates) setCandidates(savedState.candidates);
            if (savedState.summary) setSummary(savedState.summary);
        }
    } catch (error) {
        console.error("Failed to load state from localStorage", error);
        localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    const stateToSave = {
        jd,
        analyzedJd,
        candidates,
        summary,
    };
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(stateToSave));
    } catch (error) {
        console.error("Failed to save state to localStorage", error);
    }
  }, [jd, analyzedJd, candidates, summary]);


  const handleJdUpload = (files: { name: string, content: string }[]) => {
    if(files.length > 0) {
        setJd(files[0].content);
    }
  };
  
  const handleJdClear = () => {
    setJd("");
    setAnalyzedJd(null);
    setCandidates([]);
    setSummary(null);
  }

  const handleCvUpload = (files: { name: string, content: string }[]) => {
    setCvs(files);
  };
  
  const handleCvClear = () => {
    setCvs([]);
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

  const handleAnalyzeCvs = async () => {
    if (cvs.length === 0) {
      toast({ variant: "destructive", description: "Please upload one or more CV files." });
      return;
    }
     if (!analyzedJd) {
        toast({ variant: "destructive", description: "Please analyze a Job Description first." });
        return;
    }
    setIsCvLoading(true);
    try {
      toast({ description: `Assessing ${cvs.length} candidate(s)... This may take a moment.` });
      
      const analysisPromises = cvs.map(cv => 
        analyzeCVAgainstJD({ jobDescriptionCriteria: analyzedJd, cv: cv.content })
      );
      
      const results = await Promise.all(analysisPromises);
      
      setCandidates(prev => [...prev, ...results]);
      toast({ description: `${results.length} candidate(s) have been successfully assessed.` });
      
      setCvs([]);
      // This key change will force the FileUploader to re-mount and clear its internal state
      setCvResetKey(key => key + 1);
    } catch (error) {
      console.error("Error analyzing CVs:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to analyze one or more CVs." });
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
                  <CardDescription>Upload one or more CVs to get an assessment against the JD.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                     <FileUploader
                        key={cvResetKey}
                        id="cv-uploader"
                        label="Candidate CV(s)"
                        acceptedFileTypes={acceptedFileTypes}
                        onFileUpload={handleCvUpload}
                        onFileClear={handleCvClear}
                        multiple={true}
                      />
                    <Button onClick={handleAnalyzeCvs} disabled={isCvLoading || cvs.length === 0}>
                      {isCvLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Add and Assess Candidate(s)
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
          {summary && <SummaryDisplay summary={summary} candidates={candidates} analyzedJd={analyzedJd!} />}
        </div>
      </main>
    </div>
  );
}
