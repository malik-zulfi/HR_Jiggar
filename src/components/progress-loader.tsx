'use client';

import { useState, useEffect } from 'react';
import { Progress } from '@/components/ui/progress';

interface ProgressLoaderProps {
  title: string;
}

export default function ProgressLoader({ title }: ProgressLoaderProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Start with a small progress value so it appears instantly
    setProgress(10);
    const timer = setInterval(() => {
      setProgress((prev) => {
        // Once it's almost full, slow down the progress
        if (prev >= 95) {
          return 95;
        }
        // Add a small random increment
        return Math.min(prev + Math.random() * 10, 95);
      });
    }, 800);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="w-full space-y-3 p-4 border rounded-lg bg-muted/50">
      <p className="text-center text-sm font-medium text-foreground">{title}</p>
      <Progress value={progress} className="w-full h-2" />
    </div>
  );
}
