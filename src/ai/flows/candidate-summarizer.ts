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
    type Requirement
} from '@/lib/types';
import { withRetry } from '@/lib/retry';


export type { CandidateSummaryInput, CandidateSummaryOutput };

export async function summarizeCandidateAssessments(input: CandidateSummaryInput): Promise<CandidateSummaryOutput> {
  return summarizeCandidateAssessmentsFlow(input);
}

const DynamicSummaryPromptInputSchema = z.object({
    formattedCriteria: z.string().describe('The dynamically ordered, formatted list of job description criteria.'),
    candidateAssessments: CandidateSummaryInputSchema.shape.candidateAssessments,
});

const prompt = ai.definePrompt({
  name: 'summarizeCandidateAssessmentsPrompt',
  input: {schema: DynamicSummaryPromptInputSchema},
  output: {schema: CandidateSummaryOutputSchema},
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
    const { jobDescriptionCriteria, candidateAssessments } = input;
    const { education, experience, technicalSkills, softSkills, responsibilities, certifications } = jobDescriptionCriteria;

    const hasMustHaveCert = certifications?.some(c => c.priority === 'MUST-HAVE');

    const formatSection = (title: string, items: Requirement[] | undefined) => {
        if (!items || items.length === 0) return '';
        return items.map(item => `- ${title} (${item.priority.replace('-', ' ')}): ${item.description}`).join('\n') + '\n';
    };

    let formattedCriteria = '';
    formattedCriteria += formatSection('Education', education);
    formattedCriteria += formatSection('Experience', experience);
    if (hasMustHaveCert) {
        formattedCriteria += formatSection('Certification', certifications);
    }
    formattedCriteria += formatSection('Technical Skill', technicalSkills);
    formattedCriteria += formatSection('Soft Skill', softSkills);
    if (!hasMustHaveCert) {
        formattedCriteria += formatSection('Certification', certifications);
    }
    formattedCriteria += formatSection('Responsibility', responsibilities);

    const {output} = await withRetry(() => prompt({
        formattedCriteria,
        candidateAssessments
    }));
    return output!;
  }
);
