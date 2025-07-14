
'use server';

/**
 * @fileOverview Summarizes candidate assessments, categorizes candidates into tiers,
 * highlights common strengths and gaps, and suggests an interview strategy.
 *
 * - summarizeCandidateAssessments - A function that handles the candidate assessment summarization process.
 * - CandidateSummaryInput - The input type for the summarizeCandidateAssessments function.
 * - CandidateSummaryOutput - The return type for the summarizeCandidateAssessments function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';
import {
    CandidateSummaryInputSchema,
    CandidateSummaryOutputSchema,
    type CandidateSummaryInput,
    type CandidateSummaryOutput,
} from '@/lib/types';
import { withRetry } from '@/lib/retry';


export type { CandidateSummaryInput, CandidateSummaryOutput };

export async function summarizeCandidateAssessments(input: CandidateSummaryInput): Promise<CandidateSummaryOutput> {
  return summarizeCandidateAssessmentsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'summarizeCandidateAssessmentsPrompt',
  input: {schema: CandidateSummaryInputSchema},
  output: {schema: CandidateSummaryOutputSchema},
  config: { temperature: 0.0 },
  prompt: `You are a hiring manager summarizing candidate assessments for a job.

  Job Description Criteria:
  {{{formattedCriteria}}}

  Candidate Assessments:
  {{#each candidateAssessments}}
  - Candidate Name: {{{candidateName}}}
    Score: {{{alignmentScore}}}%
    Recommendation: {{{recommendation}}}
    Strengths: {{#each strengths}}{{{this}}}, {{/each}}
    Weaknesses: {{#each weaknesses}}{{{this}}}, {{/each}}
    Interview Probes: {{#each interviewProbes}}{{{this}}}, {{/each}}
  {{/each}}

  Based on the job criteria, scores, and the candidate assessments you've been given:
  1. Categorize candidates into one of three tiers: Top Tier, Mid Tier, or Not Suitable. Use the alignment score as a primary factor when tiering.
  2. Highlight the most common strengths you observed across all candidates.
  3. Identify the most common gaps or weaknesses found in the candidate pool.
  4. Formulate and suggest a concise interview strategy that focuses on probing the identified common gaps to better evaluate future candidates.
  `,
});

const summarizeCandidateAssessmentsFlow = ai.defineFlow(
  {
    name: 'summarizeCandidateAssessmentsFlow',
    inputSchema: CandidateSummaryInputSchema,
    outputSchema: CandidateSummaryOutputSchema,
  },
  async input => {
    const {output} = await withRetry(() => prompt(input));
    return output!;
  }
);
