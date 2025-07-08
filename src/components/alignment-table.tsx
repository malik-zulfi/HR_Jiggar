
"use client";

import type { AlignmentDetail } from "@/lib/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, XCircle, AlertTriangle, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import React from "react";

const statusInfo: Record<AlignmentDetail['status'], { icon: React.ReactNode; label: string }> = {
  'Aligned': { icon: <CheckCircle2 className="h-5 w-5 text-chart-2" />, label: 'Aligned' },
  'Partially Aligned': { icon: <AlertTriangle className="h-5 w-5 text-accent" />, label: 'Partially Aligned' },
  'Not Aligned': { icon: <XCircle className="h-5 w-5 text-destructive" />, label: 'Not Aligned' },
  'Not Mentioned': { icon: <HelpCircle className="h-5 w-5 text-muted-foreground" />, label: 'Not Mentioned' },
};

const priorityLegend = [
    { label: 'Must Have', className: 'bg-destructive' },
    { label: 'Nice to Have', className: 'bg-muted-foreground' }
];

const statusLegend = [
    { label: 'Aligned', icon: <CheckCircle2 className="h-4 w-4 text-chart-2" /> },
    { label: 'Partially Aligned', icon: <AlertTriangle className="h-4 w-4 text-accent" /> },
    { label: 'Not Aligned', icon: <XCircle className="h-4 w-4 text-destructive" /> },
    { label: 'Not Mentioned', icon: <HelpCircle className="h-4 w-4 text-muted-foreground" /> }
];

const Legend = () => (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4 px-4 pt-4 text-xs text-muted-foreground">
        <div className="flex items-center flex-wrap gap-x-4 gap-y-2">
            <span className="font-semibold text-sm">Priority:</span>
            {priorityLegend.map(item => (
                <div key={item.label} className="flex items-center gap-2">
                    <div className={cn("h-3 w-3 rounded-full", item.className)} />
                    <span>{item.label}</span>
                </div>
            ))}
        </div>
        <div className="flex items-center flex-wrap gap-x-4 gap-y-2">
            <span className="font-semibold text-sm">Status:</span>
            {statusLegend.map(item => (
                <div key={item.label} className="flex items-center gap-2">
                    {item.icon}
                    <span>{item.label}</span>
                </div>
            ))}
        </div>
    </div>
);

interface AlignmentTableProps {
  details: AlignmentDetail[];
}

export default function AlignmentTable({ details }: AlignmentTableProps) {
  if (!details || details.length === 0) {
    return (
        <div className="flex items-center justify-center p-8 border rounded-lg bg-muted/50">
            <p className="text-muted-foreground">No detailed alignment analysis available.</p>
        </div>
    );
  }

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
    <TooltipProvider>
      <div className="rounded-lg border bg-card">
        <Legend />
        <div className="overflow-x-auto border-t">
            <Table className="table-fixed w-full">
                <TableHeader>
                    <TableRow className="hover:bg-transparent">
                        <TableHead className="w-[35%] p-4">Requirement</TableHead>
                        <TableHead className="w-[50%] p-4">Justification</TableHead>
                        <TableHead className="w-[15%] text-center p-4">Status</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {categoriesInOrder.map((category) => {
                        const items = groupedDetails[category];
                        if (!items || items.length === 0) return null;

                        return (
                            <React.Fragment key={category}>
                                <TableRow className="border-none bg-muted/30 hover:bg-muted/30">
                                    <TableCell colSpan={3} className="py-2 px-4 font-semibold text-primary">
                                        {category}
                                    </TableCell>
                                </TableRow>
                                {items.map((item, index) => {
                                    const info = statusInfo[item.status] || statusInfo['Not Mentioned'];
                                    return (
                                        <TableRow key={index} className="border-t">
                                            <TableCell className="align-top break-words">
                                                <div className="flex items-start gap-3">
                                                    <Tooltip>
                                                        <TooltipTrigger className="mt-1">
                                                            <div className={cn(
                                                                "h-3 w-3 rounded-full shrink-0", 
                                                                item.priority === 'MUST-HAVE' ? 'bg-destructive' : 'bg-muted-foreground'
                                                            )} />
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <p>{item.priority.replace('-', ' ')}</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                    <span className="font-medium">{item.requirement}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-sm align-top break-words">{item.justification}</TableCell>
                                            <TableCell className="align-top">
                                                <div className="flex items-center justify-center">
                                                    <Tooltip>
                                                        <TooltipTrigger>
                                                            {info.icon}
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <p>{info.label}</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </React.Fragment>
                        );
                    })}
                </TableBody>
            </Table>
        </div>
      </div>
    </TooltipProvider>
  );
}
