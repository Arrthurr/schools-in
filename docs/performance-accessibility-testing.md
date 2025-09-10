# Performance and Accessibility Testing Guide

This document outlines the comprehensive performance and accessibility testing infrastructure implemented in the Schools-In application.

## Overview

Our testing strategy ensures WCAG 2.1 AA compliance and optimal performance across all devices and network conditions. The testing suite includes:

- **Core Web Vitals monitoring** - LCP, FID, CLS, FCP, TTFB
- **Accessibility compliance** - WCAG 2.1 AA standard
- **Performance budgets** - Bundle size and load time limits
- **Real-user monitoring** - Web Vitals tracking in production

## Testing Tools

### 1. Lighthouse CI
- **Purpose**: Automated performance, accessibility, SEO, and best practices auditing
- **Configuration**: `lighthouse.config.js`
- **Run**: `npm run lighthouse:local`

### 2. Cypress with axe-core
- **Purpose**: E2E performance and accessibility testing
- **Files**: `cypress/e2e/performance-accessibility.cy.ts`
- **Run**: `npm run test:performance` or `npm run test:a11y`

### 3. Web Vitals Monitoring
- **Purpose**: Real-time Core Web Vitals tracking
- **Implementation**: `src/lib/performance/webVitals.ts`
- **Component**: `src/components/dev/PerformanceMonitor.tsx`

### 4. Accessibility Testing Utils
- **Purpose**: Programmatic accessibility testing
- **Implementation**: `src/lib/testing/accessibilityUtils.ts`
- **Integration**: Jest matchers and Cypress commands

## Performance Standards

### Core Web Vitals Thresholds

| Metric | Good | Needs Improvement | Poor |
|--------|------|------------------|------|
| **LCP** (Largest Contentful Paint) | ≤ 2.5s | ≤ 4.0s | > 4.0s |
| **FID** (First Input Delay) | ≤ 100ms | ≤ 300ms | > 300ms |
| **CLS** (Cumulative Layout Shift) | ≤ 0.1 | ≤ 0.25 | > 0.25 |
| **FCP** (First Contentful Paint) | ≤ 1.8s | ≤ 3.0s | > 3.0s |
| **TTFB** (Time to First Byte) | ≤ 800ms | ≤ 1.8s | > 1.8s |

### Performance Budgets

- **Initial Bundle Size**: < 1MB
- **Page Load Time**: < 2 seconds
- **Memory Usage**: < 50MB
- **Lighthouse Performance Score**: ≥ 80
- **Time to Interactive**: < 3 seconds

## Accessibility Standards

### WCAG 2.1 AA Compliance

Our application meets WCAG 2.1 AA standards including:

- **Perceivable**: Color contrast ratios ≥ 4.5:1
- **Operable**: Full keyboard navigation support
- **Understandable**: Clear content structure and labels
- **Robust**: Semantic HTML and proper ARIA usage

### Accessibility Score Target
- **Lighthouse Accessibility Score**: ≥ 95
- **axe-core Violations**: 0 critical/serious violations
- **Keyboard Navigation**: 100% coverage

## Running Tests

### Local Development

```bash
# Run all performance tests
npm run test:performance

# Run accessibility tests only
npm run test:a11y

# Run Lighthouse locally
npm run lighthouse:local

# Run full E2E suite
npm run test:e2e:ci
```

### Performance Monitoring in Development

Add the PerformanceMonitor component to any page:

```tsx
import { PerformanceMonitor } from '@/components/dev/PerformanceMonitor';

// In your component
<PerformanceMonitor showDetails={true} autoRefresh={true} />
```

### Manual Testing

```javascript
// Check Web Vitals programmatically
import { webVitalsMonitor } from '@/lib/performance/webVitals';

const metrics = await webVitalsMonitor.getAllMetrics();
console.log('Current metrics:', metrics);

const grade = webVitalsMonitor.getPerformanceGrade();
console.log('Performance grade:', grade);
```

### Accessibility Testing in Jest

```javascript
import { accessibilityTester } from '@/lib/testing/accessibilityUtils';

test('component should be accessible', async () => {
  render(<MyComponent />);
  const container = screen.getByRole('main');
  
  // Test with custom matcher
  await expect(container).toBeAccessible();
  
  // Test with minimum score
  await expect(container).toHaveAccessibilityScore(0.95);
});
```

## CI/CD Integration

### GitHub Actions

The performance and accessibility tests run automatically on:
- Push to `main` or `develop` branches  
- Pull requests to `main` or `develop`

Workflow files:
- `.github/workflows/performance-accessibility.yml`

### Test Results

Results are uploaded as artifacts:
- **Lighthouse Reports**: Performance, accessibility, SEO scores
- **Cypress Videos/Screenshots**: Test failure diagnostics
- **Bundle Analysis**: Code splitting and size analysis

## Performance Optimization Strategies

### 1. Code Splitting
- Route-based code splitting with Next.js
- Dynamic imports for heavy components
- Lazy loading of non-critical resources

### 2. Image Optimization
- Next.js Image component with automatic optimization
- Lazy loading with `loading="lazy"`
- Proper alt text for accessibility

### 3. Bundle Optimization
- Tree shaking of unused code
- Minimization and compression
- Critical CSS inlining

### 4. Caching Strategy
- Service worker caching with next-pwa
- Static asset caching
- API response caching

## Accessibility Implementation

### 1. Semantic HTML
- Proper heading hierarchy (H1 → H2 → H3)
- Semantic landmarks (main, nav, aside, footer)
- Form labels and associations

### 2. ARIA Implementation
- Live regions for dynamic content
- Descriptive labels and descriptions
- Role attributes where needed

### 3. Keyboard Navigation
- Full keyboard accessibility
- Focus management in modals
- Skip links for navigation

### 4. Color and Contrast
- Minimum contrast ratios met
- Information not conveyed by color alone
- High contrast mode support

## Monitoring in Production

### Web Vitals Tracking

Real user monitoring is enabled through:
- `webVitalsMonitor` automatic tracking
- Firebase Performance integration
- Custom analytics endpoint

### Performance Alerts

Automatic alerts are sent when:
- Core Web Vitals exceed thresholds
- Memory usage is excessive
- Bundle size increases significantly

### Accessibility Monitoring

Continuous accessibility monitoring through:
- Regular automated audits
- User feedback collection
- Screen reader testing

## Troubleshooting

### Common Performance Issues

1. **High LCP**: Optimize images, reduce server response time
2. **High FID**: Minimize JavaScript execution time
3. **High CLS**: Set dimensions for dynamic content
4. **Large bundle**: Analyze and split code, remove unused dependencies

### Common Accessibility Issues

1. **Missing alt text**: Add descriptive alt attributes to images
2. **Low contrast**: Adjust color schemes to meet ratios
3. **Keyboard navigation**: Ensure all interactive elements are focusable
4. **Missing labels**: Add proper form labels and ARIA attributes

## Resources

- [Web Vitals Documentation](https://web.dev/vitals/)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/Understanding/)
- [Lighthouse Documentation](https://developers.google.com/web/tools/lighthouse)
- [axe-core Rules](https://github.com/dequelabs/axe-core/blob/develop/doc/rule-descriptions.md)

## Reporting Issues

When reporting performance or accessibility issues:

1. Include Web Vitals metrics
2. Provide accessibility audit results
3. Specify device and browser information
4. Include steps to reproduce

For urgent performance issues, include:
- Lighthouse report
- Network conditions
- Device specifications
- User impact assessment
