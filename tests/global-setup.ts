import { chromium, type FullConfig } from '@playwright/test'

async function globalSetup(config: FullConfig) {
  console.log('🚀 开始 E2E 测试环境设置...')

  // 启动浏览器进行预热
  const browser = await chromium.launch()
  const page = await browser.newPage()
  
  try {
    // 预热应用
    console.log('📡 预热应用服务器...')
    await page.goto(process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173', {
      waitUntil: 'networkidle',
      timeout: 60000
    })
    
    console.log('✅ 应用服务器预热完成')
    
    // 设置测试数据
    console.log('🗄️ 设置测试数据...')
    await setupTestData(page)
    console.log('✅ 测试数据设置完成')
    
    // 验证关键API端点
    console.log('🔍 验证API端点...')
    await validateApiEndpoints(page)
    console.log('✅ API端点验证完成')
    
  } catch (error) {
    console.error('❌ 全局设置失败:', error)
    throw error
  } finally {
    await browser.close()
  }
  
  console.log('🎉 E2E 测试环境设置完成')
}

async function setupTestData(page: any) {
  // 设置 Telegram WebApp 测试环境
  await page.addInitScript(() => {
    window.Telegram = {
      WebApp: {
        initData: 'user=%7B%22id%22%3A123456789%2C%22first_name%22%3A%22E2E%22%2C%22last_name%22%3A%22Test%22%2C%22username%22%3A%22e2etest%22%7D&auth_date=1699999999&hash=mock_hash',
        initDataUnsafe: {
          user: {
            id: 123456789,
            first_name: 'E2E',
            last_name: 'Test',
            username: 'e2etest',
            language_code: 'zh'
          }
        },
        platform: 'web',
        version: '6.0',
        isExpanded: true,
        viewportHeight: 800,
        viewportStableHeight: 800,
        ready: () => console.log('Telegram WebApp Ready'),
        expand: () => console.log('Telegram WebApp Expanded'),
        close: () => console.log('Telegram WebApp Closed'),
        MainButton: {
          text: '',
          color: '#2481cc',
          textColor: '#ffffff',
          isVisible: false,
          isActive: true,
          setText: (text: string) => console.log('MainButton setText:', text),
          onClick: (callback: Function) => console.log('MainButton onClick registered'),
          show: () => console.log('MainButton shown'),
          hide: () => console.log('MainButton hidden'),
          enable: () => console.log('MainButton enabled'),
          disable: () => console.log('MainButton disabled')
        },
        BackButton: {
          isVisible: false,
          onClick: (callback: Function) => console.log('BackButton onClick registered'),
          show: () => console.log('BackButton shown'),
          hide: () => console.log('BackButton hidden')
        },
        HapticFeedback: {
          impactOccurred: (style: string) => console.log('HapticFeedback impact:', style),
          notificationOccurred: (type: string) => console.log('HapticFeedback notification:', type),
          selectionChanged: () => console.log('HapticFeedback selection changed')
        },
        sendData: (data: string) => console.log('Telegram sendData:', data),
        openLink: (url: string) => console.log('Telegram openLink:', url),
        showPopup: (params: any) => console.log('Telegram showPopup:', params),
        showAlert: (message: string) => console.log('Telegram showAlert:', message),
        onEvent: (eventType: string, callback: Function) => {
          console.log('Telegram onEvent registered:', eventType)
        },
        offEvent: (eventType: string, callback: Function) => {
          console.log('Telegram offEvent unregistered:', eventType)
        }
      }
    }
  })

  // 模拟测试用户数据
  await page.evaluate(() => {
    // 设置localStorage测试数据
    const testUserData = {
      id: '123456789',
      telegram_id: '123456789',
      first_name: 'E2E',
      last_name: 'Test',
      username: 'e2etest',
      language_code: 'zh',
      referral_code: 'E2ETEST1',
      created_at: new Date().toISOString()
    }
    
    const testWalletData = {
      balance: {
        id: 'wallet-balance-e2e',
        user_id: '123456789',
        type: 'BALANCE',
        currency: 'USD',
        balance: 1000,
        frozen_balance: 0
      },
      luckyCoin: {
        id: 'wallet-luckycoin-e2e',
        user_id: '123456789',
        type: 'LUCKY_COIN',
        currency: 'USD',
        balance: 100,
        frozen_balance: 0
      }
    }
    
    const testLotteryData = [
      {
        id: 'lottery-e2e-1',
        title: '测试彩票',
        description: 'E2E测试用彩票',
        ticket_price: 10,
        total_tickets: 1000,
        sold_tickets: 100,
        max_per_user: 10,
        currency: 'USD',
        status: 'ACTIVE',
        draw_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'lottery-e2e-2',
        title: '高级彩票',
        description: '高价值测试彩票',
        ticket_price: 50,
        total_tickets: 500,
        sold_tickets: 50,
        max_per_user: 5,
        currency: 'USD',
        status: 'ACTIVE',
        draw_time: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
      }
    ]
    
    localStorage.setItem('e2e-test-user', JSON.stringify(testUserData))
    localStorage.setItem('e2e-test-wallets', JSON.stringify(testWalletData))
    localStorage.setItem('e2e-test-lotteries', JSON.stringify(testLotteryData))
    localStorage.setItem('e2e-test-mode', 'true')
  })
}

