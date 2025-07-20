
"use client";

import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAppContext, type ImportedData, type ImportMode } from './client-provider';
import type { AssessmentSession, CvDatabaseRecord } from '@/lib/types';
import { AlertCircle, ArrowRight, CheckCircle, FileUp, Database, GanttChartSquare, RefreshCw, Undo2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from './ui/card';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Label } from './ui/label';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';

type Conflict = {
  type: 'assessment' | 'candidate';
  id: string; // session id or candidate email
  name: string;
  existing: AssessmentSession | CvDatabaseRecord;
  incoming: AssessmentSession | CvDatabaseRecord;
  resolution: 'keep' | 'replace';
};

interface ImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  importedData: ImportedData | null;
}

export default function ImportDialog({ isOpen, onClose, importedData }: ImportDialogProps) {
    const { toast } = useToast();
    const { history, cvDatabase, handleBulkImport } = useAppContext();
    const [step, setStep] = useState<'options' | 'conflicts' | 'summary'>('options');
    const [importMode, setImportMode] = useState<ImportMode>('append');
    
    const [conflicts, setConflicts] = useState<Conflict[]>([]);
    const [resolvedData, setResolvedData] = useState<ImportedData | null>(null);

    useEffect(() => {
        if (!isOpen) {
            // Reset state when dialog is closed
            setTimeout(() => {
                setStep('options');
                setImportMode('append');
                setConflicts([]);
                setResolvedData(null);
            }, 300);
        }
    }, [isOpen]);
    
    const conflictsAnalysis = useMemo(() => {
        if (!importedData) return { assessmentConflicts: [], cvConflicts: [] };
        
        const existingSessionIds = new Set(history.map(s => s.id));
        const assessmentConflicts = importedData.history
          .filter(s => existingSessionIds.has(s.id))
          .map(s => ({
            type: 'assessment' as const,
            id: s.id,
            name: s.analyzedJd.jobTitle || s.jdName,
            existing: history.find(e => e.id === s.id)!,
            incoming: s,
            resolution: 'keep' as const,
          }));

        const existingCvEmails = new Set(cvDatabase.map(c => c.email));
        const cvConflicts = importedData.cvDatabase
          .filter(c => existingCvEmails.has(c.email))
          .map(c => ({
            type: 'candidate' as const,
            id: c.email,
            name: c.name,
            existing: cvDatabase.find(e => e.email === c.email)!,
            incoming: c,
            resolution: 'keep' as const,
          }));

        return { assessmentConflicts, cvConflicts };
    }, [importedData, history, cvDatabase]);
    
    const summaryData = useMemo(() => {
        if (!importedData) return null;

        if (importMode === 'replace') {
            return {
                assessments: { new: importedData.history.length, replaced: 0, kept: 0 },
                candidates: { new: importedData.cvDatabase.length, replaced: 0, kept: 0 },
            }
        }
        
        // Append mode
        const newAssessments = importedData.history.filter(s => !conflicts.some(c => c.type === 'assessment' && c.id === s.id));
        const assessmentsToReplace = conflicts.filter(c => c.type === 'assessment' && c.resolution === 'replace').length;
        const assessmentsToKeep = conflicts.filter(c => c.type === 'assessment' && c.resolution === 'keep').length;
        
        const newCandidates = importedData.cvDatabase.filter(c => !conflicts.some(conflict => conflict.type === 'candidate' && conflict.id === c.email));
        const candidatesToReplace = conflicts.filter(c => c.type === 'candidate' && c.resolution === 'replace').length;
        const candidatesToKeep = conflicts.filter(c => c.type === 'candidate' && c.resolution === 'keep').length;
        
        return {
            assessments: { new: newAssessments.length, replaced: assessmentsToReplace, kept: assessmentsToKeep },
            candidates: { new: newCandidates.length, replaced: candidatesToReplace, kept: candidatesToKeep },
        };
    }, [importedData, importMode, conflicts]);


    const handleNext = () => {
        if (importMode === 'append') {
            const allConflicts = [...conflictsAnalysis.assessmentConflicts, ...conflictsAnalysis.cvConflicts];
            if (allConflicts.length > 0) {
                setConflicts(allConflicts);
                setStep('conflicts');
            } else {
                setResolvedData(importedData);
                setStep('summary');
            }
        } else { // Replace mode
            setStep('summary');
        }
    };
    
    const handleConflictResolution = (id: string, resolution: 'keep' | 'replace') => {
        setConflicts(prev => prev.map(c => c.id === id ? { ...c, resolution } : c));
    };

    const handleResolveConflicts = () => {
        if (!importedData) return;

        const finalHistory = [...history];
        const finalCvDatabase = [...cvDatabase];

        // Replace items marked for replacement
        conflicts.forEach(conflict => {
            if (conflict.resolution === 'replace') {
                if (conflict.type === 'assessment') {
                    const index = finalHistory.findIndex(s => s.id === conflict.id);
                    if (index !== -1) finalHistory[index] = conflict.incoming as AssessmentSession;
                } else {
                    const index = finalCvDatabase.findIndex(c => c.email === conflict.id);
                    if (index !== -1) finalCvDatabase[index] = conflict.incoming as CvDatabaseRecord;
                }
            }
        });

        // Add new items
        const newHistory = importedData.history.filter(s => !history.some(e => e.id === s.id));
        const newCvs = importedData.cvDatabase.filter(c => !cvDatabase.some(e => e.email === c.email));
        
        setResolvedData({
            history: [...finalHistory, ...newHistory],
            cvDatabase: [...finalCvDatabase, ...newCvs],
            suitablePositions: [] // Positions are too complex to merge, just start fresh
        });
        setStep('summary');
    };
    
    const handleConfirmImport = () => {
        let dataToImport: ImportedData;

        if (importMode === 'replace') {
            dataToImport = importedData!;
        } else {
            // Re-calculate the final state from resolutions
            const finalHistoryMap = new Map(history.map(s => [s.id, s]));
            const finalCvMap = new Map(cvDatabase.map(c => [c.email, c]));
            
            conflicts.forEach(conflict => {
                if (conflict.resolution === 'replace') {
                    if (conflict.type === 'assessment') {
                        finalHistoryMap.set(conflict.id, conflict.incoming as AssessmentSession);
                    } else {
                        finalCvMap.set(conflict.id, conflict.incoming as CvDatabaseRecord);
                    }
                }
            });
            
            importedData?.history.forEach(s => {
                if (!finalHistoryMap.has(s.id)) finalHistoryMap.set(s.id, s);
            });
            importedData?.cvDatabase.forEach(c => {
                if (!finalCvMap.has(c.email)) finalCvMap.set(c.email, c);
            });

            // For notifications, simply append new ones and filter duplicates
            const existingKeys = new Set(suitablePositions.map(p => `${p.candidateEmail}-${p.assessment.id}`));
            const newPositions = importedData?.suitablePositions.filter(p => !existingKeys.has(`${p.candidateEmail}-${p.assessment.id}`)) || [];

            dataToImport = {
                history: Array.from(finalHistoryMap.values()),
                cvDatabase: Array.from(finalCvMap.values()),
                suitablePositions: [...suitablePositions, ...newPositions]
            };
        }

        // Call the context function to update global state
        handleBulkImport(dataToImport, importMode);
        onClose();
        toast({ title: 'Import Successful', description: 'Your data has been updated.' });
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-lg md:max-w-xl lg:max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2"><FileUp /> Import Data</DialogTitle>
                    <DialogDescription>
                        {step === 'options' && 'Choose how to import the data from your backup file.'}
                        {step === 'conflicts' && 'Some items in your file conflict with existing data. Choose how to handle them.'}
                        {step === 'summary' && 'Review the changes that will be made before confirming the import.'}
                    </DialogDescription>
                </DialogHeader>
                
                {step === 'options' && (
                    <div>
                        <RadioGroup value={importMode} onValueChange={(v) => setImportMode(v as ImportMode)} className="my-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Label htmlFor="mode-append" className={cn("p-4 border rounded-md cursor-pointer hover:border-primary", importMode === 'append' && 'border-primary ring-2 ring-primary')}>
                                <RadioGroupItem value="append" id="mode-append" className="sr-only" />
                                <h3 className="font-semibold mb-1">Append to Existing Data</h3>
                                <p className="text-xs text-muted-foreground">Adds new assessments and candidates. If any conflicts are found, you will be asked how to handle them.</p>
                            </Label>
                             <Label htmlFor="mode-replace" className={cn("p-4 border rounded-md cursor-pointer hover:border-primary", importMode === 'replace' && 'border-primary ring-2 ring-primary')}>
                                <RadioGroupItem value="replace" id="mode-replace" className="sr-only" />
                                <h3 className="font-semibold mb-1">Replace All Data</h3>
                                <p className="text-xs text-muted-foreground">Deletes all current data and replaces it with the content from the backup file. This cannot be undone.</p>
                            </Label>
                        </RadioGroup>
                    </div>
                )}
                
                {step === 'conflicts' && (
                    <div className="space-y-4">
                        <ScrollArea className="h-96 pr-4">
                            <div className="space-y-3">
                            {conflicts.map(conflict => (
                                <Card key={conflict.id}>
                                    <CardContent className="p-3">
                                        <div className="flex items-start gap-3">
                                            <div className="text-amber-500 pt-1"><AlertCircle /></div>
                                            <div className="flex-1">
                                                <p className="font-medium text-sm">
                                                    {conflict.type === 'assessment' ? 'Assessment Conflict' : 'Candidate Conflict'}
                                                </p>
                                                <p className="text-sm text-muted-foreground truncate" title={conflict.name}>
                                                    {conflict.name}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Button size="sm" variant={conflict.resolution === 'keep' ? 'secondary' : 'outline'} onClick={() => handleConflictResolution(conflict.id, 'keep')}>Keep Existing</Button>
                                                <Button size="sm" variant={conflict.resolution === 'replace' ? 'default' : 'outline'} onClick={() => handleConflictResolution(conflict.id, 'replace')}>Replace</Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                            </div>
                        </ScrollArea>
                    </div>
                )}
                
                {step === 'summary' && summaryData && (
                    <div className="space-y-4">
                        <h4 className="font-semibold">Import Summary ({importMode === 'replace' ? 'Replacing All' : 'Appending'})</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <Card>
                                <CardContent className="p-4 space-y-2">
                                    <h5 className="font-medium text-sm flex items-center gap-2"><GanttChartSquare className="text-primary"/> Assessments</h5>
                                    <p className="text-xs flex justify-between">New: <span className="font-bold">{summaryData.assessments.new}</span></p>
                                    <p className="text-xs flex justify-between">Replaced: <span className="font-bold">{summaryData.assessments.replaced}</span></p>
                                    <p className="text-xs flex justify-between">Kept Existing: <span className="font-bold">{summaryData.assessments.kept}</span></p>
                                </CardContent>
                            </Card>
                             <Card>
                                <CardContent className="p-4 space-y-2">
                                    <h5 className="font-medium text-sm flex items-center gap-2"><Database className="text-primary"/> Candidates</h5>
                                    <p className="text-xs flex justify-between">New: <span className="font-bold">{summaryData.candidates.new}</span></p>
                                    <p className="text-xs flex justify-between">Replaced: <span className="font-bold">{summaryData.candidates.replaced}</span></p>
                                    <p className="text-xs flex justify-between">Kept Existing: <span className="font-bold">{summaryData.candidates.kept}</span></p>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                )}

                <DialogFooter className="pt-4">
                    {step === 'options' && (
                        <>
                            <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
                            <Button onClick={handleNext}>Next <ArrowRight className="ml-2 h-4 w-4"/></Button>
                        </>
                    )}
                    {step === 'conflicts' && (
                        <>
                            <Button variant="ghost" onClick={() => setStep('options')}><Undo2 className="mr-2 h-4 w-4"/> Back</Button>
                            <Button onClick={handleResolveConflicts}>Review Summary <ArrowRight className="ml-2 h-4 w-4"/></Button>
                        </>
                    )}
                    {step === 'summary' && (
                        <>
                            <Button variant="ghost" onClick={() => setStep(conflicts.length > 0 ? 'conflicts' : 'options')}><Undo2 className="mr-2 h-4 w-4"/> Back</Button>
                            <Button onClick={handleConfirmImport}><CheckCircle className="mr-2 h-4 w-4"/> Confirm & Import</Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
