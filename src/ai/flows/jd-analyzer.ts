
'use server';
/**
 * @fileOverview Job Description (JD) Analyzer AI agent. This flow extracts
 * all relevant information from a JD into a highly structured format.
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
    RequirementGroupSchema,
} from '@/lib/types';
import { withRetry } from '@/lib/retry';
import {v4 as uuidv4} from 'uuid';

const ExtractJDCriteriaInputSchema = z.object({
  jobDescription: z.string().describe('The Job Description to analyze.'),
});
export type ExtractJDCriteriaInput = z.infer<typeof ExtractJDCriteriaInputSchema>;

export type { ExtractJDCriteriaOutput };

export async function extractJDCriteria(input: ExtractJDCriteriaInput): Promise<ExtractJDCriteriaOutput> {
  return extractJDCriteriaFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractJDCriteriaPromptV4',
  input: {schema: ExtractJDCriteriaInputSchema},
  output: {schema: ExtractJDCriteriaOutputSchema},
  config: { temperature: 0.0 },
  prompt: `You are an expert recruitment data analyst. Your task is to meticulously deconstruct a job description into a structured JSON format.

**Instructions:**

1.  **Full Extraction**: You MUST extract information for every field in the provided JSON schema.
2.  **"Not Found"**: If you cannot find information for a specific field, you MUST use the string "Not Found". For arrays, if no items are found, return an empty array.
3.  **Prioritization & Scoring**:
    *   For each requirement, you MUST classify it as either \`MUST_HAVE\` or \`NICE_TO_HAVE\`.
    *   A requirement is NICE_TO_HAVE if it uses keywords like "preferred", "plus", "bonus", "nice to have", "advantage", or "will be a plus".
    *   All other requirements are considered MUST_HAVE by default.
    *   Assign a \`score\` of **10** for every MUST_HAVE requirement.
    *   Assign a \`score\` of **5** for every NICE_TO_HAVE requirement.
4.  **Unique IDs**: For every single requirement you extract (in any category), you MUST assign a unique 'id' string.
5.  **Requirement Grouping (Education & Certifications ONLY)**:
    *   For the 'Education' and 'Certifications' categories, you MUST group requirements.
    *   If a requirement contains an "OR" condition (e.g., "Bachelor's OR Master's degree"), create a group with \`groupType: 'ANY'\` and place each option as a separate requirement inside it.
    *   If a requirement is standalone, create a group with \`groupType: 'ALL'\` and place the single requirement inside it.
    *   All other categories (Skills, Responsibilities, etc.) should NOT be grouped and should just be a flat list of requirements.
6.  **Experience Field**: For the \`Requirements.Experience.MUST_HAVE.Years\` field, extract the number of years as a string (e.g., "5+ years"). For \`Requirements.Experience.NICE_TO_HAVE\`, extract each point as an object with 'id', 'description', etc.
7.  **Organizational Relationship**: Extract reporting lines and interfaces into their respective arrays.
8.  **Follow Schema Strictly**: Your final output must be a valid JSON object that strictly adheres to the provided output schema.

**Job Description to Analyze:**
{{{jobDescription}}}
`,
});

const extractJDCriteriaFlow = ai.defineFlow(
  {
    name: 'extractJDCriteriaFlow',
    inputSchema: ExtractJDCriteriaInputSchema,
    outputSchema: ExtractJDCriteriaOutputSchema,
  },
  async input => {
    const {output} = await withRetry(() => prompt(input));
    
    if (!output) {
        throw new Error("JD Analysis failed to return a valid response.");
    }
    
    // Post-process to add unique IDs and original values if they are missing
    const processRequirements = (reqs: any[]) => {
        return reqs.map(r => ({
            ...r,
            id: r.id || uuidv4(),
            originalScore: r.score,
            originalPriority: r.priority,
        }));
    };
    
    const processGroupedRequirements = (groups: any[]) => {
        return groups.map(g => ({
            ...g,
            requirements: processRequirements(g.requirements || []),
        }));
    };

    const processCategory = (category: any) => {
        if (!category) return;
        if (category.MUST_HAVE && Array.isArray(category.MUST_HAVE) && category.MUST_HAVE.some((i: any) => i.groupType)) {
             category.MUST_HAVE = processGroupedRequirements(category.MUST_HAVE);
        } else if (category.MUST_HAVE) {
            category.MUST_HAVE = processRequirements(category.MUST_HAVE);
        }

        if (category.NICE_TO_HAVE && Array.isArray(category.NICE_TO_HAVE) && category.NICE_TO_HAVE.some((i: any) => i.groupType)) {
            category.NICE_TO_HAVE = processGroupedRequirements(category.NICE_TO_HAVE);
        } else if (category.NICE_TO_HAVE) {
            category.NICE_TO_HAVE = processRequirements(category.NICE_TO_HAVE);
        }
    };
    
    processCategory(output.Responsibilities);
    processCategory(output.Requirements.TechnicalSkills);
    processCategory(output.Requirements.SoftSkills);
    processCategory(output.Requirements.Education);
    processCategory(output.Requirements.Certifications);
    if(output.Requirements.Experience.NICE_TO_HAVE) {
        output.Requirements.Experience.NICE_TO_HAVE = processRequirements(output.Requirements.Experience.NICE_TO_HAVE);
    }
    if (output.Requirements.AdditionalRequirements) {
        processCategory(output.Requirements.AdditionalRequirements);
    }
    
    const validatedCode = output.JobCode && ['OCN', 'WEX', 'SAN'].includes(output.JobCode.toUpperCase()) 
        ? output.JobCode.toUpperCase() 
        : "Not Found";

    return {
        ...output,
        JobCode: validatedCode,
    };
  }
);
