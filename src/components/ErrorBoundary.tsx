import React from 'react';

const serializeError = (error: any) => {
  if (error instanceof Error) {
    return error.message + '\n' + error.stack;
  }
  return JSON.stringify(error, null, 2);
};

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: any; errorInfo: any }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: any) {
    // 更新 state，使下一次渲染显示降级后的 UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // 捕获错误信息
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // 特殊处理 DOM 操作错误
    if (error.message.includes('removeChild') || 
        error.message.includes('Node') ||
        error.name === 'NotFoundError') {
      console.warn('DOM manipulation error detected, attempting to recover...');
      
      // 延迟恢复，让DOM稳定
      setTimeout(() => {
        this.setState({ hasError: false, error: null, errorInfo: null });
      }, 1000);
      return;
    }

    this.setState({
      error,
      errorInfo
    });
  }

  handleReload = () => {
    // 完全重新加载页面
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      // 检查是否是DOM错误，如果是则显示简化的错误页面
      const isDOMError = this.state.error?.message?.includes('removeChild') || 
                        this.state.error?.message?.includes('Node') ||
                        this.state.error?.name === 'NotFoundError';

      if (isDOMError) {
        return (
          <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full text-center">
              <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.996-.833-2.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">页面正在恢复</h2>
              <p className="text-gray-600 mb-6 text-sm">
                检测到页面渲染问题，正在自动修复...
              </p>
              <button
                onClick={this.handleReset}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
              >
                重试
              </button>
            </div>
          </div>
        );
      }

      // 其他错误显示详细错误信息
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl w-full">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.996-.833-2.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">出现了一些问题</h2>
              <p className="text-gray-600">应用程序遇到了一个错误</p>
            </div>
            
            <div className="space-y-4">
              <button
                onClick={this.handleReload}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                重新加载页面
              </button>
              <button
                onClick={this.handleReset}
                className="w-full bg-gray-200 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-300 transition-colors"
              >
                重试当前页面
              </button>
            </div>

            <details className="mt-6">
              <summary className="text-sm text-gray-600 cursor-pointer hover:text-gray-800">
                查看错误详情
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
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}