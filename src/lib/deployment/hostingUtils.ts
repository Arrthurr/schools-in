/**
 * Firebase Hosting deployment utilities and helpers
 */

export interface DeploymentInfo {
  version: string;
  timestamp: string;
  commitSha: string;
  branch: string;
  environment: 'development' | 'staging' | 'production';
  buildSize: number;
  deploymentTime: number;
}

export interface HostingConfig {
  projectId: string;
  siteName: string;
  customDomain?: string;
  channels: {
    production: string;
    staging: string;
    preview: string;
  };
  caching: {
    staticAssets: number;
    images: number;
    apiResponses: number;
  };
}

export class HostingManager {
  private static config: HostingConfig = {
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'schools-in-check',
    siteName: 'schools-in-check',
    customDomain: process.env.NEXT_PUBLIC_CUSTOM_DOMAIN,
    channels: {
      production: 'live',
      staging: 'staging', 
      preview: 'preview',
    },
    caching: {
      staticAssets: 31536000, // 1 year
      images: 2592000,        // 30 days
      apiResponses: 3600,     // 1 hour
    },
  };

  // Get deployment information from environment
  static getDeploymentInfo(): DeploymentInfo {
    return {
      version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
      timestamp: process.env.NEXT_PUBLIC_BUILD_TIME || new Date().toISOString(),
      commitSha: process.env.NEXT_PUBLIC_COMMIT_SHA || 'unknown',
      branch: process.env.NEXT_PUBLIC_BRANCH || 'main',
      environment: (process.env.NEXT_PUBLIC_APP_ENV as any) || 'production',
      buildSize: this.calculateBuildSize(),
      deploymentTime: Date.now(),
    };
  }

  // Calculate build size (client-side estimation)
  private static calculateBuildSize(): number {
    if (typeof window === 'undefined') return 0;
    
    // Rough estimation based on performance entries
    try {
      const entries = performance.getEntriesByType('resource');
      return entries.reduce((total, entry) => {
        if (entry.name.includes('.js') || entry.name.includes('.css')) {
          return total + ((entry as any).transferSize || 0);
        }
        return total;
      }, 0);
    } catch (error) {
      return 0;
    }
  }

  // Generate cache headers for different asset types
  static generateCacheHeaders(assetType: 'static' | 'image' | 'api' | 'manifest' | 'sw'): string {
    const config = this.config.caching;
    
    switch (assetType) {
      case 'static':
        return `public,max-age=${config.staticAssets},immutable`;
      case 'image':
        return `public,max-age=${config.images}`;
      case 'api':
        return `public,max-age=${config.apiResponses}`;
      case 'manifest':
        return 'public,max-age=86400'; // 1 day
      case 'sw':
        return 'no-cache'; // Always fresh
      default:
        return 'public,max-age=3600'; // 1 hour default
    }
  }

  // Check deployment health
  static async checkDeploymentHealth(baseUrl?: string): Promise<{
    status: 'healthy' | 'degraded' | 'down';
    checks: {
      connectivity: boolean;
      ssl: boolean;
      performance: boolean;
      pwa: boolean;
    };
    metrics: {
      responseTime: number;
      loadSize: number;
    };
  }> {
    const url = baseUrl || `https://${this.config.siteName}.web.app`;
    
    const checks = {
      connectivity: false,
      ssl: false,
      performance: false,
      pwa: false,
    };

    const metrics = {
      responseTime: 0,
      loadSize: 0,
    };

    try {
      // Connectivity check
      const startTime = Date.now();
      const response = await fetch(url, { 
        method: 'HEAD',
        cache: 'no-cache',
      });
      metrics.responseTime = Date.now() - startTime;
      checks.connectivity = response.ok;

      // SSL check (HTTPS)
      checks.ssl = url.startsWith('https://');

      // Performance check (basic)
      checks.performance = metrics.responseTime < 3000;

      // PWA check
      try {
        const manifestResponse = await fetch(`${url}/manifest.json`);
        const swResponse = await fetch(`${url}/sw.js`);
        checks.pwa = manifestResponse.ok && swResponse.ok;
      } catch {
        checks.pwa = false;
      }

      // Load size estimation
      if (checks.connectivity) {
        try {
          const htmlResponse = await fetch(url);
          const htmlText = await htmlResponse.text();
          metrics.loadSize = new Blob([htmlText]).size;
        } catch {
          // Ignore load size errors
        }
      }

    } catch (error) {
      console.error('Health check failed:', error);
    }

    // Determine overall status
    const healthyChecks = Object.values(checks).filter(Boolean).length;
    const totalChecks = Object.keys(checks).length;
    
    let status: 'healthy' | 'degraded' | 'down';
    if (healthyChecks === totalChecks) {
      status = 'healthy';
    } else if (healthyChecks >= totalChecks / 2) {
      status = 'degraded';
    } else {
      status = 'down';
    }

    return {
      status,
      checks,
      metrics,
    };
  }

