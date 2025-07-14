
"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CandidateSummaryOutput, AnalyzedCandidate, ExtractJDCriteriaOutput } from "@/lib/types";
import { Award, Target, Telescope, UserMinus, UserCheck, Users, Download, Loader2, FileSpreadsheet } from "lucide-react";
import { Button } from './ui/button';
import { useToast } from '@/hooks/use-toast';
import { createRoot } from 'react-dom/client';
import Report from './report';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';

interface SummaryDisplayProps {
  summary: CandidateSummaryOutput;
  candidates: AnalyzedCandidate[];
  analyzedJd: ExtractJDCriteriaOutput;
}

function isRequirementGroup(item: any): item is { groupType: 'OR'; requirements: any[] } {
    return 'groupType' in item;
}

export default function SummaryDisplay({ summary, candidates, analyzedJd }: SummaryDisplayProps) {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  const handleExportExcel = () => {
    if (candidates.length === 0) {
      toast({
        variant: "destructive",
        title: "Export Failed",
        description: "No candidates to export."
      });
      return;
    }
    setIsExportingExcel(true);
    toast({ description: "Generating cross-candidate alignment report..." });

    try {
      const allJdRequirements = [
        ...(analyzedJd.education || []),
        ...(analyzedJd.experience || []),
        ...(analyzedJd.technicalSkills || []),
        ...(analyzedJd.softSkills || []),
        ...(analyzedJd.certifications || []),
        ...(analyzedJd.responsibilities || []),
        ...(analyzedJd.additionalRequirements || []),
      ];

      if (allJdRequirements.length === 0) {
          toast({ variant: "destructive", title: "Export Failed", description: "No job description requirements to create a report from." });
          setIsExportingExcel(false);
          return;
      }
      
      const candidateMap = new Map(candidates.map(c => [c.candidateName, c]));
      const candidateNames = candidates.map(c => c.candidateName);
      const normalizeString = (str: string) => (str || '').trim().toLowerCase();
      
      const priorityEmojis: { [key: string]: string } = {
        'MUST-HAVE': '★',
        'NICE-TO-HAVE': '•',
      };
      
      const statusEmojis: { [key: string]: string } = {
        'Aligned': '✅',
        'Partially Aligned': '⚠️',
        'Not Aligned': '❌',
        'Not Mentioned': '—',
      };
      
      // Header creation
      const headerRow1: (string | null)[] = ['', ''];
      const headerRow2: string[] = ['Priority', 'Requirement'];
      const merges = [];
      
      candidateNames.forEach((name, index) => {
          headerRow1.push(name, null); // Push name and a null for the merge
          headerRow2.push('Status', 'Justification');
          const startCol = 2 + (index * 2);
          merges.push({ s: { r: 0, c: startCol }, e: { r: 0, c: startCol + 1 } });
      });

      // Data row creation
      const dataRows = allJdRequirements.map(jdReqOrGroup => {
        
        let reqDescription: string;
        let reqPriority: 'MUST-HAVE' | 'NICE-TO-HAVE';

        if (isRequirementGroup(jdReqOrGroup)) {
            reqDescription = jdReqOrGroup.requirements.map(r => r.description).join(' OR ');
            reqPriority = jdReqOrGroup.requirements.some(r => r.priority === 'MUST-HAVE') ? 'MUST-HAVE' : 'NICE-TO-HAVE';
        } else {
            reqDescription = jdReqOrGroup.description;
            reqPriority = jdReqOrGroup.priority;
        }

        const rowData: (string | undefined)[] = [
          priorityEmojis[reqPriority],
          reqDescription
        ];

        candidateNames.forEach(name => {
          const candidate = candidateMap.get(name);
          const alignmentDetail = candidate?.alignmentDetails.find(
            detail => normalizeString(detail.requirement).substring(0,50) === normalizeString(reqDescription).substring(0,50)
          );

          if (alignmentDetail) {
            rowData.push(statusEmojis[alignmentDetail.status]);
            rowData.push(alignmentDetail.justification);
          } else {
            rowData.push(statusEmojis['Not Mentioned']);
            rowData.push('');
          }
        });

        return rowData;
      });
      
      const worksheetData = [headerRow1, headerRow2, ...dataRows];

      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
      
      if (merges.length > 0) {
        worksheet['!merges'] = merges;
      }

      // Auto-size columns for better readability
      const colWidths = headerRow2.map((header, colIndex) => {
          if (header === 'Status' || header === 'Priority') return { wch: 8 };

          let maxLength = 0;
          for (const row of worksheetData) {
              const cellContent = row[colIndex];
              if (cellContent) {
                  maxLength = Math.max(maxLength, String(cellContent).length);
              }
          }
          if (header === 'Justification') return { wch: Math.min(50, maxLength + 2) };
          if (header === 'Requirement') return { wch: Math.min(60, maxLength + 2) };
          return { wch: maxLength + 2 };
      });

      // Adjust for merged candidate name headers
      candidateNames.forEach((name, index) => {
          const colIndex = 2 + (index * 2);
          const nameLength = name.length;
          const combinedWidth = colWidths[colIndex].wch! + colWidths[colIndex + 1].wch!;
          if (nameLength > combinedWidth) {
              colWidths[colIndex + 1].wch = nameLength - colWidths[colIndex].wch! + 2;
          }
      });
      
      worksheet['!cols'] = colWidths;
      
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Candidate Alignment Matrix');
      XLSX.writeFile(workbook, 'candidate_alignment_matrix.xlsx');

      toast({ description: "Excel report downloaded successfully." });
    } catch (error) {
        console.error("Failed to export Excel", error);
        toast({ variant: "destructive", title: "Export Failed", description: "Could not generate Excel report." });
    } finally {
        setIsExportingExcel(false);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    toast({ description: "Generating PDF report... This may take a moment." });

    const reportElement = document.createElement("div");
    reportElement.style.position = "absolute";
    reportElement.style.left = "-9999px";
    document.body.appendChild(reportElement);

    const root = createRoot(reportElement);
    root.render(<Report summary={summary} candidates={candidates} analyzedJd={analyzedJd} />);

    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const reportContent = reportElement.querySelector('#pdf-report');
      if (!reportContent) {
          throw new Error("Report content not found");
      }

      const canvas = await html2canvas(reportContent as HTMLElement, {
        scale: 2,
        useCORS: true,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4',
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      const ratio = canvasWidth / canvasHeight;
      const imgWidth = pdfWidth;
      const imgHeight = imgWidth / ratio;
      
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }
      
      pdf.save('candidate-assessment-report.pdf');

      toast({ description: "Report downloaded successfully." });

    } catch (error) {
      console.error("Failed to export PDF", error);
      toast({ variant: "destructive", title: "Export Failed", description: "Could not generate PDF report." });
    } finally {
      root.unmount();
      document.body.removeChild(reportElement);
      setIsExporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
            <div>
                <CardTitle>Overall Assessment Summary</CardTitle>
                <CardDescription>A complete overview of all candidates and strategic recommendations.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
                <Button onClick={handleExportExcel} disabled={isExportingExcel || isExporting} variant="outline">
                    {isExportingExcel ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <FileSpreadsheet className="mr-2 h-4 w-4" />
                    )}
                    Export Excel
                </Button>
                <Button onClick={handleExport} disabled={isExporting || isExportingExcel}>
                    {isExporting ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Download className="mr-2 h-4 w-4" />
                    )}
                    Export PDF
                </Button>
            </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="tiers" className="w-full">
          <TabsList className="grid w-full grid-cols-1 md:grid-cols-3">
            <TabsTrigger value="tiers"><Users className="mr-2 h-4 w-4"/>Candidate Tiers</TabsTrigger>
            <TabsTrigger value="commonalities"><Target className="mr-2 h-4 w-4"/>Commonalities</TabsTrigger>
            <TabsTrigger value="strategy"><Telescope className="mr-2 h-4 w-4"/>Interview Strategy</TabsTrigger>
          </TabsList>
          <TabsContent value="tiers" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <TierList title="Top Tier" candidates={summary.topTier} icon={<Award className="h-5 w-5 text-accent"/>} />
              <TierList title="Mid Tier" candidates={summary.midTier} icon={<UserCheck className="h-5 w-5 text-primary"/>} />
              <TierList title="Not Suitable" candidates={summary.notSuitable} icon={<UserMinus className="h-5 w-5 text-destructive"/>} />
            </div>
          </TabsContent>
          <TabsContent value="commonalities" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold mb-2 text-lg">Common Strengths</h4>
                <ul className="list-disc list-outside pl-5 space-y-2 text-sm">
                  {summary.commonStrengths.map((s, i) => <li key={`strength-${i}`}>{s}</li>)}
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2 text-lg">Common Gaps</h4>
                <ul className="list-disc list-outside pl-5 space-y-2 text-sm">
                  {summary.commonGaps.map((g, i) => <li key={`gap-${i}`}>{g}</li>)}
                </ul>
              </div>
            </div>
          </TabsContent>
          <TabsContent value="strategy" className="mt-6">
             <h4 className="font-semibold mb-2 text-lg">Suggested Interview Strategy</h4>
             <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{summary.interviewStrategy}</p>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

const TierList = ({ title, candidates, icon }: { title: string; candidates: string[]; icon: React.ReactNode }) => (
  <div className="p-4 rounded-lg border bg-card">
    <h4 className="font-semibold mb-3 flex items-center">{icon}<span className="ml-2">{title}</span></h4>
    {candidates.length > 0 ? (
      <ul className="space-y-1.5 text-sm">
        {candidates.map((name, i) => <li key={i} className="p-2 rounded-md bg-secondary/30">{name}</li>)}
      </ul>
    ) : (
      <p className="text-sm text-muted-foreground">No candidates in this tier.</p>
    )}
  </div>
);
