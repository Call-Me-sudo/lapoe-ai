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
      bot_feedback: {
        Row: {
          bot_id: string | null
          created_at: string
          id: string
          message: string
          source: string
          telegram_user_id: number | null
          telegram_username: string | null
        }
        Insert: {
          bot_id?: string | null
          created_at?: string
          id?: string
          message: string
          source?: string
          telegram_user_id?: number | null
          telegram_username?: string | null
        }
        Update: {
          bot_id?: string | null
          created_at?: string
          id?: string
          message?: string
          source?: string
          telegram_user_id?: number | null
          telegram_username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bot_feedback_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_messages: {
        Row: {
          bot_id: string | null
          content: string | null
          created_at: string
          direction: Database["public"]["Enums"]["message_direction"]
          group_id: string | null
          id: string
          owner_id: string
          telegram_user: string | null
        }
        Insert: {
          bot_id?: string | null
          content?: string | null
          created_at?: string
          direction: Database["public"]["Enums"]["message_direction"]
          group_id?: string | null
          id?: string
          owner_id: string
          telegram_user?: string | null
        }
        Update: {
          bot_id?: string | null
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
          poll_locked_until: string | null
          status: Database["public"]["Enums"]["bot_status"]
          telegram_bot_token: string | null
          tone: string | null
          update_offset: number
          updated_at: string
          webhook_registered_at: string | null
          webhook_secret: string
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
          poll_locked_until?: string | null
          status?: Database["public"]["Enums"]["bot_status"]
          telegram_bot_token?: string | null
          tone?: string | null
          update_offset?: number
          updated_at?: string
          webhook_registered_at?: string | null
          webhook_secret?: string
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
          poll_locked_until?: string | null
          status?: Database["public"]["Enums"]["bot_status"]
          telegram_bot_token?: string | null
          tone?: string | null
          update_offset?: number
          updated_at?: string
          webhook_registered_at?: string | null
          webhook_secret?: string
          welcome_message?: string | null
        }
        Relationships: []
      }
      knowledge_chunks: {
        Row: {
          bot_id: string | null
          chunk_index: number
          content: string
          content_tsv: unknown
          created_at: string
          embedding: string | null
          id: string
          owner_id: string
          scope: string
          source_id: string
        }
        Insert: {
          bot_id?: string | null
          chunk_index: number
          content: string
          content_tsv?: unknown
          created_at?: string
          embedding?: string | null
          id?: string
          owner_id: string
          scope?: string
          source_id: string
        }
        Update: {
          bot_id?: string | null
          chunk_index?: number
          content?: string
          content_tsv?: unknown
          created_at?: string
          embedding?: string | null
          id?: string
          owner_id?: string
          scope?: string
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
          bot_id: string | null
          chunk_count: number
          content: string | null
          created_at: string
          id: string
          indexed_at: string | null
          indexing_error: string | null
          kind: Database["public"]["Enums"]["knowledge_kind"]
          owner_id: string
          scope: string
          source_url: string | null
          title: string
        }
        Insert: {
          bot_id?: string | null
          chunk_count?: number
          content?: string | null
          created_at?: string
          id?: string
          indexed_at?: string | null
          indexing_error?: string | null
          kind: Database["public"]["Enums"]["knowledge_kind"]
          owner_id: string
          scope?: string
          source_url?: string | null
          title: string
        }
        Update: {
          bot_id?: string | null
          chunk_count?: number
          content?: string | null
          created_at?: string
          id?: string
          indexed_at?: string | null
          indexing_error?: string | null
          kind?: Database["public"]["Enums"]["knowledge_kind"]
          owner_id?: string
          scope?: string
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
      monthly_usage: {
        Row: {
          outbound_count: number
          owner_id: string
          period_start: string
          updated_at: string
        }
        Insert: {
          outbound_count?: number
          owner_id: string
          period_start: string
          updated_at?: string
        }
        Update: {
          outbound_count?: number
          owner_id?: string
          period_start?: string
          updated_at?: string
        }
        Relationships: []
      }
      notification_reads: {
        Row: {
          notification_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          notification_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          notification_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          audience: string
          body: string
          created_at: string
          created_by: string | null
          id: string
          link: string | null
          plan: Database["public"]["Enums"]["plan_tier"] | null
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          audience?: string
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          link?: string | null
          plan?: Database["public"]["Enums"]["plan_tier"] | null
          title: string
          type?: string
          user_id?: string | null
        }
        Update: {
          audience?: string
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          link?: string | null
          plan?: Database["public"]["Enums"]["plan_tier"] | null
          title?: string
          type?: string
          user_id?: string | null
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
      system_bot_filters: {
        Row: {
          chat_id: number
          created_at: string
          created_by: number | null
          id: string
          keyword: string
          reply: string
        }
        Insert: {
          chat_id: number
          created_at?: string
          created_by?: number | null
          id?: string
          keyword: string
          reply: string
        }
        Update: {
          chat_id?: number
          created_at?: string
          created_by?: number | null
          id?: string
          keyword?: string
          reply?: string
        }
        Relationships: []
      }
      system_bot_flood: {
        Row: {
          chat_id: number
          count: number
          user_id: number
          window_start: string
        }
        Insert: {
          chat_id: number
          count?: number
          user_id: number
          window_start?: string
        }
        Update: {
          chat_id?: number
          count?: number
          user_id?: number
          window_start?: string
        }
        Relationships: []
      }
      system_bot_groups: {
        Row: {
          added_by_tg: number | null
          anti_flood_enabled: boolean
          banned_words: string[]
          captcha_enabled: boolean
          chat_id: number
          created_at: string
          flood_limit: number
          goodbye_message: string | null
          is_active: boolean
          language: string
          linked_owner_id: string | null
          moderation_enabled: boolean
          rules: string | null
          title: string | null
          type: string | null
          updated_at: string
          warn_limit: number
          welcome_message: string | null
        }
        Insert: {
          added_by_tg?: number | null
          anti_flood_enabled?: boolean
          banned_words?: string[]
          captcha_enabled?: boolean
          chat_id: number
          created_at?: string
          flood_limit?: number
          goodbye_message?: string | null
          is_active?: boolean
          language?: string
          linked_owner_id?: string | null
          moderation_enabled?: boolean
          rules?: string | null
          title?: string | null
          type?: string | null
          updated_at?: string
          warn_limit?: number
          welcome_message?: string | null
        }
        Update: {
          added_by_tg?: number | null
          anti_flood_enabled?: boolean
          banned_words?: string[]
          captcha_enabled?: boolean
          chat_id?: number
          created_at?: string
          flood_limit?: number
          goodbye_message?: string | null
          is_active?: boolean
          language?: string
          linked_owner_id?: string | null
          moderation_enabled?: boolean
          rules?: string | null
          title?: string | null
          type?: string | null
          updated_at?: string
          warn_limit?: number
          welcome_message?: string | null
        }
        Relationships: []
      }
      system_bot_mod_log: {
        Row: {
          action: string
          chat_id: number
          created_at: string
          id: string
          performed_by: number | null
          reason: string | null
          target_user_id: number | null
          target_username: string | null
        }
        Insert: {
          action: string
          chat_id: number
          created_at?: string
          id?: string
          performed_by?: number | null
          reason?: string | null
          target_user_id?: number | null
          target_username?: string | null
        }
        Update: {
          action?: string
          chat_id?: number
          created_at?: string
          id?: string
          performed_by?: number | null
          reason?: string | null
          target_user_id?: number | null
          target_username?: string | null
        }
        Relationships: []
      }
      system_bot_notes: {
        Row: {
          chat_id: number
          content: string
          created_at: string
          created_by: number | null
          id: string
          name: string
        }
        Insert: {
          chat_id: number
          content: string
          created_at?: string
          created_by?: number | null
          id?: string
          name: string
        }
        Update: {
          chat_id?: number
          content?: string
          created_at?: string
          created_by?: number | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      system_bot_personas: {
        Row: {
          created_at: string
          display_name: string | null
          house_rules: string | null
          owner_id: string
          personality: string | null
          tone: string
          updated_at: string
          welcome_message: string | null
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          house_rules?: string | null
          owner_id: string
          personality?: string | null
          tone?: string
          updated_at?: string
          welcome_message?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string | null
          house_rules?: string | null
          owner_id?: string
          personality?: string | null
          tone?: string
          updated_at?: string
          welcome_message?: string | null
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
      system_bot_warnings: {
        Row: {
          chat_id: number
          created_at: string
          id: string
          issued_by: number | null
          reason: string | null
          user_id: number
          username: string | null
        }
        Insert: {
          chat_id: number
          created_at?: string
          id?: string
          issued_by?: number | null
          reason?: string | null
          user_id: number
          username?: string | null
        }
        Update: {
          chat_id?: number
          created_at?: string
          id?: string
          issued_by?: number | null
          reason?: string | null
          user_id?: number
          username?: string | null
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
      telegram_update_queue: {
        Row: {
          bot_id: string
          chat_id: string | null
          created_at: string
          id: string
          processed_at: string | null
          raw_update: Json
          telegram_update_id: number
        }
        Insert: {
          bot_id: string
          chat_id?: string | null
          created_at?: string
          id?: string
          processed_at?: string | null
          raw_update: Json
          telegram_update_id: number
        }
        Update: {
          bot_id?: string
          chat_id?: string | null
          created_at?: string
          id?: string
          processed_at?: string | null
          raw_update?: Json
          telegram_update_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "telegram_update_queue_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
        ]
      }
      unanswered_questions: {
        Row: {
          answer: string | null
          answered_at: string | null
          ask_count: number
          asker: string | null
          bot_id: string | null
          created_at: string
          group_id: string | null
          id: string
          normalized_question: string
          owner_id: string
          question: string
          status: string
          updated_at: string
        }
        Insert: {
          answer?: string | null
          answered_at?: string | null
          ask_count?: number
          asker?: string | null
          bot_id?: string | null
          created_at?: string
          group_id?: string | null
          id?: string
          normalized_question: string
          owner_id: string
          question: string
          status?: string
          updated_at?: string
        }
        Update: {
          answer?: string | null
          answered_at?: string | null
          ask_count?: number
          asker?: string | null
          bot_id?: string | null
          created_at?: string
          group_id?: string | null
          id?: string
          normalized_question?: string
          owner_id?: string
          question?: string
          status?: string
          updated_at?: string
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
      bump_system_bot_usage: { Args: { _owner_id: string }; Returns: undefined }
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
      match_system_knowledge_text: {
        Args: { _match_count?: number; _owner_id: string; _query: string }
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
      my_system_bot_usage: {
        Args: never
        Returns: {
          allowed: boolean
          max_monthly_messages: number
          monthly_messages: number
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
      system_bot_usage: {
        Args: { _owner_id: string }
        Returns: {
          allowed: boolean
          max_monthly_messages: number
          monthly_messages: number
          plan: Database["public"]["Enums"]["plan_tier"]
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