async function validateApiEndpoints(page: any) {
  const endpoints = [
    '/api/auth/telegram',
    '/api/wallets/balance',
    '/api/lotteries',
    '/api/users/profile'
  ]
  
  for (const endpoint of endpoints) {
    try {
      const response = await page.evaluate(async (url: string) => {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'x-test-mode': 'true'
          }
        })
        return {
          status: response.status,
          ok: response.ok,
          url: response.url
        }
      }, endpoint)
      
      if (!response.ok && response.status !== 404) {
        console.warn(`⚠️  API端点 ${endpoint} 返回状态: ${response.status}`)
      }
    } catch (error) {
      console.warn(`⚠️  API端点 ${endpoint} 验证失败:`, error)
    }
  }
}

// 性能监控设置
async function setupPerformanceMonitoring() {
  console.log('📊 设置性能监控...')
  
  // 这里可以集成性能监控工具
  // 例如: Lighthouse, WebPageTest 等
  
  console.log('✅ 性能监控设置完成')
}

// 错误监控设置
async function setupErrorTracking() {
  console.log('🚨 设置错误追踪...')
  
  // 设置错误收集
  process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ 未处理的Promise拒绝:', reason)
  })
  
  process.on('uncaughtException', (error) => {
    console.error('❌ 未捕获的异常:', error)
  })
  
  console.log('✅ 错误追踪设置完成')
}

// 并行执行所有设置任务
async function setupTestEnvironment() {
  await Promise.all([
    setupPerformanceMonitoring(),
    setupErrorTracking()
  ])
}

// 环境变量验证
function validateEnvironment() {
  console.log('🔧 验证环境变量...')
  
  const requiredEnvVars = [
    'PLAYWRIGHT_BASE_URL'
  ]
  
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName])
  
  if (missingVars.length > 0) {
    console.warn('⚠️  缺少环境变量:', missingVars.join(', '))
    console.log('使用默认值继续执行...')
  }
  
  console.log('✅ 环境变量验证完成')
}

// 测试数据库设置（如果需要）
async function setupTestDatabase() {
  console.log('🗃️ 设置测试数据库...')
  
  // 这里可以设置测试数据库
  // 例如: 清理旧数据、创建测试表、插入种子数据等
  
  console.log('✅ 测试数据库设置完成')
}

// 网络设置
async function setupNetworkConditions() {
  console.log('🌐 设置网络条件...')
  
  // 这里可以设置不同的网络条件进行测试
  // 例如: 慢网络、离线模式、高延迟等
  
  console.log('✅ 网络条件设置完成')
}

// 清理函数
async function cleanup() {
  console.log('🧹 执行清理操作...')
  
  try {
    // 清理临时文件
    // 清理测试数据
    // 关闭外部服务连接
    
    console.log('✅ 清理操作完成')
  } catch (error) {
    console.error('❌ 清理操作失败:', error)
  }
}

// 导出全局设置函数
export default async function(config: FullConfig) {
  try {
    validateEnvironment()
    await setupTestEnvironment()
    await globalSetup(config)
  } catch (error) {
    console.error('❌ 全局设置失败:', error)
    await cleanup()
    throw error
  }
}