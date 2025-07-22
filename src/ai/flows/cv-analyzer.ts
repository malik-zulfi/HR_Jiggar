
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

const DynamicCriteriaPromptInputSchema = z.object({
    formattedCriteria: z.string().describe('The dynamically ordered, formatted list of job description criteria.'),
    cv: z.string().describe('The CV to analyze.'),
    parsedCv: ParseCvOutputSchema.nullable().optional().describe('Optional pre-parsed CV data including education and experience dates for complex calculations.'),
});

// The prompt will only return the analysis part. Score and recommendation are calculated programmatically.
const AnalyzeCVAgainstJDPromptOutputSchema = AnalyzeCVAgainstJDOutputSchema.omit({
    alignmentScore: true,
    recommendation: true,
    processingTime: true,
    candidateScore: true,
    maxScore: true,
    totalExperience: true,
});

const analyzeCVAgainstJDPrompt = ai.definePrompt({
  name: 'analyzeCVAgainstJDPrompt',
  input: {
    schema: DynamicCriteriaPromptInputSchema,
  },
  output: {
    schema: AnalyzeCVAgainstJDPromptOutputSchema,
  },
  config: { temperature: 0.0 },
  prompt: `You are a candidate assessment specialist. Your task is to analyze the following CV against the structured job description criteria provided.

**Primary Data Source:**
You have been given pre-parsed JSON data from the CV. You MUST use this structured data as your primary source for analysis, especially for experience and education details. The candidate's total experience has been pre-calculated for you; use the value from the JSON.
- Pre-parsed CV JSON: {{{json parsedCv}}}
- Raw CV Text (for context and fallback): {{{cv}}}

**Instructions:**

1.  **Extract Key Details:** First, extract the candidate's full name and primary email address. Format the name in Title Case (e.g., "John Doe").
2.  **Requirement Analysis:** For each requirement in the job description criteria below, analyze the CV (using the parsed JSON as your guide) and determine if the candidate is 'Aligned', 'Partially Aligned', 'Not Aligned', or 'Not Mentioned'.
3.  **Provide Justification:** For each requirement, provide a brief justification for your assessment, citing specific evidence from the CV. Your justifications should be inferential and not just literal text matches. For example, if a candidate has a 'Senior' title, you can infer they have experience guiding peers.
4.  **Final Summary:** Based on your detailed analysis, provide an overall alignment summary, a list of strengths, a list of weaknesses, and 2-3 suggested interview probes to explore weak areas.

**IMPORTANT:** Do NOT provide a numeric score or a final recommendation (like "Strongly Recommended"). This will be calculated programmatically. Your output must be a valid JSON object matching the provided schema.

**Job Description Criteria to Assess Against:**
{{{formattedCriteria}}}
`,
});

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

