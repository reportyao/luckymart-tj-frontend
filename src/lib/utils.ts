import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// 日期时间格式化
export function formatDateTime(dateString: string | Date): string {
  const date = new Date(dateString)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// 货币格式化
export function formatCurrency(amount: number | string, currency = 'TJS'): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return `${currency}${num.toFixed(2)}`
}

// 钱包类型文本
export function getWalletTypeText(type: string): string {
  switch (type) {
    case 'BALANCE': return '余额钱包'
    case 'LUCKY_COIN': return '幸运币钱包'
    default: return '未知类型'
  }
}

// 彩票状态文本
export function getLotteryStatusText(status: string): string {
  switch (status) {
    case 'ACTIVE': return '进行中'
    case 'PENDING': return '待开奖'
    case 'DRAWN': return '已开奖'
    case 'CANCELLED': return '已取消'
    default: return '未知状态'
  }
}

// 彩票状态颜色
export function getLotteryStatusColor(status: string): string {
  switch (status) {
    case 'ACTIVE': return 'text-green-600 bg-green-50'
    case 'PENDING': return 'text-yellow-600 bg-yellow-50'
    case 'DRAWN': return 'text-blue-600 bg-blue-50'
    case 'CANCELLED': return 'text-red-600 bg-red-50'
    default: return 'text-gray-600 bg-gray-50'
  }
}

// 剩余时间计算
export function getTimeRemaining(endTime: string | Date): { 
  days: number; 
  hours: number; 
  minutes: number; 
  seconds: number; 
  total: number 
} {
  const now = new Date().getTime()
  const end = new Date(endTime).getTime()
  const timeDiff = end - now

  if (timeDiff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 }
  }

  const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000)

  return { days, hours, minutes, seconds, total: timeDiff }
}

// 复制到剪贴板
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text)
      return true
    } else {
      // 降级处理
      const textArea = document.createElement('textarea')
      textArea.value = text
      document.body.appendChild(textArea)
      textArea.select()
      const success = document.execCommand('copy')
      document.body.removeChild(textArea)
      return success
    }
  } catch (error) {
    console.error('复制失败:', error)
    return false
  }
}

// 分享到Telegram
export function shareToTelegram(text: string, url?: string): void {
  const shareText = encodeURIComponent(text)
  const shareUrl = url ? `&url=${encodeURIComponent(url)}` : ''
  const telegramUrl = `https://t.me/share/url?text=${shareText}${shareUrl}`
  window.open(telegramUrl, '_blank')
}