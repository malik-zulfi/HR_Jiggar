
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from 'next/link';
import { Accordion } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Briefcase, FileText, Users, Lightbulb, History, Trash2, RefreshCw, PanelLeftClose, SlidersHorizontal, UserPlus, Database, Search, Plus, ArrowLeft, Wand2 } from "lucide-react";

import type { CandidateSummaryOutput, ExtractJDCriteriaOutput, AssessmentSession, Requirement, CandidateRecord, CvDatabaseRecord, SuitablePosition } from "@/lib/types";
import { AssessmentSessionSchema, CvDatabaseRecordSchema } from "@/lib/types";
import { analyzeCVAgainstJD } from "@/ai/flows/cv-analyzer";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import NotificationPopover from "@/components/notification-popover";


const LOCAL_STORAGE_KEY = 'jiggar-history';
const CV_DB_STORAGE_KEY = 'jiggar-cv-database';
const ACTIVE_SESSION_STORAGE_KEY = 'jiggar-active-session';
const SUITABLE_POSITIONS_KEY = 'jiggar-suitable-positions';
const RELEVANCE_CHECK_ENABLED_KEY = 'jiggar-relevance-check-enabled';
const PENDING_ASSESSMENT_KEY = 'jiggar-pending-assessment';

type UploadedFile = { name: string; content: string };
type CvProcessingStatus = Record<string, { status: 'processing' | 'done' | 'error', fileName: string, candidateName?: string }>;
type ReassessStatus = Record<string, { status: 'processing' | 'done' | 'error'; candidateName: string }>;
type RelevanceCheckStatus = Record<string, boolean>;


