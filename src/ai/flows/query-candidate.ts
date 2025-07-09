'use server';
/**
 * @fileOverview Answers user queries about a specific candidate based on their CV and the job description.
 *
 * - queryCandidate - A function that handles the query process.
 * - QueryCandidateInput - The input type for the queryCandidate function.
 * - QueryCandidateOutput - The return type for the queryCandidate function.
 */

import {ai} from '@/ai/genkit';
import {
    QueryCandidateInputSchema,
    QueryCandidateOutputSchema,
    type QueryCandidateInput,
    type QueryCandidateOutput,
    type Requirement
} from '@/lib/types';
import { withRetry } from '@/lib/retry';
import { z } from 'zod';

export type { QueryCandidateInput, QueryCandidateOutput };

export async function queryCandidate(input: QueryCandidateInput): Promise<QueryCandidateOutput> {
  return queryCandidateFlow(input);
}

const DynamicQueryPromptInputSchema = z.object({
    formattedCriteria: z.string().describe('The dynamically ordered, formatted list of job description criteria.'),
    cvContent: z.string().describe("The candidate's CV content."),
    query: z.string().describe("The user's question."),
    currentDate: z.string().describe("The current date, to be used as the end date for currently held positions."),
});

const prompt = ai.definePrompt({
  name: 'queryCandidatePrompt',
  input: {schema: DynamicQueryPromptInputSchema},
  output: {schema: QueryCandidateOutputSchema},
  config: { temperature: 0.1 },
  prompt: `You are an expert recruitment assistant. Your task is to answer a specific question about a candidate based *only* on the provided CV and the job description criteria.

**Important Reasoning Rules for Answering:**
- **Calculate Experience for Current Roles:** When a candidate's experience is listed as "Present", "Current", or "To Date", you must use today's date ({{{currentDate}}}) as the end date for that role when calculating their total years of experience.
- **Handle Overlapping Experience:** When calculating total years of experience, you MUST identify all distinct employment periods from the CV. If there are overlapping date ranges (e.g., working two jobs at the same time), merge them to avoid double-counting. The total experience should be the sum of the unique, non-overlapping time periods.
- **Do not make assumptions:** Do not provide information that isn't present in the provided documents. If the answer cannot be found in the CV or JD, state that clearly.

**Job Description Criteria:**
{{{formattedCriteria}}}

**Candidate CV:**
{{{cvContent}}}

**User's Question:**
"{{{query}}}"

Your answer must be concise and directly address the user's question, following the rules above.
`,
});

const queryCandidateFlow = ai.defineFlow(
  {
    name: 'queryCandidateFlow',
    inputSchema: QueryCandidateInputSchema,
    outputSchema: QueryCandidateOutputSchema,
  },
  async (input: QueryCandidateInput) => {
    const { cvContent, jobDescriptionCriteria, query } = input;
    const { education, experience, technicalSkills, softSkills, responsibilities, certifications, additionalRequirements } = jobDescriptionCriteria;
    
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
    formattedCriteria += formatSection('Additional Requirement', additionalRequirements);

    const currentDate = new Date().toDateString();
    const {output} = await withRetry(() => prompt({
        formattedCriteria,
        cvContent,
        query,
        currentDate,
    }));
    return output!;
  }
);
