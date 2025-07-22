
'use server';

/**
 * @fileOverview Analyzes multiple CVs in a single batch against a Job Description (JD).
 * This flow is designed to be more efficient by reducing the number of API calls.
 *
 * - bulkAnalyzeCVs - A function that handles the bulk analysis.
 * - BulkAnalyzeCVsInput - The input type for the function.
 * - BulkAnalyzeCVsOutput - The return type for the function.
 */

import {
  type BulkAnalyzeCVsInput,
  type BulkAnalyzeCVsOutput,
} from '@/lib/types';
import { analyzeCVAgainstJD } from './cv-analyzer';


export async function bulkAnalyzeCVs(input: BulkAnalyzeCVsInput): Promise<BulkAnalyzeCVsOutput> {
  const results = [];
  for (const candidate of input.candidates) {
    try {
      const analysis = await analyzeCVAgainstJD({
        jobDescriptionCriteria: input.jobDescriptionCriteria,
        cv: candidate.cv,
        // We pass null for parsedCv here as this bulk flow focuses on analysis.
        // The single-entry point in the UI will still handle parsing for the DB.
        parsedCv: null,
      });
      results.push({
        fileName: candidate.fileName,
        analysis,
        error: undefined,
      });
    } catch (error: any) {
      console.error(`Error analyzing CV for ${candidate.fileName} in bulk:`, error);
      results.push({
        fileName: candidate.fileName,
        analysis: null,
        error: `Failed to analyze: ${error.message}`,
      });
    }
  }

  return { results };
}

    