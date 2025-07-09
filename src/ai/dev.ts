import { config } from 'dotenv';
config();

import '@/ai/flows/cv-analyzer.ts';
import '@/ai/flows/jd-analyzer.ts';
import '@/ai/flows/candidate-summarizer.ts';
import '@/ai/flows/ocr.ts';
import '@/ai/flows/name-extractor.ts';
import '@/ai/flows/query-candidate.ts';
