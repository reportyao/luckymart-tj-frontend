import { useRef, useCallback, useEffect } from 'react'

export interface TouchPosition {
  x: number
  y: number
}

export interface SwipeDirection {
  direction: 'left' | 'right' | 'up' | 'down' | null
  distance: number
  velocity: number
}

interface TouchState {
  startPos: TouchPosition | null
  currentPos: TouchPosition | null
  startTime: number
}

/**
 * 触摸手势检测hook
 * 支持滑动、长按等手势识别
 */
export function useSwipe(
  onSwipe?: (direction: SwipeDirection) => void,
  threshold = 50
) {
  const touchState = useRef<TouchState>({
    startPos: null,
    currentPos: null,
    startTime: 0,
  })

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    touchState.current = {
      startPos: { x: touch.clientX, y: touch.clientY },
      currentPos: { x: touch.clientX, y: touch.clientY },
      startTime: Date.now(),
    }
  }, [])

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!touchState.current.startPos) return
    const touch = e.touches[0];
    if (!touch) return;
    touchState.current.currentPos = { x: touch.clientX, y: touch.clientY }
  }, [])

  const handleTouchEnd = useCallback(() => {
    const { startPos, currentPos, startTime } = touchState.current
    if (!startPos || !currentPos) return

    const deltaX = currentPos.x - startPos.x
    const deltaY = currentPos.y - startPos.y
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)
    const duration = Date.now() - startTime
    const velocity = distance / duration

    if (distance < threshold) return

    let direction: SwipeDirection['direction'] = null
    const absDeltaX = Math.abs(deltaX)
    const absDeltaY = Math.abs(deltaY)

    if (absDeltaX > absDeltaY) {
      direction = deltaX > 0 ? 'right' : 'left'
    } else {
      direction = deltaY > 0 ? 'down' : 'up'
    }

    if (onSwipe && direction) {
      onSwipe({
        direction,
        distance,
        velocity,
      })
    }

    touchState.current = {
      startPos: null,
      currentPos: null,
      startTime: 0,
    }
  }, [onSwipe, threshold])

  return {
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  }
}

/**
 * 长按手势检测hook
 */
export function useLongPress(
  onLongPress: () => void,
  duration = 500
) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const touchStartRef = useRef<TouchEvent | null>(null)

  const handleTouchStart = useCallback((e: TouchEvent) => {
    touchStartRef.current = e
    timeoutRef.current = setTimeout(() => {
      onLongPress()
    }, duration)
  }, [onLongPress, duration])

  const handleTouchEnd = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    touchStartRef.current = null
  }, [])

  const handleTouchMove = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  useEffect(() => {
    const timeout = timeoutRef.current
    return () => {
      if (timeout) {
        clearTimeout(timeout)
      }
    }
  }, [])

  return {
    handleTouchStart,
    handleTouchEnd,
    handleTouchMove,
  }
}

/**
 * 双击手势检测hook
 */
export function useDoubleTap(
  onDoubleTap: () => void,
  delay = 300
) {
  const lastTapRef = useRef<number>(0)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const handleTouchEnd = useCallback(() => {
    const now = Date.now()
    const timeSinceLastTap = now - lastTapRef.current

    if (timeSinceLastTap < delay) {
      // 双击
      onDoubleTap()
      lastTapRef.current = 0
    } else {
      lastTapRef.current = now
    }
  }, [onDoubleTap, delay])

  useEffect(() => {
    const timeout = timeoutRef.current
    return () => {
      if (timeout) {
        clearTimeout(timeout)
      }
    }
  }, [])

  return { handleTouchEnd }
}

/**
 * 捏合缩放手势检测hook
 */
export function usePinch(
  onPinch?: (scale: number) => void
) {
  const distanceRef = useRef<number>(0)

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (e.touches.length !== 2) return

    const touch1 = e.touches[0]
    const touch2 = e.touches[1]

    if (!touch1 || !touch2) return;
    const deltaX = touch2.clientX - touch1.clientX;
    const deltaY = touch2.clientY - touch1.clientY
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

    if (distanceRef.current > 0) {
      const scale = distance / distanceRef.current
      onPinch?.(scale)
    }

    distanceRef.current = distance
  }, [onPinch])

  const handleTouchEnd = useCallback(() => {
    distanceRef.current = 0
  }, [])

  return {
    handleTouchMove,
    handleTouchEnd,
  }
}
