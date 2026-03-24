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
      admin_settings: {
        Row: {
          created_at: string | null
          id: string
          notification_channel_email: boolean | null
          notification_channel_whatsapp: boolean | null
          notification_email: string
          notification_time_manha: string
          notification_time_noite: string
          notification_time_tarde: string
          notification_whatsapp_number: string | null
          notification_whatsapp_numbers: string[] | null
          store_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          notification_channel_email?: boolean | null
          notification_channel_whatsapp?: boolean | null
          notification_email: string
          notification_time_manha?: string
          notification_time_noite?: string
          notification_time_tarde?: string
          notification_whatsapp_number?: string | null
          notification_whatsapp_numbers?: string[] | null
          store_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          notification_channel_email?: boolean | null
          notification_channel_whatsapp?: boolean | null
          notification_email?: string
          notification_time_manha?: string
          notification_time_noite?: string
          notification_time_tarde?: string
          notification_whatsapp_number?: string | null
          notification_whatsapp_numbers?: string[] | null
          store_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_settings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action_type: string
          created_at: string
          id: string
          ip_address: string | null
          metadata: Json | null
          new_values: Json | null
          old_values: Json | null
          resource_id: string | null
          resource_name: string | null
          resource_type: string
          store_id: string
          user_agent: string | null
          user_email: string
          user_id: string | null
          user_name: string
        }
        Insert: {
          action_type: string
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          new_values?: Json | null
          old_values?: Json | null
          resource_id?: string | null
          resource_name?: string | null
          resource_type: string
          store_id: string
          user_agent?: string | null
          user_email: string
          user_id?: string | null
          user_name: string
        }
        Update: {
          action_type?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          new_values?: Json | null
          old_values?: Json | null
          resource_id?: string | null
          resource_name?: string | null
          resource_type?: string
          store_id?: string
          user_agent?: string | null
          user_email?: string
          user_id?: string | null
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_items: {
        Row: {
          checklist_type_id: string
          created_at: string | null
          id: string
          nome: string
          observacao_obrigatoria: boolean
          ordem: number
          requer_foto: boolean
          requer_observacao: boolean
          store_id: string
        }
        Insert: {
          checklist_type_id: string
          created_at?: string | null
          id?: string
          nome: string
          observacao_obrigatoria?: boolean
          ordem: number
          requer_foto?: boolean
          requer_observacao?: boolean
          store_id: string
        }
        Update: {
          checklist_type_id?: string
          created_at?: string | null
          id?: string
          nome?: string
          observacao_obrigatoria?: boolean
          ordem?: number
          requer_foto?: boolean
          requer_observacao?: boolean
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_items_checklist_type_id_fkey"
            columns: ["checklist_type_id"]
            isOneToOne: false
            referencedRelation: "checklist_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_items_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_items_staging: {
        Row: {
          checklist_nome: string
          checklist_type_id: string | null
          created_at: string | null
          id: string
          import_batch_id: string
          imported_by: string
          nome: string
          observacao_obrigatoria: boolean | null
          ordem: number | null
          requer_foto: boolean | null
          requer_observacao: boolean | null
          store_id: string
          validation_message: string | null
          validation_status: string | null
        }
        Insert: {
          checklist_nome: string
          checklist_type_id?: string | null
          created_at?: string | null
          id?: string
          import_batch_id: string
          imported_by: string
          nome: string
          observacao_obrigatoria?: boolean | null
          ordem?: number | null
          requer_foto?: boolean | null
          requer_observacao?: boolean | null
          store_id: string
          validation_message?: string | null
          validation_status?: string | null
        }
        Update: {
          checklist_nome?: string
          checklist_type_id?: string | null
          created_at?: string | null
          id?: string
          import_batch_id?: string
          imported_by?: string
          nome?: string
          observacao_obrigatoria?: boolean | null
          ordem?: number | null
          requer_foto?: boolean | null
          requer_observacao?: boolean | null
          store_id?: string
          validation_message?: string | null
          validation_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_items_staging_checklist_type_id_fkey"
            columns: ["checklist_type_id"]
            isOneToOne: false
            referencedRelation: "checklist_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_items_staging_imported_by_fkey"
            columns: ["imported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_items_staging_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_notifications: {
        Row: {
          checklist_type_id: string
          created_at: string | null
          id: string
          turno: Database["public"]["Enums"]["shift_type"]
        }
        Insert: {
          checklist_type_id: string
          created_at?: string | null
          id?: string
          turno: Database["public"]["Enums"]["shift_type"]
        }
        Update: {
          checklist_type_id?: string
          created_at?: string | null
          id?: string
          turno?: Database["public"]["Enums"]["shift_type"]
        }
        Relationships: [
          {
            foreignKeyName: "checklist_notifications_checklist_type_id_fkey"
            columns: ["checklist_type_id"]
            isOneToOne: false
            referencedRelation: "checklist_types"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_responses: {
        Row: {
          checklist_item_id: string
          checklist_type_id: string
          completed_at: string | null
          created_at: string | null
          data: string
          id: string
          observacoes: string | null
          photo_url: string | null
          status: Database["public"]["Enums"]["checklist_status"]
          store_id: string
          user_email: string | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          checklist_item_id: string
          checklist_type_id: string
          completed_at?: string | null
          created_at?: string | null
          data?: string
          id?: string
          observacoes?: string | null
          photo_url?: string | null
          status?: Database["public"]["Enums"]["checklist_status"]
          store_id: string
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          checklist_item_id?: string
          checklist_type_id?: string
          completed_at?: string | null
          created_at?: string | null
          data?: string
          id?: string
          observacoes?: string | null
          photo_url?: string | null
          status?: Database["public"]["Enums"]["checklist_status"]
          store_id?: string
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_responses_checklist_item_id_fkey"
            columns: ["checklist_item_id"]
            isOneToOne: false
            referencedRelation: "checklist_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_responses_checklist_type_id_fkey"
            columns: ["checklist_type_id"]
            isOneToOne: false
            referencedRelation: "checklist_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_responses_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_responses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_types: {
        Row: {
          allowed_role_ids: string[] | null
          allowed_roles: Database["public"]["Enums"]["user_role"][]
          area: Database["public"]["Enums"]["checklist_area"]
          created_at: string | null
          id: string
          nome: string
          store_id: string
          turno: Database["public"]["Enums"]["shift_type"]
        }
        Insert: {
          allowed_role_ids?: string[] | null
          allowed_roles: Database["public"]["Enums"]["user_role"][]
          area: Database["public"]["Enums"]["checklist_area"]
          created_at?: string | null
          id?: string
          nome: string
          store_id: string
          turno: Database["public"]["Enums"]["shift_type"]
        }
        Update: {
          allowed_role_ids?: string[] | null
          allowed_roles?: Database["public"]["Enums"]["user_role"][]
          area?: Database["public"]["Enums"]["checklist_area"]
          created_at?: string | null
          id?: string
          nome?: string
          store_id?: string
          turno?: Database["public"]["Enums"]["shift_type"]
        }
        Relationships: [
          {
            foreignKeyName: "checklist_types_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      email_invites: {
        Row: {
          created_at: string | null
          email: string | null
          expires_at: string | null
          id: string
          invite_type: string | null
          invited_by: string | null
          invitee_name: string | null
          last_sent_at: string | null
          resend_count: number | null
          role: Database["public"]["Enums"]["user_role"]
          sent_at: string | null
          store_id: string
          used: boolean | null
          used_at: string | null
          whatsapp_number: string | null
          whatsapp_sent_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          expires_at?: string | null
          id?: string
          invite_type?: string | null
          invited_by?: string | null
          invitee_name?: string | null
          last_sent_at?: string | null
          resend_count?: number | null
          role: Database["public"]["Enums"]["user_role"]
          sent_at?: string | null
          store_id: string
          used?: boolean | null
          used_at?: string | null
          whatsapp_number?: string | null
          whatsapp_sent_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          expires_at?: string | null
          id?: string
          invite_type?: string | null
          invited_by?: string | null
          invitee_name?: string | null
          last_sent_at?: string | null
          resend_count?: number | null
          role?: Database["public"]["Enums"]["user_role"]
          sent_at?: string | null
          store_id?: string
          used?: boolean | null
          used_at?: string | null
          whatsapp_number?: string | null
          whatsapp_sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_invites_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_report_items: {
        Row: {
          checklist_item_id: string
          corrective_action: string | null
          created_at: string | null
          employee_observation: string | null
          evidence_photo_url: string | null
          id: string
          item_name: string
          observation: string | null
          priority: string | null
          report_id: string
          verdict: string
          verdict_summary: string | null
        }
        Insert: {
          checklist_item_id: string
          corrective_action?: string | null
          created_at?: string | null
          employee_observation?: string | null
          evidence_photo_url?: string | null
          id?: string
          item_name: string
          observation?: string | null
          priority?: string | null
          report_id: string
          verdict: string
          verdict_summary?: string | null
        }
        Update: {
          checklist_item_id?: string
          corrective_action?: string | null
          created_at?: string | null
          employee_observation?: string | null
          evidence_photo_url?: string | null
          id?: string
          item_name?: string
          observation?: string | null
          priority?: string | null
          report_id?: string
          verdict?: string
          verdict_summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inspection_report_items_checklist_item_id_fkey"
            columns: ["checklist_item_id"]
            isOneToOne: false
            referencedRelation: "checklist_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_report_items_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "inspection_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_reports: {
        Row: {
          checklist_type_id: string
          created_at: string | null
          executed_by: string | null
          executed_by_name: string | null
          execution_date: string
          id: string
          priority_actions: Json | null
          status: string
          store_id: string
          summary: string | null
          total_approved: number | null
          total_inconclusive: number | null
          total_rejected: number | null
          whatsapp_recipients: string[] | null
          whatsapp_sent_at: string | null
        }
        Insert: {
          checklist_type_id: string
          created_at?: string | null
          executed_by?: string | null
          executed_by_name?: string | null
          execution_date: string
          id?: string
          priority_actions?: Json | null
          status: string
          store_id: string
          summary?: string | null
          total_approved?: number | null
          total_inconclusive?: number | null
          total_rejected?: number | null
          whatsapp_recipients?: string[] | null
          whatsapp_sent_at?: string | null
        }
        Update: {
          checklist_type_id?: string
          created_at?: string | null
          executed_by?: string | null
          executed_by_name?: string | null
          execution_date?: string
          id?: string
          priority_actions?: Json | null
          status?: string
          store_id?: string
          summary?: string | null
          total_approved?: number | null
          total_inconclusive?: number | null
          total_rejected?: number | null
          whatsapp_recipients?: string[] | null
          whatsapp_sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inspection_reports_checklist_type_id_fkey"
            columns: ["checklist_type_id"]
            isOneToOne: false
            referencedRelation: "checklist_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_reports_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_standards: {
        Row: {
          checklist_item_id: string
          created_at: string | null
          criteria: string
          enabled: boolean
          id: string
          reference_photos: string[] | null
          severity: string | null
          store_id: string
          updated_at: string | null
        }
        Insert: {
          checklist_item_id: string
          created_at?: string | null
          criteria: string
          enabled?: boolean
          id?: string
          reference_photos?: string[] | null
          severity?: string | null
          store_id: string
          updated_at?: string | null
        }
        Update: {
          checklist_item_id?: string
          created_at?: string | null
          criteria?: string
          enabled?: boolean
          id?: string
          reference_photos?: string[] | null
          severity?: string | null
          store_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inspection_standards_checklist_item_id_fkey"
            columns: ["checklist_item_id"]
            isOneToOne: false
            referencedRelation: "checklist_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_standards_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          data: Json | null
          id: string
          message: string
          read: boolean | null
          store_id: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          data?: Json | null
          id?: string
          message: string
          read?: boolean | null
          store_id: string
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          data?: Json | null
          id?: string
          message?: string
          read?: boolean | null
          store_id?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string | null
          id: string
          nome: string
          owner_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          nome: string
          owner_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          nome?: string
          owner_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          nome: string
          phone: string | null
          store_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id: string
          nome: string
          phone?: string | null
          store_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          nome?: string
          phone?: string | null
          store_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string | null
          display_name: string
          id: string
          is_system: boolean | null
          name: string
          store_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          display_name: string
          id?: string
          is_system?: boolean | null
          name: string
          store_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          display_name?: string
          id?: string
          is_system?: boolean | null
          name?: string
          store_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "roles_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          cnpj: string | null
          created_at: string | null
          email_contato: string | null
          endereco: string | null
          id: string
          nome: string
          organization_id: string | null
          status: string | null
          telefone: string | null
          updated_at: string | null
          whatsapp_recipients: string[] | null
        }
        Insert: {
          cnpj?: string | null
          created_at?: string | null
          email_contato?: string | null
          endereco?: string | null
          id?: string
          nome: string
          organization_id?: string | null
          status?: string | null
          telefone?: string | null
          updated_at?: string | null
          whatsapp_recipients?: string[] | null
        }
        Update: {
          cnpj?: string | null
          created_at?: string | null
          email_contato?: string | null
          endereco?: string | null
          id?: string
          nome?: string
          organization_id?: string | null
          status?: string | null
          telefone?: string | null
          updated_at?: string | null
          whatsapp_recipients?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "stores_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"]
          role_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["user_role"]
          role_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_user_role_direct: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: boolean
      }
      clone_checklists_to_store: {
        Args: {
          create_new_organization?: boolean
          new_org_name?: string
          new_org_owner_id?: string
          source_store_id: string
          target_store_id: string
        }
        Returns: Json
      }
      delete_store_account: { Args: { target_store_id: string }; Returns: Json }
      delete_user_account: { Args: { target_user_id: string }; Returns: Json }
      get_role_id_by_name: {
        Args: { _role_name: string; _store_id: string }
        Returns: string
      }
      get_user_organization_id: { Args: { _user_id: string }; Returns: string }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["user_role"]
      }
      get_user_store_id: { Args: { _user_id: string }; Returns: string }
      get_user_store_id_direct: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: boolean
      }
      import_items_from_staging: { Args: { p_batch_id: string }; Returns: Json }
      is_email_invited: { Args: { user_email: string }; Returns: boolean }
      log_audit_event:
        | {
            Args: {
              p_action_type: string
              p_metadata?: Json
              p_new_values?: Json
              p_old_values?: Json
              p_resource_id?: string
              p_resource_name?: string
              p_resource_type: string
            }
            Returns: string
          }
        | {
            Args: {
              p_action_type: string
              p_metadata?: Json
              p_new_values?: Json
              p_old_values?: Json
              p_resource_id?: string
              p_resource_name?: string
              p_resource_type: string
              p_store_id?: string
            }
            Returns: string
          }
      manage_user_role: {
        Args: {
          p_action: string
          p_role: Database["public"]["Enums"]["user_role"]
          p_role_id: string
          p_user_id: string
        }
        Returns: boolean
      }
      trigger_checklist_notification: {
        Args: { turno_param: string }
        Returns: undefined
      }
      update_notification_cron_jobs: { Args: never; Returns: undefined }
    }
    Enums: {
      checklist_area: "loja" | "cozinha" | "bar"
      checklist_status: "ok" | "nok" | "pendente"
      shift_type: "manha" | "tarde" | "noite"
      user_role:
        | "garcom"
        | "garconete"
        | "atendente"
        | "lider"
        | "cozinheiro"
        | "cozinheiro_lider"
        | "auxiliar_cozinha"
        | "barman"
        | "lider_bar"
        | "admin"
        | "super_admin"
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
      checklist_area: ["loja", "cozinha", "bar"],
      checklist_status: ["ok", "nok", "pendente"],
      shift_type: ["manha", "tarde", "noite"],
      user_role: [
        "garcom",
        "garconete",
        "atendente",
        "lider",
        "cozinheiro",
        "cozinheiro_lider",
        "auxiliar_cozinha",
        "barman",
        "lider_bar",
        "admin",
        "super_admin",
      ],
    },
  },
} as const
