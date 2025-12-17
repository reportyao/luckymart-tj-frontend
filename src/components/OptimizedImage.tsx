import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useIntersectionObserver } from '@/hooks/usePerformance';

interface OptimizedImageProps {
  src: string;
  alt: string;
  placeholder?: string;
  className?: string;
  width?: number;
  height?: number;
  onLoad?: () => void;
  onError?: () => void;
  // WebP support
  webpSrc?: string;
  // Responsive image support
  srcSet?: string;
  sizes?: string;
  // Loading strategy
  loading?: 'lazy' | 'eager';
  // Blur placeholder
  blurDataURL?: string;
}

/**
 * Optimized Image Component with WebP support, responsive images, and blur placeholder
 * Features:
 * - Lazy loading with IntersectionObserver
 * - WebP format with fallback to original format
 * - Responsive images with srcSet
 * - Blur placeholder for better UX
 * - Loading states with animations
 */
export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  placeholder,
  className = '',
  width,
  height,
  onLoad,
  onError,
  webpSrc,
  srcSet,
  sizes,
  loading = 'lazy',
  blurDataURL,
}) => {
  const [imageSrc, setImageSrc] = useState<string | undefined>(
    loading === 'eager' ? src : placeholder || blurDataURL
  );
  const [imageWebpSrc, setImageWebpSrc] = useState<string | undefined>(
    loading === 'eager' ? webpSrc : undefined
  );
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const pictureRef = useRef<HTMLPictureElement | null>(null);

  // Check if browser supports WebP
  const supportsWebP = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const canvas = document.createElement('canvas');
    if (canvas.getContext && canvas.getContext('2d')) {
      return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
    }
    return false;
  }, []);

  // Intersection Observer for lazy loading
  const containerRef = useIntersectionObserver(
    (isVisible) => {
      if (isVisible && loading === 'lazy') {
        setImageSrc(src);
        if (webpSrc && supportsWebP) {
          setImageWebpSrc(webpSrc);
        }
      }
    },
    { threshold: 0.1, rootMargin: '50px' }
  );

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;

    const handleLoad = () => {
      setIsLoading(false);
      onLoad?.();
    };

    const handleError = () => {
      setIsLoading(false);
      setHasError(true);
      // Fallback to original image if WebP fails
      if (imageWebpSrc) {
        setImageWebpSrc(undefined);
        setImageSrc(src);
      } else {
        onError?.();
      }
    };

    img.addEventListener('load', handleLoad);
    img.addEventListener('error', handleError);

    return () => {
      img.removeEventListener('load', handleLoad);
      img.removeEventListener('error', handleError);
    };
  }, [onLoad, onError, imageWebpSrc, src]);

  // Convert src to WebP if browser supports and webpSrc not provided
  const getWebPSrc = (originalSrc: string): string | undefined => {
    if (!supportsWebP) return undefined;
    if (webpSrc) return webpSrc;
    
    // Try to generate WebP URL from original
    if (originalSrc.includes('.jpg') || originalSrc.includes('.jpeg') || originalSrc.includes('.png')) {
      return originalSrc.replace(/\.(jpg|jpeg|png)/, '.webp');
    }
    return undefined;
  };

  const computedWebpSrc = imageWebpSrc || getWebPSrc(src);

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden bg-gray-200 ${className}`}
      style={{
        width: width ? `${width}px` : '100%',
        height: height ? `${height}px` : 'auto',
        aspectRatio: width && height ? `${width}/${height}` : 'auto',
      }}
    >
      {/* Blur placeholder */}
      {blurDataURL && isLoading && (
        <div
          className="absolute inset-0 bg-cover bg-center blur-sm scale-110"
          style={{
            backgroundImage: `url(${blurDataURL})`,
          }}
        />
      )}

      {/* Picture element for WebP support */}
      {computedWebpSrc ? (
        <picture ref={pictureRef}>
          <source type="image/webp" srcSet={computedWebpSrc} />
          <img
            ref={imgRef}
            src={imageSrc}
            alt={alt}
            srcSet={srcSet}
            sizes={sizes}
            loading={loading}
            decoding="async"
            className={`w-full h-full object-cover transition-all duration-500 ${
              isLoading ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
            }`}
          />
        </picture>
      ) : (
        <img
          ref={imgRef}
          src={imageSrc}
          alt={alt}
          srcSet={srcSet}
          sizes={sizes}
          loading={loading}
          decoding="async"
          className={`w-full h-full object-cover transition-all duration-500 ${
            isLoading ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
          }`}
        />
      )}

      {/* Loading indicator */}
      {isLoading && !blurDataURL && (
        <div className="absolute inset-0 bg-gradient-to-br from-gray-200 via-gray-300 to-gray-200 animate-pulse" />
      )}

      {/* Error state */}
      {hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-300 text-gray-500">
          <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <span className="text-sm">Failed to load image</span>
        </div>
      )}
    </div>
  );
};

export default OptimizedImage;
