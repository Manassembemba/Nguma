import { supabase } from "@/integrations/supabase/client";

// ============================================================================
// TYPES
// ============================================================================

export interface PaymentCategory {
    id: string;
    code: string;
    name: string;
    description?: string;
    icon?: string;
    image_url?: string;
    display_order: number;
    is_active: boolean;
}

export interface PaymentMethod {
    id: string;
    category_id?: string;
    code: string;
    name: string;
    type: 'mobile_money' | 'crypto' | 'bank_transfer' | 'international_transfer';
    icon?: string;
    image_url?: string;
    description?: string;
    is_active: boolean;
    available_for_deposit: boolean;
    available_for_withdrawal: boolean;
    min_amount?: number;
    max_amount?: number;
    fee_type?: 'none' | 'fixed' | 'percentage' | 'combined';
    fee_fixed?: number;
    fee_percentage?: number;
    instructions?: string;
    admin_instructions?: string;
    display_order: number;
    requires_proof: boolean;
    processing_time?: string;
    fields?: PaymentMethodField[];
    category?: PaymentCategory;
}

export interface PaymentMethodField {
    id: string;
    payment_method_id: string;
    field_key: string;
    field_label: string;
    field_type: 'text' | 'textarea' | 'number' | 'tel' | 'email' | 'file';
    field_placeholder?: string;
    is_required: boolean;
    is_user_input: boolean;
    field_value?: string;
    validation_regex?: string;
    validation_message?: string;
    help_text?: string;
    display_order: number;
    show_copy_button: boolean;
}

export interface TransactionMetadata {
    transaction_id: string;
    field_key: string;
    field_value: string;
}

// ============================================================================
// CATÉGORIES
// ============================================================================

/**
 * Récupère toutes les catégories actives
 */
export const getActiveCategories = async (): Promise<PaymentCategory[]> => {
    const { data, error } = await supabase
        .from('payment_categories')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

    if (error) throw new Error(error.message);
    return data || [];
};

/**
 * Admin: Récupère toutes les catégories
 */
export const getAllCategories = async (): Promise<PaymentCategory[]> => {
    const { data, error } = await supabase
        .from('payment_categories')
        .select('*')
        .order('display_order', { ascending: true });

    if (error) throw new Error(error.message);
    return data || [];
};

// ============================================================================
// MÉTHODES DE PAIEMENT
// ============================================================================

/**
 * Récupère toutes les méthodes actives pour dépôt, groupées par catégorie
 */
export const getActiveDepositMethods = async (): Promise<PaymentMethod[]> => {
    const { data, error } = await supabase
        .from('payment_methods')
        .select(`
      *,
      category:payment_categories(*),
      fields:payment_method_fields(*)
    `)
        .eq('is_active', true)
        .eq('available_for_deposit', true)
        .order('display_order', { ascending: true });

    if (error) throw new Error(error.message);

    // Trier les champs par display_order
    return (data || []).map(method => ({
        ...method,
        fields: method.fields?.sort((a, b) => a.display_order - b.display_order) || []
    })) as PaymentMethod[];
};

/**
 * Récupère toutes les méthodes actives pour retrait
 */
export const getActiveWithdrawalMethods = async (): Promise<PaymentMethod[]> => {
    const { data, error } = await supabase
        .from('payment_methods')
        .select(`
      *,
      category:payment_categories(*),
      fields:payment_method_fields(*)
    `)
        .eq('is_active', true)
        .eq('available_for_withdrawal', true)
        .order('display_order', { ascending: true });

    if (error) throw new Error(error.message);

    return (data || []).map(method => ({
        ...method,
        fields: method.fields?.sort((a, b) => a.display_order - b.display_order) || []
    })) as PaymentMethod[];
};

/**
 * Récupère une méthode de paiement par son code
 */
export const getPaymentMethodByCode = async (code: string): Promise<PaymentMethod | null> => {
    const { data, error } = await supabase
        .from('payment_methods')
        .select(`
      *,
      category:payment_categories(*),
      fields:payment_method_fields(*)
    `)
        .eq('code', code)
        .single();

    if (error) {
        if (error.code === 'PGRST116') return null;
        throw new Error(error.message);
    }

    return {
        ...data,
        fields: data.fields?.sort((a, b) => a.display_order - b.display_order) || []
    } as PaymentMethod;
};

/**
 * Récupère une méthode de paiement par son ID
 */
export const getPaymentMethodById = async (id: string): Promise<PaymentMethod | null> => {
    const { data, error } = await supabase
        .from('payment_methods')
        .select(`
      *,
      category:payment_categories(*),
      fields:payment_method_fields(*)
    `)
        .eq('id', id)
        .single();

    if (error) {
        if (error.code === 'PGRST116') return null;
        throw new Error(error.message);
    }

    return {
        ...data,
        fields: data.fields?.sort((a, b) => a.display_order - b.display_order) || []
    } as PaymentMethod;
};

