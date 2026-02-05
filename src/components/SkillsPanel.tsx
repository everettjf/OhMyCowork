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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Search,
  Plus,
  Package,
  Sparkles,
  FolderOpen,
  ExternalLink,
  Code2,
  Palette,
  Smartphone,
  Layers,
  FileCode,
  Settings2,
  FileSpreadsheet,
  FileText,
  Presentation,
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

function SkillCard({
  skill,
  onToggle
}: {
  skill: Skill;
  onToggle: (id: string, enabled: boolean) => void;
}) {
  const icon = categoryIcons[skill.id] || categoryIcons.default;

  return (
    <div className="group flex items-start gap-3 rounded-lg border border-border/60 bg-card p-3 transition-colors hover:border-border hover:bg-accent/30">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="font-medium text-sm truncate">{skill.name}</h4>
          {skill.version && (
            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              v{skill.version}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
          {skill.description}
        </p>
        {skill.author && (
          <p className="text-[10px] text-muted-foreground/70 mt-1">
            by {skill.author}
          </p>
        )}
      </div>
      <Switch
        checked={skill.enabled}
        onCheckedChange={(checked: boolean) => onToggle(skill.id, checked)}
        className="shrink-0"
      />
    </div>
  );
}

export function SkillsPanel({ open, onOpenChange, workspacePath }: SkillsPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [bundledSkills, setBundledSkills] = useState<Skill[]>(BUNDLED_SKILLS);
  const [managedSkills, setManagedSkills] = useState<Skill[]>(MANAGED_SKILLS);
  const [workspaceSkills, setWorkspaceSkills] = useState<Skill[]>([]);
  const [activeTab, setActiveTab] = useState("bundled");

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[600px] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Skills Manager
          </DialogTitle>
          <DialogDescription>
            Enable skills to extend agent capabilities. {enabledCount} skills active.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 px-1">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search skills..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8"
          />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="bundled" className="gap-1.5">
              <Package className="h-3.5 w-3.5" />
              Bundled
              <span className="text-[10px] bg-muted px-1 rounded">
                {bundledSkills.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="managed" className="gap-1.5">
              <Settings2 className="h-3.5 w-3.5" />
              Managed
              <span className="text-[10px] bg-muted px-1 rounded">
                {managedSkills.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="workspace" className="gap-1.5">
              <FolderOpen className="h-3.5 w-3.5" />
              Workspace
              <span className="text-[10px] bg-muted px-1 rounded">
                {workspaceSkills.length}
              </span>
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 mt-4 pr-4">
            <TabsContent value="bundled" className="mt-0 space-y-2 min-h-[350px]">
              {filterSkills(bundledSkills).map(skill => (
                <SkillCard
                  key={skill.id}
                  skill={skill}
                  onToggle={(id, enabled) => handleToggle(id, enabled, "bundled")}
                />
              ))}
              {filterSkills(bundledSkills).length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No bundled skills match your search.
                </div>
              )}
            </TabsContent>

            <TabsContent value="managed" className="mt-0 space-y-2 min-h-[350px]">
              {filterSkills(managedSkills).map(skill => (
                <SkillCard
                  key={skill.id}
                  skill={skill}
                  onToggle={(id, enabled) => handleToggle(id, enabled, "managed")}
                />
              ))}
              {filterSkills(managedSkills).length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No managed skills available.
                </div>
              )}
              <div className="pt-4 text-center">
                <Button variant="outline" size="sm" className="gap-1.5">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Browse Skill Registry
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="workspace" className="mt-0 space-y-2 min-h-[350px]">
              {workspacePath ? (
                <>
                  {filterSkills(workspaceSkills).map(skill => (
                    <SkillCard
                      key={skill.id}
                      skill={skill}
                      onToggle={(id, enabled) => handleToggle(id, enabled, "workspace")}
                    />
                  ))}
                  {workspaceSkills.length === 0 && (
                    <div className="text-center py-8">
                      <FolderOpen className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                      <p className="text-sm text-muted-foreground mb-2">
                        No workspace skills found.
                      </p>
                      <p className="text-xs text-muted-foreground/70 mb-4">
                        Create a <code className="bg-muted px-1 rounded">.deepagents/skills</code> folder in your workspace.
                      </p>
                      <Button variant="outline" size="sm" className="gap-1.5">
                        <Plus className="h-3.5 w-3.5" />
                        Create Skill
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8">
                  <FolderOpen className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Select a workspace to view project-specific skills.
                  </p>
                </div>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <div className="border-t pt-3 mt-auto">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            Skills extend agent capabilities with specialized knowledge
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
