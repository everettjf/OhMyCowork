---
name: skill-creator
description: Create or update SKILL.md-based skills. Use when designing, structuring, or packaging reusable skills with scripts, references, and assets.
---

# Skill Creator

This skill helps design and iterate high-quality skills for OhMyCowork/DeepAgents.

## When to use

Use this skill when users ask to:
- create a new skill
- improve an existing skill
- structure skill resources (`scripts/`, `references/`, `assets/`)

## Core principles

1. Keep SKILL.md concise
- Assume the model is already capable.
- Add only domain-specific, procedural, or non-obvious guidance.
- Prefer short examples over long explanation.

2. Choose the right amount of constraint
- High freedom: plain guidance for variable tasks.
- Medium freedom: patterns or pseudocode.
- Low freedom: deterministic scripts for fragile/repeatable tasks.

3. Use progressive disclosure
- SKILL.md: activation + workflow.
- `references/`: long docs loaded only when needed.
- `scripts/`: deterministic operations.
- `assets/`: templates and output resources.

## Recommended structure

```text
<skill-name>/
  SKILL.md
  scripts/       (optional)
  references/    (optional)
  assets/        (optional)
```

## Workflow

1. Clarify intended user requests and trigger phrases.
2. Extract repeatable steps from examples.
3. Decide what belongs in SKILL.md vs scripts/references/assets.
4. Draft SKILL.md with explicit activation conditions.
5. Test with realistic prompts and tighten wording.
6. Keep SKILL.md short; move detail into references.

## SKILL.md quality checklist

- Frontmatter has clear `name` and `description`.
- Body states when the skill should trigger.
- Steps are actionable and ordered.
- References are linked from SKILL.md (no deep nesting).
- No redundant docs that bloat context.

## Path guidance for this project

- Project skills live in `.deepagents/skills/`.
- Each skill should be a folder containing `SKILL.md`.
- Prefer workspace-relative examples and commands.

## Source attribution

Adapted from OpenClaw's `skill-creator` concept:
`https://github.com/openclaw/openclaw/tree/main/skills/skill-creator`
