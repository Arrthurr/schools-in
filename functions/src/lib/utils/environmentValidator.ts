/**
 * Production environment validation and configuration utilities
 */

export interface EnvironmentConfig {
  firebase: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
  };
  app: {
    environment: 'development' | 'staging' | 'production';
    version: string;
    buildTime: string;
  };
  features: {
    analytics: boolean;
    performanceMonitoring: boolean;
    caching: boolean;
    pwa: boolean;
    sentry: boolean;
  };
  cache: {
    ttlShort: number;
    ttlMedium: number;
    ttlLong: number;
    maxMemorySize: number;
  };
}

export class EnvironmentValidator {
  private static requiredEnvVars = [
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
    'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    'NEXT_PUBLIC_FIREBASE_APP_ID',
  ];

  // Validate all required environment variables
  static validate(): {
    isValid: boolean;
    missingVars: string[];
    warnings: string[];
  } {
    const missingVars: string[] = [];
    const warnings: string[] = [];

    // Check required environment variables
    this.requiredEnvVars.forEach(varName => {
      const value = process.env[varName];
      if (!value || value.trim() === '') {
        missingVars.push(varName);
      }
    });

    // Check optional but recommended variables
    const recommendedVars = [
      'NEXT_PUBLIC_APP_VERSION',
      'NEXT_PUBLIC_SENTRY_DSN',
      'SENTRY_ORG',
      'SENTRY_PROJECT',
    ];

    recommendedVars.forEach(varName => {
      const value = process.env[varName];
      if (!value || value.trim() === '') {
        warnings.push(`Recommended environment variable ${varName} is not set`);
      }
    });

    // Validate Firebase configuration format
    if (process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
      const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
      if (!apiKey.startsWith('AIza') || apiKey.length !== 39) {
        warnings.push('Firebase API key format appears invalid');
      }
    }

    if (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
      const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
      if (!/^[a-z0-9-]+$/.test(projectId)) {
        warnings.push('Firebase project ID format appears invalid');
      }
    }

    return {
      isValid: missingVars.length === 0,
      missingVars,
      warnings,
    };
  }

  // Get complete environment configuration
  static getConfig(): EnvironmentConfig {
    return {
      firebase: {
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
        messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
      },
      app: {
        environment: (process.env.NODE_ENV as any) || 'development',
        version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
        buildTime: process.env.NEXT_PUBLIC_BUILD_TIME || new Date().toISOString(),
      },
      features: {
        analytics: process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true',
        performanceMonitoring: process.env.NEXT_PUBLIC_ENABLE_PERFORMANCE_MONITORING === 'true',
        caching: process.env.NEXT_PUBLIC_ENABLE_CACHING !== 'false', // Default true
        pwa: process.env.NEXT_PUBLIC_PWA_ENABLED === 'true',
        sentry: process.env.NEXT_PUBLIC_ENABLE_SENTRY === 'true',
      },
      cache: {
        ttlShort: parseInt(process.env.NEXT_PUBLIC_CACHE_TTL_SHORT || '300000'),
        ttlMedium: parseInt(process.env.NEXT_PUBLIC_CACHE_TTL_MEDIUM || '1800000'), 
        ttlLong: parseInt(process.env.NEXT_PUBLIC_CACHE_TTL_LONG || '7200000'),
        maxMemorySize: parseInt(process.env.NEXT_PUBLIC_CACHE_MAX_MEMORY_SIZE || '200'),
      },
    };
  }

  // Validate runtime environment
  static validateRuntime(): {
    isSupported: boolean;
    missingFeatures: string[];
    browserInfo: {
      userAgent: string;
      supports: {
        serviceWorker: boolean;
        indexedDB: boolean;
        geolocation: boolean;
        notifications: boolean;
        webp: boolean;
        intersectionObserver: boolean;
      };
    };
  } {
    const missingFeatures: string[] = [];
    
    if (typeof window === 'undefined') {
      return {
        isSupported: false,
        missingFeatures: ['window'],
        browserInfo: {
          userAgent: 'Server-side',
          supports: {
            serviceWorker: false,
            indexedDB: false,
            geolocation: false,
            notifications: false,
            webp: false,
            intersectionObserver: false,
          },
        },
      };
    }

    // Check for required browser features
    const features = {
      serviceWorker: 'serviceWorker' in navigator,
      indexedDB: 'indexedDB' in window,
      geolocation: 'geolocation' in navigator,
      notifications: 'Notification' in window,
      webp: this.supportsWebP(),
      intersectionObserver: 'IntersectionObserver' in window,
    };

    // Identify missing critical features
    Object.entries(features).forEach(([feature, supported]) => {
      if (!supported) {
        missingFeatures.push(feature);
      }
    });

    return {
      isSupported: missingFeatures.length === 0,
      missingFeatures,
      browserInfo: {
        userAgent: navigator.userAgent,
        supports: features,
      },
    };
  }

