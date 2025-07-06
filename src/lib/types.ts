import type { AnalyzeCVAgainstJDOutput, ExtractJDCriteriaOutput, CandidateSummaryOutput, AlignmentDetail } from '@/ai/flows/cv-analyzer';

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
  AlignmentDetail,
};
