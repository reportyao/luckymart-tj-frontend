export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string;
          created_at: string;
          description: string | null;
          name_i18n: Json | null;
          description_i18n: Json | null;
          details_i18n: Json | null;
          id: string;
          ip_address: string | null;
          new_data: Json | null;
          old_data: Json | null;
          resource: string;
          resource_id: string | null;
          user_agent: string | null;
          user_id: string | null;
        };
        Insert: {
          action: string;
          created_at?: string;
          description?: string | null;
          name_i18n?: Json | null;
          description_i18n?: Json | null;
          details_i18n?: Json | null;
          id?: string;
          ip_address?: string | null;
          new_data?: Json | null;
          old_data?: Json | null;
          resource: string;
          resource_id?: string | null;
          user_agent?: string | null;
          user_id?: string | null;
        };
        Update: {
          action?: string;
          created_at?: string;
          description?: string | null;
          name_i18n?: Json | null;
          description_i18n?: Json | null;
          details_i18n?: Json | null;
          id?: string;
          ip_address?: string | null;
          new_data?: Json | null;
          old_data?: Json | null;
          resource?: string;
          resource_id?: string | null;
          user_agent?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      bot_command_stats: {
        Row: {
          command: string;
          created_at: string | null;
          id: string;
          last_used_at: string | null;
          updated_at: string | null;
          usage_count: number | null;
          user_id: string;
        };
        Insert: {
          command: string;
          created_at?: string | null;
          id?: string;
          last_used_at?: string | null;
          updated_at?: string | null;
          usage_count?: number | null;
          user_id: string;
        };
        Update: {
          command?: string;
          created_at?: string | null;
          id?: string;
          last_used_at?: string | null;
          updated_at?: string | null;
          usage_count?: number | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bot_command_stats_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      bot_messages: {
        Row: {
          command: string | null;
          content: string | null;
          created_at: string | null;
          error_message: string | null;
          id: string;
          message_type: string;
          response_content: string | null;
          response_sent: boolean | null;
          telegram_chat_id: number;
          telegram_message_id: number;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          command?: string | null;
          content?: string | null;
          created_at?: string | null;
          error_message?: string | null;
          id?: string;
          message_type?: string;
          response_content?: string | null;
          response_sent?: boolean | null;
          telegram_chat_id: number;
          telegram_message_id: number;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          command?: string | null;
          content?: string | null;
          created_at?: string | null;
          error_message?: string | null;
          id?: string;
          message_type?: string;
          response_content?: string | null;
          response_sent?: boolean | null;
          telegram_chat_id?: number;
          telegram_message_id?: number;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bot_messages_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      bot_sessions: {
        Row: {
          context_data: Json | null;
          created_at: string | null;
          current_state: string | null;
          expires_at: string | null;
          id: string;
          telegram_chat_id: number;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          context_data?: Json | null;
          created_at?: string | null;
          current_state?: string | null;
          expires_at?: string | null;
          id?: string;
          telegram_chat_id: number;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          context_data?: Json | null;
          created_at?: string | null;
          current_state?: string | null;
          expires_at?: string | null;
          id?: string;
          telegram_chat_id?: number;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bot_sessions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      bot_user_settings: {
        Row: {
          created_at: string | null;
          daily_summary: boolean | null;
          id: string;
          language_code: string | null;
          lottery_notifications: boolean | null;
          notifications_enabled: boolean | null;
          quiet_hours_end: string | null;
          quiet_hours_start: string | null;
          referral_notifications: boolean | null;
          system_notifications: boolean | null;
          telegram_chat_id: number;
          timezone: string | null;
          updated_at: string | null;
          user_id: string;
          wallet_notifications: boolean | null;
        };
        Insert: {
          created_at?: string | null;
          daily_summary?: boolean | null;
          id?: string;
          language_code?: string | null;
          lottery_notifications?: boolean | null;
          notifications_enabled?: boolean | null;
          quiet_hours_end?: string | null;
          quiet_hours_start?: string | null;
          referral_notifications?: boolean | null;
          system_notifications?: boolean | null;
          telegram_chat_id: number;
          timezone?: string | null;
          updated_at?: string | null;
          user_id: string;
          wallet_notifications?: boolean | null;
        };
        Update: {
          created_at?: string | null;
          daily_summary?: boolean | null;
          id?: string;
          language_code?: string | null;
          lottery_notifications?: boolean | null;
          notifications_enabled?: boolean | null;
          quiet_hours_end?: string | null;
          quiet_hours_start?: string | null;
          referral_notifications?: boolean | null;
          system_notifications?: boolean | null;
          telegram_chat_id?: number;
          timezone?: string | null;
          updated_at?: string | null;
          user_id?: string;
          wallet_notifications?: boolean | null;
        };
        Relationships: [
          {
            foreignKeyName: "bot_user_settings_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      comments: {
        Row: {
          content: string;
          created_at: string;
          id: string;
          parent_id: string | null;
          post_id: string;
          status: Database["public"]["Enums"]["CommentStatus"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          content: string;
          created_at?: string;
          id?: string;
          parent_id?: string | null;
          post_id: string;
          status?: Database["public"]["Enums"]["CommentStatus"];
          updated_at: string;
          user_id: string;
        };
        Update: {
          content?: string;
          created_at?: string;
          id?: string;
          parent_id?: string | null;
          post_id?: string;
          status?: Database["public"]["Enums"]["CommentStatus"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "comments_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "comments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comments_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comments_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      commissions: {
        Row: {
          amount: number;
          created_at: string;
          from_user_id: string;
          id: string;
          level: number;
          paid_at: string | null;
          rate: number;
          related_lottery_id: string | null;
          related_order_id: string | null;
          source_amount: number;
          status: Database["public"]["Enums"]["CommissionStatus"];
          type: Database["public"]["Enums"]["CommissionType"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          amount: number;
          created_at?: string;
          from_user_id: string;
          id?: string;
          level: number;
          paid_at?: string | null;
          rate: number;
          related_lottery_id?: string | null;
          related_order_id?: string | null;
          source_amount: number;
          status?: Database["public"]["Enums"]["CommissionStatus"];
          type: Database["public"]["Enums"]["CommissionType"];
          updated_at: string;
          user_id: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          from_user_id?: string;
          id?: string;
          level?: number;
          paid_at?: string | null;
          rate?: number;
          related_lottery_id?: string | null;
          related_order_id?: string | null;
          source_amount?: number;
          status?: Database["public"]["Enums"]["CommissionStatus"];
          type?: Database["public"]["Enums"]["CommissionType"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "commissions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      deposit_requests: {
        Row: {
          admin_id: string | null;
          admin_note: string | null;
          amount: number;
          created_at: string;
          currency: string;
          id: string;
          order_number: string;
          payer_account: string | null;
          payer_name: string | null;
          payment_method: Database["public"]["Enums"]["DepositMethod"];
          payment_proof_images: Json | null;
          payment_reference: string | null;
          reviewed_at: string | null;
          status: Database["public"]["Enums"]["DepositStatus"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          admin_id?: string | null;
          admin_note?: string | null;
          amount: number;
          created_at?: string;
          currency?: string;
          id?: string;
          order_number: string;
          payer_account?: string | null;
          payer_name?: string | null;
          payment_method: Database["public"]["Enums"]["DepositMethod"];
          payment_proof_images?: Json | null;
          payment_reference?: string | null;
          reviewed_at?: string | null;
          status?: Database["public"]["Enums"]["DepositStatus"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          admin_id?: string | null;
          admin_note?: string | null;
          amount?: number;
          created_at?: string;
          currency?: string;
          id?: string;
          order_number?: string;
          payer_account?: string | null;
          payer_name?: string | null;
          payment_method: Database["public"]["Enums"]["DepositMethod"];
          payment_proof_images?: Json | null;
          payment_reference?: string | null;
          reviewed_at?: string | null;
          status?: Database["public"]["Enums"]["DepositStatus"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "deposit_requests_admin_id_fkey";
            columns: ["admin_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "deposit_requests_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      deposits: {
        Row: {
          admin_note: string | null;
          amount: number;
          created_at: string | null;
          currency: string | null;
          id: string;
          payer_account: string | null;
          payer_name: string | null;
          payment_method: string | null;
          payment_proof_images: string[] | null;
          reviewed_at: string | null;
          status: string | null;
          updated_at: string | null;
          user_id: string | null;
        };
        Insert: {
          admin_note?: string | null;
          amount: number;
          created_at?: string | null;
          currency?: string | null;
          id?: string;
          payer_account?: string | null;
          payer_name?: string | null;
          payment_method?: string | null;
          payment_proof_images?: string[] | null;
          reviewed_at?: string | null;
          status?: string | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          admin_note?: string | null;
          amount?: number;
          created_at?: string | null;
          currency?: string | null;
          id?: string;
          payer_account?: string | null;
          payer_name?: string | null;
          payment_method?: string | null;
          payment_proof_images?: string[] | null;
          reviewed_at?: string | null;
          status?: string | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      exchange_records: {
        Row: {
          amount: number;
          created_at: string;
          currency: string;
          exchange_rate: number;
          exchange_type: Database["public"]["Enums"]["ExchangeType"];
          id: string;
          source_balance_after: number;
          source_balance_before: number;
          source_wallet_id: string;
          target_balance_after: number;
          target_balance_before: number;
          target_wallet_id: string;
          user_id: string;
        };
        Insert: {
          amount: number;
          created_at?: string;
          currency?: string;
          exchange_rate?: number;
          exchange_type: Database["public"]["Enums"]["ExchangeType"];
          id?: string;
          source_balance_after: number;
          source_balance_before: number;
          source_wallet_id: string;
          target_balance_after: number;
          target_balance_before: number;
          target_wallet_id: string;
          user_id: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          currency?: string;
          exchange_rate?: number;
          exchange_type?: Database["public"]["Enums"]["ExchangeType"];
          id?: string;
          source_balance_after?: number;
          source_balance_before?: number;
          source_wallet_id?: string;
          target_balance_after?: number;
          target_balance_before?: number;
          target_wallet_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "exchange_records_source_wallet_id_fkey";
            columns: ["source_wallet_id"];
            isOneToOne: false;
            referencedRelation: "wallets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "exchange_records_target_wallet_id_fkey";
            columns: ["target_wallet_id"];
            isOneToOne: false;
            referencedRelation: "wallets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "exchange_records_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      likes: {
        Row: {
          created_at: string;
          id: string;
          post_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          post_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          post_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "likes_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "likes_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      lotteries: {
        Row: {
          actual_draw_time: string | null;
          created_at: string;
          currency: Database["public"]["Enums"]["Currency"];
          description: string | null;
          name_i18n: Json | null;
          description_i18n: Json | null;
          details_i18n: Json | null;
          draw_time: string;
          end_time: string;
          id: string;
          image_url: string | null;
          max_per_user: number;
          period: string;
          sold_tickets: number;
          start_time: string;
          status: Database["public"]["Enums"]["LotteryStatus"];
          ticket_price: number;
          title: string;
          total_tickets: number;
          updated_at: string;
          vrf_proof: string | null;
          vrf_seed: string | null;
          vrf_timestamp: number | null;
          winning_numbers: Json | null;
          winner_id: string | null;
        };
        Insert: {
          actual_draw_time?: string | null;
          created_at?: string;
          currency: Database["public"]["Enums"]["Currency"];
          description?: string | null;
          name_i18n?: Json | null;
          description_i18n?: Json | null;
          details_i18n?: Json | null;
          draw_time: string;
          end_time: string;
          id?: string;
          image_url?: string | null;
          max_per_user: number;
          period: string;
          sold_tickets?: number;
          start_time: string;
          status: Database["public"]["Enums"]["LotteryStatus"];
          ticket_price: number;
          title: string;
          total_tickets: number;
          updated_at?: string;
          vrf_proof?: string | null;
          vrf_seed?: string | null;
          vrf_timestamp?: number | null;
          winning_numbers?: Json | null;
          winner_id?: string | null;
        };
        Update: {
          actual_draw_time?: string | null;
          created_at?: string;
          currency?: Database["public"]["Enums"]["Currency"];
          description?: string | null;
          name_i18n?: Json | null;
          description_i18n?: Json | null;
          details_i18n?: Json | null;
          draw_time?: string;
          end_time?: string;
          id?: string;
          image_url?: string | null;
          max_per_user?: number;
          period?: string;
          sold_tickets?: number;
          start_time?: string;
          status: Database["public"]["Enums"]["LotteryStatus"];
          ticket_price?: number;
          title?: string;
          total_tickets?: number;
          updated_at?: string;
          vrf_proof?: string | null;
          vrf_seed?: string | null;
          vrf_timestamp?: number | null;
          winning_numbers?: Json | null;
          winner_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "lotteries_winner_id_fkey";
            columns: ["winner_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      lottery_results: {
        Row: {
          created_at: string | null;
          draw_time: string | null;
          id: string;
          lottery_id: string | null;
          total_numbers: number | null;
          total_sum: string | null;
          winning_number: number | null;
        };
        Insert: {
          created_at?: string | null;
          draw_time?: string | null;
          id?: string;
          lottery_id?: string | null;
          total_numbers?: number | null;
          total_sum?: string | null;
          winning_number?: number | null;
        };
        Update: {
          created_at?: string | null;
          draw_time?: string | null;
          id?: string;
          lottery_id?: string | null;
          total_numbers?: number | null;
          total_sum?: string | null;
          winning_number?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "lottery_results_lottery_id_fkey";
            columns: ["lottery_id"];
            isOneToOne: true;
            referencedRelation: "lotteries";
            referencedColumns: ["id"];
          }
        ];
      };
      notifications: {
        Row: {
          content: Json | null;
          created_at: string;
          id: string;
          is_read: boolean;
          recipient_id: string;
          related_entity_id: string | null;
          related_entity_type: string | null;
          title: string | null;
          type: Database["public"]["Enums"]["NotificationType"];
          updated_at: string;
        };
        Insert: {
          content?: Json | null;
          created_at?: string;
          id?: string;
          is_read?: boolean;
          recipient_id: string;
          related_entity_id?: string | null;
          related_entity_type?: string | null;
          title?: string | null;
          type: Database["public"]["Enums"]["NotificationType"];
          updated_at?: string;
        };
        Update: {
          content?: Json | null;
          created_at?: string;
          id?: string;
          is_read?: boolean;
          recipient_id?: string;
          related_entity_id?: string | null;
          related_entity_type?: string | null;
          title?: string | null;
          type: Database["public"]["Enums"]["NotificationType"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_recipient_id_fkey";
            columns: ["recipient_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      orders: {
        Row: {
          amount: number;
          created_at: string;
          currency: Database["public"]["Enums"]["Currency"];
          id: string;
          lottery_id: string | null;
          order_number: string;
          payment_method: string | null;
          payment_status: Database["public"]["Enums"]["PaymentStatus"];
          quantity: number;
          status: Database["public"]["Enums"]["OrderStatus"];
          total_amount: number;
          type: Database["public"]["Enums"]["TransactionType"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          amount: number;
          created_at?: string;
          currency: Database["public"]["Enums"]["Currency"];
          id?: string;
          lottery_id?: string | null;
          order_number: string;
          payment_method?: string | null;
          payment_status?: Database["public"]["Enums"]["PaymentStatus"];
          quantity: number;
          status?: Database["public"]["Enums"]["OrderStatus"];
          total_amount: number;
          type: Database["public"]["Enums"]["TransactionType"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          currency?: Database["public"]["Enums"]["Currency"];
          id?: string;
          lottery_id?: string | null;
          order_number?: string;
          payment_method?: string | null;
          payment_status?: Database["public"]["Enums"]["PaymentStatus"];
          quantity?: number;
          status?: Database["public"]["Enums"]["OrderStatus"];
          total_amount?: number;
          type: Database["public"]["Enums"]["TransactionType"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "orders_lottery_id_fkey";
            columns: ["lottery_id"];
            isOneToOne: false;
            referencedRelation: "lotteries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      payment_methods: {
        Row: {
          account_name: string | null;
          account_number: string | null;
          bank_name: string | null;
          created_at: string;
          details: Json | null;
          id: string;
          is_active: boolean;
          max_amount: number | null;
          min_amount: number | null;
          name: string;
          processing_time: string | null;
          type: Database["public"]["Enums"]["PaymentMethodType"];
          updated_at: string;
        };
        Insert: {
          account_name?: string | null;
          account_number?: string | null;
          bank_name?: string | null;
          created_at?: string;
          details?: Json | null;
          id?: string;
          is_active?: boolean;
          max_amount?: number | null;
          min_amount?: number | null;
          name: string;
          processing_time?: string | null;
          type: Database["public"]["Enums"]["PaymentMethodType"];
          updated_at?: string;
        };
        Update: {
          account_name?: string | null;
          account_number?: string | null;
          bank_name?: string | null;
          created_at?: string;
          details?: Json | null;
          id?: string;
          is_active?: boolean;
          max_amount?: number | null;
          min_amount?: number | null;
          name?: string;
          processing_time?: string | null;
          type: Database["public"]["Enums"]["PaymentMethodType"];
          updated_at?: string;
        };
        Relationships: [];
      };
      posts: {
        Row: {
          content: string;
          created_at: string;
          id: string;
          status: Database["public"]["Enums"]["PostStatus"];
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          content: string;
          created_at?: string;
          id?: string;
          status?: Database["public"]["Enums"]["PostStatus"];
          title: string;
          updated_at: string;
          user_id: string;
        };
        Update: {
          content?: string;
          created_at?: string;
          id?: string;
          status?: Database["public"]["Enums"]["PostStatus"];
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "posts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          full_name: string | null;
          id: string;
          updated_at: string | null;
          username: string | null;
          website: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          full_name?: string | null;
          id: string;
          updated_at?: string | null;
          username?: string | null;
          website?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          full_name?: string | null;
          id?: string;
          updated_at?: string | null;
          username?: string | null;
          website?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      referrals: {
        Row: {
          created_at: string;
          id: string;
          referral_code: string;
          referred_by: string;
          referred_user_id: string;
          status: Database["public"]["Enums"]["ReferralStatus"];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          referral_code: string;
          referred_by: string;
          referred_user_id: string;
          status?: Database["public"]["Enums"]["ReferralStatus"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          referral_code?: string;
          referred_by?: string;
          referred_user_id?: string;
          status?: Database["public"]["Enums"]["ReferralStatus"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "referrals_referred_by_fkey";
            columns: ["referred_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "referrals_referred_user_id_fkey";
            columns: ["referred_user_id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      reports: {
        Row: {
          created_at: string;
          description: string | null;
          name_i18n: Json | null;
          description_i18n: Json | null;
          details_i18n: Json | null;
          id: string;
          reported_entity_id: string;
          reported_entity_type: Database["public"]["Enums"]["ReportedEntityType"];
          reporter_id: string;
          status: Database["public"]["Enums"]["ReportStatus"];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          name_i18n?: Json | null;
          description_i18n?: Json | null;
          details_i18n?: Json | null;
          id?: string;
          reported_entity_id: string;
          reported_entity_type: Database["public"]["Enums"]["ReportedEntityType"];
          reporter_id: string;
          status?: Database["public"]["Enums"]["ReportStatus"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          name_i18n?: Json | null;
          description_i18n?: Json | null;
          details_i18n?: Json | null;
          id?: string;
          reported_entity_id?: string;
          reported_entity_type?: Database["public"]["Enums"]["ReportedEntityType"];
          reporter_id?: string;
          status?: Database["public"]["Enums"]["ReportStatus"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reports_reporter_id_fkey";
            columns: ["reporter_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      schema_migrations: {
        Row: {
          version: string;
        };
        Insert: {
          version: string;
        };
        Update: {
          version?: string;
        };
        Relationships: [];
      };
      settings: {
        Row: {
          created_at: string;
          id: string;
          key: string;
          updated_at: string;
          value: Json | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          key: string;
          updated_at?: string;
          value?: Json | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          key?: string;
          updated_at?: string;
          value?: Json | null;
        };
        Relationships: [];
      };
      showoffs: {
        Row: {
          content: string | null;
          created_at: string;
          id: string;
          images: Json | null;
          likes_count: number;
          lottery_id: string;
          status: Database["public"]["Enums"]["ShowoffStatus"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          content?: string | null;
          created_at?: string;
          id?: string;
          images?: Json | null;
          likes_count?: number;
          lottery_id: string;
          status?: Database["public"]["Enums"]["ShowoffStatus"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          content?: string | null;
          created_at?: string;
          id?: string;
          images?: Json | null;
          likes_count?: number;
          lottery_id?: string;
          status?: Database["public"]["Enums"]["ShowoffStatus"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "showoffs_lottery_id_fkey";
            columns: ["lottery_id"];
            isOneToOne: false;
            referencedRelation: "lotteries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "showoffs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      system_configs: {
        Row: {
          config_key: string;
          config_value: Json | null;
          created_at: string | null;
          description: string | null;
          name_i18n: Json | null;
          description_i18n: Json | null;
          details_i18n: Json | null;
          id: string;
          updated_at: string | null;
        };
        Insert: {
          config_key: string;
          config_value?: Json | null;
          created_at?: string | null;
          description?: string | null;
          name_i18n?: Json | null;
          description_i18n?: Json | null;
          details_i18n?: Json | null;
          id?: string;
          updated_at?: string | null;
        };
        Update: {
          config_key?: string;
          config_value?: Json | null;
          created_at?: string | null;
          description?: string | null;
          name_i18n?: Json | null;
          description_i18n?: Json | null;
          details_i18n?: Json | null;
          id?: string;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      tickets: {
        Row: {
          created_at: string;
          id: string;
          lottery_id: string;
          order_id: string;
          ticket_number: number;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          lottery_id: string;
          order_id: string;
          ticket_number: number;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          lottery_id?: string;
          order_id?: string;
          ticket_number?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tickets_lottery_id_fkey";
            columns: ["lottery_id"];
            isOneToOne: false;
            referencedRelation: "lotteries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tickets_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tickets_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      transactions: {
        Row: {
          amount: number;
          balance_after: number;
          balance_before: number;
          created_at: string;
          currency: Database["public"]["Enums"]["Currency"];
          description: string | null;
          name_i18n: Json | null;
          description_i18n: Json | null;
          details_i18n: Json | null;
          id: string;
          related_entity_id: string | null;
          related_entity_type: string | null;
          status: Database["public"]["Enums"]["TransactionStatus"];
          type: Database["public"]["Enums"]["TransactionType"];
          updated_at: string;
          user_id: string;
          wallet_id: string;
        };
        Insert: {
          amount: number;
          balance_after: number;
          balance_before: number;
          created_at?: string;
          currency: Database["public"]["Enums"]["Currency"];
          description?: string | null;
          name_i18n?: Json | null;
          description_i18n?: Json | null;
          details_i18n?: Json | null;
          id?: string;
          related_entity_id?: string | null;
          related_entity_type?: string | null;
          status?: Database["public"]["Enums"]["TransactionStatus"];
          type: Database["public"]["Enums"]["TransactionType"];
          updated_at?: string;
          user_id: string;
          wallet_id: string;
        };
        Update: {
          amount?: number;
          balance_after?: number;
          balance_before?: number;
          created_at?: string;
          currency?: Database["public"]["Enums"]["Currency"];
          description?: string | null;
          name_i18n?: Json | null;
          description_i18n?: Json | null;
          details_i18n?: Json | null;
          id?: string;
          related_entity_id?: string | null;
          related_entity_type?: string | null;
          status?: Database["public"]["Enums"]["TransactionStatus"];
          type?: Database["public"]["Enums"]["TransactionType"];
          updated_at?: string;
          user_id?: string;
          wallet_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "transactions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transactions_wallet_id_fkey";
            columns: ["wallet_id"];
            isOneToOne: false;
            referencedRelation: "wallets";
            referencedColumns: ["id"];
          }
        ];
      };
      user_profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string | null;
          first_name: string | null;
          id: string;
          language_code: string | null;
          last_name: string | null;
          referral_code: string;
          referred_by: string | null;
          role: Database["public"]["Enums"]["UserRole"];
          status: Database["public"]["Enums"]["UserStatus"];
          telegram_id: number | null;
          updated_at: string | null;
          username: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string | null;
          first_name?: string | null;
          id: string;
          language_code?: string | null;
          last_name?: string | null;
          referral_code: string;
          referred_by?: string | null;
          role?: Database["public"]["Enums"]["UserRole"];
          status?: Database["public"]["Enums"]["UserStatus"];
          telegram_id?: number | null;
          updated_at?: string | null;
          username?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string | null;
          first_name?: string | null;
          id?: string;
          language_code?: string | null;
          last_name?: string | null;
          referral_code?: string;
          referred_by?: string | null;
          role?: Database["public"]["Enums"]["UserRole"];
          status?: Database["public"]["Enums"]["UserStatus"];
          telegram_id?: number | null;
          updated_at?: string | null;
          username?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "user_profiles_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_profiles_referred_by_fkey";
            columns: ["referred_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      wallets: {
        Row: {
          balance: number;
          created_at: string;
          currency: Database["public"]["Enums"]["Currency"];
          id: string;
          type: Database["public"]["Enums"]["WalletType"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          balance?: number;
          created_at?: string;
          currency: Database["public"]["Enums"]["Currency"];
          id?: string;
          type: Database["public"]["Enums"]["WalletType"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          balance?: number;
          created_at?: string;
          currency?: Database["public"]["Enums"]["Currency"];
          id?: string;
          type?: Database["public"]["Enums"]["WalletType"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "wallets_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      withdrawal_requests: {
        Row: {
          admin_id: string | null;
          admin_note: string | null;
          amount: number;
          bank_account_name: string | null;
          bank_account_number: string | null;
          bank_name: string | null;
          created_at: string;
          currency: string;
          id: string;
          identity_info: Json | null;
          order_number: string;
          reviewed_at: string | null;
          status: Database["public"]["Enums"]["WithdrawalStatus"];
          updated_at: string;
          user_id: string;
          withdrawal_method: Database["public"]["Enums"]["WithdrawalMethod"];
        };
        Insert: {
          admin_id?: string | null;
          admin_note?: string | null;
          amount: number;
          bank_account_name?: string | null;
          bank_account_number?: string | null;
          bank_name?: string | null;
          created_at?: string;
          currency?: string;
          id?: string;
          identity_info?: Json | null;
          order_number: string;
          reviewed_at?: string | null;
          status?: Database["public"]["Enums"]["WithdrawalStatus"];
          updated_at?: string;
          user_id: string;
          withdrawal_method: Database["public"]["Enums"]["WithdrawalMethod"];
        };
        Update: {
          admin_id?: string | null;
          admin_note?: string | null;
          amount?: number;
          bank_account_name?: string | null;
          bank_account_number?: string | null;
          bank_name?: string | null;
          created_at?: string;
          currency?: string;
          id?: string;
          identity_info?: Json | null;
          order_number?: string;
          reviewed_at?: string | null;
          status?: Database["public"]["Enums"]["WithdrawalStatus"];
          updated_at?: string;
          user_id?: string;
          withdrawal_method?: Database["public"]["Enums"]["WithdrawalMethod"];
        };
        Relationships: [
          {
            foreignKeyName: "withdrawal_requests_admin_id_fkey";
            columns: ["admin_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "withdrawal_requests_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      can_place_order: {
        Args: {
          p_user_id: string;
          p_lottery_id: string;
          p_quantity: number;
        };
        Returns: boolean;
      };
      create_user_profile: {
        Args: {
          p_user_id: string;
          p_username: string;
          p_first_name: string;
          p_last_name: string;
          p_avatar_url: string;
          p_language_code: string;
          p_referral_code: string;
        };
        Returns: string;
      };
      draw_lottery: {
        Args: {
          p_lottery_id: string;
        };
        Returns: {
          winning_number: number;
          winner_id: string;
          total_sum: string;
          total_numbers: number;
        }[];
      };
      get_user_referral_stats: {
        Args: {
          p_user_id: string;
        };
        Returns: {
          total_referrals: number;
          level1_referrals: number;
          level2_referrals: number;
          level3_referrals: number;
          total_commission: number;
          paid_commission: number;
          pending_commission: number;
        }[];
      };
      handle_new_user: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      place_lottery_order: {
        Args: {
          p_user_id: string;
          p_lottery_id: string;
          p_ticket_count: number;
        };
        Returns: string;
      };
    };
    Enums: {
      CommentStatus: "PENDING" | "APPROVED" | "REJECTED";
      CommissionStatus: "PENDING" | "PAID" | "CANCELLED";
      CommissionType: "LOTTERY_PURCHASE" | "OTHER";
      Currency: "TJS" | "USD" | "RUB";
      DepositMethod: "BANK_TRANSFER" | "MOBILE_WALLET" | "CRYPTO";
      DepositStatus: "PENDING" | "APPROVED" | "REJECTED";
      ExchangeType: "LUCKY_COIN_TO_MAIN" | "MAIN_TO_LUCKY_COIN";
      LotteryStatus: "UPCOMING" | "ACTIVE" | "SOLD_OUT" | "DRAWN" | "COMPLETED" | "CANCELLED";
      NotificationType:
        | "LOTTERY_RESULT"
        | "LOTTERY_REMINDER"
        | "PAYMENT_SUCCESS"
        | "PAYMENT_FAILED"
        | "MARKET_SOLD"
        | "MARKET_PURCHASED"
        | "REFERRAL_REWARD"
        | "SYSTEM_ANNOUNCEMENT"
        | "ACCOUNT_SECURITY";
      OrderStatus: "PENDING" | "COMPLETED" | "CANCELLED" | "FAILED";
      PaymentMethodType: "BANK_CARD" | "MOBILE_WALLET" | "CRYPTO";
      PaymentStatus: "PENDING" | "PAID" | "FAILED" | "REFUNDED";
      PostStatus: "DRAFT" | "PUBLISHED" | "ARCHIVED";
      ReferralStatus: "PENDING" | "COMPLETED";
      ReportedEntityType: "USER" | "POST" | "COMMENT" | "LOTTERY";
      ReportStatus: "PENDING" | "RESOLVED" | "DISMISSED";
      ShowoffStatus: "PENDING" | "APPROVED" | "REJECTED";
      TransactionStatus: "PENDING" | "COMPLETED" | "FAILED" | "CANCELLED";
      TransactionType:
        | "DEPOSIT"
        | "WITHDRAWAL"
        | "LOTTERY_PURCHASE"
        | "COMMISSION"
        | "EXCHANGE"
        | "REFUND";
      UserRole: "USER" | "ADMIN" | "MODERATOR";
      UserStatus: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "BANNED";
      WalletType: "MAIN" | "LUCKY_COIN";
      WithdrawalMethod: "BANK_TRANSFER" | "MOBILE_WALLET" | "CRYPTO";
      WithdrawalStatus:
        | "PENDING"
        | "APPROVED"
        | "REJECTED"
        | "PROCESSING"
        | "COMPLETED"
        | "FAILED";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type Enums<T extends keyof Database["public"]["Enums"]> =
  Database["public"]["Enums"][T];
export type Functions<T extends keyof Database["public"]["Functions"]> =
  Database["public"]["Functions"][T];

export type Profile = Tables<"profiles">;
export type Wallet = Tables<"wallets">;
export type Lottery = Tables<"lotteries">;
export type Order = Tables<"orders">;
export type Showoff = Tables<"showoffs">;
export type Commission = Tables<"commissions">;
export type Deposit = Tables<"deposits">;
export type Withdrawal = Tables<"withdrawal_requests">;

export type UserReferralStats = Awaited<
  Functions<"get_user_referral_stats">["Returns"]
>[number];
export type LotteryOrderResult = Awaited<
  Functions<"place_lottery_order">["Returns"]
>;
