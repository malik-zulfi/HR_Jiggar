'use server';
/**
 * @fileOverview Checks the relevance of a candidate's CV for a given job description.
 */

import {ai} from '@/ai/genkit';
import { withRetry } from '@/lib/retry';
import {
    CheckRelevanceInputSchema,
    CheckRelevanceOutputSchema,
    type CheckRelevanceInput,
    type CheckRelevanceOutput
} from '@/lib/types';


export async function checkRelevance(input: CheckRelevanceInput): Promise<CheckRelevanceOutput> {
  return checkRelevanceFlow(input);
}

const prompt = ai.definePrompt({
  name: 'checkRelevancePrompt',
  input: {schema: CheckRelevanceInputSchema},
  output: {schema: CheckRelevanceOutputSchema},
  config: { temperature: 0.1 },
  prompt: `You are an expert recruitment assistant. Your task is to perform a quick relevance check.
  
Based on the provided CV content and a brief job description, determine if the candidate is a potentially relevant fit for the role.
Focus on high-level alignment like core skills, recent job titles, and overall experience. Do not perform a deep analysis.

Job Description:
{{{jobDescription}}}

Candidate CV:
{{{cvContent}}}

Your decision should be a simple 'yes' or 'no' (isRelevant: true/false) with a very brief one-sentence justification.
`,
});

const checkRelevanceFlow = ai.defineFlow(
  {
    name: 'checkRelevanceFlow',
    inputSchema: CheckRelevanceInputSchema,
    outputSchema: CheckRelevanceOutputSchema,
  },
  async (input: CheckRelevanceInput) => {
    const {output} = await withRetry(() => prompt(input));
    if (!output) {
      throw new Error("Relevance check failed to produce an output.");
    }
    return output;
  }
);
