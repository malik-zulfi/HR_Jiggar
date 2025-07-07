'use client';

import { useState, useEffect } from 'react';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Loader2 } from 'lucide-react';

interface ProgressLoaderProps {
  title: string;
  current?: number;
  total?: number;
  itemName?: string;
  steps?: string[];
  currentStepIndex?: number;
  logLength?: number;
}

export default function ProgressLoader({ 
  title, 
  current, 
  total, 
  itemName,
  steps,
  currentStepIndex,
  logLength = 5
}: ProgressLoaderProps) {
  const [fakeProgress, setFakeProgress] = useState(0);

  const hasRealProgress = typeof current === 'number' && typeof total === 'number' && total > 0;
  const progressValue = hasRealProgress ? (current / total) * 100 : fakeProgress;
  
  let displayText = title;
  if (hasRealProgress && itemName && current > 0) {
    displayText = `${title}: ${itemName} (${current} of ${total})`;
  } else if (hasRealProgress && current > 0) {
    displayText = `${title} (${current} of ${total})`;
  }

  useEffect(() => {
    // Fake progress animation for simple loaders
    if (hasRealProgress || (steps && typeof currentStepIndex === 'number')) return;

    setFakeProgress(10);
    const timer = setInterval(() => {
      setFakeProgress((prev) => {
        if (prev >= 95) return 95;
        return Math.min(prev + Math.random() * 10, 95);
      });
    }, 800);

    return () => clearInterval(timer);
  }, [hasRealProgress, steps, currentStepIndex]);

  // Terminal view logic
  if (steps && typeof currentStepIndex === 'number' && steps.length > 0) {
    const end = Math.min(currentStepIndex, steps.length - 1);
    const start = Math.max(0, end - logLength + 1);
    const visibleSteps = steps.slice(start, end + 1);
    const stepProgress = ((currentStepIndex + 1) / steps.length) * 100;
    
    return (
      <div className="w-full space-y-3 p-4 border rounded-lg bg-muted/50 font-mono text-xs">
        <p className="text-center text-sm font-sans font-medium text-foreground">{displayText}</p>
        <Progress value={progressValue} className="w-full h-2" />
        
        <div className='mt-4 p-3 bg-black/80 rounded-md text-white/90 h-40 overflow-hidden relative flex flex-col justify-end'>
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
                    <span className={`truncate ${isCurrent ? 'text-white' : 'text-white/60'}`}>{isCurrent ? 'ASSESSING: ' : 'DONE: '}{step}</span>
                  </div>
                )
             })}
          </div>
        </div>
        <div className="space-y-2">
            <p className="text-center font-sans text-muted-foreground">
                Checking requirement {Math.min(currentStepIndex + 1, steps.length)} of {steps.length}...
            </p>
            <Progress value={stepProgress} className="w-full h-1" />
        </div>
      </div>
    );
  }

  // Default simple loader
  return (
    <div className="w-full space-y-3 p-4 border rounded-lg bg-muted/50">
      <p className="text-center text-sm font-medium text-foreground">{displayText}</p>
      <Progress value={progressValue} className="w-full h-2" />
    </div>
  );
}
