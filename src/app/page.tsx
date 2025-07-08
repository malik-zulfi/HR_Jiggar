
"use client";

import { useState, useEffect, useMemo } from "react";
import { Accordion } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Briefcase, FileText, Users, Lightbulb, History, Trash2, RefreshCw, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Sidebar, SidebarProvider, SidebarInset, SidebarHeader, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarMenuAction, SidebarInput, useSidebar } from "@/components/ui/sidebar";

import type { CandidateSummaryOutput, ExtractJDCriteriaOutput, AssessmentSession, Requirement, CandidateRecord, AnalyzedCandidate } from "@/lib/types";
import { AssessmentSessionSchema } from "@/lib/types";
import { analyzeCVAgainstJD } from "@/ai/flows/cv-analyzer";
import { extractJDCriteria } from "@/ai/flows/jd-analyzer";
import { summarizeCandidateAssessments } from "@/ai/flows/candidate-summarizer";

import { Header } from "@/components/header";
import JdAnalysis from "@/components/jd-analysis";
import CandidateCard from "@/components/candidate-card";
import SummaryDisplay from "@/components/summary-display";
import FileUploader from "@/components/file-uploader";
import ProgressLoader from "@/components/progress-loader";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const LOCAL_STORAGE_KEY = 'jiggar-history';
type CvFile = { fileName: string; content: string; candidateName: string };

const DesktopSidebarToggle = () => {
    const { state, toggleSidebar } = useSidebar();
    const isExpanded = state === 'expanded';

    return (
        <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="hidden md:flex absolute top-2 left-2 z-20 h-8 w-8"
        >
            {isExpanded ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeftOpen className="h-5 w-5" />}
            <span className="sr-only">Toggle sidebar</span>
        </Button>
    )
};

