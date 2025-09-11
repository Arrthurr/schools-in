// Firebase Performance helper (modular SDK)
import app from "../../../firebase.config";
import { getPerformance, trace as createTrace } from "firebase/performance";

let perfInstance: any | null = null;

export function getPerf(): any | null {
  if (typeof window === "undefined") return null;
  if (process.env.NODE_ENV !== "production") return null;
  try {
    if (!perfInstance) {
      perfInstance = getPerformance(app);
    }
    return perfInstance;
  } catch {
    return null;
  }
}

export function startTrace(name: string) {
  const perf = getPerf();
  if (!perf) {
    // No-op trace in dev or when unsupported
    return {
      putAttribute: (_k: string, _v: string) => {},
      putMetric: (_k: string, _v: number) => {},
      stop: () => {},
    };
  }

  const t = createTrace(perf, name);
  t.start();
  return {
    putAttribute: (k: string, v: string) => t.putAttribute(k, String(v)),
    putMetric: (k: string, v: number) => t.putMetric(k, Math.round(Number(v))),
    stop: () => t.stop(),
  };
}
