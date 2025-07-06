'use server';

/**
 * @fileOverview Analyzes a CV against a Job Description (JD) to identify alignment,
 * gaps, and provide a recommendation with suggested interview probes.
 *
 * - analyzeCVAgainstJD - A function that analyzes the CV against the JD.
 * - AnalyzeCVAgainstJDInput - The input type for the analyzeCVAgainstJD function.
 * - AnalyzeCVAgainstJDOutput - The return type for the analyzeCVAgainstJD function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzeCVAgainstJDInputSchema = z.object({
  jobDescription: z.string().describe('The job description to analyze against.'),
  cv: z.string().describe('The CV to analyze.'),
});
export type AnalyzeCVAgainstJDInput = z.infer<typeof AnalyzeCVAgainstJDInputSchema>;

const AnalyzeCVAgainstJDOutputSchema = z.object({
  candidateName: z.string().describe('The full name of the candidate as extracted from the CV.'),
  alignmentSummary: z
    .string()
    .describe("A summary of the candidate's alignment with the job description requirements."),
  recommendation: z.enum([
    'Strongly Recommended',
    'Recommended with Reservations',
    'Not Recommended',
  ]).describe('The recommendation for the candidate.'),
  strengths: z.array(z.string()).describe('The strengths of the candidate.'),
  weaknesses: z.array(z.string()).describe('The weaknesses of the candidate.'),
  interviewProbes: z.array(z.string()).describe('Suggested interview probes to explore weak areas.'),
});
export type AnalyzeCVAgainstJDOutput = z.infer<typeof AnalyzeCVAgainstJDOutputSchema>;

export async function analyzeCVAgainstJD(input: AnalyzeCVAgainstJDInput): Promise<AnalyzeCVAgainstJDOutput> {
  return analyzeCVAgainstJDFlow(input);
}

const analyzeCVAgainstJDPrompt = ai.definePrompt({
  name: 'analyzeCVAgainstJDPrompt',
  input: {
    schema: AnalyzeCVAgainstJDInputSchema,
  },
  output: {
    schema: AnalyzeCVAgainstJDOutputSchema,
  },
  prompt: `You are a candidate assessment specialist. Analyze the following CV against the job description.
  
  First, extract the candidate's full name from the CV.
  
  Then, provide an alignment summary, a recommendation, strengths, weaknesses, and suggested interview probes.

Job Description:
{{jobDescription}}

CV:
{{cv}}

Alignment summary should be a concise paragraph summarizing how well the candidate's experience and skills align with the key requirements of the job description.
Recommendation should be one of: Strongly Recommended, Recommended with Reservations, or Not Recommended.
Strengths should be a list of the candidate's strengths based on the job description.
Weaknesses should be a list of the candidate's weaknesses based on the job description.
Interview probes should be a list of 2-3 suggested interview questions to ask the candidate about their weaknesses.

Follow these formatting instructions:
* Use clear bullet points and formatting for lists.
* Justify every conclusion with direct evidence from the CV.
* Maintain a neutral, analytical tone.
* Be concise but thorough.`,
});

const analyzeCVAgainstJDFlow = ai.defineFlow(
  {
    name: 'analyzeCVAgainstJDFlow',
    inputSchema: AnalyzeCVAgainstJDInputSchema,
    outputSchema: AnalyzeCVAgainstJDOutputSchema,
  },
  async input => {
    const {output} = await analyzeCVAgainstJDPrompt(input);
    return output!;
  }
);
