const ensurePerformance = () => {
  const globalPerf = globalThis.performance as (Performance & {
    getEntriesByType?: jest.Mock;
  }) | undefined;

  if (!globalPerf) {
    const created = {
      getEntriesByType: jest.fn(),
    } as unknown as Performance & { getEntriesByType: jest.Mock };

    Object.defineProperty(globalThis, "performance", {
      configurable: true,
      writable: true,
      value: created,
    });

    return created;
  }

  if (typeof globalPerf.getEntriesByType !== "function") {
    globalPerf.getEntriesByType = jest.fn();
  }

  return globalPerf as Performance & { getEntriesByType: jest.Mock };
};

import { act, render } from "@testing-library/react";

import { useStartupLogging } from "../useStartupLogging";
import { logStartupStage, logStartupWarning } from "@/lib/logging/startupLogger";

jest.mock("@/lib/logging/startupLogger", () => ({
  logStartupStage: jest.fn(),
  logStartupWarning: jest.fn(),
}));

type RestoreFn = () => void;

const setNavigatorProperty = (key: keyof Navigator | string, value: unknown, restores: RestoreFn[]) => {
  const descriptor = Object.getOwnPropertyDescriptor(window.navigator, key);

  restores.push(() => {
    if (descriptor) {
      Object.defineProperty(window.navigator, key, descriptor);
      return;
    }

    Reflect.deleteProperty(window.navigator, key);
  });

  Object.defineProperty(window.navigator, key, {
    configurable: true,
    value,
  });
};

const TestComponent = () => {
  useStartupLogging();
  return null;
};

describe("useStartupLogging", () => {
  const restores: RestoreFn[] = [];
  const mockedLogStartupStage = logStartupStage as jest.MockedFunction<typeof logStartupStage>;
  const mockedLogStartupWarning = logStartupWarning as jest.MockedFunction<typeof logStartupWarning>;

  let performanceSpy: jest.SpyInstance<PerformanceEntry[], [type: string]> | null = null;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    restores.length = 0;

    setNavigatorProperty("deviceMemory", 8, restores);
    setNavigatorProperty("standalone", false, restores);
    setNavigatorProperty("serviceWorker", { controller: undefined }, restores);
    setNavigatorProperty(
      "connection",
      {
        downlink: 24,
        effectiveType: "4g",
        rtt: 45,
        saveData: false,
      },
      restores,
    );

    const perf = ensurePerformance();
    performanceSpy = jest.spyOn(perf, "getEntriesByType").mockReturnValue([
      {
        domContentLoadedEventEnd: 120,
        loadEventEnd: 350,
        responseEnd: 200,
        responseStart: 100,
        transferSize: 4096,
      } as PerformanceNavigationTiming,
    ]);
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    performanceSpy?.mockRestore();
    while (restores.length > 0) {
      const restore = restores.pop();
      restore?.();
    }
  });

  it("logs hydration and post-hydration readiness metadata", () => {
    render(<TestComponent />);

    expect(mockedLogStartupStage).toHaveBeenCalledWith(
      "client:hydration-complete",
      expect.objectContaining({
        userAgent: expect.any(String),
        language: expect.any(String),
        online: expect.any(Boolean),
        displayMode: "browser",
        deviceMemory: 8,
        screen: expect.objectContaining({
          width: expect.any(Number),
          height: expect.any(Number),
        }),
        connection: expect.objectContaining({
          downlink: 24,
          effectiveType: "4g",
          rtt: 45,
        }),
        navigation: expect.objectContaining({
          domContentLoaded: 120,
          loadEventEnd: 350,
          responseTime: 100,
          transferSize: 4096,
        }),
        serviceWorkerStatus: "uncontrolled",
      }),
    );

    act(() => {
      jest.advanceTimersByTime(1500);
    });

    expect(mockedLogStartupStage).toHaveBeenCalledWith(
      "client:post-hydration-ready",
      expect.objectContaining({
        visibility: document.visibilityState,
        hidden: document.hidden,
      }),
    );
  });

  it("reports a warning when metadata collection fails", () => {
    mockedLogStartupStage.mockImplementationOnce(() => {
      throw new Error("logger failure");
    });

    render(<TestComponent />);

    expect(mockedLogStartupWarning).toHaveBeenCalledWith(
      "client:startup-logging-failed",
      expect.objectContaining({
        error: expect.any(Error),
      }),
    );
  });
});
