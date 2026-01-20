# Code Style

## Imports

Use `@/` alias for src imports. Group external imports before internal.

## Components

- Use `cn()` for className merging (clsx + tailwind-merge)
- Types are exported from `src/lib/firebase/types.ts`

## Locations

Use `locationService` for location operations:
- `getAssignedLocations()`, `calculateDistance()`, `isWithinRadius()`

## Images

Use `OptimizedImage` or `LazyImage` instead of raw `<img>` tags.

## Performance

Prefer cached hooks (`useCachedAuth`, `useCachedSession`) over uncached alternatives.

## Maps

Use `@vis.gl/react-google-maps` components for Google Maps integration.

## Accessibility

See `docs/design-system.md` and `docs/responsive-design-system.md` for ARIA and semantic HTML patterns.
