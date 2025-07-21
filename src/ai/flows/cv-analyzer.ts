
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
  prompt: `You are a candidate assessment specialist. Analyze the following CV against the structured job description criteria. Your analysis must be intelligent and inferential, not just a simple text match.

**Pre-Parsed CV Data (for reference):**
This data provides a structured view of the candidate's CV, including education and experience with dates. Use this as the primary source for calculations.
The candidate's total experience has been pre-calculated for you. You MUST use this value. Do NOT re-calculate it.
Total calculated experience: {{{parsedCv.totalExperience}}}
Full parsed data: {{{json parsedCv}}}

**Analysis Steps:**

1.  **Extract Key Details:** If the candidate's name and email are not provided in the parsed data, extract the full name and primary email address from the raw CV text. Format the name in Title Case (e.g., "John Doe"). If you cannot find an email, return an empty string for the email field. If the name and email are provided, use them directly.

2.  **Assess Each Requirement:**
    *   For each requirement in the job description criteria, assess the candidate's CV using the pre-parsed data as your primary source.
    *   Determine if the candidate is 'Aligned', 'Partially Aligned', 'Not Aligned', or 'Not Mentioned'.
    *   Provide a brief justification for your assessment for each requirement, citing evidence from the CV.

**Important Reasoning Rules:**

*   **Differentiate Total vs. Specific Experience:** For **general** experience requirements (e.g., "8 years of professional experience"), you MUST use the provided '{{{parsedCv.totalExperience}}}' value from the pre-parsed JSON as the primary source of truth.
*   **Handle Post-Graduation Experience:** For requirements specifying **post-graduation experience** (e.g., "10 years of post-graduation experience"), you MUST first identify the graduation date from the \`parsedCv.structuredContent.education\` section. Then, calculate the candidate's work experience starting *only from that date*. Your alignment status for this requirement MUST be based on this specific calculation.
*   **Calculate Specific Field Experience:** For requirements asking for experience in a **specific field** (e.g., "5 years in fire protection"), you MUST analyze the candidate's work history within the \`parsedCv.structuredContent.experience\` to calculate their experience *in that specific area only*. Your final alignment status MUST be based on this specific calculation.
*   **Partial Alignment on Overall Experience:** If a candidate does not meet the years of experience for a specific **education or experience** requirement, but their **overall** total experience ('{{{parsedCv.totalExperience}}}') is greater than or equal to the required years, you MUST mark that requirement as **'Partially Aligned'**. Your justification MUST clearly state this, for example: "Partially aligned. While the candidate has less than the required 3 years of direct fire protection experience, their overall experience of 3.4 years meets the threshold."
*   **Strict Experience Comparison:** If a requirement is for a specific number of years (e.g., '8 years of experience'), and the candidate's total experience ('{{{parsedCv.totalExperience}}}') is less than the required number by *more than 3 months*, you MUST mark that requirement as **'Not Aligned'**.
*   **Experience Gap Exception:** If the candidate's total experience is less than the required number but the gap is **3 months or less**, you should mark that requirement as **'Partially Aligned'**. Your justification MUST clearly state the small gap (e.g., "Partially aligned, as they are only 2 months short of the required 5 years.").
*   **Infer Qualifications:** If a candidate lists a higher-level degree (e.g., a Master's or PhD), you MUST assume they have completed the prerequisite lower-level degree (a Bachelor's), even if the Bachelor's degree is not explicitly listed in their CV.
*   **Explicit "OR" Check for Education:** When an education requirement lists multiple degrees with "OR" (e.g., "Degree in A OR B"), you MUST check the CV for each degree option individually. If the candidate possesses **any one** of the listed degrees, you MUST mark the requirement as **'Aligned'**. Only mark it as 'Not Aligned' if you can confirm none of the options are met.
*   **Infer Responsibilities from Seniority:** Do not penalize candidates if their CV doesn't explicitly state a responsibility that is clearly implied by their job title. For example, if the requirement is 'provide guidance to peers' and the candidate's title is 'Senior Engineer', 'Lead', 'Coordinator' or 'Project Manager', you MUST infer that they perform this function and mark the requirement as **'Aligned'**. Justify this by referencing their title.
*   **Flexible NICE-TO-HAVE Assessment:** For requirements marked as 'NICE-TO-HAVE', be more flexible. If a candidate demonstrates proficiency (e.g., "good" or "proficient") but the requirement specifies a higher level (e.g., "excellent" or "expert"), you should mark this as **'Partially Aligned'**, not 'Not Aligned'.
*   **Handle Equivalencies:** Recognize and correctly interpret common abbreviations and equivalent terms. For example, 'B.Sc.' is a 'Bachelor of Science' and fully meets a 'Bachelor's degree' requirement. 'MS' is a 'Master's degree'.
*   **Avoid Overly Literal Matching:** Do not fail a candidate just because the wording in their CV isn't an exact verbatim match to the requirement. Focus on the substance and meaning.

**Final Output:**
Based on your detailed analysis, provide an overall alignment summary, a list of strengths, a list of weaknesses, and 2-3 suggested interview probes to explore weak areas. Do NOT provide a numeric score or a final recommendation like "Recommended". The final output must be a valid JSON object matching the provided schema.

Job Description Criteria:
{{{formattedCriteria}}}

Raw CV Text (for fallback text extraction if needed):
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
        parsedCv,
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
    
    // Programmatically override experience justifications to use the calculated value.
    if (parsedCv?.totalExperience && partialOutput?.alignmentDetails) {
      partialOutput.alignmentDetails.forEach(detail => {
        if (detail.category === 'Experience') {
          // Regex to find phrases like "X years of experience" in the justification.
          const experienceRegex = /(\d+(\.\d+)?\+?)\s*years?/i;
          if (experienceRegex.test(detail.justification)) {
            // Replace the AI's potentially incorrect text with the factual, calculated value.
            detail.justification = detail.justification.replace(
              experienceRegex,
              `a calculated total of ${parsedCv.totalExperience}`
            );
          }
        }
      });
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
