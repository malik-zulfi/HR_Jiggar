"use client";

import { Bot, PlusSquare } from "lucide-react";
import { Button } from "./ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function Header() {
  const handleNewSession = () => {
    localStorage.removeItem('jiggar-session');
    window.location.reload();
  };

  return (
    <header className="p-4 border-b bg-card">
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Bot className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-xl font-bold text-foreground">Jiggar Assessment</h1>
        </div>
        
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline">
              <PlusSquare className="mr-2 h-4 w-4" />
              New Session
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will clear all current data, including the job description, candidate assessments, and summary. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleNewSession}>
                Start New Session
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </div>
    </header>
  );
}
