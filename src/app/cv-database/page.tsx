
"use client";

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { FileUp, Bot, Database, User, Mail, Phone, Linkedin, Briefcase, Brain, Search, ChevronDown, Clock, ChevronRight, Users } from "lucide-react";
import type { CvDatabaseRecord } from '@/lib/types';
import { CvDatabaseRecordSchema } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import FileUploader from '@/components/file-uploader';
import { parseCv } from '@/ai/flows/cv-parser';
import ProgressLoader from '@/components/progress-loader';
import { Input } from '@/components/ui/input';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import CvDisplay from '@/components/cv-display';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const CV_DB_STORAGE_KEY = 'jiggar-cv-database';
type UploadedFile = { name: string; content: string };
type JobCode = 'OCN' | 'WEX' | 'SAN';
type CvProcessingStatus = Record<string, { status: 'processing' | 'done' | 'error', message: string }>;

export default function CvDatabasePage() {
    const { toast } = useToast();
    const [isClient, setIsClient] = useState(false);
    const [cvDatabase, setCvDatabase] = useState<CvDatabaseRecord[]>([]);
    const [cvsToUpload, setCvsToUpload] = useState<UploadedFile[]>([]);
    const [jobCode, setJobCode] = useState<JobCode | null>(null);
    const [processingStatus, setProcessingStatus] = useState<CvProcessingStatus>({});
    const [searchTerm, setSearchTerm] = useState("");
    const [cvResetKey, setCvResetKey] = useState(0);

    useEffect(() => {
        setIsClient(true);
        try {
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
        } catch (error) {
            console.error("Failed to load CV database from localStorage", error);
        }
    }, []);

    useEffect(() => {
        if (isClient) {
            localStorage.setItem(CV_DB_STORAGE_KEY, JSON.stringify(cvDatabase));
        }
    }, [cvDatabase, isClient]);

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
        setCvsToUpload(files);
    };

    const handleCvClear = () => {
        setCvsToUpload([]);
    };
    
    const isProcessing = Object.keys(processingStatus).length > 0;

    const handleProcessCvs = async () => {
        if (cvsToUpload.length === 0) {
            toast({ variant: 'destructive', description: 'Please upload at least one CV.' });
            return;
        }
        if (!jobCode) {
            toast({ variant: 'destructive', description: 'Please select a job code.' });
            return;
        }

        const initialStatus = cvsToUpload.reduce((acc, cv) => {
            acc[cv.name] = { status: 'processing', message: cv.name };
            return acc;
        }, {} as CvProcessingStatus);
        setProcessingStatus(initialStatus);

        const newRecords: CvDatabaseRecord[] = [];
        let errorCount = 0;

        for (const cv of cvsToUpload) {
            try {
                const parsedData = await parseCv({ cvText: cv.content });
                
                const record: CvDatabaseRecord = {
                    ...parsedData,
                    jobCode,
                    cvFileName: cv.name,
                    cvContent: cv.content,
                    createdAt: new Date().toISOString(),
                };
                newRecords.push(record);
                setProcessingStatus(prev => ({ ...prev, [cv.name]: { status: 'done', message: parsedData.name } }));
            } catch (error: any) {
                errorCount++;
                console.error(`Failed to parse ${cv.name}:`, error);
                toast({ variant: 'destructive', title: `Parsing Failed for ${cv.name}`, description: error.message });
                setProcessingStatus(prev => ({ ...prev, [cv.name]: { status: 'error', message: cv.name } }));
            }
        }
        
        setCvDatabase(prevDb => {
            const dbMap = new Map(prevDb.map(cv => [cv.email, cv]));
            newRecords.forEach(rec => dbMap.set(rec.email, rec));
            const sortedDb = Array.from(dbMap.values()).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            return sortedDb;
        });
        
        const successCount = newRecords.length;
        if (successCount > 0) {
            toast({ description: `${successCount} CV(s) processed and added/updated in the database.` });
        }
        if (errorCount === 0) {
             setTimeout(() => {
                setProcessingStatus({});
                setCvsToUpload([]);
                setJobCode(null);
                setCvResetKey(key => key + 1);
            }, 2000);
        } else {
            // Keep loader visible to show errors
             setTimeout(() => {
                setProcessingStatus({});
             }, 5000);
        }
    };
    
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
                        <CardContent>
                            {isProcessing ? (
                                <ProgressLoader title="Processing CVs..." statusList={Object.values(processingStatus)} />
                            ) : (
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
                            )}
                        </CardContent>
                        {!isProcessing && (
                            <CardFooter>
                                <Button onClick={handleProcessCvs} disabled={cvsToUpload.length === 0 || !jobCode}>
                                    <Bot className="mr-2 h-4 w-4" />
                                    Process and Add to Database
                                </Button>
                            </CardFooter>
                        )}
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
                            
                            <Accordion type="single" collapsible className="w-full border rounded-md">
                                {filteredCvs.length > 0 ? filteredCvs.map(cv => (
                                    <AccordionItem value={cv.email} key={cv.email}>
                                        <AccordionTrigger className="px-4 py-3 text-left hover:no-underline hover:bg-muted/50">
                                            <div className="flex-1 grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                                                <span className="font-semibold text-primary col-span-2 md:col-span-1">{cv.name}</span>
                                                <span className="text-sm text-muted-foreground truncate">{cv.currentTitle || 'N/A'}</span>
                                                <span className="text-sm text-muted-foreground truncate">{cv.currentCompany || 'N/A'}</span>
                                                <span className="text-sm text-muted-foreground">{cv.totalExperience || 'N/A'}</span>
                                                <div className="flex items-center gap-2">
                                                    <Badge>{cv.jobCode}</Badge>
                                                    <Badge variant="outline" className="font-normal text-muted-foreground">
                                                        <Clock className="h-3 w-3 mr-1.5" />
                                                        {new Date(cv.createdAt).toLocaleDateString()}
                                                    </Badge>
                                                </div>
                                            </div>
                                            <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 ml-4" />
                                        </AccordionTrigger>
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
                                        No candidates found matching your search.
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

    