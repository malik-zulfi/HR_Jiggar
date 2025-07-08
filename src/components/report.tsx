import React from 'react';
import type { AnalyzedCandidate, CandidateSummaryOutput, ExtractJDCriteriaOutput, AlignmentDetail, Requirement } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ReportProps {
  summary: CandidateSummaryOutput;
  candidates: AnalyzedCandidate[];
  analyzedJd: ExtractJDCriteriaOutput;
}

const RequirementList = ({ title, requirements }: { title: string; requirements: Requirement[] | undefined }) => {
  if (!requirements || requirements.length === 0) return null;
  return (
    <div className="mb-4 break-inside-avoid">
      <h3 className="text-xl font-bold mb-2 text-gray-800">{title}</h3>
      <ul className="list-disc list-outside pl-5 space-y-1">
        {requirements.map((req, index) => (
          <li key={index} className="text-gray-700">
            {req.description} <span className="text-sm font-semibold">({req.priority.replace('-', ' ')})</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

const getRecommendationInfo = (recommendation: AnalyzedCandidate['recommendation']) => {
    switch (recommendation) {
        case 'Strongly Recommended': return 'bg-green-100 text-green-800';
        case 'Recommended with Reservations': return 'bg-yellow-100 text-yellow-800';
        case 'Not Recommended': return 'bg-red-100 text-red-800';
        default: return 'bg-gray-100 text-gray-800';
    }
};

const getScoreInfo = (score: number) => {
    if (score >= 75) return 'bg-green-100 text-green-800';
    if (score >= 40) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
};

const statusInfo: Record<AlignmentDetail['status'], { text: string; className: string }> = {
  'Aligned': { text: '✔', className: "text-green-700" },
  'Partially Aligned': { text: '!', className: "text-yellow-700" },
  'Not Aligned': { text: '✖', className: "text-red-700" },
  'Not Mentioned': { text: '?', className: "text-gray-700" },
};


const ReportLegend = () => (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-2 text-xs text-gray-600">
        <div className="flex items-center flex-wrap gap-x-4 gap-y-2">
            <span className="font-bold text-sm text-gray-800">Priority:</span>
            <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-red-700" />
                <span>Must Have</span>
            </div>
            <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-gray-500" />
                <span>Nice to Have</span>
            </div>
        </div>
        <div className="flex items-center flex-wrap gap-x-4 gap-y-2">
            <span className="font-bold text-sm text-gray-800">Status:</span>
            <div className="flex items-center gap-2">
                <span className="text-green-700 font-bold text-lg">✔</span>
                <span>Aligned</span>
            </div>
            <div className="flex items-center gap-2">
                <span className="text-yellow-700 font-bold text-lg">!</span>
                <span>Partially Aligned</span>
            </div>
            <div className="flex items-center gap-2">
                <span className="text-red-700 font-bold text-lg">✖</span>
                <span>Not Aligned</span>
            </div>
            <div className="flex items-center gap-2">
                <span className="text-gray-700 font-bold text-lg">?</span>
                <span>Not Mentioned</span>
            </div>
        </div>
    </div>
);

const ReportAlignmentTable = ({ details }: { details: AlignmentDetail[] }) => {
    const groupedDetails = details.reduce((acc, item) => {
        const category = item.category;
        if (!acc[category]) {
            acc[category] = [];
        }
        acc[category].push(item);
        return acc;
    }, {} as Record<string, AlignmentDetail[]>);

    const categoriesInOrder = [...new Set(details.map(d => d.category))];

    return (
        <div className="border border-gray-200 rounded-lg">
            <ReportLegend />
            <table className="w-full text-left border-collapse text-sm border-t border-gray-200">
                <thead>
                    <tr className="break-inside-avoid">
                        <th className="p-2 bg-gray-100 font-bold w-[45%]">Requirement</th>
                        <th className="p-2 bg-gray-100 font-bold w-[40%]">Justification</th>
                        <th className="p-2 bg-gray-100 font-bold w-[15%] text-center">Status</th>
                    </tr>
                </thead>
                <tbody>
                    {categoriesInOrder.map((category) => {
                        const items = groupedDetails[category];
                        if (!items || items.length === 0) return null;

                        return (
                            <React.Fragment key={category}>
                                <tr className="break-inside-avoid bg-gray-50">
                                    <td colSpan={3} className="p-2 font-bold text-gray-800 border-t border-b border-gray-200">
                                        {category}
                                    </td>
                                </tr>
                                {items.map((item, index) => {
                                    const info = statusInfo[item.status] || statusInfo['Not Mentioned'];
                                    return (
                                        <tr key={index} className="break-inside-avoid border-t border-gray-200">
                                            <td className="p-2 align-top">
                                                <div className="flex items-start gap-2">
                                                    <div className={cn(
                                                        "h-3 w-3 mt-1 rounded-full shrink-0",
                                                        item.priority === 'MUST-HAVE' ? 'bg-red-700' : 'bg-gray-500'
                                                    )} />
                                                    <span className="font-medium text-gray-800">{item.requirement}</span>
                                                </div>
                                            </td>
                                            <td className="p-2 align-top text-gray-600">{item.justification}</td>
                                            <td className={cn("p-2 align-top font-bold text-center text-lg", info.className)}>
                                                {info.text}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </React.Fragment>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};


export default function Report({ summary, candidates, analyzedJd }: ReportProps) {
  const hasMustHaveCert = analyzedJd.certifications?.some(c => c.priority === 'MUST-HAVE');

  return (
    <div id="pdf-report" className="p-8 bg-white text-black font-sans" style={{ width: '800px' }}>
      <style>{`
        #pdf-report {
          font-family: 'Inter', sans-serif;
          color: #111827;
        }
        .break-inside-avoid {
          break-inside: avoid;
        }
        .page-break {
          page-break-before: always;
        }
      `}</style>
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-gray-900">Candidate Assessment Report</h1>
        <p className="text-lg text-gray-600">A complete overview of all candidates and strategic recommendations.</p>
      </div>

      <div className="mb-8 p-4 border border-gray-200 rounded-lg break-inside-avoid">
        <h2 className="text-2xl font-bold mb-1 text-gray-800">{analyzedJd.jobTitle || 'Job Description Breakdown'}</h2>
        {analyzedJd.positionNumber && <p className="text-md text-gray-600 mb-4">Position #{analyzedJd.positionNumber}</p>}
        <div className="columns-2 gap-8">
            <RequirementList title="Education" requirements={analyzedJd.education} />
            <RequirementList title="Experience" requirements={analyzedJd.experience} />
            {hasMustHaveCert && <RequirementList title="Certifications" requirements={analyzedJd.certifications} />}
            <RequirementList title="Technical Skills" requirements={analyzedJd.technicalSkills} />
            <RequirementList title="Soft Skills" requirements={analyzedJd.softSkills} />
            {!hasMustHaveCert && <RequirementList title="Certifications" requirements={analyzedJd.certifications} />}
            <RequirementList title="Responsibilities" requirements={analyzedJd.responsibilities} />
        </div>
      </div>
      
      <div className="mb-8 p-4 border border-gray-200 rounded-lg break-inside-avoid">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">Overall Assessment Summary</h2>
        <div className="mb-4">
          <h3 className="text-xl font-bold mb-2 text-gray-800">Candidate Tiers</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <h4 className="font-semibold mb-2">Top Tier</h4>
              {summary.topTier.length > 0 ? summary.topTier.map(c => <p key={c} className="p-1 bg-green-50 rounded-sm text-sm">{c}</p>) : <p className="text-gray-500 text-sm">None</p>}
            </div>
            <div>
              <h4 className="font-semibold mb-2">Mid Tier</h4>
              {summary.midTier.length > 0 ? summary.midTier.map(c => <p key={c} className="p-1 bg-yellow-50 rounded-sm text-sm">{c}</p>) : <p className="text-gray-500 text-sm">None</p>}
            </div>
            <div>
              <h4 className="font-semibold mb-2">Not Suitable</h4>
              {summary.notSuitable.length > 0 ? summary.notSuitable.map(c => <p key={c} className="p-1 bg-red-50 rounded-sm text-sm">{c}</p>) : <p className="text-gray-500 text-sm">None</p>}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-6 mb-4">
            <div>
                <h3 className="text-xl font-bold mb-2 text-gray-800">Common Strengths</h3>
                <ul className="list-disc list-outside pl-5 text-gray-700">
                {summary.commonStrengths.map((s, i) => <li key={`strength-${i}`}>{s}</li>)}
                </ul>
            </div>
            <div>
                <h3 className="text-xl font-bold mb-2 text-gray-800">Common Gaps</h3>
                <ul className="list-disc list-outside pl-5 text-gray-700">
                {summary.commonGaps.map((g, i) => <li key={`gap-${i}`}>{g}</li>)}
                </ul>
            </div>
        </div>
         <div>
            <h3 className="text-xl font-bold mb-2 text-gray-800">Interview Strategy</h3>
            <p className="whitespace-pre-wrap text-gray-700">{summary.interviewStrategy}</p>
        </div>
      </div>

      <div className="page-break" />

      <div>
        <h2 className="text-2xl font-bold mb-4 text-gray-800">Detailed Candidate Assessments</h2>
        {candidates.map((candidate, index) => (
          <div key={`${candidate.candidateName}-${index}`} className="mb-6 p-4 border border-gray-200 rounded-lg break-inside-avoid">
            <div className="flex justify-between items-start mb-4">
                <h3 className="text-2xl font-bold">{candidate.candidateName}</h3>
                <div className="flex flex-col items-end gap-2 text-right">
                    <span className={`px-3 py-1 text-sm font-semibold rounded-full ${getRecommendationInfo(candidate.recommendation)}`}>
                        {candidate.recommendation}
                    </span>
                    <span className={`px-3 py-1 text-sm font-semibold rounded-full ${getScoreInfo(candidate.alignmentScore)}`}>
                        Alignment Score: {candidate.alignmentScore}%
                    </span>
                </div>
            </div>
            
            <div className="mb-4">
                <h4 className="font-bold text-lg mb-1">Alignment Summary</h4>
                <p className="text-gray-700 italic border-l-4 border-gray-300 pl-3">"{candidate.alignmentSummary}"</p>
            </div>

            <div className="grid grid-cols-2 gap-6 mb-4">
                <div>
                    <h4 className="font-bold text-lg mb-1">Strengths</h4>
                    <ul className="list-disc list-outside pl-5 text-gray-700">
                        {candidate.strengths.map((s, i) => <li key={`s-${i}`}>{s}</li>)}
                    </ul>
                </div>
                 <div>
                    <h4 className="font-bold text-lg mb-1">Weaknesses</h4>
                    <ul className="list-disc list-outside pl-5 text-gray-700">
                        {candidate.weaknesses.map((w, i) => <li key={`w-${i}`}>{w}</li>)}
                    </ul>
                </div>
            </div>

            <div className="mb-4">
                <h4 className="font-bold text-lg mb-1">Interview Probes</h4>
                <ul className="list-disc list-outside pl-5 text-gray-700">
                    {candidate.interviewProbes.map((p, i) => <li key={`p-${i}`}>{p}</li>)}
                </ul>
            </div>
            
            <div className="mb-4">
                <h4 className="font-bold text-lg mb-1">Detailed Alignment</h4>
                <ReportAlignmentTable details={candidate.alignmentDetails} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
