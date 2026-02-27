import React, { useState, useEffect, useRef, useCallback, CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { getOptimizedImageUrl } from '@/lib/utils'

interface LazyImageProps {
  src: string
  alt: string
  placeholder?: string
  className?: string
  /** 额外的容器内联样式 */
  style?: CSSProperties
  width?: number
  height?: number
  onLoad?: () => void
  onError?: () => void
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down'
  /** 是否启用 Supabase 图片变换优化，默认 true */
  optimize?: boolean
  /** 图片质量 (1-100)，默认 75 */
  quality?: number
}

/**
 * 懒加载图片组件 v4 - 彻底修复所有环境下的图片显示
 *
 * 核心修复（v4）：
 * 1. img 使用 `top:0;left:0;right:0;bottom:0` 而非 `width:100%;height:100%`
 *    → 解决 paddingBottom 撑高的容器中 height:100% 计算为 0 的问题
 * 2. IntersectionObserver + fallback 超时机制
 * 3. 图片加载失败时自动回退到原始 URL
 * 4. 所有样式使用内联 style，兼容 Tailwind v4 preflight
 */
export const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  placeholder,
  className = '',
  style: externalStyle,
  width,
  height,
  onLoad,
  onError,
  objectFit = 'cover',
  optimize = true,
  quality = 75,
}) => {
  // 生成优化后的图片 URL（取 2x 以适配高清屏）
  const optimizedSrc = optimize && width
    ? getOptimizedImageUrl(src, { width: width * 2, quality })
    : src

  const [shouldLoad, setShouldLoad] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [useFallbackSrc, setUseFallbackSrc] = useState(false)
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const actualSrc = useFallbackSrc ? src : optimizedSrc

  // IntersectionObserver + fallback 超时
  useEffect(() => {
    const el = containerRef.current
    if (!el) {
      setShouldLoad(true)
      return
    }

    fallbackTimerRef.current = setTimeout(() => {
      setShouldLoad(true)
    }, 500)

    if (typeof IntersectionObserver !== 'undefined') {
      try {
        observerRef.current = new IntersectionObserver(
          (entries) => {
            const entry = entries[0]
            if (entry && entry.isIntersecting) {
              setShouldLoad(true)
              observerRef.current?.disconnect()
              if (fallbackTimerRef.current) {
                clearTimeout(fallbackTimerRef.current)
                fallbackTimerRef.current = null
              }
            }
          },
          { threshold: 0.01, rootMargin: '200px' }
        )
        observerRef.current.observe(el)
      } catch {
        setShouldLoad(true)
      }
    } else {
      setShouldLoad(true)
    }

    return () => {
      observerRef.current?.disconnect()
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current)
      }
    }
  }, [])

  const handleLoad = useCallback(() => {
    setIsLoading(false)
    onLoad?.()
  }, [onLoad])

  const handleError = useCallback(() => {
    if (!useFallbackSrc && optimizedSrc !== src) {
      setUseFallbackSrc(true)
      return
    }
    setIsLoading(false)
    setHasError(true)
    onError?.()
  }, [useFallbackSrc, optimizedSrc, src, onError])

  // 从 className 中检测 objectFit 覆盖
  let resolvedObjectFit = objectFit
  if (className.includes('object-contain')) resolvedObjectFit = 'contain'
  else if (className.includes('object-cover')) resolvedObjectFit = 'cover'
  else if (className.includes('object-fill')) resolvedObjectFit = 'fill'
  else if (className.includes('object-none')) resolvedObjectFit = 'none'
  else if (className.includes('object-scale-down')) resolvedObjectFit = 'scale-down'

  const containerClassName = className
    .replace(/\bobject-(cover|contain|fill|none|scale-down)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  // 容器样式
  const containerStyle: CSSProperties = {
    position: 'relative',
    overflow: 'hidden',
    ...externalStyle,
  }

  /**
   * ⚠️ 关键修复（v4）：
   * img 使用 top/left/right/bottom: 0 + position: absolute 来填满容器，
   * 而不是 width: 100% + height: 100%。
   *
   * 原因：当容器使用 paddingBottom: 100% 来创建正方形时，
   * 容器的 content height 为 0，导致 height: 100% = 0px，
   * objectFit: cover 在 0 高度上无法工作。
   *
   * 使用 top:0;bottom:0 则直接参考容器的 padding box 边界，
   * 不依赖 content height，在所有情况下都能正确填充。
   */
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
    opacity: isLoading ? 0 : 1,
    transition: 'opacity 0.3s',
    maxWidth: 'none',
    display: 'block',
  }

  // 占位/错误层也使用 inset 方式
  const overlayStyle: CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  }

  return (
    <div
      ref={containerRef}
      className={containerClassName}
      style={containerStyle}
    >
      {shouldLoad ? (
        <img
          ref={imgRef}
          src={actualSrc}
          alt={alt}
          onLoad={handleLoad}
          onError={handleError}
          style={imgStyle}
        />
      ) : null}

      {isLoading && (
        <div style={{ ...overlayStyle, backgroundColor: '#e5e7eb' }} />
      )}

      {hasError && (
        <div
          style={{
            ...overlayStyle,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#e5e7eb',
          }}
        >
          <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>{t('common.loadFailed')}</span>
        </div>
      )}
    </div>
  )
}

export default LazyImage
