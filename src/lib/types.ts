import { z } from 'zod';

// For JD Analyzer
export const RequirementSchema = z.object({
  description: z.string().describe('Description of the requirement.'),
  priority: z.enum(['MUST-HAVE', 'NICE-TO-HAVE']).describe('Priority of the requirement.'),
});
export type Requirement = z.infer<typeof RequirementSchema>;

export const ExtractJDCriteriaOutputSchema = z.object({
  technicalSkills: z.array(RequirementSchema).describe('Technical skills requirements.'),
  softSkills: z.array(RequirementSchema).describe('Soft skills requirements.'),
  experience: z.array(RequirementSchema).describe('Experience requirements.'),
  education: z.array(RequirementSchema).describe('Education requirements.'),
  certifications: z.array(RequirementSchema).describe('Certification requirements.'),
  responsibilities: z.array(RequirementSchema).describe('Responsibilities listed in the job description.'),
});
export type ExtractJDCriteriaOutput = z.infer<typeof ExtractJDCriteriaOutputSchema>;


// For CV Analyzer
export const AlignmentDetailSchema = z.object({
  category: z.string().describe("The category of the requirement (e.g., Technical Skills, Experience)."),
  requirement: z.string().describe("The specific requirement from the job description."),
  priority: z.enum(['MUST-HAVE', 'NICE-TO-HAVE']).describe('Priority of the requirement.'),
  status: z.enum(['Aligned', 'Partially Aligned', 'Not Aligned', 'Not Mentioned']).describe('The alignment status of the candidate for this requirement.'),
  justification: z.string().describe('A brief justification for the alignment status, with evidence from the CV.'),
});
export type AlignmentDetail = z.infer<typeof AlignmentDetailSchema>;

export const AnalyzeCVAgainstJDOutputSchema = z.object({
  candidateName: z.string().describe('The full name of the candidate as extracted from the CV.'),
  alignmentSummary: z
    .string()
    .describe("A summary of the candidate's alignment with the job description requirements."),
  alignmentDetails: z.array(AlignmentDetailSchema).describe('A detailed, requirement-by-requirement alignment analysis.'),
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

// This is an alias used in the client components
export type AnalyzedCandidate = AnalyzeCVAgainstJDOutput;


// For Candidate Summarizer
const CandidateAssessmentSchema = z.object({
  candidateName: z.string().describe('The name of the candidate.'),
  recommendation: z
    .enum(['Strongly Recommended', 'Recommended with Reservations', 'Not Recommended'])
    .describe('The overall recommendation for the candidate.'),
  strengths: z.array(z.string()).describe('A list of strengths of the candidate.'),
  weaknesses: z.array(z.string()).describe('A list of weaknesses of the candidate.'),
  interviewProbes: z
    .array(z.string())
    .describe('Suggested interview probes to explore weak/unclear areas.'),
});

export const CandidateSummaryInputSchema = z.object({
  candidateAssessments: z.array(CandidateAssessmentSchema).describe('An array of candidate assessments.'),
  jobDescriptionCriteria: ExtractJDCriteriaOutputSchema.describe('The structured job description criteria.'),
});
export type CandidateSummaryInput = z.infer<typeof CandidateSummaryInputSchema>;

export const CandidateSummaryOutputSchema = z.object({
  topTier: z.array(z.string()).describe('Candidates categorized as Top Tier.'),
  midTier: z.array(z.string()).describe('Candidates categorized as Mid Tier.'),
  notSuitable: z.array(z.string()).describe('Candidates categorized as Not Suitable.'),
  commonStrengths: z.array(z.string()).describe('Common strengths among the candidates.'),
  commonGaps: z.array(z.string()).describe('Common gaps among the candidates.'),
  interviewStrategy: z.string().describe('A suggested interview strategy.'),
});
export type CandidateSummaryOutput = z.infer<typeof CandidateSummaryOutputSchema>;

// For OCR
export const OcrInputSchema = z.object({
  image: z.string().describe("The image to perform OCR on, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."),
});
export type OcrInput = z.infer<typeof OcrInputSchema>;

export const OcrOutputSchema = z.object({
  text: z.string().describe('The extracted text from the image.'),
});
export type OcrOutput = z.infer<typeof OcrOutputSchema>;

// For session history
export const CandidateRecordSchema = z.object({
    cvName: z.string(),
    cvContent: z.string(),
    analysis: AnalyzeCVAgainstJDOutputSchema,
});
export type CandidateRecord = z.infer<typeof CandidateRecordSchema>;

export const AssessmentSessionSchema = z.object({
    id: z.string(),
    jdName: z.string(),
    analyzedJd: ExtractJDCriteriaOutputSchema,
    candidates: z.array(CandidateRecordSchema),
    summary: CandidateSummaryOutputSchema.nullable(),
    createdAt: z.string().datetime(),
});
export type AssessmentSession = z.infer<typeof AssessmentSessionSchema>;
