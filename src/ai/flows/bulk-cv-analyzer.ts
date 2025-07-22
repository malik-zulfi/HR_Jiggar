
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
      // The client-side logic now handles parsing and providing the parsedCv object.
      // This flow can be simplified to just call the single analyzer.
      const analysis = await analyzeCVAgainstJD({
        jobDescriptionCriteria: input.jobDescriptionCriteria,
        cv: candidate.cv,
        // The client will now handle parsing and can pass the parsed data if available.
        // For this bulk flow, we assume it might not be pre-parsed, so we pass null.
        // The single analysis flow is robust enough to handle this.
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

    