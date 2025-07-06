// use server'
'use server';
/**
 * @fileOverview Job Description (JD) Analyzer AI agent.
 *
 * - extractJDCriteria - A function that handles the JD criteria extraction process.
 * - ExtractJDCriteriaInput - The input type for the extractJDCriteria function.
 * - ExtractJDCriteriaOutput - The return type for the extractJDCriteria function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ExtractJDCriteriaInputSchema = z.object({
  jobDescription: z.string().describe('The Job Description to analyze.'),
});
export type ExtractJDCriteriaInput = z.infer<typeof ExtractJDCriteriaInputSchema>;

const RequirementSchema = z.object({
  description: z.string().describe('Description of the requirement.'),
  priority: z.enum(['MUST-HAVE', 'NICE-TO-HAVE']).describe('Priority of the requirement.'),
});

const ExtractJDCriteriaOutputSchema = z.object({
  technicalSkills: z.array(RequirementSchema).describe('Technical skills requirements.'),
  softSkills: z.array(RequirementSchema).describe('Soft skills requirements.'),
  experience: z.array(RequirementSchema).describe('Experience requirements.'),
  education: z.array(RequirementSchema).describe('Education requirements.'),
  certifications: z.array(RequirementSchema).describe('Certification requirements.'),
  responsibilities: z.array(RequirementSchema).describe('Responsibilities listed in the job description.'),
});
export type ExtractJDCriteriaOutput = z.infer<typeof ExtractJDCriteriaOutputSchema>;

export async function extractJDCriteria(input: ExtractJDCriteriaInput): Promise<ExtractJDCriteriaOutput> {
  return extractJDCriteriaFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractJDCriteriaPrompt',
  input: {schema: ExtractJDCriteriaInputSchema},
  output: {schema: ExtractJDCriteriaOutputSchema},
  prompt: `You are an expert recruiter. Please analyze the following job description and extract the key requirements, categorizing them into technical skills, soft skills, experience, education, certifications, and responsibilities.

For each requirement, indicate whether it is a MUST-HAVE or NICE-TO-HAVE.

Job Description:
{{{jobDescription}}}

Ensure the output is a valid JSON object.`,
});

const extractJDCriteriaFlow = ai.defineFlow(
  {
    name: 'extractJDCriteriaFlow',
    inputSchema: ExtractJDCriteriaInputSchema,
    outputSchema: ExtractJDCriteriaOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
