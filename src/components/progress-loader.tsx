'use client';

import { useState, useEffect } from 'react';
import { Progress } from '@/components/ui/progress';

interface ProgressLoaderProps {
  title: string;
  current?: number;
  total?: number;
  itemName?: string;
}

export default function ProgressLoader({ title, current, total, itemName }: ProgressLoaderProps) {
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
    if (hasRealProgress) return;

    // Fake progress animation if no real progress is provided
    setFakeProgress(10);
    const timer = setInterval(() => {
      setFakeProgress((prev) => {
        if (prev >= 95) {
          return 95;
        }
        return Math.min(prev + Math.random() * 10, 95);
      });
    }, 800);

    return () => clearInterval(timer);
  }, [hasRealProgress]);

  return (
    <div className="w-full space-y-3 p-4 border rounded-lg bg-muted/50">
      <p className="text-center text-sm font-medium text-foreground">{displayText}</p>
      <Progress value={progressValue} className="w-full h-2" />
    </div>
  );
}
