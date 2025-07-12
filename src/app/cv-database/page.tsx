
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { FileUp, Bot, Database, User, Mail, Phone, Linkedin, Briefcase, Search, Clock, Trash2, Wand2, Loader2, X, PlusCircle, ArrowUpDown, AlertTriangle, ListFilter } from "lucide-react";
import type { CvDatabaseRecord, AssessmentSession, SuitablePosition, CandidateRecord } from '@/lib/types';
import { CvDatabaseRecordSchema, AssessmentSessionSchema, ParseCvOutput } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import FileUploader from '@/components/file-uploader';
import { parseCv } from '@/ai/flows/cv-parser';
import ProgressLoader from '@/components/progress-loader';
import { Input } from "@/components/ui/input";
import CvDisplay from '@/components/cv-display';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { findSuitablePositionsForCandidate } from '@/ai/flows/find-suitable-positions';
import { Header } from '@/components/header';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';


const CV_DB_STORAGE_KEY = 'jiggar-cv-database';
const HISTORY_STORAGE_KEY = 'jiggar-history';
const SUITABLE_POSITIONS_KEY = 'jiggar-suitable-positions';
const ACTIVE_SESSION_STORAGE_KEY = 'jiggar-active-session';
const RELEVANCE_CHECK_ENABLED_KEY = 'jiggar-relevance-check-enabled';
const PENDING_ASSESSMENT_KEY = 'jiggar-pending-assessment';


type UploadedFile = { name: string; content: string };
type JobCode = 'OCN' | 'WEX' | 'SAN';
type CvProcessingStatus = Record<string, { status: 'processing' | 'done' | 'error', message: string }>;
type Conflict = {
    newRecord: ParseCvOutput & { cvFileName: string; cvContent: string; jobCode: JobCode; };
    existingRecord: CvDatabaseRecord;
};
type RelevanceCheckStatus = Record<string, boolean>;
type SortDescriptor = { column: 'name' | 'totalExperience' | 'createdAt'; direction: 'ascending' | 'descending'; };
type CandidateAssessmentInfo = {
    sessionId: string;
    sessionName: string;
    jobTitle: string;
    score: number;
};

