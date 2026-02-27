import React, { useState, useEffect, useRef, useCallback, CSSProperties } from 'react';

interface OptimizedImageProps {
  src: string;
  alt: string;
  placeholder?: string;
  className?: string;
  style?: CSSProperties;
  width?: number;
  height?: number;
  onLoad?: () => void;
  onError?: () => void;
  webpSrc?: string;
  srcSet?: string;
  sizes?: string;
  loading?: 'lazy' | 'eager';
  blurDataURL?: string;
}

/**
 * Optimized Image Component v4
 * 修复与 LazyImage v4 相同的问题：
 * - 使用 top/left/right/bottom:0 代替 width/height:100%
 * - IntersectionObserver + fallback 超时
 * - 内联样式覆盖 Tailwind v4 preflight
 */
export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  placeholder,
  className = '',
  style: externalStyle,
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
  const [shouldLoad, setShouldLoad] = useState(loading === 'eager');
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (loading === 'eager') return;

    const el = containerRef.current;
    if (!el) {
      setShouldLoad(true);
      return;
    }

    fallbackTimerRef.current = setTimeout(() => {
      setShouldLoad(true);
    }, 500);

    if (typeof IntersectionObserver !== 'undefined') {
      try {
        observerRef.current = new IntersectionObserver(
          (entries) => {
            if (entries[0]?.isIntersecting) {
              setShouldLoad(true);
              observerRef.current?.disconnect();
              if (fallbackTimerRef.current) {
                clearTimeout(fallbackTimerRef.current);
                fallbackTimerRef.current = null;
              }
            }
          },
          { threshold: 0.01, rootMargin: '200px' }
        );
        observerRef.current.observe(el);
      } catch {
        setShouldLoad(true);
      }
    } else {
      setShouldLoad(true);
    }

    return () => {
      observerRef.current?.disconnect();
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
      }
    };
  }, [loading]);

  const handleLoad = useCallback(() => {
    setIsLoading(false);
    onLoad?.();
  }, [onLoad]);

  const handleError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
    onError?.();
  }, [onError]);

  const containerClassName = className
    .replace(/\bobject-(cover|contain|fill|none|scale-down)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  let resolvedObjectFit: CSSProperties['objectFit'] = 'cover';
  if (className.includes('object-contain')) resolvedObjectFit = 'contain';
  else if (className.includes('object-fill')) resolvedObjectFit = 'fill';
  else if (className.includes('object-none')) resolvedObjectFit = 'none';
  else if (className.includes('object-scale-down')) resolvedObjectFit = 'scale-down';

  const containerStyle: CSSProperties = {
    position: 'relative',
    overflow: 'hidden',
    width: width ? `${width}px` : undefined,
    height: height ? `${height}px` : undefined,
    ...externalStyle,
  };

  const imgStyle: CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    objectFit: resolvedObjectFit,
    objectPosition: 'center',
    maxWidth: 'none',
    display: 'block',
    transition: 'opacity 0.5s, transform 0.5s',
    opacity: isLoading ? 0 : 1,
    transform: isLoading ? 'scale(0.95)' : 'scale(1)',
  };

  const overlayStyle: CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  };

  return (
    <div
      ref={containerRef}
      className={containerClassName}
      style={containerStyle}
    >
      {blurDataURL && isLoading && (
        <div
          style={{
            ...overlayStyle,
            backgroundImage: `url(${blurDataURL})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(4px)',
            transform: 'scale(1.1)',
          }}
        />
      )}

      {shouldLoad ? (
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          srcSet={srcSet}
          sizes={sizes}
          decoding="async"
          onLoad={handleLoad}
          onError={handleError}
          style={imgStyle}
        />
      ) : null}

      {isLoading && !blurDataURL && (
        <div style={{ ...overlayStyle, backgroundColor: '#e5e7eb' }} />
      )}

      {hasError && (
        <div
          style={{
            ...overlayStyle,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#e5e7eb',
            color: '#9ca3af',
          }}
        >
          <svg style={{ width: '32px', height: '32px', marginBottom: '4px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <span style={{ fontSize: '0.75rem' }}>Failed to load</span>
        </div>
      )}
    </div>
  );
};

export default OptimizedImage;
