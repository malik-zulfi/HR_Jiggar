
'use server';
/**
 * @fileOverview Job Description (JD) Analyzer AI agent. This flow extracts
 * all relevant information from a JD into a highly structured format.
 *
 * - extractJDCriteria - A function that handles the JD criteria extraction process.
 * - ExtractJDCriteriaInput - The input type for the extractJDCriteria function.
 * - ExtractJDCriteriaOutput - The return type for the extractJDCriteria function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { 
    ExtractJDCriteriaOutputSchema, 
    type ExtractJDCriteriaOutput,
} from '@/lib/types';
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
  name: 'extractJDCriteriaPromptV2',
  input: {schema: ExtractJDCriteriaInputSchema},
  output: {schema: ExtractJDCriteriaOutputSchema},
  config: { temperature: 0.0 },
  prompt: `You are an expert recruitment data analyst. Your task is to meticulously deconstruct a job description into a structured JSON format.

**Instructions:**

1.  **Full Extraction**: You MUST extract information for every field in the provided JSON schema.
2.  **"Not Found"**: If you cannot find information for a specific field, you MUST use the string "Not Found". For arrays, if no items are found, return an empty array \`[]\`.
3.  **Prioritization**: For each requirement in Responsibilities, TechnicalSkills, SoftSkills, Education, and Certifications, you MUST classify it as either \`MUST_HAVE\` or \`NICE_TO_HAVE\`. Use keywords like "minimum", "required" for MUST_HAVE, and "preferred", "plus", "bonus" for NICE_TO_HAVE. If no keyword is present, default to MUST_HAVE.
4.  **Experience Field**: For the \`Requirements.Experience.MUST_HAVE.Years\` field, extract the number of years as a string (e.g., "5+ years").
5.  **Organizational Relationship**: Extract reporting lines and interfaces into their respective arrays.
6.  **Follow Schema Strictly**: Your final output must be a valid JSON object that strictly adheres to the provided output schema.

**Job Description to Analyze:**
{{{jobDescription}}}
`,
});

const extractJDCriteriaFlow = ai.defineFlow(
  {
    name: 'extractJDCriteriaFlow',
    inputSchema: ExtractJDCriteriaInputSchema,
    outputSchema: ExtractJDCriteriaOutputSchema,
  },
  async input => {
    const {output} = await withRetry(() => prompt(input));
    
    if (!output) {
        throw new Error("JD Analysis failed to return a valid response.");
    }
    
    // The new structure relies heavily on the AI's ability to categorize.
    // Post-processing is minimal, mainly validation and formatting.
    const validatedCode = output.JobCode && ['OCN', 'WEX', 'SAN'].includes(output.JobCode.toUpperCase()) 
        ? output.JobCode.toUpperCase() 
        : "Not Found";

    return {
        ...output,
        JobCode: validatedCode,
    };
  }
);
