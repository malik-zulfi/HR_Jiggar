
"use client";

import { useState } from 'react';
import Link from "next/link";
import { usePathname } from 'next/navigation';
import { Bot, PlusSquare, Database, LayoutDashboard, GanttChartSquare, Settings, Wand2, Bell } from "lucide-react";
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
import { SidebarTrigger } from "./ui/sidebar";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import NotificationPopover from "@/components/notification-popover";
import { cn } from '@/lib/utils';
import type { SuitablePosition } from '@/lib/types';


interface HeaderProps {
    onNewSession?: () => void;
    activePage?: 'dashboard' | 'assessment' | 'cv-database';
    notificationCount?: number;
    suitablePositions?: SuitablePosition[];
    onAddCandidate?: (position: SuitablePosition) => void;
    isRelevanceCheckEnabled?: boolean;
    onRelevanceCheckToggle?: (enabled: boolean) => void;
    onRunRelevanceCheck?: () => void;
    isCheckingRelevance?: boolean;
}

export function Header({ 
    onNewSession,
    activePage,
    notificationCount = 0,
    suitablePositions = [],
    onAddCandidate = () => {},
    isRelevanceCheckEnabled = false,
    onRelevanceCheckToggle = () => {},
    onRunRelevanceCheck = () => {},
    isCheckingRelevance = false,
}: HeaderProps) {
    const pathname = usePathname();
    const currentPage = activePage || (pathname.includes('assessment') ? 'assessment' : pathname.includes('database') ? 'cv-database' : 'dashboard');

    const navItems = [
        { href: '/', icon: LayoutDashboard, label: 'Dashboard', page: 'dashboard' },
        { href: '/assessment', icon: GanttChartSquare, label: 'Assessment Tool', page: 'assessment' },
        { href: '/cv-database', icon: Database, label: 'CV Database', page: 'cv-database' },
    ];

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
                            <p>Settings</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
                <PopoverContent align="end" className="w-80">
                    <div className="grid gap-4">
                        <div className="space-y-2">
                            <h4 className="font-medium leading-none">Settings</h4>
                            <p className="text-sm text-muted-foreground">
                                Manage background AI features.
                            </p>
                        </div>
                        <div className="flex items-center space-x-2 rounded-md border p-4">
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
                        <Button
                            variant="outline"
                            onClick={onRunRelevanceCheck}
                            disabled={!isRelevanceCheckEnabled || isCheckingRelevance}
                        >
                            {isCheckingRelevance ? 'Checking...' : 'Run Check Manually'}
                        </Button>
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

            {onNewSession && (
                <AlertDialog>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <AlertDialogTrigger asChild>
                                    <Button size="sm">
                                      <PlusSquare className="mr-0 sm:mr-2 h-4 w-4" />
                                      <span className="hidden sm:inline">New Assessment</span>
                                    </Button>
                                </AlertDialogTrigger>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Start a new assessment</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
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
            )}
        </div>

      </div>
    </header>
  );
}

    