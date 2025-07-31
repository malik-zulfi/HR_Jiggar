
'use server';
/**
 * @fileOverview Job Description (JD) Analyzer AI agent. This flow also formats
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

const SingleRequirementSchema = z.object({
    description: z.string().describe("A single, distinct requirement."),
});

const GroupedRequirementSchema = z.object({
    groupType: z.enum(['OR']).describe("The type of grouping, indicating alternative paths."),
    requirements: z.array(SingleRequirementSchema).describe("The list of alternative requirements within this group, each as an object with a 'description' field."),
});

const FlexibleRequirementSchema = z.union([SingleRequirementSchema, GroupedRequirementSchema]);


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
    education: z.array(FlexibleRequirementSchema).optional().describe('List of education requirements.'),
    experience: z.array(FlexibleRequirementSchema).optional().describe('List of experience requirements.'),
    technicalSkills: z.array(FlexibleRequirementSchema).optional().describe('List of technical skill requirements.'),
    softSkills: z.array(FlexibleRequirementSchema).optional().describe('List of soft skill requirements.'),
    certifications: z.array(FlexibleRequirementSchema).optional().describe('List of certification requirements.'),
    responsibilities: z.array(FlexibleRequirementSchema).optional().describe('List of responsibilities.'),
});

const prompt = ai.definePrompt({
  name: 'extractJDCriteriaPrompt',
  input: {schema: ExtractJDCriteriaInputSchema},
  output: {schema: BaseJDCriteriaSchema},
  config: { temperature: 0.0 },
  prompt: `You are an expert recruiter. Please analyze the following job description.

First, extract the job title, the position/requisition number, the job code, the grade/level, and the department (if available). The job code MUST be one of 'OCN', 'WEX', or 'SAN'.

Then, extract the key requirements. For each requirement, determine if it is a single item or a conditional "OR" group.

**Requirement Extraction Rules:**

1.  **Identify "OR" Groups:** Look for explicit "OR" conditions. For example, "Bachelor's Degree OR 5 years of experience". When you find one, create a group with \`groupType: "OR"\` and list the alternative requirements as objects with a 'description' field in the \`requirements\` array.
2.  **Handle Associated Requirements:** If requirements are clearly linked within an "OR" condition (e.g., "Bachelor's degree in Law... with a minimum ten (10) years experience OR Chartered Professional Membership... with a minimum twelve (12) years experience"), you MUST treat each part of the "OR" statement as a complete, distinct requirement description within the group's \`requirements\` array. Do not split the degree from its associated experience.
3.  **Default to Single Items:** If a requirement is not part of an explicit "OR" group, extract it as an object with a 'description' field.
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

const validJobCodes = new Set(['OCN', 'WEX', 'SAN']);

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
    
    // Validate the extracted job code
    const validatedCode = rest.code && validJobCodes.has(rest.code.toUpperCase()) ? rest.code.toUpperCase() : undefined;

    const structuredData: Omit<ExtractJDCriteriaOutput, 'formattedCriteria' | 'code'> & { code?: string } = {
        ...rest,
        code: validatedCode,
        education: [], experience: [], technicalSkills: [], softSkills: [], responsibilities: [], certifications: [], additionalRequirements: []
    };
    
    const processCategory = (items: ({ description: string } | { groupType: 'OR'; requirements: { description: string }[] })[] | undefined, category: keyof typeof structuredData) => {
        if (!items || items.length === 0) return [];
        
        const defaultWeight = getCategoryWeight(category as any);

        return items.map((item): Requirement | RequirementGroup => {
            if ('description' in item) { // It's a single requirement
                const priority = getPriority(item.description);
                const score = priority === 'MUST-HAVE' ? defaultWeight : Math.ceil(defaultWeight / 2);
                return { description: item.description, priority, score, defaultScore: score };
            } else { // It's a group
                return {
                    groupType: 'OR',
                    requirements: item.requirements.map(req => {
                        const priority = getPriority(req.description);
                        const score = priority === 'MUST-HAVE' ? defaultWeight : Math.ceil(defaultWeight / 2);
                        return { description: req.description, priority, score, defaultScore: score };
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

    