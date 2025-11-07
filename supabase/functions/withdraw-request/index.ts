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

    const {
      amount,
      currency,
      withdrawalMethod,
      bankName,
      bankAccountNumber,
      bankAccountName,
      bankBranch,
      idCardNumber,
      idCardName,
      phoneNumber,
      mobileWalletNumber,
      mobileWalletName,
    } = await req.json()

    // 验证参数
    if (!amount || amount <= 0) {
      throw new Error('提现金额必须大于0')
    }

    if (!withdrawalMethod) {
      throw new Error('请选择提现方式')
    }

    // 根据提现方式验证必填字段
    if (withdrawalMethod === 'BANK_TRANSFER') {
      if (!bankName || !bankAccountNumber || !bankAccountName) {
        throw new Error('请填写完整的银行卡信息')
      }
    } else if (withdrawalMethod === 'ALIF_MOBI' || withdrawalMethod === 'DC_BANK') {
      if (!mobileWalletNumber || !mobileWalletName) {
        throw new Error('请填写完整的钱包信息')
      }
    }

    // 验证身份信息
    if (!idCardNumber || !idCardName || !phoneNumber) {
      throw new Error('请填写完整的身份信息')
    }

    // 获取用户余额钱包
    const { data: wallet, error: walletError } = await supabaseClient
      .from('wallets')
      .select('*')
      .eq('user_id', user.id)
      .eq('type', 'BALANCE')
      .eq('currency', currency || 'TJS')
      .single()

    if (walletError || !wallet) {
      throw new Error('未找到钱包')
    }

    // 检查余额是否足够
    if (wallet.balance < amount) {
      throw new Error('余额不足')
    }

    // 生成订单号
    const orderNumber = `WD${Date.now()}`

    // 冻结提现金额
    const { error: freezeError } = await supabaseClient
      .from('wallets')
      .update({
        balance: wallet.balance - amount,
        frozen_balance: wallet.frozen_balance + amount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', wallet.id)

    if (freezeError) {
      console.error('冻结余额失败:', freezeError)
      throw new Error('冻结余额失败')
    }

    // 创建提现申请
    const { data: withdrawalRequest, error: insertError } = await supabaseClient
      .from('withdrawal_requests')
      .insert({
        user_id: user.id,
        order_number: orderNumber,
        amount: amount,
        currency: currency || 'TJS',
        withdrawal_method: withdrawalMethod,
        bank_name: bankName || null,
        bank_account_number: bankAccountNumber || null,
        bank_account_name: bankAccountName || null,
        bank_branch: bankBranch || null,
        id_card_number: idCardNumber,
        id_card_name: idCardName,
        phone_number: phoneNumber,
        mobile_wallet_number: mobileWalletNumber || null,
        mobile_wallet_name: mobileWalletName || null,
        status: 'PENDING',
      })
      .select()
      .single()

    if (insertError) {
      console.error('创建提现申请失败:', insertError)
      // 回滚冻结的余额
      await supabaseClient
        .from('wallets')
        .update({
          balance: wallet.balance,
          frozen_balance: wallet.frozen_balance,
          updated_at: new Date().toISOString(),
        })
        .eq('id', wallet.id)
      throw new Error('创建提现申请失败')
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: withdrawalRequest,
        message: '提现申请已提交,请等待审核',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('提现申请错误:', error)
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
