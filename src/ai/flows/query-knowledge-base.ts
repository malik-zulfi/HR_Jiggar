
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
    currentDate: z.string(),
    knowledgeBase: z.any() // Using any to avoid schema complexity in the prompt definition
});

const prompt = ai.definePrompt({
  name: 'queryKnowledgeBasePrompt',
  input: {schema: SummarizedDataSchema},
  output: {schema: QueryKnowledgeBaseOutputSchema},
  config: { temperature: 0.1 },
  prompt: `You are an expert recruitment data analyst. Your task is to answer a specific question based on the entire knowledge base provided to you. The knowledge base has two main parts:

1.  **assessmentSessions**: A JSON array of "Assessment Sessions". Each session contains a job description and a list of candidates who were assessed against it.
2.  **cvDatabase**: A JSON array of all individual candidate records stored in the system, identified by their email. This is the master list of all candidates.

**Knowledge Base Context:**
*   An "Assessment Session" contains: a unique \`sessionId\`, job details, and a list of candidates assessed for that job, including their name, score, recommendation, and full CV text.
*   The "cvDatabase" contains: candidate contact details, their full CV content (\`cvContent\`), and their CV parsed into a structured format (\`structuredContent\`).

**Important Reasoning Rules:**
*   **Use the Right Data Source:** For questions about specific assessments (e.g., "Who scored highest for the developer job?"), use the \`assessmentSessions\`. For general questions about candidates (e.g., "Do we have any candidates with a PMP certification?"), you MUST search the entire \`cvDatabase\`.
*   **Calculate Experience for Current Roles:** If the user's question involves calculating work experience, you MUST use the CV content to find the employment dates. When a candidate's experience is listed as "Present", "Current", or "To Date", you must use today's date ({{{currentDate}}}) as the end date for that role when calculating their total years of experience.
*   **Handle Overlapping Experience:** When calculating total years of experience, you MUST identify all distinct employment periods from the CV. If there are overlapping date ranges (e.g., working two jobs at the same time), merge them to avoid double-counting. The total experience should be the sum of the unique, non-overlapping time periods.

**Your Task:**
- Analyze the user's query and the provided data.
- Formulate a concise and accurate answer based *only* on the information in the knowledge base.
- If the answer requires aggregating data (e.g., "How many candidates know Python?"), do the aggregation and present the result clearly.
- If the answer cannot be found in the provided data at all, state that clearly.
- Use Markdown for all formatting (lists, bolding, tables).
- **Important**: When you mention a specific assessment session, job, or candidate that belongs to a session, you MUST create a Markdown link for it. The link should allow the user to navigate to that assessment. The format for the link MUST be \`[link text](/assessment?sessionId=SESSION_ID_HERE)\`, where \`SESSION_ID_HERE\` is the \`sessionId\` from the knowledge base summary.

**User's Question:**
"{{{query}}}"

**Knowledge Base (JSON):**
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
    
    const { query, sessions, cvDatabase } = input;
    
    // Create a summarized version of the data to pass to the prompt
    const knowledgeBase = {
        assessmentSessions: sessions.map(session => ({
            sessionId: session.id,
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
                cvContent: c.cvContent,
            })),
        })),
        cvDatabase: cvDatabase.map(cv => ({
            name: cv.name,
            email: cv.email,
            jobCode: cv.jobCode,
            currentTitle: cv.currentTitle,
            totalExperience: cv.totalExperience,
            cvContent: cv.cvContent,
            structuredContent: cv.structuredContent,
        })),
    };

    const currentDate = new Date().toDateString();

    const {output} = await withRetry(() => prompt({
        query: query,
        knowledgeBase,
        currentDate,
    }));
    
    if (!output) {
      throw new Error("The AI failed to generate a valid response. Please try asking your question in a different way.");
    }

    return output;
  }
);
