
import './globals.css';
import type { Metadata } from 'next';
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/toaster";
import { AppProvider } from '@/components/app-provider';
import * as React from 'react';

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: 'Jiggar: AI-Powered Candidate Assessment',
  description: 'Analyze job descriptions, assess candidate CVs, and generate hiring recommendations with the power of AI.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased bg-background text-foreground`}>
        <AppProvider>
          {children}
        </AppProvider>
        <Toaster />
      </body>
    </html>
  );
}