  // Get hosting configuration for current environment
  static getHostingConfig(): {
    headers: Record<string, string>;
    redirects: Array<{ source: string; destination: string; type: number }>;
    rewrites: Array<{ source: string; destination: string }>;
  } {
    return {
      headers: {
        // Static assets
        '**/*.@(js|css|woff|woff2)': this.generateCacheHeaders('static'),
        
        // Images
        '**/*.@(png|jpg|jpeg|gif|svg|webp|avif|ico)': this.generateCacheHeaders('image'),
        
        // Manifest
        '/manifest.json': this.generateCacheHeaders('manifest'),
        
        // Service worker
        '/sw.js': this.generateCacheHeaders('sw'),
        
        // Security headers for all routes
        '**': [
          'X-Frame-Options: DENY',
          'X-Content-Type-Options: nosniff',
          'Referrer-Policy: strict-origin-when-cross-origin',
          'Permissions-Policy: camera=(), microphone=(), geolocation=(self)',
        ].join(', '),
      },
      
      redirects: [
        // Redirect old paths if any
        { source: '/login', destination: '/', type: 302 },
        { source: '/home', destination: '/dashboard', type: 301 },
      ],
      
      rewrites: [
        // SPA routing
        { source: '**', destination: '/index.html' },
      ],
    };
  }

  // Monitor deployment metrics
  static async monitorDeployment(): Promise<void> {
    if (typeof window === 'undefined') return;

    const info = this.getDeploymentInfo();
    const health = await this.checkDeploymentHealth();

    // Log deployment information
    console.log('🚀 Deployment Info:', info);
    console.log('🏥 Health Status:', health);

    // Send metrics to analytics (if available)
    try {
      const { analytics } = await import('../../../firebase.config');
      if (analytics) {
        analytics.logEvent('deployment_health_check', {
          status: health.status,
          response_time: health.metrics.responseTime,
          load_size: health.metrics.loadSize,
          environment: info.environment,
          version: info.version,
        });
      }
    } catch (error) {
      console.warn('Failed to log deployment metrics:', error);
    }

    // Store in local storage for debugging
    try {
      localStorage.setItem('deployment_info', JSON.stringify(info));
      localStorage.setItem('deployment_health', JSON.stringify(health));
    } catch (error) {
      console.warn('Failed to store deployment info:', error);
    }
  }
}

// Deployment status component props
export interface DeploymentStatusProps {
  showVersion?: boolean;
  showHealth?: boolean;
  showMetrics?: boolean;
  className?: string;
}

// Hook for deployment information
export function useDeploymentInfo() {
  const [info, setInfo] = useState<DeploymentInfo | null>(null);
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDeploymentInfo = async () => {
      try {
        const deploymentInfo = HostingManager.getDeploymentInfo();
        const healthInfo = await HostingManager.checkDeploymentHealth();
        
        setInfo(deploymentInfo);
        setHealth(healthInfo);
      } catch (error) {
        console.error('Failed to load deployment info:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDeploymentInfo();
    
    // Monitor every 5 minutes in production
    if (process.env.NODE_ENV === 'production') {
      const interval = setInterval(loadDeploymentInfo, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, []);

  return {
    info,
    health,
    loading,
    refresh: () => HostingManager.monitorDeployment(),
  };
}

// Auto-initialize deployment monitoring
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
  // Monitor deployment on app start
  setTimeout(() => {
    HostingManager.monitorDeployment();
  }, 2000);
}

export { HostingManager };

import { useState, useEffect } from 'react';
