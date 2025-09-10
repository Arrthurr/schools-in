# Image Optimization and Lazy Loading Guide

This guide covers the comprehensive image optimization and lazy loading implementation for the Schools-In application.

## Overview

The image optimization system provides:

- **Next.js Image optimization** with WebP/AVIF support
- **Lazy loading** with Intersection Observer API
- **Progressive loading** with low-quality placeholders
- **Smart preloading** based on user interactions and network conditions
- **PWA caching strategies** for offline image access
- **Performance monitoring** and optimization metrics

## Components

### 1. OptimizedImage (`src/components/ui/optimized-image.tsx`)

Main image component with built-in optimization:

```tsx
import { OptimizedImage } from '@/components/ui/optimized-image';

<OptimizedImage
  src="/example.jpg"
  alt="Example image"
  width={400}
  height={300}
  priority={false}
  quality={80}
  loading="lazy"
/>
```

**Features:**
- Automatic WebP/AVIF format selection
- Loading states with skeleton placeholders
- Error handling with fallback UI
- Responsive sizing support
- Progressive enhancement

### 2. OptimizedAvatar (`src/components/ui/optimized-image.tsx`)

Specialized component for user avatars:

```tsx
import { OptimizedAvatar } from '@/components/ui/optimized-image';

<OptimizedAvatar
  src={user.photoURL}
  alt="User avatar"
  size={40}
  fallback={<UserIcon />}
/>
```

**Features:**
- Round avatar styling
- Default fallback with user icon
- High-quality rendering (85% quality)
- Optimized for profile pictures

### 3. LazyImage (`src/components/ui/lazy-image.tsx`)

Advanced lazy loading with Intersection Observer:

```tsx
import { LazyImage } from '@/components/ui/lazy-image';

<LazyImage
  src="/gallery-image.jpg"
  alt="Gallery item"
  width={300}
  height={200}
  threshold={0.1}
  rootMargin="50px"
/>
```

**Features:**
- Intersection Observer-based lazy loading
- Configurable threshold and root margin
- Priority override for above-fold images
- Gallery and card variants included

## Hooks

### 1. useLazyLoading (`src/lib/hooks/useLazyLoading.ts`)

Core lazy loading hook:

```tsx
import { useLazyLoading } from '@/lib/hooks/useLazyLoading';

function MyComponent() {
  const [ref, isVisible] = useLazyLoading({
    threshold: 0.1,
    rootMargin: '100px',
    triggerOnce: true,
  });

  return (
    <div ref={ref}>
      {isVisible && <ExpensiveComponent />}
    </div>
  );
}
```

### 2. useProgressiveImage

For progressive image loading (LQIP → HQ):

```tsx
import { useProgressiveImage } from '@/lib/hooks/useLazyLoading';

function ProgressiveImage({ lowSrc, highSrc }) {
  const { src, isHighResLoaded } = useProgressiveImage(lowSrc, highSrc);
  
  return (
    <img 
      src={src} 
      className={isHighResLoaded ? 'sharp' : 'blurred'}
    />
  );
}
```

## Utilities

### 1. Image Optimization (`src/lib/utils/imageOptimization.ts`)

Core optimization utilities:

```tsx
import { 
  generateBlurDataURL,
  generateSrcSet,
  preloadImage,
  imageConfigs 
} from '@/lib/utils/imageOptimization';

// Generate responsive srcset
const srcSet = generateSrcSet('/image.jpg', [400, 800, 1200]);

// Preload critical images
await preloadImage('/hero-image.jpg');

// Use predefined configurations
const config = imageConfigs.avatar;
```

### 2. Image Preloader (`src/lib/utils/imagePreloader.ts`)

Smart preloading system:

```tsx
import { 
  preloadCriticalImages,
  conditionalPreload,
  preloadOnHover 
} from '@/lib/utils/imagePreloader';

// Initialize preloading on app start
initImagePreloading();

// Conditional preloading based on network
conditionalPreload(['/image1.jpg', '/image2.jpg'], {
  maxImages: 3,
  minConnectionSpeed: 2,
});

// Preload on hover
preloadOnHover(buttonElement, '/next-page-image.jpg');
```

## Configuration

### Next.js Config (`next.config.js`)

```javascript
images: {
  // Formats supported
  formats: ['image/webp', 'image/avif'],
  
  // External domains
  domains: [
    'firebaseapp.com',
    'googleusercontent.com',
  ],
  
  // Responsive breakpoints
  deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
  imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  
  // Quality and caching
  quality: 75,
  minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
}
```

### PWA Caching (`next.config.js`)

