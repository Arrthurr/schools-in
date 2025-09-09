# Schools In Design System

## Brand Colors

### Primary Brand Color

- **Primary**: `#154690` (Deep Blue)
- **Primary Dark**: `#0f3a7a` (Darker Blue for hover states)
- **Primary Light**: `#eff6ff` (Very Light Blue for backgrounds)

### Usage in Tailwind CSS

#### CSS Variables (Preferred)

```css
/* Use these for dynamic theming support */
bg-primary           /* Primary brand color */
text-primary         /* Primary text color */
border-primary       /* Primary border color */
bg-primary/10        /* 10% opacity primary background */
bg-primary/20        /* 20% opacity primary background */
hover:bg-primary/90  /* 90% opacity on hover */
```

#### Direct Colors (When needed)

```css
bg-brand-primary         /* Direct #154690 */
bg-brand-primary-dark    /* Direct #0f3a7a */
bg-brand-primary-light   /* Direct #eff6ff */
text-brand-primary       /* Direct #154690 text */
border-brand-primary     /* Direct #154690 border */
```

## Status Colors

### Consistent Status Indicators

```css
/* Active/Success States */
status-active     /* Green background/text/border for active sessions */
bg-success        /* #10b981 - Success actions */
text-success      /* Success text color */

/* Completed States */
status-completed  /* Primary color background for completed items */
bg-primary/10     /* Light primary background */
text-primary      /* Primary text */

/* Warning/Paused States */
status-paused     /* Yellow background/text/border for paused states */
bg-warning        /* #f59e0b - Warning color */
text-warning      /* Warning text color */

/* Error States */
status-error      /* Red background/text/border for errors */
bg-error          /* #ef4444 - Error color */
text-error        /* Error text color */

/* Neutral/Cancelled States */
status-cancelled  /* Gray background/text/border for cancelled items */
```

## Typography

### Font Family

- **Primary**: Inter (loaded from Google Fonts)
- **Fallback**: system font stack

### Text Styles

```css
text-balance     /* Balanced text wrapping */
```

## Component Guidelines

### Buttons

- Primary buttons should use `bg-primary hover:bg-primary/90`
- Secondary buttons should use the default shadcn/ui styling
- Destructive actions use `bg-destructive hover:bg-destructive/90`

### Badges and Status Indicators

- Use the `status-*` utility classes for consistent status display
- Active sessions: Green
- Completed sessions: Primary blue
- Paused sessions: Yellow/Warning
- Error sessions: Red
- Cancelled sessions: Gray

### Loading States

- Use `text-primary` for loading spinners and progress bars
- Progress bars should use `bg-primary` for the filled portion

### Icons

- Navigation and GPS icons should use `text-primary`
- Status icons should match their respective status colors
- Neutral icons use `text-gray-500` or `text-muted-foreground`

## Dark Mode Support

The design system includes dark mode variants for all colors:

- Primary colors adjust brightness appropriately
- All status colors have dark mode equivalents
- Background and foreground colors invert properly

## Implementation Notes

1. **Consistency**: Always use design system classes instead of hardcoded colors
2. **Accessibility**: All color combinations meet WCAG 2.1 AA contrast requirements
3. **Theming**: CSS variables enable dynamic theme switching
4. **Brand Alignment**: All colors derive from or complement the primary brand color `#154690`

## Migration Guide

When updating existing components:

1. Replace `#154690` with `bg-primary` or `text-primary`
2. Replace `#0f3a7a` with `bg-primary/90` or `hover:bg-primary/90`
3. Replace hardcoded blue colors with appropriate primary color variants
4. Use semantic status classes instead of hardcoded green/red/yellow colors
5. Ensure all interactive elements have proper hover states using design system colors
