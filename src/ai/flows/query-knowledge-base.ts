'use server';
/**
 * @fileOverview Answers user queries about the entire knowledge base of JDs and CVs.
 *
 * - queryKnowledgeBase - A function that handles the query process.
 * - QueryKnowledgeBaseInput - The input type for the queryKnowledgeBase function.
 * - QueryKnowledgeBaseOutput - The return type for the queryKnowledgeBase function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';
import {
    QueryKnowledgeBaseInputSchema,
    QueryKnowledgeBaseOutputSchema,
    type QueryKnowledgeBaseInput,
    type QueryKnowledgeBaseOutput,
} from '@/lib/types';
import { withRetry } from '@/lib/retry';

export type { QueryKnowledgeBaseInput, QueryKnowledgeBaseOutput };

export async function queryKnowledgeBase(input: QueryKnowledgeBaseInput): Promise<QueryKnowledgeBaseOutput> {
  return queryKnowledgeBaseFlow(input);
}

const SummarizedDataSchema = z.object({
    query: z.string(),
    knowledgeBase: z.any() // Using any to avoid schema complexity in the prompt definition
});

const prompt = ai.definePrompt({
  name: 'queryKnowledgeBasePrompt',
  input: {schema: SummarizedDataSchema},
  output: {schema: QueryKnowledgeBaseOutputSchema},
  config: { temperature: 0.1 },
  prompt: `You are an expert recruitment data analyst. Your task is to answer a specific question based on the entire knowledge base of job descriptions and candidate assessments provided to you.

**Knowledge Base Context:**
You have been given a summarized JSON of "Assessment Sessions". Each session contains:
1.  A job title, code, department, and the original JD filename.
2.  A list of candidates who were assessed against that JD.
3.  Each candidate record includes their name, alignment score, final recommendation, strengths, and weaknesses.

**Your Task:**
- Analyze the user's query and the provided session data.
- Formulate a concise and accurate answer based *only* on the information in the knowledge base.
- If the answer requires aggregating data (e.g., "How many candidates know Python?"), do the aggregation and present the result clearly.
- If the information is not in the summary (e.g., specific dates from a CV, full text of a JD), state that you can only answer from the summarized data you have.
- If the answer cannot be found in the provided data at all, state that clearly.
- Use Markdown for all formatting (lists, bolding, tables).

**User's Question:**
"{{{query}}}"

**Knowledge Base Summary (JSON):**
{{{json knowledgeBase}}}

Your answer must be helpful and directly address the user's question, using only the provided data.
`,
});

const queryKnowledgeBaseFlow = ai.defineFlow(
  {
    name: 'queryKnowledgeBaseFlow',
    inputSchema: QueryKnowledgeBaseInputSchema,
    outputSchema: QueryKnowledgeBaseOutputSchema,
  },
  async (input: QueryKnowledgeBaseInput) => {
    
    // Create a summarized version of the data to pass to the prompt
    const knowledgeBase = input.sessions.map(session => ({
        jobTitle: session.analyzedJd.jobTitle,
        jobCode: session.analyzedJd.code,
        department: session.analyzedJd.department,
        jdName: session.jdName,
        candidateCount: session.candidates.length,
        candidates: session.candidates.map(c => ({
            name: c.analysis.candidateName,
            score: c.analysis.alignmentScore,
            recommendation: c.analysis.recommendation,
            strengths: c.analysis.strengths,
            weaknesses: c.analysis.weaknesses,
        })),
    }));

    const {output} = await withRetry(() => prompt({
        query: input.query,
        knowledgeBase,
    }));
    return output!;
  }
);