function HomePageContent() {
  const { toast } = useToast();

  const [history, setHistory] = useState<AssessmentSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [jdFile, setJdFile] = useState<{ name: string; content: string } | null>(null);
  const [cvs, setCvs] = useState<CvFile[]>([]);
  const [cvResetKey, setCvResetKey] = useState(0);

  const [jdAnalysisProgress, setJdAnalysisProgress] = useState<{ steps: string[], currentStepIndex: number } | null>(null);
  const [newCvAnalysisProgress, setNewCvAnalysisProgress] = useState<{ current: number; total: number; name: string; } | null>(null);
  const [reassessProgress, setReassessProgress] = useState<{ current: number; total: number; name: string; } | null>(null);
  const [summaryProgress, setSummaryProgress] = useState<{ steps: string[], currentStepIndex: number } | null>(null);

  const [isJdAnalysisOpen, setIsJdAnalysisOpen] = useState(false);
  
  const [analysisSteps, setAnalysisSteps] = useState<string[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const activeSession = useMemo(() => history.find(s => s.id === activeSessionId), [history, activeSessionId]);
  
  const filteredHistory = useMemo(() => {
    if (!searchQuery.trim()) {
      return history;
    }
    const lowerCaseQuery = searchQuery.toLowerCase().trim();
    return history.filter(session => {
        if (!session || !session.analyzedJd) return false;
        
        const jd = session.analyzedJd;
        const titleMatch = jd.jobTitle ? jd.jobTitle.toLowerCase().includes(lowerCaseQuery) : false;
        const nameMatch = session.jdName ? session.jdName.toLowerCase().includes(lowerCaseQuery) : false;
        return nameMatch || titleMatch;
    });
  }, [history, searchQuery]);

  useEffect(() => {
    try {
      const savedStateJSON = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (savedStateJSON) {
        const parsedJSON = JSON.parse(savedStateJSON);
        if (Array.isArray(parsedJSON) && parsedJSON.length > 0) {
          // Filter out invalid sessions and add back-compat for originalAnalyzedJd
          const validHistory = parsedJSON.map(sessionData => {
            const result = AssessmentSessionSchema.safeParse(sessionData);
            if (result.success) {
                if (!result.data.originalAnalyzedJd) {
                    result.data.originalAnalyzedJd = JSON.parse(JSON.stringify(result.data.analyzedJd));
                }
                return result.data;
            }
            console.warn("Found and skipped invalid session data from localStorage:", result.error);
            return null;
          }).filter((s): s is AssessmentSession => s !== null);

          if (validHistory.length > 0) {
            const sortedHistory = validHistory.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            setHistory(sortedHistory);
            setActiveSessionId(sortedHistory[0]?.id);
          } else {
             localStorage.removeItem(LOCAL_STORAGE_KEY);
          }
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
    setIsJdAnalysisOpen(false);
    setCvs([]);
    setCvResetKey(key => key + 1);
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

  const handleJdUpload = async (files: { name: string, content: string }[]) => {
    if(files.length === 0) return;
    
    const jdFile = files[0];
    setJdFile(jdFile);
    
    const steps = [
      "Initializing analysis engine...",
      "Parsing job description document...",
      "Identifying key responsibilities...",
      "Extracting technical skill requirements...",
      "Analyzing soft skill criteria...",
      "Categorizing requirements by priority...",
      "Finalizing analysis...",
    ];
    setJdAnalysisProgress({ steps, currentStepIndex: 0 });
    let simulationInterval: NodeJS.Timeout | null = setInterval(() => {
        setJdAnalysisProgress(prev => {
            if (!prev) {
                if (simulationInterval) clearInterval(simulationInterval);
                return null;
            }
            const nextStep = prev.currentStepIndex + 1;
            // Stop before last step, which is triggered after the API call
            if (nextStep >= prev.steps.length - 1) {
                if (simulationInterval) clearInterval(simulationInterval);
            }
            return { ...prev, currentStepIndex: Math.min(nextStep, prev.steps.length -1) };
        });
    }, 600);

    try {
      const result = await extractJDCriteria({ jobDescription: jdFile.content });
      
      if (simulationInterval) clearInterval(simulationInterval);
      setJdAnalysisProgress(prev => prev ? { ...prev, currentStepIndex: steps.length } : null);
      await new Promise(resolve => setTimeout(resolve, 500));

      const newSession: AssessmentSession = {
        id: new Date().toISOString() + Math.random(),
        jdName: jdFile.name,
        originalAnalyzedJd: JSON.parse(JSON.stringify(result)),
        analyzedJd: result,
        candidates: [],
        summary: null,
        createdAt: new Date().toISOString(),
      };
      setHistory(prev => [newSession, ...prev]);
      setActiveSessionId(newSession.id);
      setIsJdAnalysisOpen(true);
      toast({ description: "Job Description analyzed successfully." });
    } catch (error) {
      console.error("Error analyzing JD:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to analyze Job Description." });
    } finally {
      if (simulationInterval) clearInterval(simulationInterval);
      setJdAnalysisProgress(null);
    }
  };
  
  const handleJdClear = () => {
    setJdFile(null);
  }

  const handleCvUpload = (files: CvFile[]) => {
    setCvs(files);
  };
  
  const handleCvClear = () => {
    setCvs([]);
  }
  
  const getRequirementsAsSteps = (jd: ExtractJDCriteriaOutput): string[] => {
    const { education, experience, technicalSkills, softSkills, responsibilities, certifications } = jd;
    const hasMustHaveCert = certifications?.some(c => c.priority === 'MUST-HAVE');

    const educationSteps = education.map(req => req.description);
    const experienceSteps = experience.map(req => req.description);
    const techSteps = technicalSkills.map(req => req.description);
    const softSteps = softSkills.map(req => req.description);
    const certSteps = certifications.map(req => req.description);
    const respSteps = responsibilities.map(req => req.description);

    let allSteps: string[] = [];
    allSteps.push(...educationSteps);
    allSteps.push(...experienceSteps);
    if (hasMustHaveCert) {
        allSteps.push(...certSteps);
    }
    allSteps.push(...techSteps);
    allSteps.push(...softSteps);
    if (!hasMustHaveCert) {
        allSteps.push(...certSteps);
    }
    allSteps.push(...respSteps);

    return allSteps;
  };

  const reAssessCandidates = async (jd: ExtractJDCriteriaOutput) => {
      const session = history.find(s => s.id === activeSessionId);
      if (!session || session.candidates.length === 0) return;

      const steps = getRequirementsAsSteps(jd);
      setAnalysisSteps(steps);
      setReassessProgress({ current: 0, total: session.candidates.length, name: "Preparing..."});
      let simulationInterval: NodeJS.Timeout | null = null;
      
      try {
        toast({ description: `Re-assessing ${session.candidates.length} candidate(s)...` });
        
        const updatedCandidates: CandidateRecord[] = [];
        for (let i = 0; i < session.candidates.length; i++) {
            const oldCandidate = session.candidates[i];

            setCurrentStepIndex(0);
            setReassessProgress({ current: i + 1, total: session.candidates.length, name: oldCandidate.analysis.candidateName || oldCandidate.cvName });
            
            simulationInterval = setInterval(() => {
                setCurrentStepIndex(prev => Math.min(prev + 1, steps.length - 1));
            }, 300);

            const result = await analyzeCVAgainstJD({ jobDescriptionCriteria: jd, cv: oldCandidate.cvContent });
            
            if(simulationInterval) clearInterval(simulationInterval);
            simulationInterval = null;
            setCurrentStepIndex(steps.length);

            updatedCandidates.push({
                ...oldCandidate,
                analysis: result
            });
        }
        
        setHistory(prev => prev.map(s => {
          if (s.id === activeSessionId) {
            return { ...s, candidates: updatedCandidates, summary: null }; // Invalidate summary
          }
          return s;
        }));

        toast({ description: "All candidates have been re-assessed." });
      } catch (error) {
        console.error("Error re-assessing CVs:", error);
        toast({ variant: "destructive", title: "Error", description: "Failed to re-assess one or more candidates. The process has been stopped." });
      } finally {
        if(simulationInterval) clearInterval(simulationInterval);
        setReassessProgress(null);
        setAnalysisSteps([]);
      }
    };

  const handleReassessClick = async () => {
    if (!activeSession || !activeSession.analyzedJd || activeSession.candidates.length === 0) {
        toast({
            variant: "destructive",
            title: "Cannot Re-assess",
            description: "There are no candidates in this session to re-assess.",
        });
        return;
    }
    await reAssessCandidates(activeSession.analyzedJd);
  };
  
  const handleSaveChanges = (editedJd: ExtractJDCriteriaOutput) => {
    if (!activeSessionId) return;

    setHistory(prev => prev.map(s => {
        if (s.id === activeSessionId) {
            return { ...s, analyzedJd: editedJd, summary: null }; // Invalidate summary
        }
        return s;
    }));
    toast({ description: "Job Description changes saved. You can re-assess candidates using the button below." });
    setIsJdAnalysisOpen(false);
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
    
    const steps = getRequirementsAsSteps(activeSession.analyzedJd);
    setAnalysisSteps(steps);
    setNewCvAnalysisProgress({ current: 0, total: cvs.length, name: "Preparing..." });
    let simulationInterval: NodeJS.Timeout | null = null;
    
    try {
      toast({ description: `Assessing ${cvs.length} candidate(s)... This may take a moment.` });
      
      const newCandidates: CandidateRecord[] = [];
      
      for (let i = 0; i < cvs.length; i++) {
        const cv = cvs[i];
        
        setCurrentStepIndex(0);
        setNewCvAnalysisProgress({ current: i + 1, total: cvs.length, name: cv.candidateName });

        simulationInterval = setInterval(() => {
            setCurrentStepIndex(prev => Math.min(prev + 1, steps.length - 1));
        }, 300); 

        const result = await analyzeCVAgainstJD({ jobDescriptionCriteria: activeSession.analyzedJd, cv: cv.content });
        
        if(simulationInterval) clearInterval(simulationInterval);
        simulationInterval = null;
        setCurrentStepIndex(steps.length);
        
        newCandidates.push({
            cvName: cv.fileName,
            cvContent: cv.content,
            analysis: result
        });
      }
      
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

      toast({ description: `${newCandidates.length} candidate(s) have been successfully assessed.` });
      
      setCvs([]);
      setCvResetKey(key => key + 1);
    } catch (error) {
      console.error("Error analyzing CVs:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to analyze one or more CVs. The process has been stopped." });
    } finally {
      if(simulationInterval) clearInterval(simulationInterval);
      setNewCvAnalysisProgress(null);
      setAnalysisSteps([]);
    }
  };
  
  const handleGenerateSummary = async () => {
    if (!activeSession || activeSession.candidates.length === 0 || !activeSession.analyzedJd) return;

    const steps = [
      "Initializing summary engine...",
      "Reviewing all candidate assessments...",
      "Identifying common strengths across pool...",
      "Pinpointing common weaknesses and gaps...",
      "Categorizing candidates into tiers...",
      "Formulating interview strategy...",
      "Finalizing summary report...",
    ];
    setSummaryProgress({ steps, currentStepIndex: 0 });
    let simulationInterval: NodeJS.Timeout | null = setInterval(() => {
        setSummaryProgress(prev => {
            if (!prev) {
                if (simulationInterval) clearInterval(simulationInterval);
                return null;
            }
            const nextStep = prev.currentStepIndex + 1;
            if (nextStep >= prev.steps.length - 1) {
                if (simulationInterval) clearInterval(simulationInterval);
            }
            return { ...prev, currentStepIndex: Math.min(nextStep, prev.steps.length - 1) };
        });
    }, 600);

    try {
      const candidateAssessments = activeSession.candidates.map(c => ({
        candidateName: c.analysis.candidateName,
        alignmentScore: c.analysis.alignmentScore,
        recommendation: c.analysis.recommendation,
        strengths: c.analysis.strengths,
        weaknesses: c.analysis.weaknesses,
        interviewProbes: c.analysis.interviewProbes,
      }));
      const result = await summarizeCandidateAssessments({ candidateAssessments, jobDescriptionCriteria: activeSession.analyzedJd });
      
      if (simulationInterval) clearInterval(simulationInterval);
      setSummaryProgress(prev => prev ? { ...prev, currentStepIndex: steps.length } : null);
      await new Promise(resolve => setTimeout(resolve, 500));
      
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
      if (simulationInterval) clearInterval(simulationInterval);
      setSummaryProgress(null);
    }
  };

  const handleDeleteCandidate = (candidateNameToDelete: string) => {
    if (!activeSessionId) return;

    setHistory(prev =>
        prev.map(session => {
            if (session.id === activeSessionId) {
                const updatedCandidates = session.candidates.filter(
                    c => c.analysis.candidateName !== candidateNameToDelete
                );
                return {
                    ...session,
                    candidates: updatedCandidates,
                    summary: null, // Invalidate summary
                };
            }
            return session;
        })
    );

    toast({ description: `Candidate "${candidateNameToDelete}" has been removed.` });
  };
  
  const acceptedFileTypes = ".pdf,.docx,.txt";

  const handleAutoAnalyze = (files: { name: string, content: string }[]) => {
    handleJdUpload(files);
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Header onNewSession={handleNewSession} />
      <div 
          className="flex flex-1 w-full"
          style={
            {
              "--sidebar-width": "16rem",
              "--sidebar-width-icon": "3rem",
            } as React.CSSProperties
          }
      >
          <Sidebar side="left" className="h-full">
              <SidebarHeader>
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                      <History className="w-5 h-5"/>
                      Assessments
                  </h2>
                  <SidebarInput
                      placeholder="Search assessments..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                  />
              </SidebarHeader>
              <SidebarContent>
                  <SidebarMenu>
                      {filteredHistory.length > 0 ? filteredHistory.map(session => {
                          if (!session || !session.analyzedJd) return null;
                          return (
                              <SidebarMenuItem key={session.id}>
                                  <SidebarMenuButton
                                      onClick={() => setActiveSessionId(session.id)}
                                      isActive={session.id === activeSessionId}
                                      className="h-auto py-2"
                                  >
                                      <div className="flex flex-col items-start w-full overflow-hidden">
                                          <span className="truncate w-full font-medium" title={session.analyzedJd.jobTitle || session.jdName}>
                                              {session.analyzedJd.jobTitle || session.jdName}
                                          </span>
                                          {session.analyzedJd.jobTitle && (
                                              <span className="text-xs text-muted-foreground truncate w-full">{session.jdName}</span>
                                          )}
                                      </div>
                                  </SidebarMenuButton>
                                  <SidebarMenuAction
                                      onClick={(e) => { e.stopPropagation(); handleDeleteSession(session.id); }}
                                      className="opacity-50 hover:opacity-100"
                                  >
                                      <Trash2/>
                                  </SidebarMenuAction>
                              </SidebarMenuItem>
                          );
                      }) : (
                          <p className="p-4 text-sm text-muted-foreground text-center">
                              {history.length > 0 ? "No matching assessments found." : "No assessments yet."}
                          </p>
                      )}
                  </SidebarMenu>
              </SidebarContent>
          </Sidebar>
          <SidebarInset className="overflow-y-auto">
              <DesktopSidebarToggle />
              <div className="space-y-8 p-4 md:p-8">
                  {!activeSession && !jdAnalysisProgress && (
                      <Card>
                          <CardHeader>
                          <CardTitle className="flex items-center gap-2"><Briefcase /> Start a New Assessment</CardTitle>
                          <CardDescription>Upload or drop a Job Description (JD) file below to begin analysis.</CardDescription>
                          </CardHeader>
                          <CardContent>
                          <div className="space-y-4">
                              <FileUploader
                              id="jd-uploader"
                              label="Job Description"
                              acceptedFileTypes={acceptedFileTypes}
                              onFileUpload={handleAutoAnalyze}
                              onFileClear={handleJdClear}
                              />
                          </div>
                          </CardContent>
                      </Card>
                  )}
                  
                  {jdAnalysisProgress && (
                      <div className="p-8">
                          <ProgressLoader
                              title="Analyzing Job Description..."
                              steps={jdAnalysisProgress.steps}
                              currentStepIndex={jdAnalysisProgress.currentStepIndex}
                          />
                      </div>
                  )}
                  
                  {activeSession && (
                      <>
                          <JdAnalysis
                              analysis={activeSession.analyzedJd}
                              originalAnalysis={activeSession.originalAnalyzedJd}
                              onSaveChanges={handleSaveChanges}
                              isOpen={isJdAnalysisOpen}
                              onOpenChange={setIsJdAnalysisOpen}
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
                                  {newCvAnalysisProgress ? (
                                      <ProgressLoader
                                          title="Assessing Candidate(s)"
                                          current={newCvAnalysisProgress.current}
                                          total={newCvAnalysisProgress.total}
                                          itemName={newCvAnalysisProgress.name}
                                          steps={analysisSteps}
                                          currentStepIndex={currentStepIndex}
                                      />
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
                                          <div className="flex items-center justify-between gap-4">
                                              <div>
                                                  <CardTitle className="flex items-center gap-2"><Users /> Step 3: Review Candidates</CardTitle>
                                                  <CardDescription>Review assessments or re-assess all candidates with the current JD.</CardDescription>
                                              </div>
                                              <Button 
                                                  variant="outline" 
                                                  onClick={handleReassessClick}
                                                  disabled={reassessProgress !== null || !activeSession || activeSession.candidates.length === 0}
                                              >
                                                  <RefreshCw className="mr-2 h-4 w-4" />
                                                  Re-assess All
                                              </Button>
                                          </div>
                                      </CardHeader>
                                      <CardContent>
                                      {reassessProgress ? (
                                          <ProgressLoader
                                              title="Re-assessing Candidate(s)"
                                              current={reassessProgress.current}
                                              total={reassessProgress.total}
                                              itemName={reassessProgress.name}
                                              steps={analysisSteps}
                                              currentStepIndex={currentStepIndex}
                                          />
                                      ) : (
                                          <Accordion type="single" collapsible className="w-full">
                                              {activeSession.candidates.map((c, i) => (
                                                  <CandidateCard 
                                                      key={`${c.analysis.candidateName}-${i}`} 
                                                      candidate={c.analysis}
                                                      onDelete={() => handleDeleteCandidate(c.analysis.candidateName)} 
                                                  />
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
                                          {summaryProgress ? (
                                              <ProgressLoader
                                                  title="Generating Summary..."
                                                  steps={summaryProgress.steps}
                                                  currentStepIndex={summaryProgress.currentStepIndex}
                                              />
                                          ) : (
                                              <Button onClick={handleGenerateSummary}>
                                                  Generate Summary
                                              </Button>
                                          )}
                                      </CardContent>
                                  </Card>
                              </>
                          )}
                          
                          {activeSession.summary && !summaryProgress && <SummaryDisplay summary={activeSession.summary} candidates={activeSession.candidates.map(c => c.analysis)} analyzedJd={activeSession.analyzedJd} />}
                      </>
                  )}
              </div>
          </SidebarInset>
      </div>
    </div>
  );
}


export default function Home() {
    return (
        <SidebarProvider>
            <HomePageContent />
        </SidebarProvider>
    )
}
