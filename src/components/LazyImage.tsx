import React, { useState, useEffect, useRef, CSSProperties } from 'react'
import { useIntersectionObserver } from '@/hooks/usePerformance'
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
 * 懒加载图片组件
 * 使用 IntersectionObserver 实现高效的图片懒加载
 * 支持 Supabase Storage 图片变换优化
 *
 * ⚠️ 关键设计说明：
 *    - width / height 仅用于生成优化后的图片 URL（Supabase image transform），
 *      不会作为容器的 CSS 尺寸。
 *    - 所有关键样式使用内联 style 确保在 Telegram WebView 中的兼容性。
 *    - 容器的外部尺寸由 className 或 style prop 决定。
 *    - 内部 img 使用绝对定位 + 内联样式填充容器。
 */
export const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  placeholder = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%23f0f0f0" width="400" height="300"/%3E%3C/svg%3E',
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
  // 根据 width 参数生成优化后的图片 URL（取 2x 以适配高清屏）
  const optimizedSrc = optimize && width
    ? getOptimizedImageUrl(src, { width: width * 2, quality })
    : src

  const [imageSrc, setImageSrc] = useState(placeholder)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const { t } = useTranslation()
  const imgRef = useRef<HTMLImageElement | null>(null)
  const containerRef = useIntersectionObserver(
    (isVisible) => {
      if (isVisible && imageSrc === placeholder) {
        setImageSrc(optimizedSrc)
      }
    },
    { threshold: 0.1 }
  )

  useEffect(() => {
    const img = imgRef.current
    if (!img) return

    const handleLoad = () => {
      setIsLoading(false)
      onLoad?.()
    }

    const handleError = () => {
      setIsLoading(false)
      setHasError(true)
      onError?.()
    }

    img.addEventListener('load', handleLoad)
    img.addEventListener('error', handleError)

    return () => {
      img.removeEventListener('load', handleLoad)
      img.removeEventListener('error', handleError)
    }
  }, [onLoad, onError])

  // 容器样式：position:relative + overflow:hidden 是核心
  // 外部传入的 style 可以覆盖默认值
  const containerStyle: CSSProperties = {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#e5e7eb',
    ...externalStyle,
  }

  return (
    <div
      ref={containerRef}
      className={className}
      style={containerStyle}
    >
      <img
        ref={imgRef}
        src={imageSrc}
        alt={alt}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: objectFit,
          objectPosition: 'center',
          opacity: isLoading ? 0 : 1,
          transition: 'opacity 0.3s',
          // 关键：覆盖 Tailwind v4 preflight 的 img { max-width:100%; height:auto }
          maxWidth: 'none',
        }}
      />
      {isLoading && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: '#d1d5db',
            animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
          }}
        />
      )}
      {hasError && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#d1d5db',
          }}
        >
          <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>{t('common.loadFailed')}</span>
        </div>
      )}
    </div>
  )
}

export default LazyImage
