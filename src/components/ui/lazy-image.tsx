'use client';

import React, { useState, useRef, useEffect } from 'react';
import { OptimizedImage } from './optimized-image';
import { useLazyLoading } from '@/lib/hooks/useLazyLoading';
import { Skeleton } from './skeleton';
import { cn } from '@/lib/utils';

interface LazyImageProps {
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  priority?: boolean;
  quality?: number;
  sizes?: string;
  fill?: boolean;
  threshold?: number;
  rootMargin?: string;
  placeholder?: React.ReactNode;
  fallback?: React.ReactNode;
  onLoad?: () => void;
  onError?: () => void;
}

export function LazyImage({
  src,
  alt,
  width,
  height,
  className,
  priority = false,
  quality = 75,
  sizes,
  fill = false,
  threshold = 0.1,
  rootMargin = '50px',
  placeholder,
  onLoad,
  onError,
  fallback,
}: LazyImageProps) {
  const [imageRef, isVisible] = useLazyLoading({
    threshold,
    rootMargin,
    triggerOnce: true,
  }) as [React.RefObject<HTMLDivElement>, boolean];

  // If priority is true, skip lazy loading
  if (priority) {
    return (
      <OptimizedImage
        src={src}
        alt={alt}
        width={width}
        height={height}
        priority
        quality={quality}
        sizes={sizes}
        fill={fill}
        className={className}
        onLoad={onLoad}
        onError={onError}
        fallback={fallback}
      />
    );
  }

  return (
    <div
      ref={imageRef}
      className={cn('relative', className)}
      style={{
        width: fill ? '100%' : width,
        height: fill ? '100%' : height,
      }}
    >
      {isVisible ? (
        <OptimizedImage
          src={src}
          alt={alt}
          width={width}
          height={height}
          priority={false}
          quality={quality}
          sizes={sizes}
          fill={fill}
          loading="lazy"
          onLoad={onLoad}
          onError={onError}
          fallback={fallback}
        />
      ) : (
        placeholder || (
          <Skeleton
            className="w-full h-full"
            style={{
              width: fill ? '100%' : width,
              height: fill ? '100%' : height,
            }}
          />
        )
      )}
    </div>
  );
}

// Gallery image component with advanced lazy loading
export function LazyGalleryImage({
  src,
  alt,
  aspectRatio = 1,
  className,
  quality = 80,
  onLoad,
}: {
  src: string;
  alt: string;
  aspectRatio?: number;
  className?: string;
  quality?: number;
  onLoad?: () => void;
}) {
  return (
    <div
      className={cn('relative overflow-hidden rounded-lg', className)}
      style={{ aspectRatio }}
    >
      <LazyImage
        src={src}
        alt={alt}
        width={400}
        height={400 / aspectRatio}
        fill
        quality={quality}
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
        className="object-cover"
        onLoad={onLoad}
      />
    </div>
  );
}

// Card image component with lazy loading
export function LazyCardImage({
  src,
  alt,
  className,
  quality = 75,
  onLoad,
}: {
  src: string;
  alt: string;
  className?: string;
  quality?: number;
  onLoad?: () => void;
}) {
  return (
    <div className={cn('relative h-48 overflow-hidden', className)}>
      <LazyImage
        src={src}
        alt={alt}
        width={300}
        height={200}
        fill
        quality={quality}
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        className="object-cover"
        onLoad={onLoad}
      />
    </div>
  );
}
