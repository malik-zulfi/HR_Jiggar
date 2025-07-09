
"use client";

import { useState, useEffect, useMemo } from "react";
import { Accordion } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Briefcase, FileText, Users, Lightbulb, History, Trash2, RefreshCw, PanelLeftClose, SlidersHorizontal } from "lucide-react";
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
type CvProcessingStatus = Record<string, { status: 'processing' | 'done' | 'error', fileName: string, candidateName?: string }>;


function HomePageContent() {
  const { toast } = useToast();
  const { state, toggleSidebar } = useSidebar();
  const isExpanded = state === 'expanded';

  const [history, setHistory] = useState<AssessmentSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [jdFile, setJdFile] = useState<{ name: string; content: string } | null>(null);
  const [cvs, setCvs] = useState<CvFile[]>([]);
  const [cvResetKey, setCvResetKey] = useState(0);

  const [jdAnalysisProgress, setJdAnalysisProgress] = useState<{ steps: string[], currentStepIndex: number } | null>(null);
  const [newCvProcessingStatus, setNewCvProcessingStatus] = useState<CvProcessingStatus>({});
  const [reassessProgress, setReassessProgress] = useState<{ current: number; total: number; } | null>(null);
  const [summaryProgress, setSummaryProgress] = useState<{ steps: string[], currentStepIndex: number } | null>(null);

  const [isJdAnalysisOpen, setIsJdAnalysisOpen] = useState(false);

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
  
  const newCvStatusList = useMemo(() => {
    const statuses = Object.values(newCvProcessingStatus);
    if (statuses.length === 0) return null;
    
    return statuses.map(item => {
        let message = '';
        if (item.status === 'processing') message = `Processing: ${item.fileName}`;
        if (item.status === 'done') message = `Done: ${item.candidateName || item.fileName}`;
        if (item.status === 'error') message = `Error: ${item.fileName}`;
        return { status: item.status, message };
    });
  }, [newCvProcessingStatus]);

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
                result.data.candidates.sort((a, b) => b.analysis.alignmentScore - a.analysis.alignmentScore);
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
    } catch (error: any) {
      console.error("Error analyzing JD:", error);
      toast({ variant: "destructive", title: "Analysis Error", description: error.message || "An unexpected response was received from the server." });
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

  const reAssessCandidates = async (jd: ExtractJDCriteriaOutput) => {
      const session = history.find(s => s.id === activeSessionId);
      if (!session || session.candidates.length === 0) return;

      setReassessProgress({ current: 0, total: session.candidates.length });
      
      try {
        toast({ description: `Re-assessing ${session.candidates.length} candidate(s)...` });
        
        let assessedCount = 0;
        const analysisPromises = session.candidates.map(oldCandidate =>
          analyzeCVAgainstJD({ jobDescriptionCriteria: jd, cv: oldCandidate.cvContent })
            .then(result => {
              assessedCount++;
              setReassessProgress({ current: assessedCount, total: session.candidates.length });
              return {
                ...oldCandidate,
                analysis: result
              };
            })
            .catch(error => {
              assessedCount++;
              setReassessProgress({ current: assessedCount, total: session.candidates.length });
              console.error(`Error re-assessing CV for ${oldCandidate.analysis.candidateName}:`, error);
              toast({
                  variant: "destructive",
                  title: `Re-assessment Failed for ${oldCandidate.analysis.candidateName}`,
                  description: "An unexpected response was received from the server.",
              });
              return oldCandidate; // Keep the old data on failure
            })
        );
        
        const updatedCandidates = await Promise.all(analysisPromises);
        
        updatedCandidates.sort((a, b) => b.analysis.alignmentScore - a.analysis.alignmentScore);

        setHistory(prev => prev.map(s => {
          if (s.id === activeSessionId) {
            return { ...s, candidates: updatedCandidates, summary: null }; // Invalidate summary
          }
          return s;
        }));

        toast({ description: "All candidates have been re-assessed." });
      } catch (error: any) {
        console.error("Error re-assessing CVs:", error);
        toast({ variant: "destructive", title: "Re-assessment Error", description: error.message || "An unexpected response was received from the server." });
      } finally {
        setReassessProgress(null);
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
    
    const initialStatus = cvs.reduce((acc, cv) => {
        acc[cv.fileName] = { status: 'processing', fileName: cv.fileName };
        return acc;
    }, {} as CvProcessingStatus);
    setNewCvProcessingStatus(initialStatus);
    
    try {
      toast({ description: `Assessing ${cvs.length} candidate(s)... This may take a moment.` });
      
      const analysisPromises = cvs.map(cv =>
        analyzeCVAgainstJD({ jobDescriptionCriteria: activeSession!.analyzedJd, cv: cv.content })
          .then(analysis => {
            const candidateRecord: CandidateRecord = {
              cvName: cv.fileName,
              cvContent: cv.content,
              analysis
            };
            
            setHistory(prev => prev.map(session => {
              if (session.id === activeSessionId) {
                const existingNames = new Set(session.candidates.map(c => c.cvName));
                if (existingNames.has(candidateRecord.cvName)) return session;

                const allCandidates = [...session.candidates, candidateRecord];
                allCandidates.sort((a, b) => b.analysis.alignmentScore - a.analysis.alignmentScore);
                return { ...session, candidates: allCandidates, summary: null };
              }
              return session;
            }));

            setNewCvProcessingStatus(prev => ({
              ...prev,
              [cv.fileName]: { ...prev[cv.fileName], status: 'done', candidateName: analysis.candidateName }
            }));

            return { status: 'fulfilled', value: candidateRecord };
          })
          .catch(error => {
            console.error(`Error analyzing CV for ${cv.fileName}:`, error);
            toast({
              variant: "destructive",
              title: `Analysis Failed for ${cv.fileName}`,
              description: "An unexpected response was received from the server.",
            });

            setNewCvProcessingStatus(prev => ({
              ...prev,
              [cv.fileName]: { ...prev[cv.fileName], status: 'error' }
            }));
            
            return { status: 'rejected', reason: error };
          })
      );
      
      const results = await Promise.all(analysisPromises);
      const successfulAnalyses = results.filter(r => r.status === 'fulfilled').length;
      if (successfulAnalyses > 0) {
        toast({ description: `${successfulAnalyses} candidate(s) have been successfully assessed.` });
      }

    } catch (error: any) {
      console.error("Error analyzing CVs:", error);
      toast({ variant: "destructive", title: "Assessment Error", description: error.message || "An unexpected error occurred during the process." });
    } finally {
        setTimeout(() => {
            setNewCvProcessingStatus({});
            setCvs([]);
            setCvResetKey(key => key + 1);
        }, 2000);
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
        processingTime: c.analysis.processingTime,
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
    } catch (error: any) {
      console.error("Error generating summary:", error);
      toast({ variant: "destructive", title: "Summary Error", description: error.message || "An unexpected response was received from the server." });
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

  const isAssessingNewCvs = Object.keys(newCvProcessingStatus).length > 0;

  return (
    <div className="flex flex-col min-h-screen">
      <Header onNewSession={handleNewSession} />
      <div 
          className="flex flex-1 w-full"
          style={
            {
              "--sidebar-width": "18rem",
              "--sidebar-width-collapsed": "3.5rem",
            } as React.CSSProperties
          }
      >
          <Sidebar side="left" className="h-full">
              <SidebarHeader
                onClick={toggleSidebar}
                className={cn(
                  "cursor-pointer transition-all",
                  isExpanded ? "p-2 gap-2" : "p-2 items-center justify-center h-full"
                )}
              >
                  {isExpanded ? (
                      <>
                          <div className="flex items-center justify-between w-full">
                              <h2 className="text-lg font-semibold flex items-center gap-2">
                                  <SlidersHorizontal className="w-5 h-5"/>
                                  Miscellaneous
                              </h2>
                              <PanelLeftClose className="w-5 h-5 text-muted-foreground"/>
                          </div>
                      </>
                  ) : (
                      <h2 className="[writing-mode:vertical-rl] rotate-180 font-semibold whitespace-nowrap flex items-center gap-2">
                          <SlidersHorizontal className="w-5 h-5"/>
                          Miscellaneous
                      </h2>
                  )}
              </SidebarHeader>

              <SidebarContent className={cn("flex flex-col p-0", !isExpanded && "hidden")}>
                  {activeSession && (
                    <div className="p-4 border-b border-sidebar-border space-y-4">
                        <FileUploader
                            key={cvResetKey}
                            id="cv-uploader"
                            label="Upload CVs to assess"
                            acceptedFileTypes={acceptedFileTypes}
                            onFileUpload={handleCvUpload}
                            onFileClear={handleCvClear}
                            multiple={true}
                        />
                        <Button 
                            onClick={handleAnalyzeCvs} 
                            disabled={cvs.length === 0 || isAssessingNewCvs} 
                            className="w-full"
                        >
                            {isAssessingNewCvs ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <FileText className="mr-2 h-4 w-4" />
                            )}
                            {isAssessingNewCvs ? 'Assessing...' : 'Add and Assess Candidate(s)'}
                        </Button>
                    </div>
                  )}

                  <div className="flex flex-col flex-1 min-h-0">
                      <div className="p-4 space-y-2 border-b border-sidebar-border">
                          <h3 className="font-semibold flex items-center gap-2">
                              <History className="w-5 h-5"/>
                              Assessments
                          </h3>
                          <SidebarInput
                              placeholder="Search assessments..."
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                          />
                      </div>
                      
                      <div className="flex-1 overflow-y-auto">
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
                      </div>
                  </div>
              </SidebarContent>
          </Sidebar>
          <SidebarInset className="overflow-y-auto">
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
                          
                          {(activeSession.candidates.length > 0 || isAssessingNewCvs) && (
                              <Card>
                                  <CardHeader>
                                      <div className="flex items-center justify-between gap-4">
                                          <div>
                                              <CardTitle className="flex items-center gap-2"><Users /> Step 2: Review Candidates</CardTitle>
                                              <CardDescription>
                                                {isAssessingNewCvs 
                                                    ? 'Assessing new candidates...' 
                                                    : 'Review assessments or re-assess all candidates with the current JD.'}
                                              </CardDescription>
                                          </div>
                                           {activeSession.candidates.length > 0 && (
                                              <Button 
                                                  variant="outline" 
                                                  onClick={handleReassessClick}
                                                  disabled={reassessProgress !== null || isAssessingNewCvs}
                                              >
                                                  <RefreshCw className="mr-2 h-4 w-4" />
                                                  Re-assess All
                                              </Button>
                                           )}
                                      </div>
                                  </CardHeader>
                                  <CardContent>
                                    {reassessProgress ? (
                                        <ProgressLoader
                                            title="Re-assessing Candidate(s)"
                                            current={reassessProgress.current}
                                            total={reassessProgress.total}
                                        />
                                    ) : (
                                        <>
                                            {newCvStatusList && (
                                                <div className="mb-4">
                                                    <ProgressLoader
                                                        title="Assessing New Candidate(s)"
                                                        statusList={newCvStatusList}
                                                    />
                                                </div>
                                            )}
                                            {activeSession.candidates.length > 0 && (
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
                                        </>
                                    )}
                                  </CardContent>
                              </Card>
                          )}
                          
                          {activeSession.candidates.length > 0 && (
                            <>
                                <Separator />

                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2"><Lightbulb /> Step 3: Generate Summary</CardTitle>
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
