import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Search,
  Sparkles,
  Code2,
  Palette,
  Smartphone,
  Layers,
  FileCode,
  FileSpreadsheet,
  FileText,
  Presentation,
  FolderOpen,
} from "lucide-react";
import type { Skill } from "@/types";

interface SkillsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspacePath?: string | null;
}

type SkillColor = "blue" | "purple" | "green" | "amber";

const skillColorMap: Record<string, SkillColor> = {
  "react-best-practices": "blue",
  "composition-patterns": "blue",
  "code-review": "blue",
  "git-commit-helper": "blue",
  "web-design-guidelines": "purple",
  "react-native-guidelines": "green",
  "excel-operations": "amber",
  "word-operations": "amber",
  "powerpoint-operations": "amber",
  "typescript-strict": "blue",
  "api-design": "blue",
  "testing-patterns": "blue",
};

const colorClasses: Record<SkillColor, { bg: string; text: string; border: string }> = {
  blue: { bg: "bg-blue-500/10", text: "text-blue-400", border: "group-hover:border-blue-500/30" },
  purple: { bg: "bg-purple-500/10", text: "text-purple-400", border: "group-hover:border-purple-500/30" },
  green: { bg: "bg-green-500/10", text: "text-green-400", border: "group-hover:border-green-500/30" },
  amber: { bg: "bg-amber-500/10", text: "text-amber-400", border: "group-hover:border-amber-500/30" },
};

const categoryIcons: Record<string, React.ReactNode> = {
  "react-best-practices": <Code2 className="h-4 w-4" />,
  "web-design-guidelines": <Palette className="h-4 w-4" />,
  "react-native-guidelines": <Smartphone className="h-4 w-4" />,
  "composition-patterns": <Layers className="h-4 w-4" />,
  "code-review": <FileCode className="h-4 w-4" />,
  "git-commit-helper": <FileCode className="h-4 w-4" />,
  "excel-operations": <FileSpreadsheet className="h-4 w-4" />,
  "word-operations": <FileText className="h-4 w-4" />,
  "powerpoint-operations": <Presentation className="h-4 w-4" />,
  default: <Sparkles className="h-4 w-4" />,
};

const BUNDLED_SKILLS: Skill[] = [
  {
    id: "react-best-practices",
    name: "React Best Practices",
    description: "40+ rules for React and Next.js performance optimization across 8 categories",
    category: "bundled",
    enabled: true,
    version: "1.0.0",
    author: "Vercel",
  },
  {
    id: "web-design-guidelines",
    name: "Web Design Guidelines",
    description: "100+ rules for accessibility, performance, UX, forms, animations, and typography",
    category: "bundled",
    enabled: true,
    version: "1.0.0",
    author: "Vercel",
  },
  {
    id: "react-native-guidelines",
    name: "React Native Guidelines",
    description: "16 rules for mobile app performance, layout, animations, and state management",
    category: "bundled",
    enabled: false,
    version: "1.0.0",
    author: "Vercel",
  },
  {
    id: "composition-patterns",
    name: "Composition Patterns",
    description: "Component architecture patterns: compound components, state lifting, avoiding prop drilling",
    category: "bundled",
    enabled: false,
    version: "1.0.0",
    author: "Vercel",
  },
  {
    id: "code-review",
    name: "Code Review Assistant",
    description: "Comprehensive code review with security, performance, and maintainability checks",
    category: "bundled",
    enabled: true,
    version: "1.0.0",
    author: "OhMyCowork",
  },
  {
    id: "git-commit-helper",
    name: "Git Commit Helper",
    description: "Generate meaningful commit messages following conventional commits specification",
    category: "bundled",
    enabled: true,
    version: "1.0.0",
    author: "OhMyCowork",
  },
  {
    id: "excel-operations",
    name: "Excel Operations",
    description: "Create, read, and analyze Excel spreadsheets with charts and formulas",
    category: "bundled",
    enabled: true,
    version: "1.0.0",
    author: "OhMyCowork",
  },
  {
    id: "word-operations",
    name: "Word Document",
    description: "Create and edit Word documents with formatting, tables, and images",
    category: "bundled",
    enabled: true,
    version: "1.0.0",
    author: "OhMyCowork",
  },
  {
    id: "powerpoint-operations",
    name: "PowerPoint Presentations",
    description: "Create professional PowerPoint presentations with slides and layouts",
    category: "bundled",
    enabled: true,
    version: "1.0.0",
    author: "OhMyCowork",
  },
];

const MANAGED_SKILLS: Skill[] = [
  {
    id: "typescript-strict",
    name: "TypeScript Strict Mode",
    description: "Enforce strict TypeScript patterns and best practices",
    category: "managed",
    enabled: false,
    version: "1.0.0",
    author: "Community",
  },
  {
    id: "api-design",
    name: "API Design Guidelines",
    description: "REST and GraphQL API design best practices",
    category: "managed",
    enabled: false,
    version: "1.0.0",
    author: "Community",
  },
  {
    id: "testing-patterns",
    name: "Testing Patterns",
    description: "Unit testing, integration testing, and E2E testing best practices",
    category: "managed",
    enabled: false,
    version: "1.0.0",
    author: "Community",
  },
];