/**
 * Admin: Récupère toutes les méthodes (actives et inactives)
 */
export const getAllPaymentMethods = async (): Promise<PaymentMethod[]> => {
    const { data, error } = await supabase
        .from('payment_methods')
        .select(`
      *,
      category:payment_categories(*),
      fields:payment_method_fields(*)
    `)
        .order('display_order', { ascending: true });

    if (error) throw new Error(error.message);

    return (data || []).map(method => ({
        ...method,
        fields: method.fields?.sort((a, b) => a.display_order - b.display_order) || []
    })) as PaymentMethod[];
};

/**
 * Admin: Crée une nouvelle méthode de paiement
 */
export const createPaymentMethod = async (method: Partial<PaymentMethod>) => {
    const { data, error } = await supabase
        .from('payment_methods')
        .insert(method)
        .select()
        .single();

    if (error) throw new Error(error.message);
    return data;
};

/**
 * Admin: Met à jour une méthode de paiement
 */
export const updatePaymentMethod = async (id: string, updates: Partial<PaymentMethod>) => {
    const { data, error } = await supabase
        .from('payment_methods')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

    if (error) throw new Error(error.message);
    return data;
};

/**
 * Admin: Active/Désactive une méthode
 */
export const togglePaymentMethod = async (id: string, isActive: boolean) => {
    return updatePaymentMethod(id, { is_active: isActive });
};

/**
 * Admin: Supprime une méthode de paiement
 */
export const deletePaymentMethod = async (id: string) => {
    const { error } = await supabase
        .from('payment_methods')
        .delete()
        .eq('id', id);

    if (error) throw new Error(error.message);
};

// ============================================================================
// CHAMPS DE MÉTHODE
// ============================================================================

/**
 * Admin: Ajoute un champ à une méthode de paiement
 */
export const addPaymentMethodField = async (field: Partial<PaymentMethodField>) => {
    const { data, error } = await supabase
        .from('payment_method_fields')
        .insert(field)
        .select()
        .single();

    if (error) throw new Error(error.message);
    return data;
};

/**
 * Admin: Met à jour un champ
 */
export const updatePaymentMethodField = async (id: string, updates: Partial<PaymentMethodField>) => {
    const { data, error } = await supabase
        .from('payment_method_fields')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) throw new Error(error.message);
    return data;
};

/**
 * Admin: Supprime un champ
 */
export const deletePaymentMethodField = async (id: string) => {
    const { error } = await supabase
        .from('payment_method_fields')
        .delete()
        .eq('id', id);

    if (error) throw new Error(error.message);
};

// ============================================================================
// MÉTADONNÉES DE TRANSACTION
// ============================================================================

/**
 * Sauvegarde les métadonnées d'une transaction
 */
export const saveTransactionMetadata = async (
    transactionId: string,
    metadata: Record<string, string>
) => {
    const entries = Object.entries(metadata)
        .filter(([_, value]) => value !== undefined && value !== null && value !== '')
        .map(([key, value]) => ({
            transaction_id: transactionId,
            field_key: key,
            field_value: String(value),
        }));

    if (entries.length === 0) return;

    const { error } = await supabase
        .from('transaction_metadata')
        .insert(entries);

    if (error) throw new Error(error.message);
};

/**
 * Récupère les métadonnées d'une transaction
 */
export const getTransactionMetadata = async (transactionId: string): Promise<Record<string, string>> => {
    const { data, error } = await supabase
        .from('transaction_metadata')
        .select('*')
        .eq('transaction_id', transactionId);

    if (error) throw new Error(error.message);

    // Convertir en objet clé-valeur
    const metadata: Record<string, string> = {};
    (data || []).forEach(item => {
        metadata[item.field_key] = item.field_value || '';
    });

    return metadata;
};

// ============================================================================
// UTILITAIRES
// ============================================================================

/**
 * Calcule les frais pour une méthode de paiement
 */
export const calculateFees = (method: PaymentMethod, amount: number): number => {
    if (!method.fee_type || method.fee_type === 'none') return 0;

    let fees = 0;

    if (method.fee_type === 'fixed' || method.fee_type === 'combined') {
        fees += method.fee_fixed || 0;
    }

    if (method.fee_type === 'percentage' || method.fee_type === 'combined') {
        fees += (amount * (method.fee_percentage || 0)) / 100;
    }

    return fees;
};

/**
 * Valide un montant selon les limites de la méthode
 */
export const validateAmount = (method: PaymentMethod, amount: number): { valid: boolean; message?: string } => {
    if (method.min_amount && amount < method.min_amount) {
        return {
            valid: false,
            message: `Le montant minimum pour ${method.name} est de ${method.min_amount} USD.`
        };
    }

    if (method.max_amount && amount > method.max_amount) {
        return {
            valid: false,
            message: `Le montant maximum pour ${method.name} est de ${method.max_amount} USD.`
        };
    }

    return { valid: true };
};
