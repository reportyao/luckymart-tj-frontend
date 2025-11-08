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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { resaleItemId } = await req.json()

    // 验证用户身份
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('未授权')
    }

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authError || !user) {
      throw new Error('未授权')
    }

    // 查询转售商品信息
    const { data: resaleItem, error: resaleError } = await supabaseClient
      .from('resale_items')
      .select('*, prizes(*), lotteries(*)')
      .eq('id', resaleItemId)
      .single()

    if (resaleError || !resaleItem) {
      throw new Error('转售商品不存在')
    }

    // 检查状态
    if (resaleItem.status !== 'ACTIVE') {
      throw new Error('该商品已下架或已售出')
    }

    // 不能购买自己的商品
    if (resaleItem.seller_id === user.id) {
      throw new Error('不能购买自己的商品')
    }

    // 查询买家余额
    const { data: buyer, error: buyerError } = await supabaseClient
      .from('users')
      .select('balance')
      .eq('telegram_id', user.id)
      .single()

    if (buyerError || !buyer) {
      throw new Error('用户不存在')
    }

    // 检查余额
    if (buyer.balance < resaleItem.resale_price) {
      throw new Error('余额不足')
    }

    // 开始事务
    // 1. 扣除买家余额
    const { error: deductError } = await supabaseClient
      .from('users')
      .update({ balance: buyer.balance - resaleItem.resale_price })
      .eq('telegram_id', user.id)

    if (deductError) {
      throw new Error('扣除余额失败: ' + deductError.message)
    }

    // 2. 增加卖家余额 (扣除5%手续费)
    const sellerAmount = resaleItem.resale_price * 0.95
    const { error: addError } = await supabaseClient.rpc('increment_user_balance', {
      user_telegram_id: resaleItem.seller_id,
      amount: sellerAmount,
    })

    if (addError) {
      // 回滚买家余额
      await supabaseClient
        .from('users')
        .update({ balance: buyer.balance })
        .eq('telegram_id', user.id)
      throw new Error('增加卖家余额失败: ' + addError.message)
    }

    // 3. 更新转售商品状态
    const { error: updateResaleError } = await supabaseClient
      .from('resale_items')
      .update({
        status: 'SOLD',
        buyer_id: user.id,
        sold_at: new Date().toISOString(),
      })
      .eq('id', resaleItemId)

    if (updateResaleError) {
      throw new Error('更新转售商品状态失败: ' + updateResaleError.message)
    }

    // 4. 更新奖品所有者
    const { error: updatePrizeError } = await supabaseClient
      .from('prizes')
      .update({
        user_id: user.id,
        status: 'PENDING',
      })
      .eq('id', resaleItem.prize_id)

    if (updatePrizeError) {
      throw new Error('更新奖品所有者失败: ' + updatePrizeError.message)
    }

    // 5. 记录交易
    await supabaseClient
      .from('transactions')
      .insert({
        user_id: user.id,
        type: 'RESALE_PURCHASE',
        amount: -resaleItem.resale_price,
        balance_after: buyer.balance - resaleItem.resale_price,
        description: `购买转售商品: ${resaleItem.lotteries.title}`,
        metadata: {
          resale_item_id: resaleItemId,
          prize_id: resaleItem.prize_id,
          lottery_id: resaleItem.lottery_id,
        },
      })

    await supabaseClient
      .from('transactions')
      .insert({
        user_id: resaleItem.seller_id,
        type: 'RESALE_INCOME',
        amount: sellerAmount,
        description: `转售收入: ${resaleItem.lotteries.title} (扣除5%手续费)`,
        metadata: {
          resale_item_id: resaleItemId,
          prize_id: resaleItem.prize_id,
          lottery_id: resaleItem.lottery_id,
          original_price: resaleItem.resale_price,
          fee: resaleItem.resale_price * 0.05,
        },
      })

    return new Response(
      JSON.stringify({
        success: true,
        message: '购买成功',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
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
