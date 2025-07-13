
"use client";

import * as React from 'react';
import { useState, useEffect } from 'react';
import type { AssessmentSession, CvDatabaseRecord } from '@/lib/types';
import { AssessmentSessionSchema, CvDatabaseRecordSchema } from '@/lib/types';
import Chatbot from '@/components/chatbot';
import { usePathname } from 'next/navigation';

const LOCAL_STORAGE_KEY = 'jiggar-history';
const CV_DB_STORAGE_KEY = 'jiggar-cv-database';

export function AppProvider({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [history, setHistory] = useState<AssessmentSession[]>([]);
  const [cvDatabase, setCvDatabase] = useState<CvDatabaseRecord[]>([]);
  const [isClient, setIsClient] = useState(false);
  const pathname = usePathname();

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
  }, [pathname]); // Re-load data on page navigation to ensure it's fresh

  const childrenWithProps = React.Children.map(children, child => {
    if (React.isValidElement(child)) {
      // @ts-ignore
      return React.cloneElement(child, { history, setHistory, cvDatabase, setCvDatabase });
    }
    return child;
  });

  return (
    <>
      {childrenWithProps}
      {isClient && <Chatbot sessions={history} cvDatabase={cvDatabase} />}
    </>
  );
}
