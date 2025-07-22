
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
  ParseCvOutputSchema
} from '@/lib/types';
import { withRetry } from '@/lib/retry';
import { extractCandidateName } from './name-extractor';

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
  input: {schema: AnalyzeCVAgainstJDInputSchema},
  output: {schema: AnalyzeCVAgainstJDOutputSchema},
  config: { temperature: 0.1 },
  prompt: `You are an expert recruitment assistant. Your task is to analyze a candidate's CV against a structured Job Description (JD) and produce a detailed JSON output.

**Important Reasoning Rules:**
1.  **Candidate Name**: If the candidate's name is provided in the \`parsedCv\` object, you MUST use it. Otherwise, extract it from the CV text. Format it in Title Case.
2.  **Experience Source of Truth**: If a pre-calculated \`totalExperience\` value is provided in \`parsedCv\`, you MUST use that value. Do NOT recalculate it.
3.  **Post-Graduation Experience**: If a JD requirement specifies "post-graduation" experience, you MUST find the candidate's graduation date from the parsed education history and calculate their experience from that date forward to evaluate the requirement.
4.  **Scoring**:
    *   Iterate through every requirement in the \`jobDescriptionCriteria\`.
    *   For each requirement, determine if the candidate is 'Aligned', 'Partially Aligned', 'Not Aligned', or 'Not Mentioned'.
    *   Calculate the awarded points: 'Aligned' gets the full score, 'Partially Aligned' gets half, and the rest get zero.
    *   Sum these to get the \`candidateScore\`. The \`maxScore\` is the sum of all possible requirement scores.
    *   The final \`alignmentScore\` is \`(candidateScore / maxScore) * 100\`, rounded to the nearest integer.
5.  **Recommendation Logic**:
    *   Score >= 75%: "Strongly Recommended"
    *   Score >= 50%: "Recommended with Reservations"
    *   Score < 50%: "Not Recommended"
    *   **Override**: If a candidate misses a MUST-HAVE requirement in Education or Experience, they are "Not Recommended". If they miss any other MUST-HAVE, they are "Recommended with Reservations" unless their score is high enough to make them "Strongly Recommended". Add this reason to the 'weaknesses' list.
6.  **Summaries**: Generate a concise overall \`alignmentSummary\`, a list of key \`strengths\`, a list of specific \`weaknesses\`, and 2-3 targeted \`interviewProbes\` to explore the weaknesses.

**Job Description Criteria (JSON):**
{{{json jobDescriptionCriteria}}}

**Parsed CV Data (if available):**
{{{json parsedCv}}}

**Full CV Text:**
{{{cv}}}

Produce a valid JSON object matching the output schema.
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
    
    // Ensure there's a name, either from parsed data or by extraction.
    let candidateName = input.parsedCv?.name || '';
    if (!candidateName) {
        try {
            const fallbackName = await extractCandidateName({ cvText: input.cv });
            candidateName = fallbackName.candidateName;
        } catch (nameError) {
             console.error("Could not extract candidate name as a fallback.", nameError);
        }
    }
    
    if (!candidateName) {
        throw new Error("CV analysis failed: Could not determine the candidate's name from the document.");
    }

    const { output } = await withRetry(() => analyzeCVAgainstJDPrompt(input));
    
    if (!output) {
        throw new Error("CV analysis failed: The AI returned an invalid response.");
    }
    
    const endTime = Date.now();
    const processingTime = parseFloat(((endTime - startTime) / 1000).toFixed(2));
    
    // Final check and override to ensure data consistency
    const finalOutput: AnalyzeCVAgainstJDOutput = {
        ...output,
        candidateName: toTitleCase(candidateName),
        email: input.parsedCv?.email,
        totalExperience: input.parsedCv?.totalExperience,
        processingTime,
    };
    
    return finalOutput;
  }
);
