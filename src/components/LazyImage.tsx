import React, { useState, useEffect, useRef } from 'react'
import { useIntersectionObserver } from '@/hooks/usePerformance'
import { useTranslation } from 'react-i18next'
import { getOptimizedImageUrl } from '@/lib/utils'

interface LazyImageProps {
  src: string
  alt: string
  placeholder?: string
  className?: string
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
 * ⚠️ width / height 仅用于生成优化后的图片 URL（Supabase image transform），
 *    不会作为容器的 CSS 尺寸。容器尺寸完全由外部 className / 父元素决定。
 *    调用方应确保父元素有明确的尺寸约束（如 w-24 h-24、aspect-square 等）。
 */
export const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  placeholder = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%23f0f0f0" width="400" height="300"/%3E%3C/svg%3E',
  className = '',
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

  // 根据objectFit参数获取对应的CSS类
  const getObjectFitClass = () => {
    switch (objectFit) {
      case 'contain':
        return 'object-contain'
      case 'fill':
        return 'object-fill'
      case 'none':
        return 'object-none'
      case 'scale-down':
        return 'object-scale-down'
      case 'cover':
      default:
        return 'object-cover'
    }
  }

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden bg-gray-200 ${className}`}
    >
      <img
        ref={imgRef}
        src={imageSrc}
        alt={alt}
        className={`w-full h-full ${getObjectFitClass()} transition-opacity duration-300 ${
          isLoading ? 'opacity-0' : 'opacity-100'
        }`}
      />
      {isLoading && (
        <div className="absolute inset-0 bg-gray-300 animate-pulse" />
      )}
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-300">
          <span className="text-gray-500 text-sm">{t('common.loadFailed')}</span>
        </div>
      )}
    </div>
  )
}

export default LazyImage
