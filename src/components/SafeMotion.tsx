import React, { useRef, useEffect } from 'react'
import { motion, MotionProps } from 'framer-motion'

// 扩展 Window 接口以支持 Telegram WebApp
declare global {
  interface Window {
    Telegram?: {
      WebApp: any
    }
  }
}

// 安全的 Motion 组件包装器，防止 DOM 操作冲突
interface SafeMotionProps extends Omit<MotionProps, 'ref'> {
  children: React.ReactNode
  as?: keyof JSX.IntrinsicElements
  className?: string
}

export const SafeMotion: React.FC<SafeMotionProps> = ({ 
  children, 
  as = 'div',
  className,
  ...motionProps 
}) => {
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // 安全的动画属性，移除可能导致DOM冲突的属性
  const safeMotionProps = {
    ...motionProps,
    className,
    // 添加额外的安全检查
    onAnimationStart: (definition: any) => {
      if (!isMountedRef.current) return
      motionProps.onAnimationStart?.(definition)
    },
    onAnimationComplete: (definition: any) => {
      if (!isMountedRef.current) return
      motionProps.onAnimationComplete?.(definition)
    },
    // 在严格模式下减少动画复杂性
    transition: {
      ...motionProps.transition,
      duration: process.env.NODE_ENV === 'development' ? 0.2 : motionProps.transition?.duration
    }
  }

  const MotionComponent = motion[as] as React.ComponentType<any>

  return (
    <MotionComponent {...safeMotionProps}>
      {children}
    </MotionComponent>
  )
}

// 简化的动画变体，减少DOM操作
export const safeAnimationVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0 },
  transition: { 
    duration: 0.2, 
    ease: 'easeOut' 
  }
}

// 列表动画容器
export const SafeAnimationContainer: React.FC<{ 
  children: React.ReactNode; 
  className?: string 
}> = ({ children, className }) => {
  return (
    <SafeMotion
      className={className}
      initial="initial"
      animate="animate"
      exit="exit"
      variants={{
        initial: { opacity: 0 },
        animate: { 
          opacity: 1,
          transition: { staggerChildren: 0.05 }
        },
        exit: { opacity: 0 }
      }}
    >
      {children}
    </SafeMotion>
  )
}

// 安全的列表项动画
export const SafeAnimationItem: React.FC<{ 
  children: React.ReactNode; 
  index?: number;
  className?: string;
}> = ({ 
  children, 
  index = 0,
  className
}) => {
  return (
    <SafeMotion
      className={className}
      variants={safeAnimationVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ 
        delay: index * 0.05,
        duration: 0.2 
      }}
    >
      {children}
    </SafeMotion>
  )
}