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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      audiences: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          is_other: boolean
          label: string
          municipality_id: string
          position: number
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_other?: boolean
          label: string
          municipality_id: string
          position?: number
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_other?: boolean
          label?: string
          municipality_id?: string
          position?: number
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audiences_municipality_id_fkey"
            columns: ["municipality_id"]
            isOneToOne: false
            referencedRelation: "municipalities"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_bank_item_principles: {
        Row: {
          item_id: string
          principle_id: string
        }
        Insert: {
          item_id: string
          principle_id: string
        }
        Update: {
          item_id?: string
          principle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_bank_item_principles_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "activity_bank_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_bank_item_principles_principle_id_fkey"
            columns: ["principle_id"]
            isOneToOne: false
            referencedRelation: "principles"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_bank_items: {
        Row: {
          audience_note: string
          audiences: string[]
          category: string
          contact: string
          created_at: string
          created_by: string | null
          description: string
          id: string
          is_active: boolean
          metrics: string
          municipality_id: string | null
          position: number
          school_id: string | null
          scope: Database["public"]["Enums"]["principle_scope"]
          short: string
          slug: string
          source: Database["public"]["Enums"]["task_source"]
          title: string
          updated_at: string
        }
        Insert: {
          audience_note?: string
          audiences?: string[]
          category?: string
          contact?: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          is_active?: boolean
          metrics?: string
          municipality_id?: string | null
          position?: number
          school_id?: string | null
          scope: Database["public"]["Enums"]["principle_scope"]
          short?: string
          slug?: string
          source?: Database["public"]["Enums"]["task_source"]
          title: string
          updated_at?: string
        }
        Update: {
          audience_note?: string
          audiences?: string[]
          category?: string
          contact?: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          is_active?: boolean
          metrics?: string
          municipality_id?: string | null
          position?: number
          school_id?: string | null
          scope?: Database["public"]["Enums"]["principle_scope"]
          short?: string
          slug?: string
          source?: Database["public"]["Enums"]["task_source"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_bank_items_municipality_id_fkey"
            columns: ["municipality_id"]
            isOneToOne: false
            referencedRelation: "municipalities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_bank_items_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      municipalities: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      plan_activities: {
        Row: {
          audience_note: string
          audiences: string[]
          bank_key: string | null
          category: string
          created_at: string
          description: string
          id: string
          metrics: string
          owner: string
          plan_id: string
          position: number
          principle_id: string
          priority: Database["public"]["Enums"]["activity_priority"]
          source: Database["public"]["Enums"]["task_source"] | null
          title: string
        }
        Insert: {
          audience_note?: string
          audiences?: string[]
          bank_key?: string | null
          category?: string
          created_at?: string
          description?: string
          id?: string
          metrics?: string
          owner?: string
          plan_id: string
          position?: number
          principle_id: string
          priority?: Database["public"]["Enums"]["activity_priority"]
          source?: Database["public"]["Enums"]["task_source"] | null
          title?: string
        }
        Update: {
          audience_note?: string
          audiences?: string[]
          bank_key?: string | null
          category?: string
          created_at?: string
          description?: string
          id?: string
          metrics?: string
          owner?: string
          plan_id?: string
          position?: number
          principle_id?: string
          priority?: Database["public"]["Enums"]["activity_priority"]
          source?: Database["public"]["Enums"]["task_source"] | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_activities_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_activities_principle_id_fkey"
            columns: ["principle_id"]
            isOneToOne: false
            referencedRelation: "principles"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_ai_reports: {
        Row: {
          auto_fill: Json
          generated_at: string
          id: string
          model: string
          plan_id: string
          quick_tips: string[]
          summary_html: string
        }
        Insert: {
          auto_fill?: Json
          generated_at?: string
          id?: string
          model?: string
          plan_id: string
          quick_tips?: string[]
          summary_html?: string
        }
        Update: {
          auto_fill?: Json
          generated_at?: string
          id?: string
          model?: string
          plan_id?: string
          quick_tips?: string[]
          summary_html?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_ai_reports_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: true
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_assessments: {
        Row: {
          evidence: string
          how_score: number
          id: string
          plan_id: string
          principle_id: string
          selected_maturity_level: number
          what_score: number
          why_score: number
        }
        Insert: {
          evidence?: string
          how_score?: number
          id?: string
          plan_id: string
          principle_id: string
          selected_maturity_level?: number
          what_score?: number
          why_score?: number
        }
        Update: {
          evidence?: string
          how_score?: number
          id?: string
          plan_id?: string
          principle_id?: string
          selected_maturity_level?: number
          what_score?: number
          why_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "plan_assessments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_assessments_principle_id_fkey"
            columns: ["principle_id"]
            isOneToOne: false
            referencedRelation: "principles"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_export_configs: {
        Row: {
          id: string
          plan_id: string
          principal_message: string
          sections: Json
          vision_text: string
        }
        Insert: {
          id?: string
          plan_id: string
          principal_message?: string
          sections?: Json
          vision_text?: string
        }
        Update: {
          id?: string
          plan_id?: string
          principal_message?: string
          sections?: Json
          vision_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_export_configs_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: true
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_focus: {
        Row: {
          id: string
          plan_id: string
          position: number
          principle_id: string
          role: string
        }
        Insert: {
          id?: string
          plan_id: string
          position?: number
          principle_id: string
          role: string
        }
        Update: {
          id?: string
          plan_id?: string
          position?: number
          principle_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_focus_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_focus_principle_id_fkey"
            columns: ["principle_id"]
            isOneToOne: false
            referencedRelation: "principles"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_principle_plans: {
        Row: {
          id: string
          plan_id: string
          principle_id: string
          victory_vision: string
        }
        Insert: {
          id?: string
          plan_id: string
          principle_id: string
          victory_vision?: string
        }
        Update: {
          id?: string
          plan_id?: string
          principle_id?: string
          victory_vision?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_principle_plans_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_principle_plans_principle_id_fkey"
            columns: ["principle_id"]
            isOneToOne: false
            referencedRelation: "principles"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          breakthrough_reason1: string
          breakthrough_reason2: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          organizational_sacrifice: string
          school_id: string
          school_year: string
          status: Database["public"]["Enums"]["plan_status"]
          strength_reason: string
          updated_at: string
        }
        Insert: {
          breakthrough_reason1?: string
          breakthrough_reason2?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          organizational_sacrifice?: string
          school_id: string
          school_year?: string
          status?: Database["public"]["Enums"]["plan_status"]
          strength_reason?: string
          updated_at?: string
        }
        Update: {
          breakthrough_reason1?: string
          breakthrough_reason2?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          organizational_sacrifice?: string
          school_id?: string
          school_year?: string
          status?: Database["public"]["Enums"]["plan_status"]
          strength_reason?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plans_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      principle_rubric_levels: {
        Row: {
          description: string
          id: string
          level: number
          name: string
          principle_id: string
        }
        Insert: {
          description?: string
          id?: string
          level: number
          name?: string
          principle_id: string
        }
        Update: {
          description?: string
          id?: string
          level?: number
          name?: string
          principle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "principle_rubric_levels_principle_id_fkey"
            columns: ["principle_id"]
            isOneToOne: false
            referencedRelation: "principles"
            referencedColumns: ["id"]
          },
        ]
      }
      principle_sources: {
        Row: {
          description: string
          id: string
          keywords: string
          order_index: number
          principle_id: string
          title: string
          url: string
        }
        Insert: {
          description?: string
          id?: string
          keywords?: string
          order_index?: number
          principle_id: string
          title?: string
          url?: string
        }
        Update: {
          description?: string
          id?: string
          keywords?: string
          order_index?: number
          principle_id?: string
          title?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "principle_sources_principle_id_fkey"
            columns: ["principle_id"]
            isOneToOne: false
            referencedRelation: "principles"
            referencedColumns: ["id"]
          },
        ]
      }
      principles: {
        Row: {
          accent_color: string
          added_value: string
          bg_light: string
          color_name: string
          created_at: string
          created_by: string | null
          ecosystem_partnerships: string
          first_step: string
          gaps_solved: string[]
          icon: string
          id: string
          implementation_strategy: string[]
          is_active: boolean
          kpis: string[]
          municipality_id: string | null
          order_index: number
          rationale: string
          sacrifices_required: string
          school_id: string | null
          scope: Database["public"]["Enums"]["principle_scope"]
          short_label: string
          short_summary: string
          student_deliverable: string
          teacher_deliverable: string
          text_dark: string
          title: string
          updated_at: string
        }
        Insert: {
          accent_color?: string
          added_value?: string
          bg_light?: string
          color_name?: string
          created_at?: string
          created_by?: string | null
          ecosystem_partnerships?: string
          first_step?: string
          gaps_solved?: string[]
          icon?: string
          id?: string
          implementation_strategy?: string[]
          is_active?: boolean
          kpis?: string[]
          municipality_id?: string | null
          order_index?: number
          rationale?: string
          sacrifices_required?: string
          school_id?: string | null
          scope: Database["public"]["Enums"]["principle_scope"]
          short_label?: string
          short_summary?: string
          student_deliverable?: string
          teacher_deliverable?: string
          text_dark?: string
          title: string
          updated_at?: string
        }
        Update: {
          accent_color?: string
          added_value?: string
          bg_light?: string
          color_name?: string
          created_at?: string
          created_by?: string | null
          ecosystem_partnerships?: string
          first_step?: string
          gaps_solved?: string[]
          icon?: string
          id?: string
          implementation_strategy?: string[]
          is_active?: boolean
          kpis?: string[]
          municipality_id?: string | null
          order_index?: number
          rationale?: string
          sacrifices_required?: string
          school_id?: string | null
          scope?: Database["public"]["Enums"]["principle_scope"]
          short_label?: string
          short_summary?: string
          student_deliverable?: string
          teacher_deliverable?: string
          text_dark?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "principles_municipality_id_fkey"
            columns: ["municipality_id"]
            isOneToOne: false
            referencedRelation: "municipalities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "principles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
          municipality_id: string | null
          role: Database["public"]["Enums"]["user_role"]
          school_id: string | null
        }
        Insert: {
          created_at?: string
          display_name?: string
          id: string
          municipality_id?: string | null
          role: Database["public"]["Enums"]["user_role"]
          school_id?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          municipality_id?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          school_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_municipality_id_fkey"
            columns: ["municipality_id"]
            isOneToOne: false
            referencedRelation: "municipalities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_files: {
        Row: {
          created_at: string
          id: string
          mime_type: string
          name: string
          school_id: string
          size_bytes: number
          storage_path: string
        }
        Insert: {
          created_at?: string
          id?: string
          mime_type: string
          name: string
          school_id: string
          size_bytes: number
          storage_path: string
        }
        Update: {
          created_at?: string
          id?: string
          mime_type?: string
          name?: string
          school_id?: string
          size_bytes?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_files_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          created_at: string
          current_plan_id: string | null
          goals: string
          id: string
          logo_path: string | null
          municipality_id: string
          name: string
          principal_name: string
          principal_seniority: string
          student_count: number | null
          uniqueness: string
          updated_at: string
          vision: string
        }
        Insert: {
          created_at?: string
          current_plan_id?: string | null
          goals?: string
          id?: string
          logo_path?: string | null
          municipality_id: string
          name: string
          principal_name?: string
          principal_seniority?: string
          student_count?: number | null
          uniqueness?: string
          updated_at?: string
          vision?: string
        }
        Update: {
          created_at?: string
          current_plan_id?: string | null
          goals?: string
          id?: string
          logo_path?: string | null
          municipality_id?: string
          name?: string
          principal_name?: string
          principal_seniority?: string
          student_count?: number | null
          uniqueness?: string
          updated_at?: string
          vision?: string
        }
        Relationships: [
          {
            foreignKeyName: "schools_current_plan_fk"
            columns: ["current_plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schools_municipality_id_fkey"
            columns: ["municipality_id"]
            isOneToOne: false
            referencedRelation: "municipalities"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      list_schools: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          name: string
          municipality_id: string
        }[]
      }
      set_plan_focus: {
        Args: { p_plan_id: string; p_focus: Json }
        Returns: undefined
      }
      delete_unadopted_bank_item: {
        Args: { p_id: string }
        Returns: boolean
      }
    }
    Enums: {
      activity_priority: "high" | "medium" | "low"
      plan_status: "draft" | "active" | "archived"
      principle_scope: "municipal" | "school"
      task_source: "עירוני" | "בית ספרי" | "פסג\"ה חולון" | "משרד החינוך" | "ארצי" | "עולמי" | "כללי"
      user_role: "school" | "city_admin" | "super_admin"
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
      activity_priority: ["high", "medium", "low"],
      plan_status: ["draft", "active", "archived"],
      principle_scope: ["municipal", "school"],
      task_source: ["עירוני", "בית ספרי", "פסג\"ה חולון", "משרד החינוך", "ארצי", "עולמי", "כללי"],
      user_role: ["school", "city_admin", "super_admin"],
    },
  },
} as const
