/**
 * Deployment configuration manager for multiple environments
 */

export interface EnvironmentConfig {
  name: "development" | "staging" | "production";
  firebase: {
    projectId: string;
    hostingSite: string;
    customDomain?: string;
  };
  hosting: {
    channelId: string;
    ttl: number; // Time to live for preview deployments
    customHeaders: Record<string, string>;
  };
  features: {
    analytics: boolean;
    performanceMonitoring: boolean;
    errorReporting: boolean;
    debugging: boolean;
  };
  caching: {
    enabled: boolean;
    strategy: "aggressive" | "moderate" | "minimal";
    ttl: {
      static: number;
      images: number;
      api: number;
    };
  };
  security: {
    enforceHttps: boolean;
    hsts: boolean;
    csp: string;
    frameOptions: "DENY" | "SAMEORIGIN" | "ALLOW-FROM";
  };
}

export class ConfigManager {
  private static configs: Record<string, EnvironmentConfig> = {
    development: {
      name: "development",
      firebase: {
        projectId: "schools-in-check",
        hostingSite: "schools-in-check",
      },
      hosting: {
        channelId: "dev",
        ttl: 7 * 24 * 60 * 60, // 7 days
        customHeaders: {},
      },
      features: {
        analytics: false,
        performanceMonitoring: true,
        errorReporting: true,
        debugging: true,
      },
      caching: {
        enabled: true,
        strategy: "minimal",
        ttl: {
          static: 60, // 1 minute
          images: 300, // 5 minutes
          api: 0, // No cache
        },
      },
      security: {
        enforceHttps: false,
        hsts: false,
        csp: "default-src 'self' 'unsafe-inline' 'unsafe-eval' localhost:* ws: data: blob:",
        frameOptions: "SAMEORIGIN",
      },
    },

    staging: {
      name: "staging",
      firebase: {
        projectId: "schools-in-check",
        hostingSite: "schools-in-check",
      },
      hosting: {
        channelId: "staging",
        ttl: 14 * 24 * 60 * 60, // 14 days
        customHeaders: {
          "X-Robots-Tag": "noindex, nofollow",
        },
      },
      features: {
        analytics: false,
        performanceMonitoring: true,
        errorReporting: true,
        debugging: true,
      },
      caching: {
        enabled: true,
        strategy: "moderate",
        ttl: {
          static: 3600, // 1 hour
          images: 86400, // 1 day
          api: 300, // 5 minutes
        },
      },
      security: {
        enforceHttps: true,
        hsts: true,
        csp: "default-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval' *.googleapis.com *.gstatic.com; connect-src 'self' *.googleapis.com *.firebaseapp.com *.cloudfunctions.net",
        frameOptions: "DENY",
      },
    },

    production: {
      name: "production",
      firebase: {
        projectId: "schools-in-check",
        hostingSite: "schools-in-check",
        customDomain: process.env.NEXT_PUBLIC_CUSTOM_DOMAIN,
      },
      hosting: {
        channelId: "live",
        ttl: 90 * 24 * 60 * 60, // 90 days
        customHeaders: {},
      },
      features: {
        analytics: true,
        performanceMonitoring: true,
        errorReporting: true,
        debugging: false,
      },
      caching: {
        enabled: true,
        strategy: "aggressive",
        ttl: {
          static: 31536000, // 1 year
          images: 2592000, // 30 days
          api: 3600, // 1 hour
        },
      },
      security: {
        enforceHttps: true,
        hsts: true,
        csp: "default-src 'self'; script-src 'self' 'unsafe-inline' *.googleapis.com *.gstatic.com *.sentry.io; connect-src 'self' *.googleapis.com *.firebaseapp.com *.cloudfunctions.net *.sentry.io; img-src 'self' data: *.googleusercontent.com *.firebasestorage.app; style-src 'self' 'unsafe-inline' *.googleapis.com; font-src 'self' *.gstatic.com",
        frameOptions: "DENY",
      },
    },
  };

  // Get configuration for current environment
  static getCurrentConfig(): EnvironmentConfig {
    const env = process.env.NODE_ENV || "development";
    const appEnv = process.env.NEXT_PUBLIC_APP_ENV || env;

    return this.configs[appEnv] || this.configs.development;
  }

  // Get configuration for specific environment
  static getConfig(
    environment: keyof typeof ConfigManager.configs
  ): EnvironmentConfig {
    return this.configs[environment];
  }

  // Generate Firebase hosting configuration
  static generateHostingConfig(environment?: string): any {
    const config = environment
      ? this.getConfig(environment as any)
      : this.getCurrentConfig();

    return {
      public: "out",
      ignore: ["firebase.json", "**/.*", "**/node_modules/**"],
      rewrites: [
        {
          source: "**",
          destination: "/index.html",
        },
      ],
      headers: this.generateHeaders(config),
      cleanUrls: true,
      trailingSlash: false,
    };
  }

