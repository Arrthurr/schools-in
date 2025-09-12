'use client';

/**
 * Deployment status component for admin dashboard
 * Shows current deployment information and health status
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useDeploymentInfo, DeploymentStatusProps } from '@/lib/deployment/hostingUtils';
import {
  Activity,
  CheckCircle,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Globe,
  Server,
  Zap,
  Clock,
  GitCommit,
  GitBranch,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function DeploymentStatus({
  showVersion = true,
  showHealth = true,
  showMetrics = true,
  className,
}: DeploymentStatusProps) {
  const { info, health, loading, refresh } = useDeploymentInfo();

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'degraded':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'down':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Activity className="h-4 w-4 text-gray-400" />;
    }
  };

  const getHealthBadgeColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'degraded':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'down':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Deployment Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span className="text-sm text-muted-foreground">Loading deployment info...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Deployment Status
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={refresh}
            className="h-8 w-8 p-0"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Health Status */}
        {showHealth && health && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">System Health</span>
              <Badge className={cn('text-xs', getHealthBadgeColor(health.status))}>
                {getHealthIcon(health.status)}
                <span className="ml-1 capitalize">{health.status}</span>
              </Badge>
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-1">
                {health.checks.connectivity ? (
                  <CheckCircle className="h-3 w-3 text-green-500" />
                ) : (
                  <XCircle className="h-3 w-3 text-red-500" />
                )}
                <span>Connectivity</span>
              </div>
              
              <div className="flex items-center gap-1">
                {health.checks.ssl ? (
                  <CheckCircle className="h-3 w-3 text-green-500" />
                ) : (
                  <XCircle className="h-3 w-3 text-red-500" />
                )}
                <span>SSL</span>
              </div>
              
              <div className="flex items-center gap-1">
                {health.checks.performance ? (
                  <CheckCircle className="h-3 w-3 text-green-500" />
                ) : (
                  <XCircle className="h-3 w-3 text-red-500" />
                )}
                <span>Performance</span>
              </div>
              
              <div className="flex items-center gap-1">
                {health.checks.pwa ? (
                  <CheckCircle className="h-3 w-3 text-green-500" />
                ) : (
                  <XCircle className="h-3 w-3 text-red-500" />
                )}
                <span>PWA</span>
              </div>
            </div>
          </div>
        )}

        {/* Version Information */}
        {showVersion && info && (
          <div className="space-y-2">
            <span className="text-sm font-medium">Version Information</span>
            <div className="space-y-1 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <GitCommit className="h-3 w-3" />
                <span className="font-mono">{info.commitSha.substring(0, 7)}</span>
              </div>
              <div className="flex items-center gap-2">
                <GitBranch className="h-3 w-3" />
                <span>{info.branch}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-3 w-3" />
                <span>{new Date(info.timestamp).toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}

        {/* Performance Metrics */}
        {showMetrics && health && (
          <div className="space-y-2">
            <span className="text-sm font-medium">Performance Metrics</span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Response Time</span>
                <span className={cn(
                  'font-mono',
                  health.metrics.responseTime < 1000 ? 'text-green-600' : 
                  health.metrics.responseTime < 3000 ? 'text-yellow-600' : 'text-red-600'
                )}>
                  {health.metrics.responseTime}ms
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Load Size</span>
                <span className="font-mono">
                  {(health.metrics.loadSize / 1024).toFixed(1)}KB
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Environment Badge */}
        {info && (
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Environment</span>
            </div>
            <Badge 
              variant={info.environment === 'production' ? 'default' : 'secondary'}
              className="text-xs"
            >
              {info.environment}
            </Badge>
          </div>
        )}

        {/* Quick Actions */}
        <div className="flex gap-2 pt-2 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open('https://console.firebase.google.com/project/schools-in-check/hosting', '_blank')}
            className="flex-1 text-xs"
          >
            <Globe className="h-3 w-3 mr-1" />
            Console
          </Button>
          
          <Button
            variant="outline" 
            size="sm"
            onClick={() => window.open('https://schools-in-check.web.app', '_blank')}
            className="flex-1 text-xs"
          >
            <Zap className="h-3 w-3 mr-1" />
            Live Site
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Compact deployment status for header/navbar
export function CompactDeploymentStatus({ className }: { className?: string }) {
  const { health, loading } = useDeploymentInfo();

  if (loading || !health) {
    return (
      <div className={cn('flex items-center gap-1', className)}>
        <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-1', className)} title={`System Status: ${health.status}`}>
      {getHealthIcon(health.status)}
      <span className="text-xs text-muted-foreground sr-only">
        {health.status}
      </span>
    </div>
  );
}

function getHealthIcon(status: string) {
  switch (status) {
    case 'healthy':
      return <CheckCircle className="h-3 w-3 text-green-600" />;
    case 'degraded':
      return <AlertTriangle className="h-3 w-3 text-yellow-600" />;
    case 'down':
      return <XCircle className="h-3 w-3 text-red-600" />;
    default:
      return <Activity className="h-3 w-3 text-gray-400" />;
  }
}
