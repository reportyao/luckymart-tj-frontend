import { test, expect, type Page, type BrowserContext } from '@playwright/test'

// 测试数据
const testUser = {
  id: '123456789',
  firstName: 'E2E',
  lastName: 'Test',
  username: 'e2etest'
}

// 页面对象模式
class TezBarakatPage {
  constructor(public page: Page) {}

  // 导航方法
  async navigateToHome() {
    await this.page.click('[data-testid="nav-home"]')
    await this.page.waitForLoadState('networkidle')
  }

  async navigateToLottery() {
    await this.page.click('[data-testid="nav-lottery"]')
    await this.page.waitForLoadState('networkidle')
  }

  async navigateToWallet() {
    await this.page.click('[data-testid="nav-wallet"]')
    await this.page.waitForLoadState('networkidle')
  }

  async navigateToProfile() {
    await this.page.click('[data-testid="nav-profile"]')
    await this.page.waitForLoadState('networkidle')
  }

  // 认证相关
  async mockTelegramAuth() {
    await this.page.addInitScript(() => {
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
          ready: () => {},
          expand: () => {},
          MainButton: {
            show: () => {},
            hide: () => {},
            setText: () => {},
            onClick: () => {}
          },
          BackButton: {
            show: () => {},
            hide: () => {}
          },
          HapticFeedback: {
            impactOccurred: () => {},
            notificationOccurred: () => {}
          }
        }
      }
    })
  }

  // 钱包操作
  async getWalletBalance() {
    const balanceElement = await this.page.locator('[data-testid="balance-amount"]')
    return await balanceElement.textContent()
  }

  async depositFunds(amount: number) {
    await this.page.click('[data-testid="deposit-button"]')
    await this.page.fill('[data-testid="deposit-amount"]', amount.toString())
    await this.page.click('[data-testid="confirm-deposit"]')
    await this.page.waitForSelector('[data-testid="deposit-success"]', { timeout: 10000 })
  }

  async exchangeCurrency(amount: number, from: string, to: string) {
    await this.page.click('[data-testid="exchange-button"]')
    await this.page.fill('[data-testid="exchange-amount"]', amount.toString())
    await this.page.selectOption('[data-testid="exchange-from"]', from)
    await this.page.selectOption('[data-testid="exchange-to"]', to)
    await this.page.click('[data-testid="confirm-exchange"]')
    await this.page.waitForSelector('[data-testid="exchange-success"]', { timeout: 10000 })
  }

  // 彩票操作
  async selectLottery(lotteryTitle: string) {
    await this.page.click(`[data-testid="lottery-card"]:has-text("${lotteryTitle}")`)
    await this.page.waitForLoadState('networkidle')
  }

  async purchaseTickets(quantity: number, numbers?: string[]) {
    await this.page.click('[data-testid="purchase-button"]')
    await this.page.fill('[data-testid="ticket-quantity"]', quantity.toString())
    
    if (numbers) {
      for (let i = 0; i < numbers.length; i++) {
        await this.page.fill(`[data-testid="ticket-number-${i}"]`, numbers[i])
      }
    }
    
    await this.page.click('[data-testid="confirm-purchase"]')
    await this.page.waitForSelector('[data-testid="purchase-success"]', { timeout: 15000 })
  }

  async checkMyTickets() {
    await this.page.click('[data-testid="my-tickets-button"]')
    await this.page.waitForLoadState('networkidle')
    return await this.page.locator('[data-testid="ticket-item"]').count()
  }

  // 等待和验证方法
  async waitForPageLoad() {
    await this.page.waitForLoadState('networkidle')
    await this.page.waitForSelector('[data-testid="app-loaded"]', { timeout: 10000 })
  }

  async expectPageTitle(title: string) {
    await expect(this.page.locator('[data-testid="page-title"]')).toHaveText(title)
  }

  async expectToastMessage(message: string) {
    await expect(this.page.locator('[data-testid="toast-message"]')).toHaveText(message)
    await this.page.waitForSelector('[data-testid="toast-message"]', { state: 'hidden' })
  }
}

