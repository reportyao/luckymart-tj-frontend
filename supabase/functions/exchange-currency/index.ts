import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // 获取当前用户
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser()

    if (userError || !user) {
      throw new Error('未授权')
    }

    const { exchangeType, amount, currency } = await req.json()

    // 验证参数
    if (!exchangeType || !['BALANCE_TO_COIN', 'COIN_TO_BALANCE'].includes(exchangeType)) {
      throw new Error('无效的兑换类型')
    }

    if (!amount || amount <= 0) {
      throw new Error('兑换金额必须大于0')
    }

    const curr = currency || 'TJS'

    // 确定源钱包和目标钱包类型
    const sourceType = exchangeType === 'BALANCE_TO_COIN' ? 'BALANCE' : 'LUCKY_COIN'
    const targetType = exchangeType === 'BALANCE_TO_COIN' ? 'LUCKY_COIN' : 'BALANCE'

    // 获取源钱包
    const { data: sourceWallet, error: sourceError } = await supabaseClient
      .from('wallets')
      .select('*')
      .eq('user_id', user.id)
      .eq('type', sourceType)
      .eq('currency', curr)
      .single()

    if (sourceError || !sourceWallet) {
      throw new Error('未找到源钱包')
    }

    // 获取目标钱包
    const { data: targetWallet, error: targetError } = await supabaseClient
      .from('wallets')
      .select('*')
      .eq('user_id', user.id)
      .eq('type', targetType)
      .eq('currency', curr)
      .single()

    if (targetError || !targetWallet) {
      throw new Error('未找到目标钱包')
    }

    // 检查源钱包余额
    if (sourceWallet.balance < amount) {
      throw new Error('余额不足')
    }

    // 计算兑换比例 (1:1)
    const exchangeRate = 1.0
    const exchangedAmount = amount * exchangeRate

    // 记录兑换前余额
    const sourceBalanceBefore = sourceWallet.balance
    const targetBalanceBefore = targetWallet.balance

    // 更新源钱包余额
    const { error: updateSourceError } = await supabaseClient
      .from('wallets')
      .update({
        balance: sourceWallet.balance - amount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sourceWallet.id)

    if (updateSourceError) {
      console.error('更新源钱包失败:', updateSourceError)
      throw new Error('兑换失败')
    }

    // 更新目标钱包余额
    const { error: updateTargetError } = await supabaseClient
      .from('wallets')
      .update({
        balance: targetWallet.balance + exchangedAmount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', targetWallet.id)

    if (updateTargetError) {
      console.error('更新目标钱包失败:', updateTargetError)
      // 回滚源钱包
      await supabaseClient
        .from('wallets')
        .update({
          balance: sourceWallet.balance,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sourceWallet.id)
      throw new Error('兑换失败')
    }

    // 创建兑换记录
    const { data: exchangeRecord, error: recordError } = await supabaseClient
      .from('exchange_records')
      .insert({
        user_id: user.id,
        exchange_type: exchangeType,
        amount: amount,
        currency: curr,
        exchange_rate: exchangeRate,
        source_wallet_id: sourceWallet.id,
        target_wallet_id: targetWallet.id,
        source_balance_before: sourceBalanceBefore,
        source_balance_after: sourceWallet.balance - amount,
        target_balance_before: targetBalanceBefore,
        target_balance_after: targetWallet.balance + exchangedAmount,
      })
      .select()
      .single()

    if (recordError) {
      console.error('创建兑换记录失败:', recordError)
    }

    // 创建钱包交易记录
    await supabaseClient.from('wallet_transactions').insert([
      {
        wallet_id: sourceWallet.id,
        type: 'COIN_EXCHANGE',
        amount: -amount,
        balance_after: sourceWallet.balance - amount,
        description: `兑换${amount}${curr}到${targetType === 'LUCKY_COIN' ? '夺宝币' : '余额'}`,
      },
      {
        wallet_id: targetWallet.id,
        type: 'COIN_EXCHANGE',
        amount: exchangedAmount,
        balance_after: targetWallet.balance + exchangedAmount,
        description: `从${sourceType === 'BALANCE' ? '余额' : '夺宝币'}兑换${exchangedAmount}${curr}`,
      },
    ])

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          exchangeRecord,
          sourceWallet: {
            type: sourceType,
            balanceBefore: sourceBalanceBefore,
            balanceAfter: sourceWallet.balance - amount,
          },
          targetWallet: {
            type: targetType,
            balanceBefore: targetBalanceBefore,
            balanceAfter: targetWallet.balance + exchangedAmount,
          },
        },
        message: '兑换成功',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('兑换错误:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
