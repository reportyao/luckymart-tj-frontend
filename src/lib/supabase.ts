import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://owyitxwxmxwbkqgzffdw.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93eWl0eHd4bXh3YmtxZ3pmZmR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI0MjM4NTMsImV4cCI6MjA3Nzk5OTg1M30.xsdiUmVfN9Cwa7jkusYubs4ZI34ZpYSdD_nsAB_X2w0'

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
    const { data, error } = await supabase.functions.invoke('auth-telegram', {
      body: { initData, startParam }
    })
    
    if (error) throw error
    return data
  }
}

export const lotteryService = {
  async getActiveLotteries() {
    const { data, error } = await supabase
      .from('lotteries')
      .select('*')
      .in('status', ['UPCOMING', 'ACTIVE'])
      .order('start_time', { ascending: true })
    
    if (error) throw error
    return data as Lottery[]
  },

  async purchaseTickets(lotteryId: string, quantity: number, paymentMethod: string, userNumbers?: string[]) {
    const { data, error } = await supabase.functions.invoke('lottery-purchase', {
      body: { lotteryId, quantity, paymentMethod, userNumbers }
    })
    
    if (error) throw error
    return data
  },

  async getUserEntries(userId: string) {
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
    
    if (error) throw error
    return data
  }
}

export const walletService = {
  async getWallets(userId: string) {
    const { data, error } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', userId)
    
    if (error) throw error
    return data as Wallet[]
  },

  async getBalance() {
    const { data, error } = await supabase.functions.invoke('wallet-transaction', {
      body: { action: 'balance' }
    })
    
    if (error) throw error
    return data
  },

  async exchangeCoins(sourceWalletType: string, targetWalletType: string, currency: string, amount: number) {
    const { data, error } = await supabase.functions.invoke('wallet-transaction', {
      body: { 
        action: 'exchange',
        walletType: sourceWalletType,
        targetWalletType,
        currency,
        amount
      }
    })
    
    if (error) throw error
    return data
  }
}