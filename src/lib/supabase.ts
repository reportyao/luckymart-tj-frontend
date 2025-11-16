import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing required environment variables: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. '
    + 'Please check your .env file and ensure all required variables are set.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Types for our application
export interface User {
  id: string
  telegram_id: string
  telegram_username?: string
  first_name?: string
  last_name?: string
  language_code: string
  referral_code: string
  status: 'ACTIVE' | 'SUSPENDED' | 'BANNED' | 'PENDING_VERIFICATION'
  is_verified: boolean
  kyc_level: 'NONE' | 'BASIC' | 'INTERMEDIATE' | 'ADVANCED'
  created_at: string
  updated_at: string
}

export interface Wallet {
  id: string
  user_id: string
  type: 'BALANCE' | 'LUCKY_COIN'
  currency: 'USD' | 'TJS'
  balance: number
  frozen_balance: number
  total_deposits: number
  total_withdrawals: number
  version: number
}

export interface Lottery {
  id: string
  period: string
  title: string
  description?: string
  image_url?: string
  ticket_price: number
  total_tickets: number
  max_per_user: number
  currency: 'USD' | 'TJS'
  status: 'UPCOMING' | 'ACTIVE' | 'SOLD_OUT' | 'DRAWING' | 'COMPLETED' | 'CANCELLED'
  sold_tickets: number
  winning_numbers?: string[]
  start_time: string
  end_time: string
  draw_time: string
  actual_draw_time?: string
}

export interface LotteryEntry {
  id: string
  user_id: string
  lottery_id: string
  order_id: string
  numbers: string
  is_winning: boolean
  prize_amount?: number
  prize_rank?: number
  status: 'ACTIVE' | 'TRANSFERRED' | 'REFUNDED'
}

export interface Order {
  id: string
  user_id: string
  order_number: string
  type: 'LOTTERY_PURCHASE' | 'MARKET_PURCHASE' | 'WALLET_RECHARGE'
  total_amount: number
  currency: 'USD' | 'TJS'
  payment_method: 'BALANCE_WALLET' | 'LUCKY_COIN_WALLET' | 'EXTERNAL_PAYMENT'
  lottery_id?: string
  quantity?: number
  status: 'PENDING' | 'PAID' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED' | 'REFUNDED' | 'FAILED'
  created_at: string
}

// API helper functions
export const authService = {
  async authenticateWithTelegram(initData: string, startParam?: string) {
    try {
      const { data, error } = await supabase.functions.invoke('auth-telegram', {
        body: { initData, startParam }
      })
      
      if (error) {
        console.error('Telegram authentication failed:', error)
        throw new Error(`Telegram 认证失败: ${error.message}`)
      }
      return data
    } catch (error) {
      console.error('authenticateWithTelegram error:', error)
      throw error
    }
  }
}

export const lotteryService = {
  async getActiveLotteries() {
    try {
      const { data, error } = await supabase
        .from('lotteries')
        .select('*')
        .in('status', ['UPCOMING', 'ACTIVE'])
        .order('start_time', { ascending: true })
      
      if (error) {
        console.error('Failed to fetch lotteries:', error)
        throw new Error(`获取夺宝列表失败: ${error.message}`)
      }
      return data as Lottery[]
    } catch (error) {
      console.error('getActiveLotteries error:', error)
      throw error
    }
  },

  async purchaseTickets(lotteryId: string, quantity: number, paymentMethod: string, userNumbers?: string[]) {
    try {
      const { data, error } = await supabase.functions.invoke('lottery-purchase', {
        body: { lotteryId, quantity, paymentMethod, userNumbers }
      })
      
      if (error) {
        console.error('Lottery purchase failed:', error)
        throw new Error(`购买失败: ${error.message}`)
      }
      return data
    } catch (error) {
      console.error('purchaseTickets error:', error)
      throw error
    }
  },

  async getUserEntries(userId: string) {
    try {
      const { data, error } = await supabase
        .from('lottery_entries')
        .select(`
          *,
          lotteries (
            period,
            title,
            ticket_price,
            currency,
            status,
            draw_time,
            winning_numbers
          ),
          orders (
            order_number,
            created_at
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error('Failed to fetch user entries:', error)
        throw new Error(`获取彩票记录失败: ${error.message}`)
      }
      return data
    } catch (error) {
      console.error('getUserEntries error:', error)
      throw error
    }
  }
}

export const walletService = {
  async getWallets(userId: string) {
    try {
      const { data, error } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', userId)
      
      if (error) {
        console.error('Failed to fetch wallets:', error)
        throw new Error(`获取钱包失败: ${error.message}`)
      }
      return data as Wallet[]
    } catch (error) {
      console.error('getWallets error:', error)
      throw error
    }
  },

  async getBalance() {
    try {
      const { data, error } = await supabase.functions.invoke('wallet-transaction', {
        body: { action: 'balance' }
      })
      
      if (error) {
        console.error('Failed to fetch balance:', error)
        throw new Error(`获取余额失败: ${error.message}`)
      }
      return data
    } catch (error) {
      console.error('getBalance error:', error)
      throw error
    }
  },

  async exchangeCoins(sourceWalletType: string, targetWalletType: string, currency: string, amount: number) {
    try {
      const { data, error } = await supabase.functions.invoke('wallet-transaction', {
        body: { 
          action: 'exchange',
          walletType: sourceWalletType,
          targetWalletType,
          currency,
          amount
        }
      })
      
      if (error) {
        console.error('Coin exchange failed:', error)
        throw new Error(`兑换失败: ${error.message}`)
      }
      return data
    } catch (error) {
      console.error('exchangeCoins error:', error)
      throw error
    }
  }
}