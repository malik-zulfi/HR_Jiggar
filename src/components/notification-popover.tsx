
"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PopoverContent } from '@/components/ui/popover';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { SuitablePosition, AssessmentSession, CandidateRecord, CvDatabaseRecord } from '@/lib/types';
import { Plus, Users, Loader2 } from 'lucide-react';
import { useState, useMemo, useCallback } from 'react';
import { ScrollArea } from './ui/scroll-area';
import { Checkbox } from './ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { analyzeCVAgainstJD } from '@/ai/flows/cv-analyzer';
import { useAppContext } from './client-provider';


const ACTIVE_SESSION_STORAGE_KEY = 'jiggar-active-session';

const NotificationPopover = ({ positions, onClearNotifications }: {
    positions: SuitablePosition[];
    onClearNotifications: (positions: SuitablePosition[]) => void;
}) => {
    const { toast } = useToast();
    const { cvDatabase, setHistory } = useAppContext();
    const [selectedCandidates, setSelectedCandidates] = useState<Record<string, Set<string>>>({});
    const [loadingAssessments, setLoadingAssessments] = useState<Set<string>>(new Set());

    const handleBulkAdd = useCallback(async (e: React.MouseEvent, assessmentId: string, candidatesInGroup: SuitablePosition[]) => {
        e.preventDefault();
        e.stopPropagation();
        
        const selectedEmails = selectedCandidates[assessmentId] || new Set();
        if (selectedEmails.size === 0) return;

        const positionsToAdd = candidatesInGroup.filter(p => selectedEmails.has(p.candidateEmail));
        const candidateDbRecords = positionsToAdd.map(p => cvDatabase.find(c => c.email === p.candidateEmail)).filter(Boolean) as CvDatabaseRecord[];

        if (candidateDbRecords.length === 0) {
            toast({ variant: 'destructive', description: "Could not find candidate records in the database." });
            return;
        }

        setLoadingAssessments(prev => new Set(prev).add(assessmentId));
        toast({ description: `Assessing ${candidateDbRecords.length} candidate(s) for ${positionsToAdd[0].assessment.analyzedJd.jobTitle}...` });

        try {
            const analyses = await Promise.all(candidateDbRecords.map(candidateDbRecord => 
                analyzeCVAgainstJD({ 
                    jobDescriptionCriteria: positionsToAdd[0].assessment.analyzedJd, 
                    cv: candidateDbRecord.cvContent,
                    parsedCv: candidateDbRecord,
                })
            ));

            const newCandidateRecords: CandidateRecord[] = analyses.map((analysis, index) => ({
                cvName: candidateDbRecords[index].cvFileName,
                cvContent: candidateDbRecords[index].cvContent,
                analysis,
                isStale: false,
            }));

            setHistory(prev => {
                return prev.map(session => {
                    if (session.id === assessmentId) {
                        const existingEmails = new Set(session.candidates.map(c => c.analysis.email?.toLowerCase()).filter(Boolean));
                        const uniqueNewCandidates = newCandidateRecords.filter(c => !existingEmails.has(c.analysis.email?.toLowerCase()));

                        if (uniqueNewCandidates.length < newCandidateRecords.length) {
                             toast({ variant: 'destructive', description: "Some selected candidates were already in this session and were skipped." });
                        }

                        if(uniqueNewCandidates.length === 0) return session;

                        const allCandidates = [...session.candidates, ...uniqueNewCandidates];
                        allCandidates.sort((a, b) => b.analysis.alignmentScore - a.analysis.alignmentScore);
                        return { ...session, candidates: allCandidates, summary: null };
                    }
                    return session;
                });
            });
            
            toast({
                title: `Assessment Complete`,
                description: `${newCandidateRecords.length} candidate(s) have been added to the "${positionsToAdd[0].assessment.analyzedJd.jobTitle}" assessment.`,
                action: (
                    <button onClick={() => { localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, assessmentId); window.location.href = '/assessment'; }} className="inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-background px-3 text-sm font-medium ring-offset-background transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50">
                        View
                    </button>
                ),
            });
            
            onClearNotifications(positionsToAdd);
            setSelectedCandidates(prev => {
                const newSelections = { ...prev };
                delete newSelections[assessmentId];
                return newSelections;
            });

        } catch (error: any) {
            toast({ variant: 'destructive', title: `Failed to assess candidates`, description: error.message });
        } finally {
            setLoadingAssessments(prev => {
                const newSet = new Set(prev);
                newSet.delete(assessmentId);
                return newSet;
            });
        }
    }, [selectedCandidates, cvDatabase, setHistory, toast, onClearNotifications]);
    
    const handleToggleCandidate = (assessmentId: string, candidateEmail: string) => {
        setSelectedCandidates(prev => {
            const newSelections = { ...prev };
            const selectionForGroup = new Set(newSelections[assessmentId] || []);
            
            if (selectionForGroup.has(candidateEmail)) {
                selectionForGroup.delete(candidateEmail);
            } else {
                selectionForGroup.add(candidateEmail);
            }
            
            if (selectionForGroup.size === 0) {
                 delete newSelections[assessmentId];
            } else {
                newSelections[assessmentId] = selectionForGroup;
            }

            return newSelections;
        });
    };

    const handleToggleAll = (assessmentId: string, candidatesInGroup: SuitablePosition[], allSelected: boolean) => {
        setSelectedCandidates(prev => {
            const newSelections = { ...prev };
            if (allSelected) {
                delete newSelections[assessmentId];
            } else {
                newSelections[assessmentId] = new Set(candidatesInGroup.map(c => c.candidateEmail));
            }
            return newSelections;
        });
    };

    const groupedPositions = useMemo(() => {
        return positions.reduce((acc, pos) => {
            const { assessment } = pos;
            if (!acc[assessment.id]) {
                acc[assessment.id] = {
                    assessmentInfo: assessment,
                    candidates: [],
                };
            }
            acc[assessment.id].candidates.push(pos);
            return acc;
        }, {} as Record<string, { assessmentInfo: AssessmentSession; candidates: SuitablePosition[] }>);
    }, [positions]);

    const groupedPositionsArray = Object.values(groupedPositions);

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
            <ScrollArea className="max-h-96">
                <div className="flex flex-col">
                    {groupedPositionsArray.map(({ assessmentInfo, candidates }) => {
                         const selectedForGroup = selectedCandidates[assessmentInfo.id] || new Set();
                         const allSelectedInGroup = selectedForGroup.size === candidates.length && candidates.length > 0;
                         const isLoading = loadingAssessments.has(assessmentInfo.id);

                         return (
                            <div key={assessmentInfo.id} className="border-b last:border-b-0">
                                <div className="p-3 bg-secondary/30 hover:bg-secondary/50 flex justify-between items-center">
                                    <Link 
                                        href="/assessment" 
                                        onClick={() => localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, assessmentInfo.id)}
                                        className="flex-1"
                                    >
                                        <h5 className="font-semibold text-primary truncate" title={assessmentInfo.analyzedJd.jobTitle}>
                                            {assessmentInfo.analyzedJd.jobTitle}
                                        </h5>
                                        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                                            <Users className="h-3 w-3" /> {candidates.length} new suitable candidate(s)
                                        </p>
                                    </Link>
                                    <Button size="sm" variant="outline" disabled={selectedForGroup.size === 0 || isLoading} onClick={(e) => handleBulkAdd(e, assessmentInfo.id, candidates)}>
                                        {isLoading ? (
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        ) : (
                                            <Plus className="mr-2 h-4 w-4" />
                                        )}
                                        Add Selected ({selectedForGroup.size})
                                    </Button>
                                </div>
                                <div className="p-2 space-y-1">
                                     <div className="flex items-center gap-3 p-2 text-xs font-medium text-muted-foreground">
                                        <Checkbox
                                            id={`select-all-${assessmentInfo.id}`}
                                            checked={allSelectedInGroup}
                                            onCheckedChange={() => handleToggleAll(assessmentInfo.id, candidates, allSelectedInGroup)}
                                        />
                                        <label htmlFor={`select-all-${assessmentInfo.id}`} className="cursor-pointer">
                                            Select all
                                        </label>
                                    </div>
                                    {candidates.map((pos) => (
                                        <div key={pos.candidateEmail} className="flex items-center justify-between gap-2 p-2 rounded-md hover:bg-muted/30">
                                            <div className="flex items-center gap-3 flex-1 overflow-hidden">
                                                <Checkbox
                                                    id={`select-${assessmentInfo.id}-${pos.candidateEmail}`}
                                                    checked={selectedForGroup.has(pos.candidateEmail)}
                                                    onCheckedChange={() => handleToggleCandidate(assessmentInfo.id, pos.candidateEmail)}
                                                />
                                                <label htmlFor={`select-${assessmentInfo.id}-${pos.candidateEmail}`} className="font-medium text-sm truncate cursor-pointer">{pos.candidateName}</label>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </ScrollArea>
        </PopoverContent>
    );
};

export default NotificationPopover;
