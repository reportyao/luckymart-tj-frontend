import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * 内联的 Telegram 消息发送功能
 * 避免外部依赖导致的部署问题
 */
const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')

const translations: Record<string, Record<string, (amount: number, level: number) => string>> = {
  zh: {
    commission_earned: (amount: number, level: number) => `🎉 恭喜！您获得了 ${amount} 积分的佣金。来自您的 L${level} 朋友的购买。`,
  },
  ru: {
    commission_earned: (amount: number, level: number) => `🎉 Поздравляем! Вы получили комиссию ${amount} баллов от покупки вашего друга уровня L${level}.`,
  },
  tg: {
    commission_earned: (amount: number, level: number) => `🎉 Табрик! Шумо аз хариди дӯсти сатҳи L${level} комиссияи ${amount} балл гирифтед.`,
  },
}

async function sendTelegramMessage(userId: string, type: string, data: { amount?: number, level?: number }) {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    
    const { data: userData, error } = await supabase
      .from('users')
      .select('telegram_id, preferred_language')
      .eq('id', userId)
      .single()
    
    if (error || !userData?.telegram_id) {
      console.log('User not found or no telegram_id:', userId)
      return
    }
    
    const lang = userData.preferred_language || 'ru'
    const langTranslations = translations[lang] || translations['ru']
    const messageFunc = langTranslations[type]
    
    if (!messageFunc || !BOT_TOKEN) {
      console.log('No message template or bot token')
      return
    }
    
    const message = messageFunc(data.amount || 0, data.level || 1)
    
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: userData.telegram_id,
        text: message,
        parse_mode: 'HTML'
      })
    })
  } catch (err) {
    console.error('Failed to send Telegram message:', err)
  }
}

