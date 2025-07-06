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

// Copied from jd-analyzer.ts to avoid circular dependency
const RequirementSchema = z.object({
  description: z.string().describe('Description of the requirement.'),
  priority: z.enum(['MUST-HAVE', 'NICE-TO-HAVE']).describe('Priority of the requirement.'),
});

const JDCriteriaSchema = z.object({
  technicalSkills: z.array(RequirementSchema),
  softSkills: z.array(RequirementSchema),
  experience: z.array(RequirementSchema),
  education: z.array(RequirementSchema),
  certifications: z.array(RequirementSchema),
  responsibilities: z.array(RequirementSchema),
});

const AnalyzeCVAgainstJDInputSchema = z.object({
  jobDescriptionCriteria: JDCriteriaSchema.describe('The structured job description criteria to analyze against.'),
  cv: z.string().describe('The CV to analyze.'),
});
export type AnalyzeCVAgainstJDInput = z.infer<typeof AnalyzeCVAgainstJDInputSchema>;

const AlignmentDetailSchema = z.object({
  category: z.string().describe("The category of the requirement (e.g., Technical Skills, Experience)."),
  requirement: z.string().describe("The specific requirement from the job description."),
  priority: z.enum(['MUST-HAVE', 'NICE-TO-HAVE']).describe('Priority of the requirement.'),
  status: z.enum(['Aligned', 'Partially Aligned', 'Not Aligned', 'Not Mentioned']).describe('The alignment status of the candidate for this requirement.'),
  justification: z.string().describe('A brief justification for the alignment status, with evidence from the CV.'),
});
export type AlignmentDetail = z.infer<typeof AlignmentDetailSchema>;


const AnalyzeCVAgainstJDOutputSchema = z.object({
  candidateName: z.string().describe('The full name of the candidate as extracted from the CV.'),
  alignmentSummary: z
    .string()
    .describe("A summary of the candidate's alignment with the job description requirements."),
  alignmentDetails: z.array(AlignmentDetailSchema).describe('A detailed, requirement-by-requirement alignment analysis.'),
  recommendation: z.enum([
    'Strongly Recommended',
    'Recommended with Reservations',
    'Not Recommended',
  ]).describe('The recommendation for the candidate.'),
  strengths: z.array(z.string()).describe('The strengths of the candidate.'),
  weaknesses: z.array(z.string()).describe('The weaknesses of the candidate.'),
  interviewProbes: z.array(z.string()).describe('Suggested interview probes to explore weak areas.'),
});
export type AnalyzeCVAgainstJDOutput = z.infer<typeof AnalyzeCVAgainstJDOutputSchema>;

export async function analyzeCVAgainstJD(input: AnalyzeCVAgainstJDInput): Promise<AnalyzeCVAgainstJDOutput> {
  return analyzeCVAgainstJDFlow(input);
}

const analyzeCVAgainstJDPrompt = ai.definePrompt({
  name: 'analyzeCVAgainstJDPrompt',
  input: {
    schema: AnalyzeCVAgainstJDInputSchema,
  },
  output: {
    schema: AnalyzeCVAgainstJDOutputSchema,
  },
  prompt: `You are a candidate assessment specialist. Analyze the following CV against the structured job description criteria.

First, extract the candidate's full name from the CV.

Then, for each requirement in the job description criteria, assess the candidate's CV.
Determine if the candidate is 'Aligned', 'Partially Aligned', or 'Not Aligned' with the requirement. If the CV does not contain information about a requirement, mark it as 'Not Mentioned'.
Provide a brief justification for your assessment for each requirement, citing evidence from the CV where possible.

Finally, provide an overall alignment summary, a recommendation (Strongly Recommended, Recommended with Reservations, or Not Recommended), a list of strengths, a list of weaknesses, and 2-3 suggested interview probes to explore weak areas.

Job Description Criteria:
{{#each jobDescriptionCriteria.technicalSkills}}
- Technical Skill ({{this.priority}}): {{{this.description}}}
{{/each}}
{{#each jobDescriptionCriteria.softSkills}}
- Soft Skill ({{this.priority}}): {{{this.description}}}
{{/each}}
{{#each jobDescriptionCriteria.experience}}
- Experience ({{this.priority}}): {{{this.description}}}
{{/each}}
{{#each jobDescriptionCriteria.education}}
- Education ({{this.priority}}): {{{this.description}}}
{{/each}}
{{#each jobDescriptionCriteria.certifications}}
- Certification ({{this.priority}}): {{{this.description}}}
{{/each}}
{{#each jobDescriptionCriteria.responsibilities}}
- Responsibility ({{this.priority}}): {{{this.description}}}
{{/each}}

CV:
{{{cv}}}

Your analysis should be thorough but concise. The final output must be a valid JSON object matching the provided schema.
Follow these formatting instructions:
* Justify every conclusion with direct evidence from the CV.
* Maintain a neutral, analytical tone.
* Be concise but thorough.`,
});

const analyzeCVAgainstJDFlow = ai.defineFlow(
  {
    name: 'analyzeCVAgainstJDFlow',
    inputSchema: AnalyzeCVAgainstJDInputSchema,
    outputSchema: AnalyzeCVAgainstJDOutputSchema,
  },
  async input => {
    const {output} = await analyzeCVAgainstJDPrompt(input);
    return output!;
  }
);
