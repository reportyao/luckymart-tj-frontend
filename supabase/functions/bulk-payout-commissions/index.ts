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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { commission_ids } = await req.json()

    if (!commission_ids || !Array.isArray(commission_ids) || commission_ids.length === 0) {
      return new Response(
        JSON.stringify({ error: 'commission_ids array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let success_count = 0
    let fail_count = 0
    const errors: any[] = []

    for (const commission_id of commission_ids) {
      try {
        // 获取返利记录
        const { data: commission, error: commissionError } = await supabaseClient
          .from('commissions')
          .select('*')
          .eq('id', commission_id)
          .eq('status', 'pending')
          .single()

        if (commissionError || !commission) {
          fail_count++
          errors.push({ commission_id, error: 'Commission not found or not pending' })
          continue
        }

        // 开始事务：更新钱包余额
        const { data: wallet, error: walletError } = await supabaseClient
          .from('wallets')
          .select('balance')
          .eq('user_id', commission.referrer_id)
          .single()

        if (walletError || !wallet) {
          fail_count++
          errors.push({ commission_id, error: 'Wallet not found' })
          continue
        }

        const newBalance = parseFloat(wallet.balance) + parseFloat(commission.amount)

        // 更新钱包余额
        const { error: updateWalletError } = await supabaseClient
          .from('wallets')
          .update({ 
            balance: newBalance,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', commission.referrer_id)

        if (updateWalletError) {
          fail_count++
          errors.push({ commission_id, error: updateWalletError.message })
          continue
        }

        // 创建钱包交易记录
        const { error: transactionError } = await supabaseClient
          .from('wallet_transactions')
          .insert({
            user_id: commission.referrer_id,
            type: 'commission',
            amount: commission.amount,
            balance_after: newBalance,
            description: `L${commission.level} referral commission`,
            created_at: new Date().toISOString()
          })

        if (transactionError) {
          // 回滚钱包余额
          await supabaseClient
            .from('wallets')
            .update({ balance: wallet.balance })
            .eq('user_id', commission.referrer_id)

          fail_count++
          errors.push({ commission_id, error: transactionError.message })
          continue
        }

        // 更新返利状态
        const { error: updateCommissionError } = await supabaseClient
          .from('commissions')
          .update({ 
            status: 'paid',
            paid_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', commission_id)

        if (updateCommissionError) {
          fail_count++
          errors.push({ commission_id, error: updateCommissionError.message })
          continue
        }

        success_count++

      } catch (error) {
        fail_count++
        errors.push({ commission_id, error: error.message })
      }
    }

    return new Response(
      JSON.stringify({ 
        success_count, 
        fail_count,
        errors: errors.length > 0 ? errors : undefined
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
