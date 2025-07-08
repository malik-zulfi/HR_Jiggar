
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


export default function AlignmentTable({ details }: AlignmentTableProps) {
  if (!details || details.length === 0) {
    return (
        <div className="flex items-center justify-center p-8 border rounded-lg bg-muted/50">
            <p className="text-muted-foreground">No detailed alignment analysis available.</p>
        </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="rounded-lg border overflow-hidden bg-card">
        <Legend />
        <div className="overflow-x-auto">
            <Table>
            <TableHeader>
                <TableRow>
                <TableHead className="w-[150px]">Category</TableHead>
                <TableHead>Requirement</TableHead>
                <TableHead className="w-[80px] text-center">Status</TableHead>
                <TableHead>Justification</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {details.map((item, index) => {
                const info = statusInfo[item.status] || statusInfo['Not Mentioned'];
                return (
                    <TableRow key={index}>
                    <TableCell className="font-medium text-muted-foreground align-top">{item.category}</TableCell>
                    <TableCell className="align-top">
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
                    <TableCell className="text-muted-foreground text-sm align-top">{item.justification}</TableCell>
                    </TableRow>
                );
                })}
            </TableBody>
            </Table>
        </div>
      </div>
    </TooltipProvider>
  );
}
