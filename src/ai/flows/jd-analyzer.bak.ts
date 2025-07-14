
'use server';
/**
 * @fileOverview Job Description (JD) Analyzer AI agent. This flow now also formats
 * the criteria into a pre-formatted string for use in other prompts and can group
 * requirements that represent conditional "OR" paths.
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
    type RequirementGroup,
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

const BaseRequirementSchema = z.object({
    description: z.string(),
});

const GroupedRequirementSchema = z.object({
    groupType: z.enum(['OR']),
    requirements: z.array(z.string()),
});

const FlexibleRequirementSchema = z.union([BaseRequirementSchema.shape.description, GroupedRequirementSchema]);

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
    education: z.array(FlexibleRequirementSchema).describe('List of education requirements.'),
    experience: z.array(FlexibleRequirementSchema).describe('List of experience requirements.'),
    technicalSkills: z.array(FlexibleRequirementSchema).describe('List of technical skill requirements.'),
    softSkills: z.array(FlexibleRequirementSchema).describe('List of soft skill requirements.'),
    certifications: z.array(FlexibleRequirementSchema).describe('List of certification requirements.'),
    responsibilities: z.array(FlexibleRequirementSchema).describe('List of responsibilities.'),
});

const prompt = ai.definePrompt({
  name: 'extractJDCriteriaPrompt',
  input: {schema: ExtractJDCriteriaInputSchema},
  output: {schema: BaseJDCriteriaSchema},
  config: { temperature: 0.0 },
  prompt: `You are an expert recruiter. Please analyze the following job description.

First, extract the job title, the position/requisition number, the job code, the grade/level, and the department (if available).

Then, extract the key requirements. For each requirement, determine if it is a single item or a conditional "OR" group.

**Requirement Extraction Rules:**

1.  **Identify "OR" Groups:** Look for explicit "OR" conditions. For example, "Bachelor's Degree OR 5 years of experience". When you find one, create a group with \`groupType: "OR"\` and list the alternative requirements as simple strings in the \`requirements\` array.
2.  **Handle Associated Requirements:** If requirements are linked to an "OR" condition (e.g., "Bachelor's degree with 5 years experience OR Master's degree with 3 years experience"), you MUST group them correctly. The group should contain two strings: "Bachelor's degree with 5 years experience" and "Master's degree with 3 years experience".
3.  **Default to Single Items:** If a requirement is not part of an explicit "OR" group, extract it as a simple string.
4.  **Categorize:** Place each single requirement or requirement group into the most appropriate category: technical skills, soft skills, experience, education, certifications, or responsibilities. Do NOT assign priority yet.

Job Description:
{{{jobDescription}}}

Ensure the output is a valid JSON object.`,
});

const getPriority = (description: string): Requirement['priority'] => {
    const niceToHaveKeywords = ['nice to have', 'preferred', 'plus', 'bonus', 'desirable', 'advantageous', 'good to have'];
    const lowerDesc = description.toLowerCase();

    if (niceToHaveKeywords.some(keyword => lowerDesc.includes(keyword))) {
        return 'NICE-TO-HAVE';
    }

    return 'MUST-HAVE';
};

const getCategoryWeight = (category: keyof Omit<ExtractJDCriteriaOutput, 'jobTitle' | 'positionNumber' | 'code' | 'grade' | 'department' | 'formattedCriteria'>): number => {
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
    
    const processCategory = (items: (string | { groupType: 'OR'; requirements: string[] })[] | undefined, category: keyof typeof structuredData) => {
        if (!items || items.length === 0) return [];
        
        const defaultWeight = getCategoryWeight(category as any);

        return items.map((item): Requirement | RequirementGroup => {
            if (typeof item === 'string') {
                const priority = getPriority(item);
                const score = priority === 'MUST-HAVE' ? defaultWeight : Math.ceil(defaultWeight / 2);
                return { description: item, priority, score, defaultScore: score };
            } else { // It's a group
                return {
                    groupType: 'OR',
                    requirements: item.requirements.map(desc => {
                        const priority = getPriority(desc);
                        const score = priority === 'MUST-HAVE' ? defaultWeight : Math.ceil(defaultWeight / 2);
                        return { description: desc, priority, score, defaultScore: score };
                    })
                };
            }
        });
    };

    structuredData.education = processCategory(education, 'education');
    structuredData.experience = processCategory(experience, 'experience');
    structuredData.technicalSkills = processCategory(technicalSkills, 'technicalSkills');
    structuredData.softSkills = processCategory(softSkills, 'softSkills');
    structuredData.certifications = processCategory(certifications, 'certifications');
    structuredData.responsibilities = processCategory(responsibilities, 'responsibilities');
    
    const hasMustHaveCert = structuredData.certifications?.some(c => {
        if ('groupType' in c) {
            return c.requirements.some(r => r.priority === 'MUST-HAVE');
        }
        return 'priority' in c && c.priority === 'MUST-HAVE'
    });

    const formatSection = (title: string, items: (Requirement | RequirementGroup)[] | undefined) => {
        if (!items || items.length === 0) return '';
        return items.map(item => {
            if ('groupType' in item) {
                const groupPriority = item.requirements.some(r => r.priority === 'MUST-HAVE') ? 'MUST-HAVE' : 'NICE-TO-HAVE';
                return `- ${title} (${groupPriority.replace('-', ' ')}): ${item.requirements.map(r => r.description).join(' OR ')}`;
            }
            return `- ${title} (${item.priority.replace('-', ' ')}): ${item.description}`;
        }).join('\n') + '\n';
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
