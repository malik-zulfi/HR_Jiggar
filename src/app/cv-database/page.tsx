
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { FileUp, Bot, Database, User, Mail, Phone, Linkedin, Briefcase, Brain, Search, Clock, Users, Trash2, AlertTriangle, Bell, Plus } from "lucide-react";
import type { CvDatabaseRecord, AssessmentSession, SuitablePosition, CheckRelevanceInput } from '@/lib/types';
import { CvDatabaseRecordSchema, AssessmentSessionSchema, ParseCvOutput } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import FileUploader from '@/components/file-uploader';
import { parseCv } from '@/ai/flows/cv-parser';
import ProgressLoader from '@/components/progress-loader';
import { Input } from '@/components/ui/input';
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { checkRelevance } from '@/ai/flows/relevance-checker';
import { analyzeCVAgainstJD } from '@/ai/flows/cv-analyzer';


const CV_DB_STORAGE_KEY = 'jiggar-cv-database';
const HISTORY_STORAGE_KEY = 'jiggar-history';
const SUITABLE_POSITIONS_KEY = 'jiggar-suitable-positions';
const ACTIVE_SESSION_STORAGE_KEY = 'jiggar-active-session';

type UploadedFile = { name: string; content: string };
type JobCode = 'OCN' | 'WEX' | 'SAN';
type CvProcessingStatus = Record<string, { status: 'processing' | 'done' | 'error', message: string }>;
type Conflict = {
    newRecord: ParseCvOutput & { cvFileName: string; cvContent: string; jobCode: JobCode; };
    existingRecord: CvDatabaseRecord;
};

