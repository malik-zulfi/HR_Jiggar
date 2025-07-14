
"use client";

import * as React from 'react';
import { useState, useEffect, createContext, useContext } from 'react';
import type { AssessmentSession, CvDatabaseRecord } from '@/lib/types';
import { AssessmentSessionSchema, CvDatabaseRecordSchema } from '@/lib/types';
import { Loader2 } from 'lucide-react';

const LOCAL_STORAGE_KEY = 'jiggar-history';
const CV_DB_STORAGE_KEY = 'jiggar-cv-database';

interface AppContextType {
  history: AssessmentSession[];
  setHistory: React.Dispatch<React.SetStateAction<AssessmentSession[]>>;
  cvDatabase: CvDatabaseRecord[];
  setCvDatabase: React.Dispatch<React.SetStateAction<CvDatabaseRecord[]>>;
}

const AppContext = createContext<AppContextType | null>(null);

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider. It seems the context is not available.');
  }
  return context;
}

export function ClientProvider({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [history, setHistory] = useState<AssessmentSession[]>([]);
  const [cvDatabase, setCvDatabase] = useState<CvDatabaseRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const savedStateJSON = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (savedStateJSON && savedStateJSON !== '[]') {
        const parsedJSON = JSON.parse(savedStateJSON);
        if (Array.isArray(parsedJSON)) {
          const validHistory = parsedJSON.map(sessionData => {
            const result = AssessmentSessionSchema.safeParse(sessionData);
            return result.success ? result.data : null;
          }).filter((s): s is AssessmentSession => s !== null);
          setHistory(validHistory);
        }
      } else if (savedStateJSON === '[]') {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
      }
      
      const savedCvDbJSON = localStorage.getItem(CV_DB_STORAGE_KEY);
      if (savedCvDbJSON && savedCvDbJSON !== '[]') {
        const parsedCvDb = JSON.parse(savedCvDbJSON);
        if (Array.isArray(parsedCvDb)) {
          const validDb = parsedCvDb.map(record => {
            const result = CvDatabaseRecordSchema.safeParse(record);
            return result.success ? result.data : null;
          }).filter((r): r is CvDatabaseRecord => r !== null);
          setCvDatabase(validDb);
        }
      } else if (savedCvDbJSON === '[]') {
        localStorage.removeItem(CV_DB_STORAGE_KEY);
      }
    } catch (error) {
      console.error("Failed to load global state from localStorage", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const contextValue = {
    history,
    setHistory,
    cvDatabase,
    setCvDatabase,
  };

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
}
