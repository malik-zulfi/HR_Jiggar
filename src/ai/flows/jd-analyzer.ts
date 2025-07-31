
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
  prompt: `You are an expert recruiter tasked with deconstructing a job description into a structured JSON format.

**Instructions:**

1.  **Extract Metadata:** Identify and extract the job title, position/requisition number, job code (must be one of 'OCN', 'WEX', or 'SAN'), grade/level, and department.

2.  **Extract Responsibilities:** From the "Major Activities Performed" section, extract each bullet point or distinct duty as a single requirement into the \`responsibilities\` array.

3.  **Extract Qualifications:** Analyze the "Experience and Qualifications" section and categorize every single point into the correct array below. Do not miss any.
    *   **\`education\`**: All educational requirements (e.g., "Bachelor’s Degree in a related field").
    *   **\`experience\`**: All experience-related requirements (e.g., "Minimum 5 years of experience in business continuity").
    *   **\`technicalSkills\`**: Specific software, tools, or quantifiable knowledge (e.g., "Proficiency in using business continuity software", "Knowledge of relevant laws").
    *   **\`softSkills\`**: Interpersonal abilities and personal attributes (e.g., "Excellent communication skills", "Ability to work under pressure", "Good command of English and Arabic").
    *   **\`certifications\`**: Any required or preferred certifications (e.g., "Relevant professional certification (e.g., CBCP, ISO 22301 Lead Implementer)").

4.  **"OR" Groups:** If you find a requirement with a clear "OR" condition (e.g., "Bachelor's Degree OR 5 years of experience"), you MUST create a group with \`groupType: "OR"\` and list the alternatives in the \`requirements\` array. Each alternative must be a complete description.

5.  **Formatting:**
    *   Every single requirement, whether standalone or in a group, must be an object with a \`description\` field (e.g., \`{ "description": "Excellent communication skills" }\`).
    *   Do NOT assign priority; this will be handled later.

**Job Description to Analyze:**
{{{jobDescription}}}

Ensure your output is a valid JSON object strictly following the provided schema, and that you have extracted and categorized every point from the JD.
`,
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