const NotificationPopover = ({ positions, onAddCandidate }: {
    positions: SuitablePosition[];
    onAddCandidate: (position: SuitablePosition) => void;
}) => {
    const handleQuickAdd = (e: React.MouseEvent, position: SuitablePosition) => {
        e.preventDefault();
        e.stopPropagation();
        onAddCandidate(position);
    };

    if (positions.length === 0) {
        return (
            <PopoverContent align="end" className="w-96">
                <div className="p-4 text-center text-sm text-muted-foreground">
                    No new suitable positions found for your candidates.
                </div>
            </PopoverContent>
        );
    }

    return (
        <PopoverContent align="end" className="w-96 p-0">
            <div className="p-4 border-b">
                <h4 className="font-medium">Suitable Position Alerts</h4>
                <p className="text-sm text-muted-foreground">New relevant roles for candidates in your database.</p>
            </div>
            <div className="max-h-96 overflow-y-auto">
                <div className="flex flex-col">
                    {positions.map((pos, index) => (
                        <Link 
                            key={`${pos.candidateEmail}-${pos.assessment.id}-${index}`} 
                            href={`/assessment`}
                            onClick={() => localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, pos.assessment.id)}
                            className="flex items-center gap-4 p-4 border-b hover:bg-muted/50 last:border-b-0"
                        >
                            <div className="flex-1 overflow-hidden">
                                <p className="font-semibold truncate">{pos.candidateName}</p>
                                <p className="text-sm text-muted-foreground truncate" title={pos.assessment.analyzedJd.jobTitle}>
                                    is a good fit for <span className="font-medium text-primary">{pos.assessment.analyzedJd.jobTitle}</span>
                                </p>
                            </div>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-primary" onClick={(e) => handleQuickAdd(e, pos)}>
                                            <Plus />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Quick-add to this assessment</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </Link>
                    ))}
                </div>
            </div>
        </PopoverContent>
    );
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


    useEffect(() => {
        if (conflictQueue.length > 0 && !currentConflict) {
            setCurrentConflict(conflictQueue[0]);
        }
    }, [conflictQueue, currentConflict]);

    const resolveConflict = (action: 'replace' | 'skip') => {
        if (!currentConflict) return;
        
        if (action === 'replace') {
            const finalRecord: CvDatabaseRecord = {
                ...currentConflict.newRecord,
                createdAt: new Date().toISOString(),
            };
            setCvDatabase(prevDb => {
                const dbMap = new Map(prevDb.map(c => [c.email, c]));
                dbMap.set(finalRecord.email, finalRecord);
                return Array.from(dbMap.values()).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            });
            toast({ description: `Record for ${finalRecord.name} was replaced.` });
        } else {
             toast({ description: `Upload for ${currentConflict.newRecord.name} was skipped.` });
        }
        
        // Move to the next conflict
        const newQueue = conflictQueue.slice(1);
        setConflictQueue(newQueue);
        setCurrentConflict(newQueue[0] || null);
    };

    useEffect(() => {
        setIsClient(true);
        try {
            // Load CV Database
            const savedCvDbJSON = localStorage.getItem(CV_DB_STORAGE_KEY);
            if (savedCvDbJSON) {
                const parsedCvDb = JSON.parse(savedCvDbJSON);
                if (Array.isArray(parsedCvDb)) {
                    const validDb = parsedCvDb.map(record => {
                        const result = CvDatabaseRecordSchema.safeParse(record);
                        return result.success ? result.data : null;
                    }).filter((r): r is CvDatabaseRecord => r !== null);
                    setCvDatabase(validDb.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
                }
            }

            // Load Assessment History
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
            
             // Load Suitable Positions
            const savedSuitablePositions = localStorage.getItem(SUITABLE_POSITIONS_KEY);
            if (savedSuitablePositions) {
                setSuitablePositions(JSON.parse(savedSuitablePositions));
            }


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

    const calculateSuitablePositions = useCallback(async () => {
        if (!history.length || !cvDatabase.length || isCheckingRelevance) {
            return;
        }

        setIsCheckingRelevance(true);
        toast({ description: "Checking for new suitable positions for your candidates..." });

        const sessionsByJobCode = new Map<string, AssessmentSession[]>();
        history.forEach(session => {
            const code = session.analyzedJd.code;
            if (code) {
                const list = sessionsByJobCode.get(code) || [];
                list.push(session);
                sessionsByJobCode.set(code, list);
            }
        });

        const newSuitablePositions: SuitablePosition[] = [];
        const checkedPairs = new Set(suitablePositions.map(p => `${p.candidateEmail}-${p.assessment.id}`));

        const relevanceChecks: Promise<void>[] = [];

        cvDatabase.forEach(cv => {
            const potentialSessions = sessionsByJobCode.get(cv.jobCode) || [];
            potentialSessions.forEach(session => {
                const isAlreadyAssessed = session.candidates.some(candidateRecord => {
                    const match = candidateRecord.cvContent.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi);
                    const assessedEmail = match ? match[0].toLowerCase() : null;
                    return assessedEmail === cv.email.toLowerCase();
                });

                const pairKey = `${cv.email}-${session.id}`;
                if (isAlreadyAssessed || checkedPairs.has(pairKey)) {
                    return;
                }
                
                const check: CheckRelevanceInput = {
                    cvContent: cv.cvContent,
                    jobDescription: `Job Title: ${session.analyzedJd.jobTitle}\nDepartment: ${session.analyzedJd.department || 'N/A'}`
                };

                relevanceChecks.push(
                    checkRelevance(check).then(result => {
                        if (result.isRelevant) {
                            newSuitablePositions.push({
                                candidateEmail: cv.email,
                                candidateName: cv.name,
                                assessment: session,
                            });
                        }
                        checkedPairs.add(pairKey); // Mark as checked whether relevant or not
                    }).catch(error => {
                        console.error(`Relevance check failed for ${cv.name} and ${session.jdName}:`, error);
                    })
                );
            });
        });

        await Promise.all(relevanceChecks);
        
        if (newSuitablePositions.length > 0) {
            setSuitablePositions(prev => [...prev, ...newSuitablePositions]);
            toast({
                title: "New Opportunities Found!",
                description: `Found ${newSuitablePositions.length} new relevant positions for candidates in your database.`,
            });
        } else {
            toast({ description: "No new relevant positions found at this time." });
        }
        
        setIsCheckingRelevance(false);

    }, [cvDatabase, history, suitablePositions, isCheckingRelevance, toast]);
    
    useEffect(() => {
        if(isClient && cvDatabase.length > 0 && history.length > 0) {
           calculateSuitablePositions();
        }
    }, [isClient, cvDatabase, history, calculateSuitablePositions]);


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
                        },
                        existingRecord,
                    });
                    // Mark as done for progress bar, conflict handles the final state.
                    setProcessingStatus(prev => ({ ...prev, [cv.name]: { status: 'done', message: parsedData.name } }));
                } else {
                    const record: CvDatabaseRecord = {
                        ...parsedData,
                        jobCode: currentJobCode,
                        cvFileName: cv.name,
                        cvContent: cv.content,
                        createdAt: new Date().toISOString(),
                    };
                    
                    setCvDatabase(prevDb => {
                        const dbMap = new Map(prevDb.map(c => [c.email, c]));
                        dbMap.set(record.email, record);
                        return Array.from(dbMap.values()).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                    });
                    dbEmails.set(record.email, record); // Update map for current batch
                    successCount++;
                    setProcessingStatus(prev => ({ ...prev, [cv.name]: { status: 'done', message: parsedData.name } }));
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
    }, [cvsToUpload, jobCode, toast, processingStatus, cvDatabase]);
    
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
             <header className="p-4 border-b bg-card shadow-sm sticky top-0 z-10">
                <div className="container mx-auto flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <Database className="w-6 h-6 text-primary" />
                        </div>
                        <h1 className="text-xl font-bold text-foreground">CV Database</h1>
                    </Link>
                    <div className='flex items-center gap-2'>
                         <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="ghost" size="icon" className="relative">
                                    <Bell className="h-5 w-5" />
                                    {suitablePositions.length > 0 && (
                                        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-xs font-bold text-destructive-foreground">
                                            {suitablePositions.length}
                                        </span>
                                    )}
                                </Button>
                            </PopoverTrigger>
                            <NotificationPopover positions={suitablePositions} onAddCandidate={handleQuickAddToAssessment} />
                        </Popover>
                        <Link href="/" passHref>
                            <Button variant="outline">Dashboard</Button>
                        </Link>
                        <Link href="/assessment" passHref>
                            <Button>Assessment Tool</Button>
                        </Link>
                    </div>
                </div>
            </header>
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
                             <Button onClick={handleProcessCvs} disabled={cvsToUpload.length === 0 || !jobCode || isProcessing}>
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
                            <CardTitle className="flex items-center gap-2"><Users/> Candidate Records ({filteredCvs.length})</CardTitle>
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
                                {filteredCvs.length > 0 ? filteredCvs.map(cv => {
                                    const suitableCount = suitablePositions.filter(p => p.candidateEmail === cv.email).length;
                                    return (
                                    <AccordionItem value={cv.email} key={cv.email} id={`cv-item-${cv.email}`}>
                                        <div className="flex w-full items-center px-4 hover:bg-muted/50">
                                            <AccordionTrigger className="flex-1 py-3 text-left hover:no-underline [&>svg]:ml-auto">
                                                <div className="grid grid-cols-12 gap-x-4 items-center mr-4 w-full">
                                                    <span className="font-semibold text-primary col-span-3 truncate" title={cv.name}>{cv.name}</span>
                                                    <span className="text-sm text-muted-foreground col-span-3 truncate" title={cv.currentTitle || 'N/A'}>{cv.currentTitle || 'N/A'}</span>
                                                    <span className="text-sm text-muted-foreground col-span-2 truncate" title={cv.currentCompany || 'N/A'}>{cv.currentCompany || 'N/A'}</span>
                                                    <span className="text-sm text-muted-foreground col-span-1 truncate">{cv.totalExperience || 'N/A'}</span>
                                                    <div className="flex items-center gap-2 flex-wrap col-span-3">
                                                        <Badge>{cv.jobCode}</Badge>
                                                        <Badge variant="outline" className="font-normal text-muted-foreground truncate">
                                                            <Clock className="h-3 w-3 mr-1.5" />
                                                            {new Date(cv.createdAt).toLocaleDateString()}
                                                        </Badge>
                                                        {suitableCount > 0 && (
                                                            <TooltipProvider>
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <Badge variant="secondary" className="font-semibold border-primary/50 text-primary cursor-default">
                                                                            <Briefcase className="h-3 w-3 mr-1.5" />
                                                                            {suitableCount} Open Position(s)
                                                                        </Badge>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent>
                                                                        <p>This candidate is a potential fit for {suitableCount} other open position(s). Check the bell icon.</p>
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            </TooltipProvider>
                                                        )}
                                                    </div>
                                                </div>
                                            </AccordionTrigger>
                                            <div className="flex items-center pl-2">
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
                                )}) : (
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
