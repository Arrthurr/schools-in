'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface UseLazyLoadingOptions {
  threshold?: number;
  rootMargin?: string;
  triggerOnce?: boolean;
}

export function useLazyLoading({
  threshold = 0.1,
  rootMargin = '50px',
  triggerOnce = true,
}: UseLazyLoadingOptions = {}) {
  const [isVisible, setIsVisible] = useState(false);
  const [hasTriggered, setHasTriggered] = useState(false);
  const ref = useRef<HTMLElement>(null);

  const callback = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      
      if (entry.isIntersecting && (!triggerOnce || !hasTriggered)) {
        setIsVisible(true);
        if (triggerOnce) {
          setHasTriggered(true);
        }
      } else if (!entry.isIntersecting && !triggerOnce) {
        setIsVisible(false);
      }
    },
    [triggerOnce, hasTriggered]
  );

  useEffect(() => {
    const element = ref.current;
    if (!element || hasTriggered) return;

    const observer = new IntersectionObserver(callback, {
      threshold,
      rootMargin,
    });

    observer.observe(element);

    return () => {
      if (element) {
        observer.unobserve(element);
      }
    };
  }, [callback, threshold, rootMargin, hasTriggered]);

  return [ref, isVisible] as const;
}

// Hook for lazy loading images with preloading
export function useLazyImage(src: string, options?: UseLazyLoadingOptions) {
  const [elementRef, isVisible] = useLazyLoading(options);
  const [imageSrc, setImageSrc] = useState<string | undefined>();
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!isVisible || imageSrc) return;

    // Preload the image
    const img = new Image();
    img.onload = () => {
      setImageSrc(src);
      setIsLoaded(true);
    };
    img.onerror = () => {
      setError(true);
    };
    img.src = src;
  }, [isVisible, src, imageSrc]);

  return {
    ref: elementRef,
    src: imageSrc,
    isVisible,
    isLoaded,
    error,
  };
}

// Hook for progressive image loading (low quality placeholder → high quality)
export function useProgressiveImage(lowQualitySrc: string, highQualitySrc: string) {
  const [src, setSrc] = useState(lowQualitySrc);
  const [isHighResLoaded, setIsHighResLoaded] = useState(false);

  useEffect(() => {
    setSrc(lowQualitySrc);
    
    const img = new Image();
    img.onload = () => {
      setSrc(highQualitySrc);
      setIsHighResLoaded(true);
    };
    img.src = highQualitySrc;
  }, [lowQualitySrc, highQualitySrc]);

  return {
    src,
    isHighResLoaded,
  };
}

// Hook for responsive image loading based on device pixel ratio and screen size
export function useResponsiveImage(srcSet: { [key: string]: string }) {
  const [currentSrc, setCurrentSrc] = useState('');

  useEffect(() => {
    const updateImageSource = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = window.innerWidth;

      // Determine appropriate image size based on screen width and DPR
      let selectedSrc = '';
      
      if (width <= 640) {
        selectedSrc = srcSet['sm'] || srcSet['md'] || srcSet['lg'] || Object.values(srcSet)[0];
      } else if (width <= 1024) {
        selectedSrc = srcSet['md'] || srcSet['lg'] || Object.values(srcSet)[0];
      } else {
        selectedSrc = srcSet['lg'] || Object.values(srcSet)[0];
      }

      // Adjust for high DPR displays
      if (dpr > 1.5 && srcSet['lg']) {
        selectedSrc = srcSet['lg'];
      }

      setCurrentSrc(selectedSrc);
    };

    updateImageSource();
    
    window.addEventListener('resize', updateImageSource);
    return () => window.removeEventListener('resize', updateImageSource);
  }, [srcSet]);

  return currentSrc;
}
