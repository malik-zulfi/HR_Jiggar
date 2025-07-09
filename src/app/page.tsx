
"use client";

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Bot, Briefcase, Users, Award, Building, BarChart3, ArrowRight, Filter, X } from 'lucide-react';
import type { AssessmentSession, AnalyzedCandidate } from '@/lib/types';
import { AssessmentSessionSchema } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const LOCAL_STORAGE_KEY = 'jiggar-history';

// A type for our flattened top candidates
type TopCandidate = AnalyzedCandidate & {
    jobTitle: string;
    jdName: string;
};

export default function DashboardPage() {
    const [history, setHistory] = useState<AssessmentSession[]>([]);
    const [isClient, setIsClient] = useState(false);
    const [filters, setFilters] = useState({ code: 'all', department: 'all' });

    useEffect(() => {
        setIsClient(true);
        try {
            const savedStateJSON = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (savedStateJSON) {
                const parsedJSON = JSON.parse(savedStateJSON);
                if (Array.isArray(parsedJSON) && parsedJSON.length > 0) {
                    const validHistory = parsedJSON.map(sessionData => {
                        const result = AssessmentSessionSchema.safeParse(sessionData);
                        if (result.success) {
                            return result.data;
                        }
                        return null;
                    }).filter((s): s is AssessmentSession => s !== null);
                    setHistory(validHistory);
                }
            }
        } catch (error) {
            console.error("Failed to load state from localStorage", error);
        }
    }, []);

    const { uniqueCodes, uniqueDepartments, filteredHistory } = useMemo(() => {
        const allCodes = new Set<string>();
        const allDepartments = new Set<string>();
        history.forEach(session => {
            if (session.analyzedJd.code) allCodes.add(session.analyzedJd.code);
            if (session.analyzedJd.department) allDepartments.add(session.analyzedJd.department);
        });

        const fHistory = history.filter(session => {
            const codeMatch = filters.code === 'all' || session.analyzedJd.code === filters.code;
            const deptMatch = filters.department === 'all' || session.analyzedJd.department === filters.department;
            return codeMatch && deptMatch;
        });

        return {
            uniqueCodes: ['all', ...Array.from(allCodes)],
            uniqueDepartments: ['all', ...Array.from(allDepartments)],
            filteredHistory: fHistory
        };
    }, [history, filters]);

    const stats = useMemo(() => {
        const totalPositions = filteredHistory.length;
        const totalCandidates = filteredHistory.reduce((sum, session) => sum + (session.candidates?.length || 0), 0);

        const allCandidates: TopCandidate[] = filteredHistory.flatMap(session =>
            (session.candidates || []).map(candidate => ({
                ...candidate.analysis,
                jobTitle: session.analyzedJd.jobTitle || 'N/A',
                jdName: session.jdName
            }))
        );

        const top5Candidates = allCandidates.sort((a, b) => b.alignmentScore - a.alignmentScore).slice(0, 5);

        const assessmentsByCode = filteredHistory.reduce<Record<string, number>>((acc, session) => {
            const code = session.analyzedJd.code || 'Not Specified';
            if (!acc[code]) {
                acc[code] = 0;
            }
            acc[code] += session.candidates?.length || 0;
            return acc;
        }, {});
        
        const assessmentsByDept = filteredHistory.reduce<Record<string, number>>((acc, session) => {
            const dept = session.analyzedJd.department || 'Not Specified';
            if (!acc[dept]) {
                acc[dept] = 0;
            }
            acc[dept] += session.candidates?.length || 0;
            return acc;
        }, {});

        return { totalPositions, totalCandidates, top5Candidates, assessmentsByCode, assessmentsByDept };
    }, [filteredHistory]);
    
    const handleFilterChange = (filterType: 'code' | 'department', value: string) => {
        setFilters(prev => ({ ...prev, [filterType]: value }));
    };

    const resetFilters = () => {
        setFilters({ code: 'all', department: 'all' });
    };
    
    const hasActiveFilters = filters.code !== 'all' || filters.department !== 'all';

    if (!isClient) {
        return null; // or a loading skeleton
    }

    return (
        <div className="flex flex-col min-h-screen bg-secondary/40">
            <header className="p-4 border-b bg-card shadow-sm sticky top-0 z-10">
                <div className="container mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <Bot className="w-6 h-6 text-primary" />
                        </div>
                        <h1 className="text-xl font-bold text-foreground">Jiggar Assessment Dashboard</h1>
                    </div>
                    <Link href="/assessment" passHref>
                        <Button>
                            Go to Assessment Tool
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </Link>
                </div>
            </header>

            <main className="flex-1 p-4 md:p-8">
                <div className="container mx-auto">
                    <Card className="mb-6">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Filter className="text-primary"/> Dashboard Filters</CardTitle>
                            <CardDescription>Use the slicers below to filter the dashboard metrics.</CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col sm:flex-row gap-4 items-center">
                            <div className="grid gap-2 w-full sm:w-auto">
                                <label className="text-sm font-medium">Job Code</label>
                                <Select value={filters.code} onValueChange={(value) => handleFilterChange('code', value)}>
                                    <SelectTrigger className="w-full sm:w-[180px]">
                                        <SelectValue placeholder="Select Code" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {uniqueCodes.map(code => (
                                            <SelectItem key={code} value={code}>{code === 'all' ? 'All Codes' : code}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2 w-full sm:w-auto">
                                 <label className="text-sm font-medium">Department</label>
                                 <Select value={filters.department} onValueChange={(value) => handleFilterChange('department', value)}>
                                    <SelectTrigger className="w-full sm:w-[180px]">
                                        <SelectValue placeholder="Select Department" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {uniqueDepartments.map(dept => (
                                            <SelectItem key={dept} value={dept}>{dept === 'all' ? 'All Departments' : dept}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            {hasActiveFilters && (
                                <Button variant="ghost" onClick={resetFilters} className="mt-auto self-end sm:self-center">
                                    <X className="mr-2 h-4 w-4"/>
                                    Reset Filters
                                </Button>
                            )}
                        </CardContent>
                    </Card>

                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Positions Assessed</CardTitle>
                                <Briefcase className="h-4 w-4 text-primary" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-primary">{stats.totalPositions}</div>
                                <p className="text-xs text-muted-foreground">Total unique job descriptions analyzed</p>
                            </CardContent>
                        </Card>
                         <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Candidates Assessed</CardTitle>
                                <Users className="h-4 w-4 text-accent" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-accent">{stats.totalCandidates}</div>
                                <p className="text-xs text-muted-foreground">Total CVs processed across all positions</p>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid gap-6 mt-6 md:grid-cols-2">
                        <Card className="col-span-2 md:col-span-1">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><Award className="text-chart-4" /> Top 5 Candidates</CardTitle>
                                <CardDescription>Highest scoring candidates across all assessments.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {stats.top5Candidates.length > 0 ? (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Candidate</TableHead>
                                                <TableHead>Position</TableHead>
                                                <TableHead className="text-right">Score</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {stats.top5Candidates.map((c, i) => (
                                                <TableRow key={i}>
                                                    <TableCell className="font-medium">{c.candidateName}</TableCell>
                                                    <TableCell className="text-muted-foreground">{c.jobTitle}</TableCell>
                                                    <TableCell className="text-right">
                                                        <Badge variant="secondary">{c.alignmentScore}%</Badge>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                ) : (
                                    <p className="text-sm text-muted-foreground text-center py-8">No candidates found for the selected filters.</p>
                                )}
                            </CardContent>
                        </Card>
                        
                        <Card className="col-span-2 md:col-span-1">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><BarChart3 className="text-chart-2" /> Candidates by Group</CardTitle>
                                <CardDescription>Number of candidates grouped by job code or department.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <h4 className="font-semibold text-sm mb-2 flex items-center gap-1.5"><Briefcase className="w-4 h-4"/> By Job Code</h4>
                                        <div className="space-y-2">
                                            {Object.keys(stats.assessmentsByCode).length > 0 ? Object.entries(stats.assessmentsByCode).map(([code, count]) => (
                                                <div key={code} className="flex justify-between items-center text-sm p-2 bg-secondary/50 rounded-md">
                                                    <span className="font-medium">{code}</span>
                                                    <Badge variant="outline">{count} {count === 1 ? 'candidate' : 'candidates'}</Badge>
                                                </div>
                                            )) : <p className="text-xs text-muted-foreground">No data.</p>}
                                        </div>
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-sm mb-2 flex items-center gap-1.5"><Building className="w-4 h-4"/> By Department</h4>
                                        <div className="space-y-2">
                                            {Object.keys(stats.assessmentsByDept).length > 0 ? Object.entries(stats.assessmentsByDept).map(([dept, count]) => (
                                                <div key={dept} className="flex justify-between items-center text-sm p-2 bg-secondary/50 rounded-md">
                                                    <span className="font-medium">{dept}</span>
                                                    <Badge variant="outline">{count} {count === 1 ? 'candidate' : 'candidates'}</Badge>
                                                </div>
                                            )) : <p className="text-xs text-muted-foreground">No data.</p>}
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </main>
        </div>
    );
}
