
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


const FindSuitablePositionsPromptInput = z.object({
    candidates: z.array(CvDatabaseRecordSchema),
    assessmentSessions: z.array(AssessmentSessionSchema),
    existingSuitablePositions: FindSuitablePositionsInputSchema.shape.existingSuitablePositions,
});

const FindSuitablePositionsPromptOutput = z.object({
    suitableMatches: z.array(z.object({
        candidateEmail: z.string().describe("The email of the candidate who is a good fit."),
        assessmentSessionId: z.string().describe("The ID of the assessment session (job) for which the candidate is a fit."),
    })).describe("An array of all new, suitable matches found between candidates and jobs.")
});

const findSuitablePositionsPrompt = ai.definePrompt({
    name: 'findSuitablePositionsPrompt',
    input: { schema: FindSuitablePositionsPromptInput },
    output: { schema: FindSuitablePositionsPromptOutput },
    config: { temperature: 0.0 },
    prompt: `You are an expert recruitment assistant. Your task is to determine which job positions (Assessment Sessions) are a good fit for all the given candidates.

Candidates Information:
{{#each candidates}}
- Candidate Name: {{{this.name}}}
  Email: {{{this.email}}}
  CV Content: {{{this.cvContent}}}
---
{{/each}}


Available Job Positions (Assessment Sessions):
{{#each assessmentSessions}}
- Session ID: {{{this.id}}}
  Job Title: {{{this.analyzedJd.jobTitle}}}
  Job Code: {{{this.analyzedJd.code}}}
  Key Requirements: 
  {{#each this.analyzedJd.technicalSkills}}- {{this.description}} ({{this.priority}}){{/each}}
  {{#each this.analyzedJd.experience}}- {{this.description}} ({{this.priority}}){{/each}}
---
{{/each}}

Already Identified Positions (Existing Matches):
{{#each existingSuitablePositions}}
- Candidate {{this.candidateName}} ({{this.candidateEmail}}) is already matched with Session ID {{{this.assessment.id}}}.
{{/each}}

Instructions:
1.  Review every candidate's CV against every available job position.
2.  For each candidate-job pair, perform a high-level relevance check. Focus on core skills, recent job titles, and overall years of experience.
3.  A match is NOT suitable if the candidate's email and the session ID already appear in the "Already Identified Positions" list. You MUST NOT recommend a position that is already known to be suitable.
4.  A position is NOT suitable for a candidate if they have already been assessed for it. I have already filtered the 'Available Job Positions' list to exclude any jobs the candidate has already been assessed for. You do not need to perform this check again.
5.  Return a list of \`suitableMatches\` for all the job/candidate pairs you determine to be a good, new, unassessed fit.
`,
});

const findSuitablePositionsFlow = ai.defineFlow(
    {
        name: 'findSuitablePositionsFlow',
        inputSchema: FindSuitablePositionsInputSchema,
        outputSchema: FindSuitablePositionsOutputSchema,
    },
    async (input) => {
        const { candidates, assessmentSessions, existingSuitablePositions } = input;
        
        const candidatesWithUnassessedSessions = candidates.map(candidate => {
            const unassessedSessions = assessmentSessions.filter(session => {
                const hasMatchingJobCode = session.analyzedJd.code === candidate.jobCode;
                const isNotAssessed = !session.candidates.some(c => c.analysis.email?.toLowerCase() === candidate.email.toLowerCase());
                return hasMatchingJobCode && isNotAssessed;
            });
            return {
                candidate: candidate,
                unassessedSessions,
            };
        }).filter(c => c.unassessedSessions.length > 0);

        if (candidatesWithUnassessedSessions.length === 0) {
            return { newlyFoundPositions: [] };
        }

        let allSuitableMatches: FindSuitablePositionsOutput['newlyFoundPositions'] = [];

        for (const { candidate, unassessedSessions } of candidatesWithUnassessedSessions) {
            if (unassessedSessions.length === 0) continue;

            const { output } = await withRetry(() => findSuitablePositionsPrompt({
                candidates: [candidate],
                assessmentSessions: unassessedSessions,
                existingSuitablePositions: existingSuitablePositions,
            }));
            
            if (output && output.suitableMatches) {
                const positionsForCandidate = output.suitableMatches.map(match => {
                    const assessment = unassessedSessions.find(s => s.id === match.assessmentSessionId);
                    if (!assessment) return null;
                    return {
                        candidateEmail: candidate.email,
                        candidateName: candidate.name,
                        assessment,
                    };
                }).filter((p): p is FindSuitablePositionsOutput['newlyFoundPositions'][0] => p !== null);

                allSuitableMatches.push(...positionsForCandidate);
            }
        }
        
        return { newlyFoundPositions: allSuitableMatches };
    }
);

export async function findSuitablePositionsForCandidate(input: FindSuitablePositionsInput): Promise<FindSuitablePositionsOutput> {
    return findSuitablePositionsFlow(input);
}

    