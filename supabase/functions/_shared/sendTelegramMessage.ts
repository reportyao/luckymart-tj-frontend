import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.42.0'
// import { Database } from '../_shared/database.types.ts' // 移除，避免部署错误

// 假设 Telegram Bot Token 存储在环境变量中
const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')

// 假设 i18n 翻译资源存储在某个地方，这里简化为硬编码或从共享文件导入
// 实际项目中，应该从共享的 i18n 资源中加载
const translations = {
  zh: {
    commission_earned: (amount: number, level: number) => `恭喜！您获得了 ${amount} TJS 的佣金。来自您的 L${level} 朋友的购买。`,
    purchase_success: (amount: number) => `您成功购买了价值 ${amount} TJS 的彩票份额。祝您好运！`,
    first_deposit_bonus: (amount: number) => `🎉 您的首充奖励 ${amount} TJS 已成功激活并到账！`,
  },
  ru: {
    commission_earned: (amount: number, level: number) => `Поздравляем! Вы получили комиссию ${amount} TJS от покупки вашего друга уровня L${level}.`,
    purchase_success: (amount: number) => `Вы успешно приобрели долю лотереи на сумму ${amount} TJS. Удачи!`,
    first_deposit_bonus: (amount: number) => `🎉 Ваш бонус за первый депозит ${amount} TJS успешно активирован и зачислен!`,
  },
  tg: {
    commission_earned: (amount: number, level: number) => `Табрик! Шумо аз хариди дӯсти сатҳи L${level} комиссияи ${amount} TJS гирифтед.`,
    purchase_success: (amount: number) => `Шумо бомуваффақият ҳиссаи лотореяро ба маблағи ${amount} TJS харидед. Барори кор!`,
    first_deposit_bonus: (amount: number) => `🎉 Бонуси аввалин пасандози шумо ${amount} TJS бомуваффақият фаъол ва ба ҳисоб гузаронида шуд!`,
  },
}

type NotificationType = 'commission_earned' | 'purchase_success' | 'first_deposit_bonus'

interface NotificationData {
  amount?: number
  level?: number
}

/**
 * 根据用户 ID 获取其 Telegram Chat ID 和首选语言
 * @param userId 
 * @returns { chat_id: number, preferred_language: string } | null
 */
async function getUserNotificationInfo(userId: string): Promise<{ chat_id: number, preferred_language: string } | null> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // 使用 users 表替代已删除的 profiles 表
  const { data, error } = await supabase
    .from('users')
    .select('telegram_id, preferred_language')
    .eq('id', userId)
    .single()

  if (error || !data || !data.telegram_id) {
    console.error(`Failed to get notification info for user ${userId}:`, error)
    return null
  }

  return {
    chat_id: parseInt(data.telegram_id) || 0, // telegram_id 作为 chat_id
    preferred_language: data.preferred_language || 'zh', // 默认中文
  }
}

/**
 * 发送 Telegram 消息
 * @param userId 目标用户 ID
 * @param type 消息类型
 * @param data 消息数据
 */
export async function sendTelegramMessage(
  userId: string,
  type: NotificationType,
  data: NotificationData = {}
): Promise<void> {
  if (!BOT_TOKEN) {
    console.warn('TELEGRAM_BOT_TOKEN is not set. Skipping Telegram message.')
    return
  }

  const userInfo = await getUserNotificationInfo(userId)
  if (!userInfo) {
    return
  }

  const { chat_id, preferred_language } = userInfo
  const lang = preferred_language in translations ? preferred_language as keyof typeof translations : 'zh'
  const t = translations[lang]

  let messageText = ''

  switch (type) {
    case 'commission_earned':
      messageText = t.commission_earned(data.amount || 0, data.level || 0)
      break
    case 'purchase_success':
      messageText = t.purchase_success(data.amount || 0)
      break
    case 'first_deposit_bonus':
      messageText = t.first_deposit_bonus(data.amount || 0)
      break
    default:
      console.error(`Unknown notification type: ${type}`)
      return
  }

  const telegramApiUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`

  try {
    const response = await fetch(telegramApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chat_id,
        text: messageText,
        parse_mode: 'Markdown', // 使用 Markdown 格式
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error(`Failed to send Telegram message to ${chat_id}:`, response.status, errorData)
    } else {
      console.log(`Telegram message sent successfully to ${chat_id} for type ${type}.`)
    }
  } catch (error) {
    console.error('Error sending Telegram message:', error)
  }
}
