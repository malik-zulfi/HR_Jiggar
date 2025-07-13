
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
  ParseCvOutputSchema,
  type ParseCvOutput,
} from '@/lib/types';
import { withRetry } from '@/lib/retry';
import { extractCandidateName } from './name-extractor';

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

const DynamicCriteriaPromptInputSchema = z.object({
    formattedCriteria: z.string().describe('The dynamically ordered, formatted list of job description criteria.'),
    cv: z.string().describe('The CV to analyze.'),
    candidateName: z.string().optional().describe("The candidate's full name, if already parsed."),
    candidateEmail: z.string().optional().describe("The candidate's email, if already parsed."),
    totalExperience: z.string().nullable().optional().describe("The candidate's pre-calculated total years of experience (e.g., '8.5 years'). Use this value directly when assessing experience requirements."),
});

// The prompt will only return the analysis part. Score and recommendation are calculated programmatically.
const AnalyzeCVAgainstJDPromptOutputSchema = AnalyzeCVAgainstJDOutputSchema.omit({
    alignmentScore: true,
    recommendation: true,
    processingTime: true,
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

*   **Use Pre-Calculated Experience:** When assessing experience-related requirements, you MUST use the provided total years of experience ('{{{totalExperience}}}') as the primary source of truth. Do not re-calculate it from the CV text.
*   **Strict Experience Comparison:** If a requirement is for a specific number of years (e.g., '8 years of experience'), and the candidate's total experience ('{{{totalExperience}}}') is less than the required number, you MUST mark that requirement as 'Not Aligned'. There is no partial alignment if the candidate falls short on a year-based requirement.
*   **Consider Transferable Experience:** If a candidate does not have direct, relevant experience for a specific requirement, but their total years of experience are equal to or greater than the required amount, you should consider them 'Partially Aligned'. This is especially true if their existing skills are transferable to the role in question. Justify this by mentioning their total experience and transferable skills.
*   **Handle Equivalencies:** Recognize and correctly interpret common abbreviations and equivalent terms. For example, 'B.Sc.' is a 'Bachelor of Science' and fully meets a 'Bachelor's degree' requirement. 'MS' is a 'Master's degree'.
*   **Infer Qualifications:** If a candidate lists a higher-level degree (e.g., a Master's or PhD), you MUST assume they have completed the prerequisite lower-level degree (a Bachelor's), even if the Bachelor's degree is not explicitly listed in their CV.
*   **Avoid Overly Literal Matching:** Do not fail a candidate just because the wording in their CV isn't an exact verbatim match to the requirement. Focus on the substance and meaning. If the requirement is 'Bachelor’s degree in Civil / Structural Engineering' and the CV lists 'B.Sc. in Civil Engineering', that is a clear 'Aligned' match.
*   **Handle "Or" Conditions:** If a requirement contains multiple options (e.g., 'degree in A or B', 'experience with X or Y'), meeting ANY ONE of the options means the candidate is 'Aligned' with that requirement. Do not mark it as 'Partially Aligned' if only one option is met.

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

const analyzeCVAgainstJDFlow = ai.defineFlow(
  {
    name: 'analyzeCVAgainstJDFlow',
    inputSchema: AnalyzeCVAgainstJDInputSchema,
    outputSchema: AnalyzeCVAgainstJDOutputSchema,
  },
  async input => {
    const startTime = Date.now();
    const { jobDescriptionCriteria, cv, parsedCv } = input;
    const { education, experience, technicalSkills, softSkills, responsibilities, certifications, additionalRequirements } = jobDescriptionCriteria;
    
    const hasMustHaveCert = certifications?.some(c => c.priority === 'MUST-HAVE');

    const formatSection = (title: string, items: Requirement[] | undefined) => {
        if (!items || items.length === 0) return '';
        return items.map(item => `- ${title} (${item.priority.replace('-', ' ')}): ${item.description}`).join('\n') + '\n';
    };

    let formattedCriteria = '';
    formattedCriteria += formatSection('Education', education);
    formattedCriteria += formatSection('Experience', experience);
    if (hasMustHaveCert) {
        formattedCriteria += formatSection('Certification', certifications);
    }
    formattedCriteria += formatSection('Technical Skill', technicalSkills);
    formattedCriteria += formatSection('Soft Skill', softSkills);
    if (!hasMustHaveCert) {
        formattedCriteria += formatSection('Certification', certifications);
    }
    formattedCriteria += formatSection('Responsibility', responsibilities);
    formattedCriteria += formatSection('Additional Requirement', additionalRequirements);

    const {output: partialOutput} = await withRetry(() => analyzeCVAgainstJDPrompt({
        formattedCriteria,
        cv,
        candidateName: parsedCv?.name,
        candidateEmail: parsedCv?.email,
        totalExperience: parsedCv?.totalExperience,
    }));

    // If the model couldn't extract the name (and it wasn't provided), try a fallback.
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
        alignmentScore: 0, // Will be calculated next
        recommendation: 'Not Recommended', // Will be calculated next
    };


    // Programmatic Score Calculation
    let maxScore = 0;
    const calculateMaxScore = (reqs: Requirement[] | undefined, isResponsibility = false) => {
      if (!reqs) return;
      reqs.forEach(req => {
          if (req.priority === 'MUST-HAVE') {
              maxScore += isResponsibility ? 5 : 10;
          } else { // NICE-TO-HAVE
              maxScore += 5;
          }
      });
    };

    calculateMaxScore(jobDescriptionCriteria.education);
    calculateMaxScore(jobDescriptionCriteria.experience);
    calculateMaxScore(jobDescriptionCriteria.technicalSkills);
    calculateMaxScore(jobDescriptionCriteria.softSkills);
    calculateMaxScore(jobDescriptionCriteria.certifications);
    calculateMaxScore(jobDescriptionCriteria.responsibilities, true);
    calculateMaxScore(jobDescriptionCriteria.additionalRequirements);

    let candidateScore = 0;
    output.alignmentDetails.forEach(detail => {
      const isResponsibility = detail.category.toLowerCase().includes('responsibility');
      if (detail.status === 'Aligned') {
          if (detail.priority === 'MUST-HAVE') {
              candidateScore += isResponsibility ? 5 : 10;
          } else { // NICE-TO-HAVE
              candidateScore += 5;
          }
      } else if (detail.status === 'Partially Aligned') {
          if (detail.priority === 'MUST-HAVE') {
              candidateScore += isResponsibility ? 1 : 3;
          } else { // NICE-TO-HAVE
              candidateScore += 1;
          }
      }
    });
    
    output.alignmentScore = maxScore > 0 ? Math.round((candidateScore / maxScore) * 100) : 0;


    // Programmatic Recommendation and Disqualification
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

    