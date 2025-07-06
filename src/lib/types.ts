import type { AnalyzeCVAgainstJDOutput } from '@/ai/flows/cv-analyzer';
import type { ExtractJDCriteriaOutput } from '@/ai/flows/jd-analyzer';
import type { CandidateSummaryOutput } from '@/ai/flows/candidate-summarizer';

export interface Requirement {
  description: string;
  priority: 'MUST-HAVE' | 'NICE-TO-HAVE';
}

export type AnalyzedCandidate = AnalyzeCVAgainstJDOutput;

// Re-exporting for convenience
export type {
  AnalyzeCVAgainstJDOutput,
  ExtractJDCriteriaOutput,
  CandidateSummaryOutput,
};