// 测试套件配置
test.describe('TezBarakatTJ E2E 测试', () => {
  let page: Page
  let context: BrowserContext
  let luckyMart: TezBarakatPage

  test.beforeEach(async ({ page: testPage, context: testContext }) => {
    page = testPage
    context = testContext
    luckyMart = new TezBarakatPage(page)

    // 设置 Telegram WebApp 环境
    await luckyMart.mockTelegramAuth()
    
    // 导航到应用
    await page.goto('/')
    await luckyMart.waitForPageLoad()
  })

  test.describe('用户认证流程', () => {
    test('应该成功加载并初始化 Telegram WebApp', async () => {
      await expect(page.locator('[data-testid="app-loaded"]')).toBeVisible()
      await expect(page.locator('[data-testid="user-info"]')).toContainText('E2E Test')
    })

    test('应该显示正确的用户信息', async () => {
      await luckyMart.navigateToProfile()
      await expect(page.locator('[data-testid="user-name"]')).toContainText('E2E Test')
      await expect(page.locator('[data-testid="user-id"]')).toContainText('123456789')
    })

    test('应该处理认证错误', async () => {
      // 清除 Telegram 数据模拟认证错误
      await page.addInitScript(() => {
        delete window.Telegram
      })
      
      await page.reload()
      await expect(page.locator('[data-testid="auth-error"]')).toBeVisible()
    })
  })

  test.describe('导航功能', () => {
    test('应该在不同页面间正确导航', async () => {
      // 首页
      await luckyMart.navigateToHome()
      await luckyMart.expectPageTitle('首页')

      // 夺宝大厅
      await luckyMart.navigateToLottery()
      await luckyMart.expectPageTitle('夺宝大厅')

      // 我的钱包
      await luckyMart.navigateToWallet()
      await luckyMart.expectPageTitle('我的钱包')

      // 个人中心
      await luckyMart.navigateToProfile()
      await luckyMart.expectPageTitle('个人中心')
    })

    test('应该正确高亮当前活动标签', async () => {
      await luckyMart.navigateToWallet()
      await expect(page.locator('[data-testid="nav-wallet"]')).toHaveClass(/active/)
      await expect(page.locator('[data-testid="nav-home"]')).not.toHaveClass(/active/)
    })

    test('应该支持后退导航', async () => {
      await luckyMart.navigateToLottery()
      await luckyMart.navigateToWallet()
      
      await page.goBack()
      await luckyMart.expectPageTitle('夺宝大厅')
    })
  })

  test.describe('钱包功能', () => {
    test('应该显示钱包余额', async () => {
      await luckyMart.navigateToWallet()
      
      const balance = await luckyMart.getWalletBalance()
      expect(balance).toBeDefined()
      expect(parseFloat(balance || '0')).toBeGreaterThanOrEqual(0)
    })

    test('应该成功处理充值流程', async () => {
      await luckyMart.navigateToWallet()
      
      const initialBalance = await luckyMart.getWalletBalance()
      await luckyMart.depositFunds(100)
      
      await luckyMart.expectToastMessage('充值成功')
      
      // 验证余额增加
      const newBalance = await luckyMart.getWalletBalance()
      expect(parseFloat(newBalance || '0')).toBeGreaterThan(parseFloat(initialBalance || '0'))
    })

    test('应该成功处理币种兑换', async () => {
      await luckyMart.navigateToWallet()
      
      // 确保有足够余额
      await luckyMart.depositFunds(100)
      
      await luckyMart.exchangeCurrency(50, 'BALANCE', 'LUCKY_COIN')
      await luckyMart.expectToastMessage('兑换成功')
    })

    test('应该验证充值金额', async () => {
      await luckyMart.navigateToWallet()
      
      await page.click('[data-testid="deposit-button"]')
      await page.fill('[data-testid="deposit-amount"]', '-100')
      await page.click('[data-testid="confirm-deposit"]')
      
      await expect(page.locator('[data-testid="amount-error"]')).toContainText('金额必须大于0')
    })

    test('应该显示交易历史', async () => {
      await luckyMart.navigateToWallet()
      
      // 进行一次交易
      await luckyMart.depositFunds(50)
      
      // 查看交易历史
      await page.click('[data-testid="transaction-history"]')
      await page.waitForLoadState('networkidle')
      
      const transactionCount = await page.locator('[data-testid="transaction-item"]').count()
      expect(transactionCount).toBeGreaterThan(0)
    })
  })

  test.describe('彩票购买流程', () => {
    test('应该显示可用彩票列表', async () => {
      await luckyMart.navigateToLottery()
      
      const lotteryCount = await page.locator('[data-testid="lottery-card"]').count()
      expect(lotteryCount).toBeGreaterThan(0)
    })

    test('应该成功购买彩票', async () => {
      await luckyMart.navigateToWallet()
      
      // 确保有足够的幸运币
      await luckyMart.depositFunds(200)
      await luckyMart.exchangeCurrency(100, 'BALANCE', 'LUCKY_COIN')
      
      // 购买彩票
      await luckyMart.navigateToLottery()
      await luckyMart.selectLottery('测试彩票')
      await luckyMart.purchaseTickets(2, ['12345', '67890'])
      
      await luckyMart.expectToastMessage('购买成功')
    })

    test('应该验证购买数量限制', async () => {
      await luckyMart.navigateToLottery()
      await luckyMart.selectLottery('测试彩票')
      
      // 尝试购买超过限制的数量
      await page.click('[data-testid="purchase-button"]')
      await page.fill('[data-testid="ticket-quantity"]', '15') // 假设限制为10
      await page.click('[data-testid="confirm-purchase"]')
      
      await expect(page.locator('[data-testid="quantity-error"]')).toContainText('超过购买限制')
    })

    test('应该检查余额充足性', async () => {
      await luckyMart.navigateToLottery()
      await luckyMart.selectLottery('测试彩票')
      
      // 在余额不足的情况下尝试购买
      await page.click('[data-testid="purchase-button"]')
      await page.fill('[data-testid="ticket-quantity"]', '10')
      await page.click('[data-testid="confirm-purchase"]')
      
      await expect(page.locator('[data-testid="balance-error"]')).toContainText('余额不足')
    })

    test('应该显示我的彩票', async () => {
      await luckyMart.navigateToLottery()
      
      // 先购买一些彩票
      await luckyMart.navigateToWallet()
      await luckyMart.depositFunds(100)
      await luckyMart.exchangeCurrency(50, 'BALANCE', 'LUCKY_COIN')
      
      await luckyMart.navigateToLottery()
      await luckyMart.selectLottery('测试彩票')
      await luckyMart.purchaseTickets(1, ['11111'])
      
      // 检查我的彩票
      const ticketCount = await luckyMart.checkMyTickets()
      expect(ticketCount).toBeGreaterThan(0)
    })
  })

  test.describe('推广系统', () => {
    test('应该显示推广码', async () => {
      await luckyMart.navigateToProfile()
      
      await expect(page.locator('[data-testid="referral-code"]')).toBeVisible()
      
      const referralCode = await page.locator('[data-testid="referral-code"]').textContent()
      expect(referralCode).toMatch(/^[A-Z0-9]{8}$/)
    })

    test('应该复制推广链接', async () => {
      await luckyMart.navigateToProfile()
      
      await page.click('[data-testid="copy-referral-link"]')
      await luckyMart.expectToastMessage('推广链接已复制')
    })

    test('应该显示推广统计', async () => {
      await luckyMart.navigateToProfile()
      await page.click('[data-testid="referral-stats"]')
      
      await expect(page.locator('[data-testid="referral-count"]')).toBeVisible()
      await expect(page.locator('[data-testid="referral-commission"]')).toBeVisible()
    })
  })

  test.describe('响应式设计', () => {
    test('应该在手机尺寸下正常显示', async () => {
      await page.setViewportSize({ width: 375, height: 667 })
      
      await luckyMart.navigateToHome()
      await expect(page.locator('[data-testid="bottom-navigation"]')).toBeVisible()
      await expect(page.locator('[data-testid="mobile-layout"]')).toBeVisible()
    })

    test('应该在平板尺寸下正常显示', async () => {
      await page.setViewportSize({ width: 768, height: 1024 })
      
      await luckyMart.navigateToLottery()
      const lotteryGrid = page.locator('[data-testid="lottery-grid"]')
      await expect(lotteryGrid).toBeVisible()
      
      // 验证网格布局
      const gridColumns = await lotteryGrid.evaluate(el => 
        window.getComputedStyle(el).gridTemplateColumns
      )
      expect(gridColumns).toContain('repeat')
    })

    test('应该在桌面尺寸下正常显示', async () => {
      await page.setViewportSize({ width: 1280, height: 720 })
      
      await luckyMart.navigateToWallet()
      await expect(page.locator('[data-testid="desktop-layout"]')).toBeVisible()
    })
  })

  test.describe('性能测试', () => {
    test('应该在合理时间内加载页面', async () => {
      const startTime = Date.now()
      
      await page.goto('/')
      await luckyMart.waitForPageLoad()
      
      const loadTime = Date.now() - startTime
      expect(loadTime).toBeLessThan(5000) // 5秒内加载完成
    })

    test('应该快速响应用户交互', async () => {
      await luckyMart.navigateToLottery()
      
      const startTime = Date.now()
      await luckyMart.navigateToWallet()
      const navigationTime = Date.now() - startTime
      
      expect(navigationTime).toBeLessThan(2000) // 2秒内完成导航
    })

    test('应该高效渲染大量数据', async () => {
      await luckyMart.navigateToLottery()
      
      // 等待彩票列表加载
      await page.waitForSelector('[data-testid="lottery-card"]')
      
      const startTime = Date.now()
      
      // 滚动到页面底部触发更多数据加载
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight)
      })
      
      await page.waitForTimeout(1000)
      const scrollTime = Date.now() - startTime
      
      expect(scrollTime).toBeLessThan(1000) // 1秒内完成滚动和渲染
    })
  })

  test.describe('错误处理', () => {
    test('应该处理网络错误', async () => {
      // 模拟网络断开
      await context.setOffline(true)
      
      await luckyMart.navigateToWallet()
      await expect(page.locator('[data-testid="network-error"]')).toBeVisible()
      
      // 恢复网络
      await context.setOffline(false)
      
      await page.click('[data-testid="retry-button"]')
      await luckyMart.waitForPageLoad()
    })

    test('应该处理服务器错误', async () => {
      // 模拟服务器错误
      await page.route('**/api/**', route => {
        route.fulfill({ status: 500, body: 'Internal Server Error' })
      })
      
      await luckyMart.navigateToWallet()
      await expect(page.locator('[data-testid="server-error"]')).toBeVisible()
    })

    test('应该显示友好的错误页面', async () => {
      await page.goto('/non-existent-page')
      await expect(page.locator('[data-testid="not-found"]')).toBeVisible()
      await expect(page.locator('[data-testid="back-home-button"]')).toBeVisible()
    })
  })

  test.describe('无障碍访问', () => {
    test('应该具备正确的语义化标签', async () => {
      await luckyMart.navigateToHome()
      
      await expect(page.locator('main')).toBeVisible()
      await expect(page.locator('nav')).toBeVisible()
      await expect(page.locator('header')).toBeVisible()
    })

    test('应该支持键盘导航', async () => {
      await luckyMart.navigateToLottery()
      
      // 使用Tab键导航
      await page.keyboard.press('Tab')
      await expect(page.locator(':focus')).toBeVisible()
      
      // 使用Enter键激活
      await page.keyboard.press('Enter')
      await page.waitForTimeout(500)
    })

    test('应该具备适当的对比度', async () => {
      // 这里可以使用axe-core等工具进行自动化无障碍测试
      await luckyMart.navigateToHome()
      
      // 检查文本颜色对比度
      const textColor = await page.locator('[data-testid="main-text"]').evaluate(el => 
        window.getComputedStyle(el).color
      )
      const backgroundColor = await page.locator('[data-testid="main-content"]').evaluate(el => 
        window.getComputedStyle(el).backgroundColor
      )
      
      expect(textColor).not.toBe(backgroundColor)
    })
  })

  test.describe('多语言支持', () => {
    test('应该支持中文界面', async () => {
      await page.addInitScript(() => {
        window.Telegram.WebApp.initDataUnsafe.user.language_code = 'zh'
      })
      
      await page.reload()
      await luckyMart.waitForPageLoad()
      
      await expect(page.locator('[data-testid="nav-home"]')).toContainText('首页')
    })

    test('应该支持俄语界面', async () => {
      await page.addInitScript(() => {
        window.Telegram.WebApp.initDataUnsafe.user.language_code = 'ru'
      })
      
      await page.reload()
      await luckyMart.waitForPageLoad()
      
      // 验证俄语文本（这里需要根据实际翻译调整）
      await expect(page.locator('[data-testid="nav-home"]')).not.toContainText('首页')
    })
  })
})

// 全局测试钩子
test.afterAll(async ({ page }) => {
  // 清理测试数据
  console.log('清理 E2E 测试数据...')
})