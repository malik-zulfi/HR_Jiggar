
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
  RequirementSchema,
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
    name: 'analyzeCVAgainstJDPromptV3',
    input: { schema: AnalyzeCVAgainstJDInputSchema },
    output: { schema: AIAnalysisOutputSchema },
    config: { temperature: 0.1 },
    prompt: `You are an expert recruitment analyst. Your task is to perform a comprehensive analysis of the candidate's CV against the provided Job Description criteria.

**IMPORTANT INSTRUCTIONS:**

1.  **Use Pre-Parsed Data:** You have been provided with pre-parsed CV data, including the candidate's name, email, and a calculated 'totalExperience'. You MUST use these values as the single source of truth. Do not re-calculate or re-extract them.
2.  **Analyze All Requirements**: You must iterate through every single requirement listed in the \`jobDescriptionCriteria\` JSON. For each one, you must create a corresponding entry in the \`alignmentDetails\` array.
3.  **Detailed Alignment:** For each requirement, you must:
    a.  Determine the candidate's alignment status: 'Aligned', 'Partially Aligned', 'Not Aligned', or 'Not Mentioned'.
    b.  Provide a concise 'justification' for the status, citing evidence directly from the CV.
    c.  DO NOT calculate a 'score' or 'maxScore'. This will be handled programmatically.
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

    // Combine all requirements from JD into a single map for easy lookup
    const allJdRequirements = new Map<string, Requirement>();
    const jd = input.jobDescriptionCriteria;
    const processReqs = (reqs: Requirement[]) => reqs.forEach(r => allJdRequirements.set(r.description, r));
    
    processReqs(jd.Responsibilities.MUST_HAVE);
    processReqs(jd.Responsibilities.NICE_TO_HAVE);
    processReqs(jd.Requirements.TechnicalSkills.MUST_HAVE);
    processReqs(jd.Requirements.TechnicalSkills.NICE_TO_HAVE);
    processReqs(jd.Requirements.SoftSkills.MUST_HAVE);
    processReqs(jd.Requirements.SoftSkills.NICE_TO_HAVE);
    processReqs(jd.Requirements.Education.MUST_HAVE);
    processReqs(jd.Requirements.Education.NICE_TO_HAVE);
    processReqs(jd.Requirements.Certifications.MUST_HAVE);
    processReqs(jd.Requirements.Certifications.NICE_TO_HAVE);
    processReqs(jd.Requirements.Experience.NICE_TO_HAVE);
    if (jd.Requirements.Experience.MUST_HAVE.Years) {
        const expReq = {
            id: 'exp-must-years',
            description: `${jd.Requirements.Experience.MUST_HAVE.Years} in ${jd.Requirements.Experience.MUST_HAVE.Fields.join(', ')}`,
            priority: 'MUST_HAVE' as const,
            score: 10,
            originalPriority: 'MUST_HAVE' as const,
            originalScore: 10
        };
        allJdRequirements.set(expReq.description, expReq);
    }

    // Programmatically calculate scores
    const scoredAlignmentDetails = aiAnalysis.alignmentDetails.map(detail => {
        let score = 0;
        const jdReq = allJdRequirements.get(detail.requirement);
        const maxScore = jdReq?.score || (detail.priority === 'MUST_HAVE' ? 10 : 5);

        if (detail.status === 'Aligned') {
            score = maxScore;
        } else if (detail.status === 'Partially Aligned') {
            score = Math.ceil(maxScore / 2);
        }
        return { ...detail, score, maxScore };
    });

    const candidateScore = scoredAlignmentDetails.reduce((acc, detail) => acc + (detail.score || 0), 0);
    const maxScore = scoredAlignmentDetails.reduce((acc, detail) => acc + (detail.maxScore || 0), 0);
    const alignmentScore = maxScore > 0 ? parseFloat(((candidateScore / maxScore) * 100).toFixed(2)) : 0;
    
    // Programmatic recommendation logic
    let recommendation: AnalyzeCVAgainstJDOutput['recommendation'];
    
    const missedMustHaveCore = scoredAlignmentDetails.some(detail =>
      (detail.category === 'Experience' || detail.category === 'Education') &&
      detail.priority === 'MUST_HAVE' &&
      detail.status === 'Not Aligned'
    );
    
    if (missedMustHaveCore) {
        recommendation = 'Not Recommended';
    } else if (alignmentScore >= 85) {
        recommendation = 'Strongly Recommended';
    } else if (alignmentScore >= 60) {
        recommendation = 'Recommended with Reservations';
    } else {
        recommendation = 'Not Recommended';
    }
    
    const endTime = Date.now();
    const processingTime = parseFloat(((endTime - startTime) / 1000).toFixed(2));

    // Combine AI analysis with the programmatic recommendation
    const finalOutput: AnalyzeCVAgainstJDOutput = {
        ...aiAnalysis,
        alignmentDetails: scoredAlignmentDetails,
        alignmentScore,
        candidateScore,
        maxScore,
        recommendation,
        candidateName: toTitleCase(input.parsedCv?.name || aiAnalysis.candidateName),
        email: input.parsedCv?.email || aiAnalysis.email,
        totalExperience: input.parsedCv?.totalExperience || aiAnalysis.totalExperience,
        experienceCalculatedAt: input.parsedCv?.experienceCalculatedAt,
        processingTime,
    };
    
    return finalOutput;
  }
);

    