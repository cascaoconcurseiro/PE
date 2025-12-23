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
      account_types: {
        Row: {
          category: string
          code: string
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          nature: string
          parent_code: string | null
          updated_at: string | null
        }
        Insert: {
          category: string
          code: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          nature: string
          parent_code?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: string
          code?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          nature?: string
          parent_code?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "account_types_parent_code_fkey"
            columns: ["parent_code"]
            isOneToOne: false
            referencedRelation: "account_types"
            referencedColumns: ["code"]
          },
        ]
      }
      accounts: {
        Row: {
          balance: number | null
          closing_day: number | null
          created_at: string | null
          credit_limit: number | null
          currency: string | null
          deleted: boolean | null
          due_day: number | null
          id: string
          initial_balance: number | null
          is_international: boolean | null
          name: string
          sync_status: string | null
          type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          balance?: number | null
          closing_day?: number | null
          created_at?: string | null
          credit_limit?: number | null
          currency?: string | null
          deleted?: boolean | null
          due_day?: number | null
          id?: string
          initial_balance?: number | null
          is_international?: boolean | null
          name: string
          sync_status?: string | null
          type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          balance?: number | null
          closing_day?: number | null
          created_at?: string | null
          credit_limit?: number | null
          currency?: string | null
          deleted?: boolean | null
          due_day?: number | null
          id?: string
          initial_balance?: number | null
          is_international?: boolean | null
          name?: string
          sync_status?: string | null
          type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      // ... (continuing with key shared system tables)
      shared_transaction_mirrors: {
        Row: {
          created_at: string | null
          id: string
          last_sync_at: string | null
          mirror_transaction_id: string
          mirror_user_id: string
          original_transaction_id: string
          sync_error: string | null
          sync_status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_sync_at?: string | null
          mirror_transaction_id: string
          mirror_user_id: string
          original_transaction_id: string
          sync_error?: string | null
          sync_status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          last_sync_at?: string | null
          mirror_transaction_id?: string
          mirror_user_id?: string
          original_transaction_id?: string
          sync_error?: string | null
          sync_status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shared_transaction_mirrors_mirror_transaction_id_fkey"
            columns: ["mirror_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shared_transaction_mirrors_original_transaction_id_fkey"
            columns: ["original_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_transaction_requests: {
        Row: {
          assigned_amount: number | null
          created_at: string | null
          error_message: string | null
          expires_at: string | null
          id: string
          invited_user_id: string | null
          last_retry_at: string | null
          request_metadata: Json | null
          requester_id: string | null
          responded_at: string | null
          retry_count: number | null
          status: string | null
          transaction_id: string
          updated_at: string | null
        }
        Insert: {
          assigned_amount?: number | null
          created_at?: string | null
          error_message?: string | null
          expires_at?: string | null
          id?: string
          invited_user_id?: string | null
          last_retry_at?: string | null
          request_metadata?: Json | null
          requester_id?: string | null
          responded_at?: string | null
          retry_count?: number | null
          status?: string | null
          transaction_id: string
          updated_at?: string | null
        }
        Update: {
          assigned_amount?: number | null
          created_at?: string | null
          error_message?: string | null
          expires_at?: string | null
          id?: string
          invited_user_id?: string | null
          last_retry_at?: string | null
          request_metadata?: Json | null
          requester_id?: string | null
          responded_at?: string | null
          retry_count?: number | null
          status?: string | null
          transaction_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          account_id: string | null
          amount: number
          bank_statement_id: string | null
          category: string
          created_at: string | null
          currency: string | null
          current_installment: number | null
          date: string
          deleted: boolean | null
          description: string
          destination_account_id: string | null
          destination_amount: number | null
          domain: string | null
          enable_notification: boolean | null
          exchange_rate: number | null
          frequency: string | null
          id: string
          installment_plan_id: string | null
          is_installment: boolean | null
          is_mirror: boolean | null
          is_recurring: boolean | null
          is_refund: boolean | null
          is_settled: boolean | null
          is_shared: boolean | null
          last_generated: string | null
          linked_transaction_id: string | null
          mirror_transaction_id: string | null
          notification_date: string | null
          observation: string | null
          original_amount: number | null
          payer_id: string | null
          reconciled: boolean | null
          reconciled_at: string | null
          reconciled_by: string | null
          reconciled_with: string | null
          recurrence_day: number | null
          recurring_rule_id: string | null
          related_member_id: string | null
          series_id: string | null
          settled_at: string | null
          settled_by_tx_id: string | null
          shared_with: Json | null
          source_transaction_id: string | null
          statement_id: string | null
          sync_status: string | null
          total_installments: number | null
          trip_id: string | null
          type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          bank_statement_id?: string | null
          category: string
          created_at?: string | null
          currency?: string | null
          current_installment?: number | null
          date: string
          deleted?: boolean | null
          description: string
          destination_account_id?: string | null
          destination_amount?: number | null
          domain?: string | null
          enable_notification?: boolean | null
          exchange_rate?: number | null
          frequency?: string | null
          id?: string
          installment_plan_id?: string | null
          is_installment?: boolean | null
          is_mirror?: boolean | null
          is_recurring?: boolean | null
          is_refund?: boolean | null
          is_settled?: boolean | null
          is_shared?: boolean | null
          last_generated?: string | null
          linked_transaction_id?: string | null
          mirror_transaction_id?: string | null
          notification_date?: string | null
          observation?: string | null
          original_amount?: number | null
          payer_id?: string | null
          reconciled?: boolean | null
          reconciled_at?: string | null
          reconciled_by?: string | null
          reconciled_with?: string | null
          recurrence_day?: number | null
          recurring_rule_id?: string | null
          related_member_id?: string | null
          series_id?: string | null
          settled_at?: string | null
          settled_by_tx_id?: string | null
          shared_with?: Json | null
          source_transaction_id?: string | null
          statement_id?: string | null
          sync_status?: string | null
          total_installments?: number | null
          trip_id?: string | null
          type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          bank_statement_id?: string | null
          category?: string
          created_at?: string | null
          currency?: string | null
          current_installment?: number | null
          date?: string
          deleted?: boolean | null
          description?: string
          destination_account_id?: string | null
          destination_amount?: number | null
          domain?: string | null
          enable_notification?: boolean | null
          exchange_rate?: number | null
          frequency?: string | null
          id?: string
          installment_plan_id?: string | null
          is_installment?: boolean | null
          is_mirror?: boolean | null
          is_recurring?: boolean | null
          is_refund?: boolean | null
          is_settled?: boolean | null
          is_shared?: boolean | null
          last_generated?: string | null
          linked_transaction_id?: string | null
          mirror_transaction_id?: string | null
          notification_date?: string | null
          observation?: string | null
          original_amount?: number | null
          payer_id?: string | null
          reconciled?: boolean | null
          reconciled_at?: string | null
          reconciled_by?: string | null
          reconciled_with?: string | null
          recurrence_day?: number | null
          recurring_rule_id?: string | null
          related_member_id?: string | null
          series_id?: string | null
          settled_at?: string | null
          settled_by_tx_id?: string | null
          shared_with?: Json | null
          source_transaction_id?: string | null
          statement_id?: string | null
          sync_status?: string | null
          total_installments?: number | null
          trip_id?: string | null
          type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_transactions_account"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      // Additional shared system tables
      shared_system_audit_logs: {
        Row: {
          created_at: string | null
          error_message: string | null
          execution_time_ms: number | null
          id: string
          operation_data: Json | null
          operation_type: string
          request_id: string | null
          success: boolean
          transaction_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          execution_time_ms?: number | null
          id?: string
          operation_data?: Json | null
          operation_type: string
          request_id?: string | null
          success: boolean
          transaction_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          execution_time_ms?: number | null
          id?: string
          operation_data?: Json | null
          operation_type?: string
          request_id?: string | null
          success?: boolean
          transaction_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      shared_operation_queue: {
        Row: {
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          id: string
          max_retries: number | null
          next_retry_at: string | null
          operation_data: Json
          operation_type: string
          retry_count: number | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          max_retries?: number | null
          next_retry_at?: string | null
          operation_data: Json
          operation_type: string
          retry_count?: number | null
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          max_retries?: number | null
          next_retry_at?: string | null
          operation_data?: Json
          operation_type?: string
          retry_count?: number | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      shared_circuit_breaker: {
        Row: {
          circuit_state: string | null
          created_at: string | null
          failure_count: number | null
          last_failure_at: string | null
          next_attempt_at: string | null
          operation_type: string
          updated_at: string | null
        }
        Insert: {
          circuit_state?: string | null
          created_at?: string | null
          failure_count?: number | null
          last_failure_at?: string | null
          next_attempt_at?: string | null
          operation_type: string
          updated_at?: string | null
        }
        Update: {
          circuit_state?: string | null
          created_at?: string | null
          failure_count?: number | null
          last_failure_at?: string | null
          next_attempt_at?: string | null
          operation_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_shared_transaction_v2: {
        Args: {
          p_account_id: string
          p_amount: number
          p_category: string
          p_description: string
          p_due_date?: string
          p_installments?: number
          p_shared_with: Json
          p_user_id: string
        }
        Returns: Json
      }
      respond_to_shared_request_v2: {
        Args: {
          p_accept: boolean
          p_account_id?: string
          p_request_id: string
          p_user_id: string
        }
        Returns: Json
      }
      sync_shared_transaction_v2: {
        Args: { p_transaction_id: string; p_user_id: string }
        Returns: Json
      }
      calculate_next_retry: {
        Args: { base_delay_seconds?: number; retry_count: number }
        Returns: string
      }
      enqueue_operation: {
        Args: {
          p_max_retries?: number
          p_operation_data: Json
          p_operation_type: string
          p_user_id: string
        }
        Returns: string
      }
      check_circuit_breaker: {
        Args: { p_operation_type: string }
        Returns: string
      }
      run_full_reconciliation: { Args: never; Returns: Json }
      verify_shared_system_integrity: {
        Args: never
        Returns: {
          affected_count: number
          check_name: string
          details: string
          status: string
        }[]
      }
      get_pending_shared_requests: {
        Args: { p_user_id: string }
        Returns: {
          assigned_amount: number
          created_at: string
          id: string
          requester_email: string
          requester_id: string
          requester_name: string
          status: string
          transaction_id: string
          tx_amount: number
          tx_category: string
          tx_currency: string
          tx_date: string
          tx_description: string
          tx_observation: string
          tx_trip_id: string
        }[]
      }
      get_shared_system_stats: { Args: never; Returns: Json }
    }
    Enums: {
      [_ in never]: never
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

export const Constants = {
  public: {
    Enums: {},
  },
} as const