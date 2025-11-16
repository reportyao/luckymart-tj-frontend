import { useEffect, useRef, useCallback } from 'react'

/**
 * 防抖hook - 延迟执行函数
 */
export function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const debouncedCallback = useCallback(
    (...args: any[]) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      timeoutRef.current = setTimeout(() => {
        callback(...args)
      }, delay)
    },
    [callback, delay]
  ) as T

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return debouncedCallback
}

/**
 * 节流hook - 限制函数执行频率
 */
export function useThrottle<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const lastCallRef = useRef<number>(0)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const throttledCallback = useCallback(
    (...args: any[]) => {
      const now = Date.now()
      const timeSinceLastCall = now - lastCallRef.current

      if (timeSinceLastCall >= delay) {
        lastCallRef.current = now
        callback(...args)
      } else {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
        }
        timeoutRef.current = setTimeout(() => {
          lastCallRef.current = Date.now()
          callback(...args)
        }, delay - timeSinceLastCall)
      }
    },
    [callback, delay]
  ) as T

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return throttledCallback
}

/**
 * 交叉观察器hook - 用于懒加载和无限滚动
 */
export function useIntersectionObserver(
  callback: (isVisible: boolean) => void,
  options?: IntersectionObserverInit
) {
  const elementRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      callback(entry.isIntersecting)
    }, {
      threshold: 0.1,
      ...options,
    })

    if (elementRef.current) {
      observer.observe(elementRef.current)
    }

    return () => {
      if (elementRef.current) {
        observer.unobserve(elementRef.current)
      }
      observer.disconnect()
    }
  }, [callback, options])

  return elementRef
}

/**
 * 虚拟滚动hook - 用于长列表优化
 */
export function useVirtualScroll(
  items: any[],
  itemHeight: number,
  containerHeight: number,
  overscan = 3
) {
  const scrollTop = useRef<number>(0)
  const startIndex = Math.max(0, Math.floor(scrollTop.current / itemHeight) - overscan)
  const endIndex = Math.min(
    items.length,
    Math.ceil((scrollTop.current + containerHeight) / itemHeight) + overscan
  )

  const visibleItems = items.slice(startIndex, endIndex)
  const offsetY = startIndex * itemHeight

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    scrollTop.current = e.currentTarget.scrollTop
  }, [])

  return {
    visibleItems,
    offsetY,
    handleScroll,
    totalHeight: items.length * itemHeight,
  }
}

/**
 * 网络状态检测hook
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = React.useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )
  const [effectiveType, setEffectiveType] = React.useState<
    '4g' | '3g' | '2g' | 'slow-2g' | 'unknown'
  >('4g')

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // 检查网络连接类型
    const connection =
      (navigator as any).connection ||
      (navigator as any).mozConnection ||
      (navigator as any).webkitConnection

    if (connection) {
      const handleConnectionChange = () => {
        setEffectiveType(connection.effectiveType || '4g')
      }
      connection.addEventListener('change', handleConnectionChange)
      setEffectiveType(connection.effectiveType || '4g')

      return () => {
        window.removeEventListener('online', handleOnline)
        window.removeEventListener('offline', handleOffline)
        connection.removeEventListener('change', handleConnectionChange)
      }
    }

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return { isOnline, effectiveType }
}

import React from 'react'
