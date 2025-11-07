// 简化的监控服务实现
export interface PerformanceMetric {
  name: string
  value: number
  timestamp: Date
  metadata?: Record<string, any>
}

export interface ErrorLog {
  level: 'info' | 'warn' | 'error' | 'fatal'
  message: string
  stack?: string
  metadata?: Record<string, any>
  timestamp: Date
}

export class MonitoringService {
  private metrics: PerformanceMetric[] = []
  private errors: ErrorLog[] = []

  // 记录性能指标
  recordMetric(name: string, value: number, metadata?: Record<string, any>) {
    this.metrics.push({
      name,
      value,
      timestamp: new Date(),
      metadata
    })
  }

  // 记录错误
  recordError(level: ErrorLog['level'], message: string, error?: Error, metadata?: Record<string, any>) {
    this.errors.push({
      level,
      message,
      stack: error?.stack,
      timestamp: new Date(),
      metadata
    })
  }

  // 获取指标数据
  getMetrics(name?: string, limit = 100): PerformanceMetric[] {
    const filtered = name ? this.metrics.filter(m => m.name === name) : this.metrics
    return filtered.slice(-limit)
  }

  // 获取错误日志
  getErrors(level?: ErrorLog['level'], limit = 100): ErrorLog[] {
    const filtered = level ? this.errors.filter(e => e.level === level) : this.errors
    return filtered.slice(-limit)
  }

  // 清理旧数据
  cleanup(retentionHours = 24) {
    const cutoff = new Date(Date.now() - retentionHours * 60 * 60 * 1000)
    this.metrics = this.metrics.filter(m => m.timestamp > cutoff)
    this.errors = this.errors.filter(e => e.timestamp > cutoff)
  }

  // 获取系统健康状态
  getSystemHealth() {
    const recentErrors = this.errors.filter(e => 
      Date.now() - e.timestamp.getTime() < 5 * 60 * 1000 // 最近5分钟
    )
    
    const errorLevel = recentErrors.length > 10 ? 'unhealthy' : 
                      recentErrors.length > 5 ? 'degraded' : 'healthy'

    return {
      status: errorLevel,
      errorCount: recentErrors.length,
      lastUpdate: new Date()
    }
  }
}

// 全局实例
export const monitoringService = new MonitoringService()

// 自动清理定时器
setInterval(() => {
  monitoringService.cleanup()
}, 60 * 60 * 1000) // 每小时清理一次