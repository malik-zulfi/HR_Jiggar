
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
} from '@/lib/types';

const AnalyzeCVAgainstJDInputSchema = z.object({
  jobDescriptionCriteria: ExtractJDCriteriaOutputSchema.describe('The structured job description criteria to analyze against.'),
  cv: z.string().describe('The CV to analyze.'),
});
export type AnalyzeCVAgainstJDInput = z.infer<typeof AnalyzeCVAgainstJDInputSchema>;

export type { AnalyzeCVAgainstJDOutput };

export async function analyzeCVAgainstJD(input: AnalyzeCVAgainstJDInput): Promise<AnalyzeCVAgainstJDOutput> {
  return analyzeCVAgainstJDFlow(input);
}

const DynamicCriteriaPromptInputSchema = z.object({
    formattedCriteria: z.string().describe('The dynamically ordered, formatted list of job description criteria.'),
    cv: z.string().describe('The CV to analyze.'),
});

const analyzeCVAgainstJDPrompt = ai.definePrompt({
  name: 'analyzeCVAgainstJDPrompt',
  input: {
    schema: DynamicCriteriaPromptInputSchema,
  },
  output: {
    schema: AnalyzeCVAgainstJDOutputSchema,
  },
  prompt: `You are a candidate assessment specialist. Analyze the following CV against the structured job description criteria. Your analysis must be intelligent and inferential, not just a simple text match.

**Analysis Steps:**

1.  **Extract Candidate Name:** First, extract the candidate's full name from the CV. Format the name in Title Case (e.g., "John Doe").

2.  **Assess Each Requirement:**
    *   For each requirement in the job description criteria, assess the candidate's CV.
    *   Determine if the candidate is 'Aligned', 'Partially Aligned', 'Not Aligned', or 'Not Mentioned'.
    *   Provide a brief justification for your assessment for each requirement, citing evidence from the CV.

**Important Reasoning Rules:**

*   **Handle Equivalencies:** Recognize and correctly interpret common abbreviations and equivalent terms. For example, 'B.Sc.' is a 'Bachelor of Science' and fully meets a 'Bachelor's degree' requirement. 'MS' is a 'Master's degree'.
*   **Infer Qualifications:** If a candidate lists a higher-level degree (e.g., a Master's or PhD), you MUST assume they have completed the prerequisite lower-level degree (a Bachelor's), even if the Bachelor's degree is not explicitly listed in their CV.
*   **Avoid Overly Literal Matching:** Do not fail a candidate just because the wording in their CV isn't an exact verbatim match to the requirement. Focus on the substance and meaning. If the requirement is 'Bachelor’s degree in Civil / Structural Engineering' and the CV lists 'B.Sc. in Civil Engineering', that is a clear 'Aligned' match.
*   **Handle "Or" Conditions:** If a requirement contains multiple options (e.g., 'degree in A or B', 'experience with X or Y'), meeting ANY ONE of the options means the candidate is 'Aligned' with that requirement. Do not mark it as 'Partially Aligned' if only one option is met.

**Critical Disqualification Rule:**
If a candidate is assessed as 'Not Aligned' with ANY 'MUST-HAVE' requirement from the 'Experience' or 'Education' categories, they are automatically disqualified. In this case, you MUST set the overall recommendation to 'Not Recommended', regardless of any other strengths.

**Final Output:**
Provide an overall alignment summary, a recommendation (Strongly Recommended, Recommended with Reservations, or Not Recommended), a list of strengths, a list of weaknesses, and 2-3 suggested interview probes to explore weak areas. The final output must be a valid JSON object matching the provided schema.

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
    const { jobDescriptionCriteria, cv } = input;
    const { education, experience, technicalSkills, softSkills, responsibilities, certifications } = jobDescriptionCriteria;
    
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


    const {output} = await analyzeCVAgainstJDPrompt({
        formattedCriteria,
        cv
    });

    if (output) {
      output.candidateName = toTitleCase(output.candidateName);

      // Programmatic Score Calculation
      const allRequirements = [
        ...jobDescriptionCriteria.education, 
        ...jobDescriptionCriteria.experience, 
        ...jobDescriptionCriteria.technicalSkills, 
        ...jobDescriptionCriteria.softSkills, 
        ...jobDescriptionCriteria.certifications, 
        ...jobDescriptionCriteria.responsibilities
      ];

      let maxScore = 0;
      allRequirements.forEach(req => {
          maxScore += req.priority === 'MUST-HAVE' ? 10 : 5;
      });

      let candidateScore = 0;
      output.alignmentDetails.forEach(detail => {
        if (detail.status === 'Aligned') {
            candidateScore += detail.priority === 'MUST-HAVE' ? 10 : 5;
        } else if (detail.status === 'Partially Aligned') {
            candidateScore += detail.priority === 'MUST-HAVE' ? 3 : 1;
        }
      });
      
      output.alignmentScore = maxScore > 0 ? Math.round((candidateScore / maxScore) * 100) : 0;


      // Enforce the disqualification rule programmatically as a safeguard
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
      }
    }
    return output!;
  }
);
