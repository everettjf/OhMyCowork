import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
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
  Plus,
  Sparkles,
  Code2,
  Palette,
  Smartphone,
  Layers,
  FileCode,
  FileSpreadsheet,
  FileText,
  Presentation,
  RefreshCw,
  Pencil,
  ArrowLeft,
} from "lucide-react";
import type { Skill } from "@/types";

interface SkillsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspacePath?: string | null;
}

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

  const allSkills = filterSkills([
    ...bundledSkills,
    ...managedSkills,
    ...workspaceSkills,
  ]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-svh w-svw max-w-none rounded-none p-0">
        <div className="flex h-full flex-col">
          <DialogHeader className="border-b border-white/10 px-6 py-5">
            <div className="mb-3">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to app
              </button>
            </div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <DialogTitle className="text-2xl font-semibold">Skills</DialogTitle>
                <DialogDescription className="mt-1 text-sm">
                  Give Codex superpowers.{" "}
                  <a className="text-primary hover:underline" href="#">
                    Learn more
                  </a>
                </DialogDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" className="gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </Button>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search skills"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-9 w-56 pl-8"
                  />
                </div>
                <Button size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  New skill
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-hidden px-6 py-5">
            <div className="mb-3 flex items-center justify-between text-sm text-muted-foreground">
              <span>Installed</span>
              <span>{enabledCount} enabled</span>
            </div>

            <ScrollArea className="h-full pr-4">
              {allSkills.length === 0 ? (
                <div className="py-16 text-center text-sm text-muted-foreground">
                  No skills match your search.
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {allSkills.map((skill) => (
                    <div
                      key={skill.id}
                      className="group flex items-start gap-3 rounded-xl border border-white/10 bg-[#111318] p-3 transition-colors hover:border-white/20"
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        {categoryIcons[skill.id] || categoryIcons.default}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="truncate text-sm font-semibold">{skill.name}</h4>
                          <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            {skill.category}
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {skill.description}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Button size="icon" variant="ghost" className="h-8 w-8">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Switch
                          checked={skill.enabled}
                          onCheckedChange={(checked: boolean) =>
                            handleToggle(skill.id, checked, skill.category)
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {workspacePath ? null : (
                <div className="mt-6 rounded-xl border border-dashed border-white/10 p-4 text-xs text-muted-foreground">
                  Select a workspace to view project-specific skills.
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
