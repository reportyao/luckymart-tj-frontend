import { chromium, type FullConfig } from '@playwright/test'

async function globalTeardown(config: FullConfig) {
  console.log('🧹 开始 E2E 测试环境清理...')

  const browser = await chromium.launch()
  const page = await browser.newPage()
  
  try {
    // 清理测试数据
    console.log('🗑️ 清理测试数据...')
    await cleanupTestData(page)
    console.log('✅ 测试数据清理完成')
    
    // 生成测试报告
    console.log('📊 生成测试报告...')
    await generateTestReports()
    console.log('✅ 测试报告生成完成')
    
    // 清理临时文件
    console.log('📁 清理临时文件...')
    await cleanupTempFiles()
    console.log('✅ 临时文件清理完成')
    
    // 收集性能数据
    console.log('📈 收集性能数据...')
    await collectPerformanceData()
    console.log('✅ 性能数据收集完成')
    
    // 发送测试通知
    console.log('📧 发送测试完成通知...')
    await sendTestNotifications()
    console.log('✅ 测试通知发送完成')
    
  } catch (error) {
    console.error('❌ 全局清理失败:', error)
  } finally {
    await browser.close()
  }
  
  console.log('🎉 E2E 测试环境清理完成')
}

async function cleanupTestData(page: any) {
  await page.goto(process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173')
  
  // 清理localStorage中的测试数据
  await page.evaluate(() => {
    const testKeys = [
      'e2e-test-user',
      'e2e-test-wallets',
      'e2e-test-lotteries',
      'e2e-test-mode'
    ]
    
    testKeys.forEach(key => {
      localStorage.removeItem(key)
    })
    
    // 清理sessionStorage
    sessionStorage.clear()
    
    console.log('本地存储数据已清理')
  })
  
  // 清理IndexedDB（如果使用）
  await page.evaluate(async () => {
    try {
      const databases = await indexedDB.databases?.() || []
      for (const db of databases) {
        if (db.name?.includes('test') || db.name?.includes('e2e')) {
          indexedDB.deleteDatabase(db.name)
        }
      }
      console.log('IndexedDB测试数据已清理')
    } catch (error) {
      console.warn('IndexedDB清理失败:', error)
    }
  })
  
  // 清理Service Worker缓存
  await page.evaluate(async () => {
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations()
        for (const registration of registrations) {
          await registration.unregister()
        }
        console.log('Service Worker已清理')
      }
      
      if ('caches' in window) {
        const cacheNames = await caches.keys()
        for (const cacheName of cacheNames) {
          await caches.delete(cacheName)
        }
        console.log('缓存已清理')
      }
    } catch (error) {
      console.warn('Service Worker/缓存清理失败:', error)
    }
  })
}

async function generateTestReports() {
  const fs = (await import('fs/promises')).default
  const path = (await import('path')).default
  
  try {
    // 生成测试摘要报告
    const reportData = {
      timestamp: new Date().toISOString(),
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
      },
      testResults: {
        // 这里可以从测试结果文件中读取数据
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        skippedTests: 0,
        duration: 0
      },
      coverage: {
        // 这里可以从覆盖率报告中读取数据
        lines: 0,
        functions: 0,
        branches: 0,
        statements: 0
      },
      performance: {
        averageLoadTime: 0,
        averageInteractionTime: 0,
        memoryUsage: process.memoryUsage()
      }
    }
    
    // 尝试读取playwright测试结果
    try {
      const playwrightResultsPath = path.join(process.cwd(), 'playwright-report', 'results.json')
      const playwrightResults = await fs.readFile(playwrightResultsPath, 'utf8')
      const results = JSON.parse(playwrightResults)
      
      reportData.testResults = {
        totalTests: results.specs?.length || 0,
        passedTests: results.specs?.filter((spec: any) => spec.ok).length || 0,
        failedTests: results.specs?.filter((spec: any) => !spec.ok).length || 0,
        skippedTests: 0,
        duration: results.duration || 0
      }
    } catch (error) {
      console.warn('无法读取Playwright测试结果:', error.message)
    }
    
    // 保存测试报告
    const reportsDir = path.join(process.cwd(), 'test-reports')
    await fs.mkdir(reportsDir, { recursive: true })
    
    const reportPath = path.join(reportsDir, `e2e-summary-${Date.now()}.json`)
    await fs.writeFile(reportPath, JSON.stringify(reportData, null, 2))
    
    console.log(`测试报告已保存到: ${reportPath}`)
    
    // 生成HTML报告（简单版）
    const htmlReport = generateHtmlReport(reportData)
    const htmlReportPath = path.join(reportsDir, `e2e-report-${Date.now()}.html`)
    await fs.writeFile(htmlReportPath, htmlReport)
    
    console.log(`HTML测试报告已保存到: ${htmlReportPath}`)
    
  } catch (error) {
    console.error('生成测试报告失败:', error)
  }
}

