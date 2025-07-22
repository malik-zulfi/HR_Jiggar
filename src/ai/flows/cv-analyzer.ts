
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

// We ask the AI for everything *except* the final recommendation, which we will calculate programmatically.
const AIAnalysisOutputSchema = AnalyzeCVAgainstJDOutputSchema.omit({ recommendation: true });

const analyzeCVAgainstJDPrompt = ai.definePrompt({
    name: 'analyzeCVAgainstJDPrompt',
    input: { schema: AnalyzeCVAgainstJDInputSchema },
    output: { schema: AIAnalysisOutputSchema },
    config: { temperature: 0.0 },
    prompt: `You are an expert recruitment analyst. Your task is to perform a comprehensive analysis of the candidate's CV against the provided Job Description criteria.

**IMPORTANT INSTRUCTIONS:**

1.  **Use Pre-Parsed Data:** You have been provided with pre-parsed CV data, including the candidate's name, email, and a calculated 'totalExperience'. You MUST use these values as the single source of truth. Do not re-calculate or re-extract them.
2.  **Detailed Alignment:** For each requirement in the \`jobDescriptionCriteria\`, you must:
    a.  Determine the candidate's alignment status: 'Aligned', 'Partially Aligned', 'Not Aligned', or 'Not Mentioned'.
    b.  Provide a concise 'justification' for the status, citing evidence directly from the CV.
    c.  Calculate a 'score' for each requirement based on its priority and the alignment status. The 'maxScore' is provided for each requirement.
3.  **Scoring and Summaries:**
    a.  Calculate the overall \`alignmentScore\` as a percentage (candidate's total score / total max score * 100).
    b.  Write a concise \`alignmentSummary\`.
    c.  List the key \`strengths\` and \`weaknesses\`.
    d.  Suggest 2-3 targeted \`interviewProbes\` to explore weak areas.
4.  **Output Format:** Your final output MUST be a valid JSON object that strictly adheres to the provided output schema. DO NOT determine the final 'recommendation'; that will be handled separately.

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

Now, perform the analysis and return the complete JSON object without the 'recommendation' field.
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
    
    const { output: aiAnalysis } = await withRetry(() => analyzeCVAgainstJDPrompt(input));

    if (!aiAnalysis) {
        throw new Error("CV analysis failed: The AI returned an invalid or empty response. Please try again.");
    }
    
    // Programmatic recommendation logic
    let recommendation: AnalyzeCVAgainstJDOutput['recommendation'];
    
    const missedMustHaveCore = aiAnalysis.alignmentDetails.some(detail =>
      (detail.category === 'Experience' || detail.category === 'Education') &&
      detail.priority === 'MUST-HAVE' &&
      detail.status === 'Not Aligned'
    );
    
    if (missedMustHaveCore) {
        recommendation = 'Not Recommended';
    } else if (aiAnalysis.alignmentScore >= 85) {
        recommendation = 'Strongly Recommended';
    } else {
        recommendation = 'Recommended with Reservations';
    }
    
    const endTime = Date.now();
    const processingTime = parseFloat(((endTime - startTime) / 1000).toFixed(2));

    // Combine AI analysis with the programmatic recommendation
    const finalOutput: AnalyzeCVAgainstJDOutput = {
        ...aiAnalysis,
        recommendation,
        candidateName: toTitleCase(input.parsedCv?.name || aiAnalysis.candidateName),
        email: input.parsedCv?.email,
        totalExperience: input.parsedCv?.totalExperience,
        processingTime,
    };
    
    return finalOutput;
  }
);
