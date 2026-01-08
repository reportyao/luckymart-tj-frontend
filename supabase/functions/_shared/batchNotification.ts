/**
 * 批次通知共享模块
 * 用于发送批次到货通知给用户
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.42.0'

// Telegram Bot Token
const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')

// 多语言通知模板
const notificationTemplates = {
  zh: {
    batch_shipped: (batchNo: string, estimatedDate: string) => 
      `📦 您的订单已发货！\n\n批次号：${batchNo}\n预计到达：${estimatedDate}\n\n请耐心等待，我们会在货物到达后第一时间通知您。`,
    
    batch_in_transit_tj: (batchNo: string) => 
      `🚚 您的订单已到达塔吉克斯坦！\n\n批次号：${batchNo}\n\n正在进行清关和配送，请耐心等待。`,
    
    batch_arrived: (productName: string, pickupCode: string, pickupPointName: string, pickupPointAddress: string, expiresAt: string) => 
      `🎉 您的商品已到达！\n\n` +
      `📦 商品：${productName}\n` +
      `🔑 提货码：${pickupCode}\n` +
      `📍 自提点：${pickupPointName}\n` +
      `📮 地址：${pickupPointAddress}\n` +
      `⏰ 有效期至：${expiresAt}\n\n` +
      `请凭提货码到自提点提货，过期未取将无法领取。`,
    
    batch_item_missing: (productName: string) => 
      `😔 抱歉，您的商品缺货\n\n` +
      `📦 商品：${productName}\n\n` +
      `我们会尽快为您处理，请联系客服了解详情。`,
    
    batch_item_damaged: (productName: string) => 
      `😔 抱歉，您的商品在运输中损坏\n\n` +
      `📦 商品：${productName}\n\n` +
      `我们会尽快为您处理，请联系客服了解详情。`,
  },
  ru: {
    batch_shipped: (batchNo: string, estimatedDate: string) => 
      `📦 Ваш заказ отправлен!\n\n` +
      `Номер партии: ${batchNo}\n` +
      `Ожидаемая дата прибытия: ${estimatedDate}\n\n` +
      `Пожалуйста, подождите. Мы уведомим вас сразу после прибытия товара.`,
    
    batch_in_transit_tj: (batchNo: string) => 
      `🚚 Ваш заказ прибыл в Таджикистан!\n\n` +
      `Номер партии: ${batchNo}\n\n` +
      `Идёт таможенное оформление и доставка. Пожалуйста, подождите.`,
    
    batch_arrived: (productName: string, pickupCode: string, pickupPointName: string, pickupPointAddress: string, expiresAt: string) => 
      `🎉 Ваш товар прибыл!\n\n` +
      `📦 Товар: ${productName}\n` +
      `🔑 Код получения: ${pickupCode}\n` +
      `📍 Пункт выдачи: ${pickupPointName}\n` +
      `📮 Адрес: ${pickupPointAddress}\n` +
      `⏰ Действителен до: ${expiresAt}\n\n` +
      `Пожалуйста, заберите товар с кодом получения. После истечения срока товар не может быть получен.`,
    
    batch_item_missing: (productName: string) => 
      `😔 Извините, ваш товар отсутствует на складе\n\n` +
      `📦 Товар: ${productName}\n\n` +
      `Мы обработаем это как можно скорее. Пожалуйста, свяжитесь со службой поддержки.`,
    
    batch_item_damaged: (productName: string) => 
      `😔 Извините, ваш товар был повреждён при транспортировке\n\n` +
      `📦 Товар: ${productName}\n\n` +
      `Мы обработаем это как можно скорее. Пожалуйста, свяжитесь со службой поддержки.`,
  },
  tg: {
    batch_shipped: (batchNo: string, estimatedDate: string) => 
      `📦 Фармоиши шумо фиристода шуд!\n\n` +
      `Рақами партия: ${batchNo}\n` +
      `Санаи интизорӣ: ${estimatedDate}\n\n` +
      `Лутфан интизор шавед. Мо шуморо баъд аз расидани мол огоҳ мекунем.`,
    
    batch_in_transit_tj: (batchNo: string) => 
      `🚚 Фармоиши шумо ба Тоҷикистон расид!\n\n` +
      `Рақами партия: ${batchNo}\n\n` +
      `Расмиёти гумрукӣ ва интиқол идома дорад. Лутфан интизор шавед.`,
    
    batch_arrived: (productName: string, pickupCode: string, pickupPointName: string, pickupPointAddress: string, expiresAt: string) => 
      `🎉 Моли шумо расид!\n\n` +
      `📦 Мол: ${productName}\n` +
      `🔑 Рамзи гирифтан: ${pickupCode}\n` +
      `📍 Нуқтаи гирифтан: ${pickupPointName}\n` +
      `📮 Суроға: ${pickupPointAddress}\n` +
      `⏰ То: ${expiresAt}\n\n` +
      `Лутфан бо рамзи гирифтан молро гиред. Баъд аз мӯҳлат мол дода намешавад.`,
    
    batch_item_missing: (productName: string) => 
      `😔 Бубахшед, моли шумо дар анбор нест\n\n` +
      `📦 Мол: ${productName}\n\n` +
      `Мо ҳарчи зудтар ин масъаларо ҳал мекунем. Лутфан бо хидмати дастгирӣ тамос гиред.`,
    
    batch_item_damaged: (productName: string) => 
      `😔 Бубахшед, моли шумо ҳангоми интиқол вайрон шуд\n\n` +
      `📦 Мол: ${productName}\n\n` +
      `Мо ҳарчи зудтар ин масъаларо ҳал мекунем. Лутфан бо хидмати дастгирӣ тамос гиред.`,
  },
}

type NotificationLanguage = 'zh' | 'ru' | 'tg'

interface UserInfo {
  telegram_id: string
  preferred_language: string
  first_name?: string
}

/**
 * 获取用户通知信息
 */
