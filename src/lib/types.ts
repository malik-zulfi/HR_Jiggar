
import { z } from 'zod';

// For JD Analyzer
export const RequirementSchema = z.object({
  description: z.string().describe('Description of the requirement.'),
  priority: z.enum(['MUST-HAVE', 'NICE-TO-HAVE']).describe('Priority of the requirement.'),
});
export type Requirement = z.infer<typeof RequirementSchema>;

export const ExtractJDCriteriaOutputSchema = z.object({
  jobTitle: z.string().optional().describe('The title of the job position.'),
  positionNumber: z.string().optional().describe('The position or requisition number, if available.'),
  code: z.string().optional().describe('The internal job code, if available.'),
  grade: z.string().optional().describe('The job grade or level, if available.'),
  department: z.string().optional().describe('The department or team for the position, if available.'),
  technicalSkills: z.array(RequirementSchema).describe('Technical skills requirements.'),
  softSkills: z.array(RequirementSchema).describe('Soft skills requirements.'),
  experience: z.array(RequirementSchema).describe('Experience requirements.'),
  education: z.array(RequirementSchema).describe('Education requirements.'),
  certifications: z.array(RequirementSchema).describe('Certification requirements.'),
  responsibilities: z.array(RequirementSchema).describe('Responsibilities listed in the job description.'),
  additionalRequirements: z.array(RequirementSchema).optional().describe('User-added requirements that can be deleted.'),
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
  alignmentScore: z.number().describe('The overall alignment score of the candidate, from 0 to 100.'),
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
  processingTime: z.number().optional().describe('The time taken to process the CV in seconds.'),
});
export type AnalyzeCVAgainstJDOutput = z.infer<typeof AnalyzeCVAgainstJDOutputSchema>;

export type AnalyzedCandidate = AnalyzeCVAgainstJDOutput;


