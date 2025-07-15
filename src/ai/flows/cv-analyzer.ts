
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
  type ParseCvOutput,
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
    candidateName: z.string().optional().describe("The candidate's full name, if already parsed."),
    candidateEmail: z.string().optional().describe("The candidate's email, if already parsed."),
    totalExperience: z.string().nullable().optional().describe("The candidate's pre-calculated total years of experience (e.g., '8.5 years'). Use this value when assessing experience requirements."),
});

// The prompt will only return the analysis part. Score and recommendation are calculated programmatically.
const AnalyzeCVAgainstJDPromptOutputSchema = AnalyzeCVAgainstJDOutputSchema.omit({
    alignmentScore: true,
    recommendation: true,
    processingTime: true,
    candidateScore: true,
    maxScore: true,
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
  prompt: `You are a candidate assessment specialist. Analyze the following CV against the structured job description criteria. Your analysis must be intelligent and inferential, not just a simple text match.

**Analysis Steps:**

1.  **Extract Key Details:** If the candidate's name and email are not provided, extract the full name and primary email address from the CV. Format the name in Title Case (e.g., "John Doe"). If you cannot find an email, return an empty string for the email field. If the name and email are provided, use them directly.

2.  **Assess Each Requirement:**
    *   For each requirement in the job description criteria, assess the candidate's CV.
    *   Determine if the candidate is 'Aligned', 'Partially Aligned', 'Not Aligned', or 'Not Mentioned'.
    *   Provide a brief justification for your assessment for each requirement, citing evidence from the CV.

**Important Reasoning Rules:**

*   **Explicit "OR" Check for Education:** When an education requirement lists multiple degrees with "OR" (e.g., "Degree in A OR B"), you MUST check the CV for each degree option individually. If the candidate possesses **any one** of the listed degrees, you MUST mark the requirement as **'Aligned'**. Only mark it as 'Not Aligned' if you can confirm none of the options are met.
*   **Handle Conditional "OR" Groups:** If a requirement contains multiple options joined by "OR" (e.g., 'degree in A OR B', 'experience with X OR Y'), you MUST treat this as a single requirement. The candidate is considered **'Aligned'** if they meet **ANY ONE** of the specified options. Do not mark it as 'Partially Aligned' if only one option is met. Your justification should clearly state which option the candidate meets. If they meet none, it is 'Not Aligned'.
*   **Infer Responsibilities from Seniority:** Do not penalize candidates if their CV doesn't explicitly state a responsibility that is clearly implied by their job title. For example, if the requirement is 'provide guidance to peers' and the candidate's title is 'Senior Engineer', 'Lead', 'Coordinator' or 'Project Manager', you MUST infer that they perform this function and mark the requirement as **'Aligned'**. Justify this by referencing their title.
*   **Partial Alignment on Overall Experience:** If a candidate does not meet the years of experience for a **specific** field (e.g., fire protection), but their **overall** total experience ('{{{totalExperience}}}') is greater than or equal to the required years, you MUST mark that requirement as **'Partially Aligned'**. Your justification MUST clearly state this, for example: "Partially aligned. While the candidate has less than the required 3 years of direct fire protection experience, their overall experience of 3.4 years meets the threshold." For all other cases, continue to assess experience strictly.
*   **Strict Experience Comparison:** If a requirement is for a specific number of years (e.g., '8 years of experience'), and the candidate's total experience ('{{{totalExperience}}}') is less than the required number by *more than 3 months*, you MUST mark that requirement as 'Not Aligned'.
*   **Experience Gap Exception:** If the candidate's total experience is less than the required number but the gap is **3 months or less**, you should mark that requirement as **'Partially Aligned'**. Your justification MUST clearly state the small gap (e.g., "Partially aligned, as they are only 2 months short of the required 5 years.").
*   **Flexible NICE-TO-HAVE Assessment:** For requirements marked as 'NICE-TO-HAVE', be more flexible. If a candidate demonstrates proficiency (e.g., "good" or "proficient") but the requirement specifies a higher level (e.g., "excellent" or "expert"), you should mark this as **'Partially Aligned'**, not 'Not Aligned'. Your justification should note the candidate's proficiency level in relation to the ideal requirement. Apply stricter alignment for 'MUST-HAVE' requirements.
*   **Handle Equivalencies:** Recognize and correctly interpret common abbreviations and equivalent terms. For example, 'B.Sc.' is a 'Bachelor of Science' and fully meets a 'Bachelor's degree' requirement. 'MS' is a 'Master's degree'.
*   **Infer Qualifications:** If a candidate lists a higher-level degree (e.g., a Master's or PhD), you MUST assume they have completed the prerequisite lower-level degree (a Bachelor's), even if the Bachelor's degree is not explicitly listed in their CV.
*   **Avoid Overly Literal Matching:** Do not fail a candidate just because the wording in their CV isn't an exact verbatim match to the requirement. Focus on the substance and meaning. If the requirement is 'Bachelor’s degree in Civil / Structural Engineering' and the CV lists 'B.Sc. in Civil Engineering', that is a clear 'Aligned' match.

**Final Output:**
Based on your detailed analysis, provide an overall alignment summary, a list of strengths, a list of weaknesses, and 2-3 suggested interview probes to explore weak areas. Do NOT provide a numeric score or a final recommendation like "Recommended". The final output must be a valid JSON object matching the provided schema.

Job Description Criteria:
{{{formattedCriteria}}}

CV:
{{{cv}}}
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
        candidateName: parsedCv?.name,
        candidateEmail: parsedCv?.email,
        totalExperience: parsedCv?.totalExperience,
    }));

    if (!partialOutput || !partialOutput.candidateName) {
        const fallbackName = await extractCandidateName({ cvText: cv });
        if (!fallbackName.candidateName) {
            throw new Error("CV analysis failed: Could not determine the candidate's name.");
        }
        if(partialOutput) {
            partialOutput.candidateName = fallbackName.candidateName;
        } else {
             throw new Error("CV analysis failed to return a valid partial response.");
        }
    }
    
    const output: AnalyzeCVAgainstJDOutput = {
        ...partialOutput,
        candidateName: toTitleCase(partialOutput.candidateName),
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

    const isDisqualified = output.alignmentDetails.some(detail =>
        (detail.category.toLowerCase().includes('experience') || detail.category.toLowerCase().includes('education')) &&
        detail.priority === 'MUST-HAVE' &&
        detail.status === 'Not Aligned'
    );

    if (isDisqualified) {
      output.recommendation = 'Not Recommended';
      const disqualificationReason = 'Does not meet a critical MUST-HAVE requirement in Education or Experience.';
      if (!output.weaknesses.includes(disqualificationReason)) {
           output.weaknesses.push(disqualificationReason);
      }
    } else {
        if (output.alignmentScore >= 75) {
            output.recommendation = 'Strongly Recommended';
        } else if (output.alignmentScore >= 40) {
            output.recommendation = 'Recommended with Reservations';
        } else {
            output.recommendation = 'Not Recommended';
        }
    }
    
    const endTime = Date.now();
    output.processingTime = parseFloat(((endTime - startTime) / 1000).toFixed(2));
    
    return output;
  }
);