  // Check WebP support
  private static supportsWebP(): boolean {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
    } catch {
      return false;
    }
  }

  // Get detailed system information
  static getSystemInfo(): {
    performance: {
      memory?: {
        usedJSHeapSize: number;
        totalJSHeapSize: number;
        jsHeapSizeLimit: number;
      };
      connection?: {
        effectiveType: string;
        downlink: number;
        rtt: number;
        saveData: boolean;
      };
    };
    screen: {
      width: number;
      height: number;
      devicePixelRatio: number;
    };
    location: {
      href: string;
      hostname: string;
      pathname: string;
    };
  } {
    const info: any = {
      performance: {},
      screen: {
        width: window.innerWidth,
        height: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio || 1,
      },
      location: {
        href: window.location.href,
        hostname: window.location.hostname,
        pathname: window.location.pathname,
      },
    };

    // Memory information (if available)
    if ('memory' in performance) {
      info.performance.memory = (performance as any).memory;
    }

    // Network information (if available)
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      info.performance.connection = {
        effectiveType: connection.effectiveType,
        downlink: connection.downlink,
        rtt: connection.rtt,
        saveData: connection.saveData,
      };
    }

    return info;
  }

  // Production health check
  static async performHealthCheck(): Promise<{
    status: 'healthy' | 'warning' | 'error';
    checks: {
      environment: boolean;
      runtime: boolean;
      firebase: boolean;
      cache: boolean;
    };
    details: any;
  }> {
    const checks = {
      environment: false,
      runtime: false,
      firebase: false,
      cache: false,
    };

    const details: any = {};

    try {
      // Environment validation
      const envValidation = this.validate();
      checks.environment = envValidation.isValid;
      details.environment = envValidation;

      // Runtime validation
      const runtimeValidation = this.validateRuntime();
      checks.runtime = runtimeValidation.isSupported;
      details.runtime = runtimeValidation;

      // Firebase connectivity check
      try {
        // Simple Firebase connectivity test
        if (typeof window !== 'undefined') {
          const { auth } = await import('../../../firebase.config');
          checks.firebase = !!auth;
          details.firebase = { connected: true };
        }
      } catch (error) {
        checks.firebase = false;
        details.firebase = { error: error.message };
      }

      // Cache system check
      try {
        const { cacheManager } = await import('@/lib/cache/CacheManager');
        // Simple cache test
        await cacheManager.set('health_check', 'test', {
          type: 'memory' as any,
          ttl: 1000,
        });
        const result = await cacheManager.get('health_check', {
          type: 'memory' as any,
          ttl: 1000,
        });
        checks.cache = result === 'test';
        details.cache = { working: checks.cache };
      } catch (error) {
        checks.cache = false;
        details.cache = { error: error.message };
      }

      // Determine overall status
      const allHealthy = Object.values(checks).every(Boolean);
      const hasWarnings = !allHealthy && (checks.environment && checks.runtime);
      
      return {
        status: allHealthy ? 'healthy' : hasWarnings ? 'warning' : 'error',
        checks,
        details,
      };
    } catch (error) {
      return {
        status: 'error',
        checks,
        details: { error: error.message },
      };
    }
  }
}

// Auto-validate environment in production
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
  const validation = EnvironmentValidator.validate();
  
  if (!validation.isValid) {
    console.error('❌ Production environment validation failed:', validation.missingVars);
  } else if (validation.warnings.length > 0) {
    console.warn('⚠️ Production environment warnings:', validation.warnings);
  } else {
    console.log('✅ Production environment validation passed');
  }
}

export { EnvironmentValidator };