  // Generate security headers based on environment
  private static generateHeaders(config: EnvironmentConfig): any[] {
    const headers = [];

    // Static assets caching
    headers.push({
      source: "**/*.@(js|css|woff|woff2)",
      headers: [
        {
          key: "Cache-Control",
          value: `public,max-age=${config.caching.ttl.static}${
            config.caching.strategy === "aggressive" ? ",immutable" : ""
          }`,
        },
      ],
    });

    // Image caching
    headers.push({
      source: "**/*.@(png|jpg|jpeg|gif|svg|webp|avif|ico)",
      headers: [
        {
          key: "Cache-Control",
          value: `public,max-age=${config.caching.ttl.images}`,
        },
        {
          key: "X-Content-Type-Options",
          value: "nosniff",
        },
      ],
    });

    // Manifest caching
    headers.push({
      source: "/manifest.json",
      headers: [
        {
          key: "Cache-Control",
          value: "public,max-age=86400", // 1 day
        },
      ],
    });

    // Service worker (no cache)
    headers.push({
      source: "/sw.js",
      headers: [
        {
          key: "Cache-Control",
          value: "no-cache",
        },
      ],
    });

    // Security headers for all routes
    const securityHeaders = [
      {
        key: "X-Frame-Options",
        value: config.security.frameOptions,
      },
      {
        key: "X-Content-Type-Options",
        value: "nosniff",
      },
      {
        key: "Referrer-Policy",
        value: "strict-origin-when-cross-origin",
      },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=(self)",
      },
    ];

    // Add HSTS header for production
    if (config.security.hsts) {
      securityHeaders.push({
        key: "Strict-Transport-Security",
        value: "max-age=31536000; includeSubDomains; preload",
      });
    }

    // Add CSP header
    securityHeaders.push({
      key: "Content-Security-Policy",
      value: config.security.csp,
    });

    // Add custom headers
    Object.entries(config.hosting.customHeaders).forEach(([key, value]) => {
      securityHeaders.push({ key, value });
    });

    headers.push({
      source: "**",
      headers: securityHeaders,
    });

    return headers;
  }

  // Validate deployment configuration
  static validateConfig(config?: EnvironmentConfig): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const configToValidate = config || this.getCurrentConfig();
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields validation
    if (!configToValidate.firebase.projectId) {
      errors.push("Firebase project ID is required");
    }

    if (!configToValidate.firebase.hostingSite) {
      errors.push("Firebase hosting site is required");
    }

    // Security validation
    if (configToValidate.name === "production") {
      if (!configToValidate.security.enforceHttps) {
        errors.push("HTTPS enforcement is required for production");
      }

      if (!configToValidate.security.hsts) {
        warnings.push("HSTS should be enabled for production");
      }

      if (configToValidate.features.debugging) {
        warnings.push("Debugging should be disabled in production");
      }

      if (!configToValidate.features.analytics) {
        warnings.push("Analytics should be enabled for production");
      }
    }

    // Performance validation
    if (
      configToValidate.caching.strategy === "minimal" &&
      configToValidate.name === "production"
    ) {
      warnings.push("Consider more aggressive caching for production");
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // Generate deployment summary
  static generateDeploymentSummary(): {
    environment: string;
    config: EnvironmentConfig;
    validation: ReturnType<typeof ConfigManager.validateConfig>;
    timestamp: string;
  } {
    const config = this.getCurrentConfig();
    const validation = this.validateConfig(config);

    return {
      environment: config.name,
      config,
      validation,
      timestamp: new Date().toISOString(),
    };
  }

  // Environment-specific build commands
  static getBuildCommand(environment: string): string {
    const commands = {
      development: "npm run dev",
      staging: "NODE_ENV=production NEXT_PUBLIC_APP_ENV=staging npm run build",
      production:
        "NODE_ENV=production NEXT_PUBLIC_APP_ENV=production npm run build",
    };

    return (
      commands[environment as keyof typeof commands] || commands.production
    );
  }

  // Get deployment URL for environment
  static getDeploymentUrl(environment: string, channelId?: string): string {
    const config = this.getConfig(environment as any);
    const baseUrl = `https://${config.firebase.hostingSite}.web.app`;

    if (environment === "production" || channelId === "live") {
      return config.firebase.customDomain || baseUrl;
    }

    if (channelId && channelId !== "live") {
      return `https://${config.firebase.hostingSite}--${channelId}.web.app`;
    }

    return baseUrl;
  }
}

// Auto-log current configuration in development
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  console.log(
    "🔧 Current deployment configuration:",
    ConfigManager.getCurrentConfig()
  );
}
