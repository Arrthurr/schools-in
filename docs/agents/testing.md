# Testing

## Commands

| Task | Command |
|------|---------|
| Unit tests | `npm test` |
| Watch mode | `npm run test:watch` |
| CI (coverage + junit) | `npm run test:ci` |
| E2E interactive | `npm run test:e2e` |
| E2E headless | `npm run test:e2e:headless` |
| E2E with dev server | `npm run test:e2e:dev` |
| E2E CI | `npm run test:e2e:ci` |
| Performance | `npm run test:performance` |
| Accessibility | `npm run test:a11y` |
| Firestore rules | `npm run test:firestore-rules` |
| Storage rules | `npm run test:storage-rules` |

## Lighthouse

```bash
npm run lighthouse         # Direct
npm run lighthouse:local   # Starts dev server first
```

## Bundle Analysis

```bash
npm run analyze   # Enables @next/bundle-analyzer
```

## Coverage Requirements

70% minimum for:
- Branches
- Functions
- Lines
- Statements

## Performance Targets (Core Web Vitals)

| Metric | Target |
|--------|--------|
| LCP | ≤ 2.5s |
| FID | ≤ 100ms |
| CLS | ≤ 0.1 |

## Accessibility Target

Lighthouse accessibility score ≥ 95% (WCAG 2.1 AA compliance)
