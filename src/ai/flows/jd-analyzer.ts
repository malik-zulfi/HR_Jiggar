'use server';
/**
 * @fileOverview Job Description (JD) Analyzer AI agent.
 *
 * - extractJDCriteria - A function that handles the JD criteria extraction process.
 * - ExtractJDCriteriaInput - The input type for the extractJDCriteria function.
 * - ExtractJDCriteriaOutput - The return type for the extractJDCriteria function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { ExtractJDCriteriaOutputSchema, type ExtractJDCriteriaOutput } from '@/lib/types';
import { withRetry } from '@/lib/retry';

const ExtractJDCriteriaInputSchema = z.object({
  jobDescription: z.string().describe('The Job Description to analyze.'),
});
export type ExtractJDCriteriaInput = z.infer<typeof ExtractJDCriteriaInputSchema>;

export type { ExtractJDCriteriaOutput };

export async function extractJDCriteria(input: ExtractJDCriteriaInput): Promise<ExtractJDCriteriaOutput> {
  return extractJDCriteriaFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractJDCriteriaPrompt',
  input: {schema: ExtractJDCriteriaInputSchema},
  output: {schema: ExtractJDCriteriaOutputSchema},
  prompt: `You are an expert recruiter. Please analyze the following job description.

First, extract the job title and the position/requisition number (if available).

Then, extract the key requirements, categorizing them into technical skills, soft skills, experience, education, certifications, and responsibilities.
For each requirement, indicate whether it is a MUST-HAVE or NICE-TO-HAVE.

Job Description:
{{{jobDescription}}}

Ensure the output is a valid JSON object.`,
});

const extractJDCriteriaFlow = ai.defineFlow(
  {
    name: 'extractJDCriteriaFlow',
    inputSchema: ExtractJDCriteriaInputSchema,
    outputSchema: ExtractJDCriteriaOutputSchema,
  },
  async input => {
    const {output} = await withRetry(() => prompt(input));
    return output!;
  }
);
