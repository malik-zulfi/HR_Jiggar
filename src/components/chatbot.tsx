
"use client";

import { useState, useRef, useEffect } from "react";
import { Bot, X, Send, Loader2, MessageSquare } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { cn } from "@/lib/utils";
import type { AssessmentSession, CvDatabaseRecord } from "@/lib/types";
import { queryKnowledgeBase } from "@/ai/flows/query-knowledge-base";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Link from "next/link";

const ACTIVE_SESSION_STORAGE_KEY = 'jiggar-active-session';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

interface ChatbotProps {
  sessions: AssessmentSession[];
  cvDatabase: CvDatabaseRecord[];
}

export default function Chatbot({ sessions, cvDatabase }: ChatbotProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  
  const initialMessage: ChatMessage = {
      role: 'assistant',
      content: "Hello! I'm your recruitment assistant. Ask me anything about your positions and candidates."
  };

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory, isLoading, isOpen]);
  
  useEffect(() => {
    if (isOpen && chatHistory.length === 0) {
        setChatHistory([initialMessage]);
    }
  }, [isOpen, chatHistory.length]);

  const handleSend = async () => {
    if (!query.trim()) return;

    const userMessage: ChatMessage = { role: 'user', content: query };
    setChatHistory(prev => [...prev, userMessage]);
    setQuery('');
    setIsLoading(true);

    try {
      const result = await queryKnowledgeBase({ query, sessions, cvDatabase });
      const assistantMessage: ChatMessage = { role: 'assistant', content: result.answer };
      setChatHistory(prev => [...prev, assistantMessage]);
    } catch (error: any) {
      console.error("Error querying knowledge base:", error);
      toast({ variant: "destructive", title: "Chat Error", description: error.message || "An unexpected error occurred." });
      setChatHistory(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          size="icon"
          className="rounded-full w-14 h-14 shadow-lg"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Toggle chat"
        >
          {isOpen ? <X className="w-6 h-6" /> : <Bot className="w-6 h-6" />}
        </Button>
      </div>

      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-full max-w-md">
          <Card className="shadow-2xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="text-primary"/>
                Recruitment Assistant
              </CardTitle>
            </CardHeader>
            <CardContent ref={chatContainerRef} className="h-96 overflow-y-auto space-y-4 pr-4">
              {chatHistory.map((msg, i) => (
                <div key={i} className={cn("flex items-start gap-3", msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div className={cn(
                    "p-3 rounded-lg max-w-[85%]",
                    msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  )}>
                    {msg.role === 'assistant' ? (
                       <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          className="text-sm leading-relaxed"
                          components={{
                            p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                            ul: ({node, ...props}) => <ul className="list-disc list-outside pl-4 space-y-1" {...props} />,
                            ol: ({node, ...props}) => <ol className="list-decimal list-outside pl-4 space-y-1" {...props} />,
                            a: ({node, ...props}) => {
                                const { href, children, ...rest } = props;
                                const url = href || '';

                                if (url.startsWith('/assessment?sessionId=')) {
                                    const sessionId = url.split('sessionId=')[1];
                                    const handleViewInTool = () => {
                                        localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, sessionId);
                                        setIsOpen(false);
                                    };
                                    return (
                                        <Link
                                            href="/assessment"
                                            onClick={handleViewInTool}
                                            className="font-semibold text-primary underline hover:no-underline cursor-pointer"
                                            {...rest}
                                        >
                                            {children}
                                        </Link>
                                    );
                                }

                                if (url.startsWith('/cv-database?email=')) {
                                    const handleViewCv = () => {
                                        setIsOpen(false);
                                    };
                                    return (
                                        <Link
                                            href={url}
                                            onClick={handleViewCv}
                                            className="font-semibold text-primary underline hover:no-underline cursor-pointer"
                                            {...rest}
                                        >
                                            {children}
                                        </Link>
                                    );
                                }
                              
                                return <a href={url} className="text-primary underline hover:no-underline" {...rest} target="_blank" rel="noopener noreferrer">{children}</a>;
                            },
                            code: ({ node, inline, className, children, ...props }) => {
                                return !inline ? (
                                    <pre className="text-sm bg-black/10 dark:bg-white/10 p-2 rounded-md overflow-x-auto my-2">
                                        <code className={cn("font-mono", className)} {...props}>
                                            {children}
                                        </code>
                                    </pre>
                                ) : (
                                    <code className={cn("font-mono text-sm px-1 py-0.5 bg-black/10 dark:bg-white/10 rounded", className)} {...props}>
                                        {children}
                                    </code>
                                );
                            },
                            table: ({node, ...props}) => (
                                <div className="my-2 w-full overflow-auto rounded-md border">
                                    <table className="w-full" {...props} />
                                </div>
                            ),
                            thead: ({node, ...props}) => <thead className="bg-muted/50 font-medium" {...props} />,
                            tbody: ({node, ...props}) => <tbody {...props} />,
                            tr: ({node, ...props}) => <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted" {...props} />,
                            th: ({node, ...props}) => <th className="h-10 px-3 text-left align-middle font-medium text-muted-foreground" {...props} />,
                            td: ({node, ...props}) => <td className="p-3 align-middle" {...props} />,
                          }}
                       >
                           {msg.content}
                       </ReactMarkdown>
                    ) : (
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex items-start gap-3 justify-start">
                     <div className="p-3 rounded-lg bg-muted flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin"/>
                        <p className="text-sm text-muted-foreground">Thinking...</p>
                     </div>
                </div>
              )}
            </CardContent>
            <CardFooter>
              <div className="flex items-center gap-2 w-full">
                <Input
                  placeholder="Ask a question..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
                  disabled={isLoading}
                />
                <Button onClick={handleSend} disabled={!query.trim() || isLoading} size="icon">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardFooter>
          </Card>
        </div>
      )}
    </>
  );
}
