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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sensor_type_catalog: {
        Row: {
          created_at: string | null
          id: string
          is_custom: boolean | null
          label: string
          type_key: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_custom?: boolean | null
          label: string
          type_key: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_custom?: boolean | null
          label?: string
          type_key?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vyva_sensor_alerts: {
        Row: {
          alert_type: string
          created_at: string
          id: string
          message: string | null
          resolved_at: string | null
          sensor_id: string
          severity: string
          vyva_user_id: string
        }
        Insert: {
          alert_type: string
          created_at?: string
          id?: string
          message?: string | null
          resolved_at?: string | null
          sensor_id: string
          severity?: string
          vyva_user_id: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          id?: string
          message?: string | null
          resolved_at?: string | null
          sensor_id?: string
          severity?: string
          vyva_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vyva_sensor_alerts_sensor_id_fkey"
            columns: ["sensor_id"]
            isOneToOne: false
            referencedRelation: "vyva_user_sensors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vyva_sensor_alerts_vyva_user_id_fkey"
            columns: ["vyva_user_id"]
            isOneToOne: false
            referencedRelation: "vyva_users"
            referencedColumns: ["id"]
          },
        ]
      }
      vyva_sensor_readings: {
        Row: {
          created_at: string
          id: string
          is_anomaly: boolean
          recorded_at: string
          sensor_id: string
          unit: string
          value: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_anomaly?: boolean
          recorded_at?: string
          sensor_id: string
          unit: string
          value: number
        }
        Update: {
          created_at?: string
          id?: string
          is_anomaly?: boolean
          recorded_at?: string
          sensor_id?: string
          unit?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "vyva_sensor_readings_sensor_id_fkey"
            columns: ["sensor_id"]
            isOneToOne: false
            referencedRelation: "vyva_user_sensors"
            referencedColumns: ["id"]
          },
        ]
      }
      vyva_user_brain_coach: {
        Row: {
          created_at: string
          enabled: boolean
          frequency: string | null
          id: string
          preferred_time: string | null
          updated_at: string
          vyva_user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          frequency?: string | null
          id?: string
          preferred_time?: string | null
          updated_at?: string
          vyva_user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          frequency?: string | null
          id?: string
          preferred_time?: string | null
          updated_at?: string
          vyva_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vyva_user_brain_coach_vyva_user_id_fkey"
            columns: ["vyva_user_id"]
            isOneToOne: true
            referencedRelation: "vyva_users"
            referencedColumns: ["id"]
          },
        ]
      }
      vyva_user_caregivers: {
        Row: {
          caretaker_name: string | null
          caretaker_phone: string | null
          created_at: string
          id: string
          updated_at: string
          vyva_user_id: string
        }
        Insert: {
          caretaker_name?: string | null
          caretaker_phone?: string | null
          created_at?: string
          id?: string
          updated_at?: string
          vyva_user_id: string
        }
        Update: {
          caretaker_name?: string | null
          caretaker_phone?: string | null
          created_at?: string
          id?: string
          updated_at?: string
          vyva_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vyva_user_caregivers_vyva_user_id_fkey"
            columns: ["vyva_user_id"]
            isOneToOne: false
            referencedRelation: "vyva_users"
            referencedColumns: ["id"]
          },
        ]
      }
      vyva_user_checkins: {
        Row: {
          created_at: string
          enabled: boolean
          frequency: string | null
          id: string
          preferred_time: string | null
          updated_at: string
          vyva_user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          frequency?: string | null
          id?: string
          preferred_time?: string | null
          updated_at?: string
          vyva_user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          frequency?: string | null
          id?: string
          preferred_time?: string | null
          updated_at?: string
          vyva_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vyva_user_checkins_vyva_user_id_fkey"
            columns: ["vyva_user_id"]
            isOneToOne: true
            referencedRelation: "vyva_users"
            referencedColumns: ["id"]
          },
        ]
      }
      vyva_user_consent: {
        Row: {
          caretaker_consent: boolean
          consent_given: boolean
          created_at: string
          id: string
          updated_at: string
          vyva_user_id: string
        }
        Insert: {
          caretaker_consent?: boolean
          consent_given?: boolean
          created_at?: string
          id?: string
          updated_at?: string
          vyva_user_id: string
        }
        Update: {
          caretaker_consent?: boolean
          consent_given?: boolean
          created_at?: string
          id?: string
          updated_at?: string
          vyva_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vyva_user_consent_vyva_user_id_fkey"
            columns: ["vyva_user_id"]
            isOneToOne: false
            referencedRelation: "vyva_users"
            referencedColumns: ["id"]
          },
        ]
      }
      vyva_user_health: {
        Row: {
          created_at: string
          health_conditions: string[] | null
          id: string
          mobility_needs: string[] | null
          updated_at: string
          vyva_user_id: string
        }
        Insert: {
          created_at?: string
          health_conditions?: string[] | null
          id?: string
          mobility_needs?: string[] | null
          updated_at?: string
          vyva_user_id: string
        }
        Update: {
          created_at?: string
          health_conditions?: string[] | null
          id?: string
          mobility_needs?: string[] | null
          updated_at?: string
          vyva_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vyva_user_health_vyva_user_id_fkey"
            columns: ["vyva_user_id"]
            isOneToOne: false
            referencedRelation: "vyva_users"
            referencedColumns: ["id"]
          },
        ]
      }
      vyva_user_medications: {
        Row: {
          created_at: string
          dosage: string | null
          id: string
          medication_name: string
          purpose: string | null
          schedule_times: string[] | null
          updated_at: string
          vyva_user_id: string
        }
        Insert: {
          created_at?: string
          dosage?: string | null
          id?: string
          medication_name: string
          purpose?: string | null
          schedule_times?: string[] | null
          updated_at?: string
          vyva_user_id: string
        }
        Update: {
          created_at?: string
          dosage?: string | null
          id?: string
          medication_name?: string
          purpose?: string | null
          schedule_times?: string[] | null
          updated_at?: string
          vyva_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vyva_user_medications_vyva_user_id_fkey"
            columns: ["vyva_user_id"]
            isOneToOne: false
            referencedRelation: "vyva_users"
            referencedColumns: ["id"]
          },
        ]
      }
      vyva_user_sensors: {
        Row: {
          battery_level: number | null
          created_at: string
          device_id: string
          device_name: string | null
          id: string
          integration_config: Json | null
          integration_method: string | null
          last_reading_at: string | null
          notes: string | null
          sensor_type: string
          status: string
          updated_at: string
          vyva_user_id: string
        }
        Insert: {
          battery_level?: number | null
          created_at?: string
          device_id: string
          device_name?: string | null
          id?: string
          integration_config?: Json | null
          integration_method?: string | null
          last_reading_at?: string | null
          notes?: string | null
          sensor_type: string
          status?: string
          updated_at?: string
          vyva_user_id: string
        }
        Update: {
          battery_level?: number | null
          created_at?: string
          device_id?: string
          device_name?: string | null
          id?: string
          integration_config?: Json | null
          integration_method?: string | null
          last_reading_at?: string | null
          notes?: string | null
          sensor_type?: string
          status?: string
          updated_at?: string
          vyva_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vyva_user_sensors_vyva_user_id_fkey"
            columns: ["vyva_user_id"]
            isOneToOne: false
            referencedRelation: "vyva_users"
            referencedColumns: ["id"]
          },
        ]
      }
      vyva_users: {
        Row: {
          city: string | null
          created_at: string
          date_of_birth: string | null
          emergency_notes: string | null
          first_name: string
          gender: string | null
          house_number: string | null
          id: string
          language: string | null
          last_name: string
          phone: string | null
          photo_url: string | null
          post_code: string | null
          street: string | null
          timezone: string | null
          updated_at: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          date_of_birth?: string | null
          emergency_notes?: string | null
          first_name: string
          gender?: string | null
          house_number?: string | null
          id?: string
          language?: string | null
          last_name: string
          phone?: string | null
          photo_url?: string | null
          post_code?: string | null
          street?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          city?: string | null
          created_at?: string
          date_of_birth?: string | null
          emergency_notes?: string | null
          first_name?: string
          gender?: string | null
          house_number?: string | null
          id?: string
          language?: string | null
          last_name?: string
          phone?: string | null
          photo_url?: string | null
          post_code?: string | null
          street?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_user: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "operator" | "coordinator"
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
      app_role: ["admin", "operator", "coordinator"],
    },
  },
} as const
