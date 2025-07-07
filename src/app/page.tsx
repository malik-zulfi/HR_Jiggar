"use client";

import { useState, useEffect, useMemo } from "react";
import { Accordion } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Briefcase, FileText, Users, Lightbulb, History, Trash2 } from "lucide-react";
import { Sidebar, SidebarProvider, SidebarInset, SidebarHeader, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarMenuAction } from "@/components/ui/sidebar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";


import type { CandidateSummaryOutput, ExtractJDCriteriaOutput, AssessmentSession, Requirement, CandidateRecord } from "@/lib/types";
import { analyzeCVAgainstJD } from "@/ai/flows/cv-analyzer";
import { extractJDCriteria } from "@/ai/flows/jd-analyzer";
import { summarizeCandidateAssessments } from "@/ai/flows/candidate-summarizer";

import { Header } from "@/components/header";
import JdAnalysis from "@/components/jd-analysis";
import CandidateCard from "@/components/candidate-card";
import SummaryDisplay from "@/components/summary-display";
import FileUploader from "@/components/file-uploader";
import ProgressLoader from "@/components/progress-loader";

const LOCAL_STORAGE_KEY = 'jiggar-history';

export default function Home() {
  const { toast } = useToast();

  const [history, setHistory] = useState<AssessmentSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const [jdFile, setJdFile] = useState<{ name: string; content: string } | null>(null);
  const [cvs, setCvs] = useState<{name: string, content: string}[]>([]);
  const [cvResetKey, setCvResetKey] = useState(0);

  const [isJdLoading, setIsJdLoading] = useState(false);
  const [isCvLoading, setIsCvLoading] = useState(false);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const [isReassessing, setIsReassessing] = useState(false);
  
  const [isReassessmentDialogOpen, setIsReassessmentDialogOpen] = useState(false);
  const [pendingJdChange, setPendingJdChange] = useState<{
    requirement: Requirement;
    categoryKey: keyof ExtractJDCriteriaOutput;
    newPriority: Requirement['priority'];
  } | null>(null);
  
  const activeSession = useMemo(() => history.find(s => s.id === activeSessionId), [history, activeSessionId]);

  useEffect(() => {
    try {
      const savedStateJSON = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (savedStateJSON) {
        const savedHistory: AssessmentSession[] = JSON.parse(savedStateJSON);
        if (Array.isArray(savedHistory) && savedHistory.length > 0) {
          const sortedHistory = savedHistory.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setHistory(sortedHistory);
          // Load the most recent session
          setActiveSessionId(sortedHistory[0]?.id);
        }
      }
    } catch (error) {
      console.error("Failed to load state from localStorage", error);
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (history.length > 0) {
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(history));
      } catch (error) {
        console.error("Failed to save state to localStorage", error);
      }
    } else {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
  }, [history]);

  const handleNewSession = () => {
    setActiveSessionId(null);
    setJdFile(null);
  };

  const handleDeleteSession = (sessionId: string) => {
    const updatedHistory = history.filter(s => s.id !== sessionId);
    setHistory(updatedHistory);
    if (activeSessionId === sessionId) {
        const newActiveSession = updatedHistory.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
        setActiveSessionId(newActiveSession?.id || null);
    }
    toast({ description: "Assessment deleted." });
  };

  const handleJdUpload = (files: { name: string, content: string }[]) => {
    if(files.length > 0) {
        setJdFile(files[0]);
    }
  };
  
  const handleJdClear = () => {
    setJdFile(null);
  }

  const handleCvUpload = (files: { name: string, content: string }[]) => {
    setCvs(files);
  };
  
  const handleCvClear = () => {
    setCvs([]);
  }

  const handleAnalyzeJd = async () => {
    if (!jdFile) {
      toast({ variant: "destructive", description: "Please upload a Job Description file." });
      return;
    }
    setIsJdLoading(true);
    try {
      const result = await extractJDCriteria({ jobDescription: jdFile.content });
      const newSession: AssessmentSession = {
        id: new Date().toISOString() + Math.random(),
        jdName: jdFile.name,
        analyzedJd: result,
        candidates: [],
        summary: null,
        createdAt: new Date().toISOString(),
      };
      setHistory(prev => [newSession, ...prev]);
      setActiveSessionId(newSession.id);
      toast({ description: "Job Description analyzed successfully." });
    } catch (error) {
      console.error("Error analyzing JD:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to analyze Job Description." });
    } finally {
      setIsJdLoading(false);
    }
  };
  
  const applyJdChange = (change: { requirement: Requirement; categoryKey: keyof ExtractJDCriteriaOutput; newPriority: Requirement['priority']; }) => {
     const { requirement, categoryKey, newPriority } = change;
      setHistory(prevHistory =>
        prevHistory.map(session => {
          if (session.id === activeSessionId && session.analyzedJd) {
            const newAnalyzedJd = { ...session.analyzedJd };
            const oldList = (newAnalyzedJd[categoryKey] || []) as Requirement[];
            const newList = oldList.map(req =>
              req.description === requirement.description ? { ...req, priority: newPriority } : req
            );
            return { ...session, analyzedJd: { ...newAnalyzedJd, [categoryKey]: newList }, summary: null }; // Invalidate summary
          }
          return session;
        })
      );
      toast({ description: `Requirement priority updated to ${newPriority.replace('-', ' ')}.` });
  };

  const reAssessCandidates = async (jd: ExtractJDCriteriaOutput) => {
      const session = history.find(s => s.id === activeSessionId);
      if (!session || session.candidates.length === 0) return;

      setIsReassessing(true);
      try {
        toast({ description: `Re-assessing ${session.candidates.length} candidate(s)...` });
        
        const analysisPromises = session.candidates.map(c => 
          analyzeCVAgainstJD({ jobDescriptionCriteria: jd, cv: c.cvContent })
        );
        
        const results = await Promise.all(analysisPromises);
        
        setHistory(prev => prev.map(s => {
          if (s.id === activeSessionId) {
            const updatedCandidates = s.candidates.map((oldCandidate, index) => ({
              ...oldCandidate,
              analysis: results[index]
            }));
            return { ...s, candidates: updatedCandidates, summary: null }; // Invalidate summary
          }
          return s;
        }));

        toast({ description: "All candidates have been re-assessed." });
      } catch (error) {
        console.error("Error re-assessing CVs:", error);
        toast({ variant: "destructive", title: "Error", description: "Failed to re-assess one or more candidates." });
      } finally {
        setIsReassessing(false);
      }
    };
  
  const handleJdRequirementPriorityChange = (
    requirement: Requirement,
    categoryKey: keyof ExtractJDCriteriaOutput,
    newPriority: Requirement['priority']
  ) => {
    const change = { requirement, categoryKey, newPriority };
    if (activeSession && activeSession.candidates.length > 0) {
      setPendingJdChange(change);
      setIsReassessmentDialogOpen(true);
    } else {
      applyJdChange(change);
    }
  };

  const handleConfirmReassessment = async () => {
    if (!pendingJdChange || !activeSessionId) return;
    setIsReassessmentDialogOpen(false);
    
    // 1. Calculate the future state of the JD
    const sessionToUpdate = history.find(s => s.id === activeSessionId);
    if (!sessionToUpdate || !sessionToUpdate.analyzedJd) return;
    
    const { requirement, categoryKey, newPriority } = pendingJdChange;
    const newAnalyzedJd = { ...sessionToUpdate.analyzedJd };
    const oldList = (newAnalyzedJd[categoryKey] || []) as Requirement[];
    const newList = oldList.map(req =>
      req.description === requirement.description ? { ...req, priority: newPriority } : req
    );
    newAnalyzedJd[categoryKey] = newList;
    
    // 2. Apply the change and start re-assessment
    applyJdChange(pendingJdChange);
    await reAssessCandidates(newAnalyzedJd);
    setPendingJdChange(null);
  };
  
  const handleDeclineReassessment = () => {
    if (!pendingJdChange) return;
    applyJdChange(pendingJdChange);
    setIsReassessmentDialogOpen(false);
    setPendingJdChange(null);
  };

  const handleAnalyzeCvs = async () => {
    if (cvs.length === 0) {
      toast({ variant: "destructive", description: "Please upload one or more CV files." });
      return;
    }
     if (!activeSession?.analyzedJd) {
        toast({ variant: "destructive", description: "Please analyze a Job Description first." });
        return;
    }
    setIsCvLoading(true);
    try {
      toast({ description: `Assessing ${cvs.length} candidate(s)... This may take a moment.` });
      
      const analysisPromises = cvs.map(cv => 
        analyzeCVAgainstJD({ jobDescriptionCriteria: activeSession.analyzedJd, cv: cv.content })
      );
      
      const results = await Promise.all(analysisPromises);
      const newCandidates: CandidateRecord[] = results.map((res, i) => ({
        cvName: cvs[i].name,
        cvContent: cvs[i].content,
        analysis: res,
      }));
      
      setHistory(prev => prev.map(session => {
        if (session.id === activeSessionId) {
          const existingNames = new Set(session.candidates.map(c => c.cvName));
          const newCandidatesToAdd = newCandidates.filter(nc => !existingNames.has(nc.cvName));
          return {
            ...session,
            candidates: [...session.candidates, ...newCandidatesToAdd],
            summary: null, // Invalidate summary
          };
        }
        return session;
      }));

      toast({ description: `${results.length} candidate(s) have been successfully assessed.` });
      
      setCvs([]);
      setCvResetKey(key => key + 1);
    } catch (error) {
      console.error("Error analyzing CVs:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to analyze one or more CVs." });
    } finally {
      setIsCvLoading(false);
    }
  };
  
  const handleGenerateSummary = async () => {
    if (!activeSession || activeSession.candidates.length === 0 || !activeSession.analyzedJd) return;
    setIsSummaryLoading(true);
    try {
      const candidateAssessments = activeSession.candidates.map(c => ({
        candidateName: c.analysis.candidateName,
        recommendation: c.analysis.recommendation,
        strengths: c.analysis.strengths,
        weaknesses: c.analysis.weaknesses,
        interviewProbes: c.analysis.interviewProbes,
      }));
      const result = await summarizeCandidateAssessments({ candidateAssessments, jobDescriptionCriteria: activeSession.analyzedJd });
      
      setHistory(prev => prev.map(session => {
        if (session.id === activeSessionId) {
          return { ...session, summary: result };
        }
        return session;
      }));

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
      <Header onNewSession={handleNewSession} />
        <SidebarProvider>
            <div className="relative flex flex-1 overflow-hidden">
                <Sidebar side="left" className="h-full">
                    <SidebarHeader>
                        <h2 className="text-lg font-semibold flex items-center gap-2 p-2">
                            <History className="w-5 h-5"/>
                            Assessments
                        </h2>
                    </SidebarHeader>
                    <SidebarContent>
                        <SidebarMenu>
                            {history.length > 0 ? history.map(session => (
                                <SidebarMenuItem key={session.id}>
                                    <SidebarMenuButton 
                                        onClick={() => setActiveSessionId(session.id)}
                                        isActive={session.id === activeSessionId}
                                    >
                                        <span className="truncate" title={session.jdName}>{session.jdName}</span>
                                    </SidebarMenuButton>
                                    <SidebarMenuAction
                                        onClick={(e) => { e.stopPropagation(); handleDeleteSession(session.id); }}
                                        className="opacity-50 hover:opacity-100"
                                    >
                                        <Trash2/>
                                    </SidebarMenuAction>
                                </SidebarMenuItem>
                            )) : (
                                <p className="p-4 text-sm text-muted-foreground text-center">No assessments yet.</p>
                            )}
                        </SidebarMenu>
                    </SidebarContent>
                </Sidebar>
                <SidebarInset className="overflow-y-auto w-full">
                    <div className="space-y-8 p-4 md:p-8">
                        {!activeSession && !isJdLoading && (
                            <Card>
                                <CardHeader>
                                <CardTitle className="flex items-center gap-2"><Briefcase /> Start a New Assessment</CardTitle>
                                <CardDescription>Upload or drop a Job Description (JD) file below to begin.</CardDescription>
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
                                    <Button onClick={handleAnalyzeJd} disabled={!jdFile}>
                                        Analyze Job Description
                                    </Button>
                                </div>
                                </CardContent>
                            </Card>
                        )}
                        
                        {isJdLoading && <div className="p-8"><ProgressLoader title="Analyzing Job Description..." /></div>}
                        
                        {activeSession && (
                            <>
                                <JdAnalysis
                                    analysis={activeSession.analyzedJd}
                                    onRequirementPriorityChange={handleJdRequirementPriorityChange}
                                />

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
                                        {isCvLoading ? (
                                            <ProgressLoader title={`Assessing ${cvs.length} candidate(s)...`} />
                                        ) : (
                                            <Button onClick={handleAnalyzeCvs} disabled={cvs.length === 0}>
                                                Add and Assess Candidate(s)
                                            </Button>
                                        )}
                                    </div>
                                    </CardContent>
                                </Card>

                                {activeSession.candidates.length > 0 && (
                                    <>
                                        <Card>
                                            <CardHeader>
                                                <CardTitle className="flex items-center gap-2"><Users /> Step 3: Review Candidates</CardTitle>
                                                <CardDescription>Here are the assessments for the submitted candidates. When you're done, generate a final summary.</CardDescription>
                                            </CardHeader>
                                            <CardContent>
                                            {isReassessing ? (
                                                <ProgressLoader title={`Re-assessing ${activeSession.candidates.length} candidate(s)...`} />
                                            ) : (
                                                <Accordion type="single" collapsible className="w-full">
                                                    {activeSession.candidates.map((c, i) => (
                                                        <CandidateCard key={`${c.analysis.candidateName}-${i}`} candidate={c.analysis} />
                                                    ))}
                                                </Accordion>
                                            )}
                                            </CardContent>
                                        </Card>

                                        <Separator />

                                        <Card>
                                            <CardHeader>
                                                <CardTitle className="flex items-center gap-2"><Lightbulb /> Step 4: Generate Summary</CardTitle>
                                                <CardDescription>Create a summary report of all assessed candidates with a suggested interview strategy.</CardDescription>
                                            </CardHeader>
                                            <CardContent>
                                                {isSummaryLoading ? (
                                                    <ProgressLoader title="Generating Summary..." />
                                                ) : (
                                                    <Button onClick={handleGenerateSummary}>
                                                        Generate Summary
                                                    </Button>
                                                )}
                                            </CardContent>
                                        </Card>
                                    </>
                                )}
                                
                                {activeSession.summary && !isSummaryLoading && <SummaryDisplay summary={activeSession.summary} candidates={activeSession.candidates.map(c => c.analysis)} analyzedJd={activeSession.analyzedJd} />}
                            </>
                        )}
                    </div>
                </SidebarInset>
            </div>
        </SidebarProvider>

        <AlertDialog open={isReassessmentDialogOpen} onOpenChange={setIsReassessmentDialogOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Re-assess Candidates?</AlertDialogTitle>
                    <AlertDialogDescription>
                        You've changed the job requirements. Would you like to re-assess the existing {activeSession?.candidates.length} candidate(s) with these new criteria? This will replace their current assessments.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setPendingJdChange(null)}>Cancel</AlertDialogCancel>
                    <Button variant="outline" onClick={handleDeclineReassessment}>Update JD Only</Button>
                    <AlertDialogAction onClick={handleConfirmReassessment}>Update and Re-assess</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}
