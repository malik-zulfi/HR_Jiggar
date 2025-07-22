
'use server';

/**
 * @fileOverview Analyzes a CV against a Job Description (JD) to identify alignment,
 * gaps, and provide a recommendation with suggested interview probes.
 *
 * - analyzeCVAgainstJD - A function that analyzes the CV against the JD.
 * - AnalyzeCVAgainstJDInput - The input type for the analyzeCVAgainstJD function.
 * - AnalyzeCVAgainstJDOutput - The return type for the analyzeCVAgainstJD function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import {
  ExtractJDCriteriaOutputSchema,
  AnalyzeCVAgainstJDOutputSchema,
  type AnalyzeCVAgainstJDOutput,
  ParseCvOutputSchema,
} from '@/lib/types';
import { withRetry } from '@/lib/retry';

const AnalyzeCVAgainstJDInputSchema = z.object({
  jobDescriptionCriteria: ExtractJDCriteriaOutputSchema.describe('The structured job description criteria to analyze against, including the pre-formatted string.'),
  cv: z.string().describe('The CV to analyze.'),
  parsedCv: ParseCvOutputSchema.nullable().optional().describe('Optional pre-parsed CV data. If provided, name and email extraction will be skipped.'),
});
export type AnalyzeCVAgainstJDInput = z.infer<typeof AnalyzeCVAgainstJDInputSchema>;

export type { AnalyzeCVAgainstJDOutput };

export async function analyzeCVAgainstJD(input: AnalyzeCVAgainstJDInput): Promise<AnalyzeCVAgainstJDOutput> {
  return analyzeCVAgainstJDFlow(input);
}

function toTitleCase(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(/[\s-]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

const analyzeCVAgainstJDPrompt = ai.definePrompt({
    name: 'analyzeCVAgainstJDPrompt',
    input: { schema: AnalyzeCVAgainstJDInputSchema },
    output: { schema: AnalyzeCVAgainstJDOutputSchema },
    config: { temperature: 0.1 },
    prompt: `You are an expert recruitment analyst. Your task is to perform a comprehensive analysis of the candidate's CV against the provided Job Description criteria.

**IMPORTANT INSTRUCTIONS:**

1.  **Use Pre-Parsed Data:** You have been provided with pre-parsed CV data, including the candidate's name, email, and a calculated 'totalExperience'. You MUST use these values as the single source of truth. Do not re-calculate or re-extract them.
2.  **Detailed Alignment:** For each requirement in the \`jobDescriptionCriteria\`, you must:
    a.  Determine the candidate's alignment status: 'Aligned', 'Partially Aligned', 'Not Aligned', or 'Not Mentioned'.
    b.  Provide a concise 'justification' for the status, citing evidence directly from the CV.
    c.  Calculate a 'score' for each requirement based on its priority and the alignment status. The 'maxScore' is provided for each requirement.
3.  **Scoring and Recommendation:**
    a.  Calculate the overall \`alignmentScore\` as a percentage (candidate's total score / total max score * 100).
    b.  Provide a final \`recommendation\` ('Strongly Recommended', 'Recommended with Reservations', 'Not Recommended') based on the alignment score and whether any 'MUST-HAVE' requirements were missed. A candidate who misses a MUST-HAVE in Experience or Education should generally be 'Not Recommended'.
4.  **Summaries:**
    a.  Write a concise \`alignmentSummary\`.
    b.  List the key \`strengths\` and \`weaknesses\`.
    c.  Suggest 2-3 targeted \`interviewProbes\` to explore weak areas.
5.  **Output Format:** Your final output MUST be a valid JSON object that strictly adheres to the provided output schema.

---
**Job Description Criteria (JSON):**
{{{json jobDescriptionCriteria}}}
---
**Candidate's Parsed CV Data (JSON):**
{{{json parsedCv}}}
---
**Full CV Text for Context:**
{{{cv}}}
---

Now, perform the analysis and return the complete JSON object.
`,
});


const analyzeCVAgainstJDFlow = ai.defineFlow(
  {
    name: 'analyzeCVAgainstJDFlow',
    inputSchema: AnalyzeCVAgainstJDInputSchema,
    outputSchema: AnalyzeCVAgainstJDOutputSchema,
  },
  async input => {
    const startTime = Date.now();
    
    const { output } = await withRetry(() => analyzeCVAgainstJDPrompt(input));

    if (!output) {
        throw new Error("CV analysis failed: The AI returned an invalid or empty response. Please try again.");
    }

    const endTime = Date.now();
    const processingTime = parseFloat(((endTime - startTime) / 1000).toFixed(2));

    // Ensure the final output has the most reliable data from the pre-parsed input.
    const finalOutput: AnalyzeCVAgainstJDOutput = {
        ...output,
        candidateName: toTitleCase(input.parsedCv?.name || output.candidateName),
        email: input.parsedCv?.email,
        totalExperience: input.parsedCv?.totalExperience,
        processingTime,
    };
    
    return finalOutput;
  }
);
