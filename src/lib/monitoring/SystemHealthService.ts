import { createClient } from '@supabase/supabase-js'

interface HealthCheckResult {
  service: string
  status: 'healthy' | 'degraded' | 'unhealthy'
  responseTime: number
  details?: string
  timestamp: Date
}

interface SystemHealthStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy'
  services: HealthCheckResult[]
  lastChecked: Date
}

class SystemHealthService {
  private supabase
  private healthChecks: Map<string, HealthCheckResult> = new Map()
  private checkInterval?: NodeJS.Timeout
  
  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }

  // 启动健康检查
  public startHealthChecks(intervalMs: number = 30000) {
    this.performHealthChecks()
    
    this.checkInterval = setInterval(() => {
      this.performHealthChecks()
    }, intervalMs)
    
    console.log('🏥 系统健康检查已启动')
  }

  // 停止健康检查
  public stopHealthChecks() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = undefined
      console.log('🏥 系统健康检查已停止')
    }
  }

  // 执行全面健康检查
  private async performHealthChecks() {
    const checks = await Promise.allSettled([
      this.checkDatabase(),
      this.checkAPI(),
      this.checkTelegramBot(),
      this.checkStorage(),
      this.checkEdgeFunctions()
    ])

    checks.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        this.healthChecks.set(result.value.service, result.value)
      } else {
        // 处理检查失败的情况
        const services = ['database', 'api', 'telegram', 'storage', 'edge-functions']
        this.healthChecks.set(services[index], {
          service: services[index],
          status: 'unhealthy',
          responseTime: -1,
          details: `健康检查失败: ${result.reason}`,
          timestamp: new Date()
        })
      }
    })

    // 记录健康检查结果到数据库
    await this.saveHealthCheckResults()
  }

  // 检查数据库连接
  private async checkDatabase(): Promise<HealthCheckResult> {
    const startTime = Date.now()
    
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('id')
        .limit(1)

      const responseTime = Date.now() - startTime

      if (error) {
        return {
          service: 'database',
          status: 'unhealthy',
          responseTime,
          details: `数据库错误: ${error.message}`,
          timestamp: new Date()
        }
      }

      const status = responseTime < 100 ? 'healthy' : 
                    responseTime < 500 ? 'degraded' : 'unhealthy'

      return {
        service: 'database',
        status,
        responseTime,
        details: `查询响应时间: ${responseTime}ms`,
        timestamp: new Date()
      }
    } catch (error) {
      return {
        service: 'database',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        details: `数据库连接失败: ${(error as Error).message}`,
        timestamp: new Date()
      }
    }
  }

  // 检查API服务
  private async checkAPI(): Promise<HealthCheckResult> {
    const startTime = Date.now()
    
    try {
      const response = await fetch('/api/health', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      })

      const responseTime = Date.now() - startTime

      if (!response.ok) {
        return {
          service: 'api',
          status: 'unhealthy',
          responseTime,
          details: `API错误: ${response.status} ${response.statusText}`,
          timestamp: new Date()
        }
      }

      const status = responseTime < 200 ? 'healthy' : 
                    responseTime < 1000 ? 'degraded' : 'unhealthy'

      return {
        service: 'api',
        status,
        responseTime,
        details: `API响应时间: ${responseTime}ms`,
        timestamp: new Date()
      }
    } catch (error) {
      return {
        service: 'api',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        details: `API连接失败: ${(error as Error).message}`,
        timestamp: new Date()
      }
    }
  }

  // 检查Telegram Bot
  private async checkTelegramBot(): Promise<HealthCheckResult> {
    const startTime = Date.now()
    
    try {
      // 检查Bot webhook状态
      const { data, error } = await this.supabase.functions.invoke('telegram-bot-manager', {
        body: { action: 'check_status' }
      })

      const responseTime = Date.now() - startTime

      if (error) {
        return {
          service: 'telegram',
          status: 'unhealthy',
          responseTime,
          details: `Telegram Bot错误: ${error.message}`,
          timestamp: new Date()
        }
      }

      const status = data?.status === 'active' ? 'healthy' : 'degraded'

      return {
        service: 'telegram',
        status,
        responseTime,
        details: `Bot状态: ${data?.status || 'unknown'}`,
        timestamp: new Date()
      }
    } catch (error) {
      return {
        service: 'telegram',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        details: `Telegram检查失败: ${(error as Error).message}`,
        timestamp: new Date()
      }
    }
  }

  // 检查存储服务
  private async checkStorage(): Promise<HealthCheckResult> {
    const startTime = Date.now()
    
    try {
      const { data, error } = await this.supabase.storage
        .from('test-bucket')
        .list('', { limit: 1 })

      const responseTime = Date.now() - startTime

      if (error && error.message !== 'The resource was not found') {
        return {
          service: 'storage',
          status: 'unhealthy',
          responseTime,
          details: `存储服务错误: ${error.message}`,
          timestamp: new Date()
        }
      }

      const status = responseTime < 300 ? 'healthy' : 
                    responseTime < 1000 ? 'degraded' : 'unhealthy'

      return {
        service: 'storage',
        status,
        responseTime,
        details: `存储服务响应时间: ${responseTime}ms`,
        timestamp: new Date()
      }
    } catch (error) {
      return {
        service: 'storage',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        details: `存储服务检查失败: ${(error as Error).message}`,
        timestamp: new Date()
      }
    }
  }

  // 检查Edge Functions
  private async checkEdgeFunctions(): Promise<HealthCheckResult> {
    const startTime = Date.now()
    
    try {
      // 测试主要的Edge Function
      const { data, error } = await this.supabase.functions.invoke('auth-telegram', {
        body: { test: true }
      })

      const responseTime = Date.now() - startTime

      if (error) {
        return {
          service: 'edge-functions',
          status: 'unhealthy',
          responseTime,
          details: `Edge Functions错误: ${error.message}`,
          timestamp: new Date()
        }
      }

      const status = responseTime < 500 ? 'healthy' : 
                    responseTime < 2000 ? 'degraded' : 'unhealthy'

      return {
        service: 'edge-functions',
        status,
        responseTime,
        details: `Edge Functions响应时间: ${responseTime}ms`,
        timestamp: new Date()
      }
    } catch (error) {
      return {
        service: 'edge-functions',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        details: `Edge Functions检查失败: ${(error as Error).message}`,
        timestamp: new Date()
      }
    }
  }

  // 保存健康检查结果到数据库
  private async saveHealthCheckResults() {
    try {
      const results = Array.from(this.healthChecks.values()).map(result => ({
        service_name: result.service,
        check_type: 'health_check',
        status: result.status,
        response_time_ms: result.responseTime,
        error_message: result.status !== 'healthy' ? result.details : null,
        metadata: {
          timestamp: result.timestamp.toISOString(),
          details: result.details
        },
        created_at: new Date().toISOString()
      }))

      const { error } = await this.supabase
        .from('system_health_checks')
        .insert(results)

      if (error) {
        console.error('保存健康检查结果失败:', error)
      }
    } catch (error) {
      console.error('保存健康检查结果时发生异常:', error)
    }
  }

  // 获取当前系统状态
  public getSystemHealth(): SystemHealthStatus {
    const services = Array.from(this.healthChecks.values())
    
    // 计算整体状态
    const hasUnhealthy = services.some(s => s.status === 'unhealthy')
    const hasDegraded = services.some(s => s.status === 'degraded')
    
    const overall = hasUnhealthy ? 'unhealthy' : 
                   hasDegraded ? 'degraded' : 'healthy'

    return {
      overall,
      services,
      lastChecked: new Date()
    }
  }

  // 获取特定服务状态
  public getServiceHealth(serviceName: string): HealthCheckResult | null {
    return this.healthChecks.get(serviceName) || null
  }

  // 检查是否有告警需要发送
  public async checkAlerts() {
    const systemHealth = this.getSystemHealth()
    
    // 检查是否有需要告警的情况
    const criticalServices = systemHealth.services.filter(s => s.status === 'unhealthy')
    const degradedServices = systemHealth.services.filter(s => s.status === 'degraded')
    
    if (criticalServices.length > 0) {
      await this.createAlert('critical', '系统服务异常', 
        `以下服务处于异常状态: ${criticalServices.map(s => s.service).join(', ')}`)
    }
    
    if (degradedServices.length > 0) {
      await this.createAlert('high', '系统性能降级', 
        `以下服务性能降级: ${degradedServices.map(s => s.service).join(', ')}`)
    }
  }

  // 创建告警
  private async createAlert(severity: string, title: string, description: string) {
    try {
      const { error } = await this.supabase
        .from('monitoring_alerts')
        .insert({
          alert_type: 'system_health',
          severity,
          title,
          description,
          conditions: { health_check: true },
          created_at: new Date().toISOString()
        })

      if (error) {
        console.error('创建告警失败:', error)
      } else {
        console.log(`📢 已创建${severity}级别告警: ${title}`)
      }
    } catch (error) {
      console.error('创建告警时发生异常:', error)
    }
  }

  // 获取健康检查历史
  public async getHealthHistory(hours: number = 24) {
    try {
      const since = new Date(Date.now() - hours * 60 * 60 * 1000)
      
      const { data, error } = await this.supabase
        .from('system_health_checks')
        .select('*')
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: false })

      if (error) {
        console.error('获取健康检查历史失败:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('获取健康检查历史时发生异常:', error)
      return []
    }
  }

  // 生成健康报告
  public async generateHealthReport(): Promise<string> {
    const systemHealth = this.getSystemHealth()
    const history = await this.getHealthHistory(24)
    
    const report = {
      timestamp: new Date().toISOString(),
      overall_status: systemHealth.overall,
      services: systemHealth.services.map(s => ({
        name: s.service,
        status: s.status,
        response_time: s.responseTime,
        last_checked: s.timestamp
      })),
      statistics: {
        total_checks_24h: history.length,
        healthy_percentage: history.filter(h => h.status === 'healthy').length / history.length * 100,
        average_response_time: history.reduce((sum, h) => sum + (h.response_time_ms || 0), 0) / history.length
      }
    }

    return JSON.stringify(report, null, 2)
  }
}

// 创建全局健康检查实例
export const systemHealthService = new SystemHealthService()

// 导出类型和服务
export type { HealthCheckResult, SystemHealthStatus }
export { SystemHealthService }