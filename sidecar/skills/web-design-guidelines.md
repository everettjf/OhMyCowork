# Web Design Guidelines Skill

## Overview
This skill provides comprehensive guidelines for creating accessible, performant, and user-friendly web interfaces.

## Activation
This skill is automatically activated when:
- Working with CSS, HTML, or UI components
- User mentions "design", "UI", "UX", "accessibility", "layout"
- Tasks involving styling or visual improvements

## Guidelines

### 1. Accessibility (WCAG 2.1)

#### Color & Contrast
- **Minimum contrast ratio**: 4.5:1 for normal text, 3:1 for large text
- **Don't rely on color alone** to convey information
- **Support high contrast mode** and user color preferences
- **Test with colorblind simulators**

#### Keyboard Navigation
- **All interactive elements** must be keyboard accessible
- **Visible focus indicators** - never remove outline without replacement
- **Logical tab order** following visual flow
- **Implement skip links** for main content

#### Screen Readers
- **Use semantic HTML** - header, main, nav, article, section
- **Provide alt text** for meaningful images
- **Label form inputs** properly with associated labels
- **Announce dynamic content** changes with ARIA live regions

### 2. Responsive Design

#### Layout
- **Mobile-first approach** - start with smallest screen
- **Use CSS Grid and Flexbox** for layouts
- **Avoid fixed widths** - use relative units (%, rem, vw)
- **Set readable line lengths** - 45-75 characters optimal

#### Breakpoints
- **Content-driven breakpoints** rather than device-specific
- **Test on real devices** not just browser resize
- **Consider touch targets** - minimum 44x44px on mobile
- **Handle orientation changes** gracefully

### 3. Typography

#### Font Selection
- **Limit font families** to 2-3 maximum
- **Use system fonts** for performance when appropriate
- **Ensure font loading** doesn't cause layout shifts
- **Provide fallback fonts** in font stack

#### Readability
- **Base font size**: minimum 16px for body text
- **Line height**: 1.4-1.6 for body text
- **Proper heading hierarchy** - don't skip levels
- **Adequate paragraph spacing**

### 4. Performance

#### Loading
- **Optimize images** - WebP, proper sizing, lazy loading
- **Minimize CSS** - remove unused styles
- **Critical CSS** inline for above-the-fold content
- **Preload important resources**

#### Animation
- **Use transform and opacity** for smooth animations
- **Respect prefers-reduced-motion** media query
- **Avoid layout-triggering animations**
- **Keep animations under 300ms** for perceived responsiveness

### 5. Forms

#### Design
- **Clear labels** visible at all times
- **Logical grouping** with fieldsets
- **Inline validation** with clear error messages
- **Progress indicators** for multi-step forms

#### UX
- **Minimize required fields**
- **Use appropriate input types** (email, tel, date)
- **Auto-focus first field** when appropriate
- **Preserve entered data** on errors

### 6. Visual Hierarchy

#### Layout
- **Clear content hierarchy** using size, color, spacing
- **Consistent spacing system** (4px or 8px base)
- **Whitespace is valuable** - don't overcrowd
- **Guide user attention** with visual cues

#### Components
- **Consistent component styling** across the application
- **Clear interactive states** (hover, active, disabled)
- **Meaningful icons** with text labels when possible
- **Loading states** for all async operations
