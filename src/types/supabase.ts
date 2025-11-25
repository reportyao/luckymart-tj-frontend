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
      commissions: {
        Row: {
          id: string;
          user_id: string;
          from_user_id: string;
          level: number;
          commission_rate: number;
          order_amount: number;
          commission_amount: number;
          order_id: string | null;
          is_withdrawable: boolean;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          from_user_id: string;
          level: number;
          commission_rate: number;
          order_amount: number;
          commission_amount: number;
          order_id?: string | null;
          is_withdrawable?: boolean;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          from_user_id?: string;
          level?: number;
          commission_rate?: number;
          order_amount?: number;
          commission_amount?: number;
          order_id?: string | null;
          is_withdrawable?: boolean;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "commissions_from_user_id_fkey";
            columns: ["from_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "commissions_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "commissions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      share_logs: {
        Row: {
          id: string;
          user_id: string;
          share_type: string;
          share_target: string | null;
          shared_at: string;
          share_data: Json | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          share_type?: string;
          share_target?: string | null;
          shared_at?: string;
          share_data?: Json | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          share_type?: string;
          share_target?: string | null;
          shared_at?: string;
          share_data?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: "share_logs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      system_config: {
        Row: {
          key: string;
          value: Json;
          description: string | null;
          updated_at: string;
        };
        Insert: {
          key: string;
          value: Json;
          description?: string | null;
          updated_at?: string;
        };
        Update: {
          key?: string;
          value?: Json;
          description?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      likes: {
        Row: {
          id: string;
          user_id: string;
          post_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          post_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          post_id?: string;
          created_at?: string;
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
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      lotteries: {
        Row: {
          id: string;
          title: string;
          image_url: string | null;
          description: string | null;
          ticket_price: number;
          total_tickets: number;
          sold_tickets: number;
          start_time: string;
          end_time: string;
          status: string;
          created_at: string;
          updated_at: string;
          winner_id: string | null;
          winner_ticket_number: number | null;
          draw_time: string | null;
          title_i18n: Json | null;
          name_i18n: Json | null;
          description_i18n: Json | null;
          details_i18n: Json | null;
          specifications_i18n: Json | null;
          material_i18n: Json | null;
          image_urls: string[] | null;
          currency: string | null;
          max_per_user: number | null;
        };
        Insert: {
          id?: string;
          title: string;
          image_url?: string | null;
          description?: string | null;
          ticket_price: number;
          total_tickets: number;
          sold_tickets?: number;
          start_time?: string;
          end_time?: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
          winner_id?: string | null;
          winner_ticket_number?: number | null;
          draw_time?: string | null;
          title_i18n?: Json | null;
          name_i18n?: Json | null;
          description_i18n?: Json | null;
          details_i18n?: Json | null;
          specifications_i18n?: Json | null;
          material_i18n?: Json | null;
          image_urls?: string[] | null;
          currency?: string | null;
          max_per_user?: number | null;
        };
        Update: {
          id?: string;
          title?: string;
          image_url?: string | null;
          description?: string | null;
          ticket_price?: number;
          total_tickets?: number;
          sold_tickets?: number;
          start_time?: string;
          end_time?: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
          winner_id?: string | null;
          winner_ticket_number?: number | null;
          draw_time?: string | null;
          title_i18n?: Json | null;
          name_i18n?: Json | null;
          description_i18n?: Json | null;
          details_i18n?: Json | null;
          specifications_i18n?: Json | null;
          material_i18n?: Json | null;
          image_urls?: string[] | null;
          currency?: string | null;
          max_per_user?: number | null;
        };
        Relationships: [];
      };
      lottery_results: {
        Row: {
          id: string;
          lottery_id: string;
          winner_id: string;
          winner_ticket_number: number;
          draw_time: string;
          created_at: string;
          algorithm_data: Json | null;
        };
        Insert: {
          id?: string;
          lottery_id: string;
          winner_id: string;
          winner_ticket_number: number;
          draw_time?: string;
          created_at?: string;
          algorithm_data?: Json | null;
        };
        Update: {
          id?: string;
          lottery_id?: string;
          winner_id?: string;
          winner_ticket_number?: number;
          draw_time?: string;
          created_at?: string;
          algorithm_data?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: "lottery_results_lottery_id_fkey";
            columns: ["lottery_id"];
            isOneToOne: false;
            referencedRelation: "lotteries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lottery_results_winner_id_fkey";
            columns: ["winner_id"];
            isOneToOne: false;
            referencedRelation: "tickets";
            referencedColumns: ["id"];
          }
        ];
      };
      orders: {
        Row: {
          id: string;
          user_id: string;
          order_type: string;
          amount: number;
          currency: string;
          status: string;
          created_at: string;
          updated_at: string;
          lottery_id: string | null;
          ticket_count: number | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          order_type: string;
          amount: number;
          currency: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
          lottery_id?: string | null;
          ticket_count?: number | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          order_type?: string;
          amount?: number;
          currency?: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
          lottery_id?: string | null;
          ticket_count?: number | null;
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
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      showoffs: {
        Row: {
          id: string;
          user_id: string;
          lottery_id: string;
          content: string;
          images: Json | null;
          image_urls: string[] | null;
          status: string;
          created_at: string;
          updated_at: string;
          likes_count: number;
        };
        Insert: {
          id?: string;
          user_id: string;
          lottery_id: string;
          content: string;
          images?: Json | null;
          image_urls?: string[] | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
          likes_count?: number;
        };
        Update: {
          id?: string;
          user_id?: string;
          lottery_id?: string;
          content?: string;
          images?: Json | null;
          image_urls?: string[] | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
          likes_count?: number;
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
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      tickets: {
        Row: {
          id: string;
          user_id: string;
          lottery_id: string;
          ticket_number: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          lottery_id: string;
          ticket_number: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          lottery_id?: string;
          ticket_number?: number;
          created_at?: string;
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
            foreignKeyName: "tickets_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      user_profiles: {
        Row: {
          id: string;
          username: string | null;
          avatar_url: string | null;
          updated_at: string | null;
          telegram_user_id: number | null;
          invite_code: string | null;
          invited_by: string | null;
          bonus_balance: number;
          first_deposit_bonus_amount: number;
          first_deposit_bonus_status: string;
          first_deposit_bonus_expire_at: string | null;
          activation_share_count: number;
          activation_invite_count: number;
          level: number;
          commission_rate: number;
        };
        Insert: {
          id: string;
          username?: string | null;
          avatar_url?: string | null;
          updated_at?: string | null;
          telegram_user_id?: number | null;
          invite_code?: string | null;
          invited_by?: string | null;
          bonus_balance?: number;
          first_deposit_bonus_amount?: number;
          first_deposit_bonus_status?: string;
          first_deposit_bonus_expire_at?: string | null;
          activation_share_count?: number;
          activation_invite_count?: number;
          level?: number;
          commission_rate?: number;
        };
        Update: {
          id?: string;
          username?: string | null;
          avatar_url?: string | null;
          updated_at?: string | null;
          telegram_user_id?: number | null;
          invite_code?: string | null;
          invited_by?: string | null;
          bonus_balance?: number;
          first_deposit_bonus_amount?: number;
          first_deposit_bonus_status?: string;
          first_deposit_bonus_expire_at?: string | null;
          activation_share_count?: number;
          activation_invite_count?: number;
          level?: number;
          commission_rate?: number;
        };
        Relationships: [
          {
            foreignKeyName: "user_profiles_invited_by_fkey";
            columns: ["invited_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      wallets: {
        Row: {
          id: string;
          user_id: string;
          currency: string;
          balance: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          currency: string;
          balance?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          currency?: string;
          balance?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "wallets_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      profiles: {
        Row: {
          id: string;
          username: string | null;
          avatar_url: string | null;
          updated_at: string | null;
          telegram_user_id: number | null;
          invite_code: string | null;
          invited_by: string | null;
          bonus_balance: number;
          first_deposit_bonus_amount: number;
          first_deposit_bonus_status: string;
          first_deposit_bonus_expire_at: string | null;
          activation_share_count: number;
          activation_invite_count: number;
          level: number;
          commission_rate: number;
        };
        Insert: {
          id: string;
          username?: string | null;
          avatar_url?: string | null;
          updated_at?: string | null;
          telegram_user_id?: number | null;
          invite_code?: string | null;
          invited_by?: string | null;
          bonus_balance?: number;
          first_deposit_bonus_amount?: number;
          first_deposit_bonus_status?: string;
          first_deposit_bonus_expire_at?: string | null;
          activation_share_count?: number;
          activation_invite_count?: number;
          level?: number;
          commission_rate?: number;
        };
        Update: {
          id?: string;
          username?: string | null;
          avatar_url?: string | null;
          updated_at?: string | null;
          telegram_user_id?: number | null;
          invite_code?: string | null;
          invited_by?: string | null;
          bonus_balance?: number;
          first_deposit_bonus_amount?: number;
          first_deposit_bonus_status?: string;
          first_deposit_bonus_expire_at?: string | null;
          activation_share_count?: number;
          activation_invite_count?: number;
          level?: number;
          commission_rate?: number;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_invited_by_fkey";
            columns: ["invited_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      // ... other tables
    };
    Views: { /* ... */ };
    Functions: {
      add_bonus_balance: {
        Args: {
          p_user_id: string;
          p_amount: number;
        };
        Returns: undefined;
      };
      exchange_real_to_bonus_balance: {
        Args: {
          p_user_id: string;
          p_amount: number;
        };
        Returns: number;
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
          pending_commission: number;
          bonus_balance: number;
        }[];
      };
      // ... other functions
    };
    Enums: { /* ... */ };
    CompositeTypes: { /* ... */ };
  };
};

export type InviteStats = Database['public']['Functions']['get_user_referral_stats']['Returns'][0] & {
  first_deposit_bonus_status: string;
  first_deposit_bonus_amount: number;
  first_deposit_bonus_expire_at: string | null;
  activation_share_count: number;
  activation_invite_count: number;
};

export type InvitedUser = {
  id: string;
  username: string | null;
  avatar_url: string | null;
  created_at: string;
  level: number; // 1, 2, or 3
  commission_earned: number;
  total_spent: number;
};




export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T];
export type Functions<T extends keyof Database['public']['Functions']> = Database['public']['Functions'][T];
