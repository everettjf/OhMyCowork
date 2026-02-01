# React Best Practices Skill

## Overview
This skill provides guidelines for writing performant React and Next.js applications.

## Activation
This skill is automatically activated when:
- Working with `.tsx`, `.jsx` files
- User mentions "React", "Next.js", "component", "performance"
- Code review tasks involving React code

## Guidelines

### 1. Component Design
- **Prefer functional components** with hooks over class components
- **Keep components small and focused** - single responsibility principle
- **Use TypeScript** for type safety and better developer experience
- **Avoid prop drilling** - use Context or state management for deep prop passing

### 2. Performance Optimization
- **Use React.memo()** for components that receive the same props frequently
- **Memoize expensive calculations** with useMemo()
- **Memoize callback functions** with useCallback() when passed as props
- **Avoid inline object/array creation** in JSX props
- **Implement code splitting** with dynamic imports for large components

### 3. State Management
- **Keep state as local as possible** - lift only when necessary
- **Use derived state** instead of syncing state
- **Batch state updates** when possible
- **Consider using useReducer** for complex state logic

### 4. Data Fetching
- **Avoid request waterfalls** - fetch data in parallel when possible
- **Use Suspense boundaries** for loading states
- **Implement proper error boundaries** for graceful error handling
- **Cache and deduplicate requests** using libraries like SWR or React Query

### 5. Rendering Optimization
- **Avoid unnecessary re-renders** by checking component update patterns
- **Use virtualization** for long lists (react-window, react-virtualized)
- **Optimize images** with next/image or proper lazy loading
- **Minimize bundle size** by importing only needed modules

### 6. Code Organization
- **Co-locate related code** - keep components, styles, and tests together
- **Use barrel exports** sparingly - can cause bundle bloat
- **Organize by feature** rather than by file type
- **Extract custom hooks** for reusable stateful logic

### 7. Testing
- **Test behavior, not implementation** - focus on user interactions
- **Use Testing Library** queries that reflect how users interact
- **Mock external dependencies** but avoid over-mocking
- **Write integration tests** for critical user flows

### 8. Accessibility
- **Use semantic HTML** elements
- **Ensure keyboard navigation** works properly
- **Provide ARIA labels** where necessary
- **Test with screen readers** and accessibility tools