async function getUserNotificationInfo(
  supabase: SupabaseClient,
  userId: string
): Promise<UserInfo | null> {
  const { data, error } = await supabase
    .from('users')
    .select('telegram_id, preferred_language, first_name')
    .eq('id', userId)
    .single()

  if (error || !data || !data.telegram_id) {
    console.error(`Failed to get notification info for user ${userId}:`, error)
    return null
  }

  return {
    telegram_id: data.telegram_id,
    preferred_language: data.preferred_language || 'zh',
    first_name: data.first_name,
  }
}

/**
 * 发送Telegram消息
 */
async function sendTelegramMessage(
  chatId: string,
  message: string
): Promise<boolean> {
  if (!BOT_TOKEN) {
    console.warn('TELEGRAM_BOT_TOKEN is not set. Skipping Telegram message.')
    return false
  }

  const telegramApiUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`

  try {
    const response = await fetch(telegramApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error(`Failed to send Telegram message to ${chatId}:`, response.status, errorData)
      return false
    }

    console.log(`Telegram message sent successfully to ${chatId}`)
    return true
  } catch (error) {
    console.error('Error sending Telegram message:', error)
    return false
  }
}

/**
 * 获取本地化文本
 */
function getLocalizedText(
  textI18n: Record<string, string> | null,
  language: string,
  fallback: string = ''
): string {
  if (!textI18n) return fallback
  return textI18n[language] || textI18n.zh || textI18n.ru || textI18n.tg || fallback
}

/**
 * 格式化日期显示
 */
function formatDate(dateStr: string, language: string): string {
  const date = new Date(dateStr)
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }
  
  const localeMap: Record<string, string> = {
    zh: 'zh-CN',
    ru: 'ru-RU',
    tg: 'tg-TJ',
  }
  
  return date.toLocaleDateString(localeMap[language] || 'zh-CN', options)
}

/**
 * 发送批次发货通知
 */
export async function sendBatchShippedNotification(
  supabase: SupabaseClient,
  userId: string,
  batchNo: string,
  estimatedArrivalDate: string
): Promise<boolean> {
  const userInfo = await getUserNotificationInfo(supabase, userId)
  if (!userInfo) return false

  const lang = (userInfo.preferred_language in notificationTemplates 
    ? userInfo.preferred_language 
    : 'zh') as NotificationLanguage
  
  const formattedDate = formatDate(estimatedArrivalDate, lang)
  const message = notificationTemplates[lang].batch_shipped(batchNo, formattedDate)
  
  return sendTelegramMessage(userInfo.telegram_id, message)
}

/**
 * 发送批次到达塔吉克斯坦通知
 */
export async function sendBatchInTransitTJNotification(
  supabase: SupabaseClient,
  userId: string,
  batchNo: string
): Promise<boolean> {
  const userInfo = await getUserNotificationInfo(supabase, userId)
  if (!userInfo) return false

  const lang = (userInfo.preferred_language in notificationTemplates 
    ? userInfo.preferred_language 
    : 'zh') as NotificationLanguage
  
  const message = notificationTemplates[lang].batch_in_transit_tj(batchNo)
  
  return sendTelegramMessage(userInfo.telegram_id, message)
}

/**
 * 发送批次到货通知（包含提货码）
 */
export async function sendBatchArrivedNotification(
  supabase: SupabaseClient,
  userId: string,
  productName: string,
  productNameI18n: Record<string, string> | null,
  pickupCode: string,
  pickupPointName: string,
  pickupPointNameI18n: Record<string, string> | null,
  pickupPointAddress: string,
  pickupPointAddressI18n: Record<string, string> | null,
  expiresAt: string
): Promise<boolean> {
  const userInfo = await getUserNotificationInfo(supabase, userId)
  if (!userInfo) return false

  const lang = (userInfo.preferred_language in notificationTemplates 
    ? userInfo.preferred_language 
    : 'zh') as NotificationLanguage
  
  const localizedProductName = getLocalizedText(productNameI18n, lang, productName)
  const localizedPickupPointName = getLocalizedText(pickupPointNameI18n, lang, pickupPointName)
  const localizedPickupPointAddress = getLocalizedText(pickupPointAddressI18n, lang, pickupPointAddress)
  const formattedExpiresAt = formatDate(expiresAt, lang)
  
  const message = notificationTemplates[lang].batch_arrived(
    localizedProductName,
    pickupCode,
    localizedPickupPointName,
    localizedPickupPointAddress,
    formattedExpiresAt
  )
  
  return sendTelegramMessage(userInfo.telegram_id, message)
}

/**
 * 发送商品缺货通知
 */
export async function sendBatchItemMissingNotification(
  supabase: SupabaseClient,
  userId: string,
  productName: string,
  productNameI18n: Record<string, string> | null
): Promise<boolean> {
  const userInfo = await getUserNotificationInfo(supabase, userId)
  if (!userInfo) return false

  const lang = (userInfo.preferred_language in notificationTemplates 
    ? userInfo.preferred_language 
    : 'zh') as NotificationLanguage
  
  const localizedProductName = getLocalizedText(productNameI18n, lang, productName)
  const message = notificationTemplates[lang].batch_item_missing(localizedProductName)
  
  return sendTelegramMessage(userInfo.telegram_id, message)
}

/**
 * 发送商品损坏通知
 */
export async function sendBatchItemDamagedNotification(
  supabase: SupabaseClient,
  userId: string,
  productName: string,
  productNameI18n: Record<string, string> | null
): Promise<boolean> {
  const userInfo = await getUserNotificationInfo(supabase, userId)
  if (!userInfo) return false

  const lang = (userInfo.preferred_language in notificationTemplates 
    ? userInfo.preferred_language 
    : 'zh') as NotificationLanguage
  
  const localizedProductName = getLocalizedText(productNameI18n, lang, productName)
  const message = notificationTemplates[lang].batch_item_damaged(localizedProductName)
  
  return sendTelegramMessage(userInfo.telegram_id, message)
}

/**
 * 批量发送通知
 */
export interface BatchNotificationResult {
  userId: string
  success: boolean
  error?: string
}

export async function sendBatchNotifications(
  supabase: SupabaseClient,
  notifications: Array<{
    userId: string
    type: 'shipped' | 'in_transit_tj' | 'arrived' | 'missing' | 'damaged'
    data: Record<string, any>
  }>
): Promise<BatchNotificationResult[]> {
  const results: BatchNotificationResult[] = []
  
  for (const notification of notifications) {
    try {
      let success = false
      
      switch (notification.type) {
        case 'shipped':
          success = await sendBatchShippedNotification(
            supabase,
            notification.userId,
            notification.data.batchNo,
            notification.data.estimatedArrivalDate
          )
          break
        case 'in_transit_tj':
          success = await sendBatchInTransitTJNotification(
            supabase,
            notification.userId,
            notification.data.batchNo
          )
          break
        case 'arrived':
          success = await sendBatchArrivedNotification(
            supabase,
            notification.userId,
            notification.data.productName,
            notification.data.productNameI18n,
            notification.data.pickupCode,
            notification.data.pickupPointName,
            notification.data.pickupPointNameI18n,
            notification.data.pickupPointAddress,
            notification.data.pickupPointAddressI18n,
            notification.data.expiresAt
          )
          break
        case 'missing':
          success = await sendBatchItemMissingNotification(
            supabase,
            notification.userId,
            notification.data.productName,
            notification.data.productNameI18n
          )
          break
        case 'damaged':
          success = await sendBatchItemDamagedNotification(
            supabase,
            notification.userId,
            notification.data.productName,
            notification.data.productNameI18n
          )
          break
      }
      
      results.push({ userId: notification.userId, success })
    } catch (error) {
      results.push({
        userId: notification.userId,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }
  
  return results
}
