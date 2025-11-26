export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export type Database = {
    public: {
        Tables: {
            admin_actions: {
                Row: {
                    id: string
                    admin_id: string | null
                    action_type: string
                    target_user_id: string | null
                    details: Json | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    admin_id?: string | null
                    action_type: string
                    target_user_id?: string | null
                    details?: Json | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    admin_id?: string | null
                    action_type?: string
                    target_user_id?: string | null
                    details?: Json | null
                    created_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "admin_actions_admin_id_fkey"
                        columns: ["admin_id"]
                        isOneToOne: false
                        referencedRelation: "users"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "admin_actions_target_user_id_fkey"
                        columns: ["target_user_id"]
                        isOneToOne: false
                        referencedRelation: "users"
                        referencedColumns: ["id"]
                    }
                ]
            }
            audit_logs: {
                Row: {
                    id: string
                    user_id: string | null
                    action: string
                    resource_type: string | null
                    resource_id: string | null
                    details: Json | null
                    ip_address: string | null
                    user_agent: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    user_id?: string | null
                    action: string
                    resource_type?: string | null
                    resource_id?: string | null
                    details?: Json | null
                    ip_address?: string | null
                    user_agent?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string | null
                    action?: string
                    resource_type?: string | null
                    resource_id?: string | null
                    details?: Json | null
                    ip_address?: string | null
                    user_agent?: string | null
                    created_at?: string
                }
                Relationships: []
            }
            backup_codes: {
                Row: {
                    id: string
                    user_id: string
                    code: string
                    used: boolean
                    created_at: string
                    used_at: string | null
                }
                Insert: {
                    id?: string
                    user_id: string
                    code: string
                    used?: boolean
                    created_at?: string
                    used_at?: string | null
                }
                Update: {
                    id?: string
                    user_id?: string
                    code?: string
                    used?: boolean
                    created_at?: string
                    used_at?: string | null
                }
                Relationships: []
            }
            contracts: {
                Row: {
                    id: string
                    user_id: string
                    amount: number
                    currency: string
                    monthly_rate: number
                    duration_months: number
                    status: string
                    start_date: string
                    end_date: string
                    months_paid: number
                    total_profit_paid: number
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    amount: number
                    currency?: string
                    monthly_rate: number
                    duration_months?: number
                    status?: string
                    start_date?: string
                    end_date: string
                    months_paid?: number
                    total_profit_paid?: number
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    amount?: number
                    currency?: string
                    monthly_rate?: number
                    duration_months?: number
                    status?: string
                    start_date?: string
                    end_date?: string
                    months_paid?: number
                    total_profit_paid?: number
                    created_at?: string
                    updated_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "contracts_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "users"
                        referencedColumns: ["id"]
                    }
                ]
            }
            login_audit: {
                Row: {
                    id: string
                    user_id: string | null
                    email: string
                    success: boolean
                    ip_address: string | null
                    user_agent: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    user_id?: string | null
                    email: string
                    success?: boolean
                    ip_address?: string | null
                    user_agent?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string | null
                    email?: string
                    success?: boolean
                    ip_address?: string | null
                    user_agent?: string | null
                    created_at?: string
                }
                Relationships: []
            }
            notifications: {
                Row: {
                    id: string
                    user_id: string
                    message: string
                    is_read: boolean
                    link_to: string | null
                    reference_id: string | null
                    type: string | null
                    priority: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    message: string
                    is_read?: boolean
                    link_to?: string | null
                    reference_id?: string | null
                    type?: string | null
                    priority?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    message?: string
                    is_read?: boolean
                    link_to?: string | null
                    reference_id?: string | null
                    type?: string | null
                    priority?: string | null
                    created_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "notifications_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "users"
                        referencedColumns: ["id"]
                    }
                ]
            }
            profiles: {
                Row: {
                    id: string
                    email: string
                    full_name: string | null
                    phone: string | null
                    country: string | null
                    avatar_url: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id: string
                    email: string
                    full_name?: string | null
                    phone?: string | null
                    country?: string | null
                    avatar_url?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    email?: string
                    full_name?: string | null
                    phone?: string | null
                    country?: string | null
                    avatar_url?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "profiles_id_fkey"
                        columns: ["id"]
                        isOneToOne: true
                        referencedRelation: "users"
                        referencedColumns: ["id"]
                    }
                ]
            }
            profits: {
                Row: {
                    id: string
                    contract_id: string
                    user_id: string
                    amount: number
                    month_number: number
                    paid_at: string
                    created_at: string
                }
                Insert: {
                    id?: string
                    contract_id: string
                    user_id: string
                    amount: number
                    month_number: number
                    paid_at?: string
                    created_at?: string
                }
                Update: {
                    id?: string
                    contract_id?: string
                    user_id?: string
                    amount?: number
                    month_number?: number
                    paid_at?: string
                    created_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "profits_contract_id_fkey"
                        columns: ["contract_id"]
                        isOneToOne: false
                        referencedRelation: "contracts"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "profits_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "users"
                        referencedColumns: ["id"]
                    }
                ]
            }
            rate_limits: {
                Row: {
                    id: string
                    user_id: string | null
                    action: string
                    count: number
                    window_start: string
                    created_at: string
                }
                Insert: {
                    id?: string
                    user_id?: string | null
                    action: string
                    count?: number
                    window_start?: string
                    created_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string | null
                    action?: string
                    count?: number
                    window_start?: string
                    created_at?: string
                }
                Relationships: []
            }
            settings: {
                Row: {
                    id: string
                    key: string
                    value: string
                    description: string | null
                    type: string
                    category: string
                    updated_by: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    key: string
                    value: string
                    description?: string | null
                    type?: string
                    category?: string
                    updated_by?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    key?: string
                    value?: string
                    description?: string | null
                    type?: string
                    category?: string
                    updated_by?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "settings_updated_by_fkey"
                        columns: ["updated_by"]
                        isOneToOne: false
                        referencedRelation: "users"
                        referencedColumns: ["id"]
                    }
                ]
            }
            transaction_metadata: {
                Row: {
                    id: string
                    transaction_id: string
                    field_key: string
                    field_value: string
                    created_at: string
                }
                Insert: {
                    id?: string
                    transaction_id: string
                    field_key: string
                    field_value: string
                    created_at?: string
                }
                Update: {
                    id?: string
                    transaction_id?: string
                    field_key?: string
                    field_value?: string
                    created_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "transaction_metadata_transaction_id_fkey"
                        columns: ["transaction_id"]
                        isOneToOne: false
                        referencedRelation: "transactions"
                        referencedColumns: ["id"]
                    }
                ]
            }
            transactions: {
                Row: {
                    id: string
                    user_id: string
                    type: string
                    amount: number
                    currency: string
                    status: string
                    reference_id: string | null
                    description: string | null
                    payment_proof: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    type: string
                    amount: number
                    currency?: string
                    status?: string
                    reference_id?: string | null
                    description?: string | null
                    payment_proof?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    type?: string
                    amount?: number
                    currency?: string
                    status?: string
                    reference_id?: string | null
                    description?: string | null
                    payment_proof?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "transactions_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "users"
                        referencedColumns: ["id"]
                    }
                ]
            }
            user_roles: {
                Row: {
                    id: string
                    user_id: string
                    role: Database["public"]["Enums"]["app_role"]
                    created_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    role?: Database["public"]["Enums"]["app_role"]
                    created_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    role?: Database["public"]["Enums"]["app_role"]
                    created_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "user_roles_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "users"
                        referencedColumns: ["id"]
                    }
                ]
            }
            wallets: {
                Row: {
                    id: string
                    user_id: string
                    total_balance: number
                    invested_balance: number
                    profit_balance: number
                    locked_balance: number
                    currency: string
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    total_balance?: number
                    invested_balance?: number
                    profit_balance?: number
                    locked_balance?: number
                    currency?: string
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    total_balance?: number
                    invested_balance?: number
                    profit_balance?: number
                    locked_balance?: number
                    currency?: string
                    created_at?: string
                    updated_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "wallets_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: true
                        referencedRelation: "users"
                        referencedColumns: ["id"]
                    }
                ]
            }
            withdrawal_verifications: {
                Row: {
                    id: string
                    user_id: string
                    withdrawal_id: string
                    code: string
                    expires_at: string
                    verified: boolean
                    created_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    withdrawal_id: string
                    code: string
                    expires_at: string
                    verified?: boolean
                    created_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    withdrawal_id?: string
                    code?: string
                    expires_at?: string
                    verified?: boolean
                    created_at?: string
                }
                Relationships: []
            }
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            get_pending_deposits_with_profiles: {
                Args: Record<string, never>
                Returns: Json[]
            }
            approve_deposit: {
                Args: {
                    transaction_id_to_approve: string
                }
                Returns: { success: boolean; error?: string }
            }
            reject_deposit: {
                Args: {
                    transaction_id_to_reject: string
                    reason: string
                }
                Returns: { success: boolean; error?: string }
            }
            approve_deposits_in_bulk: {
                Args: {
                    transaction_ids: string[]
                }
                Returns: { success: boolean; error?: string; approved_count: number }
            }
            reject_deposits_in_bulk: {
                Args: {
                    transaction_ids: string[]
                    reason: string
                }
                Returns: { success: boolean; error?: string; rejected_count: number }
            }
            admin_adjust_deposit_amount: {
                Args: {
                    transaction_id_to_adjust: string
                    new_amount: number
                }
                Returns: { success: boolean; error?: string }
            }
            get_contracts_for_user: {
                Args: {
                    p_user_id: string
                }
                Returns: Json[]
            }
            get_investor_list_details: {
                Args: {
                    p_search_query?: string
                    p_page_num: number
                    p_page_size: number
                }
                Returns: { data: Json[]; count: number }
            }
            admin_credit_user: {
                Args: {
                    target_user_id: string
                    credit_amount: number
                    reason: string
                }
                Returns: { success: boolean; error?: string }
            }
            admin_deactivate_user: {
                Args: {
                    user_id_to_deactivate: string
                }
                Returns: { success: boolean; error?: string }
            }
            admin_activate_user: {
                Args: {
                    user_id_to_activate: string
                }
                Returns: { success: boolean; error?: string }
            }
            admin_update_user_profile: {
                Args: {
                    p_user_id: string
                    p_first_name: string
                    p_last_name: string
                    p_post_nom: string
                    p_phone: string
                }
                Returns: { success: boolean; error?: string }
            }
            get_admin_stats: {
                Args: Record<string, never>
                Returns: {
                    total_investors: number
                    active_investors: number
                    funds_under_management: number
                    total_profit: number
                    pending_deposits: number
                    pending_withdrawals: number
                }
            }
            get_aggregate_profits_by_month: {
                Args: Record<string, never>
                Returns: { month_year: string; total_profit: number }[]
            }
            get_cash_flow_summary: {
                Args: Record<string, never>
                Returns: Json[]
            }
            get_user_growth_summary: {
                Args: Record<string, never>
                Returns: { month_year: string; new_users_count: number }[]
            }
            get_pending_withdrawals_with_profiles: {
                Args: Record<string, never>
                Returns: Json[]
            }
            approve_withdrawal: {
                Args: {
                    transaction_id_to_approve: string
                }
                Returns: { success: boolean; error?: string }
            }
            reject_withdrawal: {
                Args: {
                    transaction_id_to_reject: string
                    reason: string
                }
                Returns: { success: boolean; error?: string }
            }
            admin_get_all_contracts: {
                Args: {
                    p_search_query: string
                    p_status_filter: string
                    p_page_num: number
                    p_page_size: number
                }
                Returns: { data: Json[]; count: number }
            }
            get_pending_refunds: {
                Args: Record<string, never>
                Returns: Json[]
            }
            approve_refund: {
                Args: {
                    _contract_id: string
                }
                Returns: { success: boolean; error?: string }
            }
            reject_refund: {
                Args: {
                    _contract_id: string
                    reason: string
                }
                Returns: { success: boolean; error?: string }
            }
            admin_update_contract: {
                Args: {
                    _contract_id: string
                    _updates: Json
                }
                Returns: { success: boolean; error?: string }
            }
            check_rate_limit: {
                Args: {
                    p_identifier: string
                    p_action: string
                    p_max_attempts: number
                    p_window_minutes: number
                }
                Returns: {
                    allowed: boolean
                    remaining: number
                    reset_at: string
                    blocked: boolean
                }
            }
            admin_unblock_rate_limit: {
                Args: {
                    p_identifier: string
                    p_action: string
                }
                Returns: boolean
            }
            get_portfolio_stats: {
                Args: {
                    p_user_id: string
                }
                Returns: {
                    total_invested: number
                    total_profits: number
                    profit_balance: number
                    active_contracts: number
                    completed_contracts: number
                    roi_percentage: number
                    annual_return_percentage: number
                    monthly_avg_profit: number
                    total_contracts: number
                }
            }
            calculate_contract_roi: {
                Args: {
                    p_contract_id: string
                }
                Returns: {
                    contract_amount: number
                    profits_paid: number
                    months_paid: number
                    duration_months: number
                    current_roi: number
                    projected_total: number
                    projected_roi: number
                    progress_percentage: number
                }
            }
            get_upcoming_payments: {
                Args: {
                    p_user_id: string
                    p_limit: number
                }
                Returns: Json[]
            }
            get_contract_profit_history: {
                Args: {
                    p_contract_id: string
                }
                Returns: Json[]
            }
            get_performance_trends: {
                Args: {
                    p_user_id: string
                }
                Returns: {
                    current_month: number
                    last_month: number
                    trend_percentage: number
                    is_positive: boolean
                }
            }
        }
        Enums: {
            app_role: "admin" | "investor"
        }
        CompositeTypes: {
            [_ in never]: never
        }
    }
}

type PublicSchema = Database[keyof Database]

export type Tables<
    PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
    TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
    ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
            Row: infer R
        }
    ? R
    : never
    : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
            Row: infer R
        }
    ? R
    : never
    : never

export type TablesInsert<
    PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
    TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
    ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
        Insert: infer I
    }
    ? I
    : never
    : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
    }
    ? I
    : never
    : never

export type TablesUpdate<
    PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
    TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
    ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
        Update: infer U
    }
    ? U
    : never
    : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
    }
    ? U
    : never
    : never

export type Enums<
    PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
    EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = PublicEnumNameOrOptions extends { schema: keyof Database }
    ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
    : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never
