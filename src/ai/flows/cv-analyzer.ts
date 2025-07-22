
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
  type Requirement,
  type RequirementGroup,
  ParseCvOutputSchema,
  AlignmentDetailSchema,
  type AlignmentDetail,
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

function isRequirementGroup(item: Requirement | RequirementGroup): item is RequirementGroup {
    return 'groupType' in item;
}

const SingleRequirementAnalysisInputSchema = z.object({
    requirement: z.string(),
    category: z.string(),
    cv: z.string(),
});

const SingleRequirementAnalysisOutputSchema = z.object({
    status: z.enum(['Aligned', 'Partially Aligned', 'Not Aligned', 'Not Mentioned']),
    justification: z.string(),
});

const singleRequirementAnalysisPrompt = ai.definePrompt({
    name: 'singleRequirementAnalysisPrompt',
    input: { schema: SingleRequirementAnalysisInputSchema },
    output: { schema: SingleRequirementAnalysisOutputSchema },
    config: { temperature: 0.0 },
    prompt: `You are a single-task CV analyzer. Your job is to determine if the given CV meets one specific requirement.
- CV Content: {{{cv}}}
- Requirement Category: {{{category}}}
- Requirement: "{{{requirement}}}"

Analyze the CV and determine if the candidate is 'Aligned', 'Partially Aligned', 'Not Aligned', or 'Not Mentioned' for this single requirement. Provide a brief justification based on the CV.`,
});

const SummaryAndProbesInputSchema = z.object({
    alignmentDetails: z.array(AlignmentDetailSchema),
    cv: z.string(),
    totalExperience: z.string().nullable().optional(),
});

const SummaryAndProbesOutputSchema = z.object({
    alignmentSummary: z.string(),
    strengths: z.array(z.string()),
    weaknesses: z.array(z.string()),
    interviewProbes: z.array(z.string()),
});

