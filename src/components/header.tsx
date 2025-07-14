
"use client";

import { useState, useRef } from 'react';
import Link from "next/link";
import { usePathname } from 'next/navigation';
import { Bot, PlusSquare, Database, LayoutDashboard, GanttChartSquare, Settings, Wand2, Bell, Loader2, Upload, Download } from "lucide-react";
import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import NotificationPopover from "@/components/notification-popover";
import { cn } from '@/lib/utils';
import type { SuitablePosition } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

const LOCAL_STORAGE_KEY = 'jiggar-history';
const CV_DB_STORAGE_KEY = 'jiggar-cv-database';
const SUITABLE_POSITIONS_KEY = 'jiggar-suitable-positions';
const RELEVANCE_CHECK_ENABLED_KEY = 'jiggar-relevance-check-enabled';


interface HeaderProps {
    activePage?: 'dashboard' | 'assessment' | 'cv-database';
    notificationCount?: number;
    suitablePositions?: SuitablePosition[];
    onAddCandidate?: (position: SuitablePosition) => void;
    isRelevanceCheckEnabled?: boolean;
    onRelevanceCheckToggle?: (enabled: boolean) => void;
    onManualCheck?: () => void;
    manualCheckStatus?: 'idle' | 'loading' | 'done';
}

export function Header({ 
    activePage,
    notificationCount = 0,
    suitablePositions = [],
    onAddCandidate = () => {},
    isRelevanceCheckEnabled = false,
    onRelevanceCheckToggle = () => {},
    onManualCheck = () => {},
    manualCheckStatus = 'idle',
}: HeaderProps) {
    const { toast } = useToast();
    const pathname = usePathname();
    const importInputRef = useRef<HTMLInputElement>(null);
    const currentPage = activePage || (pathname.includes('assessment') ? 'assessment' : pathname.includes('database') ? 'cv-database' : 'dashboard');

    const navItems = [
        { href: '/', icon: LayoutDashboard, label: 'Dashboard', page: 'dashboard' },
        { href: '/assessment', icon: GanttChartSquare, label: 'Assessment Tool', page: 'assessment' },
        { href: '/cv-database', icon: Database, label: 'CV Database', page: 'cv-database' },
    ];
    
    const handleExport = () => {
        try {
            const history = localStorage.getItem(LOCAL_STORAGE_KEY);
            const cvDatabase = localStorage.getItem(CV_DB_STORAGE_KEY);
            const suitablePositions = localStorage.getItem(SUITABLE_POSITIONS_KEY);

            const dataToExport = {
                history: history ? JSON.parse(history) : [],
                cvDatabase: cvDatabase ? JSON.parse(cvDatabase) : [],
                suitablePositions: suitablePositions ? JSON.parse(suitablePositions) : [],
            };

            const dataStr = JSON.stringify(dataToExport, null, 2);
            const blob = new Blob([dataStr], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `jiggar_backup_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            toast({ description: "Data exported successfully." });

        } catch (error) {
            console.error("Export failed:", error);
            toast({ variant: 'destructive', title: "Export Failed", description: "Could not export data." });
        }
    };
    
    const handleImportClick = () => {
        importInputRef.current?.click();
    };

    const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result;
                if (typeof text !== 'string') {
                    throw new Error("File could not be read.");
                }
                const importedData = JSON.parse(text);
                
                if (importedData.history && Array.isArray(importedData.history)) {
                    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(importedData.history));
                }
                if (importedData.cvDatabase && Array.isArray(importedData.cvDatabase)) {
                    localStorage.setItem(CV_DB_STORAGE_KEY, JSON.stringify(importedData.cvDatabase));
                }
                if (importedData.suitablePositions && Array.isArray(importedData.suitablePositions)) {
                    localStorage.setItem(SUITABLE_POSITIONS_KEY, JSON.stringify(importedData.suitablePositions));
                }

                toast({ title: "Import Successful", description: "Data has been imported. The page will now reload." });
                setTimeout(() => window.location.reload(), 2000);

            } catch (error) {
                console.error("Import failed:", error);
                toast({ variant: 'destructive', title: "Import Failed", description: "The file is not a valid JSON backup." });
            }
        };
        reader.readAsText(file);
    };

  return (
    <header className="p-2 border-b bg-card sticky top-0 z-20">
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
            <Link href="/" className="flex items-center gap-2">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Bot className="w-6 h-6 text-primary" />
                </div>
                <h1 className="text-lg font-bold text-foreground hidden sm:block">Jiggar</h1>
            </Link>
        </div>
        
        <div className="flex items-center gap-1 sm:gap-2">
            <TooltipProvider>
                {navItems.map(item => (
                    <Tooltip key={item.page}>
                        <TooltipTrigger asChild>
                            <Link href={item.href}>
                                <Button variant="ghost" size="icon" className={cn(currentPage === item.page && 'bg-primary/10 text-primary')}>
                                    <item.icon className="h-5 w-5" />
                                </Button>
                            </Link>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>{item.label}</p>
                        </TooltipContent>
                    </Tooltip>
                ))}
            </TooltipProvider>

             <Popover>
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <PopoverTrigger asChild>
                                <Button variant="ghost" size="icon">
                                    <Settings className="h-5 w-5" />
                                </Button>
                            </PopoverTrigger>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Settings & Data</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
                <PopoverContent align="end" className="w-80">
                    <div className="grid gap-4">
                        <div className="space-y-2">
                            <h4 className="font-medium leading-none">Settings</h4>
                            <p className="text-sm text-muted-foreground">
                                Manage background AI features and application data.
                            </p>
                        </div>
                        <div className="flex flex-col gap-4">
                            <div className="rounded-md border p-4 space-y-3">
                                <div className="flex items-center space-x-2">
                                    <Wand2 className="h-5 w-5 text-primary" />
                                    <div className="flex-1 space-y-1">
                                        <p className="text-sm font-medium leading-none">
                                        AI Relevance Check
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                        Automatically find relevant jobs for candidates.
                                        </p>
                                    </div>
                                    <Switch
                                        checked={isRelevanceCheckEnabled}
                                        onCheckedChange={onRelevanceCheckToggle}
                                    />
                                </div>
                                {isRelevanceCheckEnabled && (
                                     <Button variant="outline" size="sm" className="w-full" onClick={onManualCheck} disabled={manualCheckStatus === 'loading'}>
                                        {manualCheckStatus === 'loading' ? (
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin"/>
                                        ) : (
                                            <Wand2 className="mr-2 h-4 w-4"/>
                                        )}
                                         Run on entire database
                                     </Button>
                                )}
                            </div>
                            <div className="rounded-md border p-4 space-y-3">
                                <h5 className="text-sm font-medium leading-none">
                                    Application Data
                                </h5>
                                <p className="text-xs text-muted-foreground">
                                    Export your data to a file to move it to another computer, or import a previous backup.
                                </p>
                                <div className="flex gap-2">
                                    <Button variant="outline" className="w-full" onClick={handleImportClick}>
                                        <Upload className="mr-2 h-4 w-4" /> Import
                                    </Button>
                                    <input
                                      type="file"
                                      ref={importInputRef}
                                      className="hidden"
                                      accept="application/json"
                                      onChange={handleImport}
                                    />
                                    <Button variant="outline" className="w-full" onClick={handleExport}>
                                        <Download className="mr-2 h-4 w-4" /> Export
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </PopoverContent>
            </Popover>

            <Popover>
                <TooltipProvider>
                     <Tooltip>
                        <TooltipTrigger asChild>
                            <PopoverTrigger asChild>
                                <Button variant="ghost" size="icon" className="relative">
                                    <Bell className="h-5 w-5" />
                                    {notificationCount > 0 && (
                                        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-xs font-bold text-destructive-foreground">
                                            {notificationCount}
                                        </span>
                                    )}
                                </Button>
                            </PopoverTrigger>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Suitable Position Alerts</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
                <NotificationPopover positions={suitablePositions} onAddCandidate={onAddCandidate} />
            </Popover>
        </div>

      </div>
    </header>
  );
}
