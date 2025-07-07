'use server';
/**
 * @fileOverview Extracts a candidate's full name from CV text.
 *
 * - extractCandidateName - A function that pulls the name from CV text.
 * - ExtractCandidateNameInput - The input type for the function.
 * - ExtractCandidateNameOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {
    ExtractCandidateNameInputSchema,
    ExtractCandidateNameOutputSchema,
    type ExtractCandidateNameInput,
    type ExtractCandidateNameOutput
} from '@/lib/types';

export type { ExtractCandidateNameInput, ExtractCandidateNameOutput };

export async function extractCandidateName(input: ExtractCandidateNameInput): Promise<ExtractCandidateNameOutput> {
  return extractCandidateNameFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractCandidateNamePrompt',
  input: {schema: ExtractCandidateNameInputSchema},
  output: {schema: ExtractCandidateNameOutputSchema},
  prompt: `You are an expert CV parser. Your sole task is to extract the full name of the candidate from the following CV text. Return only the name and nothing else. If you cannot determine the name, return an empty string.

CV Text:
{{{cvText}}}
`,
});

const extractCandidateNameFlow = ai.defineFlow(
  {
    name: 'extractCandidateNameFlow',
    inputSchema: ExtractCandidateNameInputSchema,
    outputSchema: ExtractCandidateNameOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
