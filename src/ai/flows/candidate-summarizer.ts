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
import {z} from 'genkit';

const CandidateAssessmentSchema = z.object({
  candidateName: z.string().describe('The name of the candidate.'),
  recommendation: z
    .enum(['Strongly Recommended', 'Recommended with Reservations', 'Not Recommended'])
    .describe('The overall recommendation for the candidate.'),
  strengths: z.array(z.string()).describe('A list of strengths of the candidate.'),
  weaknesses: z.array(z.string()).describe('A list of weaknesses of the candidate.'),
  interviewProbes: z
    .array(z.string())
    .describe('Suggested interview probes to explore weak/unclear areas.'),
});

const CandidateSummaryInputSchema = z.object({
  candidateAssessments: z.array(CandidateAssessmentSchema).describe('An array of candidate assessments.'),
  jobDescription: z.string().describe('The job description used for the assessments.'),
});
export type CandidateSummaryInput = z.infer<typeof CandidateSummaryInputSchema>;

const CandidateSummaryOutputSchema = z.object({
  topTier: z.array(z.string()).describe('Candidates categorized as Top Tier.'),
  midTier: z.array(z.string()).describe('Candidates categorized as Mid Tier.'),
  notSuitable: z.array(z.string()).describe('Candidates categorized as Not Suitable.'),
  commonStrengths: z.array(z.string()).describe('Common strengths among the candidates.'),
  commonGaps: z.array(z.string()).describe('Common gaps among the candidates.'),
  interviewStrategy: z.string().describe('A suggested interview strategy.'),
});
export type CandidateSummaryOutput = z.infer<typeof CandidateSummaryOutputSchema>;

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
