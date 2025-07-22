
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from 'next/link';
import { Accordion } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Briefcase, FileText, Users, Lightbulb, History, Trash2, RefreshCw, PanelLeftClose, SlidersHorizontal, UserPlus, Database, Search, Plus, ArrowLeft, Wand2, ListFilter } from "lucide-react";

import type { CandidateSummaryOutput, ExtractJDCriteriaOutput, AssessmentSession, Requirement, CandidateRecord, CvDatabaseRecord, SuitablePosition, AlignmentDetail, AnalyzeCVAgainstJDOutput } from "@/lib/types";
import { AssessmentSessionSchema, CvDatabaseRecordSchema } from "@/lib/types";
import { analyzeCVAgainstJD } from "@/ai/flows/cv-analyzer";
import { bulkAnalyzeCVs } from "@/ai/flows/bulk-cv-analyzer";
import { extractJDCriteria } from "@/ai/flows/jd-analyzer";
import { summarizeCandidateAssessments } from "@/ai/flows/candidate-summarizer";
import { parseCv } from "@/ai/flows/cv-parser";
import { findSuitablePositionsForCandidate } from "@/ai/flows/find-suitable-positions";

import { Header } from "@/components/header";
import JdAnalysis from "@/components/jd-analysis";
import CandidateCard from "@/components/candidate-card";
import SummaryDisplay from "@/components/summary-display";
import FileUploader from "@/components/file-uploader";
import ProgressLoader from "@/components/progress-loader";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAppContext } from "@/components/client-provider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


const ACTIVE_SESSION_STORAGE_KEY = 'jiggar-active-session';
const PENDING_ASSESSMENT_KEY = 'jiggar-pending-assessment';

type UploadedFile = { name: string; content: string };
type CvProcessingStatus = Record<string, { status: 'processing' | 'done' | 'error', fileName: string, candidateName?: string }>;
type ReassessStatus = Record<string, { status: 'processing' | 'done' | 'error'; candidateName: string }>;
type ReplacementPrompt = {
    isOpen: boolean;
    existingSession: AssessmentSession | null;
    newJd: ExtractJDCriteriaOutput | null;
};

