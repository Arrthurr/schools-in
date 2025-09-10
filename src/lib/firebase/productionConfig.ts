/**
 * Production-specific Firebase configuration and monitoring setup
 */

import { analytics, performance } from '../../../firebase.config';

// Analytics event types
export const ANALYTICS_EVENTS = {
  // Authentication events
  LOGIN: 'login',
  LOGOUT: 'logout',
  SIGNUP: 'sign_up',
  
  // Session events  
  SESSION_START: 'session_start',
  SESSION_END: 'session_end',
  SESSION_PAUSE: 'session_pause',
  SESSION_RESUME: 'session_resume',
  
  // Location events
  LOCATION_CHECK_IN: 'location_check_in',
  LOCATION_CHECK_OUT: 'location_check_out',
  LOCATION_VIEW: 'location_view',
  
  // Search and navigation
  SEARCH: 'search',
  PAGE_VIEW: 'page_view',
  
  // Error events
  ERROR: 'error',
  CACHE_ERROR: 'cache_error',
  NETWORK_ERROR: 'network_error',
  
  // Performance events
  PERFORMANCE_METRIC: 'performance_metric',
  CACHE_HIT: 'cache_hit',
  CACHE_MISS: 'cache_miss',
} as const;

// Custom performance metrics
export const PERFORMANCE_METRICS = {
  CHECK_IN_DURATION: 'check_in_duration',
  LOCATION_LOAD_TIME: 'location_load_time',
  SESSION_LIST_LOAD: 'session_list_load',
  USER_SEARCH_TIME: 'user_search_time',
  CACHE_RESPONSE_TIME: 'cache_response_time',
} as const;

export class ProductionMonitoring {
  // Track user events
  static trackEvent(
    eventName: string,
    parameters: Record<string, any> = {},
    userProperties: Record<string, any> = {}
  ): void {
    if (typeof window === 'undefined' || !analytics) return;

    try {
      // Log analytics event
      analytics.logEvent(eventName, {
        ...parameters,
        app_version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
        environment: 'production',
        timestamp: Date.now(),
      });

      // Set user properties if provided
      if (Object.keys(userProperties).length > 0) {
        Object.entries(userProperties).forEach(([key, value]) => {
          analytics.setUserProperty(key, value);
        });
      }
    } catch (error) {
      console.warn('Analytics tracking failed:', error);
    }
  }

  // Track custom performance metrics
  static trackPerformance(
    metricName: string,
    value: number,
    attributes: Record<string, string> = {}
  ): void {
    if (typeof window === 'undefined' || !performance) return;

    try {
      const trace = performance.trace(metricName);
      
      // Add custom attributes
      Object.entries(attributes).forEach(([key, val]) => {
        trace.putAttribute(key, val);
      });

      // Record the metric value
      trace.putMetric(metricName, Math.round(value));
      trace.stop();
      
      // Also track as analytics event
      this.trackEvent(ANALYTICS_EVENTS.PERFORMANCE_METRIC, {
        metric_name: metricName,
        metric_value: value,
        ...attributes,
      });
    } catch (error) {
      console.warn('Performance tracking failed:', error);
    }
  }

  // Track user sessions
  static trackUserSession(
    userId: string,
    action: 'start' | 'end' | 'pause' | 'resume',
    sessionData: Record<string, any> = {}
  ): void {
    const eventMap = {
      start: ANALYTICS_EVENTS.SESSION_START,
      end: ANALYTICS_EVENTS.SESSION_END,
      pause: ANALYTICS_EVENTS.SESSION_PAUSE,
      resume: ANALYTICS_EVENTS.SESSION_RESUME,
    };

    this.trackEvent(eventMap[action], {
      user_id: userId,
      session_duration: sessionData.duration,
      location_id: sessionData.locationId,
      session_type: sessionData.type || 'check_in',
    }, {
      user_role: sessionData.userRole,
      total_sessions: sessionData.totalSessions,
    });
  }

  // Track check-in/check-out events
  static trackLocationEvent(
    action: 'check_in' | 'check_out' | 'view',
    locationData: Record<string, any>,
    userContext: Record<string, any> = {}
  ): void {
    const eventName = action === 'check_in' 
      ? ANALYTICS_EVENTS.LOCATION_CHECK_IN
      : action === 'check_out'
      ? ANALYTICS_EVENTS.LOCATION_CHECK_OUT
      : ANALYTICS_EVENTS.LOCATION_VIEW;

    this.trackEvent(eventName, {
      location_id: locationData.locationId,
      location_name: locationData.locationName,
      accuracy: locationData.accuracy,
      distance_from_location: locationData.distance,
      gps_time: locationData.gpsTime,
    }, {
      user_role: userContext.role,
      provider_experience: userContext.experience,
    });
  }

