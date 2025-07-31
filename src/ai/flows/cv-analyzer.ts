
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
  jobDescriptionCriteria: ExtractJDCriteriaOutputSchema.describe('The structured job description criteria to analyze against.'),
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
const AIAnalysisOutputSchema = AnalyzeCVAgainstJDOutputSchema.omit({ recommendation: true, alignmentScore: true, candidateScore: true, maxScore: true });

const analyzeCVAgainstJDPrompt = ai.definePrompt({
    name: 'analyzeCVAgainstJDPromptV2',
    input: { schema: AnalyzeCVAgainstJDInputSchema },
    output: { schema: AIAnalysisOutputSchema },
    config: { temperature: 0.1 },
    prompt: `You are an expert recruitment analyst. Your task is to perform a comprehensive analysis of the candidate's CV against the provided Job Description criteria.

**IMPORTANT INSTRUCTIONS:**

1.  **Use Pre-Parsed Data:** You have been provided with pre-parsed CV data, including the candidate's name, email, and a calculated 'totalExperience'. You MUST use these values as the single source of truth. Do not re-calculate or re-extract them.
2.  **Analyze All Requirements**: You must iterate through every single requirement listed in the \`jobDescriptionCriteria\` JSON under \`Responsibilities\` and \`Requirements\`. For each one, you must create a corresponding entry in the \`alignmentDetails\` array.
3.  **Detailed Alignment:** For each requirement, you must:
    a.  Determine the candidate's alignment status: 'Aligned', 'Partially Aligned', 'Not Aligned', or 'Not Mentioned'.
    b.  Provide a concise 'justification' for the status, citing evidence directly from the CV.
    c.  Calculate a 'score' for each requirement. A 'MUST-HAVE' aligned is 10 points, partially is 5. A 'NICE-TO-HAVE' aligned is 5 points, partially is 2. 'Not Aligned' or 'Not Mentioned' is 0. The 'maxScore' is 10 for MUST-HAVE and 5 for NICE-TO-HAVE.
4.  **Summaries (No Overall Score):**
    a.  Write a concise \`alignmentSummary\`.
    b.  List the key \`strengths\` and \`weaknesses\`.
    c.  Suggest 2-3 targeted \`interviewProbes\` to explore weak areas.
5.  **Output Format:** Your final output MUST be a valid JSON object that strictly adheres to the provided output schema. DO NOT determine the final 'recommendation' or calculate the overall 'alignmentScore', 'candidateScore', or 'maxScore'. These will be handled separately.

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

Now, perform the analysis and return the complete JSON object without the 'recommendation', 'alignmentScore', 'candidateScore', and 'maxScore' fields.
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

    if (!aiAnalysis || !aiAnalysis.alignmentDetails) {
        throw new Error("CV analysis failed: The AI returned an invalid or empty response. Please try again.");
    }

    // Programmatically calculate scores
    const candidateScore = aiAnalysis.alignmentDetails.reduce((acc, detail) => acc + (detail.score || 0), 0);
    const maxScore = aiAnalysis.alignmentDetails.reduce((acc, detail) => acc + (detail.maxScore || 0), 0);
    const alignmentScore = maxScore > 0 ? parseFloat(((candidateScore / maxScore) * 100).toFixed(2)) : 0;
    
    // Programmatic recommendation logic
    let recommendation: AnalyzeCVAgainstJDOutput['recommendation'];
    
    const missedMustHaveCore = aiAnalysis.alignmentDetails.some(detail =>
      (detail.category === 'Experience' || detail.category === 'Education') &&
      detail.priority === 'MUST-HAVE' &&
      detail.status === 'Not Aligned'
    );
    
    if (missedMustHaveCore) {
        recommendation = 'Not Recommended';
    } else if (alignmentScore >= 85) {
        recommendation = 'Strongly Recommended';
    } else {
        recommendation = 'Recommended with Reservations';
    }
    
    const endTime = Date.now();
    const processingTime = parseFloat(((endTime - startTime) / 1000).toFixed(2));

    // Combine AI analysis with the programmatic recommendation
    const finalOutput: AnalyzeCVAgainstJDOutput = {
        ...aiAnalysis,
        alignmentScore,
        candidateScore,
        maxScore,
        recommendation,
        candidateName: toTitleCase(input.parsedCv?.name || aiAnalysis.candidateName),
        email: input.parsedCv?.email,
        totalExperience: input.parsedCv?.totalExperience,
        processingTime,
    };
    
    return finalOutput;
  }
);