const analyzeCVAgainstJDFlow = ai.defineFlow(
  {
    name: 'analyzeCVAgainstJDFlow',
    inputSchema: AnalyzeCVAgainstJDInputSchema,
    outputSchema: AnalyzeCVAgainstJDOutputSchema,
  },
  async input => {
    const startTime = Date.now();
    const { jobDescriptionCriteria, cv, parsedCv } = input;
    
    const {output: partialOutput} = await withRetry(() => analyzeCVAgainstJDPrompt({
        formattedCriteria: jobDescriptionCriteria.formattedCriteria,
        cv,
        parsedCv,
    }));

    if (!partialOutput) {
        throw new Error("CV analysis failed to return a valid response.");
    }

    if (!partialOutput.candidateName) {
        const fallbackName = await extractCandidateName({ cvText: cv });
        if (!fallbackName.candidateName) {
            // If we still can't get a name, we have to fail.
            throw new Error("CV analysis failed: Could not determine the candidate's name from the document.");
        }
        partialOutput.candidateName = fallbackName.candidateName;
    }
    
    const output: AnalyzeCVAgainstJDOutput = {
        ...partialOutput,
        candidateName: toTitleCase(partialOutput.candidateName),
        email: partialOutput.email ?? parsedCv?.email,
        totalExperience: parsedCv?.totalExperience,
        alignmentScore: 0,
        recommendation: 'Not Recommended',
    };

    let maxScore = 0;
    let candidateScore = 0;

    const allJdRequirements = [
        ...(jobDescriptionCriteria.education || []).map(r => ({ ...r, category: 'Education' })),
        ...(jobDescriptionCriteria.experience || []).map(r => ({ ...r, category: 'Experience' })),
        ...(jobDescriptionCriteria.technicalSkills || []).map(r => ({ ...r, category: 'Technical Skill' })),
        ...(jobDescriptionCriteria.softSkills || []).map(r => ({ ...r, category: 'Soft Skill' })),
        ...(jobDescriptionCriteria.certifications || []).map(r => ({ ...r, category: 'Certification' })),
        ...(jobDescriptionCriteria.responsibilities || []).map(r => ({ ...r, category: 'Responsibility' })),
        ...(jobDescriptionCriteria.additionalRequirements || []).map(r => ({ ...r, category: 'Additional Requirement' })),
    ];
    
    allJdRequirements.forEach(req => {
        let reqDescription: string;
        let reqPriority: 'MUST-HAVE' | 'NICE-TO-HAVE';
        let basePoints: number;

        if (isRequirementGroup(req)) {
            reqDescription = req.requirements.map(r => r.description).join(' OR ');
            reqPriority = req.requirements.some(r => r.priority === 'MUST-HAVE') ? 'MUST-HAVE' : 'NICE-TO-HAVE';
            basePoints = req.requirements.reduce((max, r) => Math.max(max, r.score), 0);
        } else {
            reqDescription = req.description;
            reqPriority = req.priority;
            basePoints = req.score;
        }
        
        maxScore += basePoints;
        
        const alignmentDetail = output.alignmentDetails.find(
            detail => detail.requirement.includes(reqDescription.substring(0,50)) || reqDescription.includes(detail.requirement.substring(0,50))
        );
        
        if (alignmentDetail) {
            alignmentDetail.priority = reqPriority;
            let awardedPoints = 0;
            if (alignmentDetail.status === 'Aligned') {
                awardedPoints = basePoints;
            } else if (alignmentDetail.status === 'Partially Aligned') {
                awardedPoints = basePoints / 2;
            }
            candidateScore += awardedPoints;
            alignmentDetail.score = awardedPoints;
            alignmentDetail.maxScore = basePoints;
        }
    });

    output.alignmentScore = maxScore > 0 ? Math.round((candidateScore / maxScore) * 100) : 0;
    output.candidateScore = candidateScore;
    output.maxScore = maxScore;

    if (output.alignmentScore >= 75) {
        output.recommendation = 'Strongly Recommended';
    } else if (output.alignmentScore >= 50) {
        output.recommendation = 'Recommended with Reservations';
    } else {
        output.recommendation = 'Not Recommended';
    }

    const missedCoreRequirement = output.alignmentDetails.some(detail =>
        detail.priority === 'MUST-HAVE' &&
        detail.status === 'Not Aligned' &&
        (detail.category === 'Education' || detail.category === 'Experience')
    );

    if (missedCoreRequirement) {
        output.recommendation = 'Not Recommended';
        const reason = 'Does not meet a core MUST-HAVE requirement in Education or Experience.';
        if (!output.weaknesses.includes(reason)) {
            output.weaknesses.push(reason);
        }
    } else {
        const missedAnyMustHave = output.alignmentDetails.some(detail =>
            detail.priority === 'MUST-HAVE' && detail.status === 'Not Aligned'
        );

        if (missedAnyMustHave) {
            const reason = 'Does not meet one or more critical MUST-HAVE requirements.';
            if (!output.weaknesses.includes(reason)) {
                output.weaknesses.push(reason);
            }
            if (output.alignmentScore >= 50) {
                output.recommendation = 'Recommended with Reservations';
            }
        }
    }
    
    const endTime = Date.now();
    output.processingTime = parseFloat(((endTime - startTime) / 1000).toFixed(2));
    
    return output;
  }
);

    