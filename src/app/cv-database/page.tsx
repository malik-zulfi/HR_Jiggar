
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { FileUp, Bot, Database, User, Mail, Phone, Linkedin, Briefcase, Brain, Search, Clock, Users, Trash2 } from "lucide-react";
import type { CvDatabaseRecord, AssessmentSession } from '@/lib/types';
import { CvDatabaseRecordSchema, AssessmentSessionSchema } from '@/lib/types';
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

const CV_DB_STORAGE_KEY = 'jiggar-cv-database';
const HISTORY_STORAGE_KEY = 'jiggar-history';
type UploadedFile = { name: string; content: string };
type JobCode = 'OCN' | 'WEX' | 'SAN';
type CvProcessingStatus = Record<string, { status: 'processing' | 'done' | 'error', message: string }>;

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

    const suitablePositionsCount = useMemo(() => {
        const countMap = new Map<string, number>();
        if (!history.length || !cvDatabase.length) {
            return countMap;
        }

        const sessionsByJobCode = new Map<string, AssessmentSession[]>();
        history.forEach(session => {
            if (session.analyzedJd.code) {
                const list = sessionsByJobCode.get(session.analyzedJd.code) || [];
                list.push(session);
                sessionsByJobCode.set(session.analyzedJd.code, list);
            }
        });

        cvDatabase.forEach(cv => {
            const potentialSessions = sessionsByJobCode.get(cv.jobCode) || [];
            let suitableCount = 0;
            
            potentialSessions.forEach(session => {
                const isAssessed = session.candidates.some(candidateRecord => {
                    const match = candidateRecord.cvContent.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi);
                    const assessedEmail = match ? match[0].toLowerCase() : null;
                    return assessedEmail === cv.email.toLowerCase();
                });

                if (!isAssessed) {
                    suitableCount++;
                }
            });

            countMap.set(cv.email, suitableCount);
        });

        return countMap;
    }, [cvDatabase, history]);

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
        // Clear the uploader for the next batch
        setCvsToUpload([]);
        setCvResetKey(key => key + 1);

        const newStatus = filesToProcess.reduce((acc, cv) => {
            // Prevent re-adding a file that might be in a different uploader batch but already processing
            if (!processingStatus[cv.name]) {
                acc[cv.name] = { status: 'processing', message: cv.name };
            }
            return acc;
        }, {} as CvProcessingStatus);

        setProcessingStatus(prev => ({ ...prev, ...newStatus }));

        let successCount = 0;

        for (const cv of filesToProcess) {
            try {
                const parsedData = await parseCv({ cvText: cv.content });
                
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

                successCount++;
                setProcessingStatus(prev => ({ ...prev, [cv.name]: { status: 'done', message: parsedData.name } }));
            } catch (error: any) {
                console.error(`Failed to parse ${cv.name}:`, error);
                toast({ variant: 'destructive', title: `Parsing Failed for ${cv.name}`, description: error.message });
                setProcessingStatus(prev => ({ ...prev, [cv.name]: { status: 'error', message: cv.name } }));
            }
        }
        
        if (successCount > 0) {
            toast({ description: `${successCount} CV(s) processed and added/updated in the database.` });
        }
    }, [cvsToUpload, jobCode, toast, processingStatus]);
    
    const handleDeleteCv = (emailToDelete: string) => {
        setCvDatabase(prev => prev.filter(cv => cv.email !== emailToDelete));
        toast({
            description: "Candidate record deleted from the database.",
        });
    };

    useEffect(() => {
        // This effect will run to clean up completed/errored tasks from the display
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
                            <CardDescription>Upload CVs and tag them with a job code to add them to the central database. If a candidate's email already exists, their record will be updated.</CardDescription>
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
                            <Button onClick={handleProcessCvs} disabled={cvsToUpload.length === 0 || !jobCode}>
                                {isProcessing ? (
                                    <><Bot className="mr-2 h-4 w-4" /> Add to Queue</>
                                ) : (
                                    <><Bot className="mr-2 h-4 w-4" /> Process & Add to Database</>
                                )}
                            </Button>
                        </CardFooter>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Users/> Candidate Records ({cvDatabase.length})</CardTitle>
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
                                    const suitableCount = suitablePositionsCount.get(cv.email) || 0;
                                    return (
                                    <AccordionItem value={cv.email} key={cv.email} id={`cv-item-${cv.email}`}>
                                        <div className="flex items-center w-full">
                                            <AccordionTrigger className="flex-1 px-4 py-3 text-left hover:no-underline hover:bg-muted/50">
                                                <div className="flex-1 grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                                                    <span className="font-semibold text-primary col-span-2 md:col-span-1">{cv.name}</span>
                                                    <span className="text-sm text-muted-foreground truncate">{cv.currentTitle || 'N/A'}</span>
                                                    <span className="text-sm text-muted-foreground truncate">{cv.currentCompany || 'N/A'}</span>
                                                    <span className="text-sm text-muted-foreground">{cv.totalExperience || 'N/A'}</span>
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <Badge>{cv.jobCode}</Badge>
                                                        <Badge variant="outline" className="font-normal text-muted-foreground">
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
                                                                        <p>This candidate can be assessed for {suitableCount} other open position(s) with the same job code.</p>
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            </TooltipProvider>
                                                        )}
                                                    </div>
                                                </div>
                                            </AccordionTrigger>
                                            <AlertDialog>
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <AlertDialogTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="mr-4 h-8 w-8 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={(e) => e.stopPropagation()}>
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </AlertDialogTrigger>
                                                        </TooltipTrigger>
                                                        <TooltipContent><p>Delete Candidate</p></TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                                <AlertDialogContent onClick={(e) => e.stopPropagation()}>
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
        </div>
    );
}