const summaryAndProbesPrompt = ai.definePrompt({
    name: 'summaryAndProbesPrompt',
    input: { schema: SummaryAndProbesInputSchema },
    output: { schema: SummaryAndProbesOutputSchema },
    config: { temperature: 0.1 },
    prompt: `You are a recruitment summary specialist. Based on the detailed requirement analysis provided below, please generate:
1.  A concise overall 'alignmentSummary'.
2.  A list of the candidate's key 'strengths'.
3.  A list of the candidate's 'weaknesses'.
4.  A list of 2-3 targeted 'interviewProbes' to explore weak areas.

**Important Rule:** When evaluating experience, the candidate's total experience is officially calculated as: {{{totalExperience}}}. You MUST use this value as the single source of truth for the candidate's overall experience. Do not re-calculate it.

Detailed Analysis:
{{#each alignmentDetails}}
- Requirement: {{this.requirement}}
  Status: {{this.status}}
  Justification: {{this.justification}}
{{/each}}

CV for additional context:
{{{cv}}}
`,
});

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const analyzeCVAgainstJDFlow = ai.defineFlow(
  {
    name: 'analyzeCVAgainstJDFlow',
    inputSchema: AnalyzeCVAgainstJDInputSchema,
    outputSchema: AnalyzeCVAgainstJDOutputSchema,
  },
  async input => {
    const startTime = Date.now();
    const { jobDescriptionCriteria, cv, parsedCv } = input;
    
    let candidateName = parsedCv?.name || '';
    if (!candidateName) {
        try {
            const fallbackName = await extractCandidateName({ cvText: cv });
            candidateName = fallbackName.candidateName;
        } catch (nameError) {
             console.error("Could not extract candidate name as a fallback.", nameError);
        }
    }
    
    if (!candidateName) {
        // Instead of throwing an error, we can proceed with a placeholder if needed,
        // but for this app, a name is critical for display.
        // Let's throw, but this can be changed if needed.
        throw new Error("CV analysis failed: Could not determine the candidate's name from the document.");
    }
    
    const allJdRequirements = [
        ...(jobDescriptionCriteria.education || []).map(r => ({ ...r, category: 'Education' })),
        ...(jobDescriptionCriteria.experience || []).map(r => ({ ...r, category: 'Experience' })),
        ...(jobDescriptionCriteria.technicalSkills || []).map(r => ({ ...r, category: 'Technical Skill' })),
        ...(jobDescriptionCriteria.softSkills || []).map(r => ({ ...r, category: 'Soft Skill' })),
        ...(jobDescriptionCriteria.certifications || []).map(r => ({ ...r, category: 'Certification' })),
        ...(jobDescriptionCriteria.responsibilities || []).map(r => ({ ...r, category: 'Responsibility' })),
        ...(jobDescriptionCriteria.additionalRequirements || []).map(r => ({ ...r, category: 'Additional Requirement' })),
    ];
    
    const alignmentDetails: AlignmentDetail[] = [];
    let maxScore = 0;
    let candidateScore = 0;

    for (const req of allJdRequirements) {
        // Add a delay here to avoid hitting the API rate limit
        await delay(1000); 

        let reqDescription: string;
        let reqPriority: 'MUST-HAVE' | 'NICE-TO-HAVE';
        let basePoints: number;
        let category: string = req.category;

        if (isRequirementGroup(req)) {
            reqDescription = req.requirements.map(r => r.description).join(' OR ');
            reqPriority = req.requirements.some(r => r.priority === 'MUST-HAVE') ? 'MUST-HAVE' : 'NICE-TO-HAVE';
            basePoints = req.requirements.reduce((max, r) => Math.max(max, r.score), 0);
        } else {
            reqDescription = req.description;
            reqPriority = req.priority;
            basePoints = req.score;
        }

        const { output: analysisResult } = await withRetry(() => singleRequirementAnalysisPrompt({
            requirement: reqDescription,
            category: category,
            cv: cv,
        }));
        
        if (!analysisResult) continue;

        let awardedPoints = 0;
        if (analysisResult.status === 'Aligned') {
            awardedPoints = basePoints;
        } else if (analysisResult.status === 'Partially Aligned') {
            awardedPoints = basePoints / 2;
        }
        candidateScore += awardedPoints;
        maxScore += basePoints;
        
        alignmentDetails.push({
            category,
            requirement: reqDescription,
            priority: reqPriority,
            status: analysisResult.status,
            justification: analysisResult.justification,
            score: awardedPoints,
            maxScore: basePoints,
        });
    }

    const { output: summaryResult } = await withRetry(() => summaryAndProbesPrompt({
        alignmentDetails,
        cv,
        totalExperience: parsedCv?.totalExperience,
    }));
    
    if (!summaryResult) {
        throw new Error("CV analysis failed: Could not generate summary.");
    }
    
    const alignmentScore = maxScore > 0 ? Math.round((candidateScore / maxScore) * 100) : 0;
    let recommendation: AnalyzeCVAgainstJDOutput['recommendation'] = 'Not Recommended';

    if (alignmentScore >= 75) {
        recommendation = 'Strongly Recommended';
    } else if (alignmentScore >= 50) {
        recommendation = 'Recommended with Reservations';
    }

    const missedCoreRequirement = alignmentDetails.some(detail =>
        detail.priority === 'MUST-HAVE' &&
        detail.status !== 'Aligned' && 
        detail.status !== 'Partially Aligned' &&
        (detail.category === 'Education' || detail.category === 'Experience')
    );

    if (missedCoreRequirement) {
        recommendation = 'Not Recommended';
        const reason = 'Does not meet a core MUST-HAVE requirement in Education or Experience.';
        if (!summaryResult.weaknesses.includes(reason)) {
            summaryResult.weaknesses.push(reason);
        }
    } else {
        const missedAnyMustHave = alignmentDetails.some(detail =>
            detail.priority === 'MUST-HAVE' && detail.status !== 'Aligned' && detail.status !== 'Partially Aligned'
        );

        if (missedAnyMustHave && alignmentScore < 75) {
            recommendation = 'Recommended with Reservations';
            const reason = 'Does not meet one or more critical MUST-HAVE requirements.';
            if (!summaryResult.weaknesses.includes(reason)) {
                summaryResult.weaknesses.push(reason);
            }
        }
    }
    
    const endTime = Date.now();
    const processingTime = parseFloat(((endTime - startTime) / 1000).toFixed(2));
    
    const finalOutput: AnalyzeCVAgainstJDOutput = {
        candidateName: toTitleCase(candidateName),
        email: parsedCv?.email,
        totalExperience: parsedCv?.totalExperience,
        alignmentScore,
        candidateScore,
        maxScore,
        recommendation,
        alignmentDetails,
        alignmentSummary: summaryResult.alignmentSummary,
        strengths: summaryResult.strengths,
        weaknesses: summaryResult.weaknesses,
        interviewProbes: summaryResult.interviewProbes,
        processingTime,
    };
    
    return finalOutput;
  }
);

    