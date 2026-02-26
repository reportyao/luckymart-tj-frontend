import React from 'react';

const serializeError = (error: any) => {
  if (error instanceof Error) {
    return error.message + '\n' + error.stack;
  }
  return JSON.stringify(error, null, 2);
};

/**
 * 判断错误是否为 chunk/模块 加载失败
 * 这类错误通常由网络问题或版本更新导致
 */
function isChunkLoadError(error: any): boolean {
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();
  const name = error.name.toLowerCase();

  return (
    message.includes('failed to fetch dynamically imported module') ||
    message.includes('failed to fetch') ||
    message.includes('network error') ||
    message.includes('load failed') ||
    message.includes('unexpected token') ||
    message.includes('error loading dynamically imported module') ||
    name.includes('chunkerror') ||
    name.includes('chunkloaderror')
  );
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: any; errorInfo: any; isChunkError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, isChunkError: false };
  }

  static getDerivedStateFromError(error: any) {
    // 更新 state，使下一次渲染显示降级后的 UI
    return { 
      hasError: true, 
      error,
      isChunkError: isChunkLoadError(error)
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // 捕获错误信息
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // 忽略 Framer Motion 的 DOM 操作错误
    if (error && error.message && (
      error.message.includes('removeChild') ||
      error.message.includes('insertBefore') ||
      error.name === 'NotFoundError'
    )) {
      console.warn('Suppressed Framer Motion DOM error:', error);
      // 重置错误状态，不显示错误 UI
      this.setState({ hasError: false, error: null, errorInfo: null, isChunkError: false });
      return;
    }

    this.setState({
      error,
      errorInfo,
      isChunkError: isChunkLoadError(error)
    });
  }

  handleReload = () => {
    // 完全重新加载页面
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, isChunkError: false });
  };

  render() {
    if (this.state.hasError) {
      // 针对 Chunk 加载失败的专用 UI（网络问题或版本更新）
      if (this.state.isChunkError) {
        return (
          <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full text-center">
              <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.858 15.355-5.858 21.213 0" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Хатои пайвастшавӣ
              </h2>
              <p className="text-gray-600 mb-2 text-sm">
                Connection error / Ошибка соединения
              </p>
              <p className="text-gray-500 mb-6 text-sm">
                Лутфан интернети худро санҷед ва дубора кӯшиш кунед.
              </p>
              
              <div className="space-y-3">
                <button
                  onClick={this.handleReload}
                  className="w-full bg-[#2B5D3A] text-white py-3 px-4 rounded-lg hover:bg-[#234a2e] transition-colors font-medium text-base"
                >
                  Дубора кӯшиш кунед
                </button>
                <p className="text-xs text-gray-400">
                  Please check your internet and try again
                </p>
              </div>
            </div>
          </div>
        );
      }

      // 通用错误 UI（非网络错误）
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.996-.833-2.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">应用出错了 😔</h2>
            <p className="text-gray-600 mb-6">
              我们已记录此错误，技术团队将尽快修复。
            </p>
            
            <div className="space-y-3">
              <button
                onClick={this.handleReload}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                重新加载应用
              </button>
              
              {process.env.NODE_ENV === 'development' && (
                <details className="mt-4 text-left">
                  <summary className="text-sm text-gray-600 cursor-pointer hover:text-gray-800">
                    技术详情
                  </summary>
                  <div className="mt-3 p-3 bg-gray-50 rounded border text-xs font-mono text-gray-700 max-h-40 overflow-auto">
                    <strong>错误信息:</strong>
                    <pre className="whitespace-pre-wrap">{serializeError(this.state.error)}</pre>
                    {this.state.errorInfo && (
                      <>
                        <strong className="block mt-3">组件堆栈:</strong>
                        <pre className="whitespace-pre-wrap">{this.state.errorInfo.componentStack}</pre>
                      </>
                    )}
                  </div>
                </details>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
