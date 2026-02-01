# Code Review Skill

## Overview
This skill provides comprehensive code review guidelines covering security, performance, maintainability, and best practices.

## Activation
This skill is automatically activated when:
- User asks for code review or feedback
- User mentions "review", "check my code", "any issues"
- Tasks involving code analysis or improvement suggestions

## Review Checklist

### 1. Security

#### Input Validation
- [ ] All user inputs are validated and sanitized
- [ ] SQL queries use parameterized statements
- [ ] No direct HTML injection (XSS prevention)
- [ ] File uploads are validated and restricted

#### Authentication & Authorization
- [ ] Passwords are properly hashed (bcrypt, argon2)
- [ ] Session management is secure
- [ ] Authorization checks on all protected resources
- [ ] Sensitive data is not logged

#### Data Protection
- [ ] Secrets are not hardcoded
- [ ] HTTPS enforced for sensitive operations
- [ ] Proper CORS configuration
- [ ] Rate limiting on sensitive endpoints

### 2. Performance

#### Code Efficiency
- [ ] No unnecessary loops or iterations
- [ ] Efficient data structures used
- [ ] Database queries are optimized
- [ ] N+1 query problems avoided

#### Resource Management
- [ ] Resources properly cleaned up (connections, files)
- [ ] Memory leaks prevented
- [ ] Caching used appropriately
- [ ] Lazy loading for expensive operations

### 3. Maintainability

#### Code Quality
- [ ] Functions are small and focused
- [ ] Clear and descriptive naming
- [ ] DRY principle followed (no code duplication)
- [ ] SOLID principles applied

#### Documentation
- [ ] Complex logic is commented
- [ ] Public APIs are documented
- [ ] README is up to date
- [ ] Edge cases are documented

### 4. Error Handling

#### Robustness
- [ ] Errors are caught and handled gracefully
- [ ] User-friendly error messages
- [ ] Errors are logged for debugging
- [ ] Fallback behavior for failures

#### Validation
- [ ] Edge cases are handled
- [ ] Null/undefined checks where needed
- [ ] Type checking in dynamic languages
- [ ] Input boundaries validated

### 5. Testing

#### Coverage
- [ ] Unit tests for business logic
- [ ] Integration tests for critical paths
- [ ] Edge cases are tested
- [ ] Error scenarios are tested

#### Quality
- [ ] Tests are readable and maintainable
- [ ] Tests don't depend on each other
- [ ] Mocks are used appropriately
- [ ] Test data is realistic

### 6. Code Style

#### Consistency
- [ ] Follows project coding standards
- [ ] Consistent formatting
- [ ] Consistent naming conventions
- [ ] Proper indentation and spacing

#### Best Practices
- [ ] No magic numbers (use constants)
- [ ] Avoid deep nesting
- [ ] Early returns for guard clauses
- [ ] Prefer composition over inheritance

## Review Response Format

When providing code review feedback:

1. **Start with positives** - acknowledge good patterns
2. **Categorize issues** by severity (Critical, Major, Minor, Suggestion)
3. **Explain the why** - not just what's wrong, but why it matters
4. **Provide solutions** - suggest specific improvements
5. **Be constructive** - focus on code, not the person
