// PWA Testing Utility
// Task 11.7: Automated PWA and offline testing tools

"use client";

import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Wifi,
  WifiOff,
  Download,
  Smartphone,
  Monitor,
} from "lucide-react";

interface TestResult {
  name: string;
  status: "pass" | "fail" | "warning" | "running" | "pending";
  message: string;
  details?: string;
}

interface TestSuite {
  name: string;
  tests: TestResult[];
  progress: number;
}

export const PWATestingUtility: React.FC = () => {
  const [testSuites, setTestSuites] = useState<TestSuite[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentTest, setCurrentTest] = useState("");
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    // Listen for install prompt
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    // Listen for network changes
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const sleep = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  const updateTestResult = (
    suiteIndex: number,
    testIndex: number,
    result: Partial<TestResult>
  ) => {
    setTestSuites((prev) =>
      prev.map((suite, sIndex) => {
        if (sIndex === suiteIndex) {
          const updatedTests = suite.tests.map((test, tIndex) => {
            if (tIndex === testIndex) {
              return { ...test, ...result };
            }
            return test;
          });
          const completedTests = updatedTests.filter(
            (t) => t.status !== "pending" && t.status !== "running"
          ).length;
          const progress = (completedTests / updatedTests.length) * 100;

          return {
            ...suite,
            tests: updatedTests,
            progress,
          };
        }
        return suite;
      })
    );
  };

  const runPWAInstallationTests = async () => {
    const suiteIndex = 0;
    setCurrentTest("PWA Installation Tests");

    // Test 1: Service Worker Registration
    updateTestResult(suiteIndex, 0, { status: "running" });
    await sleep(500);

    try {
      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.ready;
        updateTestResult(suiteIndex, 0, {
          status: "pass",
          message: "Service worker registered successfully",
          details: `Active: ${registration.active?.scriptURL || "N/A"}`,
        });
      } else {
        updateTestResult(suiteIndex, 0, {
          status: "fail",
          message: "Service Worker not supported",
          details: "Browser does not support service workers",
        });
      }
    } catch (error) {
      updateTestResult(suiteIndex, 0, {
        status: "fail",
        message: "Service worker registration failed",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }

    // Test 2: Web App Manifest
    updateTestResult(suiteIndex, 1, { status: "running" });
    await sleep(500);

    try {
      const response = await fetch("/manifest.json");
      if (response.ok) {
        const manifest = await response.json();
        if (manifest.name && manifest.start_url && manifest.display) {
          updateTestResult(suiteIndex, 1, {
            status: "pass",
            message: "Manifest valid",
            details: `Name: ${manifest.name}, Display: ${manifest.display}`,
          });
        } else {
          updateTestResult(suiteIndex, 1, {
            status: "warning",
            message: "Manifest missing required fields",
            details: "Some manifest properties may be missing",
          });
        }
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      updateTestResult(suiteIndex, 1, {
        status: "fail",
        message: "Manifest not accessible",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }

    // Test 3: Install Prompt Availability
    updateTestResult(suiteIndex, 2, { status: "running" });
    await sleep(500);

    if (installPrompt) {
      updateTestResult(suiteIndex, 2, {
        status: "pass",
        message: "Install prompt available",
        details: "App can be installed",
      });
    } else {
      updateTestResult(suiteIndex, 2, {
        status: "warning",
        message: "Install prompt not triggered",
        details: "May already be installed or criteria not met",
      });
    }

    // Test 4: PWA Meta Tags
    updateTestResult(suiteIndex, 3, { status: "running" });
    await sleep(500);

    const themeColor = document.querySelector('meta[name="theme-color"]');
    const viewport = document.querySelector('meta[name="viewport"]');
    const appleMobile = document.querySelector(
      'meta[name="apple-mobile-web-app-capable"]'
    );

    if (themeColor && viewport) {
      updateTestResult(suiteIndex, 3, {
        status: "pass",
        message: "Essential meta tags present",
        details: `Theme color: ${themeColor.getAttribute("content")}`,
      });
    } else {
      updateTestResult(suiteIndex, 3, {
        status: "warning",
        message: "Some meta tags missing",
        details: "Consider adding missing PWA meta tags",
      });
    }
  };

  const runOfflineTests = async () => {
    const suiteIndex = 1;
    setCurrentTest("Offline Functionality Tests");

    // Test 1: Cache API Support
    updateTestResult(suiteIndex, 0, { status: "running" });
    await sleep(500);

    if ("caches" in window) {
      try {
        const cacheNames = await caches.keys();
        updateTestResult(suiteIndex, 0, {
          status: "pass",
          message: "Cache API supported and active",
          details: `${cacheNames.length} cache(s) found`,
        });
      } catch (error) {
        updateTestResult(suiteIndex, 0, {
          status: "warning",
          message: "Cache API supported but not accessible",
          details: error instanceof Error ? error.message : "Unknown error",
        });
      }
    } else {
      updateTestResult(suiteIndex, 0, {
        status: "fail",
        message: "Cache API not supported",
        details: "Browser does not support Cache API",
      });
    }

    // Test 2: Offline Status Detection
    updateTestResult(suiteIndex, 1, { status: "running" });
    await sleep(500);

    const offlineDetection = "onLine" in navigator;
    updateTestResult(suiteIndex, 1, {
      status: offlineDetection ? "pass" : "fail",
      message: offlineDetection
        ? "Offline detection available"
        : "Offline detection not supported",
      details: `Current status: ${navigator.onLine ? "Online" : "Offline"}`,
    });

    // Test 3: Local Storage Availability
    updateTestResult(suiteIndex, 2, { status: "running" });
    await sleep(500);

    try {
      const testKey = "pwa-test-storage";
      localStorage.setItem(testKey, "test");
      localStorage.removeItem(testKey);

      updateTestResult(suiteIndex, 2, {
        status: "pass",
        message: "Local storage functional",
        details: "Can store and retrieve data",
      });
    } catch (error) {
      updateTestResult(suiteIndex, 2, {
        status: "fail",
        message: "Local storage not available",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }

    // Test 4: IndexedDB Support
    updateTestResult(suiteIndex, 3, { status: "running" });
    await sleep(500);

    if ("indexedDB" in window) {
      updateTestResult(suiteIndex, 3, {
        status: "pass",
        message: "IndexedDB supported",
        details: "Advanced offline storage available",
      });
    } else {
      updateTestResult(suiteIndex, 3, {
        status: "warning",
        message: "IndexedDB not supported",
        details: "Limited to localStorage for offline data",
      });
    }
  };

  const runPerformanceTests = async () => {
    const suiteIndex = 2;
    setCurrentTest("Performance Tests");

    // Test 1: Service Worker Performance
    updateTestResult(suiteIndex, 0, { status: "running" });
    await sleep(500);

    try {
      const startTime = performance.now();
      const response = await fetch(window.location.href, { cache: "reload" });
      const endTime = performance.now();
      const loadTime = endTime - startTime;

      updateTestResult(suiteIndex, 0, {
        status: loadTime < 2000 ? "pass" : "warning",
        message: `Page load time: ${loadTime.toFixed(0)}ms`,
        details:
          loadTime < 2000 ? "Fast load time" : "Consider optimizing load time",
      });
    } catch (error) {
      updateTestResult(suiteIndex, 0, {
        status: "fail",
        message: "Failed to measure load time",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }

    // Test 2: Memory Usage
    updateTestResult(suiteIndex, 1, { status: "running" });
    await sleep(500);

    if ("memory" in performance) {
      const memory = (performance as any).memory;
      const memoryUsage = memory.usedJSHeapSize / 1024 / 1024;

      updateTestResult(suiteIndex, 1, {
        status: memoryUsage < 50 ? "pass" : "warning",
        message: `Memory usage: ${memoryUsage.toFixed(1)}MB`,
        details:
          memoryUsage < 50
            ? "Good memory usage"
            : "Consider optimizing memory usage",
      });
    } else {
      updateTestResult(suiteIndex, 1, {
        status: "warning",
        message: "Memory measurement not available",
        details: "Browser does not support memory API",
      });
    }

    // Test 3: Network Information
    updateTestResult(suiteIndex, 2, { status: "running" });
    await sleep(500);

    if ("connection" in navigator) {
      const connection = (navigator as any).connection;
      updateTestResult(suiteIndex, 2, {
        status: "pass",
        message: "Network information available",
        details: `Type: ${connection.effectiveType || "unknown"}`,
      });
    } else {
      updateTestResult(suiteIndex, 2, {
        status: "warning",
        message: "Network information not available",
        details: "Cannot detect connection quality",
      });
    }
  };

  const runAllTests = async () => {
    setIsRunning(true);

    // Initialize test suites
    const initialSuites: TestSuite[] = [
      {
        name: "PWA Installation",
        progress: 0,
        tests: [
          {
            name: "Service Worker Registration",
            status: "pending",
            message: "Waiting to run...",
          },
          {
            name: "Web App Manifest",
            status: "pending",
            message: "Waiting to run...",
          },
          {
            name: "Install Prompt Availability",
            status: "pending",
            message: "Waiting to run...",
          },
          {
            name: "PWA Meta Tags",
            status: "pending",
            message: "Waiting to run...",
          },
        ],
      },
      {
        name: "Offline Functionality",
        progress: 0,
        tests: [
          {
            name: "Cache API Support",
            status: "pending",
            message: "Waiting to run...",
          },
          {
            name: "Offline Status Detection",
            status: "pending",
            message: "Waiting to run...",
          },
          {
            name: "Local Storage",
            status: "pending",
            message: "Waiting to run...",
          },
          {
            name: "IndexedDB Support",
            status: "pending",
            message: "Waiting to run...",
          },
        ],
      },
      {
        name: "Performance",
        progress: 0,
        tests: [
          {
            name: "Load Time",
            status: "pending",
            message: "Waiting to run...",
          },
          {
            name: "Memory Usage",
            status: "pending",
            message: "Waiting to run...",
          },
          {
            name: "Network Information",
            status: "pending",
            message: "Waiting to run...",
          },
        ],
      },
    ];

    setTestSuites(initialSuites);

    try {
      await runPWAInstallationTests();
      await runOfflineTests();
      await runPerformanceTests();
    } catch (error) {
      console.error("Test execution error:", error);
    } finally {
      setIsRunning(false);
      setCurrentTest("");
    }
  };

  const triggerInstallPrompt = async () => {
    if (installPrompt) {
      installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      console.log(`User response to install prompt: ${outcome}`);
      setInstallPrompt(null);
    }
  };

  const getStatusIcon = (status: TestResult["status"]) => {
    switch (status) {
      case "pass":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "fail":
        return <XCircle className="h-4 w-4 text-red-600" />;
      case "warning":
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      case "running":
        return <Loader2 className="h-4 w-4 animate-spin text-blue-600" />;
      default:
        return <div className="h-4 w-4 rounded-full bg-gray-300" />;
    }
  };

  const getStatusBadge = (status: TestResult["status"]) => {
    const variants = {
      pass: "default",
      fail: "destructive",
      warning: "secondary",
      running: "outline",
      pending: "outline",
    } as const;

    return (
      <Badge variant={variants[status]}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const simulateOffline = () => {
    // Dispatch offline event
    window.dispatchEvent(new Event("offline"));
    Object.defineProperty(navigator, "onLine", {
      value: false,
      writable: true,
    });
    setIsOffline(true);
  };

  const simulateOnline = () => {
    // Dispatch online event
    window.dispatchEvent(new Event("online"));
    Object.defineProperty(navigator, "onLine", {
      value: true,
      writable: true,
    });
    setIsOffline(false);
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">PWA Testing Utility</h1>
        <p className="text-muted-foreground">
          Task 11.7: Comprehensive PWA installation and offline functionality
          testing
        </p>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Connection Status
            </CardTitle>
            {isOffline ? (
              <WifiOff className="h-4 w-4" />
            ) : (
              <Wifi className="h-4 w-4" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isOffline ? "Offline" : "Online"}
            </div>
            <div className="flex gap-2 mt-2">
              <Button size="sm" variant="outline" onClick={simulateOffline}>
                Go Offline
              </Button>
              <Button size="sm" variant="outline" onClick={simulateOnline}>
                Go Online
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Install Status
            </CardTitle>
            <Download className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {installPrompt ? "Available" : "Not Available"}
            </div>
            {installPrompt && (
              <Button size="sm" className="mt-2" onClick={triggerInstallPrompt}>
                Install App
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Device Type</CardTitle>
            {window.innerWidth < 768 ? (
              <Smartphone className="h-4 w-4" />
            ) : (
              <Monitor className="h-4 w-4" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {window.innerWidth < 768 ? "Mobile" : "Desktop"}
            </div>
            <p className="text-xs text-muted-foreground">
              {window.innerWidth}×{window.innerHeight}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Test Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Test Controls</CardTitle>
          <CardDescription>
            Run comprehensive tests for PWA functionality and offline
            capabilities
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Button
              onClick={runAllTests}
              disabled={isRunning}
              className="flex-1"
            >
              {isRunning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Running Tests...
                </>
              ) : (
                "Run All Tests"
              )}
            </Button>
          </div>
          {isRunning && currentTest && (
            <Alert className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Currently running: {currentTest}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Test Results */}
      {testSuites.length > 0 && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold">Test Results</h2>

          {testSuites.map((suite, suiteIndex) => (
            <Card key={suite.name}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{suite.name}</CardTitle>
                  <div className="text-sm text-muted-foreground">
                    {suite.progress.toFixed(0)}% Complete
                  </div>
                </div>
                <Progress value={suite.progress} className="w-full" />
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {suite.tests.map((test, testIndex) => (
                    <div
                      key={test.name}
                      className="flex items-start justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-start gap-3">
                        {getStatusIcon(test.status)}
                        <div>
                          <div className="font-medium">{test.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {test.message}
                          </div>
                          {test.details && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {test.details}
                            </div>
                          )}
                        </div>
                      </div>
                      {getStatusBadge(test.status)}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