```javascript
runtimeCaching: [
  // Local images
  {
    urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|avif)$/i,
    handler: "CacheFirst",
    options: {
      cacheName: "images",
      expiration: {
        maxEntries: 100,
        maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
      },
    },
  },
  // Profile images
  {
    urlPattern: /^https:\/\/.*\.googleusercontent\.com/,
    handler: "CacheFirst",
    options: {
      cacheName: "google-profile-images",
      expiration: {
        maxEntries: 50,
        maxAgeSeconds: 60 * 60 * 24 * 7, // 1 week
      },
    },
  },
]
```

## Best Practices

### 1. Image Selection

- **Above-fold images**: Use `priority={true}` and `loading="eager"`
- **Below-fold images**: Use `priority={false}` and `loading="lazy"`
- **Hero images**: Use `OptimizedHeroImage` with high quality (90%)
- **Avatars**: Use `OptimizedAvatar` with 85% quality
- **Gallery images**: Use `LazyGalleryImage` with 80% quality

### 2. Performance Optimization

```tsx
// ✅ Good: Lazy load with appropriate sizes
<LazyImage
  src="/gallery.jpg"
  alt="Gallery item"
  width={300}
  height={200}
  sizes="(max-width: 640px) 100vw, 50vw"
  quality={80}
/>

// ❌ Bad: Loading all images eagerly
<img src="/gallery.jpg" alt="Gallery item" />
```

### 3. Responsive Images

```tsx
// ✅ Good: Responsive with multiple breakpoints
<OptimizedImage
  src="/hero.jpg"
  alt="Hero image"
  width={1920}
  height={1080}
  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 70vw"
  priority
/>
```

### 4. Error Handling

```tsx
// ✅ Good: Proper fallback handling
<OptimizedImage
  src={user.avatar}
  alt="User avatar"
  width={40}
  height={40}
  fallback={<DefaultAvatar />}
  onError={() => analytics.track('image_load_error')}
/>
```

## Performance Metrics

The system includes built-in performance monitoring:

```tsx
import { measureImageLoadTime } from '@/lib/utils/imageOptimization';

// Measure load performance
const loadTime = await measureImageLoadTime('/image.jpg');
console.log(`Image loaded in ${loadTime}ms`);
```

## Migration Guide

To migrate existing `<img>` tags:

1. **Replace basic images:**
   ```tsx
   // Before
   <img src="/logo.png" alt="Logo" width={100} height={50} />
   
   // After  
   <OptimizedImage
     src="/logo.png"
     alt="Logo"
     width={100}
     height={50}
     quality={90}
   />
   ```

2. **Replace profile images:**
   ```tsx
   // Before
   <img src={user.photoURL} alt="User" className="rounded-full w-10 h-10" />
   
   // After
   <OptimizedAvatar
     src={user.photoURL}
     alt="User"
     size={40}
   />
   ```

3. **Add lazy loading to galleries:**
   ```tsx
   // Before
   {images.map(img => <img key={img.id} src={img.url} alt={img.alt} />)}
   
   // After
   {images.map(img => (
     <LazyImage
       key={img.id}
       src={img.url}
       alt={img.alt}
       width={300}
       height={200}
       quality={80}
     />
   ))}
   ```

## Monitoring and Analytics

Track image performance:

```tsx
// Log image performance metrics
const { loadTime, fromCache } = await measureImageLoadPerformance('/image.jpg');

analytics.track('image_performance', {
  src: '/image.jpg',
  loadTime,
  fromCache,
  format: getOptimalImageFormat(),
});
```

## Troubleshooting

### Common Issues

1. **Images not loading:**
   - Check domain is in `next.config.js` domains list
   - Verify image paths are correct
   - Check network tab for CORS errors

2. **Slow loading:**
   - Reduce image quality for non-critical images
   - Implement progressive loading
   - Check image file sizes

3. **Layout shift:**
   - Always provide width/height attributes
   - Use aspect-ratio CSS when needed
   - Consider blur placeholders

### Debug Mode

Enable debug logging:

```tsx
// In development, enable detailed logging
if (process.env.NODE_ENV === 'development') {
  window.imageDebug = true;
}
```

## Further Optimization

For production deployments:

1. **CDN Integration**: Configure with Cloudinary/ImageKit
2. **Advanced Compression**: AVIF for supported browsers
3. **Smart Cropping**: Auto-focus on important image areas
4. **A/B Testing**: Test different optimization strategies

## References

- [Next.js Image Optimization](https://nextjs.org/docs/api-reference/next/image)
- [Web Vitals - Largest Contentful Paint](https://web.dev/lcp/)
- [Intersection Observer API](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API)
- [PWA Image Caching Strategies](https://web.dev/offline-cookbook/)
