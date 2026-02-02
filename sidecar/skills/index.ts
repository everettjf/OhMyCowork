import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Bundled skills metadata
export const BUNDLED_SKILLS = [
  {
    id: "react-best-practices",
    name: "React Best Practices",
    description: "Guidelines for writing performant React and Next.js applications",
    file: "react-best-practices.md",
    triggers: ["react", "next.js", "component", "tsx", "jsx", "hook"],
    enabled: true,
  },
  {
    id: "web-design-guidelines",
    name: "Web Design Guidelines",
    description: "Comprehensive guidelines for accessible, performant web interfaces",
    file: "web-design-guidelines.md",
    triggers: ["design", "ui", "ux", "css", "accessibility", "layout", "style"],
    enabled: true,
  },
  {
    id: "code-review",
    name: "Code Review",
    description: "Code review guidelines covering security, performance, and best practices",
    file: "code-review.md",
    triggers: ["review", "check", "feedback", "analyze", "audit"],
    enabled: true,
  },
  {
    id: "git-commit-helper",
    name: "Git Commit Helper",
    description: "Generate meaningful commit messages following conventional commits",
    file: "git-commit-helper.md",
    triggers: ["commit", "git", "version control", "changelog"],
    enabled: true,
  },
];

/**
 * Load a skill's content from file
 */
export function loadSkillContent(skillId) {
  const skill = BUNDLED_SKILLS.find((s) => s.id === skillId);
  if (!skill) {
    return null;
  }

  const skillPath = path.join(__dirname, skill.file);
  try {
    return fs.readFileSync(skillPath, "utf-8");
  } catch (error) {
    console.error(`Failed to load skill ${skillId}:`, error.message);
    return null;
  }
}

/**
 * Find relevant skills based on user message
 */
export function findRelevantSkills(message, enabledSkillIds = null) {
  const lowerMessage = message.toLowerCase();
  const relevantSkills = [];

  for (const skill of BUNDLED_SKILLS) {
    // Check if skill is enabled
    if (enabledSkillIds && !enabledSkillIds.includes(skill.id)) {
      continue;
    }

    if (!skill.enabled) {
      continue;
    }

    // Check if any trigger matches
    const hasMatch = skill.triggers.some((trigger) =>
      lowerMessage.includes(trigger.toLowerCase())
    );

    if (hasMatch) {
      relevantSkills.push(skill);
    }
  }

  return relevantSkills;
}

/**
 * Build skill context for system prompt
 */
export function buildSkillContext(message, enabledSkillIds = null) {
  const relevantSkills = findRelevantSkills(message, enabledSkillIds);

  if (relevantSkills.length === 0) {
    return "";
  }

  const skillContents = relevantSkills
    .map((skill) => {
      const content = loadSkillContent(skill.id);
      if (!content) return null;
      return `\n---\n## Skill: ${skill.name}\n${content}`;
    })
    .filter(Boolean);

  if (skillContents.length === 0) {
    return "";
  }

  return `

## Active Skills

The following skills are activated based on your request:
${skillContents.join("\n")}

---
Use the guidelines from these skills to inform your response.
`;
}

/**
 * Get list of all available skills
 */
export function getAllSkills() {
  return BUNDLED_SKILLS.map((skill) => ({
    id: skill.id,
    name: skill.name,
    description: skill.description,
    enabled: skill.enabled,
    triggers: skill.triggers,
  }));
}

/**
 * Load workspace skills from a project directory
 */
export function loadWorkspaceSkills(workspacePath) {
  if (!workspacePath) {
    return [];
  }

  const skillsDir = path.join(workspacePath, ".deepagents", "skills");
  const skills = [];

  try {
    if (!fs.existsSync(skillsDir)) {
      return skills;
    }

    const files = fs.readdirSync(skillsDir);
    for (const file of files) {
      if (file.endsWith(".md")) {
        const skillPath = path.join(skillsDir, file);
        const content = fs.readFileSync(skillPath, "utf-8");

        // Extract skill name from first heading
        const nameMatch = content.match(/^#\s+(.+)/m);
        const name = nameMatch ? nameMatch[1] : file.replace(".md", "");

        skills.push({
          id: `workspace:${file.replace(".md", "")}`,
          name,
          description: `Workspace skill from ${file}`,
          file,
          path: skillPath,
          content,
          enabled: true,
          category: "workspace",
        });
      }
    }
  } catch (error) {
    console.error("Failed to load workspace skills:", error.message);
  }

  return skills;
}
