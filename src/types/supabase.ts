export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      commissions: {
        Row: {
          amount: number
          created_at: string
          currency: Database['public']['Enums']['Currency']
          id: string
          order_id: string | null
          referrer_id: string
          source_user_id: string
          status: Database['public']['Enums']['CommissionStatus']
          type: Database['public']['Enums']['CommissionType']
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency: Database['public']['Enums']['Currency']
          id?: string
          order_id?: string | null
          referrer_id: string
          source_user_id: string
          status?: Database['public']['Enums']['CommissionStatus']
          type: Database['public']['Enums']['CommissionType']
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: Database['public']['Enums']['Currency']
          id?: string
          order_id?: string | null
          referrer_id?: string
          source_user_id?: string
          status?: Database['public']['Enums']['CommissionStatus']
          type?: Database['public']['Enums']['CommissionType']
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commissions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_source_user_id_fkey"
            columns: ["source_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      deposits: {
        Row: {
          amount: number
          created_at: string
          currency: Database['public']['Enums']['Currency']
          id: string
          payment_method: Database['public']['Enums']['DepositMethod']
          status: Database['public']['Enums']['DepositStatus']
          transaction_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency: Database['public']['Enums']['Currency']
          id?: string
          payment_method: Database['public']['Enums']['DepositMethod']
          status?: Database['public']['Enums']['DepositStatus']
          transaction_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: Database['public']['Enums']['Currency']
          id?: string
          payment_method?: Database['public']['Enums']['DepositMethod']
          status?: Database['public']['Enums']['DepositStatus']
          transaction_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deposits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lottery_tickets: {
        Row: {
          created_at: string
          id: string
          lottery_id: string
          order_id: string
          ticket_number: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lottery_id: string
          order_id: string
          ticket_number: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lottery_id?: string
          order_id?: string
          ticket_number?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lottery_tickets_lottery_id_fkey"
            columns: ["lottery_id"]
            isOneToOne: false
            referencedRelation: "lotteries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lottery_tickets_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lottery_tickets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lotteries: {
        Row: {
          created_at: string
          description: Json
          end_time: string
          id: string
          image_url: string
          max_per_user: number
          period: string
          prize_details: Json
          prize_image_url: string
          prize_name: string
          sold_tickets: number
          start_time: string
          status: Database['public']['Enums']['LotteryStatus']
          ticket_price: number
          title: Json
          total_tickets: number
          updated_at: string
          winning_ticket_number: number | null
          winner_id: string | null
        }
        Insert: {
          created_at?: string
          description: Json
          end_time: string
          id?: string
          image_url: string
          max_per_user?: number
          period: string
          prize_details: Json
          prize_image_url: string
          prize_name: string
          sold_tickets?: number
          start_time: string
          status?: Database['public']['Enums']['LotteryStatus']
          ticket_price: number
          title: Json
          total_tickets: number
          updated_at?: string
          winning_ticket_number?: number | null
          winner_id?: string | null
        }
        Update: {
          created_at?: string
          description?: Json
          end_time?: string
          id?: string
          image_url?: string
          max_per_user?: number
          period?: string
          prize_details?: Json
          prize_image_url?: string
          prize_name?: string
          sold_tickets?: number
          start_time?: string
          status?: Database['public']['Enums']['LotteryStatus']
          ticket_price?: number
          title?: Json
          total_tickets?: number
          updated_at?: string
          winning_ticket_number?: number | null
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lotteries_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          currency: Database['public']['Enums']['Currency']
          id: string
          lottery_id: string
          quantity: number
          status: Database['public']['Enums']['OrderStatus']
          ticket_numbers: number[]
          total_amount: number
          tracking_number: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          currency: Database['public']['Enums']['Currency']
          id?: string
          lottery_id: string
          quantity: number
          status?: Database['public']['Enums']['OrderStatus']
          ticket_numbers: number[]
          total_amount: number
          tracking_number?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: Database['public']['Enums']['Currency']
          id?: string
          lottery_id?: string
          quantity?: number
          status?: Database['public']['Enums']['OrderStatus']
          ticket_numbers?: number[]
          total_amount?: number
          tracking_number?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_lottery_id_fkey"
            columns: ["lottery_id"]
            isOneToOne: false
            referencedRelation: "lotteries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          first_name: string
          id: string
          is_admin: boolean
          kyc_level: number
          last_name: string | null
          referral_code: string
          referrer_id: string | null
          status: string
          telegram_id: string
          telegram_username: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          first_name: string
          id: string
          is_admin?: boolean
          kyc_level?: number
          last_name?: string | null
          referral_code: string
          referrer_id?: string | null
          status?: string
          telegram_id: string
          telegram_username?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          first_name?: string
          id?: string
          is_admin?: boolean
          kyc_level?: number
          last_name?: string | null
          referral_code?: string
          referrer_id?: string | null
          status?: string
          telegram_id?: string
          telegram_username?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      showoffs: {
        Row: {
          comments_count: number
          content: string
          created_at: string
          id: string
          images: string[]
          likes_count: number
          lottery_id: string
          prize_name: string
          status: Database['public']['Enums']['ShowoffStatus']
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          comments_count?: number
          content: string
          created_at?: string
          id?: string
          images: string[]
          likes_count?: number
          lottery_id: string
          prize_name: string
          status?: Database['public']['Enums']['ShowoffStatus']
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          comments_count?: number
          content?: string
          created_at?: string
          id?: string
          images?: string[]
          likes_count?: number
          lottery_id?: string
          prize_name?: string
          status?: Database['public']['Enums']['ShowoffStatus']
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "showoffs_lottery_id_fkey"
            columns: ["lottery_id"]
            isOneToOne: false
            referencedRelation: "lotteries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "showoffs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          balance: number
          created_at: string
          currency: Database['public']['Enums']['Currency']
          id: string
          type: Database['public']['Enums']['WalletType']
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          currency: Database['public']['Enums']['Currency']
          id?: string
          type: Database['public']['Enums']['WalletType']
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          currency?: Database['public']['Enums']['Currency']
          id?: string
          type?: Database['public']['Enums']['WalletType']
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      withdrawals: {
        Row: {
          amount: number
          created_at: string
          currency: Database['public']['Enums']['Currency']
          id: string
          status: Database['public']['Enums']['WithdrawalStatus']
          updated_at: string
          user_id: string
          withdrawal_address: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency: Database['public']['Enums']['Currency']
          id?: string
          status?: Database['public']['Enums']['WithdrawalStatus']
          updated_at?: string
          user_id: string
          withdrawal_address: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: Database['public']['Enums']['Currency']
          id?: string
          status?: Database['public']['Enums']['WithdrawalStatus']
          updated_at?: string
          user_id?: string
          withdrawal_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_referral_stats: {
        Args: {
          p_user_id: string
        }
        Returns: {
          total_referrals: number
          level1_referrals: number
          level2_referrals: number
          level3_referrals: number
          total_commission: number
          paid_commission: number
          pending_commission: number
        }[]
      }
      get_user_wallet_balance: {
        Args: {
          p_user_id: string
          p_currency: Database['public']['Enums']['Currency']
        }
        Returns: number
      }
      handle_new_user: {
        Args: {
          p_user_id: string
          p_email: string
          p_full_name: string
          p_referrer_id: string
        }
        Returns: undefined
      }
      is_admin: {
        Args: {
          user_id: string
        }
        Returns: boolean
      }
      place_lottery_order: {
        Args: {
          p_user_id: string
          p_lottery_id: string
          p_ticket_count: number
        }
        Returns: string
      }
    }
    Enums: {
      CommentStatus: "PENDING" | "APPROVED" | "REJECTED"
      CommissionStatus: "PENDING" | "PAID" | "CANCELLED"
      CommissionType: "LOTTERY_PURCHASE" | "REFERRAL_BONUS"
      Currency: "CNY" | "USD" | "EUR" | "VND"
      DepositMethod: "BANK_TRANSFER" | "CRYPTO" | "WECHAT" | "ALIPAY"
      DepositStatus: "PENDING" | "APPROVED" | "REJECTED"
      ExchangeType: "BALANCE_TO_COMMISSION" | "COMMISSION_TO_BALANCE"
      LotteryStatus: "ACTIVE" | "CANCELLED" | "DRAWN" | "PENDING"
      OrderStatus: "CANCELLED" | "PAID" | "PENDING" | "REFUNDED"
      PostStatus: "APPROVED" | "PENDING" | "REJECTED"
      ShowoffStatus: "APPROVED" | "PENDING" | "REJECTED"
      UserRole: "ADMIN" | "SUPER_ADMIN" | "USER"
      WalletType: "BALANCE" | "COMMISSION"
      WithdrawalStatus: "APPROVED" | "PENDING" | "REJECTED"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, 'public'>]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema['Tables'] | PublicSchema['Views'])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof PublicSchema['Tables']
    : PublicTableNameOrOptions extends keyof PublicSchema['Tables']
      ? PublicTableNameOrOptions
      : never
> = TableName extends keyof PublicSchema['Tables']
  ? PublicSchema['Tables'][TableName] extends {
      Row: infer R
      Insert: infer I
      Update: infer U
    }
    ? { Row: R; Insert: I; Update: U }
    : never
  : never

export type TablesInsert<
  PublicTableNameOrOptions extends keyof PublicSchema['Tables'] | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof PublicSchema['Tables']
    : PublicTableNameOrOptions extends keyof PublicSchema['Tables']
      ? PublicTableNameOrOptions
      : never
> = TableName extends keyof PublicSchema['Tables']
  ? PublicSchema['Tables'][TableName] extends { Insert: infer I }
    ? I
    : never
  : never

export type TablesUpdate<
  PublicTableNameOrOptions extends keyof PublicSchema['Tables'] | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof PublicSchema['Tables']
    : PublicTableNameOrOptions extends keyof PublicSchema['Tables']
      ? PublicTableNameOrOptions
      : never
> = TableName extends keyof PublicSchema['Tables']
  ? PublicSchema['Tables'][TableName] extends { Update: infer U }
    ? U
    : never
  : never

export type Enums<
  PublicEnumNameOrOptions extends keyof PublicSchema['Enums'] | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof PublicSchema['Enums']
    : PublicEnumNameOrOptions extends keyof PublicSchema['Enums']
      ? PublicEnumNameOrOptions
      : never
> = EnumName extends keyof PublicSchema['Enums'] ? PublicSchema['Enums'][EnumName] : never

// Custom types for convenience
export type Profile = Tables<'profiles'>['Row']
export type Wallet = Tables<'wallets'>['Row']
export type Lottery = Tables<'lotteries'>['Row']
export type Order = Tables<'orders'>['Row']
export type Showoff = Tables<'showoffs'>['Row']
export type Commission = Tables<'commissions'>['Row']
export type Deposit = Tables<'deposits'>['Row']
export type Withdrawal = Tables<'withdrawals'>['Row']

// RPC types
export type UserReferralStats = Awaited<ReturnType<Database['public']['Functions']['get_user_referral_stats']>>[number]
export type LotteryOrderResult = Awaited<ReturnType<Database['public']['Functions']['place_lottery_order']>>
