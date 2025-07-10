
"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PopoverContent } from '@/components/ui/popover';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { SuitablePosition } from '@/lib/types';
import { Plus } from 'lucide-react';

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

export default NotificationPopover;