serve(async (req) => {
  // 允许 OPTIONS 请求
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' } })
  }

  try {
    const { order_id, user_id, order_amount } = await req.json()
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. 获取佣金配置（使用 commission_settings 表）
    const { data: settings, error: settingsError } = await supabaseClient
      .from('commission_settings')
      .select('level, rate, is_active, trigger_condition, min_payout_amount')
      .eq('is_active', true)
      .order('level', { ascending: true })
    
    if (settingsError) {
      console.error('Failed to fetch commission settings:', settingsError)
      throw settingsError
    }

    if (!settings || settings.length === 0) {
      console.log('No active commission settings found')
      return new Response(JSON.stringify({ message: 'No active commission settings' }), { status: 200 })
    }

    // 2. 获取购买用户的推荐关系
    const { data: userData, error: userError } = await supabaseClient
      .from('users')
      .select('referred_by_id')
      .eq('id', user_id)
      .single()

    if (userError) throw userError

    if (!userData?.referred_by_id) {
      return new Response(JSON.stringify({ message: 'No referrer' }), { status: 200 })
    }

    // 3. 计算三级返佣
    const commissions = []
    let currentUserId = userData.referred_by_id
    let level = 1

    // 遍历每一级
    for (const setting of settings) {
      if (!currentUserId || level > 3) break
      
      // 检查是否有对应级别的配置
      if (setting.level !== level) continue

      const rate = parseFloat(setting.rate)
      const minPayoutAmount = parseFloat(setting.min_payout_amount || '0')
      const commissionAmount = order_amount * rate
      
      // 检查是否达到最低发放金额
      if (commissionAmount < minPayoutAmount) {
        console.log(`Commission ${commissionAmount} below minimum ${minPayoutAmount} for level ${level}`)
        // 继续查找下一级
        const { data: nextUser } = await supabaseClient
          .from('users')
          .select('referred_by_id')
          .eq('id', currentUserId)
          .single()
        
        currentUserId = nextUser?.referred_by_id
        level++
        continue
      }

      /**
       * 插入佣金记录
       * 
       * commissions 表字段说明：
       * - user_id: 获得佣金的用户ID（上级）
       * - from_user_id: 产生佣金的用户ID（下级）
       * - source_user_id: 同 from_user_id，兼容字段
       * - beneficiary_id: 同 user_id，兼容字段
       * - amount: 佣金金额
       * - source_amount: 订单金额
       * - rate: 佣金比例
       * - percent: 佣金百分比（rate * 100）
       * - level: 佣金级别（1/2/3级）
       * - type: 佣金类型（REFERRAL_COMMISSION）
       * - status: 状态（settled）
       * - order_id: 关联订单ID
       */
      const { data: commission, error: commissionError } = await supabaseClient
        .from('commissions')
        .insert({
          user_id: currentUserId,
          from_user_id: user_id,
          source_user_id: user_id,
          beneficiary_id: currentUserId,
          level: level,
          rate: rate,
          percent: rate * 100,
          source_amount: order_amount,
          amount: commissionAmount,
          order_id: order_id,
          related_order_id: order_id,
          type: 'REFERRAL_COMMISSION',
          status: 'settled'
        })
        .select()
        .single()

      if (commissionError) {
        console.error('Failed to insert commission:', commissionError)
        throw commissionError
      }
      
      commissions.push(commission)

      /**
       * 将佣金发放到上级用户的积分钱包
       * 
       * 钱包类型说明（重要）：
       * - 现金钱包: type='TJS', currency='TJS'
       * - 积分钱包: type='LUCKY_COIN', currency='POINTS'
       * 
       * 三级分销佣金发放到积分钱包
       */
      const { data: wallet, error: walletError } = await supabaseClient
        .from('wallets')
        .select('id, balance')
        .eq('user_id', currentUserId)
        .eq('type', 'LUCKY_COIN')
        .eq('currency', 'POINTS')
        .single()

      if (walletError) {
        console.error('Failed to find wallet:', walletError)
        // 如果找不到积分钱包，尝试创建一个
        const { data: newWallet, error: createError } = await supabaseClient
          .from('wallets')
          .insert({
            user_id: currentUserId,
            type: 'LUCKY_COIN',
            currency: 'POINTS',
            balance: commissionAmount,
          })
          .select()
          .single()

        if (createError) {
          console.error('Failed to create wallet:', createError)
          throw createError
        }
        console.log('Created new LUCKY_COIN wallet for user:', currentUserId, 'with balance:', commissionAmount)
      } else {
        // 更新积分钱包余额
        const newBalance = parseFloat(wallet.balance || '0') + commissionAmount
        const { error: updateError } = await supabaseClient
          .from('wallets')
          .update({
            balance: newBalance,
            updated_at: new Date().toISOString(),
          })
          .eq('id', wallet.id)

        if (updateError) {
          console.error('Failed to update wallet balance:', updateError)
          throw updateError
        }
        console.log('Updated LUCKY_COIN wallet for user:', currentUserId, 'new balance:', newBalance)
      }

      // 4. 推送 Telegram 消息
      try {
        await sendTelegramMessage(currentUserId, 'commission_earned', {
          amount: commissionAmount,
          level: level
        })
      } catch (msgError) {
        console.error('Failed to send telegram message:', msgError)
        // 不阻断流程
      }

      // 查找下一级
      const { data: nextUser, error: nextUserError } = await supabaseClient
        .from('users')
        .select('referred_by_id')
        .eq('id', currentUserId)
        .single()

      if (nextUserError) {
        console.error('Failed to fetch next user:', nextUserError)
        break
      }

      currentUserId = nextUser?.referred_by_id
      level++
    }

    return new Response(
      JSON.stringify({ success: true, commissions }),
      { headers: { "Content-Type": "application/json", 'Access-Control-Allow-Origin': '*' }, status: 200 }
    )

  } catch (error) {
    console.error('handle_purchase_commission error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { "Content-Type": "application/json", 'Access-Control-Allow-Origin': '*' }, status: 400 }
    )
  }
})