function AssessmentPage() {
  const { history, setHistory, cvDatabase, setCvDatabase, suitablePositions, setSuitablePositions } = useAppContext();
  const { toast } = useToast();

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(new Set());

  const [jdFile, setJdFile] = useState<UploadedFile | null>(null);
  const [cvs, setCvs] = useState<UploadedFile[]>([]);
  const [cvResetKey, setCvResetKey] = useState(0);

  const [jdAnalysisProgress, setJdAnalysisProgress] = useState<{ steps: string[], currentStepIndex: number } | null>(null);
  const [newCvProcessingStatus, setNewCvProcessingStatus] = useState<CvProcessingStatus>({});
  const [reassessStatus, setReassessStatus] = useState<ReassessStatus>({});
  const [summaryProgress, setSummaryProgress] = useState<{ steps: string[], currentStepIndex: number } | null>(null);

  const [isJdAnalysisOpen, setIsJdAnalysisOpen] = useState(false);
  const [isAddFromDbOpen, setIsAddFromDbOpen] = useState(false);
  const [replacementPrompt, setReplacementPrompt] = useState<ReplacementPrompt>({ isOpen: false, existingSession: null, newJd: null });
  
  const activeSession = useMemo(() => history.find(s => s.id === activeSessionId), [history, activeSessionId]);
  
  const filteredHistory = useMemo(() => {
    if (!searchQuery.trim()) {
      return history;
    }
    const lowerCaseQuery = searchQuery.toLowerCase().trim();
    return history.filter(session => {
        if (!session || !session.analyzedJd) return false;
        
        const jd = session.analyzedJd;
        const titleMatch = jd.jobTitle?.toLowerCase().includes(lowerCaseQuery);
        const nameMatch = session.jdName?.toLowerCase().includes(lowerCaseQuery);
        const codeMatch = jd.code?.toLowerCase().includes(lowerCaseQuery);
        const gradeMatch = jd.grade?.toLowerCase().includes(lowerCaseQuery);
        const departmentMatch = jd.department?.toLowerCase().includes(lowerCaseQuery);
        
        return nameMatch || titleMatch || codeMatch || gradeMatch || departmentMatch;
    });
  }, [history, searchQuery]);

  const newCvStatusList = useMemo(() => {
    const statuses = Object.values(newCvProcessingStatus);
    if (statuses.length === 0) return null;
    
    return statuses.map(item => ({
        status: item.status,
        message: item.candidateName || item.fileName
    }));
  }, [newCvProcessingStatus]);

  const reassessStatusList = useMemo(() => {
    const statuses = Object.values(reassessStatus);
    if (statuses.length === 0) return null;

    return statuses.map(item => ({
        status: item.status,
        message: item.candidateName
    }));
  }, [reassessStatus]);
  
  useEffect(() => {
    const statuses = Object.values(newCvProcessingStatus);
    if (statuses.length > 0 && statuses.every(s => s.status === 'done' || s.status === 'error')) {
      const timer = setTimeout(() => {
        setNewCvProcessingStatus({});
        setCvs([]);
        setCvResetKey(key => key + 1);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [newCvProcessingStatus]);

  const addOrUpdateCvInDatabase = useCallback((parsedCv: CvDatabaseRecord) => {
    setCvDatabase(prevDb => {
        const existingCvIndex = prevDb.findIndex(c => c.email === parsedCv.email);
        if (existingCvIndex !== -1) {
            const updatedDb = [...prevDb];
            updatedDb[existingCvIndex] = parsedCv;
            return updatedDb;
        } else {
            return [...prevDb, parsedCv];
        }
    });
  }, [setCvDatabase]);

  const processAndAnalyzeCandidates = useCallback(async (
      candidatesToProcess: UploadedFile[],
      jd: ExtractJDCriteriaOutput,
      sessionId: string | null
    ) => {
        const initialStatus = candidatesToProcess.reduce((acc, cv) => {
            acc[cv.name] = { status: 'processing', fileName: cv.name, candidateName: cv.name };
            return acc;
        }, {} as CvProcessingStatus);
        setNewCvProcessingStatus(initialStatus);

        let successCount = 0;
        let finalCandidateRecords: CandidateRecord[] = [];
        const jobCode = jd.code;

        toast({ description: `Assessing ${candidatesToProcess.length} candidate(s)... This may take a moment.` });
        
        for (const cvFile of candidatesToProcess) {
            let parsedDbRecord = null;
            let recordJobCode: 'OCN' | 'WEX' | 'SAN' | undefined = undefined;

            if (jobCode?.startsWith('OCN')) recordJobCode = 'OCN';
            else if (jobCode?.startsWith('WEX')) recordJobCode = 'WEX';
            else if (jobCode?.startsWith('SAN')) recordJobCode = 'SAN';

            if (recordJobCode) {
                try {
                    const parsedData = await parseCv({ cvText: cvFile.content });
                    parsedDbRecord = {
                        ...parsedData,
                        jobCode: recordJobCode,
                        cvFileName: cvFile.name,
                        cvContent: cvFile.content,
                        createdAt: new Date().toISOString(),
                    };
                    addOrUpdateCvInDatabase(parsedDbRecord);
                } catch (parseError: any) {
                    toast({ 
                        variant: 'destructive', 
                        title: `DB Entry Skipped: ${cvFile.name}`, 
                        description: `Could not extract an email. Assessment will proceed.` 
                    });
                }
            }
            
            try {
                const analysis: AnalyzeCVAgainstJDOutput = await analyzeCVAgainstJD({
                    jobDescriptionCriteria: jd,
                    cv: cvFile.content,
                    parsedCv: parsedDbRecord,
                });
                
                const candidateRecord: CandidateRecord = {
                    cvName: cvFile.name,
                    cvContent: cvFile.content,
                    analysis: analysis,
                    isStale: false,
                };
                finalCandidateRecords.push(candidateRecord);
                
                setNewCvProcessingStatus(prev => ({
                    ...prev,
                    [cvFile.name]: { ...prev[cvFile.name], status: 'done', candidateName: analysis.candidateName }
                }));
                successCount++;

            } catch (error: any) {
                console.error(`Error analyzing CV for ${cvFile.name}:`, error);
                toast({
                    variant: "destructive",
                    title: `Analysis Failed for ${cvFile.name}`,
                    description: error.message || "An unexpected error occurred.",
                });
                 setNewCvProcessingStatus(prev => ({ ...prev, [cvFile.name]: { ...prev[cvFile.name], status: 'error' } }));
            }
        }
        
        if (finalCandidateRecords.length > 0) {
            setHistory(prev => prev.map(session => {
                if (session.id === sessionId) {
                    const existingEmails = new Set(session.candidates.map(c => c.analysis.email?.toLowerCase()).filter(Boolean));
                    
                    const newUniqueCandidates = finalCandidateRecords.filter(c => {
                        const newEmail = c.analysis.email?.toLowerCase();
                        return newEmail ? !existingEmails.has(newEmail) : true;
                    });
                    
                    if (newUniqueCandidates.length < finalCandidateRecords.length) {
                         toast({ variant: 'destructive', description: `Some candidates already existed in this session and were skipped.` });
                    }

                    if (newUniqueCandidates.length > 0) {
                        const allCandidates = [...session.candidates, ...newUniqueCandidates];
                        allCandidates.sort((a, b) => b.analysis.alignmentScore - a.analysis.alignmentScore);
                        return { ...session, candidates: allCandidates, summary: null };
                    }
                }
                return session;
            }));
        }

        if (successCount > 0) {
            toast({ description: `${successCount} candidate(s) have been successfully assessed.` });
        }
    }, [toast, addOrUpdateCvInDatabase, setHistory]);

  useEffect(() => {
    // This effect runs when the page loads. It handles activating a session
    // and processing any pending bulk-added candidates.

    // Guard against running this logic before the history state is hydrated from localStorage
    if (history.length === 0 && localStorage.getItem('jiggar-history')) {
        return;
    }

    const intendedSessionId = localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);
    const pendingAssessmentJSON = localStorage.getItem(PENDING_ASSESSMENT_KEY);

    try {
      if (intendedSessionId) {
        localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
        const sessionToActivate = history.find(s => s.id === intendedSessionId);
        setActiveSessionId(sessionToActivate ? sessionToActivate.id : null);
      }
      
      if (pendingAssessmentJSON) {
          try {
              const pendingItems: {candidate: CvDatabaseRecord, assessment: AssessmentSession}[] = JSON.parse(pendingAssessmentJSON);
              if (Array.isArray(pendingItems) && pendingItems.length > 0) {
                  const firstItem = pendingItems[0];
                  // Ensure the assessment from the pending items still exists in our history
                  const assessment = history.find(s => s.id === firstItem.assessment.id);
                  if (assessment) {
                      const uploadedFiles: UploadedFile[] = pendingItems.map(item => ({
                          name: item.candidate.cvFileName,
                          content: item.candidate.cvContent,
                      }));
                      processAndAnalyzeCandidates(uploadedFiles, assessment.analyzedJd, assessment.id);
                  }
              }
          } catch(e) {
              console.error("Could not parse pending assessments", e);
          } finally {
              // Always remove the pending key to avoid re-processing
              localStorage.removeItem(PENDING_ASSESSMENT_KEY);
          }
      }
      
    } catch (error) {
      console.error("Failed to load state from localStorage", error);
      localStorage.removeItem(PENDING_ASSESSMENT_KEY);
    }
  }, [history, processAndAnalyzeCandidates]); // Depend on history to re-run once it's hydrated

  const handleQuickAddToAssessment = useCallback(async (positions: SuitablePosition[]) => {
    if (positions.length === 0) return;

    const { assessment } = positions[0];
    const candidateDbRecords = positions.map(p => cvDatabase.find(c => c.email === p.candidateEmail)).filter(Boolean) as CvDatabaseRecord[];

    if (candidateDbRecords.length === 0) {
        toast({ variant: 'destructive', description: "Could not find candidate records in the database." });
        return;
    }
    
    // Set active session in localStorage and navigate.
    // The assessment page will handle the actual processing on load.
    localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, assessment.id);
    const pendingItems = candidateDbRecords.map(candidate => ({ candidate, assessment }));
    localStorage.setItem(PENDING_ASSESSMENT_KEY, JSON.stringify(pendingItems));
    
    // Clear handled notifications
    const handledEmails = new Set(positions.map((p: { candidateEmail: any; }) => p.candidateEmail));
    setSuitablePositions(prev => prev.filter(p => !(p.assessment.id === assessment.id && handledEmails.has(p.candidateEmail))));
    
    // Navigate
    window.location.href = '/assessment';

  }, [cvDatabase, toast, setSuitablePositions]);


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
        setActiveSessionId(null);
    }
    toast({ description: "Assessment deleted." });
  };

    const handleReplaceJd = () => {
        const { existingSession, newJd } = replacementPrompt;
        if (!existingSession || !newJd) return;

        setHistory(prev =>
            prev.map(s => {
                if (s.id === existingSession.id) {
                    return {
                        ...s,
                        originalAnalyzedJd: JSON.parse(JSON.stringify(newJd)),
                        analyzedJd: newJd,
                        candidates: s.candidates.map(c => ({ ...c, isStale: true })),
                        summary: null,
                    };
                }
                return s;
            })
        );
        setActiveSessionId(existingSession.id);
        setIsJdAnalysisOpen(true);
        toast({ description: `Replaced JD for "${newJd.jobTitle}". Existing candidates marked for re-assessment.` });
        setReplacementPrompt({ isOpen: false, existingSession: null, newJd: null });
    };

  const handleJdUpload = async (files: UploadedFile[]) => {
    if(files.length === 0) return;
    
    const jdFile = files[0];
    setJdFile(jdFile);
    
    const steps = [
      "Initializing analysis engine...",
      "Parsing job description document...",
      "Extracting key responsibilities...",
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

      const existingSession = history.find(s => s.analyzedJd.positionNumber && s.analyzedJd.positionNumber === result.positionNumber);
      
      if (existingSession) {
          setReplacementPrompt({ isOpen: true, existingSession, newJd: result });
          return;
      }

      const newSession: AssessmentSession = {
        id: new Date().toISOString() + Math.random(),
        jdName: jdFile.name,
        originalAnalyzedJd: JSON.parse(JSON.stringify(result)),
        analyzedJd: result,
        candidates: [],
        summary: null,
        createdAt: new Date().toISOString(),
      };
      setHistory([newSession, ...history]);
      setActiveSessionId(newSession.id);
      setIsJdAnalysisOpen(true);
      toast({ description: "Job Description analyzed successfully." });
    } catch (error: any) {
      console.error("Error analyzing JD:", error);
      toast({ variant: "destructive", title: "Analysis Error", description: error.message || "An unexpected error occurred. Please check the console." });
    } finally {
      if (simulationInterval) clearInterval(simulationInterval);
      setJdAnalysisProgress(null);
      setJdFile(null);
    }
  };
  
  const handleJdClear = () => {
    setJdFile(null);
  }

  const handleCvUpload = (files: UploadedFile[]) => {
    setCvs(files);
  };
  
  const handleCvClear = () => {
    setCvs([]);
  }

  const reAssessCandidates = async (
    jd: ExtractJDCriteriaOutput,
    candidatesToReassess: CandidateRecord[],
    isPartialReassess: boolean
  ) => {
    if (!candidatesToReassess || candidatesToReassess.length === 0) return;

    const initialStatus: ReassessStatus = candidatesToReassess.reduce((acc, candidate) => {
      acc[candidate.analysis.candidateName] = { status: 'processing', candidateName: candidate.analysis.candidateName };
      return acc;
    }, {} as ReassessStatus);
    setReassessStatus(initialStatus);

    try {
      toast({ description: `Re-assessing ${candidatesToReassess.length} candidate(s)...` });
      
      const bulkInput = {
        jobDescriptionCriteria: jd,
        candidates: candidatesToReassess.map(c => ({ fileName: c.cvName, cv: c.cvContent })),
      };
      
      const bulkResults = await bulkAnalyzeCVs(bulkInput);

      const updatedCandidatesMap = new Map<string, CandidateRecord>();

      for (const result of bulkResults.results) {
        const originalCandidate = candidatesToReassess.find(c => c.cvName === result.fileName);
        if (!originalCandidate) continue;

        if (result.analysis) {
          updatedCandidatesMap.set(originalCandidate.analysis.candidateName, {
            ...originalCandidate,
            analysis: result.analysis,
            isStale: false,
          });
          setReassessStatus(prev => ({
            ...prev,
            [originalCandidate.analysis.candidateName]: { ...prev[originalCandidate.analysis.candidateName], status: 'done' }
          }));
        } else {
          updatedCandidatesMap.set(originalCandidate.analysis.candidateName, originalCandidate); // Keep old version on error
          console.error(`Error re-assessing CV for ${originalCandidate.analysis.candidateName}:`, result.error);
          toast({
            variant: "destructive",
            title: `Re-assessment Failed for ${originalCandidate.analysis.candidateName}`,
            description: result.error || "An unexpected error occurred. Please check the console.",
          });
          setReassessStatus(prev => ({
            ...prev,
            [originalCandidate.analysis.candidateName]: { ...prev[originalCandidate.analysis.candidateName], status: 'error' }
          }));
        }
      }

      setHistory(prev =>
        prev.map(s => {
          if (s.id === activeSessionId) {
            const newFullCandidateList = s.candidates.map(candidate => {
              const updatedVersion = updatedCandidatesMap.get(candidate.analysis.candidateName);
              if (updatedVersion) {
                return updatedVersion;
              }
              if (isPartialReassess) {
                return { ...candidate, isStale: true };
              }
              return candidate;
            });

            newFullCandidateList.sort((a, b) => b.analysis.alignmentScore - a.analysis.alignmentScore);

            return {
              ...s,
              candidates: newFullCandidateList,
              summary: null,
            };
          }
          return s;
        })
      );

      toast({ description: "Candidates have been re-assessed." });
    } catch (error: any) {
      console.error("Error re-assessing CVs:", error);
      toast({ variant: "destructive", title: "Re-assessment Error", description: error.message || "An unexpected error occurred." });
    } finally {
      setTimeout(() => {
        setReassessStatus({});
      }, 3000);
    }
  };


  const handleReassessClick = async () => {
    if (!activeSession || !activeSession.analyzedJd) return;

    const candidatesToProcess = selectedCandidates.size > 0
      ? activeSession.candidates.filter(c => selectedCandidates.has(c.analysis.candidateName))
      : activeSession.candidates;

    if (candidatesToProcess.length === 0) {
      toast({
        variant: "destructive",
        title: "Cannot Re-assess",
        description: "There are no candidates in this session to re-assess.",
      });
      return;
    }
    await reAssessCandidates(activeSession.analyzedJd, candidatesToProcess, selectedCandidates.size > 0);
    setSelectedCandidates(new Set());
  };

  const handleSaveChanges = (editedJd: ExtractJDCriteriaOutput) => {
    if (!activeSessionId) return;

    const currentSession = history.find(s => s.id === activeSessionId);
    if (!currentSession || !currentSession.originalAnalyzedJd) return;

    const isDirty = JSON.stringify(currentSession.analyzedJd) !== JSON.stringify(editedJd);

    if (isDirty) {
      const isRevertedToOriginal = JSON.stringify(editedJd) === JSON.stringify(currentSession.originalAnalyzedJd);
      const newStaleState = !isRevertedToOriginal;

      setHistory(prev => prev.map(s => {
        if (s.id === activeSessionId) {
          const updatedCandidates = s.candidates.map(c => ({
            ...c,
            isStale: newStaleState,
          }));
          return { ...s, analyzedJd: editedJd, candidates: updatedCandidates, summary: null };
        }
        return s;
      }));
      
      if (isRevertedToOriginal) {
        toast({ description: "Job Description reverted to original. Stale indicators removed." });
      } else {
        toast({ description: "Job Description changes saved. Re-assess candidates to see updated scores." });
      }
    }

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
    await processAndAnalyzeCandidates(cvs, activeSession.analyzedJd, activeSessionId);
  };

  const handleAnalyzeFromDb = useCallback(async (selectedCvsFromDb: CvDatabaseRecord[]) => {
    if (selectedCvsFromDb.length === 0) return;
    if (!activeSession?.analyzedJd) return;
    
    // Filter out candidates already in the session
    const sessionEmails = new Set(activeSession.candidates.map(c => c.analysis.email?.toLowerCase()).filter(Boolean));
    const newCvsToAdd = selectedCvsFromDb.filter(cv => !sessionEmails.has(cv.email.toLowerCase()));

    if (newCvsToAdd.length < selectedCvsFromDb.length) {
        toast({ variant: 'destructive', description: "Some selected candidates are already in this session and were skipped." });
    }

    if (newCvsToAdd.length === 0) {
        setIsAddFromDbOpen(false);
        return;
    }

    const uploadedFiles: UploadedFile[] = newCvsToAdd.map(cv => ({
        name: cv.cvFileName,
        content: cv.cvContent,
    }));
    
    await processAndAnalyzeCandidates(uploadedFiles, activeSession.analyzedJd, activeSessionId);
    setIsAddFromDbOpen(false);
  }, [activeSession, processAndAnalyzeCandidates, toast, activeSessionId]);
  
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
      const result = await summarizeCandidateAssessments({ candidateAssessments, formattedCriteria: activeSession.analyzedJd.formattedCriteria });
      
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
      toast({ variant: "destructive", title: "Summary Error", description: error.message || "An unexpected error occurred." });
    } finally {
      if (simulationInterval) clearInterval(simulationInterval);
      setSummaryProgress(null);
    }
  };

  const handleToggleSelectCandidate = (candidateName: string) => {
    setSelectedCandidates(prev => {
        const newSelection = new Set(prev);
        if (newSelection.has(candidateName)) {
            newSelection.delete(candidateName);
        } else {
            newSelection.add(candidateName);
        }
        return newSelection;
    });
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
                    summary: null,
                };
            }
            return session;
        })
    );
    
    setSelectedCandidates(prev => {
        const newSelection = new Set(prev);
        newSelection.delete(candidateNameToDelete);
        return newSelection;
    });

    toast({ description: `Candidate "${candidateNameToDelete}" has been removed.` });
  };
  
  const acceptedFileTypes = ".pdf,.docx,.txt";
  const isAssessingNewCvs = Object.keys(newCvProcessingStatus).length > 0;
  const isReassessing = Object.keys(reassessStatus).length > 0;
  const reassessButtonText = selectedCandidates.size > 0
    ? `Re-assess Selected (${selectedCandidates.size})`
    : 'Re-assess All';
  
  const showReviewSection = (activeSession?.candidates?.length ?? 0) > 0 || isAssessingNewCvs || isReassessing;
  const showSummarySection = (activeSession?.candidates?.length ?? 0) > 0 && !isAssessingNewCvs && !isReassessing;

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header
        activePage="assessment"
        onQuickAdd={handleQuickAddToAssessment}
      />
      <main className="flex-1 p-4 md:p-6">
        <div className="container mx-auto space-y-4">
            <AlertDialog open={replacementPrompt.isOpen} onOpenChange={(isOpen) => !isOpen && setReplacementPrompt({ isOpen: false, existingSession: null, newJd: null })}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Duplicate Position Number Found</AlertDialogTitle>
                        <AlertDialogDescription>
                            An assessment for Position No. <span className="font-bold">{replacementPrompt.existingSession?.analyzedJd.positionNumber}</span> already exists.
                            Do you want to replace the old Job Description with this new one? Existing candidates will be kept and marked as stale for re-assessment.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setReplacementPrompt({ isOpen: false, existingSession: null, newJd: null })}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleReplaceJd}>Replace</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

          {!activeSession ? (
            <>
              {jdAnalysisProgress ? (
                  <div className="p-8">
                      <ProgressLoader
                          title="Analyzing Job Description..."
                          steps={jdAnalysisProgress.steps}
                          currentStepIndex={jdAnalysisProgress.currentStepIndex}
                      />
                  </div>
              ) : (
                <Card>
                    <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base"><Briefcase /> Start a New Assessment</CardTitle>
                    <CardDescription>Upload or drop a Job Description (JD) file below to begin analysis.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-4">
                    <FileUploader
                        id="jd-uploader"
                        label="Job Description"
                        acceptedFileTypes={acceptedFileTypes}
                        onFileUpload={handleJdUpload}
                        onFileClear={handleJdClear}
                    />
                    </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base"><History /> Past Assessments</CardTitle>
                  <CardDescription>Select a past assessment to view or continue working on it.</CardDescription>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="relative mb-4">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input 
                          placeholder="Search assessments by title, name, code..."
                          className="pl-9"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                      />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredHistory.length > 0 ? filteredHistory.map(session => (
                      <Card 
                        key={session.id} 
                        className="hover:shadow-md hover:border-primary/50 transition-all cursor-pointer flex flex-col"
                        onClick={() => setActiveSessionId(session.id)}
                      >
                        <CardHeader className="flex-1 p-4">
                          <CardTitle className="text-base truncate">
                            {session.analyzedJd.positionNumber ? `${session.analyzedJd.positionNumber} - ` : ''}
                            {session.analyzedJd.jobTitle || session.jdName}
                          </CardTitle>
                          <CardDescription className="flex items-center gap-1 text-xs pt-1">
                            <Users className="h-3 w-3" /> {session.candidates.length} Candidate(s)
                          </CardDescription>
                           <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap pt-2">
                                {session.analyzedJd.code && <Badge variant="secondary" className="px-1.5 py-0 font-normal">#{session.analyzedJd.code}</Badge>}
                                {session.analyzedJd.department && <Badge variant="secondary" className="px-1.5 py-0 font-normal">{session.analyzedJd.department}</Badge>}
                                {session.analyzedJd.grade && <Badge variant="secondary" className="px-1.5 py-0 font-normal">G{session.analyzedJd.grade}</Badge>}
                            </div>
                        </CardHeader>
                        <CardFooter className="p-3 border-t">
                            <p className="text-xs text-muted-foreground">Created: {new Date(session.createdAt).toLocaleDateString()}</p>
                            <Button variant="ghost" size="icon" className="h-7 w-7 ml-auto" onClick={(e) => {e.stopPropagation(); handleDeleteSession(session.id)}}>
                              <Trash2 className="h-4 w-4 text-destructive/60 hover:text-destructive" />
                            </Button>
                        </CardFooter>
                      </Card>
                    )) : (
                      <p className="col-span-full text-center text-muted-foreground py-8">
                        {history.length > 0 ? "No matching assessments found." : "No assessments yet."}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <div className="space-y-4">
                <Button variant="outline" onClick={() => setActiveSessionId(null)} className="mb-2">
                    <ArrowLeft className="mr-2 h-4 w-4"/>
                    Back to all assessments
                </Button>
                
                <JdAnalysis
                    analysis={activeSession.analyzedJd}
                    originalAnalysis={activeSession.originalAnalyzedJd}
                    onSaveChanges={handleSaveChanges}
                    isOpen={isJdAnalysisOpen}
                    onOpenChange={setIsJdAnalysisOpen}
                />
                
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base"><UserPlus /> Step 2: Add Candidates</CardTitle>
                        <CardDescription>Upload new CVs or add candidates from your database to assess them against this job description.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-4">
                        <div className="grid md:grid-cols-2 gap-6 items-start">
                            <FileUploader
                                key={cvResetKey}
                                id="cv-uploader"
                                label="Upload CVs"
                                acceptedFileTypes={acceptedFileTypes}
                                onFileUpload={handleCvUpload}
                                onFileClear={handleCvClear}
                                multiple={true}
                            />
                            <div className="space-y-4 pt-6">
                                <Button 
                                    onClick={handleAnalyzeCvs} 
                                    disabled={cvs.length === 0 || isAssessingNewCvs || isReassessing} 
                                    className="w-full"
                                >
                                    {isAssessingNewCvs ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                                    {isAssessingNewCvs ? 'Assessing...' : `Add & Assess ${cvs.length > 0 ? `(${cvs.length})` : ''}`}
                                </Button>
                                <Dialog open={isAddFromDbOpen} onOpenChange={setIsAddFromDbOpen}>
                                    <DialogTrigger asChild>
                                        <Button variant="outline" className="w-full">
                                            <Database className="mr-2 h-4 w-4"/>
                                            Add from Database
                                        </Button>
                                    </DialogTrigger>
                                    <AddFromDbDialog 
                                        allCvs={cvDatabase}
                                        jobCode={activeSession.analyzedJd.code}
                                        sessionCandidates={activeSession.candidates}
                                        onAdd={handleAnalyzeFromDb}
                                    />
                                </Dialog>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {showReviewSection && (
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between gap-4 flex-wrap">
                                <div className="flex-1">
                                    <CardTitle className="flex items-center gap-2 text-base"><Users /> Step 3: Review Candidates</CardTitle>
                                    <CardDescription>
                                      {isAssessingNewCvs 
                                          ? 'Assessing new candidates...' 
                                          : isReassessing
                                          ? 'Re-assessing candidates...'
                                          : 'Review assessments, or re-assess candidates.'}
                                    </CardDescription>
                                </div>
                                <div className="flex items-center gap-2">
                                    {activeSession.candidates.length > 0 && !isAssessingNewCvs && (
                                        <Button 
                                            variant="outline" 
                                            onClick={handleReassessClick}
                                            disabled={isReassessing}
                                        >
                                            {isReassessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                                            {isReassessing ? "Re-assessing..." : reassessButtonText}
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-4">
                          {(reassessStatusList || newCvStatusList) && (
                              <div className="mb-4">
                                  <ProgressLoader
                                      title={isReassessing ? "Re-assessing Candidate(s)" : "Assessing New Candidate(s)"}
                                      statusList={reassessStatusList || newCvStatusList!}
                                  />
                              </div>
                          )}

                          {activeSession.candidates.length > 0 && (
                            <div className={cn((isReassessing) && "opacity-60 pointer-events-none")}>
                              <Accordion type="single" collapsible className="w-full">
                                  {activeSession.candidates.map((c, i) => (
                                      <CandidateCard 
                                          key={`${c.analysis.candidateName}-${i}`} 
                                          candidate={c}
                                          isStale={c.isStale}
                                          isSelected={selectedCandidates.has(c.analysis.candidateName)}
                                          onToggleSelect={() => handleToggleSelectCandidate(c.analysis.candidateName)}
                                          onDelete={() => handleDeleteCandidate(c.analysis.candidateName)} 
                                      />
                                  ))}
                              </Accordion>
                            </div>
                          )}
                        </CardContent>
                    </Card>
                )}
                
                {showSummarySection && (
                  <>
                      <Card>
                          <CardHeader>
                              <CardTitle className="flex items-center gap-2 text-base"><Lightbulb /> Step 4: Generate Summary</CardTitle>
                              <CardDescription>Create a summary report of all assessed candidates with a suggested interview strategy.</CardDescription>
                          </CardHeader>
                          <CardContent className="p-4">
                              {summaryProgress ? (
                                  <ProgressLoader
                                      title="Generating Summary..."
                                      steps={summaryProgress.steps}
                                      currentStepIndex={summaryProgress.currentStepIndex}
                                  />
                              ) : (
                                  <Button onClick={handleGenerateSummary} disabled={!!activeSession.summary}>
                                      {activeSession.summary ? "Summary Generated" : "Generate Summary"}
                                  </Button>
                              )}
                          </CardContent>
                      </Card>
                  </>
                )}
                
                {activeSession.summary && !summaryProgress && <SummaryDisplay summary={activeSession.summary} candidates={activeSession.candidates.map(c => c.analysis)} analyzedJd={activeSession.analyzedJd} />}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

const AddFromDbDialog = ({ allCvs, jobCode, sessionCandidates, onAdd }: {
  allCvs: CvDatabaseRecord[];
  jobCode?: string;
  sessionCandidates: CandidateRecord[];
  onAdd: (selectedCvs: CvDatabaseRecord[]) => void;
}) => {
    const [selectedCvs, setSelectedCvs] = useState<Set<string>>(new Set());
    const [searchTerm, setSearchTerm] = useState("");

    const compatibleCvs = useMemo(() => {
        if (!jobCode) return [];
        return allCvs.filter(cv => cv.jobCode === jobCode);
    }, [allCvs, jobCode]);

    const filteredCvs = useMemo(() => {
        if (!searchTerm.trim()) return compatibleCvs;
        const lowerSearch = searchTerm.toLowerCase();
        return compatibleCvs.filter(cv => 
            cv.name.toLowerCase().includes(lowerSearch) ||
            cv.email.toLowerCase().includes(lowerSearch) ||
            cv.currentTitle?.toLowerCase().includes(lowerSearch)
        );
    }, [compatibleCvs, searchTerm]);

    const sessionCandidateEmails = useMemo(() => 
        new Set(sessionCandidates.map(c => c.analysis.email?.toLowerCase()).filter(Boolean))
    , [sessionCandidates]);


    const handleSelect = (email: string) => {
        setSelectedCvs(prev => {
            const newSet = new Set(prev);
            if (newSet.has(email)) {
                newSet.delete(email);
            } else {
                newSet.add(email);
            }
            return newSet;
        });
    };
    
    const handleAddClick = () => {
        const cvsToAdd = compatibleCvs.filter(cv => selectedCvs.has(cv.email));
        onAdd(cvsToAdd);
        setSelectedCvs(new Set());
    };

    if (!jobCode) {
        return (
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Cannot Add from Database</DialogTitle>
                    <DialogDescription>
                        The current Job Description does not have a valid job code (OCN, WEX, or SAN). Please edit the JD to add a valid code before adding candidates from the database.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <DialogClose asChild><Button variant="outline">Close</Button></DialogClose>
                </DialogFooter>
            </DialogContent>
        );
    }
    
    return (
        <DialogContent className="max-w-3xl">
            <DialogHeader>
                <DialogTitle>Add Candidates from Database</DialogTitle>
                <DialogDescription>
                    Select candidates from the database with job code <Badge>{jobCode}</Badge> to add to this assessment. Candidates already in this session are disabled.
                </DialogDescription>
            </DialogHeader>
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                    placeholder="Search by name, email, or title..."
                    className="pl-9"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            <ScrollArea className="h-96 border rounded-md">
                <Table>
                    <TableHeader className="sticky top-0 bg-secondary">
                        <TableRow>
                            <TableHead className="w-10"></TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Current Position</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredCvs.length > 0 ? filteredCvs.map(cv => {
                            const isInSession = sessionCandidateEmails.has(cv.email.toLowerCase());
                            return (
                                <TableRow key={cv.email} className={cn(isInSession && "bg-muted/50 text-muted-foreground")}>
                                    <TableCell>
                                        <Checkbox 
                                            checked={selectedCvs.has(cv.email)}
                                            onCheckedChange={() => handleSelect(cv.email)}
                                            disabled={isInSession}
                                        />
                                    </TableCell>
                                    <TableCell className="font-medium">{cv.name}</TableCell>
                                    <TableCell>{cv.email}</TableCell>
                                    <TableCell>{cv.currentTitle || 'N/A'}</TableCell>
                                </TableRow>
                            )
                        }) : (
                            <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                    No compatible candidates found in the database.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </ScrollArea>
            <DialogFooter>
                <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
                <Button onClick={handleAddClick} disabled={selectedCvs.size === 0}>
                    Add Selected ({selectedCvs.size})
                </Button>
            </DialogFooter>
        </DialogContent>
    );
};


export default AssessmentPage;