function SkillCard({
  skill,
  onToggle,
}: {
  skill: Skill;
  onToggle: (id: string, enabled: boolean, category: string) => void;
}) {
  const color = skillColorMap[skill.id] ?? "blue";
  const classes = colorClasses[color];

  return (
    <div
      className={`group flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5 transition-all ${classes.border} ${
        !skill.enabled ? "opacity-50" : ""
      }`}
    >
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${classes.bg} ${classes.text}`}
      >
        {categoryIcons[skill.id] || categoryIcons.default}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h4 className="truncate text-sm font-medium">{skill.name}</h4>
          <span className="shrink-0 rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-muted-foreground">
            v{skill.version}
          </span>
        </div>
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {skill.description}
        </p>
        <p className="mt-1.5 text-[10px] text-muted-foreground/60">by {skill.author}</p>
      </div>
      <div className="shrink-0 pt-0.5">
        <Switch
          checked={skill.enabled}
          onCheckedChange={(checked: boolean) =>
            onToggle(skill.id, checked, skill.category)
          }
        />
      </div>
    </div>
  );
}

function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
        {label}
      </h3>
      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white/[0.06] px-1.5 text-[10px] font-medium text-muted-foreground">
        {count}
      </span>
      <div className="h-px flex-1 bg-gradient-to-r from-white/[0.06] to-transparent" />
    </div>
  );
}

export function SkillsPanel({ open, onOpenChange, workspacePath }: SkillsPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [bundledSkills, setBundledSkills] = useState<Skill[]>(BUNDLED_SKILLS);
  const [managedSkills, setManagedSkills] = useState<Skill[]>(MANAGED_SKILLS);
  const [workspaceSkills, setWorkspaceSkills] = useState<Skill[]>([]);

  useEffect(() => {
    if (workspacePath) {
      setWorkspaceSkills([]);
    }
  }, [workspacePath]);

  const handleToggle = (id: string, enabled: boolean, category: string) => {
    if (category === "bundled") {
      setBundledSkills(prev =>
        prev.map(s => s.id === id ? { ...s, enabled } : s)
      );
    } else if (category === "managed") {
      setManagedSkills(prev =>
        prev.map(s => s.id === id ? { ...s, enabled } : s)
      );
    } else {
      setWorkspaceSkills(prev =>
        prev.map(s => s.id === id ? { ...s, enabled } : s)
      );
    }
  };

  const filterSkills = (skills: Skill[]) => {
    if (!searchQuery.trim()) return skills;
    const query = searchQuery.toLowerCase();
    return skills.filter(
      s => s.name.toLowerCase().includes(query) ||
           s.description.toLowerCase().includes(query)
    );
  };

  const enabledCount = [...bundledSkills, ...managedSkills, ...workspaceSkills]
    .filter(s => s.enabled).length;

  const filteredBundled = filterSkills(bundledSkills);
  const filteredManaged = filterSkills(managedSkills);
  const filteredWorkspace = filterSkills(workspaceSkills);
  const totalFiltered = filteredBundled.length + filteredManaged.length + filteredWorkspace.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="relative max-h-[85vh] max-w-4xl overflow-hidden rounded-2xl border-white/[0.08] bg-[radial-gradient(circle_at_10%_10%,rgba(60,86,130,0.35),transparent_45%),radial-gradient(circle_at_90%_0%,rgba(120,72,35,0.25),transparent_40%),linear-gradient(160deg,#0b0b0f_0%,#10131a_55%,#0a0c11_100%)] p-0">
        {/* Grid overlay */}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:24px_24px]" />

        <div className="relative flex h-full flex-col">
          {/* Header */}
          <DialogHeader className="shrink-0 px-6 pb-4 pt-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <DialogTitle className="flex items-center gap-2.5 text-xl font-semibold">
                  <Sparkles className="h-5 w-5 text-amber-400" />
                  Skills
                </DialogTitle>
                <DialogDescription className="mt-1.5 text-sm text-muted-foreground">
                  Give Codex superpowers — {enabledCount} active
                </DialogDescription>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search skills..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 w-60 border-white/[0.06] bg-white/[0.03] pl-9 text-sm placeholder:text-muted-foreground/50 focus:border-white/20 focus:ring-1 focus:ring-white/10"
                />
              </div>
            </div>
            <div className="mt-4 h-px bg-gradient-to-r from-white/[0.08] via-white/[0.04] to-transparent" />
          </DialogHeader>

          {/* Content */}
          <div className="min-h-0 flex-1 px-6 pb-6">
            <ScrollArea className="h-full pr-3">
              {totalFiltered === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.04]">
                    <Search className="h-5 w-5 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm text-muted-foreground">No skills match your search.</p>
                  <p className="mt-1 text-xs text-muted-foreground/50">Try a different query</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Bundled Skills */}
                  {filteredBundled.length > 0 && (
                    <div>
                      <SectionHeader label="Bundled Skills" count={filteredBundled.length} />
                      <div className="grid gap-2.5 md:grid-cols-2">
                        {filteredBundled.map((skill) => (
                          <SkillCard key={skill.id} skill={skill} onToggle={handleToggle} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Community Skills */}
                  {filteredManaged.length > 0 && (
                    <div>
                      <SectionHeader label="Community Skills" count={filteredManaged.length} />
                      <div className="grid gap-2.5 md:grid-cols-2">
                        {filteredManaged.map((skill) => (
                          <SkillCard key={skill.id} skill={skill} onToggle={handleToggle} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Workspace Skills */}
                  {filteredWorkspace.length > 0 && (
                    <div>
                      <SectionHeader label="Workspace Skills" count={filteredWorkspace.length} />
                      <div className="grid gap-2.5 md:grid-cols-2">
                        {filteredWorkspace.map((skill) => (
                          <SkillCard key={skill.id} skill={skill} onToggle={handleToggle} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {workspacePath ? null : (
                <div className="mt-6 flex items-center gap-3 rounded-xl border border-dashed border-white/[0.08] bg-white/[0.02] p-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.04]">
                    <FolderOpen className="h-4 w-4 text-muted-foreground/50" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground/70">No workspace selected</p>
                    <p className="text-[11px] text-muted-foreground/40">Select a workspace to view project-specific skills</p>
                  </div>
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
