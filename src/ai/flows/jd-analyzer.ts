
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

const BaseJDCriteriaSchema = ExtractJDCriteriaOutputSchema.omit({ 
    formattedCriteria: true,
    education: true,
    experience: true,
    technicalSkills: true,
    softSkills: true,
    certifications: true,
    responsibilities: true,
    additionalRequirements: true,
}).extend({
    education: z.array(z.string()).describe('List of education requirements.'),
    experience: z.array(z.string()).describe('List of experience requirements.'),
    technicalSkills: z.array(z.string()).describe('List of technical skill requirements.'),
    softSkills: z.array(z.string()).describe('List of soft skill requirements.'),
    certifications: z.array(z.string()).describe('List of certification requirements.'),
    responsibilities: z.array(z.string()).describe('List of responsibilities.'),
});

const prompt = ai.definePrompt({
  name: 'extractJDCriteriaPrompt',
  input: {schema: ExtractJDCriteriaInputSchema},
  output: {schema: BaseJDCriteriaSchema},
  config: { temperature: 0.0 },
  prompt: `You are an expert recruiter. Please analyze the following job description.

First, extract the job title, the position/requisition number, the job code, the grade/level, and the department (if available).

Then, extract the key requirements as simple string arrays, categorizing them into technical skills, soft skills, experience, education, certifications, and responsibilities. Do NOT assign priority yet.

Job Description:
{{{jobDescription}}}

Ensure the output is a valid JSON object.`,
});

const getPriority = (category: string, description: string): Requirement['priority'] => {
    const niceToHaveKeywords = ['nice to have', 'preferred', 'plus', 'bonus', 'desirable', 'advantageous', 'good to have'];
    const lowerDesc = description.toLowerCase();

    if (niceToHaveKeywords.some(keyword => lowerDesc.includes(keyword))) {
        return 'NICE-TO-HAVE';
    }

    return 'MUST-HAVE';
};

const getCategoryWeight = (category: keyof ExtractJDCriteriaOutput): number => {
    switch(category) {
        case 'education':
        case 'experience':
            return 20; // Most Critical
        case 'certifications':
        case 'technicalSkills':
        case 'softSkills':
            return 15; // Critical
        case 'responsibilities':
            return 10; // Important
        case 'additionalRequirements':
            return 5; // Least Important
        default:
            return 5;
    }
}

const extractJDCriteriaFlow = ai.defineFlow(
  {
    name: 'extractJDCriteriaFlow',
    inputSchema: ExtractJDCriteriaInputSchema,
    outputSchema: ExtractJDCriteriaOutputSchema,
  },
  async input => {
    const {output: rawOutput} = await withRetry(() => prompt(input));
    
    if (!rawOutput) {
        throw new Error("JD Analysis failed to return a valid response.");
    }

    const { education, experience, technicalSkills, softSkills, responsibilities, certifications, ...rest } = rawOutput;
    
    const structuredData: Omit<ExtractJDCriteriaOutput, 'formattedCriteria'> = {
        ...rest,
        education: [], experience: [], technicalSkills: [], softSkills: [], responsibilities: [], certifications: [], additionalRequirements: []
    };
    
    const processCategory = (items: string[], category: keyof ExtractJDCriteriaOutput) => {
        if (!items || items.length === 0) return [];
        
        const defaultWeight = getCategoryWeight(category);

        return items.map((desc): Requirement => {
            const priority = getPriority(category.toString(), desc);
            const score = priority === 'MUST-HAVE' ? defaultWeight : Math.ceil(defaultWeight / 2);
            return {
                description: desc,
                priority: priority,
                score: score,
                defaultScore: score,
            };
        });
    };

    structuredData.education = processCategory(education, 'education');
    structuredData.experience = processCategory(experience, 'experience');
    structuredData.technicalSkills = processCategory(technicalSkills, 'technicalSkills');
    structuredData.softSkills = processCategory(softSkills, 'softSkills');
    structuredData.certifications = processCategory(certifications, 'certifications');
    structuredData.responsibilities = processCategory(responsibilities, 'responsibilities');
    
    const hasMustHaveCert = structuredData.certifications?.some(c => c.priority === 'MUST-HAVE');

    const formatSection = (title: string, items: Requirement[] | undefined) => {
        if (!items || items.length === 0) return '';
        return items.map(item => `- ${title} (${item.priority.replace('-', ' ')}): ${item.description}`).join('\n') + '\n';
    };

    let formattedCriteria = '';
    formattedCriteria += formatSection('Education', structuredData.education);
    formattedCriteria += formatSection('Experience', structuredData.experience);
    if (hasMustHaveCert) {
        formattedCriteria += formatSection('Certification', structuredData.certifications);
    }
    formattedCriteria += formatSection('Technical Skill', structuredData.technicalSkills);
    formattedCriteria += formatSection('Soft Skill', structuredData.softSkills);
    if (!hasMustHaveCert) {
        formattedCriteria += formatSection('Certification', structuredData.certifications);
    }
    formattedCriteria += formatSection('Responsibility', structuredData.responsibilities);

    return {
        ...structuredData,
        formattedCriteria: formattedCriteria.trim(),
    };
  }
);
