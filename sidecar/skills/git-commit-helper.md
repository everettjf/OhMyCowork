# Git Commit Helper Skill

## Overview
This skill helps generate meaningful commit messages following conventional commits specification and best practices.

## Activation
This skill is automatically activated when:
- User asks to commit changes
- User mentions "commit", "git commit", "commit message"
- Tasks involving version control

## Conventional Commits Format

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Types
- **feat**: New feature for the user
- **fix**: Bug fix for the user
- **docs**: Documentation only changes
- **style**: Formatting, missing semicolons, etc (no code change)
- **refactor**: Code change that neither fixes a bug nor adds a feature
- **perf**: Performance improvement
- **test**: Adding or updating tests
- **build**: Changes to build system or dependencies
- **ci**: Changes to CI configuration
- **chore**: Other changes that don't modify src or test files
- **revert**: Reverts a previous commit

### Scope
Optional, indicates the section of the codebase:
- `feat(auth): add login functionality`
- `fix(api): handle null response`
- `docs(readme): update installation steps`

### Breaking Changes
Use `!` after type/scope or add `BREAKING CHANGE:` in footer:
- `feat!: drop support for Node 12`
- `feat(api)!: change response format`

## Best Practices

### Subject Line
- **Use imperative mood**: "Add feature" not "Added feature"
- **Keep under 50 characters** when possible
- **Don't end with a period**
- **Capitalize first letter**

### Body
- **Explain what and why** vs. how
- **Wrap at 72 characters**
- **Use bullet points** for multiple changes
- **Reference issues** when relevant

### Examples

#### Good Commits
```
feat(auth): add OAuth2 login support

- Implement Google OAuth2 provider
- Add session persistence
- Update user model for OAuth data

Closes #123
```

```
fix(api): prevent race condition in user creation

The previous implementation could create duplicate users
when multiple requests arrived simultaneously. This adds
a database-level unique constraint and proper error handling.

Fixes #456
```

```
refactor: extract validation logic to separate module

Moves validation functions from UserController to
dedicated ValidationService for better reusability
and testing.
```

#### Bad Commits
- `fixed stuff` (too vague)
- `WIP` (not descriptive)
- `Update index.js` (doesn't explain what changed)
- `Fix bug` (which bug?)

## Commit Message Generator

When generating commit messages:

1. **Analyze the changes** - understand what files changed and how
2. **Identify the type** - is it a feature, fix, refactor, etc.
3. **Determine scope** - which part of the app is affected
4. **Write clear subject** - summarize the change in imperative mood
5. **Add body if needed** - explain complex changes
6. **Reference issues** - link to relevant tickets
