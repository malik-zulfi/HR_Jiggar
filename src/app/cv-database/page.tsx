
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { FileUp, Bot, Database, User, Mail, Phone, Linkedin, Briefcase, Search, Clock, Trash2, AlertTriangle, Settings, Wand2, LayoutDashboard, GanttChartSquare } from "lucide-react";
import type { CvDatabaseRecord, AssessmentSession, SuitablePosition } from '@/lib/types';
import { CvDatabaseRecordSchema, AssessmentSessionSchema, ParseCvOutput } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import FileUploader from '@/components/file-uploader';
import { parseCv } from '@/ai/flows/cv-parser';
import ProgressLoader from '@/components/progress-loader';
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import CvDisplay from '@/components/cv-display';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { findSuitablePositionsForCandidate } from '@/ai/flows/find-suitable-positions';
import { analyzeCVAgainstJD } from '@/ai/flows/cv-analyzer';
import { Header } from '@/components/header';

const CV_DB_STORAGE_KEY = 'jiggar-cv-database';
const HISTORY_STORAGE_KEY = 'jiggar-history';
const SUITABLE_POSITIONS_KEY = 'jiggar-suitable-positions';
const ACTIVE_SESSION_STORAGE_KEY = 'jiggar-active-session';
const RELEVANCE_CHECK_ENABLED_KEY = 'jiggar-relevance-check-enabled';


type UploadedFile = { name: string; content: string };
type JobCode = 'OCN' | 'WEX' | 'SAN';
type CvProcessingStatus = Record<string, { status: 'processing' | 'done' | 'error', message: string }>;
type Conflict = {
    newRecord: ParseCvOutput & { cvFileName: string; cvContent: string; jobCode: JobCode; };
    existingRecord: CvDatabaseRecord;
};

