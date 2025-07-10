
'use client';

import { useState, useEffect } from 'react';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';

interface ProgressLoaderProps {
  title: string;
  steps?: string[];
  currentStepIndex?: number;
  statusList?: { status: 'processing' | 'done' | 'error', message: string }[];
  logLength?: number;
}

interface ProcessingItemProps {
    message: string;
    status: 'processing' | 'done' | 'error';
}

const ProcessingItem = ({ message, status }: ProcessingItemProps) => {
    const steps = [
        "Reviewing CV content...",
        "Assessing against job requirements...",
        "Calculating alignment score...",
        "Finalizing analysis...",
    ];
    const [currentStepIndex, setCurrentStepIndex] = useState(0);

    useEffect(() => {
        if (status === 'processing') {
            const randomDelay = 1200 + Math.random() * 600;
            const interval = setInterval(() => {
                setCurrentStepIndex(prev => {
                    const nextStep = prev + 1;
                    if (nextStep >= steps.length) {
                        clearInterval(interval);
                        return prev;
                    }
                    return nextStep;
                });
            }, randomDelay);

            return () => clearInterval(interval);
        }
    }, [status, steps.length]);
    
    const displayText = steps[Math.min(currentStepIndex, steps.length - 1)];

    if (status === 'done') {
        return (
            <div className="flex items-center gap-3 text-sm">
                <CheckCircle2 className="h-4 w-4 text-chart-2 shrink-0" />
                <span className="text-muted-foreground truncate">{message} - Completed</span>
            </div>
        );
    }
    
    if (status === 'error') {
        return (
            <div className="flex items-center gap-3 text-sm">
                <XCircle className="h-4 w-4 text-destructive shrink-0" />
                <span className="text-muted-foreground truncate">{message} - Error</span>
            </div>
        );
    }

    // 'processing' status
    return (
        <div className="flex items-start gap-3 text-sm">
            <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0 mt-0.5" />
            <div className="flex-1">
                <p className="text-foreground font-medium truncate">{message}</p>
                <p className="text-muted-foreground text-xs truncate">{displayText}</p>
            </div>
        </div>
    );
};


export default function ProgressLoader({ 
  title, 
  steps,
  currentStepIndex,
  statusList,
}: ProgressLoaderProps) {
  
  // Status list view for concurrent tasks
  if (statusList) {
    const totalItems = statusList.length;
    const doneCount = statusList.filter(s => s.status === 'done' || s.status === 'error').length;
    const progress = totalItems > 0 ? (doneCount / totalItems) * 100 : 0;
    
    return (
      <div className="w-full space-y-3 p-4 border rounded-lg bg-muted/50">
        <div className="text-center font-sans text-sm font-medium text-foreground">
            <p>{title}</p>
        </div>
        <Progress value={progress} className="w-full h-2" />
        <div className="mt-4 p-3 bg-background rounded-md max-h-60 overflow-y-auto space-y-3">
            {statusList.map((item) => (
                <ProcessingItem
                    key={item.message}
                    message={item.message}
                    status={item.status}
                />
            ))}
        </div>
      </div>
    );
  }

  // Terminal view logic for single tasks
  if (steps && typeof currentStepIndex === 'number' && steps.length > 0) {
    const logLength = 5;
    const end = Math.min(currentStepIndex, steps.length - 1);
    const start = Math.max(0, end - logLength + 1);
    const visibleSteps = steps.slice(start, end + 1);
    const stepProgress = ((currentStepIndex + 1) / steps.length) * 100;
    
    return (
      <div className="w-full space-y-3 p-4 border rounded-lg bg-muted/50 text-xs">
        <div className="text-center font-sans text-sm font-medium text-foreground">
            <p>{title}</p>
        </div>
        
        <div className='mt-4 p-3 bg-black/80 rounded-md text-white/90 h-40 overflow-hidden relative flex flex-col justify-end font-mono'>
          <div>
             {visibleSteps.map((step, index) => {
                const isCurrent = (start + index) === currentStepIndex;
                if (!step) return null;
                return (
                  <div key={start + index} className="flex items-center gap-2">
                    {isCurrent ? (
                       <Loader2 className="h-3 w-3 animate-spin text-green-400" />
                    ) : (
                       <CheckCircle2 className="h-3 w-3 text-green-400" />
                    )}
                    <span className={`truncate ${isCurrent ? 'text-white' : 'text-white/60'}`}>{isCurrent ? 'RUNNING: ' : 'DONE: '}{step}</span>
                  </div>
                )
             })}
          </div>
        </div>
        <div className="space-y-2">
            <p className="text-center font-sans text-muted-foreground">
                Step {Math.min(currentStepIndex + 1, steps.length)} of {steps.length}...
            </p>
            <Progress value={stepProgress} className="w-full h-1" />
        </div>
      </div>
    );
  }

  // Fallback simple loader for unexpected cases
  return (
    <div className="w-full space-y-3 p-4 border rounded-lg bg-muted/50">
       <div className="text-center text-sm font-medium text-foreground">
            <p>{title}</p>
        </div>
      <Progress value={10} className="w-full h-2 animate-pulse" />
    </div>
  );
}
