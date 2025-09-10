// Web Vitals monitoring utility
import { getCLS, getFID, getFCP, getLCP, getTTFB, onCLS, onFID, onFCP, onLCP, onTTFB } from 'web-vitals';

export interface WebVitalsMetric {
  name: 'CLS' | 'FID' | 'FCP' | 'LCP' | 'TTFB';
  value: number;
  delta: number;
  id: string;
  rating: 'good' | 'needs-improvement' | 'poor';
  navigationType: 'navigate' | 'reload' | 'back-forward' | 'back-forward-cache' | 'prerender';
  timestamp: number;
  url: string;
  userAgent: string;
}

export interface WebVitalsReport {
  metrics: WebVitalsMetric[];
  timestamp: number;
  sessionId: string;
  userId?: string;
  page: string;
  viewport: {
    width: number;
    height: number;
  };
  connection?: {
    effectiveType?: string;
    rtt?: number;
    downlink?: number;
  };
}

// Performance thresholds (based on Core Web Vitals recommendations)
export const PERFORMANCE_THRESHOLDS = {
  LCP: { good: 2500, needsImprovement: 4000 }, // Largest Contentful Paint
  FID: { good: 100, needsImprovement: 300 },   // First Input Delay
  CLS: { good: 0.1, needsImprovement: 0.25 },  // Cumulative Layout Shift
  FCP: { good: 1800, needsImprovement: 3000 }, // First Contentful Paint
  TTFB: { good: 800, needsImprovement: 1800 }, // Time to First Byte
} as const;

