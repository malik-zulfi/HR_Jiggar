
"use client";

import { AccordionContent, AccordionItem } from "@/components/ui/accordion";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AnalyzedCandidate, CandidateRecord, ChatMessage } from "@/lib/types";
import { TrendingUp, Lightbulb, ThumbsDown, ThumbsUp, AlertTriangle, ClipboardCheck, Trash2, ChevronDown, Clock, RefreshCw, MessageSquare, Send, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import AlignmentTable from "./alignment-table";
import { Checkbox } from "./ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import React, { useState, useRef, useEffect } from "react";
import { Input } from "./ui/input";


const CandidateChat = ({ chatHistory, onQuery, isQuerying }: {
  chatHistory: ChatMessage[] | undefined;
  onQuery: (query: string) => void;
  isQuerying: boolean;
}) => {
  const [query, setQuery] = useState('');
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatContainerRef.current) {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory, isQuerying]);

  const handleSend = () => {
    if (query.trim()) {
      onQuery(query);
      setQuery('');
    }
  };

  return (
    <div className="space-y-4">
      <div ref={chatContainerRef} className="space-y-4 max-h-64 overflow-y-auto p-4 border rounded-md bg-background">
        {!chatHistory || chatHistory.length === 0 ? (
          <p className="text-sm text-center text-muted-foreground">No questions asked yet. Ask one below!</p>
        ) : (
          chatHistory.map((msg, i) => (
            <div key={i} className={cn("flex items-start gap-3", msg.role === 'user' ? 'justify-end' : 'justify-start')}>
              <div className={cn(
                "p-3 rounded-lg max-w-[80%]",
                msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
              )}>
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))
        )}
        {isQuerying && (
            <div className="flex items-start gap-3 justify-start">
                 <div className="p-3 rounded-lg bg-muted flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin"/>
                    <p className="text-sm text-muted-foreground">Thinking...</p>
                 </div>
            </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Input 
          placeholder="Ask a specific question about the candidate..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
            }
          }}
          disabled={isQuerying}
        />
        <Button onClick={handleSend} disabled={!query.trim() || isQuerying} size="icon">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};


interface CandidateCardProps {
  candidate: Omit<CandidateRecord, 'cvContent' | 'cvName'>;
  isStale?: boolean;
  isSelected?: boolean;
  onToggleSelect: () => void;
  onDelete: () => void;
  onQuery: (query: string) => void;
  isQuerying: boolean;
}

const getRecommendationInfo = (recommendation: AnalyzedCandidate['recommendation']) => {
    switch (recommendation) {
        case 'Strongly Recommended':
            return {
                icon: <ThumbsUp className="h-4 w-4" />,
                className: 'bg-primary text-primary-foreground border-transparent hover:bg-primary/90',
            };
        case 'Recommended with Reservations':
            return {
                icon: <AlertTriangle className="h-4 w-4" />,
                className: 'bg-accent text-accent-foreground border-transparent hover:bg-accent/80',
            };
        case 'Not Recommended':
            return {
                icon: <ThumbsDown className="h-4 w-4" />,
                className: 'bg-destructive text-destructive-foreground border-transparent hover:bg-destructive/90',
            };
        default:
            return { icon: null, className: 'text-foreground border-border' };
    }
};

const getScoreBadgeClass = (score: number) => {
    if (score >= 75) {
        return "bg-green-100 text-green-800 border-green-200 hover:bg-green-100/80";
    }
    if (score >= 40) {
        return "bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100/80";
    }
    return "bg-red-100 text-red-800 border-red-200 hover:bg-red-100/80";
};

