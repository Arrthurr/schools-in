"use client";

import { useState, useEffect, useCallback } from 'react';
import { webVitalsMonitor, WebVitalsMetric, PERFORMANCE_THRESHOLDS } from '../../lib/performance/webVitals';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Activity,
  Clock,
  Zap,
  Eye,
  Gauge,
  RefreshCw,
  Download,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";

interface PerformanceMonitorProps {
  showDetails?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export function PerformanceMonitor({ 
  showDetails = true, 
  autoRefresh = true, 
  refreshInterval = 5000 
}: PerformanceMonitorProps) {
  const [metrics, setMetrics] = useState<WebVitalsMetric[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const refreshMetrics = useCallback(() => {
    const currentMetrics = webVitalsMonitor.getCurrentMetrics();
    setMetrics(currentMetrics);
    setLastUpdate(new Date());
  }, []);

  useEffect(() => {
    // Initial load
    refreshMetrics();

    // Auto refresh
    if (autoRefresh) {
      const interval = setInterval(refreshMetrics, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [refreshMetrics, autoRefresh, refreshInterval]);

  const getMetricIcon = (name: string) => {
    switch (name) {
      case 'LCP': return <Eye className="w-4 h-4" />;
      case 'FID': return <Zap className="w-4 h-4" />;
      case 'CLS': return <Activity className="w-4 h-4" />;
      case 'FCP': return <Clock className="w-4 h-4" />;
      case 'TTFB': return <Gauge className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  const getMetricBadgeVariant = (rating: string) => {
    switch (rating) {
      case 'good': return 'default';
      case 'needs-improvement': return 'secondary';
      case 'poor': return 'destructive';
      default: return 'outline';
    }
  };

  const getMetricColor = (rating: string) => {
    switch (rating) {
      case 'good': return 'text-green-600';
      case 'needs-improvement': return 'text-yellow-600';
      case 'poor': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getPerformanceGrade = () => {
    return webVitalsMonitor.getPerformanceGrade();
  };

  const exportMetrics = () => {
    const data = {
      timestamp: new Date().toISOString(),
      grade: getPerformanceGrade(),
      metrics: metrics,
      url: window.location.href,
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      }
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `web-vitals-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getScoreProgress = (name: string, value: number) => {
    const thresholds = PERFORMANCE_THRESHOLDS[name as keyof typeof PERFORMANCE_THRESHOLDS];
    if (!thresholds) return 100;
    
    const max = thresholds.needsImprovement * 1.5;
    return Math.max(0, Math.min(100, ((max - value) / max) * 100));
  };

  if (process.env.NODE_ENV === 'production' && !isVisible) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 z-50"
      >
        <Activity className="w-4 h-4 mr-2" />
        Performance
      </Button>
    );
  }

  return (
    <div className={`${process.env.NODE_ENV === 'production' ? 'fixed bottom-4 right-4 z-50 w-96' : ''}`}>
      <Card className="w-full">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center text-lg">
              <Activity className="w-5 h-5 mr-2" />
              Performance Monitor
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Badge variant="outline" className="font-mono">
                Grade: {getPerformanceGrade()}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={refreshMetrics}
                disabled={!metrics.length}
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
              {process.env.NODE_ENV === 'production' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsVisible(false)}
                >
                  ✕
                </Button>
              )}
            </div>
          </div>
          <CardDescription>
            Core Web Vitals monitoring
            {lastUpdate && (
              <span className="block text-xs mt-1">
                Last updated: {lastUpdate.toLocaleTimeString()}
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {metrics.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Activity className="w-6 h-6 mr-2 animate-pulse" />
              Collecting metrics...
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3">
                {metrics.map((metric) => (
                  <div key={metric.name} className="flex items-center space-x-3 p-3 border rounded-lg">
                    <div className={`p-2 rounded-full bg-gray-100 ${getMetricColor(metric.rating)}`}>
                      {getMetricIcon(metric.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-medium">
                          {metric.name}
                        </p>
                        <Badge variant={getMetricBadgeVariant(metric.rating)}>
                          {metric.rating.replace('-', ' ')}
                        </Badge>
                      </div>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-2xl font-bold">
                          {metric.name === 'CLS' 
                            ? metric.value.toFixed(3)
                            : Math.round(metric.value)
                          }
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {metric.name === 'CLS' ? 'score' : 'ms'}
                        </span>
                      </div>
                      {showDetails && (
                        <Progress 
                          value={getScoreProgress(metric.name, metric.value)} 
                          className="mt-2 h-2"
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {showDetails && (
                <div className="border-t pt-4 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Performance Summary</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={exportMetrics}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Export
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="space-y-1">
                      <p className="text-muted-foreground">Overall Grade</p>
                      <p className="font-mono text-lg">{getPerformanceGrade()}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground">Metrics Count</p>
                      <p className="font-mono text-lg">{metrics.length}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                    <div className="flex items-center space-x-1">
                      <CheckCircle className="w-3 h-3 text-green-600" />
                      <span>Good</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <AlertTriangle className="w-3 h-3 text-yellow-600" />
                      <span>Needs Improvement</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <AlertTriangle className="w-3 h-3 text-red-600" />
                      <span>Poor</span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Export for development use
export default PerformanceMonitor;