function generateHtmlReport(reportData: any) {
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TezBarakatTJ E2E 测试报告</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            padding: 30px;
        }
        h1 { color: #333; border-bottom: 3px solid #007bff; padding-bottom: 10px; }
        h2 { color: #555; margin-top: 30px; }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin: 20px 0;
        }
        .stat-card {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #007bff;
        }
        .stat-number { font-size: 2em; font-weight: bold; color: #007bff; }
        .stat-label { color: #666; margin-top: 5px; }
        .success { border-left-color: #28a745; }
        .success .stat-number { color: #28a745; }
        .warning { border-left-color: #ffc107; }
        .warning .stat-number { color: #ffc107; }
        .error { border-left-color: #dc3545; }
        .error .stat-number { color: #dc3545; }
        .info-section { background: #e9ecef; padding: 15px; border-radius: 5px; margin: 10px 0; }
        .timestamp { color: #666; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎯 TezBarakatTJ E2E 测试报告</h1>
        <p class="timestamp">生成时间: ${new Date(reportData.timestamp).toLocaleString('zh-CN')}</p>
        
        <h2>📊 测试结果统计</h2>
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-number">${reportData.testResults.totalTests}</div>
                <div class="stat-label">总测试数</div>
            </div>
            <div class="stat-card success">
                <div class="stat-number">${reportData.testResults.passedTests}</div>
                <div class="stat-label">通过测试</div>
            </div>
            <div class="stat-card error">
                <div class="stat-number">${reportData.testResults.failedTests}</div>
                <div class="stat-label">失败测试</div>
            </div>
            <div class="stat-card warning">
                <div class="stat-number">${Math.round(reportData.testResults.duration / 1000)}s</div>
                <div class="stat-label">执行时间</div>
            </div>
        </div>
        
        <h2>🔧 运行环境</h2>
        <div class="info-section">
            <p><strong>Node.js版本:</strong> ${reportData.environment.nodeVersion}</p>
            <p><strong>操作系统:</strong> ${reportData.environment.platform}</p>
            <p><strong>架构:</strong> ${reportData.environment.arch}</p>
        </div>
        
        <h2>📈 性能指标</h2>
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-number">${reportData.performance.averageLoadTime}ms</div>
                <div class="stat-label">平均加载时间</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${reportData.performance.averageInteractionTime}ms</div>
                <div class="stat-label">平均交互时间</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${Math.round(reportData.performance.memoryUsage.heapUsed / 1024 / 1024)}MB</div>
                <div class="stat-label">内存使用</div>
            </div>
        </div>
        
        <h2>📝 测试覆盖率</h2>
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-number">${reportData.coverage.lines}%</div>
                <div class="stat-label">行覆盖率</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${reportData.coverage.functions}%</div>
                <div class="stat-label">函数覆盖率</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${reportData.coverage.branches}%</div>
                <div class="stat-label">分支覆盖率</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${reportData.coverage.statements}%</div>
                <div class="stat-label">语句覆盖率</div>
            </div>
        </div>
    </div>
</body>
</html>
  `
}

async function cleanupTempFiles() {
  const fs = (await import('fs/promises')).default
  const path = (await import('path')).default
  
  try {
    // 清理临时文件和目录
    const tempDirs = [
      'test-results',
      '.playwright-cache',
      'tmp'
    ]
    
    for (const dir of tempDirs) {
      const dirPath = path.join(process.cwd(), dir)
      try {
        await fs.rmdir(dirPath, { recursive: true })
        console.log(`已清理临时目录: ${dir}`)
      } catch (error) {
        // 目录可能不存在，忽略错误
      }
    }
    
    // 清理旧的测试报告文件（保留最近10个）
    const reportsDir = path.join(process.cwd(), 'test-reports')
    try {
      const files = await fs.readdir(reportsDir)
      const reportFiles = files
        .filter((file: string) => file.startsWith('e2e-') && file.endsWith('.json'))
        .sort()
        .reverse()
      
      // 删除超过10个的旧报告
      if (reportFiles.length > 10) {
        const filesToDelete = reportFiles.slice(10)
        for (const file of filesToDelete) {
          await fs.unlink(path.join(reportsDir, file))
          console.log(`已删除旧报告: ${file}`)
        }
      }
    } catch (error) {
      // 目录可能不存在，忽略错误
    }
    
  } catch (error) {
    console.error('清理临时文件失败:', error)
  }
}

async function collectPerformanceData() {
  try {
    // 收集性能数据并保存到文件
    const performanceData = {
      timestamp: new Date().toISOString(),
      nodeMemoryUsage: process.memoryUsage(),
      nodeResourceUsage: process.resourceUsage?.() || null,
      platform: {
        platform: process.platform,
        arch: process.arch,
        version: process.version,
        uptime: process.uptime()
      }
    }
    
    const fs = (await import('fs/promises')).default
    const path = (await import('path')).default
    
    const perfDir = path.join(process.cwd(), 'performance-data')
    await fs.mkdir(perfDir, { recursive: true })
    
    const perfFile = path.join(perfDir, `perf-${Date.now()}.json`)
    await fs.writeFile(perfFile, JSON.stringify(performanceData, null, 2))
    
    console.log(`性能数据已保存到: ${perfFile}`)
    
  } catch (error) {
    console.error('收集性能数据失败:', error)
  }
}

async function sendTestNotifications() {
  try {
    // 这里可以集成通知服务
    // 例如: Slack, Discord, 邮件, 企业微信等
    
    const testSummary = {
      project: 'TezBarakatTJ',
      environment: process.env.NODE_ENV || 'test',
      timestamp: new Date().toISOString(),
      status: 'completed' // 可以是 'success', 'failed', 'completed'
    }
    
    // 示例: 发送到控制台（实际可以替换为真实的通知服务）
    console.log('📧 测试完成通知:', JSON.stringify(testSummary, null, 2))
    
    // 示例: Slack通知（需要配置Webhook URL）
    if (process.env.SLACK_WEBHOOK_URL) {
      await sendSlackNotification(testSummary)
    }
    
    // 示例: 邮件通知（需要配置SMTP）
    if (process.env.SMTP_HOST) {
      await sendEmailNotification(testSummary)
    }
    
  } catch (error) {
    console.error('发送测试通知失败:', error)
  }
}

async function sendSlackNotification(testSummary: any) {
  try {
    const fetch = (await import('node-fetch')).default
    
    const message = {
      text: `🎯 TezBarakatTJ E2E测试完成`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '🎯 TezBarakatTJ E2E测试报告'
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*项目:* ${testSummary.project}`
            },
            {
              type: 'mrkdwn',
              text: `*环境:* ${testSummary.environment}`
            },
            {
              type: 'mrkdwn',
              text: `*状态:* ${testSummary.status}`
            },
            {
              type: 'mrkdwn',
              text: `*时间:* ${new Date(testSummary.timestamp).toLocaleString('zh-CN')}`
            }
          ]
        }
      ]
    }
    
    await fetch(process.env.SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    })
    
    console.log('✅ Slack通知发送成功')
  } catch (error) {
    console.error('❌ Slack通知发送失败:', error)
  }
}

async function sendEmailNotification(testSummary: any) {
  // 这里可以实现邮件通知逻辑
  console.log('📧 邮件通知功能待实现')
}

// 错误处理
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ 全局清理过程中的未处理Promise拒绝:', reason)
})

process.on('uncaughtException', (error) => {
  console.error('❌ 全局清理过程中的未捕获异常:', error)
})

// 导出全局清理函数
export default async function(config: FullConfig) {
  try {
    await globalTeardown(config)
  } catch (error) {
    console.error('❌ 全局清理失败:', error)
    // 即使清理失败也不抛出错误，避免影响测试结果
  }
}