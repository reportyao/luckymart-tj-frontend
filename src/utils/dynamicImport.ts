import React, { lazy, Suspense, ReactNode } from 'react'

/**
 * 动态导入组件工厂函数
 * 用于代码分割和懒加载
 */
export function lazyLoad<P extends object>(
  importFunc: () => Promise<{ default: React.ComponentType<P> }>,
  fallback?: ReactNode
) {
  const Component = lazy(importFunc)

  return (props: P) =>
    React.createElement(
      Suspense,
      { fallback: fallback || React.createElement('div', {}, '加载中...') },
      React.createElement(Component as any, props)
    )
}

/**
 * 预加载模块
 */
export function preloadModule(
  importFunc: () => Promise<any>
): Promise<any> {
  return importFunc()
}

/**
 * 条件加载 - 根据条件动态加载模块
 */
export function conditionalLoad<T>(
  condition: boolean,
  importFunc: () => Promise<T>,
  fallback?: T
): Promise<T> {
  if (condition) {
    return importFunc()
  }
  return Promise.resolve(fallback as T)
}

/**
 * 路由级别的代码分割
 * 用于 React Router
 */
export const createLazyRoute = (
  importFunc: () => Promise<{ default: React.ComponentType<any> }>
) => {
  return {
    Component: lazy(importFunc),
  }
}
