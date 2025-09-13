// Accessibility testing utilities
// Accessibility testing utilities - using React Testing Library types instead of Enzyme

export interface AccessibilityViolation {
  id: string;
  description: string;
  impact: 'minor' | 'moderate' | 'serious' | 'critical';
  help: string;
  helpUrl: string;
  element: string;
  selectors: string[];
}

export interface AccessibilityTestResult {
  violations: AccessibilityViolation[];
  passes: AccessibilityViolation[];
  inapplicable: AccessibilityViolation[];
  incomplete: AccessibilityViolation[];
  timestamp: number;
  url: string;
  rules: string[];
}

// WCAG 2.1 AA compliance checker
export class AccessibilityTester {
  private static instance: AccessibilityTester;
  private axeCore: any;
  private isInitialized = false;

  private constructor() {}

  public static getInstance(): AccessibilityTester {
    if (!AccessibilityTester.instance) {
      AccessibilityTester.instance = new AccessibilityTester();
    }
    return AccessibilityTester.instance;
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      // Dynamic import of axe-core for browser environments
      if (typeof window !== 'undefined') {
        this.axeCore = await import('axe-core');
        await this.configureAxe();
        this.isInitialized = true;
      }
    } catch (error) {
      console.warn('Failed to initialize accessibility tester:', error);
    }
  }

  private async configureAxe() {
    if (!this.axeCore) return;

    // Configure axe for WCAG 2.1 AA compliance
    this.axeCore.configure({
      rules: [
        // Level A rules
        { id: 'area-alt', enabled: true },
        { id: 'aria-allowed-attr', enabled: true },
        { id: 'aria-hidden-body', enabled: true },
        { id: 'aria-hidden-focus', enabled: true },
        { id: 'aria-label', enabled: true },
        { id: 'aria-labelledby', enabled: true },
        { id: 'aria-required-attr', enabled: true },
        { id: 'aria-roles', enabled: true },
        { id: 'aria-valid-attr', enabled: true },
        { id: 'aria-valid-attr-value', enabled: true },
        { id: 'button-name', enabled: true },
        { id: 'bypass', enabled: true },
        { id: 'document-title', enabled: true },
        { id: 'duplicate-id', enabled: true },
        { id: 'form-field-multiple-labels', enabled: true },
        { id: 'frame-title', enabled: true },
        { id: 'html-has-lang', enabled: true },
        { id: 'html-lang-valid', enabled: true },
        { id: 'image-alt', enabled: true },
        { id: 'input-image-alt', enabled: true },
        { id: 'label', enabled: true },
        { id: 'link-name', enabled: true },
        { id: 'list', enabled: true },
        { id: 'listitem', enabled: true },
        { id: 'marquee', enabled: true },
        { id: 'meta-refresh', enabled: true },
        { id: 'object-alt', enabled: true },
        { id: 'role-img-alt', enabled: true },
        { id: 'scrollable-region-focusable', enabled: true },
        { id: 'server-side-image-map', enabled: true },
        { id: 'svg-img-alt', enabled: true },
        { id: 'td-headers-attr', enabled: true },
        { id: 'th-has-data-cells', enabled: true },
        { id: 'valid-lang', enabled: true },
        { id: 'video-caption', enabled: true },

        // Level AA rules
        { id: 'color-contrast', enabled: true },
        { id: 'focus-order-semantics', enabled: true },
        { id: 'hidden-content', enabled: true },
        { id: 'label-title-only', enabled: true },
        { id: 'landmark-banner-is-top-level', enabled: true },
        { id: 'landmark-complementary-is-top-level', enabled: true },
        { id: 'landmark-contentinfo-is-top-level', enabled: true },
        { id: 'landmark-main-is-top-level', enabled: true },
        { id: 'landmark-no-duplicate-banner', enabled: true },
        { id: 'landmark-no-duplicate-contentinfo', enabled: true },
        { id: 'landmark-one-main', enabled: true },
        { id: 'landmark-unique', enabled: true },
        { id: 'page-has-heading-one', enabled: true },
        { id: 'region', enabled: true },
        { id: 'scope-attr-valid', enabled: true },
        { id: 'skip-link', enabled: true },
      ],
      tags: ['wcag2a', 'wcag2aa', 'wcag21aa'],
    });
  }

  async testElement(element: HTMLElement | string): Promise<AccessibilityTestResult> {
    await this.initialize();

    if (!this.axeCore) {
      throw new Error('Accessibility tester not initialized');
    }

    try {
      const results = await this.axeCore.run(element, {
        includedImpacts: ['minor', 'moderate', 'serious', 'critical'],
        resultTypes: ['violations', 'passes', 'inapplicable', 'incomplete'],
        rules: {},
      });

      return this.formatResults(results);
    } catch (error) {
      console.error('Accessibility test failed:', error);
      throw error;
    }
  }

  async testPage(url?: string): Promise<AccessibilityTestResult> {
    await this.initialize();

    if (!this.axeCore) {
      throw new Error('Accessibility tester not initialized');
    }

    try {
      const results = await this.axeCore.run(document, {
        includedImpacts: ['minor', 'moderate', 'serious', 'critical'],
        resultTypes: ['violations', 'passes', 'inapplicable', 'incomplete'],
      });

      return this.formatResults(results, url);
    } catch (error) {
      console.error('Page accessibility test failed:', error);
      throw error;
    }
  }

  private formatResults(axeResults: any, url?: string): AccessibilityTestResult {
    return {
      violations: axeResults.violations.map(this.formatViolation),
      passes: axeResults.passes.map(this.formatViolation),
      inapplicable: axeResults.inapplicable.map(this.formatViolation),
      incomplete: axeResults.incomplete.map(this.formatViolation),
      timestamp: Date.now(),
      url: url || window.location.href,
      rules: axeResults.rules || [],
    };
  }

  private formatViolation(violation: any): AccessibilityViolation {
    return {
      id: violation.id,
      description: violation.description,
      impact: violation.impact,
      help: violation.help,
      helpUrl: violation.helpUrl,
      element: violation.nodes?.[0]?.html || '',
      selectors: violation.nodes?.[0]?.target || [],
    };
  }

  // Jest testing utilities
  async expectNoViolations(element: HTMLElement | string) {
    const results = await this.testElement(element);
    
    if (results.violations.length > 0) {
      const violationMessages = results.violations.map(v => 
        `${v.id}: ${v.description} (${v.impact})\n  Element: ${v.element}\n  Help: ${v.help}`
      ).join('\n\n');
      
      throw new Error(`Accessibility violations found:\n\n${violationMessages}`);
    }
  }

  async expectMinimumScore(element: HTMLElement | string, minScore: number = 0.95) {
    const results = await this.testElement(element);
    const totalTests = results.violations.length + results.passes.length;
    const passedTests = results.passes.length;
    const score = totalTests > 0 ? passedTests / totalTests : 1;

    if (score < minScore) {
      throw new Error(
        `Accessibility score ${score.toFixed(2)} is below minimum ${minScore.toFixed(2)}\n` +
        `Violations: ${results.violations.length}, Passes: ${results.passes.length}`
      );
    }
  }
}