export default function CvDatabasePage() {
    const { toast } = useToast();
    const router = useRouter();
    const [isClient, setIsClient] = useState(false);
    const [cvDatabase, setCvDatabase] = useState<CvDatabaseRecord[]>([]);
    const [history, setHistory] = useState<AssessmentSession[]>([]);
    const [cvsToUpload, setCvsToUpload] = useState<UploadedFile[]>([]);
    const [jobCode, setJobCode] = useState<JobCode | null>(null);
    const [processingStatus, setProcessingStatus] = useState<CvProcessingStatus>({});
    const [searchTerm, setSearchTerm] = useState("");
    const [cvResetKey, setCvResetKey] = useState(0);
    const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({ column: 'createdAt', direction: 'descending' });
    
    const [conflictQueue, setConflictQueue] = useState<Conflict[]>([]);
    const [currentConflict, setCurrentConflict] = useState<Conflict | null>(null);
    
    const [suitablePositions, setSuitablePositions] = useState<SuitablePosition[]>([]);
    const [relevanceCheckStatus, setRelevanceCheckStatus] = useState<RelevanceCheckStatus>({});
    const [isRelevanceCheckEnabled, setIsRelevanceCheckEnabled] = useState(false);
    
    const [selectedCv, setSelectedCv] = useState<CvDatabaseRecord | null>(null);
    const [selectedCvEmails, setSelectedCvEmails] = useState<Set<string>>(new Set());

    const sortedAndFilteredCvs = useMemo(() => {
        const filtered = searchTerm.trim() 
            ? cvDatabase.filter(cv => 
                cv.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                cv.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                cv.jobCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
                cv.currentTitle?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                cv.currentCompany?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                cv.structuredContent.skills?.some(s => s.toLowerCase().includes(searchTerm.toLowerCase()))
              ) 
            : cvDatabase;

        return [...filtered].sort((a, b) => {
            const aVal = a[sortDescriptor.column];
            const bVal = b[sortDescriptor.column];

            // Handle experience sorting (string to number)
            if (sortDescriptor.column === 'totalExperience') {
                const aYears = parseFloat(a.totalExperience || '0');
                const bYears = parseFloat(b.totalExperience || '0');
                return sortDescriptor.direction === 'ascending' ? aYears - bYears : bYears - aYears;
            }

            if (aVal === null || aVal === undefined) return 1;
            if (bVal === null || bVal === undefined) return -1;
            
            const comparison = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
            return sortDescriptor.direction === 'ascending' ? comparison : -comparison;
        });
    }, [cvDatabase, searchTerm, sortDescriptor]);
    
    const assessmentMap = useMemo(() => {
        const map = new Map<string, CandidateAssessmentInfo[]>();
        if (cvDatabase.length === 0 || history.length === 0) {
            return map;
        }

        history.forEach(session => {
            session.candidates.forEach(candidate => {
                let email = candidate.analysis.email?.toLowerCase();
                if (!email) {
                    const dbRecord = cvDatabase.find(cv => cv.name.toLowerCase() === candidate.analysis.candidateName.toLowerCase());
                    if (dbRecord) {
                        email = dbRecord.email.toLowerCase();
                    }
                }

                if (email) {
                    if (!map.has(email)) {
                        map.set(email, []);
                    }
                    map.get(email)!.push({
                        sessionId: session.id,
                        sessionName: session.jdName,
                        jobTitle: session.analyzedJd.jobTitle || 'N/A',
                        score: candidate.analysis.alignmentScore,
                    });
                }
            });
        });
        return map;
    }, [history, cvDatabase]);

    const handleSort = (column: SortDescriptor['column']) => {
        if (sortDescriptor.column === column) {
            setSortDescriptor({
                ...sortDescriptor,
                direction: sortDescriptor.direction === 'ascending' ? 'descending' : 'ascending'
            });
        } else {
            setSortDescriptor({ column, direction: 'descending' });
        }
    };


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
            let cvsFromStorage: CvDatabaseRecord[] = [];
            if (savedCvDbJSON) {
                const parsedCvDb = JSON.parse(savedCvDbJSON);
                if (Array.isArray(parsedCvDb)) {
                    cvsFromStorage = parsedCvDb.map(record => {
                        const result = CvDatabaseRecordSchema.safeParse(record);
                        if (result.success) {
                            result.data.name = toTitleCase(result.data.name);
                        }
                        return result.success ? result.data : null;
                    }).filter((r): r is CvDatabaseRecord => r !== null);
                    setCvDatabase(cvsFromStorage.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
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
                const cvToOpen = cvsFromStorage.find(cv => cv.email === emailToOpen);
                if (cvToOpen) {
                    setSelectedCv(cvToOpen);
                }
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
            if (history.length > 0) {
                localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
            } else {
                localStorage.removeItem(HISTORY_STORAGE_KEY);
            }
        }
    }, [history, isClient]);

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

        setRelevanceCheckStatus(prev => ({ ...prev, [candidate.email]: true }));
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
            setRelevanceCheckStatus(prev => ({ ...prev, [candidate.email]: false }));
        }
    }, [isRelevanceCheckEnabled, history, suitablePositions, toast]);
    
    const toTitleCase = (str: string): string => {
        if (!str) return '';
        return str
          .toLowerCase()
          .split(/[\s-]+/)
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
    }

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
    
    const handleDeleteCv = (emailsToDelete: string[]) => {
        if (emailsToDelete.length === 0) return;

        const emailsToDeleteSet = new Set(emailsToDelete.map(e => e.toLowerCase()));
        
        // Remove from CV Database
        setCvDatabase(prev => prev.filter(cv => !emailsToDeleteSet.has(cv.email.toLowerCase())));

        // Remove from all assessments in history
        setHistory(prevHistory => {
            return prevHistory.map(session => {
                const updatedCandidates = session.candidates.filter(candidate => {
                    const candidateEmail = candidate.analysis.email?.toLowerCase();
                    if (candidateEmail) {
                        return !emailsToDeleteSet.has(candidateEmail);
                    }
                    // Fallback for older data without email in analysis
                    const dbRecord = cvDatabase.find(cv => cv.name.toLowerCase() === candidate.analysis.candidateName.toLowerCase());
                    if (dbRecord) {
                        return !emailsToDeleteSet.has(dbRecord.email.toLowerCase());
                    }
                    return true;
                });
                return { ...session, candidates: updatedCandidates, summary: updatedCandidates.length > 0 ? session.summary : null };
            });
        });
        
        setSelectedCvEmails(new Set());

        toast({
            description: `${emailsToDelete.length} candidate record(s) deleted from the database and all assessments.`,
        });
    };

    const handleQuickAddToAssessment = useCallback(async (candidates: CvDatabaseRecord[], assessment: AssessmentSession) => {
        if (candidates.length === 0) return;
        toast({ description: `Adding ${candidates.length} candidate(s) to "${assessment.analyzedJd.jobTitle}"...` });
        
        const pendingQueue = candidates.map(candidate => ({ candidate, assessment }));

        localStorage.setItem(PENDING_ASSESSMENT_KEY, JSON.stringify(pendingQueue));
        localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, assessment.id);
        router.push('/assessment');
    }, [router, toast]);
    
    const handleAddFromPopover = async (candidate: CvDatabaseRecord, assessment: AssessmentSession, closePopover: () => void) => {
        closePopover();
        await handleQuickAddToAssessment([candidate], assessment);
    };

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
    
    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedCvEmails(new Set(sortedAndFilteredCvs.map(cv => cv.email)));
        } else {
            setSelectedCvEmails(new Set());
        }
    };

    const handleSelectOne = (email: string, checked: boolean) => {
        setSelectedCvEmails(prev => {
            const newSet = new Set(prev);
            if (checked) {
                newSet.add(email);
            } else {
                newSet.delete(email);
            }
            return newSet;
        });
    };
    
    if (!isClient) return null;

    return (
        <div className="flex flex-col min-h-screen bg-secondary/40">
            <Header
                activePage="cv-database"
                notificationCount={isRelevanceCheckEnabled ? suitablePositions.length : 0}
                suitablePositions={isRelevanceCheckEnabled ? suitablePositions : []}
                onAddCandidate={(position) => {
                    const candidate = cvDatabase.find(c => c.email === position.candidateEmail);
                    if (candidate) handleQuickAddToAssessment([candidate], position.assessment);
                }}
                isRelevanceCheckEnabled={isRelevanceCheckEnabled}
                onRelevanceCheckToggle={handleRelevanceToggle}
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
                            <CardTitle className="flex items-center gap-2"><Database/> Candidate Records ({cvDatabase.length})</CardTitle>
                             <div className="flex justify-between items-center gap-4">
                                <CardDescription>Browse, search, and manage all candidates in the database.</CardDescription>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <div className="relative w-full max-w-xs">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input 
                                            placeholder="Search database..."
                                            className="pl-9"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                        />
                                    </div>
                                    {selectedCvEmails.size > 0 && (
                                        <BulkActions
                                            selectedEmails={Array.from(selectedCvEmails)}
                                            candidates={cvDatabase}
                                            assessments={history}
                                            toast={toast}
                                            onDelete={handleDeleteCv}
                                            onAddToAssessment={handleQuickAddToAssessment}
                                            onClear={() => setSelectedCvEmails(new Set())}
                                        />
                                    )}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="border rounded-md">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-12 px-3">
                                                <Checkbox
                                                  checked={selectedCvEmails.size > 0 && selectedCvEmails.size === sortedAndFilteredCvs.length}
                                                  indeterminate={selectedCvEmails.size > 0 && selectedCvEmails.size < sortedAndFilteredCvs.length}
                                                  onCheckedChange={(checked) => handleSelectAll(!!checked)}
                                                />
                                            </TableHead>
                                            <TableHead className="w-12">Status</TableHead>
                                            <TableHead onClick={() => handleSort('name')} className="w-1/4">
                                                <div className="flex items-center gap-2 cursor-pointer">Name <ArrowUpDown className="h-4 w-4" /></div>
                                            </TableHead>
                                            <TableHead className="w-1/4">Current Position</TableHead>
                                            <TableHead onClick={() => handleSort('totalExperience')} className="w-[15%]">
                                                <div className="flex items-center gap-2 cursor-pointer">Experience <ArrowUpDown className="h-4 w-4" /></div>
                                            </TableHead>
                                            <TableHead>Job Code</TableHead>
                                            <TableHead onClick={() => handleSort('createdAt')} className="w-[15%]">
                                                <div className="flex items-center gap-2 cursor-pointer">Date Added <ArrowUpDown className="h-4 w-4" /></div>
                                            </TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {sortedAndFilteredCvs.length > 0 ? sortedAndFilteredCvs.map(cv => {
                                            const isChecking = relevanceCheckStatus[cv.email];
                                            const candidateAssessments = assessmentMap.get(cv.email.toLowerCase()) || [];
                                            const count = candidateAssessments.length;
                                            return (
                                                <TableRow 
                                                  key={cv.email}
                                                  data-state={selectedCvEmails.has(cv.email) ? 'selected' : ''}
                                                >
                                                    <TableCell className="px-3">
                                                        <Checkbox
                                                            checked={selectedCvEmails.has(cv.email)}
                                                            onCheckedChange={(checked) => handleSelectOne(cv.email, !!checked)}
                                                            onClick={(e) => e.stopPropagation()}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Popover>
                                                            <PopoverTrigger asChild disabled={count === 0} onClick={(e) => e.stopPropagation()}>
                                                                <div className={cn("flex items-center", count > 0 && "cursor-pointer")}>
                                                                    <span className={cn("text-2xl", count > 0 ? "text-green-500" : "text-red-500")}>•</span>
                                                                    {count > 0 && <sup className="font-bold text-xs -ml-1 text-muted-foreground">{count}</sup>}
                                                                </div>
                                                            </PopoverTrigger>
                                                            {count > 0 && (
                                                                <PopoverContent className="w-96 p-2">
                                                                    <div className="space-y-1 mb-2 p-2">
                                                                        <h4 className="font-medium leading-none">Assessments for {cv.name}</h4>
                                                                        <p className="text-sm text-muted-foreground">Quick links to view assessments.</p>
                                                                    </div>
                                                                    <div className="max-h-60 overflow-y-auto">
                                                                        {candidateAssessments.map(a => (
                                                                            <Link key={a.sessionId} href="/assessment" onClick={() => localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, a.sessionId)}>
                                                                                <div className="p-2 rounded-md hover:bg-secondary flex justify-between items-center">
                                                                                    <div className="flex flex-col">
                                                                                        <span className="font-semibold text-sm truncate">{a.jobTitle}</span>
                                                                                        <span className="text-xs text-muted-foreground truncate">{a.sessionName}</span>
                                                                                    </div>
                                                                                    <Badge variant={a.score >= 75 ? "default" : a.score >= 40 ? "secondary" : "destructive"}>{a.score}%</Badge>
                                                                                </div>
                                                                            </Link>
                                                                        ))}
                                                                    </div>
                                                                </PopoverContent>
                                                            )}
                                                        </Popover>
                                                    </TableCell>
                                                    <TableCell className="font-medium text-primary truncate cursor-pointer" title={cv.name} onClick={() => setSelectedCv(cv)}>
                                                        {cv.name}
                                                    </TableCell>
                                                    <TableCell className="truncate" title={cv.currentTitle || 'N/A'}>
                                                        {cv.currentTitle || 'N/A'}
                                                    </TableCell>
                                                    <TableCell>{cv.totalExperience || 'N/A'}</TableCell>
                                                    <TableCell><Badge variant="secondary">{cv.jobCode}</Badge></TableCell>
                                                    <TableCell>{new Date(cv.createdAt).toLocaleDateString()}</TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex items-center justify-end gap-1">
                                                             <AddCandidatePopover
                                                                candidate={cv}
                                                                assessments={assessmentMap.get(cv.email.toLowerCase()) || []}
                                                                allAssessments={history}
                                                                onAdd={handleAddFromPopover}
                                                            />
                                                            <AlertDialog>
                                                                <AlertDialogTrigger asChild>
                                                                    <TooltipProvider>
                                                                        <Tooltip>
                                                                            <TooltipTrigger asChild>
                                                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={(e) => e.stopPropagation()}>
                                                                                    <Trash2 className="h-4 w-4" />
                                                                                </Button>
                                                                            </TooltipTrigger>
                                                                            <TooltipContent><p>Delete Candidate</p></TooltipContent>
                                                                        </Tooltip>
                                                                    </TooltipProvider>
                                                                </AlertDialogTrigger>
                                                                <AlertDialogContent>
                                                                    <AlertDialogHeader>
                                                                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                                        <AlertDialogDescription>
                                                                            This action cannot be undone. This will permanently delete the record for <span className="font-bold">{cv.name}</span> and remove them from all assessments.
                                                                        </AlertDialogDescription>
                                                                    </AlertDialogHeader>
                                                                    <AlertDialogFooter>
                                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                        <AlertDialogAction onClick={() => handleDeleteCv([cv.email])} className={cn(Button, "bg-destructive hover:bg-destructive/90")}>
                                                                            Delete
                                                                        </AlertDialogAction>
                                                                    </AlertDialogFooter>
                                                                </AlertDialogContent>
                                                            </AlertDialog>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        }) : (
                                            <TableRow>
                                                <TableCell colSpan={8} className="h-24 text-center">
                                                    {cvDatabase.length > 0 ? "No candidates found matching your search." : "No candidates in the database yet."}
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </main>
            
            <Sheet open={!!selectedCv} onOpenChange={(isOpen) => { if (!isOpen) setSelectedCv(null); }}>
                {selectedCv && (
                    <SheetContent className="w-full sm:max-w-3xl overflow-y-auto">
                        <SheetHeader className="pr-10">
                            <SheetTitle className="text-2xl">{selectedCv.name}</SheetTitle>
                            <SheetDescription>
                                {selectedCv.currentTitle} at {selectedCv.currentCompany}
                            </SheetDescription>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm pt-2">
                                <div className="flex items-center gap-2 text-muted-foreground"><Mail className="w-4 h-4"/>{selectedCv.email}</div>
                                <div className="flex items-center gap-2 text-muted-foreground"><Phone className="w-4 h-4"/>{selectedCv.contactNumber || 'N/A'}</div>
                                {selectedCv.linkedinUrl && <div className="flex items-center gap-2 text-muted-foreground"><Linkedin className="w-4 h-4"/><a href={selectedCv.linkedinUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">LinkedIn Profile</a></div>}
                            </div>
                        </SheetHeader>
                        <div className="py-6">
                            <CvDisplay structuredContent={selectedCv.structuredContent} />
                        </div>
                    </SheetContent>
                )}
            </Sheet>

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

const AddCandidatePopover = ({ candidate, assessments, allAssessments, onAdd }: {
    candidate: CvDatabaseRecord;
    assessments: CandidateAssessmentInfo[];
    allAssessments: AssessmentSession[];
    onAdd: (candidate: CvDatabaseRecord, assessment: AssessmentSession, closePopover: () => void) => void;
}) => {
    const [isOpen, setIsOpen] = useState(false);
    
    const compatibleAssessments = useMemo(() => {
        const assessedSessionIds = new Set(assessments.map(a => a.sessionId));
        return allAssessments.filter(session =>
            session.analyzedJd.code === candidate.jobCode && !assessedSessionIds.has(session.id)
        );
    }, [candidate, assessments, allAssessments]);

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <PopoverTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-primary/10 hover:text-primary">
                                <PlusCircle className="h-4 w-4" />
                            </Button>
                        </PopoverTrigger>
                    </TooltipTrigger>
                    <TooltipContent><p>Add to an assessment</p></TooltipContent>
                </Tooltip>
            </TooltipProvider>
            <PopoverContent className="w-80 p-2">
                <div className="grid gap-4">
                    <div className="space-y-1">
                        <h4 className="font-medium leading-none">Add <span className="text-primary">{candidate.name}</span> to...</h4>
                        <p className="text-sm text-muted-foreground">
                            Showing compatible assessments.
                        </p>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                        {compatibleAssessments.length > 0 ? (
                            compatibleAssessments.map(session => (
                                <button
                                    key={session.id}
                                    onClick={() => onAdd(candidate, session, () => setIsOpen(false))}
                                    className="w-full text-left p-2 rounded-md hover:bg-secondary flex flex-col"
                                >
                                    <span className="font-medium truncate">{session.analyzedJd.jobTitle}</span>
                                    <span className="text-xs text-muted-foreground">{session.jdName}</span>
                                </button>
                            ))
                        ) : (
                            <p className="p-2 text-sm text-center text-muted-foreground">No compatible unassessed positions found.</p>
                        )}
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
};
    
const BulkActions = ({ selectedEmails, candidates, assessments, toast, onDelete, onAddToAssessment, onClear }: {
    selectedEmails: string[];
    candidates: CvDatabaseRecord[];
    assessments: AssessmentSession[];
    toast: (options: { description: string, title?: string, variant?: 'default' | 'destructive' }) => void;
    onDelete: (emails: string[]) => void;
    onAddToAssessment: (candidates: CvDatabaseRecord[], assessment: AssessmentSession) => void;
    onClear: () => void;
}) => {
    const [isOpen, setIsOpen] = useState(false);
    
    const selectedCount = selectedEmails.length;
    const selectedCandidates = candidates.filter(c => selectedEmails.includes(c.email));
    
    // Find assessments that *all* selected candidates could potentially be added to.
    const commonAssessments = useMemo(() => {
        if (selectedCandidates.length === 0) return [];
        
        const firstCandidateJobCode = selectedCandidates[0].jobCode;
        if (!selectedCandidates.every(c => c.jobCode === firstCandidateJobCode)) {
            return []; // Return empty if job codes are mixed
        }
        
        return assessments.filter(session => {
            if (session.analyzedJd.code !== firstCandidateJobCode) return false;
            
            // Check if *any* of the selected candidates are already in this session
            const sessionEmails = new Set(session.candidates.map(c => c.analysis.email?.toLowerCase()).filter(Boolean));
            return !selectedCandidates.some(sel => sessionEmails.has(sel.email.toLowerCase()));
        });

    }, [selectedCandidates, assessments]);

    const handleBulkAdd = (assessment: AssessmentSession) => {
        onAddToAssessment(selectedCandidates, assessment);
        onClear();
        setIsOpen(false);
    };

    return (
        <div className="flex items-center gap-2 border-l pl-2">
            <span className="text-sm font-medium">{selectedCount} selected</span>
            
            <Popover open={isOpen} onOpenChange={setIsOpen}>
                <PopoverTrigger asChild>
                    <Button variant="outline"><PlusCircle className="mr-2 h-4 w-4" /> Add to Assessment</Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-2">
                    <div className="grid gap-4">
                        <div className="space-y-1">
                            <h4 className="font-medium leading-none">Add {selectedCount} Candidates to...</h4>
                            <p className="text-sm text-muted-foreground">
                                {commonAssessments.length > 0 
                                    ? "Showing assessments compatible with all selected candidates." 
                                    : "Selected candidates have mixed job codes or are already in all compatible assessments."}
                            </p>
                        </div>
                        <div className="max-h-64 overflow-y-auto">
                            {commonAssessments.length > 0 ? (
                                commonAssessments.map(session => (
                                    <button
                                        key={session.id}
                                        onClick={() => handleBulkAdd(session)}
                                        className="w-full text-left p-2 rounded-md hover:bg-secondary flex flex-col"
                                    >
                                        <span className="font-medium truncate">{session.analyzedJd.jobTitle}</span>
                                        <span className="text-xs text-muted-foreground">{session.jdName}</span>
                                    </button>
                                ))
                            ) : (
                                <p className="p-2 text-sm text-center text-muted-foreground">No common assessments found.</p>
                            )}
                        </div>
                    </div>
                </PopoverContent>
            </Popover>

            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete the selected {selectedCount} candidate(s) and remove them from all assessments. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => onDelete(selectedEmails)} className={cn(Button, "bg-destructive hover:bg-destructive/90")}>
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
             <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClear}>
                <X className="h-4 w-4"/>
            </Button>
        </div>
    );
};
