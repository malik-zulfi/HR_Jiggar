
"use client";

import * as React from 'react';
import { useState, useEffect, createContext, useContext } from 'react';
import type { AssessmentSession, CvDatabaseRecord } from '@/lib/types';
import { AssessmentSessionSchema, CvDatabaseRecordSchema } from '@/lib/types';
import Chatbot from '@/components/chatbot';

const LOCAL_STORAGE_KEY = 'jiggar-history';
const CV_DB_STORAGE_KEY = 'jiggar-cv-database';

interface AppContextType {
  history: AssessmentSession[];
  setHistory: React.Dispatch<React.SetStateAction<AssessmentSession[]>>;
  cvDatabase: CvDatabaseRecord[];
  setCvDatabase: React.Dispatch<React.SetStateAction<CvDatabaseRecord[]>>;
  isClient: boolean;
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
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    try {
      const savedStateJSON = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (savedStateJSON) {
        // Prevent loading corrupted empty array from local storage
        if (savedStateJSON === '[]') {
            localStorage.removeItem(LOCAL_STORAGE_KEY);
        } else {
            const parsedJSON = JSON.parse(savedStateJSON);
            if (Array.isArray(parsedJSON)) {
              const validHistory = parsedJSON.map(sessionData => {
                const result = AssessmentSessionSchema.safeParse(sessionData);
                return result.success ? result.data : null;
              }).filter((s): s is AssessmentSession => s !== null);
              setHistory(validHistory);
            }
        }
      }
      
      const savedCvDbJSON = localStorage.getItem(CV_DB_STORAGE_KEY);
      if (savedCvDbJSON) {
        if (savedCvDbJSON === '[]') {
            localStorage.removeItem(CV_DB_STORAGE_KEY);
        } else {
            const parsedCvDb = JSON.parse(savedCvDbJSON);
            if (Array.isArray(parsedCvDb)) {
              const validDb = parsedCvDb.map(record => {
                const result = CvDatabaseRecordSchema.safeParse(record);
                return result.success ? result.data : null;
              }).filter((r): r is CvDatabaseRecord => r !== null);
              setCvDatabase(validDb);
            }
        }
      }
    } catch (error) {
      console.error("Failed to load global state from localStorage", error);
    }
  }, []);

  const contextValue = {
    history,
    setHistory,
    cvDatabase,
    setCvDatabase,
    isClient,
  };

  return (
    <AppContext.Provider value={contextValue}>
      {children}
      {isClient && <Chatbot sessions={history} cvDatabase={cvDatabase} />}
    </AppContext.Provider>
  );
}

    