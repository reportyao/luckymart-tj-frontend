import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Database,
  Globe,
  Monitor,
  RefreshCw,
  TrendingUp,
  Users,
  Zap,
  Bug,
  Shield,
  HardDrive,
  Cpu,
  MemoryStick,
  Network,
  Eye
} from 'lucide-react'

interface ErrorData {
  id: string
  level: 'info' | 'warn' | 'error' | 'fatal'
  message: string
  component: string
  count: number
  timestamp: string
}

interface PerformanceMetric {
  name: string
  current: number
  previous: number
  unit: string
  threshold: number
  status: 'good' | 'warning' | 'critical'
}

interface SystemHealth {
  database: 'healthy' | 'degraded' | 'unhealthy'
  api: 'healthy' | 'degraded' | 'unhealthy'
  frontend: 'healthy' | 'degraded' | 'unhealthy'
  telegram: 'healthy' | 'degraded' | 'unhealthy'
}

export function MonitoringDashboard() {
  const [activeTab, setActiveTab] = useState('overview')
  const [isLoading, setIsLoading] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [autoRefresh, setAutoRefresh] = useState(true)

  // 性能数据状态
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetric[]>([])
  const [errorData, setErrorData] = useState<ErrorData[]>([])
  const [systemHealth, setSystemHealth] = useState<SystemHealth>({
    database: 'healthy',
    api: 'healthy',
    frontend: 'healthy',
    telegram: 'healthy'
  })

  // 获取监控数据
  const fetchMonitoringData = async () => {
    setIsLoading(true)
    try {
      // 模拟API调用
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // 模拟性能指标数据
      setPerformanceMetrics([
        {
          name: '页面加载时间',
          current: 1.2,
          previous: 1.5,
          unit: 's',
          threshold: 3.0,
          status: 'good'
        },
        {
          name: 'API响应时间',
          current: 250,
          previous: 200,
          unit: 'ms',
          threshold: 1000,
          status: 'good'
        },
        {
          name: '数据库查询时间',
          current: 45,
          previous: 30,
          unit: 'ms',
          threshold: 100,
          status: 'warning'
        },
        {
          name: '错误率',
          current: 0.5,
          previous: 0.3,
          unit: '%',
          threshold: 5.0,
          status: 'good'
        },
        {
          name: '可用性',
          current: 99.9,
          previous: 99.8,
          unit: '%',
          threshold: 99.0,
          status: 'good'
        },
        {
          name: '内存使用率',
          current: 68,
          previous: 65,
          unit: '%',
          threshold: 85,
          status: 'good'
        }
      ])

      // 模拟错误数据
      setErrorData([
        {
          id: '1',
          level: 'error',
          message: 'API调用超时',
          component: 'lottery-purchase',
          count: 3,
          timestamp: '2024-01-15 10:30:00'
        },
        {
          id: '2',
          level: 'warn',
          message: '钱包余额不足警告',
          component: 'wallet-service',
          count: 15,
          timestamp: '2024-01-15 10:25:00'
        },
        {
          id: '3',
          level: 'error',
          message: 'Telegram Bot连接失败',
          component: 'telegram-webhook',
          count: 1,
          timestamp: '2024-01-15 10:20:00'
        },
        {
          id: '4',
          level: 'info',
          message: '用户登录成功',
          component: 'auth-service',
          count: 156,
          timestamp: '2024-01-15 10:15:00'
        }
      ])

      // 模拟系统健康状态
      setSystemHealth({
        database: 'healthy',
        api: 'healthy',
        frontend: 'healthy',
        telegram: 'degraded'
      })

      setLastUpdate(new Date())
    } catch (error) {
      console.error('获取监控数据失败:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // 自动刷新
  useEffect(() => {
    if (autoRefresh) {
      fetchMonitoringData()
      const interval = setInterval(fetchMonitoringData, 30000) // 30秒刷新一次
      return () => clearInterval(interval)
    }
  }, [autoRefresh])

  // 手动刷新
  const handleRefresh = () => {
    fetchMonitoringData()
  }

  // 获取状态颜色
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'good':
        return 'text-green-600'
      case 'degraded':
      case 'warning':
        return 'text-yellow-600'
      case 'unhealthy':
      case 'critical':
        return 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }

  // 获取状态图标
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'good':
        return <CheckCircle className="w-4 h-4 text-green-600" />
      case 'degraded':
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-600" />
      case 'unhealthy':
      case 'critical':
        return <AlertTriangle className="w-4 h-4 text-red-600" />
      default:
        return <Clock className="w-4 h-4 text-gray-600" />
    }
  }

  // 计算变化百分比
  const calculateChange = (current: number, previous: number) => {
    return ((current - previous) / previous * 100).toFixed(1)
  }

  return (
    <div className="space-y-6 p-6 bg-gray-50 min-h-screen">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">系统监控仪表板</h1>
          <p className="text-sm text-gray-600">
            最后更新: {lastUpdate.toLocaleString('zh-CN')}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={autoRefresh ? 'bg-green-50 border-green-200' : ''}
          >
            <Eye className="w-4 h-4 mr-2" />
            {autoRefresh ? '自动刷新开启' : '自动刷新关闭'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
        </div>
      </div>

      {/* 系统健康状态概览 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {Object.entries(systemHealth).map(([service, status]) => (
          <Card key={service}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    {service === 'database' && '数据库'}
                    {service === 'api' && 'API服务'}
                    {service === 'frontend' && '前端应用'}
                    {service === 'telegram' && 'Telegram Bot'}
                  </p>
                  <div className="flex items-center mt-1">
                    {getStatusIcon(status)}
                    <span className={`ml-2 text-sm font-medium ${getStatusColor(status)}`}>
                      {status === 'healthy' && '正常'}
                      {status === 'degraded' && '降级'}
                      {status === 'unhealthy' && '故障'}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  {service === 'database' && <Database className="w-8 h-8 text-blue-500" />}
                  {service === 'api' && <Globe className="w-8 h-8 text-green-500" />}
                  {service === 'frontend' && <Monitor className="w-8 h-8 text-purple-500" />}
                  {service === 'telegram' && <Zap className="w-8 h-8 text-yellow-500" />}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">概览</TabsTrigger>
          <TabsTrigger value="errors">错误日志</TabsTrigger>
          <TabsTrigger value="resources">资源监控</TabsTrigger>
        </TabsList>

        {/* 概览标签页 */}
        <TabsContent value="overview" className="space-y-6">
          {/* 关键性能指标 */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {performanceMetrics.map((metric) => (
              <Card key={metric.name}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-gray-600">{metric.name}</h3>
                    {getStatusIcon(metric.status)}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-baseline space-x-2">
                      <span className="text-2xl font-bold text-gray-900">
                        {metric.current}
                      </span>
                      <span className="text-sm text-gray-500">{metric.unit}</span>
                    </div>
                    <div className="flex items-center text-sm">
                      <TrendingUp className="w-3 h-3 mr-1 text-green-500" />
                      <span className={
                        parseFloat(calculateChange(metric.current, metric.previous)) > 0
                          ? 'text-green-600' 
                          : 'text-red-600'
                      }>
                        {calculateChange(metric.current, metric.previous)}%
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* 最近错误 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Bug className="w-5 h-5 mr-2" />
                最近错误
              </CardTitle>
              <CardDescription>最近发生的系统错误和警告</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {errorData.slice(0, 5).map((error) => (
                  <div key={error.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Badge variant={
                        error.level === 'error' ? 'destructive' :
                        error.level === 'warn' ? 'secondary' : 'default'
                      }>
                        {error.level}
                      </Badge>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{error.message}</p>
                        <p className="text-xs text-gray-500">{error.component}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">x{error.count}</p>
                      <p className="text-xs text-gray-500">{error.timestamp}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 错误标签页 */}
        <TabsContent value="errors" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>错误详情</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {errorData.map((error) => (
                  <div key={error.id} className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <Badge variant={
                          error.level === 'fatal' ? 'destructive' :
                          error.level === 'error' ? 'destructive' :
                          error.level === 'warn' ? 'secondary' : 'default'
                        }>
                          {error.level.toUpperCase()}
                        </Badge>
                        <span className="font-medium text-gray-900">{error.message}</span>
                      </div>
                      <span className="text-sm text-gray-500">{error.timestamp}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-gray-600">
                      <span>组件: {error.component}</span>
                      <span>出现次数: {error.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 资源使用标签页 */}
        <TabsContent value="resources" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-sm">
                  <Cpu className="w-4 h-4 mr-2" />
                  CPU使用率
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">45%</div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div className="bg-blue-600 h-2 rounded-full" style={{width: '45%'}}></div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-sm">
                  <MemoryStick className="w-4 h-4 mr-2" />
                  内存使用
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">68%</div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div className="bg-green-600 h-2 rounded-full" style={{width: '68%'}}></div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-sm">
                  <HardDrive className="w-4 h-4 mr-2" />
                  磁盘使用
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">32%</div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div className="bg-yellow-600 h-2 rounded-full" style={{width: '32%'}}></div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-sm">
                  <Network className="w-4 h-4 mr-2" />
                  网络流量
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">2.3GB</div>
                <p className="text-xs text-gray-600 mt-1">今日流量</p>
              </CardContent>
            </Card>
          </div>

          {/* 实时统计 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="w-5 h-5 mr-2" />
                  在线用户
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">1,234</div>
                <p className="text-sm text-gray-600">当前在线</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Activity className="w-5 h-5 mr-2" />
                  今日活跃
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">5,678</div>
                <p className="text-sm text-gray-600">日活跃用户</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <TrendingUp className="w-5 h-5 mr-2" />
                  转化率
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-purple-600">12.3%</div>
                <p className="text-sm text-gray-600">彩票购买转化率</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}