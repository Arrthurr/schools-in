"use client";

import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Alert, AlertDescription } from '../ui/alert';
import { Badge } from '../ui/badge';
import { ProviderDashboardCards } from './ProviderDashboardCards';
import { useProviderMetrics } from '../../lib/hooks/useProviderMetrics';

// Mock locations for testing
const mockLocations = [
  { id: 'loc1', name: 'Elementary School A' },
  { id: 'loc2', name: 'High School B' },
  { id: 'loc3', name: 'Middle School C' }
];

/**
 * Provider Dashboard Test Component
 * Demonstrates and tests the complete provider dashboard functionality
 */
export function ProviderDashboardTest() {
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [showLocationSelector, setShowLocationSelector] = useState(false);
  const [testResults, setTestResults] = useState<string[]>([]);
  
  const {
    currentSession,
    weeklyMetrics,
    isLoading,
    error,
    startSession,
    endSession,
    isSessionActive,
    sessionDuration,
    canStartSession,
    canEndSession,
    refresh
  } = useProviderMetrics();

  const addTestResult = (result: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${result}`]);
  };

  const handleStartTestSession = async (locationId: string) => {
    try {
      await startSession(locationId, 'manual', 0);
      addTestResult(`✅ Started session at ${mockLocations.find(l => l.id === locationId)?.name}`);
      setShowLocationSelector(false);
    } catch (err) {
      addTestResult(`❌ Failed to start session: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleEndTestSession = async () => {
    try {
      await endSession('Test session completed');
      addTestResult('✅ Session ended successfully');
    } catch (err) {
      addTestResult(`❌ Failed to end session: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const runComprehensiveTest = async () => {
    addTestResult('🧪 Starting comprehensive dashboard test...');
    
    // Test metrics loading
    try {
      await refresh();
      addTestResult('✅ Metrics refresh successful');
    } catch (err) {
      addTestResult(`❌ Metrics refresh failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }

    // Test state validation
    addTestResult(`📊 Current state: ${currentSession ? 'Has active session' : 'No active session'}`);
    addTestResult(`📈 Weekly sessions: ${weeklyMetrics.weeklySessionsCount}`);
    addTestResult(`⏱️ Session duration: ${sessionDuration} minutes`);
    addTestResult(`🏢 Locations visited: ${weeklyMetrics.locationsVisited}`);
    addTestResult(`📉 Completion rate: ${weeklyMetrics.completionRate.toFixed(1)}%`);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Provider Dashboard Test</h1>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={runComprehensiveTest}
            disabled={isLoading}
          >
            Run Test
          </Button>
          <Button 
            variant="outline" 
            onClick={refresh}
            disabled={isLoading}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Dashboard Cards */}
      <ProviderDashboardCards
        availableLocations={mockLocations}
        onSelectLocation={() => setShowLocationSelector(true)}
        onStartSession={handleStartTestSession}
      />

      {/* Location Selector Modal */}
      {showLocationSelector && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Select Location</CardTitle>
            <CardDescription>Choose a location to start your session</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              {mockLocations.map(location => (
                <Button
                  key={location.id}
                  variant="outline"
                  onClick={() => handleStartTestSession(location.id)}
                  disabled={isLoading}
                  className="justify-start"
                >
                  {location.name}
                </Button>
              ))}
            </div>
            <Button 
              variant="ghost" 
              onClick={() => setShowLocationSelector(false)}
              className="w-full"
            >
              Cancel
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Session State Display */}
      <Card>
        <CardHeader>
          <CardTitle>Session State</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium mb-2">Current Status</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Loading:</span>
                  <Badge variant={isLoading ? "default" : "secondary"}>
                    {isLoading ? "Yes" : "No"}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>Active Session:</span>
                  <Badge variant={isSessionActive ? "default" : "secondary"}>
                    {isSessionActive ? "Yes" : "No"}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>Can Start:</span>
                  <Badge variant={canStartSession ? "default" : "secondary"}>
                    {canStartSession ? "Yes" : "No"}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>Can End:</span>
                  <Badge variant={canEndSession ? "default" : "secondary"}>
                    {canEndSession ? "Yes" : "No"}
                  </Badge>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">Metrics Summary</h4>
              <div className="space-y-2 text-sm">
                <div>Weekly Sessions: {weeklyMetrics.weeklySessionsCount}</div>
                <div>Weekly Hours: {weeklyMetrics.weeklyTotalHours.toFixed(1)}</div>
                <div>Locations: {weeklyMetrics.locationsVisited}</div>
                <div>Avg Duration: {weeklyMetrics.averageSessionDuration.toFixed(0)}min</div>
                <div>Completion: {weeklyMetrics.completionRate.toFixed(1)}%</div>
              </div>
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Test Results */}
      <Card>
        <CardHeader>
          <CardTitle>Test Results</CardTitle>
          <CardDescription>Real-time test execution log</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-1 font-mono text-sm max-h-60 overflow-y-auto">
            {testResults.length === 0 ? (
              <div className="text-muted-foreground">Click "Run Test" to start testing...</div>
            ) : (
              testResults.map((result, index) => (
                <div key={index} className="py-1 border-b border-border/50 last:border-0">
                  {result}
                </div>
              ))
            )}
          </div>
          {testResults.length > 0 && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setTestResults([])}
              className="mt-4"
            >
              Clear Results
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Manual Test Controls */}
      {currentSession && (
        <Card>
          <CardHeader>
            <CardTitle>Manual Session Control</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Button
                variant="destructive"
                onClick={handleEndTestSession}
                disabled={isLoading || !canEndSession}
              >
                End Current Session
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default ProviderDashboardTest;