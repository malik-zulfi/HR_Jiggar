import type { AlignmentDetail } from "@/lib/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertTriangle, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface AlignmentTableProps {
  details: AlignmentDetail[];
}

const statusInfo: Record<AlignmentDetail['status'], { icon: React.ReactNode; className: string }> = {
  'Aligned': { icon: <CheckCircle2 className="text-green-500" />, className: "text-green-600" },
  'Partially Aligned': { icon: <AlertTriangle className="text-amber-500" />, className: "text-amber-600" },
  'Not Aligned': { icon: <XCircle className="text-red-500" />, className: "text-red-600" },
  'Not Mentioned': { icon: <HelpCircle className="text-gray-500" />, className: "text-gray-600" },
};

export default function AlignmentTable({ details }: AlignmentTableProps) {
  if (!details || details.length === 0) {
    return (
        <div className="flex items-center justify-center p-8 border rounded-lg bg-muted/50">
            <p className="text-muted-foreground">No detailed alignment analysis available.</p>
        </div>
    );
  }

  return (
    <div className="rounded-lg border overflow-hidden bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[150px]">Category</TableHead>
            <TableHead>Requirement</TableHead>
            <TableHead className="w-[180px] text-center">Status</TableHead>
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
                  <div className="flex flex-col">
                    <span className="font-medium">{item.requirement}</span>
                    <Badge variant={item.priority === 'MUST-HAVE' ? 'destructive' : 'secondary'} className="w-fit mt-1">
                        {item.priority.replace('-', ' ')}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell className={cn("font-semibold align-top", info.className)}>
                  <div className="flex items-center justify-center gap-2">
                    {info.icon}
                    <span>{item.status}</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm align-top">{item.justification}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