// For Candidate Summarizer
const CandidateAssessmentSchema = z.object({
  candidateName: z.string().describe('The name of the candidate.'),
  alignmentScore: z.number().describe('The alignment score of the candidate.'),
  recommendation: z
    .enum(['Strongly Recommended', 'Recommended with Reservations', 'Not Recommended'])
    .describe('The overall recommendation for the candidate.'),
  strengths: z.array(z.string()).describe('A list of strengths of the candidate.'),
  weaknesses: z.array(z.string()).describe('A list of weaknesses of the candidate.'),
  interviewProbes: z
    .array(z.string())
    .describe('Suggested interview probes to explore weak/unclear areas.'),
  processingTime: z.number().optional().describe('The time taken to process the CV in seconds.'),
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

// For Name Extractor
export const ExtractCandidateNameInputSchema = z.object({
  cvText: z.string().describe('The full text content of the CV.'),
});
export type ExtractCandidateNameInput = z.infer<typeof ExtractCandidateNameInputSchema>;

export const ExtractCandidateNameOutputSchema = z.object({
  candidateName: z.string().describe('The extracted full name of the candidate.'),
});
export type ExtractCandidateNameOutput = z.infer<typeof ExtractCandidateNameOutputSchema>;


// For Candidate Query
export const QueryCandidateInputSchema = z.object({
  cvContent: z.string().describe("The full text content of the candidate's CV."),
  jobDescriptionCriteria: ExtractJDCriteriaOutputSchema.describe('The structured job description criteria.'),
  query: z.string().describe("The user's question about the candidate."),
});
export type QueryCandidateInput = z.infer<typeof QueryCandidateInputSchema>;

export const QueryCandidateOutputSchema = z.object({
  answer: z.string().describe('The answer to the user query based on the CV and JD.'),
});
export type QueryCandidateOutput = z.infer<typeof QueryCandidateOutputSchema>;


// For Global Knowledge Base Query
export const QueryKnowledgeBaseInputSchema = z.object({
  query: z.string().describe("The user's question about the knowledge base."),
  sessions: z.array(z.lazy(() => AssessmentSessionSchema)).describe('The entire history of assessment sessions, including all JDs and candidates.'),
});
export type QueryKnowledgeBaseInput = z.infer<typeof QueryKnowledgeBaseInputSchema>;

export const QueryKnowledgeBaseOutputSchema = z.object({
  answer: z.string().describe('The answer to the user query based on the provided data.'),
});
export type QueryKnowledgeBaseOutput = z.infer<typeof QueryKnowledgeBaseOutputSchema>;


// For session history
export const ChatMessageSchema = z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const CandidateRecordSchema = z.object({
    cvName: z.string(),
    cvContent: z.string(),
    analysis: AnalyzeCVAgainstJDOutputSchema,
    isStale: z.boolean().optional(),
    chatHistory: z.array(ChatMessageSchema).optional(),
});
export type CandidateRecord = z.infer<typeof CandidateRecordSchema>;

export const AssessmentSessionSchema = z.object({
    id: z.string(),
    jdName: z.string(),
    originalAnalyzedJd: ExtractJDCriteriaOutputSchema.optional(),
    analyzedJd: ExtractJDCriteriaOutputSchema,
    candidates: z.array(CandidateRecordSchema),
    summary: CandidateSummaryOutputSchema.nullable(),
    createdAt: z.string().datetime(),
});
export type AssessmentSession = z.infer<typeof AssessmentSessionSchema>;


// For CV Database
export const StructuredCvContentSchema = z.object({
    summary: z.string().optional().describe("Professional summary or objective from the CV."),
    experience: z.array(z.object({
        jobTitle: z.string(),
        company: z.string(),
        location: z.string().optional(),
        dates: z.string(),
        description: z.array(z.string()),
    })).optional().describe("Detailed work experience."),
    education: z.array(z.object({
        degree: z.string(),
        institution: z.string(),
        dates: z.string().optional(),
    })).optional().describe("Educational background."),
    skills: z.array(z.string()).optional().describe("List of skills."),
    projects: z.array(z.object({
        name: z.string(),
        description: z.string(),
        technologies: z.array(z.string()).optional(),
    })).optional().describe("Projects listed on the CV."),
});
export type StructuredCvContent = z.infer<typeof StructuredCvContentSchema>;

export const CvDatabaseRecordSchema = z.object({
    email: z.string().email().describe("Candidate's email, used as a unique identifier."),
    name: z.string().describe("Candidate's full name."),
    contactNumber: z.string().optional().describe("Candidate's contact number."),
    linkedinUrl: z.string().url().optional().describe("URL to the candidate's LinkedIn profile."),
    currentTitle: z.string().optional().describe("Candidate's most recent job title."),
    currentCompany: z.string().optional().describe("Candidate's most recent company."),
    totalExperience: z.string().nullable().optional().describe("Total years of professional experience calculated from the CV."),
    jobCode: z.enum(['OCN', 'WEX', 'SAN']).describe("Job code associated with this CV upload."),
    cvFileName: z.string().describe("Original filename of the CV."),
    cvContent: z.string().describe("Full text content of the CV."),
    structuredContent: StructuredCvContentSchema.describe("The CV content, broken down into a structured format."),
    createdAt: z.string().datetime(),
});
export type CvDatabaseRecord = z.infer<typeof CvDatabaseRecordSchema>;

// Input for the new CV Parser flow
export const ParseCvInputSchema = z.object({
    cvText: z.string().describe('The full text content of the CV.'),
    currentDate: z.string().describe("The current date, for calculating experience from 'Present' roles."),
});
export type ParseCvInput = z.infer<typeof ParseCvInputSchema>;

// Output will be most of CvDatabaseRecordSchema, minus the fields the flow doesn't set itself.
export const ParseCvOutputSchema = CvDatabaseRecordSchema.omit({
    jobCode: true,
    cvFileName: true,
    cvContent: true,
    createdAt: true,
});
export type ParseCvOutput = z.infer<typeof ParseCvOutputSchema>;