export default function CandidateCard({ candidate, isStale, isSelected, onToggleSelect, onDelete, onQuery, isQuerying }: CandidateCardProps) {
  const analysis = candidate.analysis;
  const recommendationInfo = getRecommendationInfo(analysis.recommendation);

  return (
    <AccordionItem value={analysis.candidateName}>
        <AccordionPrimitive.Header className="flex w-full items-center">
            <div
                className="pl-4 py-4 cursor-pointer"
                onClick={(e) => {
                    e.stopPropagation();
                    onToggleSelect();
                }}
            >
                <Checkbox
                    id={`select-${analysis.candidateName}`}
                    checked={isSelected}
                    aria-label={`Select candidate ${analysis.candidateName}`}
                />
            </div>
            <AccordionPrimitive.Trigger className="flex flex-1 items-center justify-between p-4 font-medium transition-all hover:no-underline data-[state=open]:bg-accent/10">
                <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-semibold text-lg text-foreground truncate">{analysis.candidateName}</span>
                     <Badge className={cn("whitespace-nowrap font-bold", getScoreBadgeClass(analysis.alignmentScore))}>
                        <div className="flex items-center gap-1">
                            <TrendingUp className="h-4 w-4" />
                            {analysis.alignmentScore}%
                        </div>
                    </Badge>
                     {isStale && (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="flex items-center justify-center h-full">
                                        <RefreshCw className="h-4 w-4 text-accent animate-pulse" />
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>JD has changed. Re-assess for an updated score.</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}
                    {analysis.processingTime && (
                        <Badge variant="outline" className="font-normal text-muted-foreground">
                            <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {analysis.processingTime}s
                            </div>
                        </Badge>
                    )}
                    <Badge className={cn("whitespace-nowrap", recommendationInfo.className)}>
                        <div className="flex items-center gap-2">
                            {recommendationInfo.icon}
                            {analysis.recommendation}
                        </div>
                    </Badge>
                </div>
                <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 data-[state=open]:rotate-180" />
            </AccordionPrimitive.Trigger>
            <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive mr-4"
                onClick={onDelete}
                aria-label="Remove candidate"
            >
                <Trash2 className="h-4 w-4" />
            </Button>
        </AccordionPrimitive.Header>
      <AccordionContent className="p-4 bg-muted/30 rounded-b-md border-t">
        <div className="space-y-6">
          <div>
            <h4 className="font-semibold mb-2 flex items-center"><ClipboardCheck className="w-4 h-4 mr-2 text-primary"/> Alignment Details</h4>
            <p className="text-sm text-foreground/80 whitespace-pre-wrap mb-4">{analysis.alignmentSummary}</p>
            <AlignmentTable details={analysis.alignmentDetails} />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold mb-2 flex items-center"><ThumbsUp className="w-4 h-4 mr-2 text-primary"/> Strengths</h4>
              <ul className="list-disc list-outside pl-5 space-y-1 text-sm text-muted-foreground">
                {analysis.strengths.map((s, i) => <li key={`strength-${i}`} className="text-foreground">{s}</li>)}
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2 flex items-center"><ThumbsDown className="w-4 h-4 mr-2 text-destructive"/> Weaknesses</h4>
              <ul className="list-disc list-outside pl-5 space-y-1 text-sm text-muted-foreground">
                {analysis.weaknesses.map((w, i) => <li key={`weakness-${i}`} className="text-foreground">{w}</li>)}
              </ul>
            </div>
          </div>
          <div>
            <h4 className="font-semibold mb-2 flex items-center"><Lightbulb className="w-4 h-4 mr-2 text-accent"/> Interview Probes</h4>
            <ul className="list-disc list-outside pl-5 space-y-1 text-sm text-muted-foreground">
              {analysis.interviewProbes.map((p, i) => <li key={`probe-${i}`} className="text-foreground">{p}</li>)}
            </ul>
          </div>
           <div className="border-t pt-6">
            <h4 className="font-semibold mb-2 flex items-center"><MessageSquare className="w-4 h-4 mr-2 text-primary"/> Ask a Question</h4>
            <CandidateChat
                chatHistory={candidate.chatHistory}
                onQuery={onQuery}
                isQuerying={isQuerying}
            />
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

    