// Utility functions for manual testing
export function checkColorContrast(foreground: string, background: string): { ratio: number; passes: boolean; level: string } {
  // Simple color contrast checker
  const getLuminance = (color: string) => {
    const rgb = color.match(/\d+/g);
    if (!rgb) return 0;
    
    const [r, g, b] = rgb.map(c => {
      const value = parseInt(c) / 255;
      return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
    });
    
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  const fgLuminance = getLuminance(foreground);
  const bgLuminance = getLuminance(background);
  const ratio = (Math.max(fgLuminance, bgLuminance) + 0.05) / (Math.min(fgLuminance, bgLuminance) + 0.05);

  return {
    ratio: Math.round(ratio * 100) / 100,
    passes: ratio >= 4.5,
    level: ratio >= 7 ? 'AAA' : ratio >= 4.5 ? 'AA' : 'Fail'
  };
}

export function checkFocusManagement(element: HTMLElement): boolean {
  // Check if element is focusable
  const focusableSelectors = [
    'a[href]',
    'button',
    'input',
    'textarea',
    'select',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable]'
  ];

  return focusableSelectors.some(selector => 
    element.matches(selector) || element.querySelector(selector) !== null
  );
}

export function checkAriaLabeling(element: HTMLElement): { hasLabel: boolean; labelType: string } {
  const ariaLabel = element.getAttribute('aria-label');
  const ariaLabelledBy = element.getAttribute('aria-labelledby');
  const ariaDescribedBy = element.getAttribute('aria-describedby');
  const title = element.getAttribute('title');
  const label = element.id ? document.querySelector(`label[for="${element.id}"]`) : null;

  if (ariaLabel) return { hasLabel: true, labelType: 'aria-label' };
  if (ariaLabelledBy) return { hasLabel: true, labelType: 'aria-labelledby' };
  if (label) return { hasLabel: true, labelType: 'label' };
  if (title) return { hasLabel: true, labelType: 'title' };
  if (ariaDescribedBy) return { hasLabel: true, labelType: 'aria-describedby' };

  return { hasLabel: false, labelType: 'none' };
}

export function checkHeadingStructure(container: HTMLElement = document.body): { valid: boolean; issues: string[] } {
  const headings = Array.from(container.querySelectorAll('h1, h2, h3, h4, h5, h6'));
  const issues: string[] = [];

  if (headings.length === 0) {
    issues.push('No headings found');
    return { valid: false, issues };
  }

  // Check for h1
  const h1Count = headings.filter(h => h.tagName === 'H1').length;
  if (h1Count === 0) {
    issues.push('No H1 heading found');
  } else if (h1Count > 1) {
    issues.push('Multiple H1 headings found');
  }

  // Check heading hierarchy
  let lastLevel = 0;
  headings.forEach((heading, index) => {
    const level = parseInt(heading.tagName[1]);
    
    if (index === 0 && level !== 1) {
      issues.push(`First heading is H${level}, should be H1`);
    }
    
    if (level > lastLevel + 1) {
      issues.push(`Heading level jumps from H${lastLevel} to H${level}`);
    }
    
    lastLevel = level;
  });

  return { valid: issues.length === 0, issues };
}

// Export singleton instance
export const accessibilityTester = AccessibilityTester.getInstance();

// Jest matchers (if using Jest)
if (typeof expect !== 'undefined') {
  (expect as any).extend({
    async toBeAccessible(element: HTMLElement | string) {
      try {
        await accessibilityTester.expectNoViolations(element);
        return {
          message: () => 'Element passed accessibility checks',
          pass: true,
        };
      } catch (error) {
        return {
          message: () => (error as Error).message,
          pass: false,
        };
      }
    },
    
    async toHaveAccessibilityScore(element: HTMLElement | string, minScore: number) {
      try {
        await accessibilityTester.expectMinimumScore(element, minScore);
        return {
          message: () => `Element meets minimum accessibility score of ${minScore}`,
          pass: true,
        };
      } catch (error) {
        return {
          message: () => (error as Error).message,
          pass: false,
        };
      }
    },
  });
}
