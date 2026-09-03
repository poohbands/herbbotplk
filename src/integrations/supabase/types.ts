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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      chat_messages: {
        Row: {
          category: Database["public"]["Enums"]["question_category"] | null
          content: string
          created_at: string
          drugs_mentioned: string[] | null
          herbs_mentioned: string[] | null
          id: string
          role: string
          session_id: string
          severity: Database["public"]["Enums"]["interaction_severity"] | null
          sources: string[] | null
        }
        Insert: {
          category?: Database["public"]["Enums"]["question_category"] | null
          content: string
          created_at?: string
          drugs_mentioned?: string[] | null
          herbs_mentioned?: string[] | null
          id?: string
          role: string
          session_id: string
          severity?: Database["public"]["Enums"]["interaction_severity"] | null
          sources?: string[] | null
        }
        Update: {
          category?: Database["public"]["Enums"]["question_category"] | null
          content?: string
          created_at?: string
          drugs_mentioned?: string[] | null
          herbs_mentioned?: string[] | null
          id?: string
          role?: string
          session_id?: string
          severity?: Database["public"]["Enums"]["interaction_severity"] | null
          sources?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      data_versions: {
        Row: {
          created_at: string
          formulas_count: number
          herbs: Json
          herbs_count: number
          id: string
          knowledge_count: number
          knowledge_documents: Json
          label: string
          note: string | null
          thai_formulas: Json
        }
        Insert: {
          created_at?: string
          formulas_count?: number
          herbs?: Json
          herbs_count?: number
          id?: string
          knowledge_count?: number
          knowledge_documents?: Json
          label: string
          note?: string | null
          thai_formulas?: Json
        }
        Update: {
          created_at?: string
          formulas_count?: number
          herbs?: Json
          herbs_count?: number
          id?: string
          knowledge_count?: number
          knowledge_documents?: Json
          label?: string
          note?: string | null
          thai_formulas?: Json
        }
        Relationships: []
      }
      herbs: {
        Row: {
          category: string | null
          contraindications: string[] | null
          created_at: string
          description: string | null
          dosage: string | null
          drug_interactions: string[] | null
          family: string | null
          id: string
          image_url: string | null
          is_in_nlem: boolean | null
          local_names: string[] | null
          name_english: string | null
          name_scientific: string | null
          name_thai: string
          precautions: string[] | null
          properties: string[] | null
          search_vector: unknown
          updated_at: string
          usage_instructions: string | null
        }
        Insert: {
          category?: string | null
          contraindications?: string[] | null
          created_at?: string
          description?: string | null
          dosage?: string | null
          drug_interactions?: string[] | null
          family?: string | null
          id?: string
          image_url?: string | null
          is_in_nlem?: boolean | null
          local_names?: string[] | null
          name_english?: string | null
          name_scientific?: string | null
          name_thai: string
          precautions?: string[] | null
          properties?: string[] | null
          search_vector?: unknown
          updated_at?: string
          usage_instructions?: string | null
        }
        Update: {
          category?: string | null
          contraindications?: string[] | null
          created_at?: string
          description?: string | null
          dosage?: string | null
          drug_interactions?: string[] | null
          family?: string | null
          id?: string
          image_url?: string | null
          is_in_nlem?: boolean | null
          local_names?: string[] | null
          name_english?: string | null
          name_scientific?: string | null
          name_thai?: string
          precautions?: string[] | null
          properties?: string[] | null
          search_vector?: unknown
          updated_at?: string
          usage_instructions?: string | null
        }
        Relationships: []
      }
      import_jobs: {
        Row: {
          committed_count: number
          created_at: string
          error: string | null
          extracted: Json
          file_name: string
          file_path: string | null
          id: string
          source_type: string
          status: string
          updated_at: string
        }
        Insert: {
          committed_count?: number
          created_at?: string
          error?: string | null
          extracted?: Json
          file_name: string
          file_path?: string | null
          id?: string
          source_type?: string
          status?: string
          updated_at?: string
        }
        Update: {
          committed_count?: number
          created_at?: string
          error?: string | null
          extracted?: Json
          file_name?: string
          file_path?: string | null
          id?: string
          source_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      knowledge_documents: {
        Row: {
          category: string
          content: string
          created_at: string
          id: string
          is_published: boolean
          search_vector: unknown
          source: string | null
          source_url: string | null
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          content: string
          created_at?: string
          id?: string
          is_published?: boolean
          search_vector?: unknown
          source?: string | null
          source_url?: string | null
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          id?: string
          is_published?: boolean
          search_vector?: unknown
          source?: string | null
          source_url?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      thai_formulas: {
        Row: {
          category: string | null
          contraindications: string[] | null
          created_at: string
          dosage: string | null
          drug_interactions: string[] | null
          formula_code: string | null
          id: string
          image_url: string | null
          indication: string | null
          ingredients: string[] | null
          is_in_nlem: boolean | null
          name_english: string | null
          name_thai: string
          precautions: string[] | null
          preparation: string | null
          properties: string[] | null
          updated_at: string
          usage_instructions: string | null
        }
        Insert: {
          category?: string | null
          contraindications?: string[] | null
          created_at?: string
          dosage?: string | null
          drug_interactions?: string[] | null
          formula_code?: string | null
          id?: string
          image_url?: string | null
          indication?: string | null
          ingredients?: string[] | null
          is_in_nlem?: boolean | null
          name_english?: string | null
          name_thai: string
          precautions?: string[] | null
          preparation?: string | null
          properties?: string[] | null
          updated_at?: string
          usage_instructions?: string | null
        }
        Update: {
          category?: string | null
          contraindications?: string[] | null
          created_at?: string
          dosage?: string | null
          drug_interactions?: string[] | null
          formula_code?: string | null
          id?: string
          image_url?: string | null
          indication?: string | null
          ingredients?: string[] | null
          is_in_nlem?: boolean | null
          name_english?: string | null
          name_thai?: string
          precautions?: string[] | null
          preparation?: string | null
          properties?: string[] | null
          updated_at?: string
          usage_instructions?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      chat_statistics: {
        Row: {
          dosage_count: number | null
          drug_interaction_count: number | null
          general_count: number | null
          herbal_info_count: number | null
          side_effects_count: number | null
          total_questions: number | null
          total_sessions: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      interaction_severity: "major" | "moderate" | "minor" | "none"
      question_category:
        | "herbal_info"
        | "drug_interaction"
        | "dosage"
        | "side_effects"
        | "general"
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
      interaction_severity: ["major", "moderate", "minor", "none"],
      question_category: [
        "herbal_info",
        "drug_interaction",
        "dosage",
        "side_effects",
        "general",
      ],
    },
  },
} as const
