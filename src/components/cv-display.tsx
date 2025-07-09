"use client";

import type { StructuredCvContent } from "@/lib/types";
import { User, Briefcase, GraduationCap, Wrench, Lightbulb } from "lucide-react";

const Section = ({ title, icon, children }: { title: string, icon: React.ReactNode, children: React.ReactNode }) => (
    <div className="break-inside-avoid mb-6">
        <h3 className="text-lg font-semibold mb-3 flex items-center text-primary">
            {icon}
            <span className="ml-2">{title}</span>
        </h3>
        {children}
    </div>
);

export default function CvDisplay({ structuredContent }: { structuredContent: StructuredCvContent }) {
    if (!structuredContent) {
        return <p className="text-muted-foreground">No structured content available.</p>;
    }

    const { summary, experience, education, skills, projects } = structuredContent;

    return (
        <div className="md:columns-2 gap-8 space-y-6">
            {summary && (
                <Section title="Professional Summary" icon={<User className="h-5 w-5" />}>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{summary}</p>
                </Section>
            )}
            {experience && experience.length > 0 && (
                <Section title="Work Experience" icon={<Briefcase className="h-5 w-5" />}>
                    <ul className="space-y-4">
                        {experience.map((job, index) => (
                            <li key={`exp-${index}`} className="text-sm">
                                <p className="font-semibold text-foreground">{job.jobTitle}</p>
                                <p className="text-muted-foreground">{job.company} {job.location && `• ${job.location}`}</p>
                                <p className="text-xs text-muted-foreground mb-1">{job.dates}</p>
                                <ul className="list-disc list-outside pl-5 space-y-1 text-muted-foreground">
                                    {job.description.map((desc, i) => <li key={`desc-${i}`}>{desc}</li>)}
                                </ul>
                            </li>
                        ))}
                    </ul>
                </Section>
            )}
            {education && education.length > 0 && (
                <Section title="Education" icon={<GraduationCap className="h-5 w-5" />}>
                     <ul className="space-y-2">
                        {education.map((edu, index) => (
                            <li key={`edu-${index}`} className="text-sm">
                                <p className="font-semibold text-foreground">{edu.degree}</p>
                                <p className="text-muted-foreground">{edu.institution} {edu.dates && `• ${edu.dates}`}</p>
                            </li>
                        ))}
                    </ul>
                </Section>
            )}
            {skills && skills.length > 0 && (
                <Section title="Skills" icon={<Wrench className="h-5 w-5" />}>
                    <div className="flex flex-wrap gap-2">
                        {skills.map((skill, index) => (
                            <span key={`skill-${index}`} className="text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded-full">{skill}</span>
                        ))}
                    </div>
                </Section>
            )}
            {projects && projects.length > 0 && (
                <Section title="Projects" icon={<Lightbulb className="h-5 w-5" />}>
                     <ul className="space-y-4">
                        {projects.map((proj, index) => (
                            <li key={`proj-${index}`} className="text-sm">
                                <p className="font-semibold text-foreground">{proj.name}</p>
                                {proj.technologies && proj.technologies.length > 0 && (
                                    <p className="text-xs text-muted-foreground mb-1">
                                        {proj.technologies.join(', ')}
                                    </p>
                                )}
                                <p className="text-muted-foreground">{proj.description}</p>
                            </li>
                        ))}
                    </ul>
                </Section>
            )}
        </div>
    );
}
