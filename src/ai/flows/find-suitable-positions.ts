'use server';
/**
 * @fileOverview Finds suitable job positions for a given candidate using an AI tool.
 * 
 * - findSuitablePositionsForCandidate - A function that orchestrates finding suitable jobs for a new candidate.
 * - FindSuitablePositionsInput - The input type for the function.
 * - FindSuitablePositionsOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { 
    CvDatabaseRecordSchema, 
    AssessmentSessionSchema,
    FindSuitablePositionsInputSchema, 
    FindSuitablePositionsOutputSchema,
    type FindSuitablePositionsInput,
    type FindSuitablePositionsOutput
} from '@/lib/types';
import { withRetry } from '@/lib/retry';

export type { FindSuitablePositionsInput, FindSuitablePositionsOutput };

const findRelevantCandidatesTool = ai.defineTool(
    {
        name: 'findRelevantCandidates',
        description: 'Searches a database of candidate CVs to find those relevant to a specific job description.',
        inputSchema: z.object({
            jobDescription: z.string().describe("A concise summary of the job description, including title and key requirements."),
            cvDatabase: z.array(CvDatabaseRecordSchema).describe("The full database of candidates' CVs."),
        }),
        outputSchema: z.object({
            relevantCandidateEmails: z.array(z.string()).describe("A list of email addresses for candidates deemed relevant for the job."),
        }),
    },
    async ({ jobDescription, cvDatabase }) => {
        // In a real-world scenario, this could be a vector search or a more complex query.
        // For this implementation, we are simply returning all candidates with the same job code,
        // as the primary AI prompt will do the actual relevance filtering.
        // This tool acts as a pre-filter.
        const jobCodeMatch = jobDescription.match(/Job Code: (\w+)/);
        if (!jobCodeMatch) {
            return { relevantCandidateEmails: [] };
        }
        const jobCode = jobCodeMatch[1];
        const relevantCandidates = cvDatabase.filter(cv => cv.jobCode === jobCode);
        return {
            relevantCandidateEmails: relevantCandidates.map(c => c.email),
        };
    }
);


const FindSuitablePositionsPromptInput = z.object({
    candidate: CvDatabaseRecordSchema,
    assessmentSessions: z.array(AssessmentSessionSchema),
    existingSuitablePositions: FindSuitablePositionsInputSchema.shape.existingSuitablePositions,
});

const FindSuitablePositionsPromptOutput = z.object({
    // The output is a list of session IDs, which we will map back to full AssessmentSession objects.
    suitableSessionIds: z.array(z.string()).describe("An array of session IDs for which the candidate is a relevant fit."),
});

const findSuitablePositionsPrompt = ai.definePrompt({
    name: 'findSuitablePositionsPrompt',
    input: { schema: FindSuitablePositionsPromptInput },
    output: { schema: FindSuitablePositionsPromptOutput },
    tools: [findRelevantCandidatesTool],
    config: { temperature: 0.1 },
    prompt: `You are an expert recruitment assistant. Your task is to determine which job positions (Assessment Sessions) are a good fit for a given candidate.

Candidate Information:
- Name: {{{candidate.name}}}
- Email: {{{candidate.email}}}
- Current Role: {{{candidate.currentTitle}}} at {{{candidate.currentCompany}}}
- Total Experience: {{{candidate.totalExperience}}}
- CV Content:
{{{candidate.cvContent}}}

Available Job Positions (Assessment Sessions):
{{#each assessmentSessions}}
- Session ID: {{{this.id}}}
  Job Title: {{{this.analyzedJd.jobTitle}}}
  Job Code: {{{this.analyzedJd.code}}}
  Department: {{{this.analyzedJd.department}}}
  Key Requirements: 
  {{#each this.analyzedJd.technicalSkills}}- {{this.description}} ({{this.priority}}){{/each}}
  {{#each this.analyzedJd.experience}}- {{this.description}} ({{this.priority}}){{/each}}
{{/each}}

Already Identified Positions:
{{#each existingSuitablePositions}}
- Candidate {{this.candidateName}} is already known to be suitable for Session ID {{{this.assessment.id}}}.
{{/each}}

Instructions:
1.  Review the candidate's CV and the list of available job positions.
2.  For each job position, perform a high-level relevance check. Focus on core skills, recent job titles, and overall years of experience.
3.  A position is NOT suitable if the candidate's email and the session ID already appear in the "Already Identified Positions" list. You MUST NOT recommend a position that is already known to be suitable.
4.  A position is NOT suitable if the candidate has already been assessed for it. You can check this by seeing if the candidate's name or email appears in the list of assessed candidates for a given session.
5.  Return a list of \`suitableSessionIds\` for all the job positions you determine to be a good, new, unassessed fit for the candidate.
`,
});

const findSuitablePositionsFlow = ai.defineFlow(
    {
        name: 'findSuitablePositionsFlow',
        inputSchema: FindSuitablePositionsInputSchema,
        outputSchema: FindSuitablePositionsOutputSchema,
    },
    async (input) => {
        const { candidate, assessmentSessions, existingSuitablePositions } = input;

        // Filter out sessions where the candidate has already been assessed.
        const unassessedSessions = assessmentSessions.filter(session => 
            !session.candidates.some(c => c.cvContent.toLowerCase().includes(candidate.email.toLowerCase()))
        );

        if (unassessedSessions.length === 0) {
            return { newlyFoundPositions: [] };
        }

        const { output } = await withRetry(() => findSuitablePositionsPrompt({
            candidate,
            assessmentSessions: unassessedSessions,
            existingSuitablePositions,
        }));

        if (!output || !output.suitableSessionIds || output.suitableSessionIds.length === 0) {
            return { newlyFoundPositions: [] };
        }

        const newlyFoundPositions = output.suitableSessionIds
            .map(sessionId => {
                const assessment = assessmentSessions.find(s => s.id === sessionId);
                if (!assessment) return null;
                return {
                    candidateEmail: candidate.email,
                    candidateName: candidate.name,
                    assessment,
                };
            })
            .filter((p): p is FindSuitablePositionsOutput['newlyFoundPositions'][0] => p !== null);

        return { newlyFoundPositions };
    }
);

export async function findSuitablePositionsForCandidate(input: FindSuitablePositionsInput): Promise<FindSuitablePositionsOutput> {
    return findSuitablePositionsFlow(input);
}
