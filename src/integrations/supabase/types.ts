export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      bot_messages: {
        Row: {
          bot_id: string
          content: string | null
          created_at: string
          direction: Database["public"]["Enums"]["message_direction"]
          group_id: string | null
          id: string
          owner_id: string
          telegram_user: string | null
        }
        Insert: {
          bot_id: string
          content?: string | null
          created_at?: string
          direction: Database["public"]["Enums"]["message_direction"]
          group_id?: string | null
          id?: string
          owner_id: string
          telegram_user?: string | null
        }
        Update: {
          bot_id?: string
          content?: string | null
          created_at?: string
          direction?: Database["public"]["Enums"]["message_direction"]
          group_id?: string | null
          id?: string
          owner_id?: string
          telegram_user?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bot_messages_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "telegram_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_rules: {
        Row: {
          bot_id: string
          created_at: string
          group_id: string | null
          id: string
          instruction: string
          is_active: boolean
          owner_id: string
          trigger_keyword: string | null
        }
        Insert: {
          bot_id: string
          created_at?: string
          group_id?: string | null
          id?: string
          instruction: string
          is_active?: boolean
          owner_id: string
          trigger_keyword?: string | null
        }
        Update: {
          bot_id?: string
          created_at?: string
          group_id?: string | null
          id?: string
          instruction?: string
          is_active?: boolean
          owner_id?: string
          trigger_keyword?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bot_rules_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_rules_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "telegram_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      bots: {
        Row: {
          anti_flood_enabled: boolean
          anti_spam_enabled: boolean
          banned_words: string[] | null
          bot_telegram_id: number | null
          bot_username: string | null
          created_at: string
          default_instructions: string | null
          description: string | null
          flood_sensitivity: number
          house_rules: string | null
          id: string
          moderation_enabled: boolean
          name: string
          openai_api_key: string | null
          owner_id: string
          personality: string | null
          status: Database["public"]["Enums"]["bot_status"]
          telegram_bot_token: string | null
          tone: string | null
          update_offset: number
          updated_at: string
          welcome_message: string | null
        }
        Insert: {
          anti_flood_enabled?: boolean
          anti_spam_enabled?: boolean
          banned_words?: string[] | null
          bot_telegram_id?: number | null
          bot_username?: string | null
          created_at?: string
          default_instructions?: string | null
          description?: string | null
          flood_sensitivity?: number
          house_rules?: string | null
          id?: string
          moderation_enabled?: boolean
          name: string
          openai_api_key?: string | null
          owner_id: string
          personality?: string | null
          status?: Database["public"]["Enums"]["bot_status"]
          telegram_bot_token?: string | null
          tone?: string | null
          update_offset?: number
          updated_at?: string
          welcome_message?: string | null
        }
        Update: {
          anti_flood_enabled?: boolean
          anti_spam_enabled?: boolean
          banned_words?: string[] | null
          bot_telegram_id?: number | null
          bot_username?: string | null
          created_at?: string
          default_instructions?: string | null
          description?: string | null
          flood_sensitivity?: number
          house_rules?: string | null
          id?: string
          moderation_enabled?: boolean
          name?: string
          openai_api_key?: string | null
          owner_id?: string
          personality?: string | null
          status?: Database["public"]["Enums"]["bot_status"]
          telegram_bot_token?: string | null
          tone?: string | null
          update_offset?: number
          updated_at?: string
          welcome_message?: string | null
        }
        Relationships: []
      }
      knowledge_chunks: {
        Row: {
          bot_id: string
          chunk_index: number
          content: string
          content_tsv: unknown
          created_at: string
          embedding: string | null
          id: string
          owner_id: string
          source_id: string
        }
        Insert: {
          bot_id: string
          chunk_index: number
          content: string
          content_tsv?: unknown
          created_at?: string
          embedding?: string | null
          id?: string
          owner_id: string
          source_id: string
        }
        Update: {
          bot_id?: string
          chunk_index?: number
          content?: string
          content_tsv?: unknown
          created_at?: string
          embedding?: string | null
          id?: string
          owner_id?: string
          source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_chunks_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "knowledge_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_sources: {
        Row: {
          bot_id: string
          chunk_count: number
          content: string | null
          created_at: string
          id: string
          indexed_at: string | null
          indexing_error: string | null
          kind: Database["public"]["Enums"]["knowledge_kind"]
          owner_id: string
          source_url: string | null
          title: string
        }
        Insert: {
          bot_id: string
          chunk_count?: number
          content?: string | null
          created_at?: string
          id?: string
          indexed_at?: string | null
          indexing_error?: string | null
          kind: Database["public"]["Enums"]["knowledge_kind"]
          owner_id: string
          source_url?: string | null
          title: string
        }
        Update: {
          bot_id?: string
          chunk_count?: number
          content?: string | null
          created_at?: string
          id?: string
          indexed_at?: string | null
          indexing_error?: string | null
          kind?: Database["public"]["Enums"]["knowledge_kind"]
          owner_id?: string
          source_url?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_sources_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_actions: {
        Row: {
          action: string
          bot_id: string
          created_at: string
          details: Json | null
          group_chat_id: string | null
          id: string
          owner_id: string
          performed_by: string | null
          reason: string | null
          success: boolean
          target_user: string | null
          target_user_id: number | null
        }
        Insert: {
          action: string
          bot_id: string
          created_at?: string
          details?: Json | null
          group_chat_id?: string | null
          id?: string
          owner_id: string
          performed_by?: string | null
          reason?: string | null
          success?: boolean
          target_user?: string | null
          target_user_id?: number | null
        }
        Update: {
          action?: string
          bot_id?: string
          created_at?: string
          details?: Json | null
          group_chat_id?: string | null
          id?: string
          owner_id?: string
          performed_by?: string | null
          reason?: string | null
          success?: boolean
          target_user?: string | null
          target_user_id?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          telegram_first_name: string | null
          telegram_photo_url: string | null
          telegram_user_id: number | null
          telegram_username: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          telegram_first_name?: string | null
          telegram_photo_url?: string | null
          telegram_user_id?: number | null
          telegram_username?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          telegram_first_name?: string | null
          telegram_photo_url?: string | null
          telegram_user_id?: number | null
          telegram_username?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          id: string
          plan: Database["public"]["Enums"]["plan_tier"]
          status: Database["public"]["Enums"]["sub_status"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan?: Database["public"]["Enums"]["plan_tier"]
          status?: Database["public"]["Enums"]["sub_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan?: Database["public"]["Enums"]["plan_tier"]
          status?: Database["public"]["Enums"]["sub_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      system_bot_state: {
        Row: {
          id: number
          update_offset: number
          updated_at: string
        }
        Insert: {
          id: number
          update_offset?: number
          updated_at?: string
        }
        Update: {
          id?: number
          update_offset?: number
          updated_at?: string
        }
        Relationships: []
      }
      telegram_groups: {
        Row: {
          banned_words: string[] | null
          bot_id: string
          created_at: string
          id: string
          is_active: boolean
          is_auto: boolean
          last_seen_at: string | null
          member_count: number | null
          moderation_enabled: boolean
          name: string
          owner_id: string
          rules: string | null
          telegram_chat_id: string | null
          updated_at: string
          welcome_message: string | null
        }
        Insert: {
          banned_words?: string[] | null
          bot_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_auto?: boolean
          last_seen_at?: string | null
          member_count?: number | null
          moderation_enabled?: boolean
          name: string
          owner_id: string
          rules?: string | null
          telegram_chat_id?: string | null
          updated_at?: string
          welcome_message?: string | null
        }
        Update: {
          banned_words?: string[] | null
          bot_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_auto?: boolean
          last_seen_at?: string | null
          member_count?: number | null
          moderation_enabled?: boolean
          name?: string
          owner_id?: string
          rules?: string | null
          telegram_chat_id?: string | null
          updated_at?: string
          welcome_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "telegram_groups_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_link_codes: {
        Row: {
          code: string
          created_at: string
          expires_at: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          expires_at?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bot_usage_status: {
        Args: { _bot_id: string }
        Returns: {
          max_monthly_messages: number
          max_msgs_per_minute: number
          monthly_messages: number
          plan: Database["public"]["Enums"]["plan_tier"]
        }[]
      }
      can_create_bot: {
        Args: { _user_id: string }
        Returns: {
          allowed: boolean
          current_bots: number
          max_bots: number
          plan: Database["public"]["Enums"]["plan_tier"]
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      match_knowledge_chunks_text: {
        Args: { _bot_id: string; _match_count?: number; _query: string }
        Returns: {
          content: string
          id: string
          similarity: number
          source_id: string
        }[]
      }
      my_bot_quota: {
        Args: never
        Returns: {
          allowed: boolean
          current_bots: number
          max_bots: number
          plan: Database["public"]["Enums"]["plan_tier"]
        }[]
      }
      my_workspace_usage: {
        Args: never
        Returns: {
          current_bots: number
          max_bots: number
          max_monthly_messages: number
          max_msgs_per_minute: number
          monthly_messages: number
          period_end: string
          period_start: string
          plan: Database["public"]["Enums"]["plan_tier"]
        }[]
      }
      plan_limits: {
        Args: { _plan: Database["public"]["Enums"]["plan_tier"] }
        Returns: {
          max_bots: number
          max_groups: number
          max_monthly_messages: number
          max_msgs_per_minute: number
        }[]
      }
      user_plan: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["plan_tier"]
      }
    }
    Enums: {
      app_role: "owner" | "admin" | "user"
      bot_status: "active" | "paused" | "stopped"
      knowledge_kind: "url" | "text"
      message_direction: "inbound" | "outbound"
      plan_tier: "free" | "starter" | "pro" | "business"
      sub_status: "active" | "trialing" | "past_due" | "canceled" | "incomplete"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["owner", "admin", "user"],
      bot_status: ["active", "paused", "stopped"],
      knowledge_kind: ["url", "text"],
      message_direction: ["inbound", "outbound"],
      plan_tier: ["free", "starter", "pro", "business"],
      sub_status: ["active", "trialing", "past_due", "canceled", "incomplete"],
    },
  },
} as const
