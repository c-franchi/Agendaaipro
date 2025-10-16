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
    PostgrestVersion: "13.0.5"
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
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          gallery: Json | null
          id: string
          name: string
          socials: Json | null
          updated_at: string | null
          years_experience: number | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          gallery?: Json | null
          id?: string
          name: string
          socials?: Json | null
          updated_at?: string | null
          years_experience?: number | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          gallery?: Json | null
          id?: string
          name?: string
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
          booking_date: string
          booking_time: string
          created_at: string | null
          customer_name: string
          customer_whatsapp: string
          id: string
          price: number
          service_id: string | null
          status: Database["public"]["Enums"]["booking_status"] | null
          token: string | null
          updated_at: string | null
        }
        Insert: {
          booking_date: string
          booking_time: string
          created_at?: string | null
          customer_name: string
          customer_whatsapp: string
          id?: string
          price: number
          service_id?: string | null
          status?: Database["public"]["Enums"]["booking_status"] | null
          token?: string | null
          updated_at?: string | null
        }
        Update: {
          booking_date?: string
          booking_time?: string
          created_at?: string | null
          customer_name?: string
          customer_whatsapp?: string
          id?: string
          price?: number
          service_id?: string | null
          status?: Database["public"]["Enums"]["booking_status"] | null
          token?: string | null
          updated_at?: string | null
        }
        Relationships: [
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
          updated_at?: string | null
          whatsapp_access_token?: string | null
          whatsapp_business_number?: string | null
          whatsapp_phone_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
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
      booking_status: ["PENDING_PAYMENT", "CONFIRMED", "CANCELED", "COMPLETED"],
    },
  },
} as const
