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

    const { action, listing_id, user_id, data } = await req.json()

    switch (action) {
      case 'create': {
        // 创建转售
        const { lottery_entry_id, selling_price } = data

        // 验证彩票归属和状态
        const { data: entry, error: entryError } = await supabaseClient
          .from('lottery_entries')
          .select('*, lottery:lotteries(*)')
          .eq('id', lottery_entry_id)
          .eq('user_id', user_id)
          .single()

        if (entryError || !entry) {
          return new Response(
            JSON.stringify({ error: 'Invalid lottery entry or not owned by user' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          )
        }

        // 检查是否已开奖
        if (entry.lottery.status === 'DRAWN') {
          return new Response(
            JSON.stringify({ error: 'Cannot sell tickets for drawn lotteries' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          )
        }

        // 检查是否已经在转售
        const { data: existingListing } = await supabaseClient
          .from('market_listings')
          .select('id')
          .eq('lottery_entry_id', lottery_entry_id)
          .eq('status', 'AVAILABLE')
          .single()

        if (existingListing) {
          return new Response(
            JSON.stringify({ error: 'Ticket already listed for sale' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          )
        }

        // 计算折扣
        const originalPrice = entry.lottery.ticket_price
        const discountPercentage = Math.round(((originalPrice - selling_price) / originalPrice) * 100)

        // 创建转售记录
        const { data: listing, error: listingError } = await supabaseClient
          .from('market_listings')
          .insert({
            seller_id: user_id,
            lottery_entry_id,
            lottery_id: entry.lottery_id,
            original_price: originalPrice,
            selling_price,
            discount_percentage: discountPercentage,
            status: 'AVAILABLE'
          })
          .select()
          .single()

        if (listingError) {
          throw listingError
        }

        return new Response(
          JSON.stringify({ success: true, listing }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'purchase': {
        // 购买转售彩票
        const { data: listing, error: listingError } = await supabaseClient
          .from('market_listings')
          .select('*, lottery_entry:lottery_entries(*)')
          .eq('id', listing_id)
          .eq('status', 'AVAILABLE')
          .single()

        if (listingError || !listing) {
          return new Response(
            JSON.stringify({ error: 'Listing not found or already sold' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          )
        }

        // 不能购买自己的转售
        if (listing.seller_id === user_id) {
          return new Response(
            JSON.stringify({ error: 'Cannot purchase your own listing' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          )
        }

        // 检查买家余额
        const { data: buyerWallet } = await supabaseClient
          .from('wallets')
          .select('balance')
          .eq('user_id', user_id)
          .eq('currency', 'TJS')
          .single()

        if (!buyerWallet || buyerWallet.balance < listing.selling_price) {
          return new Response(
            JSON.stringify({ error: 'Insufficient balance' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          )
        }

        // 开始事务处理

        // 1. 扣除买家余额
        await supabaseClient
          .from('wallets')
          .update({
            balance: buyerWallet.balance - listing.selling_price,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user_id)
          .eq('currency', 'TJS')

        // 2. 增加卖家余额
        const { data: sellerWallet } = await supabaseClient
          .from('wallets')
          .select('balance')
          .eq('user_id', listing.seller_id)
          .eq('currency', 'TJS')
          .single()

        if (sellerWallet) {
          await supabaseClient
            .from('wallets')
            .update({
              balance: sellerWallet.balance + listing.selling_price,
              updated_at: new Date().toISOString()
            })
            .eq('user_id', listing.seller_id)
            .eq('currency', 'TJS')
        }

        // 3. 转移彩票归属
        await supabaseClient
          .from('lottery_entries')
          .update({
            user_id: user_id,
            updated_at: new Date().toISOString()
          })
          .eq('id', listing.lottery_entry_id)

        // 4. 更新转售状态
        await supabaseClient
          .from('market_listings')
          .update({
            status: 'SOLD',
            buyer_id: user_id,
            sold_at: new Date().toISOString()
          })
          .eq('id', listing_id)

        // 5. 创建交易记录
        await supabaseClient
          .from('wallet_transactions')
          .insert([
            {
              user_id: user_id,
              type: 'MARKET_PURCHASE',
              amount: -listing.selling_price,
              currency: 'TJS',
              status: 'COMPLETED',
              description: '购买转售彩票',
              metadata: { listing_id }
            },
            {
              user_id: listing.seller_id,
              type: 'MARKET_SALE',
              amount: listing.selling_price,
              currency: 'TJS',
              status: 'COMPLETED',
              description: '转售彩票收入',
              metadata: { listing_id }
            }
          ])

        // 6. 发送通知
        await supabaseClient
          .from('notifications')
          .insert([
            {
              user_id: user_id,
              type: 'MARKET_PURCHASED',
              title: '购买成功',
              content: `您已成功购买转售彩票,花费 ${listing.selling_price} TJS`,
              related_id: listing_id,
              related_type: 'market_listing',
              is_read: false
            },
            {
              user_id: listing.seller_id,
              type: 'MARKET_SOLD',
              title: '转售成功',
              content: `您的彩票已售出,获得 ${listing.selling_price} TJS`,
              related_id: listing_id,
              related_type: 'market_listing',
              is_read: false
            }
          ])

        return new Response(
          JSON.stringify({ success: true, message: 'Purchase completed' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'cancel': {
        // 取消转售
        const { data: listing, error: listingError } = await supabaseClient
          .from('market_listings')
          .select('*')
          .eq('id', listing_id)
          .eq('seller_id', user_id)
          .eq('status', 'AVAILABLE')
          .single()

        if (listingError || !listing) {
          return new Response(
            JSON.stringify({ error: 'Listing not found or cannot be cancelled' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          )
        }

        await supabaseClient
          .from('market_listings')
          .update({
            status: 'CANCELLED',
            cancelled_at: new Date().toISOString()
          })
          .eq('id', listing_id)

        return new Response(
          JSON.stringify({ success: true, message: 'Listing cancelled' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
    }

  } catch (error) {
    console.error('Error in market-manage function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
