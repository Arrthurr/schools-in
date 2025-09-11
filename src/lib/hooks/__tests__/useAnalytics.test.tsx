/**
 * Unit tests for useAnalytics hook
 */

import { renderHook, act } from '@testing-library/react';
import { useAnalytics } from '../useAnalytics';

// Mock the dependencies
jest.mock('../useAuth', () => ({
  useAuth: () => ({ user: null, loading: false })
}));

jest.mock('../../firebase/productionConfig', () => ({
  ProductionMonitoring: {
    setUserContext: jest.fn(),
    trackEvent: jest.fn(),
    trackPerformance: jest.fn(),
    trackUserSession: jest.fn(),
    trackLocationEvent: jest.fn(),
    trackError: jest.fn(),
    trackSearch: jest.fn(),
    trackCachePerformance: jest.fn(),
  },
  ANALYTICS_EVENTS: {
    PAGE_VIEW: 'page_view',
    LOGIN: 'login',
    LOGOUT: 'logout',
    CHECK_IN: 'check_in',
    CHECK_OUT: 'check_out',
    ERROR: 'error',
    SEARCH: 'search',
  },
  PERFORMANCE_METRICS: {
    PAGE_LOAD: 'page_load',
    API_CALL: 'api_call',
    CHECK_IN_DURATION: 'check_in_duration',
    SEARCH_PERFORMANCE: 'search_performance',
  },
}));

describe('useAnalytics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize without errors', () => {
    const { result } = renderHook(() => useAnalytics());
    expect(result.current).toBeTruthy();
  });

  it('should provide tracking functions', () => {
    const { result } = renderHook(() => useAnalytics());
    
    expect(result.current.trackEvent).toBeTruthy();
    expect(result.current.trackPerformance).toBeTruthy();
    expect(result.current.trackUserSession).toBeTruthy();
    expect(result.current.trackLocationEvent).toBeTruthy();
    expect(result.current.trackError).toBeTruthy();
  });

  it('should provide convenience methods', () => {
    const { result } = renderHook(() => useAnalytics());
    
    expect(result.current.trackLogin).toBeTruthy();
    expect(result.current.trackLogout).toBeTruthy();
    expect(result.current.trackCheckIn).toBeTruthy();
    expect(result.current.trackCheckInDuration).toBeTruthy();
  });

  it('should handle tracking calls without errors', () => {
    const { result } = renderHook(() => useAnalytics());
    
    act(() => {
      result.current.trackEvent('test_event', { param: 'value' });
      result.current.trackPerformance('test_metric', 1000);
      result.current.trackLogin('google');
      result.current.trackLogout();
    });
    
    // Should not throw any errors
    expect(result.current).toBeTruthy();
  });

  it('should handle disabled options', () => {
    const { result } = renderHook(() => 
      useAnalytics({
        enablePerformanceTracking: false,
        enableErrorTracking: false,
        enableAutoTracking: false,
      })
    );
    
    expect(result.current).toBeTruthy();
    
    act(() => {
      result.current.trackPerformance('test_metric', 1000);
      result.current.trackError(new Error('test'));
    });
  });
});
