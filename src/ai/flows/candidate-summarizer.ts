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
import {
    CandidateSummaryInputSchema,
    CandidateSummaryOutputSchema,
    type CandidateSummaryInput,
    type CandidateSummaryOutput
} from '@/lib/types';


export type { CandidateSummaryInput, CandidateSummaryOutput };

export async function summarizeCandidateAssessments(input: CandidateSummaryInput): Promise<CandidateSummaryOutput> {
  return summarizeCandidateAssessmentsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'summarizeCandidateAssessmentsPrompt',
  input: {schema: CandidateSummaryInputSchema},
  output: {schema: CandidateSummaryOutputSchema},
  prompt: `You are a hiring manager summarizing candidate assessments for a job.

  Job Description: {{{jobDescription}}}

  Candidate Assessments:
  {{#each candidateAssessments}}
  - Candidate Name: {{{candidateName}}}
    Recommendation: {{{recommendation}}}
    Strengths: {{#each strengths}}{{{this}}}, {{/each}}
    Weaknesses: {{#each weaknesses}}{{{this}}}, {{/each}}
    Interview Probes: {{#each interviewProbes}}{{{this}}}, {{/each}}
  {{/each}}

  Categorize candidates into Top Tier, Mid Tier, or Not Suitable based on the job description and their assessments.
  Highlight common strengths and gaps among the candidates.
  Suggest an interview strategy based on the common gaps and the job description.
  `,
});

const summarizeCandidateAssessmentsFlow = ai.defineFlow(
  {
    name: 'summarizeCandidateAssessmentsFlow',
    inputSchema: CandidateSummaryInputSchema,
    outputSchema: CandidateSummaryOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
