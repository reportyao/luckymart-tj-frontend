import React from 'react'
import { useResponsive } from '@/hooks/useResponsive'

interface ResponsiveContainerProps {
  children: React.ReactNode
  className?: string
  mobileClassName?: string
  tabletClassName?: string
  desktopClassName?: string
}

/**
 * 响应式容器组件
 * 根据屏幕尺寸自动应用不同的样式
 */
export const ResponsiveContainer: React.FC<ResponsiveContainerProps> = ({
  children,
  className = '',
  mobileClassName = '',
  tabletClassName = '',
  desktopClassName = '',
}) => {
  const { isMobile, isTablet, isDesktop } = useResponsive()

  let responsiveClass = className

  if (isMobile && mobileClassName) {
    responsiveClass += ` ${mobileClassName}`
  } else if (isTablet && tabletClassName) {
    responsiveClass += ` ${tabletClassName}`
  } else if (isDesktop && desktopClassName) {
    responsiveClass += ` ${desktopClassName}`
  }

  return <div className={responsiveClass}>{children}</div>
}

/**
 * 仅在移动设备上显示的组件
 */
export const MobileOnly: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isMobile } = useResponsive()
  return isMobile ? <>{children}</> : null
}

/**
 * 仅在平板设备上显示的组件
 */
export const TabletOnly: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isTablet } = useResponsive()
  return isTablet ? <>{children}</> : null
}

/**
 * 仅在桌面设备上显示的组件
 */
export const DesktopOnly: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isDesktop } = useResponsive()
  return isDesktop ? <>{children}</> : null
}

/**
 * 隐藏在移动设备上的组件
 */
export const HiddenOnMobile: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isMobile } = useResponsive()
  return !isMobile ? <>{children}</> : null
}

/**
 * 隐藏在平板设备上的组件
 */
export const HiddenOnTablet: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isTablet } = useResponsive()
  return !isTablet ? <>{children}</> : null
}

/**
 * 隐藏在桌面设备上的组件
 */
export const HiddenOnDesktop: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isDesktop } = useResponsive()
  return !isDesktop ? <>{children}</> : null
}
