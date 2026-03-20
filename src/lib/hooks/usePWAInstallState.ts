"use client";

import { useState, useEffect } from "react";
import { isPushSupported } from "@/lib/pwa/pushReminders";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface PWAInstallState {
  /** App is running as an installed PWA (standalone mode) */
  isInstalled: boolean;
  /** Device is iOS but NOT running in standalone mode */
  isIOSBrowser: boolean;
  /** Push notifications are supported in the current context */
  pushSupported: boolean;
  /** A `beforeinstallprompt` event is available (Android/desktop Chrome) */
  canPromptInstall: boolean;
  /** Trigger the native install prompt (Android/desktop Chrome only) */
  promptInstall: () => Promise<void>;
}

/**
 * Detects PWA installation state and provides install prompt helpers.
 *
 * Reuses the same detection logic as PWAInstallPrompt and capabilities.ts
 * but exposes it as a hook for use in any component.
 */
export function usePWAInstallState(): PWAInstallState {
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOSBrowser, setIsIOSBrowser] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    setPushSupported(isPushSupported());

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;

    setIsInstalled(standalone);

    if (standalone) return;

    // Detect iOS-in-browser (not standalone)
    const ua = navigator.userAgent;
    const ios =
      /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

    setIsIOSBrowser(ios);

    // Listen for the native install prompt (Chrome/Edge/Samsung)
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const installedHandler = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  const promptInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  };

  return {
    isInstalled,
    isIOSBrowser,
    pushSupported,
    canPromptInstall: !!deferredPrompt,
    promptInstall,
  };
}
