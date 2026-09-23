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
      availability_rules: {
        Row: {
          close_time: string
          created_at: string | null
          id: string
          is_active: boolean | null
          open_time: string
          slot_min: number | null
          weekday: number
        }
        Insert: {
          close_time: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          open_time: string
          slot_min?: number | null
          weekday: number
        }
        Update: {
          close_time?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          open_time?: string
          slot_min?: number | null
          weekday?: number
        }
        Relationships: []
      }
      barber_profile: {
        Row: {
          address_text: string | null
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          facebook_url: string | null
          gallery: Json | null
          id: string
          instagram_url: string | null
          name: string
          public_whatsapp: string | null
          review_url: string | null
          socials: Json | null
          updated_at: string | null
          years_experience: number | null
        }
        Insert: {
          address_text?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          facebook_url?: string | null
          gallery?: Json | null
          id?: string
          instagram_url?: string | null
          name: string
          public_whatsapp?: string | null
          review_url?: string | null
          socials?: Json | null
          updated_at?: string | null
          years_experience?: number | null
        }
        Update: {
          address_text?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          facebook_url?: string | null
          gallery?: Json | null
          id?: string
          instagram_url?: string | null
          name?: string
          public_whatsapp?: string | null
          review_url?: string | null
          socials?: Json | null
          updated_at?: string | null
          years_experience?: number | null
        }
        Relationships: []
      }
      blocks: {
        Row: {
          created_at: string | null
          end_datetime: string
          id: string
          reason: string | null
          start_datetime: string
        }
        Insert: {
          created_at?: string | null
          end_datetime: string
          id?: string
          reason?: string | null
          start_datetime: string
        }
        Update: {
          created_at?: string | null
          end_datetime?: string
          id?: string
          reason?: string | null
          start_datetime?: string
        }
        Relationships: []
      }
      booking_events: {
        Row: {
          actor_id: string | null
          booking_id: string
          created_at: string
          event_type: string
          id: string
          metadata: Json
          new_status: Database["public"]["Enums"]["booking_status"] | null
          previous_status: Database["public"]["Enums"]["booking_status"] | null
        }
        Insert: {
          actor_id?: string | null
          booking_id: string
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          new_status?: Database["public"]["Enums"]["booking_status"] | null
          previous_status?: Database["public"]["Enums"]["booking_status"] | null
        }
        Update: {
          actor_id?: string | null
          booking_id?: string
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          new_status?: Database["public"]["Enums"]["booking_status"] | null
          previous_status?: Database["public"]["Enums"]["booking_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_notifications: {
        Row: {
          booking_id: string
          created_at: string | null
          id: string
          notification_type: string
          scheduled_for: string
          sent_at: string | null
        }
        Insert: {
          booking_id: string
          created_at?: string | null
          id?: string
          notification_type: string
          scheduled_for: string
          sent_at?: string | null
        }
        Update: {
          booking_id?: string
          created_at?: string | null
          id?: string
          notification_type?: string
          scheduled_for?: string
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_notifications_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          access_token_expires_at: string | null
          access_token_hash: string | null
          booking_date: string
          booking_time: string
          cancellation_requested_at: string | null
          created_at: string | null
          customer_name: string
          customer_whatsapp: string
          id: string
          payment_method: string | null
          price: number
          receipt_url: string | null
          rescheduled_from: string | null
          service_id: string | null
          status: Database["public"]["Enums"]["booking_status"] | null
          token: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          access_token_expires_at?: string | null
          access_token_hash?: string | null
          booking_date: string
          booking_time: string
          cancellation_requested_at?: string | null
          created_at?: string | null
          customer_name: string
          customer_whatsapp: string
          id?: string
          payment_method?: string | null
          price: number
          receipt_url?: string | null
          rescheduled_from?: string | null
          service_id?: string | null
          status?: Database["public"]["Enums"]["booking_status"] | null
          token?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          access_token_expires_at?: string | null
          access_token_hash?: string | null
          booking_date?: string
          booking_time?: string
          cancellation_requested_at?: string | null
          created_at?: string | null
          customer_name?: string
          customer_whatsapp?: string
          id?: string
          payment_method?: string | null
          price?: number
          receipt_url?: string | null
          rescheduled_from?: string | null
          service_id?: string | null
          status?: Database["public"]["Enums"]["booking_status"] | null
          token?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_rescheduled_from_fkey"
            columns: ["rescheduled_from"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          archived: boolean | null
          created_at: string | null
          customer_email: string | null
          customer_name: string
          customer_whatsapp: string
          id: string
          last_message_at: string | null
          unread_count: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          archived?: boolean | null
          created_at?: string | null
          customer_email?: string | null
          customer_name: string
          customer_whatsapp: string
          id?: string
          last_message_at?: string | null
          unread_count?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          archived?: boolean | null
          created_at?: string | null
          customer_email?: string | null
          customer_name?: string
          customer_whatsapp?: string
          id?: string
          last_message_at?: string | null
          unread_count?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string | null
          id: string
          image_url: string | null
          sender_type: string
          status: string | null
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string | null
          id?: string
          image_url?: string | null
          sender_type: string
          status?: string | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string | null
          id?: string
          image_url?: string | null
          sender_type?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_items: {
        Row: {
          alt_text: string
          category: string
          created_at: string
          description: string | null
          id: string
          image_url: string
          is_active: boolean
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          alt_text: string
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url: string
          is_active?: boolean
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          alt_text?: string
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string
          is_active?: boolean
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      scheduled_notifications: {
        Row: {
          booking_id: string | null
          created_at: string | null
          id: string
          message: string
          notification_type: string
          scheduled_for: string
          sent_at: string | null
        }
        Insert: {
          booking_id?: string | null
          created_at?: string | null
          id?: string
          message: string
          notification_type: string
          scheduled_for: string
          sent_at?: string | null
        }
        Update: {
          booking_id?: string | null
          created_at?: string | null
          id?: string
          message?: string
          notification_type?: string
          scheduled_for?: string
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_notifications_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          allow_in_person_payment: boolean | null
          created_at: string | null
          description: string | null
          duration_min: number
          id: string
          interleaved_blocks: Json | null
          is_active: boolean | null
          name: string
          price: number
        }
        Insert: {
          allow_in_person_payment?: boolean | null
          created_at?: string | null
          description?: string | null
          duration_min: number
          id?: string
          interleaved_blocks?: Json | null
          is_active?: boolean | null
          name: string
          price: number
        }
        Update: {
          allow_in_person_payment?: boolean | null
          created_at?: string | null
          description?: string | null
          duration_min?: number
          id?: string
          interleaved_blocks?: Json | null
          is_active?: boolean | null
          name?: string
          price?: number
        }
        Relationships: []
      }
      settings: {
        Row: {
          cancel_policy_hours: number | null
          created_at: string | null
          id: string
          max_days_ahead: number | null
          min_advance_hours: number | null
          pix_chave: string | null
          pix_cidade: string | null
          pix_nome_recebedor: string | null
          require_payment_on_booking: boolean | null
          updated_at: string | null
          whatsapp_access_token: string | null
          whatsapp_business_number: string | null
          whatsapp_phone_id: string | null
        }
        Insert: {
          cancel_policy_hours?: number | null
          created_at?: string | null
          id?: string
          max_days_ahead?: number | null
          min_advance_hours?: number | null
          pix_chave?: string | null
          pix_cidade?: string | null
          pix_nome_recebedor?: string | null
          require_payment_on_booking?: boolean | null
          updated_at?: string | null
          whatsapp_access_token?: string | null
          whatsapp_business_number?: string | null
          whatsapp_phone_id?: string | null
        }
        Update: {
          cancel_policy_hours?: number | null
          created_at?: string | null
          id?: string
          max_days_ahead?: number | null
          min_advance_hours?: number | null
          pix_chave?: string | null
          pix_cidade?: string | null
          pix_nome_recebedor?: string | null
          require_payment_on_booking?: boolean | null
          updated_at?: string | null
          whatsapp_access_token?: string | null
          whatsapp_business_number?: string | null
          whatsapp_phone_id?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
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
      admin_reject_booking_receipt: {
        Args: { p_booking_id: string }
        Returns: boolean
      }
      admin_update_booking_status: {
        Args: {
          p_booking_id: string
          p_status: Database["public"]["Enums"]["booking_status"]
        }
        Returns: boolean
      }
      create_booking: {
        Args: {
          p_booking_date: string
          p_booking_time: string
          p_customer_name: string
          p_customer_whatsapp: string
          p_service_id: string
        }
        Returns: Json
      }
      get_booked_slots: {
        Args: { p_booking_date: string }
        Returns: {
          booking_time: string
          duration_min: number
          interleaved_blocks: Json
        }[]
      }
      get_booking_by_token: {
        Args: { p_access_token: string; p_booking_id: string }
        Returns: {
          allow_in_person_payment: boolean
          booking_date: string
          booking_time: string
          customer_name: string
          id: string
          payment_method: string
          pix_payload_data: Json
          price: number
          receipt_url: string
          service_id: string
          service_name: string
          status: Database["public"]["Enums"]["booking_status"]
        }[]
      }
      get_public_booking_settings: {
        Args: never
        Returns: {
          cancel_policy_hours: number
          max_days_ahead: number
          min_advance_hours: number
          require_payment_on_booking: boolean
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      request_booking_cancellation: {
        Args: { p_booking_id: string }
        Returns: boolean
      }
      reschedule_booking: {
        Args: {
          p_booking_date: string
          p_booking_id: string
          p_booking_time: string
        }
        Returns: Json
      }
      save_availability_rules: { Args: { p_rules: Json }; Returns: boolean }
      set_booking_payment_method: {
        Args: { p_access_token: string; p_booking_id: string; p_method: string }
        Returns: boolean
      }
      set_booking_receipt: {
        Args: {
          p_access_token: string
          p_booking_id: string
          p_receipt_path: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "customer"
      booking_status: "PENDING_PAYMENT" | "CONFIRMED" | "CANCELED" | "COMPLETED"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "customer"],
      booking_status: ["PENDING_PAYMENT", "CONFIRMED", "CANCELED", "COMPLETED"],
    },
  },
} as const
