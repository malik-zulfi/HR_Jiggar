'use server';

const MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 1000;

/**
 * Retries a function that returns a Promise if it fails with a specific transient error.
 * @param fn The asynchronous function to execute.
 * @returns The result of the function if it succeeds.
 * @throws The last error if all retries fail, or the first non-retryable error.
 */
export async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: any;

  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      return await fn();
    } catch (error: any) {
      const errorMessage = error.message || '';
      // Check if the error message indicates a transient, retryable error
      if (errorMessage.includes('503') || errorMessage.toLowerCase().includes('overloaded') || errorMessage.includes('Schema validation failed')) {
        lastError = error;
        const delay = INITIAL_DELAY_MS * Math.pow(2, i);
        console.log(`Attempt ${i + 1} failed with a transient error. Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        // If it's a different kind of error, rethrow it immediately
        throw error;
      }
    }
  }
  
  // If all retries have been exhausted, throw the last captured error
  console.error("All retry attempts failed. The last error was:", lastError);
  throw new Error(`The AI service is temporarily unavailable after multiple retries. Please try again later.`);
}