class WebVitalsMonitor {
  private metrics: Map<string, WebVitalsMetric> = new Map();
  private sessionId: string;
  private userId?: string;
  private isProduction: boolean;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.isProduction = process.env.NODE_ENV === 'production';
    this.initialize();
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private initialize() {
    // Initialize all Core Web Vitals monitoring
    onCLS(this.handleMetric.bind(this));
    onFID(this.handleMetric.bind(this));
    onFCP(this.handleMetric.bind(this));
    onLCP(this.handleMetric.bind(this));
    onTTFB(this.handleMetric.bind(this));

    // Set up page visibility change handler
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.sendReport();
      }
    });

    // Set up beforeunload handler
    window.addEventListener('beforeunload', () => {
      this.sendReport();
    });
  }

  private handleMetric(metric: any) {
    const webVitalsMetric: WebVitalsMetric = {
      name: metric.name,
      value: metric.value,
      delta: metric.delta,
      id: metric.id,
      rating: this.getRating(metric.name, metric.value),
      navigationType: (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming)?.type || 'navigate',
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
    };

    this.metrics.set(metric.name, webVitalsMetric);

    // Log in development
    if (!this.isProduction) {
      console.log(`[Web Vitals] ${metric.name}:`, webVitalsMetric);
    }

    // Send real-time alerts for poor performance
    if (webVitalsMetric.rating === 'poor') {
      this.sendAlert(webVitalsMetric);
    }
  }

  private getRating(name: string, value: number): 'good' | 'needs-improvement' | 'poor' {
    const thresholds = PERFORMANCE_THRESHOLDS[name as keyof typeof PERFORMANCE_THRESHOLDS];
    if (!thresholds) return 'good';

    if (value <= thresholds.good) return 'good';
    if (value <= thresholds.needsImprovement) return 'needs-improvement';
    return 'poor';
  }

  private getConnectionInfo() {
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    if (!connection) return undefined;

    return {
      effectiveType: connection.effectiveType,
      rtt: connection.rtt,
      downlink: connection.downlink,
    };
  }

  private generateReport(): WebVitalsReport {
    return {
      metrics: Array.from(this.metrics.values()),
      timestamp: Date.now(),
      sessionId: this.sessionId,
      userId: this.userId,
      page: window.location.pathname,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      connection: this.getConnectionInfo(),
    };
  }

  private sendReport() {
    if (this.metrics.size === 0) return;

    const report = this.generateReport();

    // Send to analytics in production
    if (this.isProduction) {
      this.sendToAnalytics(report);
    }

    // Always send to Firebase Performance if available
    this.sendToFirebasePerformance(report);
  }

  private sendAlert(metric: WebVitalsMetric) {
    console.warn(`[Performance Alert] Poor ${metric.name}: ${metric.value}ms`);
    
    // In production, send to monitoring service
    if (this.isProduction) {
      // Send to error reporting service
      this.sendToErrorReporting({
        type: 'performance-alert',
        metric: metric.name,
        value: metric.value,
        rating: metric.rating,
        url: window.location.href,
        timestamp: metric.timestamp,
      });
    }
  }

  private sendToAnalytics(report: WebVitalsReport) {
    // Google Analytics 4 integration
    if (typeof gtag !== 'undefined') {
      report.metrics.forEach(metric => {
        gtag('event', 'web_vitals', {
          event_category: 'Web Vitals',
          event_label: metric.name,
          value: Math.round(metric.value),
          custom_map: {
            metric_rating: metric.rating,
            metric_delta: metric.delta,
          },
        });
      });
    }

    // Send to custom analytics endpoint
    fetch('/api/analytics/web-vitals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report),
      keepalive: true,
    }).catch(err => {
      console.warn('Failed to send Web Vitals report:', err);
    });
  }

  private sendToFirebasePerformance(report: WebVitalsReport) {
    // Firebase Performance Monitoring integration
    if (typeof performance !== 'undefined' && 'mark' in performance) {
      report.metrics.forEach(metric => {
        // Create custom performance marks
        performance.mark(`web-vitals-${metric.name.toLowerCase()}-${metric.value}`);
        
        // Send custom trace (if Firebase Performance is initialized)
        if (window.firebase && window.firebase.performance) {
          const trace = window.firebase.performance().trace(`web_vitals_${metric.name}`);
          trace.putAttribute('rating', metric.rating);
          trace.putAttribute('page', report.page);
          trace.putMetric('value', Math.round(metric.value));
          trace.stop();
        }
      });
    }
  }

  private sendToErrorReporting(error: any) {
    // Send to error reporting service (e.g., Sentry)
    if (window.Sentry) {
      window.Sentry.captureMessage('Performance Alert', {
        level: 'warning',
        extra: error,
      });
    }
  }

  // Public methods
  public setUserId(userId: string) {
    this.userId = userId;
  }

  public getCurrentMetrics(): WebVitalsMetric[] {
    return Array.from(this.metrics.values());
  }

  public getMetric(name: keyof typeof PERFORMANCE_THRESHOLDS): WebVitalsMetric | undefined {
    return this.metrics.get(name);
  }

  public async getAllMetrics(): Promise<{ [key: string]: number }> {
    return new Promise((resolve) => {
      const metrics: { [key: string]: number } = {};
      
      getCLS((metric) => metrics.CLS = metric.value);
      getFID((metric) => metrics.FID = metric.value);
      getFCP((metric) => metrics.FCP = metric.value);
      getLCP((metric) => metrics.LCP = metric.value);
      getTTFB((metric) => metrics.TTFB = metric.value);
      
      // Give metrics time to be collected
      setTimeout(() => resolve(metrics), 100);
    });
  }

  public getPerformanceGrade(): 'A' | 'B' | 'C' | 'D' | 'F' {
    const metrics = this.getCurrentMetrics();
    if (metrics.length === 0) return 'F';

    const scores = metrics.map(metric => {
      switch (metric.rating) {
        case 'good': return 3;
        case 'needs-improvement': return 2;
        case 'poor': return 1;
        default: return 0;
      }
    });

    const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;

    if (averageScore >= 2.8) return 'A';
    if (averageScore >= 2.4) return 'B';
    if (averageScore >= 2.0) return 'C';
    if (averageScore >= 1.5) return 'D';
    return 'F';
  }
}

// Global instance
export const webVitalsMonitor = new WebVitalsMonitor();

// Convenience function for manual tracking
export function trackWebVitals(callback?: (report: WebVitalsReport) => void) {
  const monitor = new WebVitalsMonitor();
  
  if (callback) {
    // Return current metrics after a short delay
    setTimeout(() => {
      callback(monitor.generateReport());
    }, 1000);
  }
  
  return monitor;
}

// Export for global access
if (typeof window !== 'undefined') {
  (window as any).webVitalsMonitor = webVitalsMonitor;
}
