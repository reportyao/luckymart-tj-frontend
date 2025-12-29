import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-id',
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

    const url = new URL(req.url)
    const userId = url.searchParams.get('user_id')
    const action = url.searchParams.get('action') || 'summary'
    const period = url.searchParams.get('period') || 'all'
    const page = parseInt(url.searchParams.get('page') || '1')
    const pageSize = parseInt(url.searchParams.get('pageSize') || '20')
    const transactionType = url.searchParams.get('type')
    const status = url.searchParams.get('status')
    const startDate = url.searchParams.get('startDate')
    const endDate = url.searchParams.get('endDate')

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'user_id is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // 记录管理员操作日志
    const adminId = req.headers.get('X-Admin-Id')
    if (adminId) {
      try {
        await supabaseClient.from('admin_logs').insert({
          admin_id: adminId,
          action: `VIEW_USER_FINANCIAL_${action.toUpperCase()}`,
          target_type: 'user',
          target_id: userId,
          details: { period, page, pageSize, transactionType, status, startDate, endDate }
        })
      } catch (logError) {
        console.error('Failed to log admin action:', logError)
      }
    }

    if (action === 'summary') {
      // 获取财务汇总数据
      return await getFinancialSummary(supabaseClient, userId, period)
    } else if (action === 'transactions') {
      // 获取流水记录
      return await getTransactions(supabaseClient, userId, {
        page,
        pageSize,
        transactionType,
        status,
        startDate,
        endDate
      })
    } else if (action === 'export') {
      // 导出流水记录
      return await exportTransactions(supabaseClient, userId, {
        transactionType,
        status,
        startDate,
        endDate
      })
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )

  } catch (error) {
    console.error('Error in admin-user-financial:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

async function getFinancialSummary(supabaseClient: any, userId: string, period: string) {
  // 1. 获取钱包信息
  const { data: wallets, error: walletsError } = await supabaseClient
    .from('wallets')
    .select('*')
    .eq('user_id', userId)

  if (walletsError) throw walletsError

  const luckyCoinsWallet = wallets.find((w: any) => w.type === 'LUCKY_COIN')
  const cashWallet = wallets.find((w: any) => w.type === 'BALANCE')

  // 2. 获取佣金统计
  const { data: commissions, error: commissionsError } = await supabaseClient
    .from('commissions')
    .select('level, amount')
    .eq('user_id', userId)
    .eq('status', 'PAID')

  if (commissionsError) throw commissionsError

  const level1Commission = commissions.filter((c: any) => c.level === 1).reduce((sum: number, c: any) => sum + parseFloat(c.amount), 0)
  const level2Commission = commissions.filter((c: any) => c.level === 2).reduce((sum: number, c: any) => sum + parseFloat(c.amount), 0)
  const level3Commission = commissions.filter((c: any) => c.level === 3).reduce((sum: number, c: any) => sum + parseFloat(c.amount), 0)

  // 3. 计算时间范围
  let dateFilter = ''
  const now = new Date()
  
  if (period === 'today') {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    dateFilter = `created_at >= '${today.toISOString()}'`
  } else if (period === 'week') {
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    dateFilter = `created_at >= '${weekAgo.toISOString()}'`
  } else if (period === 'month') {
    const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
    dateFilter = `created_at >= '${monthAgo.toISOString()}'`
  }

  // 4. 获取时间段内的交易统计
  const walletIds = wallets.map((w: any) => w.id)
  
  let query = supabaseClient
    .from('wallet_transactions')
    .select('type, amount, status')
    .in('wallet_id', walletIds)
    .eq('status', 'COMPLETED')

  if (dateFilter) {
    const dateValue = dateFilter.split("'")[1]
    query = query.gte('created_at', dateValue)
  }

  const { data: transactions, error: transactionsError } = await query

  if (transactionsError) throw transactionsError

  const periodDeposits = transactions.filter((t: any) => t.type === 'DEPOSIT').reduce((sum: number, t: any) => sum + parseFloat(t.amount), 0)
  const periodWithdrawals = transactions.filter((t: any) => t.type === 'WITHDRAWAL').reduce((sum: number, t: any) => sum + parseFloat(t.amount), 0)
  const periodSpending = transactions.filter((t: any) => ['LOTTERY_PURCHASE', 'GROUP_BUY_PURCHASE', 'MARKET_PURCHASE'].includes(t.type)).reduce((sum: number, t: any) => sum + parseFloat(t.amount), 0)
  const periodIncome = transactions.filter((t: any) => ['LOTTERY_PRIZE', 'GROUP_BUY_WIN', 'REFERRAL_BONUS', 'MARKET_SALE'].includes(t.type)).reduce((sum: number, t: any) => sum + parseFloat(t.amount), 0)

  // 5. 获取全部交易统计
  const { data: allTransactions, error: allTransactionsError } = await supabaseClient
    .from('wallet_transactions')
    .select('type, amount')
    .in('wallet_id', walletIds)
    .eq('status', 'COMPLETED')

  if (allTransactionsError) throw allTransactionsError

  const totalSpending = allTransactions.filter((t: any) => ['LOTTERY_PURCHASE', 'GROUP_BUY_PURCHASE', 'MARKET_PURCHASE'].includes(t.type)).reduce((sum: number, t: any) => sum + parseFloat(t.amount), 0)
  const totalIncome = allTransactions.filter((t: any) => ['LOTTERY_PRIZE', 'GROUP_BUY_WIN', 'REFERRAL_BONUS', 'MARKET_SALE'].includes(t.type)).reduce((sum: number, t: any) => sum + parseFloat(t.amount), 0)

  // 6. 构建响应
  const summary = {
    // 余额信息
    luckyCoinsBalance: luckyCoinsWallet ? parseFloat(luckyCoinsWallet.balance) : 0,
    cashBalance: cashWallet ? parseFloat(cashWallet.balance) : 0,
    frozenBalance: (luckyCoinsWallet ? parseFloat(luckyCoinsWallet.frozen_balance) : 0) + (cashWallet ? parseFloat(cashWallet.frozen_balance) : 0),
    
    // 累计数据
    totalDeposits: cashWallet ? parseFloat(cashWallet.total_deposits) : 0,
    totalWithdrawals: cashWallet ? parseFloat(cashWallet.total_withdrawals) : 0,
    totalSpending,
    totalIncome,
    
    // 佣金数据
    level1Commission,
    level2Commission,
    level3Commission,
    totalCommission: level1Commission + level2Commission + level3Commission,
    
    // 时间段统计
    periodStats: {
      period,
      deposits: periodDeposits,
      withdrawals: periodWithdrawals,
      spending: periodSpending,
      income: periodIncome,
      netChange: periodDeposits + periodIncome - periodWithdrawals - periodSpending
    }
  }

  return new Response(
    JSON.stringify({ success: true, data: summary }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function getTransactions(supabaseClient: any, userId: string, options: any) {
  const { page, pageSize, transactionType, status, startDate, endDate } = options

  // 1. 获取用户钱包
  const { data: wallets, error: walletsError } = await supabaseClient
    .from('wallets')
    .select('id, type, currency')
    .eq('user_id', userId)

  if (walletsError) throw walletsError

  const walletIds = wallets.map((w: any) => w.id)
  const walletsMap = wallets.reduce((map: any, w: any) => {
    map[w.id] = w
    return map
  }, {})

  // 2. 构建查询
  let query = supabaseClient
    .from('wallet_transactions')
    .select('*', { count: 'exact' })
    .in('wallet_id', walletIds)
    .order('created_at', { ascending: false })

  if (transactionType) {
    query = query.eq('type', transactionType)
  }

  if (status) {
    query = query.eq('status', status)
  }

  if (startDate) {
    query = query.gte('created_at', startDate)
  }

  if (endDate) {
    query = query.lte('created_at', endDate)
  }

  // 分页
  const offset = (page - 1) * pageSize
  query = query.range(offset, offset + pageSize - 1)

  const { data: transactions, error: transactionsError, count } = await query

  if (transactionsError) throw transactionsError

  // 3. 增强交易数据
  const enhancedTransactions = transactions.map((t: any) => {
    const wallet = walletsMap[t.wallet_id]
    return {
      ...t,
      walletType: wallet.type,
      currency: wallet.currency,
      typeName: getTransactionTypeName(t.type),
      isIncome: isIncomeType(t.type)
    }
  })

  return new Response(
    JSON.stringify({
      success: true,
      data: {
        transactions: enhancedTransactions,
        pagination: {
          page,
          pageSize,
          total: count,
          totalPages: Math.ceil(count / pageSize)
        }
      }
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function exportTransactions(supabaseClient: any, userId: string, options: any) {
  const { transactionType, status, startDate, endDate } = options

  // 获取所有交易记录(不分页)
  const { data: wallets } = await supabaseClient
    .from('wallets')
    .select('id, type, currency')
    .eq('user_id', userId)

  const walletIds = wallets.map((w: any) => w.id)
  const walletsMap = wallets.reduce((map: any, w: any) => {
    map[w.id] = w
    return map
  }, {})

  let query = supabaseClient
    .from('wallet_transactions')
    .select('*')
    .in('wallet_id', walletIds)
    .order('created_at', { ascending: false })

  if (transactionType) query = query.eq('type', transactionType)
  if (status) query = query.eq('status', status)
  if (startDate) query = query.gte('created_at', startDate)
  if (endDate) query = query.lte('created_at', endDate)

  const { data: transactions } = await query

  // 生成CSV
  const headers = ['时间', '类型', '金额', '变化前余额', '变化后余额', '状态', '钱包类型', '货币', '描述', '关联订单ID']
  const rows = transactions.map((t: any) => {
    const wallet = walletsMap[t.wallet_id]
    return [
      t.created_at,
      getTransactionTypeName(t.type),
      t.amount,
      t.balance_before,
      t.balance_after,
      t.status,
      wallet.type,
      wallet.currency,
      t.description || '',
      t.related_order_id || ''
    ]
  })

  const csv = [headers, ...rows].map(row => row.join(',')).join('\n')

  return new Response(csv, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="user_${userId}_transactions_${new Date().toISOString()}.csv"`
    }
  })
}

function getTransactionTypeName(type: string): string {
  const typeNames: Record<string, string> = {
    'DEPOSIT': '充值',
    'WITHDRAWAL': '提现',
    'LOTTERY_PURCHASE': '积分商城消费',
    'LOTTERY_REFUND': '积分商城退款',
    'LOTTERY_PRIZE': '积分商城中奖',
    'REFERRAL_BONUS': '邀请奖励',
    'COIN_EXCHANGE': '币种兑换',
    'MARKET_PURCHASE': '市场购买',
    'MARKET_SALE': '市场出售',
    'ADMIN_ADJUSTMENT': '系统调整',
    'GROUP_BUY_PURCHASE': '拼团消费',
    'GROUP_BUY_REFUND': '拼团退款',
    'GROUP_BUY_WIN': '拼团中奖'
  }
  return typeNames[type] || type
}

function isIncomeType(type: string): boolean {
  return ['DEPOSIT', 'LOTTERY_PRIZE', 'GROUP_BUY_WIN', 'REFERRAL_BONUS', 'MARKET_SALE', 'LOTTERY_REFUND', 'GROUP_BUY_REFUND'].includes(type)
}
