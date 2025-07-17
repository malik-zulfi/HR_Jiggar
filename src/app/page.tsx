
"use client";

import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Bot, Briefcase, Users, Award, Database, BarChart3, Filter, X, History, UserX } from 'lucide-react';
import type { AnalyzedCandidate, SuitablePosition } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LabelList } from 'recharts';
import { Header } from '@/components/header';
import { useAppContext } from '@/components/client-provider';


const ACTIVE_SESSION_STORAGE_KEY = 'jiggar-active-session';
const PENDING_ASSESSMENT_KEY = 'jiggar-pending-assessment';

type TopCandidate = AnalyzedCandidate & {
    jobTitle: string;
    jdName: string;
    sessionId: string;
};

const chartConfig = {
  count: {
    label: "Candidates",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig;


export default function DashboardPage() {
    const { history, cvDatabase, setSuitablePositions, suitablePositions } = useAppContext();
    const [filters, setFilters] = useState({ code: 'all', department: 'all' });

    const filteredHistory = useMemo(() => {
        return history.filter(session => {
            const codeMatch = filters.code === 'all' || session.analyzedJd.code === filters.code;
            const deptMatch = filters.department === 'all' || session.analyzedJd.department === filters.department;
            return codeMatch && deptMatch;
        });
    }, [history, filters]);

    const uniqueCodes = useMemo(() => {
        const relevantHistory = history.filter(session => {
            return filters.department === 'all' || session.analyzedJd.department === filters.department;
        });
        const codes = new Set<string>();
        relevantHistory.forEach(session => {
            if (session.analyzedJd.code) codes.add(session.analyzedJd.code);
        });
        return ['all', ...Array.from(codes).sort()];
    }, [history, filters.department]);

    const uniqueDepartments = useMemo(() => {
        const relevantHistory = history.filter(session => {
            return filters.code === 'all' || session.analyzedJd.code === filters.code;
        });
        const departments = new Set<string>();
        relevantHistory.forEach(session => {
            if (session.analyzedJd.department) departments.add(session.analyzedJd.department);
        });
        return ['all', ...Array.from(departments).sort()];
    }, [history, filters.code]);

    const stats = useMemo(() => {
        const totalPositions = filteredHistory.length;
        const totalCandidatesInAssessments = filteredHistory.reduce((sum, session) => sum + (session.candidates?.length || 0), 0);
        
        const allCandidates: TopCandidate[] = filteredHistory.flatMap(session =>
            (session.candidates || []).map(candidate => ({
                ...candidate.analysis,
                jobTitle: session.analyzedJd.jobTitle || 'N/A',
                jdName: session.jdName,
                sessionId: session.id,
            }))
        );
        const top5Candidates = allCandidates.sort((a, b) => b.alignmentScore - a.alignmentScore).slice(0, 5);

        const filteredCvDatabase = cvDatabase.filter(cv => {
            const codeMatch = filters.code === 'all' || cv.jobCode === filters.code;
            if (!codeMatch) return false;

            if (filters.department !== 'all') {
                const isCodeInDept = history.some(s => s.analyzedJd.code === cv.jobCode && s.analyzedJd.department === filters.department);
                return isCodeInDept;
            }
            return true;
        });

        const totalInDb = filteredCvDatabase.length;

        const allAssessedEmailsInFilter = new Set<string>();
        filteredHistory.forEach(session => {
            session.candidates.forEach(c => {
                if (c.analysis.email) {
                    allAssessedEmailsInFilter.add(c.analysis.email.toLowerCase());
                } else {
                    const dbRecord = cvDatabase.find(dbCv => dbCv.name.toLowerCase() === c.analysis.candidateName.toLowerCase());
                    if (dbRecord) {
                         allAssessedEmailsInFilter.add(dbRecord.email.toLowerCase());
                    }
                }
            });
        });
        
        const unassessedCount = filteredCvDatabase.filter(cv => !allAssessedEmailsInFilter.has(cv.email.toLowerCase())).length;
        
        const candidatesByCode = filteredCvDatabase.reduce<Record<string, number>>((acc, cv) => {
            const code = cv.jobCode || 'Not Specified';
            if (!acc[code]) {
                acc[code] = 0;
            }
            acc[code]++;
            return acc;
        }, {});

        const chartDataByCode = Object.entries(candidatesByCode)
            .map(([name, count]) => ({ name, count }))
            .filter(item => item.count > 0)
            .sort((a,b) => b.count - a.count);

        const recent5Assessments = filteredHistory
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 5);

        return { 
            totalPositions, 
            totalCandidatesInAssessments, 
            top5Candidates, 
            chartDataByCode, 
            recent5Assessments, 
            totalInDb,
            unassessedCount,
        };
    }, [filteredHistory, cvDatabase, history, filters.code, filters.department]);
    
    const handleFilterChange = (filterType: 'code' | 'department', value: string) => {
        setFilters(prev => ({ ...prev, [filterType]: value }));
    };

    const resetFilters = () => {
        setFilters({ code: 'all', department: 'all' });
    };

    const handleViewInTool = (sessionId: string) => {
        localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, sessionId);
    };

    const handleQuickAddToAssessment = useCallback((positions: SuitablePosition[]) => {
        if (positions.length === 0) return;
        const { assessment } = positions[0];
        const candidateDbRecords = positions.map(p => cvDatabase.find(c => c.email === p.candidateEmail)).filter(Boolean);

        if (candidateDbRecords.length === 0) return;

        localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, assessment.id);
        const pendingItems = candidateDbRecords.map(candidate => ({ candidate, assessment }));
        localStorage.setItem(PENDING_ASSESSMENT_KEY, JSON.stringify(pendingItems));
        
        const handledEmails = new Set(positions.map(p => p.candidateEmail));
        setSuitablePositions(prev => prev.filter(p => !(p.assessment.id === assessment.id && handledEmails.has(p.candidateEmail))));
        
        window.location.href = '/assessment';
    }, [cvDatabase, setSuitablePositions]);
    
    const hasActiveFilters = filters.code !== 'all' || filters.department !== 'all';

    return (
        <div className="flex flex-col min-h-screen bg-background">
            <Header activePage="dashboard" onQuickAdd={handleQuickAddToAssessment} />

            <main className="flex-1 p-4 md:p-6">
                <div className="container mx-auto">
                    <Card className="mb-6">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Filter className="text-primary"/> Dashboard Filters</CardTitle>
                            <CardDescription>Use the slicers below to filter the dashboard metrics.</CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col sm:flex-row gap-4 items-center">
                            <div className="grid gap-1.5 w-full sm:w-auto">
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
                            <div className="grid gap-1.5 w-full sm:w-auto">
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

                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
                                <div className="text-2xl font-bold text-accent">{stats.totalCandidatesInAssessments}</div>
                                <p className="text-xs text-muted-foreground">Total CVs processed across all positions</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Candidates in DB</CardTitle>
                                <Database className="h-4 w-4 text-green-600" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-green-600">{stats.totalInDb}</div>
                                <p className="text-xs text-muted-foreground">Total unique CVs in the database</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Not Assessed</CardTitle>
                                <UserX className="h-4 w-4 text-orange-600" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-orange-600">{stats.unassessedCount}</div>
                                <p className="text-xs text-muted-foreground">Candidates in DB yet to be assessed</p>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid gap-4 mt-4 md:grid-cols-2">
                        <Card className="col-span-2 md:col-span-1">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-base"><Award className="text-chart-4" /> Top 5 Candidates</CardTitle>
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
                                                <TableHead></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {stats.top5Candidates.map((c, i) => (
                                                <TableRow key={i}>
                                                    <TableCell className="font-medium">{c.candidateName}</TableCell>
                                                    <TableCell className="text-muted-foreground">{c.jobTitle}</TableCell>
                                                    <TableCell className="text-right">
                                                        <Badge variant={c.alignmentScore >= 75 ? "default" : c.alignmentScore >= 40 ? "secondary" : "destructive"}>{c.alignmentScore}%</Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Link href="/assessment" passHref>
                                                            <Button variant="outline" size="sm" onClick={() => handleViewInTool(c.sessionId)}>
                                                                View
                                                            </Button>
                                                        </Link>
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
                                <CardTitle className="flex items-center gap-2 text-base"><BarChart3 className="text-chart-2" /> Candidate Distribution</CardTitle>
                                <CardDescription>Visual breakdown of all candidates in the database by job code.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div>
                                    <h4 className="font-semibold text-sm mb-2 flex items-center gap-1.5"><Briefcase className="w-4 h-4"/> By Job Code</h4>
                                    {stats.chartDataByCode.length > 0 ? (
                                        <ChartContainer config={chartConfig} className="h-[200px] w-full">
                                            <BarChart
                                                data={stats.chartDataByCode}
                                                layout="vertical"
                                                margin={{ right: 20 }}
                                            >
                                                <CartesianGrid horizontal={false} />
                                                <YAxis
                                                    dataKey="name"
                                                    type="category"
                                                    tickLine={false}
                                                    axisLine={false}
                                                    tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                                                    width={80}
                                                />
                                                <XAxis dataKey="count" type="number" hide />
                                                <Tooltip
                                                    cursor={{ fill: 'hsl(var(--muted))' }}
                                                    content={<ChartTooltipContent />}
                                                />
                                                <Bar dataKey="count" fill="var(--color-count)" radius={[0, 4, 4, 0]}>
                                                    <LabelList dataKey="count" position="right" offset={8} className="fill-foreground" fontSize={12} />
                                                </Bar>
                                            </BarChart>
                                        </ChartContainer>
                                    ) : <p className="text-xs text-muted-foreground text-center py-4">No data to display.</p>}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <Card className="mt-4">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base"><History className="text-primary"/> Recent Assessments</CardTitle>
                            <CardDescription>The 5 most recently created assessments.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {stats.recent5Assessments.length > 0 ? (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Position</TableHead>
                                            <TableHead>Job Code</TableHead>
                                            <TableHead className="text-center"># Candidates</TableHead>
                                            <TableHead>Date Created</TableHead>
                                            <TableHead className="text-right"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {stats.recent5Assessments.map((session) => (
                                            <TableRow key={session.id}>
                                                <TableCell className="font-medium">{session.analyzedJd.jobTitle || session.jdName}</TableCell>
                                                <TableCell className="text-muted-foreground">{session.analyzedJd.code || 'N/A'}</TableCell>
                                                <TableCell className="text-center">{session.candidates.length}</TableCell>
                                                <TableCell className="text-muted-foreground">{new Date(session.createdAt).toLocaleDateString()}</TableCell>
                                                <TableCell className="text-right">
                                                    <Link href="/assessment" passHref>
                                                        <Button variant="outline" size="sm" onClick={() => handleViewInTool(session.id)}>
                                                            View in Tool
                                                        </Button>
                                                    </Link>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            ) : (
                                <p className="text-sm text-muted-foreground text-center py-8">No recent assessments to display.</p>
                                )}
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    );
}
