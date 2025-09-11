// Google Analytics (gtag.js) helpers
export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_ID || "";

export function hasGA(): boolean {
  return typeof window !== "undefined" && typeof (window as any).gtag === "function" && !!GA_MEASUREMENT_ID;
}

export function pageview(url: string) {
  if (!GA_MEASUREMENT_ID) return;
  if (typeof window === "undefined") return;
  const gtag = (window as any).gtag;
  if (typeof gtag !== "function") return;
  gtag("config", GA_MEASUREMENT_ID, {
    page_path: url,
  });
}

export function gaEvent(name: string, params: Record<string, any> = {}) {
  if (!GA_MEASUREMENT_ID) return;
  if (typeof window === "undefined") return;
  const gtag = (window as any).gtag;
  if (typeof gtag !== "function") return;
  gtag("event", name, params);
}
