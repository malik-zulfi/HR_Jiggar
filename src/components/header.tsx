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

export function Header({ onNewSession }: { onNewSession: () => void }) {
  return (
    <header className="p-4 border-b bg-card">
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Bot className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-xl font-bold text-foreground">Jiggar Assessment</h1>
        </div>
        
        <div className="flex items-center gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline">
                  <PlusSquare className="mr-2 h-4 w-4" />
                  New Assessment
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Start a new assessment?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will clear your current view to start a new assessment. Your past work will be saved in the history.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={onNewSession}>
                    Start New
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
        </div>

      </div>
    </header>
  );
}
