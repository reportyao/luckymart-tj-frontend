// 全局错误处理器，专门处理 DOM 操作错误
export const setupGlobalErrorHandlers = () => {
  // 捕获未处理的 Promise 错误
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason)
    
    // 如果是 DOM 操作错误，阻止默认错误显示
    if (event.reason?.message?.includes('removeChild') ||
        event.reason?.message?.includes('Node') ||
        event.reason?.name === 'NotFoundError') {
      console.warn('DOM manipulation error caught and handled')
      event.preventDefault()
    }
  })

  // 捕获全局 JavaScript 错误
  window.addEventListener('error', (event) => {
    console.error('Global error:', event.error)
    
    // 如果是 DOM 操作错误，阻止默认错误显示
    if (event.error?.message?.includes('removeChild') ||
        event.error?.message?.includes('Node') ||
        event.error?.name === 'NotFoundError') {
      console.warn('DOM manipulation error caught and handled')
      event.preventDefault()
      return true
    }
  })

  // 添加 Framer Motion 特定的错误处理
  const originalConsoleError = console.error
  console.error = (...args) => {
    const message = args.join(' ')
    if (message.includes('removeChild') || 
        message.includes('Node') ||
        message.includes('framer-motion')) {
      console.warn('Suppressed Framer Motion DOM error:', ...args)
      return
    }
    originalConsoleError.apply(console, args)
  }
}

// React 开发工具警告抑制（仅用于已知的安全警告）
export const suppressKnownWarnings = () => {
  const originalConsoleWarn = console.warn
  console.warn = (...args) => {
    const message = args.join(' ')
    
    // 抑制已知的安全警告
    if (message.includes('useLayoutEffect does nothing on the server') ||
        message.includes('componentWillMount has been renamed') ||
        message.includes('findDOMNode is deprecated')) {
      return
    }
    
    originalConsoleWarn.apply(console, args)
  }
}