import { useState, useRef, useEffect, forwardRef } from 'react'
import { useThrottle } from '@/hooks/usePerformance'

interface VirtualListProps<T> {
  items: T[]
  itemHeight: number
  containerHeight: number
  renderItem: (item: T, index: number) => React.ReactNode
  overscan?: number
  className?: string
  onEndReached?: () => void
  onEndReachedThreshold?: number
}

/**
 * 虚拟列表组件
 * 用于高效渲染大列表，只渲染可见区域的元素
 */
export const VirtualList = forwardRef<
  HTMLDivElement,
  VirtualListProps<any>
>(
  (
    {
      items,
      itemHeight,
      containerHeight,
      renderItem,
      overscan = 3,
      className = '',
      onEndReached,
      onEndReachedThreshold = 0.1,
    },
    ref
  ) => {
    const [scrollTop, setScrollTop] = useState(0)
    const containerRef = useRef<HTMLDivElement | null>(null)

    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
    const endIndex = Math.min(
      items.length,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    )

    const visibleItems = items.slice(startIndex, endIndex)
    const offsetY = startIndex * itemHeight
    const totalHeight = items.length * itemHeight

    const handleScroll = useThrottle((e: React.UIEvent<HTMLDivElement>) => {
      const target = e.currentTarget
      setScrollTop(target.scrollTop)

      // 检查是否到达底部
      const scrollPercentage =
        (target.scrollTop + target.clientHeight) / target.scrollHeight
      if (scrollPercentage > 1 - onEndReachedThreshold) {
        onEndReached?.()
      }
    }, 16) // 约 60fps

    useEffect(() => {
      const container = containerRef.current || (ref as any)?.current;
      if (container) {
        const handleScrollEvent = (e: Event) => handleScroll(e as unknown as React.UIEvent<HTMLDivElement>);
        container.addEventListener('scroll', handleScrollEvent, { passive: true });
        return () => {
          container.removeEventListener('scroll', handleScrollEvent);
        };
      }
      return () => {};
    }, [handleScroll, ref]);



    return (
      <div
        ref={containerRef}
        className={`overflow-y-auto ${className}`}
        style={{
          height: `${containerHeight}px`,
        }}
      >
        <div
          style={{
            height: `${totalHeight}px`,
            position: 'relative',
          }}
        >
          <div
            style={{
              transform: `translateY(${offsetY}px)`,
            }}
          >
            {visibleItems.map((item, index) => (
              <div
                key={startIndex + index}
                style={{
                  height: `${itemHeight}px`,
                }}
              >
                {renderItem(item, startIndex + index)}
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }
)

VirtualList.displayName = 'VirtualList'

export default VirtualList
