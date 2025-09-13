'use client';

/**
 * Image preloading utilities for critical images and performance optimization
 */

// Priority levels for image preloading
export enum PreloadPriority {
  HIGH = 'high',
  LOW = 'low',
}

interface PreloadOptions {
  priority?: PreloadPriority;
  crossOrigin?: 'anonymous' | 'use-credentials';
  fetchPriority?: 'high' | 'low' | 'auto';
  as?: 'image';
  type?: string;
}

// Preload critical images using link preload
export function preloadImageWithLink(
  href: string,
  options: PreloadOptions = {}
): void {
  if (typeof document === 'undefined') return;

  // Check if already preloaded
  const existing = document.querySelector(`link[href="${href}"]`);
  if (existing) return;

  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = options.as || 'image';
  link.href = href;

  if (options.crossOrigin) {
    link.crossOrigin = options.crossOrigin;
  }

  if (options.fetchPriority) {
    (link as any).fetchPriority = options.fetchPriority;
  }

  if (options.type) {
    link.type = options.type;
  }

  document.head.appendChild(link);
}

// Preload images using Image constructor with Promise
export function preloadImageWithPromise(
  src: string,
  crossOrigin?: string
): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to preload image: ${src}`));

    if (crossOrigin) {
      img.crossOrigin = crossOrigin;
    }

    img.src = src;
  });
}

// Batch preload multiple images
export async function preloadImages(
  sources: string[],
  options: PreloadOptions = {}
): Promise<HTMLImageElement[]> {
  const promises = sources.map(src => preloadImageWithPromise(
    src, 
    options.crossOrigin
  ));

  try {
    return await Promise.all(promises);
  } catch (error) {
    console.warn('Some images failed to preload:', error);
    // Return successfully loaded images
    const results = await Promise.allSettled(promises);
    return results
      .filter((result): result is PromiseFulfilledResult<HTMLImageElement> => 
        result.status === 'fulfilled'
      )
      .map(result => result.value);
  }
}

// Preload critical images for the application
export function preloadCriticalImages(): void {
  const criticalImages = [
    '/DMDL_logo.png',
    '/icon-192.png',
    '/icon-512.png',
  ];

  criticalImages.forEach(src => {
    preloadImageWithLink(src, {
      priority: PreloadPriority.HIGH,
      fetchPriority: 'high',
    });
  });
}

// Lazy preload images when they're likely to be needed soon
export function lazyPreloadImages(sources: string[], delay = 1000): void {
  if (typeof window === 'undefined') return;

  // Use requestIdleCallback if available
  const schedulePreload = () => {
    sources.forEach(src => {
      preloadImageWithPromise(src).catch(error => {
        console.warn(`Failed to lazy preload image: ${src}`, error);
      });
    });
  };

  if ('requestIdleCallback' in window) {
    requestIdleCallback(schedulePreload, { timeout: delay });
  } else {
    setTimeout(schedulePreload, delay);
  }
}

// Preload images based on user interaction hints
export function preloadOnHover(element: HTMLElement, imageSrc: string): void {
  let preloaded = false;

  const preload = () => {
    if (preloaded) return;
    preloaded = true;
    preloadImageWithPromise(imageSrc).catch(error => {
      console.warn(`Failed to preload on hover: ${imageSrc}`, error);
    });
  };

  element.addEventListener('mouseenter', preload, { once: true });
  element.addEventListener('focus', preload, { once: true });
  
  // Clean up listeners after a timeout
  setTimeout(() => {
    element.removeEventListener('mouseenter', preload);
    element.removeEventListener('focus', preload);
  }, 10000);
}

// Smart preloading based on network conditions
export function conditionalPreload(
  sources: string[],
  conditions: {
    maxImages?: number;
    minConnectionSpeed?: number;
    maxDataSaver?: boolean;
  } = {}
): void {
  if (typeof navigator === 'undefined') return;

  const {
    maxImages = 5,
    minConnectionSpeed = 1, // Mbps
    maxDataSaver = true,
  } = conditions;

  // Check for data saver preference
  if ('connection' in navigator) {
    const connection = (navigator as any).connection;
    
    if (connection?.saveData && !maxDataSaver) {
      console.log('Data saver is enabled, skipping image preload');
      return;
    }

    // Check connection speed
    if (connection?.downlink && connection.downlink < minConnectionSpeed) {
      console.log('Slow connection detected, limiting image preload');
      sources = sources.slice(0, Math.min(2, maxImages));
    }
  }

  // Limit number of images to preload
  const imagesToPreload = sources.slice(0, maxImages);
  
  lazyPreloadImages(imagesToPreload, 2000);
}

// Measure image loading performance
export async function measureImageLoadPerformance(src: string): Promise<{
  loadTime: number;
  size?: number;
  fromCache: boolean;
}> {
  const startTime = performance.now();

  try {
    const img = await preloadImageWithPromise(src);
    const loadTime = performance.now() - startTime;

    // Check if loaded from cache (heuristic)
    const fromCache = loadTime < 50; // Less than 50ms likely from cache

    return {
      loadTime,
      fromCache,
    };
  } catch (error) {
    throw new Error(`Failed to measure load performance for: ${src}`);
  }
}

// Initialize image preloading strategy
export function initImagePreloading(): void {
  if (typeof window === 'undefined') return;

  // Preload critical images immediately
  preloadCriticalImages();

  // Setup intersection observer for lazy preloading
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target as HTMLImageElement;
            const src = img.dataset.preload;
            if (src) {
              preloadImageWithPromise(src);
              observer.unobserve(img);
            }
          }
        });
      },
      { rootMargin: '100px' }
    );

    // Observe elements with data-preload attribute
    document.querySelectorAll('[data-preload]').forEach(el => {
      observer.observe(el);
    });
  }
}