function AssessmentPage() {
  const { toast } = useToast();

  const [history, setHistory] = useState<AssessmentSession[]>([]);
  const [cvDatabase, setCvDatabase] = useState<CvDatabaseRecord[]>([]);
  const [suitablePositions, setSuitablePositions] = useState<SuitablePosition[]>([]);
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
  
  const [isRelevanceCheckEnabled, setIsRelevanceCheckEnabled] = useState(false);
  const [manualCheckStatus, setManualCheckStatus] = useState<'idle' | 'loading' | 'done'>('idle');

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
  
  // Effect to clean up the processing status after it's finished
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
  }, []);

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

        toast({ description: `Assessing ${candidatesToProcess.length} candidate(s)... This may take a moment.` });
        
        const jobCode = jd.code;

        for (const cv of candidatesToProcess) {
            try {
                let parsedData = null;
                 // Attempt to parse first to get structured data for DB and analysis
                if (jobCode) {
                    try {
                        parsedData = await parseCv({ cvText: cv.content });
                        const dbRecord: CvDatabaseRecord = {
                            ...parsedData,
                            jobCode: jobCode as 'OCN' | 'WEX' | 'SAN',
                            cvFileName: cv.name,
                            cvContent: cv.content,
                            createdAt: new Date().toISOString(),
                        };
                        addOrUpdateCvInDatabase(dbRecord);
                    } catch (parseError: any) {
                        toast({ 
                            variant: 'destructive', 
                            title: `DB Entry Skipped: ${cv.name}`, 
                            description: `Could not extract an email. Assessment will proceed.` 
                        });
                    }
                }
                
                const analysis = await analyzeCVAgainstJD({ 
                    jobDescriptionCriteria: jd, 
                    cv: cv.content,
                    parsedCv: parsedData, // Pass parsed data if available
                });

                const candidateRecord: CandidateRecord = {
                    cvName: cv.name,
                    cvContent: cv.content,
                    analysis,
                    isStale: false,
                };

                setHistory(prev => prev.map(session => {
                    if (session.id === sessionId) {
                        const existingNames = new Set(session.candidates.map(c => c.analysis.candidateName.toLowerCase()));
                        if (existingNames.has(candidateRecord.analysis.candidateName.toLowerCase())) {
                            toast({ variant: 'destructive', description: `Candidate ${candidateRecord.analysis.candidateName} already exists in this session.` });
                            return session;
                        }
                        const allCandidates = [...session.candidates, candidateRecord];
                        allCandidates.sort((a, b) => b.analysis.alignmentScore - a.analysis.alignmentScore);
                        return { ...session, candidates: allCandidates, summary: null };
                    }
                    return session;
                }));

                setNewCvProcessingStatus(prev => ({
                    ...prev,
                    [cv.name]: { ...prev[cv.name], status: 'done', candidateName: analysis.candidateName }
                }));
                successCount++;

            } catch (error: any) {
                console.error(`Error analyzing CV for ${cv.name}:`, error);
                toast({
                    variant: "destructive",
                    title: `Analysis Failed for ${cv.name}`,
                    description: error.message || "An unexpected error occurred.",
                });
                setNewCvProcessingStatus(prev => ({ ...prev, [cv.name]: { ...prev[cv.name], status: 'error' } }));
            }
        }

        if (successCount > 0) {
            toast({ description: `${successCount} candidate(s) have been successfully assessed.` });
        }
    }, [toast, addOrUpdateCvInDatabase]);

  useEffect(() => {
    try {
      const savedHistoryJSON = localStorage.getItem(LOCAL_STORAGE_KEY);
      const intendedSessionId = localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);
      const pendingAssessmentJSON = localStorage.getItem(PENDING_ASSESSMENT_KEY);

      if (intendedSessionId) localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
      
      let parsedHistory: AssessmentSession[] = [];
      if (savedHistoryJSON) {
        const parsed = JSON.parse(savedHistoryJSON);
        if (Array.isArray(parsed) && parsed.length > 0) {
          parsedHistory = parsed.map(sessionData => {
            const result = AssessmentSessionSchema.safeParse(sessionData);
            if (result.success) {
                if (!result.data.originalAnalyzedJd) {
                    result.data.originalAnalyzedJd = JSON.parse(JSON.stringify(result.data.analyzedJd));
                }
                result.data.candidates.sort((a, b) => b.analysis.alignmentScore - a.analysis.alignmentScore);
                return result.data;
            }
            return null;
          }).filter((s): s is AssessmentSession => s !== null);
        }
      }
      
      const savedCvDbJSON = localStorage.getItem(CV_DB_STORAGE_KEY);
      if (savedCvDbJSON) {
        const parsedCvDb = JSON.parse(savedCvDbJSON);
        if (Array.isArray(parsedCvDb)) {
            const validDb = parsedCvDb.map(record => {
                const result = CvDatabaseRecordSchema.safeParse(record);
                return result.success ? result.data : null;
            }).filter((r): r is CvDatabaseRecord => r !== null);
            setCvDatabase(validDb);
        }
      }
      
      const savedSuitablePositions = localStorage.getItem(SUITABLE_POSITIONS_KEY);
      if (savedSuitablePositions) {
          setSuitablePositions(JSON.parse(savedSuitablePositions));
      }
      
      const relevanceEnabled = localStorage.getItem(RELEVANCE_CHECK_ENABLED_KEY) === 'true';
      setIsRelevanceCheckEnabled(relevanceEnabled);
      
      const sortedHistory = parsedHistory.length > 0
          ? parsedHistory.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          : [];
      
      setHistory(sortedHistory);
      
      const sessionToActivate = intendedSessionId && sortedHistory.length > 0
          ? sortedHistory.find(s => s.id === intendedSessionId)
          : null;

      setActiveSessionId(sessionToActivate ? sessionToActivate.id : null);
      
      if (pendingAssessmentJSON) {
          try {
              const pendingItems: {candidate: CvDatabaseRecord, assessment: AssessmentSession}[] = JSON.parse(pendingAssessmentJSON);
              if (Array.isArray(pendingItems) && pendingItems.length > 0) {
                  const firstItem = pendingItems[0];
                  const assessment = sortedHistory.find(s => s.id === firstItem.assessment.id);
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
              localStorage.removeItem(PENDING_ASSESSMENT_KEY);
          }
      }

    } catch (error) {
      console.error("Failed to load state from localStorage", error);
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      localStorage.removeItem(CV_DB_STORAGE_KEY);
      localStorage.removeItem(SUITABLE_POSITIONS_KEY);
      localStorage.removeItem(PENDING_ASSESSMENT_KEY);
    }
  }, [processAndAnalyzeCandidates]);

  useEffect(() => {
    if (history.length > 0) {
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(history));
      } catch (error) { console.error("Failed to save history to localStorage", error); }
    } else {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
  }, [history]);

  useEffect(() => {
    if (cvDatabase.length > 0) {
      try {
        localStorage.setItem(CV_DB_STORAGE_KEY, JSON.stringify(cvDatabase));
      } catch (error) { console.error("Failed to save CV DB to localStorage", error); }
    } else {
      localStorage.removeItem(CV_DB_STORAGE_KEY);
    }
  }, [cvDatabase]);

  useEffect(() => {
    localStorage.setItem(SUITABLE_POSITIONS_KEY, JSON.stringify(suitablePositions));
  }, [suitablePositions]);
  
  useEffect(() => {
    setSelectedCandidates(new Set());
  }, [activeSessionId]);

  const handleQuickAddToAssessment = useCallback(async (position: SuitablePosition) => {
    const { candidateEmail, assessment } = position;
    const candidateDbRecord = cvDatabase.find(c => c.email === candidateEmail);

    if (!candidateDbRecord) {
        toast({ variant: 'destructive', description: "Could not find candidate record in the database." });
        return;
    }
    
    toast({ description: `Assessing ${candidateDbRecord.name} for ${assessment.analyzedJd.jobTitle}...` });

    try {
        const analysis = await analyzeCVAgainstJD({ 
            jobDescriptionCriteria: assessment.analyzedJd, 
            cv: candidateDbRecord.cvContent,
            parsedCv: candidateDbRecord, // Pass the full DB record
        });

        const newCandidateRecord: CandidateRecord = {
            cvName: candidateDbRecord.cvFileName,
            cvContent: candidateDbRecord.cvContent,
            analysis,
            isStale: false,
        };

        const updatedHistory = history.map(session => {
            if (session.id === assessment.id) {
                const newCandidates = [...session.candidates, newCandidateRecord]
                    .sort((a,b) => b.analysis.alignmentScore - a.analysis.alignmentScore);
                return { ...session, candidates: newCandidates };
            }
            return session;
        });
        
        setHistory(updatedHistory);
        
        setSuitablePositions(prev => prev.filter(p => !(p.candidateEmail === candidateEmail && p.assessment.id === assessment.id)));

        toast({
            title: 'Assessment Complete',
            description: `${candidateDbRecord.name} has been added to the "${assessment.analyzedJd.jobTitle}" assessment.`,
            action: (
                <button onClick={() => setActiveSessionId(assessment.id)} className="inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-background px-3 text-sm font-medium ring-offset-background transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50">
                    View
                </button>
            ),
        });

    } catch (error: any) {
        toast({ variant: 'destructive', title: `Failed to assess ${candidateDbRecord.name}`, description: error.message });
    }
  }, [cvDatabase, history, toast]);


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

  const handleJdUpload = async (files: UploadedFile[]) => {
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
      
      const dbRecordsMap = new Map(cvDatabase.map(cv => [cv.cvContent, cv]));

      const analysisPromises = candidatesToReassess.map(oldCandidate => {
        const parsedCv = dbRecordsMap.get(oldCandidate.cvContent);
        return analyzeCVAgainstJD({ jobDescriptionCriteria: jd, cv: oldCandidate.cvContent, parsedCv })
          .then(result => {
            setReassessStatus(prev => ({
              ...prev,
              [oldCandidate.analysis.candidateName]: { ...prev[oldCandidate.analysis.candidateName], status: 'done' }
            }));
            return {
              ...oldCandidate,
              analysis: result,
              isStale: false,
            };
          })
          .catch(error => {
            setReassessStatus(prev => ({
              ...prev,
              [oldCandidate.analysis.candidateName]: { ...prev[oldCandidate.analysis.candidateName], status: 'error' }
            }));
            console.error(`Error re-assessing CV for ${oldCandidate.analysis.candidateName}:`, error);
            toast({
              variant: "destructive",
              title: `Re-assessment Failed for ${oldCandidate.analysis.candidateName}`,
              description: error.message || "An unexpected error occurred. Please check the console.",
            });
            return oldCandidate;
          })
      });

      const updatedCandidates = await Promise.all(analysisPromises);

      setHistory(prev =>
        prev.map(s => {
          if (s.id === activeSessionId) {
            const updatedCandidatesMap = new Map(
              updatedCandidates.map(c => [c.analysis.candidateName, c])
            );
            const namesToReassess = new Set(
              candidatesToReassess.map(c => c.analysis.candidateName)
            );

            const newFullCandidateList = s.candidates.map(candidate => {
              const updatedVersion = updatedCandidatesMap.get(
                candidate.analysis.candidateName
              );
              if (updatedVersion) {
                return updatedVersion;
              }
              if (isPartialReassess && !namesToReassess.has(candidate.analysis.candidateName)) {
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

  const handleAnalyzeFromDb = async (selectedCvsFromDb: CvDatabaseRecord[]) => {
    if (selectedCvsFromDb.length === 0) return;
    if (!activeSession?.analyzedJd) return;

    const uploadedFiles: UploadedFile[] = selectedCvsFromDb.map(cv => ({
        name: cv.cvFileName,
        content: cv.cvContent,
    }));
    
    await processAndAnalyzeCandidates(uploadedFiles, activeSession.analyzedJd, activeSessionId);
    setIsAddFromDbOpen(false);
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

  const handleManualRelevanceCheck = useCallback(async () => {
    setManualCheckStatus('loading');
    toast({ description: "Running relevance check on all existing candidates..." });

    try {
        let allNewPositions: SuitablePosition[] = [];
        for (const candidate of cvDatabase) {
            const result = await findSuitablePositionsForCandidate({
                candidate,
                assessmentSessions: history,
                existingSuitablePositions: suitablePositions,
            });
            if (result.newlyFoundPositions.length > 0) {
                allNewPositions.push(...result.newlyFoundPositions);
            }
        }
        
        if (allNewPositions.length > 0) {
            setSuitablePositions(prev => {
                const existingMap = new Map(prev.map(p => `${p.candidateEmail}-${p.assessment.id}`));
                const uniqueNewPositions = allNewPositions.filter(p => !existingMap.has(`${p.candidateEmail}-${p.assessment.id}`));
                return [...prev, ...uniqueNewPositions];
            });
            toast({ title: "Relevance Check Complete", description: `Found ${allNewPositions.length} new potential matches.` });
        } else {
            toast({ title: "Relevance Check Complete", description: "No new relevant positions found for existing candidates." });
        }
    } catch (error: any) {
        toast({ variant: 'destructive', title: "Manual Check Failed", description: error.message });
    } finally {
        setManualCheckStatus('done');
         setTimeout(() => setManualCheckStatus('idle'), 3000);
    }
  }, [cvDatabase, history, suitablePositions, toast]);
  
  const acceptedFileTypes = ".pdf,.docx,.txt";
  const isAssessingNewCvs = Object.keys(newCvProcessingStatus).length > 0;
  const isReassessing = Object.keys(reassessStatus).length > 0;
  const reassessButtonText = selectedCandidates.size > 0
    ? `Re-assess Selected (${selectedCandidates.size})`
    : 'Re-assess All';
  
  const showReviewSection = (activeSession?.candidates?.length ?? 0) > 0 || isAssessingNewCvs || isReassessing;
  const showSummarySection = (activeSession?.candidates?.length ?? 0) > 0 && !isAssessingNewCvs && !isReassessing;

  return (
    <div className="flex flex-col min-h-screen bg-secondary/40">
      <Header
        activePage="assessment"
        notificationCount={isRelevanceCheckEnabled ? suitablePositions.length : 0}
        suitablePositions={isRelevanceCheckEnabled ? suitablePositions : []}
        onAddCandidate={handleQuickAddToAssessment}
        isRelevanceCheckEnabled={isRelevanceCheckEnabled}
        onRelevanceCheckToggle={(enabled) => {
            setIsRelevanceCheckEnabled(enabled);
            localStorage.setItem(RELEVANCE_CHECK_ENABLED_KEY, String(enabled));
            if(!enabled) setSuitablePositions([]);
        }}
        onManualCheck={handleManualRelevanceCheck}
        manualCheckStatus={manualCheckStatus}
      />
      <main className="flex-1 p-4 md:p-8">
        <div className="container mx-auto space-y-6">

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
                    <CardTitle className="flex items-center gap-2"><Briefcase /> Start a New Assessment</CardTitle>
                    <CardDescription>Upload or drop a Job Description (JD) file below to begin analysis.</CardDescription>
                    </CardHeader>
                    <CardContent>
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
                  <CardTitle className="flex items-center gap-2"><History /> Past Assessments</CardTitle>
                  <CardDescription>Select a past assessment to view or continue working on it.</CardDescription>
                </CardHeader>
                <CardContent>
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
                        <CardHeader className="flex-1">
                          <CardTitle className="text-base truncate">{session.analyzedJd.jobTitle || session.jdName}</CardTitle>
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
            <div className="space-y-6">
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
                        <CardTitle className="flex items-center gap-2"><UserPlus /> Step 2: Add Candidates</CardTitle>
                        <CardDescription>Upload new CVs or add candidates from your database to assess them against this job description.</CardDescription>
                    </CardHeader>
                    <CardContent>
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
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <CardTitle className="flex items-center gap-2"><Users /> Step 3: Review Candidates</CardTitle>
                                    <CardDescription>
                                      {isAssessingNewCvs 
                                          ? 'Assessing new candidates...' 
                                          : isReassessing
                                          ? 'Re-assessing candidates...'
                                          : 'Review assessments, select candidates to re-assess, or re-assess all.'}
                                    </CardDescription>
                                </div>
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
                        </CardHeader>
                        <CardContent>
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
