/**
 * Image optimization utilities for better performance and user experience
 */

// Generate blur data URL for placeholder
export function generateBlurDataURL(width = 10, height = 10): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  
  // Create a simple gradient as placeholder
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#f3f4f6');
  gradient.addColorStop(1, '#e5e7eb');
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  
  return canvas.toDataURL('image/jpeg', 0.1);
}

// Generate optimized image srcset for responsive images
export function generateSrcSet(basePath: string, sizes: number[]): string {
  return sizes
    .map(size => `${basePath}?w=${size}&q=75 ${size}w`)
    .join(', ');
}

// Calculate responsive sizes string
export function generateSizes(breakpoints: { [key: string]: string }): string {
  return Object.entries(breakpoints)
    .map(([mediaQuery, size]) => `${mediaQuery} ${size}`)
    .join(', ');
}

// Common responsive image configurations
export const imageConfigs = {
  avatar: {
    sizes: [40, 80, 120],
    srcSizes: generateSizes({
      '(max-width: 640px)': '40px',
      '(max-width: 1024px)': '60px',
      '': '80px',
    }),
    quality: 85,
  },
  thumbnail: {
    sizes: [150, 300, 450],
    srcSizes: generateSizes({
      '(max-width: 640px)': '150px',
      '(max-width: 1024px)': '250px',
      '': '300px',
    }),
    quality: 80,
  },
  card: {
    sizes: [300, 600, 900, 1200],
    srcSizes: generateSizes({
      '(max-width: 640px)': '100vw',
      '(max-width: 1024px)': '50vw',
      '': '25vw',
    }),
    quality: 75,
  },
  hero: {
    sizes: [640, 828, 1200, 1920, 2048],
    srcSizes: generateSizes({
      '(max-width: 640px)': '100vw',
      '(max-width: 1024px)': '80vw',
      '': '70vw',
    }),
    quality: 90,
  },
  fullwidth: {
    sizes: [640, 828, 1200, 1920, 2560],
    srcSizes: '100vw',
    quality: 85,
  },
};

// Image format detection and conversion utilities
export function supportsWebP(): boolean {
  if (typeof window === 'undefined') return false;
  
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  
  return canvas.toDataURL('image/webp').indexOf('image/webp') === 5;
}

export function supportsAVIF(): boolean {
  if (typeof window === 'undefined') return false;
  
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  
  return canvas.toDataURL('image/avif').indexOf('image/avif') === 5;
}

// Get optimal image format based on browser support
export function getOptimalImageFormat(): 'avif' | 'webp' | 'jpeg' {
  if (supportsAVIF()) return 'avif';
  if (supportsWebP()) return 'webp';
  return 'jpeg';
}

// Generate optimized image URL (for external image services)
export function generateOptimizedImageURL(
  src: string,
  width?: number,
  height?: number,
  quality = 75,
  format?: string
): string {
  // For external URLs, return as-is (would require image optimization service)
  if (src.startsWith('http')) {
    return src;
  }
  
  // For local images, add optimization parameters
  const url = new URL(src, window.location.origin);
  
  if (width) url.searchParams.set('w', width.toString());
  if (height) url.searchParams.set('h', height.toString());
  url.searchParams.set('q', quality.toString());
  
  if (format) {
    url.searchParams.set('f', format);
  } else {
    url.searchParams.set('f', getOptimalImageFormat());
  }
  
  return url.toString();
}

// Preload critical images
export function preloadImage(src: string, crossOrigin?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    
    if (crossOrigin) {
      img.crossOrigin = crossOrigin;
    }
    
    img.src = src;
  });
}

// Batch preload multiple images
export async function preloadImages(srcs: string[], crossOrigin?: string): Promise<void[]> {
  const promises = srcs.map(src => preloadImage(src, crossOrigin));
  return Promise.all(promises);
}

// Image dimension calculation utilities
export function calculateAspectRatio(width: number, height: number): number {
  return width / height;
}

export function calculateDimensionsFromAspectRatio(
  aspectRatio: number,
  maxWidth: number,
  maxHeight?: number
): { width: number; height: number } {
  if (maxHeight) {
    const widthFromHeight = maxHeight * aspectRatio;
    const heightFromWidth = maxWidth / aspectRatio;
    
    if (widthFromHeight <= maxWidth) {
      return { width: widthFromHeight, height: maxHeight };
    } else {
      return { width: maxWidth, height: heightFromWidth };
    }
  }
  
  return {
    width: maxWidth,
    height: maxWidth / aspectRatio,
  };
}

// Performance monitoring for images
export function measureImageLoadTime(src: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const startTime = performance.now();
    const img = new Image();
    
    img.onload = () => {
      const loadTime = performance.now() - startTime;
      resolve(loadTime);
    };
    
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    
    img.src = src;
  });
}

// Create low-quality image placeholder (LQIP)
export function createLQIP(src: string, quality = 10, blur = 5): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }
      
      // Scale down for low quality
      const scale = 0.1;
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      
      // Apply blur filter
      ctx.filter = `blur(${blur}px)`;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      const lqip = canvas.toDataURL('image/jpeg', quality / 100);
      resolve(lqip);
    };
    
    img.onerror = () => reject(new Error(`Failed to create LQIP for: ${src}`));
    img.crossOrigin = 'anonymous';
    img.src = src;
  });
}
