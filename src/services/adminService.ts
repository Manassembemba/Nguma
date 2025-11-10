
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

// --- Deposit Management ---
export const getPendingDeposits = async () => {
  const { data, error } = await supabase.rpc('get_pending_deposits_with_profiles');

  if (error) {
    console.error("Error fetching pending deposits:", error);
    throw new Error("Could not fetch pending deposits.");
  }
  return data || [];
};

export const approveDeposit = async (transactionId: string) => {
  const { data, error } = await supabase.rpc('approve_deposit', { transaction_id_to_approve: transactionId });
  if (error) throw new Error(error.message);
  if (data && !data.success) throw new Error(data.error || "An unknown error occurred.");
  return data;
};

export const rejectDeposit = async (transactionId: string, reason: string) => {
  const { data, error } = await supabase.rpc('reject_deposit', { transaction_id_to_reject: transactionId, reason: reason });
  if (error) throw new Error(error.message);
  if (data && !data.success) throw new Error(data.error || "An unknown error occurred.");
  return data;
};

export const approveDepositsInBulk = async (transactionIds: string[]) => {
  const { data, error } = await supabase.rpc('approve_deposits_in_bulk', { transaction_ids: transactionIds });
  if (error) throw new Error(error.message);
  if (data && !data.success) throw new Error(data.error || "An unknown error occurred during bulk approval.");
  return data;
};

export const rejectDepositsInBulk = async (transactionIds: string[], reason: string) => {
  const { data, error } = await supabase.rpc('reject_deposits_in_bulk', { transaction_ids: transactionIds, reason: reason });
  if (error) throw new Error(error.message);
  if (data && !data.success) throw new Error(data.error || "An unknown error occurred during bulk rejection.");
  return data;
};

// --- User Management ---
export const getAllUsers = async () => {
  const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
  if (error) throw new Error("Could not fetch users.");
  return data || [];
};

export const getUserDetails = async (userId: string) => {
  const [profile, wallet, contracts, transactions] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).single(),
    supabase.from('wallets').select('*').eq('user_id', userId).single(),
    supabase.from('contracts').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('transactions').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(10)
  ]);
  if (profile.error || wallet.error || contracts.error || transactions.error) {
    throw new Error("Could not fetch complete user details.");
  }
  return { profile: profile.data, wallet: wallet.data, contracts: contracts.data, transactions: transactions.data };
};

export const getUserContracts = async (userId: string) => {
  const { data, error } = await supabase.rpc('get_contracts_for_user', { p_user_id: userId });

  if (error) {
    console.error("Error fetching contracts for user:", error);
    throw new Error("Could not fetch user contracts.");
  }
  return data || [];
};

export const uploadContractPdf = async (contractId: string, userId: string, file: File) => {
  const filePath = `${userId}/${contractId}.pdf`;
  const { error: uploadError } = await supabase.storage
    .from('contracts')
    .upload(filePath, file, { cacheControl: '3600', upsert: true });

  if (uploadError) {
    console.error("Error uploading contract PDF:", uploadError);
    throw new Error("Could not upload contract PDF.");
  }

  const { data: publicUrlData } = supabase.storage
    .from('contracts')
    .getPublicUrl(filePath);

  const publicUrl = publicUrlData.publicUrl;

  const { error: updateError } = await supabase
    .from('contracts')
    .update({ contract_pdf_url: publicUrl })
    .eq('id', contractId);

  if (updateError) {
    console.error("Error updating contract PDF URL:", updateError);
    throw new Error("Could not update contract PDF URL in database.");
  }

  return publicUrl;
};

export const getInvestorsList = async (searchQuery?: string, page: number = 1, pageSize: number = 10) => {
  let profilesQuery = supabase
    .from("profiles")
    .select("id, email, first_name, last_name, post_nom", { count: 'exact' });

  if (searchQuery) {
    profilesQuery = profilesQuery.or(`first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%,post_nom.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`);
  }

  const from = (page - 1) * pageSize;
  const to = page * pageSize - 1;

  const { data: profiles, error: profilesError, count } = await profilesQuery
    .order("created_at", { ascending: false })
    .range(from, to);

  if (profilesError) {
    console.error("Error fetching investors list:", profilesError);
    throw new Error("Could not fetch investors list.");
  }

  const investorsData = await Promise.all(
    (profiles || []).map(async (profile) => {
      const { data: wallet } = await supabase.from('wallets').select('*').eq('user_id', profile.id).single();
      const { data: contracts } = await supabase.from('contracts').select('status').eq('user_id', profile.id);
      return { ...profile, wallet, contracts: contracts || [] };
    })
  );

  return { data: investorsData, count: count || 0 };
};

// --- Admin Actions ---
export const creditUser = async ({ userId, amount, reason }: { userId: string; amount: number; reason: string }) => {
  const { data, error } = await supabase.rpc('admin_credit_user', { target_user_id: userId, credit_amount: amount, reason: reason });
  if (error) throw new Error("Could not credit user.");
  if (data && !data.success) throw new Error(data.error || "An unknown error occurred.");
  return data;
};

// --- Stats ---
export const getAdminDashboardStats = async () => {
  const { data, error } = await supabase.rpc('get_admin_stats');
  if (error) throw new Error("Could not fetch admin dashboard stats.");
  if (data && !data.success) throw new Error(data.error || "An unknown error occurred.");
  return data;
};

export const getAggregateProfitsByMonth = async () => {
  const { data, error } = await supabase.rpc('get_aggregate_profits_by_month');
  if (error) throw new Error("Could not fetch aggregate profits.");
  return data || [];
};

export const getCashFlowSummary = async () => {
  const { data, error } = await supabase.rpc('get_cash_flow_summary');
  if (error) {
    console.error("Error fetching cash flow summary:", error);
    throw new Error("Could not fetch cash flow summary.");
  }
  return data || [];
};

// --- Withdrawal Management ---
export const getPendingWithdrawals = async () => {
  const { data, error } = await supabase.rpc('get_pending_withdrawals_with_profiles');

  if (error) {
    console.error("Error fetching pending withdrawals:", error);
    throw new Error("Could not fetch pending withdrawals.");
  }
  return data || [];
};

export const approveWithdrawal = async (transactionId: string) => {
  const { data, error } = await supabase.rpc('approve_withdrawal', { transaction_id_to_approve: transactionId });
  if (error) throw new Error(error.message);
  if (data && !data.success) throw new Error(data.error);
  return data;
};

export const rejectWithdrawal = async (transactionId: string, reason: string) => {
  const { data, error } = await supabase.rpc('reject_withdrawal', { transaction_id_to_reject: transactionId, reason: reason });
  if (error) throw new Error(error.message);
  if (data && !data.success) throw new Error(data.error);
  return data;
};
