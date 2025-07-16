
"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PopoverContent } from '@/components/ui/popover';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { SuitablePosition, AssessmentSession } from '@/lib/types';
import { Plus, Users } from 'lucide-react';
import { useMemo } from 'react';
import { ScrollArea } from './ui/scroll-area';

const ACTIVE_SESSION_STORAGE_KEY = 'jiggar-active-session';

const NotificationPopover = ({ positions, onAddCandidate }: {
    positions: SuitablePosition[];
    onAddCandidate: (position: SuitablePosition) => void;
}) => {
    const handleQuickAdd = (e: React.MouseEvent, position: SuitablePosition) => {
        e.preventDefault();
        e.stopPropagation();
        onAddCandidate(position);
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
                    {groupedPositionsArray.map(({ assessmentInfo, candidates }) => (
                         <div key={assessmentInfo.id} className="border-b last:border-b-0">
                            <Link 
                                href="/assessment" 
                                onClick={() => localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, assessmentInfo.id)}
                                className="block p-3 bg-secondary/30 hover:bg-secondary/50"
                            >
                                <h5 className="font-semibold text-primary truncate" title={assessmentInfo.analyzedJd.jobTitle}>
                                    {assessmentInfo.analyzedJd.jobTitle}
                                </h5>
                                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                                    <Users className="h-3 w-3" /> {candidates.length} new suitable candidate(s)
                                </p>
                            </Link>
                            <div className="p-2 space-y-1">
                                {candidates.map((pos) => (
                                     <div key={pos.candidateEmail} className="flex items-center justify-between gap-2 p-2 rounded-md hover:bg-muted/30">
                                        <div className="flex-1 overflow-hidden">
                                            <p className="font-medium text-sm truncate">{pos.candidateName}</p>
                                        </div>
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button size="icon" variant="ghost" className="h-7 w-7 text-primary" onClick={(e) => handleQuickAdd(e, pos)}>
                                                        <Plus className="h-4 w-4" />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>Quick-add {pos.candidateName} to this assessment</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                     </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </ScrollArea>
        </PopoverContent>
    );
};

export default NotificationPopover;
