/**
 * Custom image loader for production builds
 * This loader is used when images.unoptimized is false in production
 */

export default function customImageLoader({ src, width, quality }) {
  // For external URLs, return as-is
  if (src.startsWith('http')) {
    return src;
  }

  // For local images, we'll use the original source since we're doing static export
  // In a real production environment, you would integrate with an image optimization service
  // like Cloudinary, ImageKit, or similar
  return src;
}
