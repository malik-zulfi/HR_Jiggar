
"use client";

import * as React from 'react';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { Inter } from "next/font/google";
import { useState, useEffect } from 'react';
import type { AssessmentSession, CvDatabaseRecord } from '@/lib/types';
import { AssessmentSessionSchema, CvDatabaseRecordSchema } from '@/lib/types';
import Chatbot from '@/components/chatbot';

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

const LOCAL_STORAGE_KEY = 'jiggar-history';
const CV_DB_STORAGE_KEY = 'jiggar-cv-database';

// No metadata export from a client component. 
// We will handle this in a separate metadata export or keep it simple.

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [history, setHistory] = useState<AssessmentSession[]>([]);
  const [cvDatabase, setCvDatabase] = useState<CvDatabaseRecord[]>([]);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    try {
        const savedStateJSON = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (savedStateJSON) {
            const parsedJSON = JSON.parse(savedStateJSON);
            if (Array.isArray(parsedJSON)) {
                const validHistory = parsedJSON.map(sessionData => {
                    const result = AssessmentSessionSchema.safeParse(sessionData);
                    return result.success ? result.data : null;
                }).filter((s): s is AssessmentSession => s !== null);
                setHistory(validHistory);
            }
        }
        
        const savedCvDbJSON = localStorage.getItem(CV_DB_STORAGE_KEY);
        if (savedCvDbJSON) {
            const parsedCvDb = JSON.parse(savedCvDbJSON);
            if (Array.isArray(parsedCvDb)) {
                const validDb = parsedCvDb.map(record => {
                    const result = CvDatabaseRecordSchema.safeParse(record);
                    return result.success ? result.data : null;
                }).filter((r): r is CvDatabaseRecord => r !== null);
                setCvDatabase(validDb);
            }
        }
    } catch (error) {
        console.error("Failed to load global state from localStorage", error);
    }
  }, []);

  // Clone the children and pass props
  const childrenWithProps = React.Children.map(children, child => {
    if (React.isValidElement(child)) {
      // @ts-ignore
      return React.cloneElement(child, { history, setHistory, cvDatabase, setCvDatabase, isClient });
    }
    return child;
  });

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
          <title>Jiggar: AI-Powered Candidate Assessment</title>
          <meta name="description" content="Analyze job descriptions, assess candidate CVs, and generate hiring recommendations with the power of AI." />
      </head>
      <body className={`${inter.variable} font-sans antialiased bg-background text-foreground`}>
          {childrenWithProps}
          {isClient && <Chatbot sessions={history} cvDatabase={cvDatabase} />}
          <Toaster />
      </body>
    </html>
  );
}
