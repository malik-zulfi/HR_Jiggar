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

  Job Description Criteria:
  {{#each jobDescriptionCriteria.education}}
  - Education ({{this.priority}}): {{{this.description}}}
  {{/each}}
  {{#each jobDescriptionCriteria.experience}}
  - Experience ({{this.priority}}): {{{this.description}}}
  {{/each}}
  {{#each jobDescriptionCriteria.technicalSkills}}
  - Technical Skill ({{this.priority}}): {{{this.description}}}
  {{/each}}
  {{#each jobDescriptionCriteria.softSkills}}
  - Soft Skill ({{this.priority}}): {{{this.description}}}
  {{/each}}
  {{#each jobDescriptionCriteria.responsibilities}}
  - Responsibility ({{this.priority}}): {{{this.description}}}
  {{/each}}
  {{#each jobDescriptionCriteria.certifications}}
  - Certification ({{this.priority}}): {{{this.description}}}
  {{/each}}

  Candidate Assessments:
  {{#each candidateAssessments}}
  - Candidate Name: {{{candidateName}}}
    Recommendation: {{{recommendation}}}
    Strengths: {{#each strengths}}{{{this}}}, {{/each}}
    Weaknesses: {{#each weaknesses}}{{{this}}}, {{/each}}
    Interview Probes: {{#each interviewProbes}}{{{this}}}, {{/each}}
  {{/each}}

  Based on the job criteria and the candidate assessments you've been given:
  1. Categorize candidates into one of three tiers: Top Tier, Mid Tier, or Not Suitable.
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
    const {output} = await prompt(input);
    return output!;
  }
);
