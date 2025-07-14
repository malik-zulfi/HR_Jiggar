
"use client"; // This must be a client component to use the context hook

import './globals.css';
import type { Metadata } from 'next';
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/toaster";
import { ClientProvider, useAppContext } from '@/components/client-provider';
import Chatbot from '@/components/chatbot';

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

// Metadata cannot be used in a client component.
// We can leave it for now, but for a production app, we would move this to a server component wrapper.
/*
export const metadata: Metadata = {
  title: 'Jiggar: AI-Powered Candidate Assessment',
  description: 'Analyze job descriptions, assess candidate CVs, and generate hiring recommendations with the power of AI.',
};
*/

function AppLayout({ children }: { children: React.ReactNode }) {
  // This component will be re-rendered when context values change
  const { history, cvDatabase } = useAppContext();
  
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased bg-background text-foreground`}>
        {children}
        <Chatbot sessions={history} cvDatabase={cvDatabase} />
        <Toaster />
      </body>
    </html>
  );
}


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClientProvider>
      <AppLayout>{children}</AppLayout>
    </ClientProvider>
  );
}