  // Track errors with context
  static trackError(
    error: Error,
    context: Record<string, any> = {},
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ): void {
    this.trackEvent(ANALYTICS_EVENTS.ERROR, {
      error_message: error.message,
      error_stack: error.stack?.substring(0, 500), // Truncate for analytics
      error_context: JSON.stringify(context),
      error_severity: severity,
      user_agent: navigator.userAgent,
      url: window.location.href,
    });

    // Also send to performance monitoring as an error
    if (performance) {
      try {
        const trace = performance.trace(`error_${severity}`);
        trace.putAttribute('error_type', error.name);
        trace.putAttribute('error_message', error.message.substring(0, 100));
        trace.stop();
      } catch (perfError) {
        console.warn('Performance error tracking failed:', perfError);
      }
    }
  }

  // Track cache performance
  static trackCachePerformance(
    operation: 'hit' | 'miss' | 'write' | 'invalidate',
    details: Record<string, any> = {}
  ): void {
    const eventName = operation === 'hit' 
      ? ANALYTICS_EVENTS.CACHE_HIT 
      : ANALYTICS_EVENTS.CACHE_MISS;

    this.trackEvent(eventName, {
      cache_operation: operation,
      cache_type: details.cacheType,
      data_type: details.dataType,
      response_time: details.responseTime,
    });
  }

  // Track search operations
  static trackSearch(
    searchTerm: string,
    searchType: 'users' | 'locations' | 'sessions',
    results: {
      count: number;
      loadTime: number;
      fromCache: boolean;
    }
  ): void {
    this.trackEvent(ANALYTICS_EVENTS.SEARCH, {
      search_term: searchTerm.substring(0, 50), // Truncate for privacy
      search_type: searchType,
      results_count: results.count,
      load_time: results.loadTime,
      from_cache: results.fromCache,
    });
  }

  // Set user context for analytics
  static setUserContext(user: {
    uid: string;
    role: 'provider' | 'admin';
    displayName?: string;
    email?: string;
  }): void {
    if (!analytics) return;

    try {
      // Set user ID for analytics
      analytics.setUserId(user.uid);

      // Set user properties
      analytics.setUserProperties({
        user_role: user.role,
        user_type: user.role,
        display_name: user.displayName,
      });
    } catch (error) {
      console.warn('Failed to set user context:', error);
    }
  }

  // Initialize production monitoring
  static initialize(): void {
    if (typeof window === 'undefined') return;

    // Track page views
    this.trackEvent(ANALYTICS_EVENTS.PAGE_VIEW, {
      page_title: document.title,
      page_location: window.location.href,
      page_path: window.location.pathname,
    });

    // Monitor performance
    this.setupPerformanceMonitoring();

    // Monitor errors
    this.setupErrorMonitoring();

    console.log('🔍 Production monitoring initialized');
  }

  // Setup performance monitoring
  private static setupPerformanceMonitoring(): void {
    if (!performance) return;

    // Monitor page load performance
    window.addEventListener('load', () => {
      setTimeout(() => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        
        if (navigation) {
          this.trackPerformance('page_load_time', navigation.loadEventEnd - navigation.fetchStart, {
            page: window.location.pathname,
          });
        }
      }, 1000);
    });

    // Monitor largest contentful paint
    if ('web-vitals' in window) {
      import('web-vitals').then(({ onLCP, onFID, onCLS, onFCP, onTTFB }) => {
        onLCP((metric) => {
          this.trackPerformance('lcp', metric.value, {
            page: window.location.pathname,
            rating: metric.rating,
          });
        });

        onFID((metric) => {
          this.trackPerformance('fid', metric.value, {
            page: window.location.pathname,
            rating: metric.rating,
          });
        });

        onCLS((metric) => {
          this.trackPerformance('cls', metric.value * 1000, { // Convert to milliseconds
            page: window.location.pathname,
            rating: metric.rating,
          });
        });
      });
    }
  }

  // Setup error monitoring
  private static setupErrorMonitoring(): void {
    // Global error handler
    window.addEventListener('error', (event) => {
      this.trackError(new Error(event.message), {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        source: 'global_error_handler',
      }, 'high');
    });

    // Unhandled promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
      this.trackError(new Error(event.reason), {
        source: 'unhandled_promise_rejection',
        promise: event.promise.toString().substring(0, 100),
      }, 'high');
    });
  }
}

// Auto-initialize in production
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
  ProductionMonitoring.initialize();
}

export { ProductionMonitoring };
