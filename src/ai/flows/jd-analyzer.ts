
'use server';
/**
 * @fileOverview Job Description (JD) Analyzer AI agent. This flow now also formats
 * the criteria into a pre-formatted string for use in other prompts.
 *
 * - extractJDCriteria - A function that handles the JD criteria extraction process.
 * - ExtractJDCriteriaInput - The input type for the extractJDCriteria function.
 * - ExtractJDCriteriaOutput - The return type for the extractJDCriteria function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { 
    ExtractJDCriteriaOutputSchema, 
    type ExtractJDCriteriaOutput,
    type Requirement, 
} from '@/lib/types';
import { withRetry } from '@/lib/retry';

const ExtractJDCriteriaInputSchema = z.object({
  jobDescription: z.string().describe('The Job Description to analyze.'),
});
export type ExtractJDCriteriaInput = z.infer<typeof ExtractJDCriteriaInputSchema>;

export type { ExtractJDCriteriaOutput };

export async function extractJDCriteria(input: ExtractJDCriteriaInput): Promise<ExtractJDCriteriaOutput> {
  return extractJDCriteriaFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractJDCriteriaPrompt',
  input: {schema: ExtractJDCriteriaInputSchema},
  // The prompt only extracts the raw data, the formatted string is created in the flow.
  output: {schema: ExtractJDCriteriaOutputSchema.omit({ formattedCriteria: true })},
  config: { temperature: 0.0 },
  prompt: `You are an expert recruiter. Please analyze the following job description.

First, extract the job title, the position/requisition number, the job code, the grade/level, and the department (if available).

Then, extract the key requirements, categorizing them into technical skills, soft skills, experience, education, certifications, and responsibilities.
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
    const {output: partialOutput} = await withRetry(() => prompt(input));
    
    if (!partialOutput) {
        throw new Error("JD Analysis failed to return a valid response.");
    }

    // Now, create the formatted criteria string
    const { education, experience, technicalSkills, softSkills, responsibilities, certifications, additionalRequirements } = partialOutput;

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

    return {
        ...partialOutput,
        formattedCriteria: formattedCriteria.trim(),
    };
  }
);
