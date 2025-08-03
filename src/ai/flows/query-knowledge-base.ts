
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
    type ChatMessage,
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
    chatHistory: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string() })).optional(),
    knowledgeBase: z.any(), // Using any to avoid schema complexity in the prompt definition
    currentDate: z.string(),
});

const prompt = ai.definePrompt({
  name: 'queryKnowledgeBasePrompt',
  input: {schema: SummarizedDataSchema},
  output: {schema: QueryKnowledgeBaseOutputSchema},
  config: { temperature: 0.0 },
  prompt: `You are an expert recruitment data analyst. Your task is to answer a specific question based on the entire knowledge base provided to you, maintaining the context of the ongoing conversation.

**Knowledge Base Context:**
*   "Assessment Sessions": Contains all job descriptions and the candidates assessed for each.
*   "CV Database": The master list of all individual candidates in the system. Each candidate has a pre-calculated 'totalExperience' field that was set when their CV was parsed.

**Important Reasoning Rules:**
*   **Experience Calculations:**
    - The 'totalExperience' field in cvDatabase is a static value from when the CV was parsed
    - Always show both:
      1. Current calculation: Using the current date ({{{currentDate}}}) for "Present" positions
      2. Pre-calculated total: Include 'totalExperience' with its calculation date in a note
    - When showing experience breakdowns in tables:
      - Calculate current durations up to present date
      - Add a footer note showing the pre-calculated experience and when it was calculated
    - If the pre-calculated value is more than 3 months old, suggest re-parsing the CV
*   **Use Conversation History**: Refer to the \`chatHistory\` to understand the context of the user's current query. Answer follow-up questions based on previous interactions.

**Your Task:**
-   Analyze the user's query, the chat history, and the provided data.
-   Formulate a concise and accurate answer based *only* on the information in the knowledge base and conversation.
-   If the answer cannot be found, state that clearly.
-   Use Markdown for formatting (lists, bolding, tables).
-   **Linking Rules (VERY IMPORTANT):**
    -   When you mention a candidate, link to their profile: \`[Candidate Name](/cv-database?email=CANDIDATE_EMAIL_HERE)\`.
    -   When you mention an assessment, link to it: \`[Assessment Name](/assessment?sessionId=SESSION_ID_HERE)\`.

**Conversation History:**
{{#each chatHistory}}
- {{{this.role}}}: {{{this.content}}}
{{/each}}

**User's Current Question:**
"{{{query}}}"

**Knowledge Base (JSON):**
{{{json knowledgeBase}}}

Your answer must be helpful and directly address the user's question, using only the provided data and conversation context.
`,
});

const queryKnowledgeBaseFlow = ai.defineFlow(
  {
    name: 'queryKnowledgeBaseFlow',
    inputSchema: QueryKnowledgeBaseInputSchema,
    outputSchema: QueryKnowledgeBaseOutputSchema,
  },
  async (input: QueryKnowledgeBaseInput) => {
    
    const { query, sessions, cvDatabase, chatHistory } = input;
    
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
            experienceCalculatedAt: cv.experienceCalculatedAt,
            cvContent: cv.cvContent,
            structuredContent: cv.structuredContent,
        })),
    };

    const {output} = await withRetry(() => prompt({
        query: query,
        chatHistory: chatHistory,
        knowledgeBase,
        currentDate: new Date().toDateString(),
    }));
    
    if (!output) {
      throw new Error("The AI failed to generate a valid response (schema validation failed). Please try asking your question in a different way.");
    }

    return output;
  }
);
