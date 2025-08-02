
import { z } from 'zod';

export const RequirementSchema = z.object({
  id: z.string().describe("A unique identifier for the requirement, e.g., 'req-1'."),
  description: z.string().describe("The text of the requirement."),
  priority: z.enum(['MUST_HAVE', 'NICE_TO_HAVE']).describe("The priority of the requirement."),
  score: z.number().describe("The point value assigned to this requirement."),
  originalScore: z.number().describe("The original point value assigned by the AI to track user edits."),
  originalPriority: z.enum(['MUST_HAVE', 'NICE_TO_HAVE']).describe("The original priority to track user edits."),
});
export type Requirement = z.infer<typeof RequirementSchema>;


// NEW: JD Analyzer V2 Schemas
const OrganizationalRelationshipSchema = z.object({
  ReportsTo: z.array(z.string()).describe("List of roles this position reports to."),
  InterfacesWith: z.array(z.string()).describe("List of roles/departments this position interfaces with.")
}).describe("Defines the position's place in the organization.");

const RequirementsSubSchema = z.object({
  MUST_HAVE: z.array(RequirementSchema).describe("List of must-have requirements for this category."),
  NICE_TO_HAVE: z.array(RequirementSchema).describe("List of nice-to-have requirements for this category.")
});

const ExperienceSchema = z.object({
  MUST_HAVE: z.object({
    Years: z.string().describe("The minimum number of years of experience required."),
    Fields: z.array(z.string()).describe("The specific fields or domains of experience required.")
  }),
  NICE_TO_HAVE: z.array(RequirementSchema).describe("Nice-to-have experience requirements.")
});

const RequirementsSchema = z.object({
  TechnicalSkills: RequirementsSubSchema,
  SoftSkills: RequirementsSubSchema,
  Experience: ExperienceSchema,
  Education: RequirementsSubSchema,
  Certifications: RequirementsSubSchema,
}).describe("Detailed breakdown of all job requirements.");

export const ExtractJDCriteriaOutputSchema = z.object({
  PositionNumber: z.string().describe("The unique position number for the job. 'Not Found' if not available."),
  JobCode: z.string().describe("The internal job code (e.g., OCN, WEX, SAN). 'Not Found' if not available."),
  PayGrade: z.string().describe("The job grade or level. 'Not Found' if not available."),
  JobTitle: z.string().describe("The title of the job position. 'Not Found' if not available."),
  Department: z.string().describe("The department or team. 'Not Found' if not available."),
  Company: z.string().describe("The company name. 'Not Found' if not available."),
  Location: z.string().describe("The work location. 'Not Found' if not available."),
  DateApproved: z.string().describe("The date the JD was approved. 'Not Found' if not available."),
  PrincipalObjective: z.string().describe("The principal objective or summary of the job."),
  OrganizationalRelationship: OrganizationalRelationshipSchema,
  Responsibilities: RequirementsSubSchema,
  Requirements: RequirementsSchema,
});
export type ExtractJDCriteriaOutput = z.infer<typeof ExtractJDCriteriaOutputSchema>;


// For CV Analyzer
export const AlignmentDetailSchema = z.object({
  category: z.string().describe("The category of the requirement (e.g., Technical Skills, Experience)."),
  requirement: z.string().describe("The specific requirement from the job description. For grouped requirements, this will be a summary of the group."),
  priority: z.enum(['MUST_HAVE', 'NICE_TO_HAVE']).describe('Priority of the requirement.'),
  status: z.enum(['Aligned', 'Partially Aligned', 'Not Aligned', 'Not Mentioned']).describe('The alignment status of the candidate for this requirement.'),
  justification: z.string().describe('A brief justification for the alignment status, with evidence from the CV.'),
  score: z.number().optional().describe('The score awarded for this specific requirement.'),
  maxScore: z.number().optional().describe('The maximum possible score for this requirement.'),
});
export type AlignmentDetail = z.infer<typeof AlignmentDetailSchema>;

export const AnalyzeCVAgainstJDOutputSchema = z.object({
  candidateName: z.string().describe('The full name of the candidate as extracted from the CV.'),
  email: z.string().optional().describe("The candidate's primary email address, extracted from the CV."),
  totalExperience: z.string().nullable().optional().describe("The candidate's total years of experience, pre-calculated from the CV."),
  experienceCalculatedAt: z.string().optional().describe("The date when the total experience was calculated."),
  alignmentScore: z.number().describe('The overall alignment score of the candidate, from 0 to 100.'),
  candidateScore: z.number().optional().describe('The raw score awarded to the candidate.'),
  maxScore: z.number().optional().describe('The maximum possible raw score for the assessment.'),
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
export type AnalyzedCandidate = z.infer<typeof AnalyzeCVAgainstJDOutputSchema>;


// For Candidate Summarizer
export const CandidateAssessmentSchema = z.object({
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


// For Global Knowledge Base Query
export const ChatMessageSchema = z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const QueryKnowledgeBaseInputSchema = z.object({
  query: z.string().describe("The user's question about the knowledge base."),
  sessions: z.array(z.lazy(() => AssessmentSessionSchema)).describe('The entire history of assessment sessions, including all JDs and candidates.'),
  cvDatabase: z.array(z.lazy(() => CvDatabaseRecordSchema)).describe("The central database of all parsed CVs, including those not yet assessed."),
  chatHistory: z.array(ChatMessageSchema).optional().describe('The history of the current conversation.'),
});
export type QueryKnowledgeBaseInput = z.infer<typeof QueryKnowledgeBaseInputSchema>;

export const QueryKnowledgeBaseOutputSchema = z.object({
  answer: z.string().describe('The answer to the user query based on the provided data.'),
});
export type QueryKnowledgeBaseOutput = z.infer<typeof QueryKnowledgeBaseOutputSchema>;


// For session history
export const CandidateRecordSchema = z.object({
    cvName: z.string(),
    cvContent: z.string(),
    analysis: AnalyzeCVAgainstJDOutputSchema,
    isStale: z.boolean().optional(),
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
    email: z.string().describe("Candidate's email, used as a unique identifier."),
    name: z.string().describe("Candidate's full name."),
    contactNumber: z.string().optional().describe("Candidate's contact number."),
    linkedinUrl: z.string().optional().describe("URL to the candidate's LinkedIn profile."),
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

// For Suitability/Relevance Checker
export type SuitablePosition = {
    candidateEmail: string;
    candidateName: string;
    assessment: AssessmentSession;
};

export const FindSuitablePositionsInputSchema = z.object({
  candidates: z.array(CvDatabaseRecordSchema).describe('The candidates to find positions for.'),
  assessmentSessions: z.array(AssessmentSessionSchema).describe('A list of all available assessment sessions (jobs).'),
  existingSuitablePositions: z.array(z.object({ // Cannot use SuitablePosition type directly due to circular reference issues with Zod/TS
      candidateEmail: z.string(),
      candidateName: z.string(),
      assessment: AssessmentSessionSchema,
  })).describe('A list of positions already identified as suitable to avoid duplicates.'),
});
export type FindSuitablePositionsInput = z.infer<typeof FindSuitablePositionsInputSchema>;


export const FindSuitablePositionsOutputSchema = z.object({
  newlyFoundPositions: z.array(z.object({ // Cannot use SuitablePosition type directly here
      candidateEmail: z.string(),
      candidateName: z.string(),
      assessment: AssessmentSessionSchema,
  })).describe('A list of newly identified suitable positions for the candidate.'),
});
export type FindSuitablePositionsOutput = z.infer<typeof FindSuitablePositionsOutputSchema>;