export default function CvDatabasePage() {
    const { toast } = useToast();
    const [isClient, setIsClient] = useState(false);
    const [cvDatabase, setCvDatabase] = useState<CvDatabaseRecord[]>([]);
    const [history, setHistory] = useState<AssessmentSession[]>([]);
    const [cvsToUpload, setCvsToUpload] = useState<UploadedFile[]>([]);
    const [jobCode, setJobCode] = useState<JobCode | null>(null);
    const [processingStatus, setProcessingStatus] = useState<CvProcessingStatus>({});
    const [searchTerm, setSearchTerm] = useState("");
    const [cvResetKey, setCvResetKey] = useState(0);
    const [openAccordion, setOpenAccordion] = useState<string>();
    
    const [conflictQueue, setConflictQueue] = useState<Conflict[]>([]);
    const [currentConflict, setCurrentConflict] = useState<Conflict | null>(null);
    
    const [suitablePositions, setSuitablePositions] = useState<SuitablePosition[]>([]);
    const [isCheckingRelevance, setIsCheckingRelevance] = useState(false);
    const [isRelevanceCheckEnabled, setIsRelevanceCheckEnabled] = useState(false);


    useEffect(() => {
        if (conflictQueue.length > 0 && !currentConflict) {
            setCurrentConflict(conflictQueue[0]);
        }
    }, [conflictQueue, currentConflict]);

    const resolveConflict = (action: 'replace' | 'skip') => {
        if (!currentConflict) return;
        
        let newRecord: CvDatabaseRecord | null = null;
        if (action === 'replace') {
            newRecord = {
                ...currentConflict.newRecord,
                createdAt: new Date().toISOString(),
            };
            setCvDatabase(prevDb => {
                const dbMap = new Map(prevDb.map(c => [c.email, c]));
                dbMap.set(newRecord!.email, newRecord!);
                return Array.from(dbMap.values()).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            });
            toast({ description: `Record for ${newRecord.name} was replaced.` });
        } else {
             toast({ description: `Upload for ${currentConflict.newRecord.name} was skipped.` });
        }
        
        const newQueue = conflictQueue.slice(1);
        setConflictQueue(newQueue);
        setCurrentConflict(newQueue[0] || null);
        
        if (newRecord) {
            handleNewCandidateAdded(newRecord);
        }
    };

    useEffect(() => {
        setIsClient(true);
        try {
            const savedCvDbJSON = localStorage.getItem(CV_DB_STORAGE_KEY);
            if (savedCvDbJSON) {
                const parsedCvDb = JSON.parse(savedCvDbJSON);
                if (Array.isArray(parsedCvDb)) {
                    const validDb = parsedCvDb.map(record => {
                        const result = CvDatabaseRecordSchema.safeParse(record);
                        if (result.success) {
                            result.data.name = toTitleCase(result.data.name);
                        }
                        return result.success ? result.data : null;
                    }).filter((r): r is CvDatabaseRecord => r !== null);
                    setCvDatabase(validDb.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
                }
            }

            const savedHistoryJSON = localStorage.getItem(HISTORY_STORAGE_KEY);
            if (savedHistoryJSON) {
                const parsedHistory = JSON.parse(savedHistoryJSON);
                if (Array.isArray(parsedHistory)) {
                    const validHistory = parsedHistory.map(sessionData => {
                        const result = AssessmentSessionSchema.safeParse(sessionData);
                        return result.success ? result.data : null;
                    }).filter((s): s is AssessmentSession => s !== null);
                    setHistory(validHistory);
                }
            }
            
            const savedSuitablePositions = localStorage.getItem(SUITABLE_POSITIONS_KEY);
            if (savedSuitablePositions) {
                setSuitablePositions(JSON.parse(savedSuitablePositions));
            }
            
            const relevanceEnabled = localStorage.getItem(RELEVANCE_CHECK_ENABLED_KEY) === 'true';
            setIsRelevanceCheckEnabled(relevanceEnabled);


            const params = new URLSearchParams(window.location.search);
            const emailToOpen = params.get('email');
            if (emailToOpen) {
                setOpenAccordion(emailToOpen);
                setTimeout(() => {
                    const element = document.getElementById(`cv-item-${emailToOpen}`);
                    if (element) {
                        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }, 500);
            }
        } catch (error) {
            console.error("Failed to load data from localStorage", error);
        }
    }, []);

    useEffect(() => {
        if (isClient) {
            if (cvDatabase.length > 0) {
                localStorage.setItem(CV_DB_STORAGE_KEY, JSON.stringify(cvDatabase));
            } else {
                localStorage.removeItem(CV_DB_STORAGE_KEY);
            }
        }
    }, [cvDatabase, isClient]);

    useEffect(() => {
        if (isClient) {
            localStorage.setItem(SUITABLE_POSITIONS_KEY, JSON.stringify(suitablePositions));
        }
    }, [suitablePositions, isClient]);
    
    const handleRelevanceToggle = (enabled: boolean) => {
        setIsRelevanceCheckEnabled(enabled);
        if (isClient) {
            localStorage.setItem(RELEVANCE_CHECK_ENABLED_KEY, String(enabled));
            if (!enabled) {
                setSuitablePositions([]);
            }
        }
    };

    const handleNewCandidateAdded = useCallback(async (candidate: CvDatabaseRecord) => {
        if (!isRelevanceCheckEnabled || history.length === 0) {
            return;
        }

        setIsCheckingRelevance(true);
        toast({ description: `Checking for suitable positions for ${candidate.name}...` });

        try {
            const result = await findSuitablePositionsForCandidate({
                candidate,
                assessmentSessions: history,
                existingSuitablePositions: suitablePositions
            });

            if (result.newlyFoundPositions.length > 0) {
                setSuitablePositions(prev => [...prev, ...result.newlyFoundPositions]);
                toast({
                    title: "New Opportunities Found!",
                    description: `Found ${result.newlyFoundPositions.length} new relevant position(s) for ${candidate.name}.`,
                });
            } else {
                toast({ description: `No new relevant positions found for ${candidate.name} at this time.` });
            }
        } catch (error: any) {
            console.error(`Relevance check failed for ${candidate.name}:`, error);
            toast({ variant: 'destructive', title: "Relevance Check Failed", description: error.message });
        } finally {
            setIsCheckingRelevance(false);
        }
    }, [isRelevanceCheckEnabled, history, suitablePositions, toast]);
    
    const runFullRelevanceCheck = useCallback(async () => {
        if (!isRelevanceCheckEnabled || history.length === 0 || cvDatabase.length === 0) {
            toast({ description: "Relevance check is disabled or there are no candidates/jobs to check." });
            return;
        }

        setIsCheckingRelevance(true);
        toast({ description: `Starting full relevance check for all ${cvDatabase.length} candidates... This may take a while.` });

        const allNewPositions: SuitablePosition[] = [];

        for (const candidate of cvDatabase) {
            try {
                const result = await findSuitablePositionsForCandidate({
                    candidate,
                    assessmentSessions: history,
                    existingSuitablePositions: [...suitablePositions, ...allNewPositions]
                });
                if (result.newlyFoundPositions.length > 0) {
                    allNewPositions.push(...result.newlyFoundPositions);
                }
            } catch (error: any) {
                console.error(`Relevance check failed for ${candidate.name}:`, error);
                // Continue with the next candidate
            }
        }

        if (allNewPositions.length > 0) {
            setSuitablePositions(prev => [...prev, ...allNewPositions]);
            toast({
                title: "Full Relevance Check Complete!",
                description: `Found ${allNewPositions.length} new relevant position(s) across your candidate database.`,
            });
        } else {
            toast({ description: "Full relevance check complete. No new relevant positions found." });
        }

        setIsCheckingRelevance(false);

    }, [isRelevanceCheckEnabled, cvDatabase, history, suitablePositions, toast]);

    const toTitleCase = (str: string): string => {
        if (!str) return '';
        return str
          .toLowerCase()
          .split(/[\s-]+/)
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
    }

    const filteredCvs = useMemo(() => {
        if (!searchTerm.trim()) {
            return cvDatabase;
        }
        const lowerSearch = searchTerm.toLowerCase();
        return cvDatabase.filter(cv => 
            cv.name.toLowerCase().includes(lowerSearch) ||
            cv.email.toLowerCase().includes(lowerSearch) ||
            cv.jobCode.toLowerCase().includes(lowerSearch) ||
            cv.currentTitle?.toLowerCase().includes(lowerSearch) ||
            cv.currentCompany?.toLowerCase().includes(lowerSearch) ||
            cv.structuredContent.skills?.some(s => s.toLowerCase().includes(lowerSearch))
        );
    }, [cvDatabase, searchTerm]);

    const handleCvUpload = (files: UploadedFile[]) => {
        setCvsToUpload(prev => [...prev, ...files]);
    };

    const handleCvClear = () => {
        setCvsToUpload([]);
    };
    
    const isProcessing = useMemo(() => Object.values(processingStatus).some(s => s.status === 'processing'), [processingStatus]);

    const handleProcessCvs = useCallback(async () => {
        if (cvsToUpload.length === 0) {
            toast({ variant: 'destructive', description: 'Please upload at least one CV.' });
            return;
        }
        const currentJobCode = jobCode;
        if (!currentJobCode) {
            toast({ variant: 'destructive', description: 'Please select a job code.' });
            return;
        }

        const filesToProcess = [...cvsToUpload];
        setCvsToUpload([]);
        setCvResetKey(key => key + 1);

        const newStatus = filesToProcess.reduce((acc, cv) => {
            if (!processingStatus[cv.name]) {
                acc[cv.name] = { status: 'processing', message: cv.name };
            }
            return acc;
        }, {} as CvProcessingStatus);
        setProcessingStatus(prev => ({ ...prev, ...newStatus }));

        const dbEmails = new Map(cvDatabase.map(c => [c.email, c]));
        let successCount = 0;
        const newConflicts: Conflict[] = [];
        const newRecords: CvDatabaseRecord[] = [];

        for (const cv of filesToProcess) {
            try {
                const parsedData = await parseCv({ cvText: cv.content });
                
                const existingRecord = dbEmails.get(parsedData.email);
                if (existingRecord) {
                    newConflicts.push({
                        newRecord: {
                            ...parsedData,
                            jobCode: currentJobCode,
                            cvFileName: cv.name,
                            cvContent: cv.content,
                            name: toTitleCase(parsedData.name),
                        },
                        existingRecord,
                    });
                    setProcessingStatus(prev => ({ ...prev, [cv.name]: { status: 'done', message: parsedData.name } }));
                } else {
                    const record: CvDatabaseRecord = {
                        ...parsedData,
                        jobCode: currentJobCode,
                        cvFileName: cv.name,
                        cvContent: cv.content,
                        createdAt: new Date().toISOString(),
                        name: toTitleCase(parsedData.name),
                    };
                    
                    setCvDatabase(prevDb => {
                        const dbMap = new Map(prevDb.map(c => [c.email, c]));
                        dbMap.set(record.email, record);
                        return Array.from(dbMap.values()).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                    });
                    dbEmails.set(record.email, record);
                    newRecords.push(record);
                    successCount++;
                    setProcessingStatus(prev => ({ ...prev, [cv.name]: { status: 'done', message: record.name } }));
                }
            } catch (error: any) {
                console.error(`Failed to parse ${cv.name}:`, error);
                toast({ variant: 'destructive', title: `Parsing Failed for ${cv.name}`, description: error.message });
                setProcessingStatus(prev => ({ ...prev, [cv.name]: { status: 'error', message: cv.name } }));
            }
        }
        
        if (successCount > 0) {
            toast({ description: `${successCount} new CV(s) processed and added to the database.` });
        }
        if (newConflicts.length > 0) {
            setConflictQueue(prev => [...prev, ...newConflicts]);
            toast({
                title: `${newConflicts.length} Conflict(s) Detected`,
                description: "Some CVs match existing records. Please resolve the conflicts.",
            });
        }
        
        newRecords.forEach(handleNewCandidateAdded);

    }, [cvsToUpload, jobCode, toast, processingStatus, cvDatabase, handleNewCandidateAdded]);
    
    const handleDeleteCv = (emailToDelete: string) => {
        setCvDatabase(prev => prev.filter(cv => cv.email !== emailToDelete));
        toast({
            description: "Candidate record deleted from the database.",
        });
    };

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
                cv: candidateDbRecord.cvContent 
            });

            const newCandidateRecord = {
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
            
            localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updatedHistory));
            setHistory(updatedHistory);
            
            setSuitablePositions(prev => prev.filter(p => !(p.candidateEmail === candidateEmail && p.assessment.id === assessment.id)));

            toast({
                title: 'Assessment Complete',
                description: `${candidateDbRecord.name} has been added to the "${assessment.analyzedJd.jobTitle}" assessment.`,
                action: (
                    <Link href="/assessment" onClick={() => localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, assessment.id)}>
                        <Button variant="outline" size="sm">View</Button>
                    </Link>
                ),
            });

        } catch (error: any) {
            toast({ variant: 'destructive', title: `Failed to assess ${candidateDbRecord.name}`, description: error.message });
        }

    }, [cvDatabase, history, toast]);

    useEffect(() => {
        const hasFinishedTasks = Object.values(processingStatus).some(s => s.status === 'done' || s.status === 'error');
        if (hasFinishedTasks && !isProcessing) {
            const cleanupTimeout = setTimeout(() => {
                setProcessingStatus(prev => {
                    const newStatus: CvProcessingStatus = {};
                    for (const key in prev) {
                        if (prev[key].status === 'processing') {
                            newStatus[key] = prev[key];
                        }
                    }
                    return newStatus;
                });
            }, 3000);

            return () => clearTimeout(cleanupTimeout);
        }
    }, [processingStatus, isProcessing]);

    
    if (!isClient) return null;

    return (
        <div className="flex flex-col min-h-screen bg-secondary/40">
            <Header
                activePage="cv-database"
                notificationCount={isRelevanceCheckEnabled ? suitablePositions.length : 0}
                suitablePositions={isRelevanceCheckEnabled ? suitablePositions : []}
                onAddCandidate={handleQuickAddToAssessment}
                isRelevanceCheckEnabled={isRelevanceCheckEnabled}
                onRelevanceCheckToggle={handleRelevanceToggle}
                onRunRelevanceCheck={runFullRelevanceCheck}
                isCheckingRelevance={isCheckingRelevance}
            />
            <main className="flex-1 p-4 md:p-8">
                <div className="container mx-auto space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><FileUp /> Add New Candidates</CardTitle>
                            <CardDescription>Upload CVs and tag them with a job code to add them to the central database. If a candidate's email already exists, you will be asked to confirm the replacement.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid md:grid-cols-3 gap-4 items-end">
                                <div className="md:col-span-2">
                                    <FileUploader
                                        key={cvResetKey}
                                        id="cv-db-uploader"
                                        label="Upload CV Files"
                                        acceptedFileTypes=".pdf,.docx,.txt"
                                        onFileUpload={handleCvUpload}
                                        onFileClear={handleCvClear}
                                        multiple
                                    />
                                </div>
                                <div className="grid gap-1.5">
                                    <label className="text-sm font-medium">Job Code</label>
                                    <Select value={jobCode || ''} onValueChange={(v) => setJobCode(v as JobCode)}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a job code..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="OCN">OCN</SelectItem>
                                            <SelectItem value="WEX">WEX</SelectItem>
                                            <SelectItem value="SAN">SAN</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            {Object.keys(processingStatus).length > 0 && (
                                <div className="mt-4">
                                  <ProgressLoader title="Processing CVs..." statusList={Object.values(processingStatus)} />
                                </div>
                            )}
                        </CardContent>
                        <CardFooter>
                             <Button onClick={handleProcessCvs} disabled={(cvsToUpload.length === 0 || !jobCode) && !isProcessing}>
                                {isProcessing ? (
                                    <><Bot className="mr-2 h-4 w-4 animate-spin" /> Processing...</>
                                ) : (
                                    <><Bot className="mr-2 h-4 w-4" /> {Object.keys(processingStatus).length > 0 ? 'Add to Queue' : 'Process & Add to Database'}</>
                                )}
                            </Button>
                        </CardFooter>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Database/> Candidate Records ({filteredCvs.length})</CardTitle>
                            <CardDescription>Browse, search, and review all candidates in the database.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    placeholder="Search by name, email, title, company, skills, or job code..."
                                    className="pl-9"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            
                            <Accordion type="single" collapsible className="w-full border rounded-md" value={openAccordion} onValueChange={setOpenAccordion}>
                                {filteredCvs.length > 0 ? filteredCvs.map(cv => (
                                    <AccordionItem value={cv.email} key={cv.email} id={`cv-item-${cv.email}`}>
                                        <div className="flex w-full items-center px-4 hover:bg-muted/50">
                                            <AccordionTrigger className="flex-1 py-0 text-left hover:no-underline [&>svg]:ml-auto">
                                                <div className="grid grid-cols-[2fr,2fr,1.5fr,1fr,1.5fr] gap-x-4 items-center w-full text-sm py-3">
                                                    <span className="font-semibold text-primary truncate" title={cv.name}>{cv.name}</span>
                                                    <span className="text-muted-foreground truncate" title={cv.currentTitle || 'N/A'}>{cv.currentTitle || 'N/A'}</span>
                                                    <span className="text-muted-foreground truncate" title={cv.currentCompany || 'N/A'}>{cv.currentCompany || 'N/A'}</span>
                                                    <span className="text-muted-foreground truncate">{cv.totalExperience || 'N/A'}</span>
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <Badge>{cv.jobCode}</Badge>
                                                        <Badge variant="outline" className="font-normal text-muted-foreground truncate">
                                                            <Clock className="h-3 w-3 mr-1.5" />
                                                            {new Date(cv.createdAt).toLocaleDateString()}
                                                        </Badge>
                                                    </div>
                                                </div>
                                            </AccordionTrigger>
                                            <AlertDialog>
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <AlertDialogTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </AlertDialogTrigger>
                                                        </TooltipTrigger>
                                                        <TooltipContent><p>Delete Candidate</p></TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            This action cannot be undone. This will permanently delete the candidate record for <span className="font-bold">{cv.name}</span> from the database.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDeleteCv(cv.email)} className={cn(Button, "bg-destructive hover:bg-destructive/90")}>
                                                            Delete
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                        <AccordionContent className="p-4 bg-muted/30 border-t">
                                            <div className="flex flex-col md:flex-row gap-4 md:gap-6 mb-4 pb-4 border-b">
                                                <div className="flex items-center gap-2 text-sm"><Mail className="w-4 h-4 text-muted-foreground"/>{cv.email}</div>
                                                <div className="flex items-center gap-2 text-sm"><Phone className="w-4 h-4 text-muted-foreground"/>{cv.contactNumber || 'N/A'}</div>
                                                {cv.linkedinUrl && <div className="flex items-center gap-2 text-sm"><Linkedin className="w-4 h-4 text-muted-foreground"/><a href={cv.linkedinUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">{cv.linkedinUrl}</a></div>}
                                            </div>
                                            <CvDisplay structuredContent={cv.structuredContent} />
                                        </AccordionContent>
                                    </AccordionItem>
                                )) : (
                                    <div className="text-center p-8 text-muted-foreground">
                                        {cvDatabase.length > 0 ? "No candidates found matching your search." : "No candidates in the database yet."}
                                    </div>
                                )}
                            </Accordion>
                        </CardContent>
                    </Card>
                </div>
            </main>
            
            <Dialog open={!!currentConflict} onOpenChange={(isOpen) => { if (!isOpen) setCurrentConflict(null); }}>
                {currentConflict && (
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="text-amber-500" /> Replace Existing Candidate?</DialogTitle>
                            <DialogDescription>
                                A candidate with the email <span className="font-bold text-foreground">{currentConflict.existingRecord.email}</span> already exists. Do you want to replace the existing record with the new CV you've uploaded?
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid grid-cols-2 gap-4 text-sm my-4">
                            <div className="p-3 border rounded-md">
                                <h4 className="font-semibold mb-2">Existing Record</h4>
                                <p className="truncate" title={currentConflict.existingRecord.cvFileName}><span className="text-muted-foreground">File:</span> {currentConflict.existingRecord.cvFileName}</p>
                                <p><span className="text-muted-foreground">Added:</span> {new Date(currentConflict.existingRecord.createdAt).toLocaleDateString()}</p>
                                <p><span className="text-muted-foreground">Code:</span> <Badge variant="secondary">{currentConflict.existingRecord.jobCode}</Badge></p>
                            </div>
                            <div className="p-3 border rounded-md bg-amber-50 border-amber-200">
                                <h4 className="font-semibold mb-2 text-amber-900">New Upload</h4>
                                <p className="truncate" title={currentConflict.newRecord.cvFileName}><span className="text-amber-800/80">File:</span> {currentConflict.newRecord.cvFileName}</p>
                                <p><span className="text-amber-800/80">Uploading:</span> {new Date().toLocaleDateString()}</p>
                                <p><span className="text-amber-800/80">Code:</span> <Badge>{currentConflict.newRecord.jobCode}</Badge></p>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => resolveConflict('skip')}>Skip This CV</Button>
                            <Button onClick={() => resolveConflict('replace')} className="bg-amber-500 hover:bg-amber-600">Replace Record</Button>
                        </DialogFooter>
                    </DialogContent>
                )}
            </Dialog>
        </div>
    );
}
